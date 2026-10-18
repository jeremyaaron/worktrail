import express from 'express';
import { createServer, request as httpRequest } from 'node:http';
import request from './support/local-http.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from '../src/adapters/express/request-logging.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestLogger', () => {
  it('logs only the method, route template, status, and duration once per response', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = express();

    app.use(requestLogger);
    app.use(express.json());
    app.get('/search/:privateId', (_request, response) => response.status(200).json({ ok: true }));
    app.post('/search/:privateId', (_request, response) => response.status(204).end());

    await request(app).get('/search/confidential-record?query=confidential%20roadmap').expect(200);
    await request(app).post('/search/confidential-record').send({ query: 'private body terms' }).expect(204);

    const messages = log.mock.calls.map(([message]) => String(message));

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatch(/^GET \/search\/:privateId 200 \d+ms$/);
    expect(messages[1]).toMatch(/^POST \/search\/:privateId 204 \d+ms$/);
    expect(messages.join('\n')).not.toMatch(/confidential|roadmap|body terms|query=|\?/);
  });

  it('records a real aborted body once without logging source or arbitrary path', async () => {
    const app = express();
    app.use(requestLogger);
    app.use(express.json());
    app.use((_error: unknown, _request: express.Request, _response: express.Response, _next: express.NextFunction) => undefined);
    const server = createServer(app);
    let resolveLog!: () => void;
    const logged = new Promise<void>((resolve) => { resolveLog = resolve; });
    const log = vi.spyOn(console, 'log').mockImplementation(() => resolveLog());
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an owned TCP listener.');
      const client = httpRequest({ hostname: '127.0.0.1', port: address.port, path: '/private-path?secret=token',
        method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '1000' } });
      client.on('error', () => undefined);
      server.once('request', (incoming) => incoming.once('data', () => client.destroy()));
      client.write('{"secret":"private-source');
      await logged;
      expect(log.mock.calls).toEqual([[expect.stringMatching(/^POST \[aborted\] 499 \d+ms$/)]]);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-path|private-source|token/);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
