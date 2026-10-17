import { DefaultUrlSerializer, PRIMARY_OUTLET, UrlTree } from '@angular/router';
import { workItemQueryFieldPolicy, workItemQueryFields, type WorkItemQuery } from '@worktrail/contracts';
import * as options from '../../features/work-items/query/work-item-filter-options';
import { projectFormValueFromQueryParams, projectQueryFromFormValue, routerLinkQueryParamsFromWorkItemQuery, workspaceFormValueFromQueryParams, workspaceQueryFromFormValue } from '../../features/work-items/query/work-item-query-serialization';
import { routerQueryParamsFromWorkItemPage, workItemPageQueryFromParams } from '../../features/work-items/query/work-item-page-query-serialization';

const serializer = new DefaultUrlSerializer();
const targetLimit = 4 * 1024;
const navigationLimit = 12 * 1024;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const sections = new Set(['discussion', 'files', 'dependencies', 'history']);
const planningFragments = new Set(['review', 'cycles', 'milestones', 'cycles-heading', 'milestones-heading', 'planning-summary-heading', 'delivery-health-heading', 'milestone-progress-heading', 'review-needs-attention', 'review-upcoming', 'review-recently-changed']);
const reviewFragments = new Set(['cycle-result-heading', 'closeout-destination-heading', 'current-cycle-state-heading', 'cycle-health-heading', 'cycle-estimate-heading', 'review-health-heading', 'scope-breakdown-heading', 'risk-sections-heading', 'recent-work-heading', 'unfinished-heading']);
const reportFragments = new Set(['report-actions-heading', 'report-summary-heading', 'report-health-heading', 'report-cycle-heading', 'report-milestones-heading']);
type Kind = 'record' | 'work' | 'planning' | 'cycle' | 'closeout' | 'milestone' | 'report' | 'board' | 'project' | 'my-work' | 'inbox' | 'projects' | 'portfolio' | 'reports' | 'settings';
export interface WorkNavigationTarget {
  path: string;
  queryParams: Record<string, string> | null;
  fragment: string | null;
  url: string;
  label: string;
  kind: Kind;
}
export interface WorkNavigationContext {
  origin: WorkNavigationTarget;
  immediate: WorkNavigationTarget | null;
  fallback: WorkNavigationTarget;
}

export function workItemSection(fragment: string | null): string | null {
  return fragment !== null && (sections.has(fragment) || (fragment.startsWith('comment-') && idPattern.test(fragment.slice(8)))) ? fragment : null;
}

export function originSection(fragment: string | null): string | null {
  return fragment && (planningFragments.has(fragment) || reviewFragments.has(fragment) || reportFragments.has(fragment)) ? fragment : null;
}

function bytes(value: string): number { return new TextEncoder().encode(value).length; }
function unsafe(value: string): boolean { return value.includes('\\') || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127); }
function hasOutlets(tree: UrlTree): boolean {
  const visit = (group: typeof tree.root): boolean => Object.keys(group.children).some(key => key !== PRIMARY_OUTLET || visit(group.children[key]));
  return visit(tree.root);
}
function build(path: string, queryParams: Record<string, string> | null, fragment: string | null, kind: Kind, label: string): WorkNavigationTarget {
  const tree = serializer.parse(path);
  tree.queryParams = queryParams ?? {};
  tree.fragment = fragment;
  return { path, queryParams, fragment, kind, label, url: serializer.serialize(tree) };
}

const enumValues: Record<string, readonly string[]> = {
  status: options.workItemStatusOptions, type: options.workItemTypeOptions, priority: options.workItemPriorityOptions,
  workState: options.workItemStateOptions.map(value => value.value), assigneeState: ['assigned', 'unassigned'],
  dueDateState: options.dueDateStateOptions.map(value => value.value), estimateState: ['estimated', 'unestimated'],
  blocked: ['true', 'false'], dependency: options.dependencyFilterOptions.map(value => value.value),
  workRisk: ['unassigned_active', 'stale_in_progress'], hierarchy: options.workItemHierarchyOptions.map(value => value.value),
  archivedProjects: options.archivedProjectModeOptions.map(value => value.value), sort: options.workItemSortOptions.map(value => value.value)
};

// Input is already a query value decoded once by Angular. Parse URL components, never decode the target again.
export function parseWorkNavigationTarget(value: string | null | undefined): WorkNavigationTarget | null {
  if (!value || bytes(value) > targetLimit || !value.startsWith('/') || value.startsWith('//') || unsafe(value) || /%(?![a-f0-9]{2})/i.test(value)) return null;
  try {
    const tree = serializer.parse(value);
    if (hasOutlets(tree)) return null;
    const segments = tree.root.children[PRIMARY_OUTLET]?.segments ?? [];
    if (segments.some(segment => Object.keys(segment.parameters).length || !idPattern.test(segment.path))) return null;
    const parts = segments.map(segment => segment.path);
    const params = tree.queryParams as Record<string, unknown>;
    const keys = [...new URL(value, 'https://worktrail.invalid').searchParams.keys()];
    if (keys.length !== Object.keys(params).length || keys.some(key => !Object.hasOwn(params, key))) return null;
    if (Object.values(params).some(item => typeof item !== 'string' || unsafe(item)) || 'returnUrl' in params || 'returnTo' in params) return null;
    let kind: Kind;
    const project = parts[0] === 'projects' && parts.length >= 2;
    if (parts.length === 1 && ['my-work', 'inbox', 'projects', 'portfolio'].includes(parts[0])) kind = parts[0] as Kind;
    else if (parts[0] === 'work-items' && parts.length === 1) kind = 'work';
    else if (parts[0] === 'work-items' && parts.length === 2 && !['new', 'import'].includes(parts[1])) kind = 'record';
    else if (project && parts.length === 2) kind = 'project';
    else if (project && parts.length === 3 && ['work-items', 'planning', 'board', 'status', 'settings'].includes(parts[2])) {
      kind = ({ 'work-items': 'work', planning: 'planning', board: 'board', status: 'reports', settings: 'settings' } as const)[parts[2] as 'planning'];
    } else if (project && parts.length === 4 && ['cycles', 'milestones', 'status'].includes(parts[2]) && parts[3] !== 'new') kind = parts[2] === 'cycles' ? 'cycle' : parts[2] === 'milestones' ? 'milestone' : 'report';
    else if (project && parts.length === 5 && parts[2] === 'cycles' && parts[4] === 'closeout') kind = 'closeout';
    else if (parts.join('/') === 'workspace/settings') kind = 'settings';
    else return null;

    const fragment = tree.fragment || null;
    if (fragment && !(kind === 'record' ? workItemSection(fragment) : kind === 'planning' ? planningFragments.has(fragment) : kind === 'report' ? reportFragments.has(fragment) : ['cycle', 'milestone', 'closeout'].includes(kind) && reviewFragments.has(fragment))) return null;
    let query = params as Record<string, string>;
    if (kind === 'work') {
      const scope = project ? 'project' : 'workspace';
      const allowed = new Set<string>(workItemQueryFields.filter(key => scope === 'workspace' || workItemQueryFieldPolicy[key].scope === 'both'));
      allowed.add('page'); allowed.add('pageSize');
      if (Object.entries(query).some(([key, item]) => !allowed.has(key) || (enumValues[key] && !enumValues[key].includes(item)) || (key.endsWith('Id') && !idPattern.test(item)) || (key === 'parentKey' && !/^[A-Za-z0-9]{2,8}-[1-9]\d*$/.test(item)))) return null;
      if (query['page'] && (!/^[1-9]\d*$/.test(query['page']) || !Number.isSafeInteger(Number(query['page'])))) return null;
      if (query['pageSize'] && !['10', '25', '50', '100'].includes(query['pageSize'])) return null;
      const reader = tree.queryParamMap;
      const canonical: WorkItemQuery = scope === 'project' ? projectQueryFromFormValue(projectFormValueFromQueryParams(reader)) : workspaceQueryFromFormValue(workspaceFormValueFromQueryParams(reader));
      query = { ...routerLinkQueryParamsFromWorkItemQuery(canonical, scope), ...Object.fromEntries(Object.entries(routerQueryParamsFromWorkItemPage(workItemPageQueryFromParams(reader))).filter((entry): entry is [string, string] => entry[1] !== null)) };
    } else if (kind === 'planning') {
      if (Object.keys(query).some(key => key !== 'view') || (query['view'] && !['review', 'cycles', 'milestones'].includes(query['view']))) return null;
    } else if (Object.keys(query).length) return null;
    if (kind === 'record' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(parts[1])) parts[1] = parts[1].toLowerCase();
    const path = '/' + parts.join('/');
    const labels: Record<Kind, string> = { record: 'Back to work item', work: project ? 'Back to project work' : 'Back to work items', planning: 'Back to Planning', cycle: 'Back to cycle review', closeout: 'Back to cycle closeout', milestone: 'Back to milestone review', report: 'Back to report', board: 'Back to board', project: 'Back to project', 'my-work': 'Back to My Work', inbox: 'Back to Inbox', projects: 'Back to projects', portfolio: 'Back to portfolio', reports: 'Back to reports', settings: 'Back to settings' };
    const label = kind === 'work' && Object.keys(query).some(key => !['page', 'pageSize'].includes(key)) ? 'Back to filtered work' : labels[kind];
    const result = build(path, Object.keys(query).length ? query : null, fragment, kind, label);
    return bytes(result.url) <= targetLimit ? result : null;
  } catch { return null; }
}

export function workNavigationContext(returnUrl: string | null | undefined, returnTo: string | null | undefined, fallbackUrl = '/work-items', currentId?: string): WorkNavigationContext {
  const candidate = parseWorkNavigationTarget(fallbackUrl);
  const fallback = candidate && candidate.kind !== 'record' ? candidate : parseWorkNavigationTarget('/work-items')!;
  const empty = { origin: fallback, immediate: null, fallback };
  const origin = returnUrl ? parseWorkNavigationTarget(returnUrl) : fallback;
  const immediate = returnTo ? parseWorkNavigationTarget(returnTo) : null;
  const current = currentId ? parseWorkNavigationTarget('/work-items/' + currentId)?.path : null;
  if (!origin || (returnTo && (!immediate || immediate.kind !== 'record')) || (current && (origin.kind === 'record' && origin.path === current || immediate?.path === current))) return empty;
  if (origin.kind === 'record') return returnTo ? empty : { origin: fallback, immediate: origin, fallback };
  return { origin, immediate, fallback };
}

export function navigationContextFromPage(url: string, fallback = '/work-items'): WorkNavigationContext {
  try {
    if (unsafe(url) || /%(?![a-f0-9]{2})/i.test(url) || bytes(url) > navigationLimit) return workNavigationContext(null, null, fallback);
    const tree = serializer.parse(url);
    const from = tree.queryParams['returnUrl']; const immediate = tree.queryParams['returnTo'];
    delete tree.queryParams['returnUrl']; delete tree.queryParams['returnTo'];
    const page = parseWorkNavigationTarget(serializer.serialize(tree));
    if (!page || (from !== undefined && typeof from !== 'string') || (immediate !== undefined && typeof immediate !== 'string')) return workNavigationContext(null, null, fallback);
    if (page.kind === 'record') {
      const context = workNavigationContext(from, immediate, fallback, page.path.split('/')[2]);
      return { ...context, immediate: page };
    }
    return from || immediate ? workNavigationContext(from, immediate, fallback) : workNavigationContext(page.url, null, fallback);
  } catch { return workNavigationContext(null, null, fallback); }
}

function boundedParams(path: string, params: Record<string, string>, fragment: string | null, fallback: WorkNavigationTarget): Record<string, string> {
  return bytes(build(path, params, fragment, 'record', '').url) <= navigationLimit ? params : { returnUrl: fallback.url };
}

export function recordOriginParams(origin: string, fragment: string | null = null): { returnUrl: string } {
  const parsed = parseWorkNavigationTarget(origin);
  const context = workNavigationContext(parsed && fragment ? build(parsed.path, parsed.queryParams, fragment, parsed.kind, parsed.label).url : origin, null);
  return boundedParams('/work-items/' + 'x'.repeat(128), { returnUrl: context.origin.url }, 'comment-' + 'x'.repeat(128), context.fallback) as { returnUrl: string };
}

export function bareWorkItemUrl(id: string, fragment: string | null): string {
  return idPattern.test(id) ? build('/work-items/' + id, null, workItemSection(fragment), 'record', '').url : '/work-items';
}

export function recordNavigationTarget(id: string, context: WorkNavigationContext, source?: string, fragment: string | null = null): WorkNavigationTarget {
  if (!idPattern.test(id) || ['new', 'import'].includes(id)) return context.fallback;
  const path = '/work-items/' + id;
  const prior = source ? parseWorkNavigationTarget(source) : context.immediate;
  const immediate = context.immediate?.path === path ? null : prior?.kind === 'record' && prior.path !== path ? prior : null;
  const params = { returnUrl: context.origin.url, ...(immediate ? { returnTo: immediate.url } : {}) };
  const safeFragment = workItemSection(fragment ?? (context.immediate?.path === path ? context.immediate.fragment : null));
  return build(path, boundedParams(path, params, safeFragment, context.fallback), safeFragment, 'record', 'Back to work item');
}

export function returnNavigationTarget(context: WorkNavigationContext): WorkNavigationTarget {
  return context.immediate ? build(context.immediate.path, boundedParams(context.immediate.path, { returnUrl: context.origin.url }, context.immediate.fragment, context.fallback), context.immediate.fragment, 'record', 'Back to work item') : context.origin;
}

export function createNavigationTarget(projectId: string, parentId: string, context: WorkNavigationContext, source?: string): WorkNavigationTarget {
  if (!idPattern.test(projectId) || parentId && !idPattern.test(parentId)) return context.fallback;
  const path = '/projects/' + projectId + '/work-items/new';
  const immediate = source ? parseWorkNavigationTarget(source) : context.immediate;
  const query = { returnUrl: context.origin.url, ...(immediate?.kind === 'record' ? { returnTo: immediate.url } : {}), ...(parentId ? { parentWorkItemId: parentId } : {}) };
  if (bytes(build(path, query, null, 'record', '').url) > navigationLimit) return build(path, { returnUrl: context.fallback.url, ...(parentId ? { parentWorkItemId: parentId } : {}) }, null, 'record', '');
  return build(path, query, null, 'record', '');
}
