import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const webRequire = createRequire(join(root, 'apps/web/package.json'));
const compilerPackage = webRequire.resolve('@angular/compiler-cli/package.json');
const compiler = JSON.parse(readFileSync(compilerPackage, 'utf8'));
const buildRequire = createRequire(webRequire.resolve('@angular/build/package.json'));
const { build } = await import(pathToFileURL(buildRequire.resolve('esbuild')).href);
const temporary = mkdtempSync(join(tmpdir(), 'worktrail-editor-harness-'));
const port = Number.parseInt(process.env.WORKTRAIL_EDITOR_TEST_PORT ?? '4317', 10);
const cleanup = () => rmSync(temporary, { recursive: true, force: true });
process.on('exit', cleanup);
let server;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    server?.close();
    cleanup();
    process.exit(0);
  });

try {
  // Compile the real components with Angular, without introducing a production test route.
  const config = join(temporary, 'tsconfig.json');
  writeFileSync(
    config,
    JSON.stringify({
      extends: join(root, 'apps/web/browser-tests/authored-content-editor/tsconfig.json'),
      compilerOptions: {
        rootDir: root,
        outDir: join(temporary, 'out'),
        types: []
      },
      references: []
    })
  );
  execFileSync(
    process.execPath,
    [resolve(dirname(compilerPackage), compiler.bin.ngc), '-p', config],
    { cwd: root, stdio: 'inherit', timeout: 60_000 }
  );
  const bundle = await build({
    entryPoints: [join(temporary, 'out/apps/web/browser-tests/authored-content-editor/main.js')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    nodePaths: [join(root, 'apps/web/node_modules'), join(root, 'node_modules')],
    alias: {
      '@worktrail/contracts': join(root, 'packages/contracts/src/index.ts')
    }
  });
  const html = readFileSync(
    join(root, 'apps/web/browser-tests/authored-content-editor/index.html'),
    'utf8'
  );
  server = createServer((request, response) => {
    if (request.url === '/main.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript',
        'Cache-Control': 'no-store'
      });
      response.end(bundle.outputFiles[0].contents);
    } else if (request.url === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store'
      });
      response.end(html);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  server.listen(port, '127.0.0.1', () =>
    console.log(`Editor test fixture: http://127.0.0.1:${port}`)
  );
} catch (error) {
  cleanup();
  throw error;
}
