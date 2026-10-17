import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const key = (finding) => JSON.stringify([finding.advisory, finding.package, finding.path, finding.version, finding.severity]);

function demand(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseAudit({ stdout, code }) {
  let report;
  try { report = JSON.parse(stdout); }
  catch { throw new Error('Audit unavailable: npm did not return JSON.'); }
  demand(object(report) && !report.error && report.auditReportVersion === 2 &&
    object(report.vulnerabilities) && object(report.metadata?.vulnerabilities),
  'Audit unavailable: incomplete, unsupported, or error response.');
  const counts = report.metadata.vulnerabilities;
  demand(severities.every((s) => Number.isInteger(counts[s]) && counts[s] >= 0) &&
    counts.total === severities.reduce((n, s) => n + counts[s], 0) &&
    counts.total === Object.keys(report.vulnerabilities).length,
  'Audit unavailable: inconsistent vulnerability counts.');
  demand(code === (counts.total === 0 ? 0 : 1), 'Audit unavailable: unexpected npm exit status.');
  for (const [name, row] of Object.entries(report.vulnerabilities)) {
    demand(object(row) && row.name === name && severities.includes(row.severity) &&
      Array.isArray(row.nodes) && row.nodes.length > 0 && row.nodes.every(nonempty) &&
      Array.isArray(row.via) && row.via.length > 0,
    `Audit unavailable: malformed finding ${name}.`);
  }
  demand(severities.every((s) => counts[s] === Object.values(report.vulnerabilities).filter((row) => row.severity === s).length),
    'Audit unavailable: inconsistent severity counts.');
  return report;
}

export async function collectAudit(cwd, production, run = execute) {
  const args = ['audit', '--json', '--audit-level=info', '--fetch-retries=0', '--fetch-timeout=30000',
    '--workspaces', '--include-workspace-root', '--include=optional', '--include=peer'];
  args.push(production ? '--omit=dev' : '--include=dev');
  let response;
  try {
    response = { ...await run('npm', args, { cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }), code: 0 };
  } catch (error) {
    // npm uses exit 1 for findings as well as some transport failures. Validate the payload too.
    response = { stdout: error.stdout, code: error.code };
  }
  return parseAudit(response);
}

export async function verifyDependencyGraph(cwd, run = execute) {
  let result;
  try {
    const { stdout } = await run('npm', ['ls', '--all', '--json', '--workspaces', '--include-workspace-root',
      '--include=dev', '--include=optional', '--include=peer'], {
      cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 10 * 1024 * 1024
    });
    result = JSON.parse(stdout);
  } catch { throw new Error('Dependency graph check failed; inspect npm ls --all for invalid/missing peers or command errors.'); }
  demand(object(result) && object(result.dependencies) && !result.error &&
    (!result.problems || (Array.isArray(result.problems) && result.problems.length === 0)),
  'Dependency graph check failed: malformed response or dependency problems.');
}

export async function installedDependencyRoot(cwd) {
  // Verification snapshots share installed packages through read-only symlinks. npm ls must
  // inspect their actual installation owner, not interpret those mirror links as extra packages.
  const root = dirname(dirname(await realpath(join(cwd, 'node_modules/.package-lock.json'))));
  demand(await readFile(join(root, 'package-lock.json'), 'utf8') === await readFile(join(cwd, 'package-lock.json'), 'utf8'),
    'Installed dependency owner and verification snapshot have different lockfiles; restart after npm ci.');
  return root;
}

export function auditFindings(report, lock) {
  demand(lock.lockfileVersion === 3 && object(lock.packages), 'Audit requires a v3 workspace lockfile.');
  const rows = report.vulnerabilities;
  const advisories = (name, seen = new Set()) => {
    demand(rows[name] && !seen.has(name), `Audit unavailable: unresolved or cyclic advisory chain ${name}.`);
    const next = new Set([...seen, name]);
    return rows[name].via.flatMap((via) => {
      if (typeof via === 'string') return advisories(via, next);
      demand(object(via) && /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(via.url) &&
        severities.includes(via.severity) && nonempty(via.range) && nonempty(via.name),
      `Audit unavailable: unsupported advisory identity in ${name}.`);
      return [via.url.split('/').at(-1)];
    });
  };
  const findings = new Map();
  for (const [name, row] of Object.entries(rows)) {
    for (const path of row.nodes) {
      const entry = lock.packages[path];
      demand(entry && nonempty(entry.version), `Audit path absent from lockfile: ${path}.`);
      for (const advisory of advisories(name)) {
        const finding = { advisory, package: name, path, version: entry.version, severity: row.severity };
        findings.set(key(finding), finding);
      }
    }
  }
  return [...findings.values()].sort((a, b) => key(a).localeCompare(key(b)));
}

function date(value) {
  demand(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(value).toISOString().slice(0, 10) === value, 'Invalid audit exception date.');
  return Date.parse(`${value}T00:00:00Z`);
}

function version(value) {
  demand(typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value), 'Audit policy requires a stable release version.');
  return value.split('.').map(Number);
}

function atLeast(left, right) {
  const a = version(left), b = version(right);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
}

export function evaluateAudits({ production, full, lock, policy, currentVersion, now = new Date() }) {
  // Production never consults the development exception list.
  demand(production.metadata.vulnerabilities.total === 0, 'Production audit failed: no exceptions permitted.');
  const findings = auditFindings(full, lock);
  demand(policy.schemaVersion === 1 && Array.isArray(policy.exceptions), 'Invalid development audit policy.');
  const created = date(policy.createdOn), deadline = date(policy.maxExpiresOn);
  demand(Number.isFinite(now.getTime()) && deadline > created && deadline <= created + 30 * 86_400_000,
    'Audit policy must have a concrete deadline within 30 days of creation.');
  demand(!atLeast(currentVersion, policy.reviewBeforeVersion) || policy.exceptions.length === 0,
    'Development exceptions expired at the release boundary.');
  let releaseDeadline = deadline;
  if (policy.releaseDate !== null) releaseDeadline = Math.min(deadline, date(policy.releaseDate) + 30 * 86_400_000);
  else demand(!atLeast(currentVersion, policy.releaseVersion), 'Set the actual release date before release verification.');
  const allowed = new Set();
  const actual = new Set(findings.map(key));
  for (const exception of policy.exceptions) {
    demand(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(exception.advisory) &&
      ['owner', 'preconditions', 'mitigation', 'followUp', 'trustBoundary'].every((field) => nonempty(exception[field])) &&
      Array.isArray(exception.commands) && exception.commands.length > 0 && exception.commands.every(nonempty) &&
      Array.isArray(exception.dependencyPaths) && exception.dependencyPaths.length > 0 && exception.dependencyPaths.every(nonempty) &&
      Array.isArray(exception.affected) && exception.affected.length > 0,
    'Every development exception needs an advisory, owner, exposure, mitigation, follow-up, commands, and paths.');
    const expires = date(exception.expiresOn);
    demand(expires <= releaseDeadline && expires > now.getTime(), `Expired or overlong development exception: ${exception.advisory}.`);
    for (const affected of exception.affected) {
      const finding = { ...affected, advisory: exception.advisory };
      demand(['package', 'path', 'version', 'severity'].every((field) => nonempty(affected[field])) &&
        lock.packages[affected.path]?.dev === true, `Exception is not development-only: ${affected.path}.`);
      const identity = key(finding);
      demand(!allowed.has(identity), `Duplicate exception: ${identity}.`);
      demand(actual.has(identity), `Stale development exception: ${identity}. Remove it after remediation.`);
      allowed.add(identity);
    }
  }
  const unaccounted = findings.filter((finding) => !allowed.has(key(finding)));
  demand(unaccounted.length === 0, `Unaccounted development findings:\n${unaccounted.map(key).join('\n')}`);
  return { production: 0, full: full.metadata.vulnerabilities, advisories: policy.exceptions.length, accountedPaths: findings.length };
}
