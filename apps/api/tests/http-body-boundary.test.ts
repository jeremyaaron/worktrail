import { gzipSync } from 'node:zlib';
import { createServer, request as httpRequest } from 'node:http';
import express from 'express';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonBodyLimits } from '../src/adapters/express/body-parsing.js';
import { middlewareErrorBoundary } from '../src/adapters/express/error-boundary.js';
import { requestLogger } from '../src/adapters/express/request-logging.js';
import { createExpressApp } from '../src/adapters/express/server.js';
import request from './support/local-http.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const handler = vi.fn(() => ({ status: 204 }));
  return { handler, app: createExpressApp({ testRoutes: { '/api/test/body': handler } }) };
}

describe('HTTP JSON body boundary', () => {
  it('accepts exactly 100 KiB and rejects one byte more on ordinary routes', async () => {
    const { app, handler } = fixture();
    const overhead = Buffer.byteLength(JSON.stringify({ value: '' }));
    const exact = JSON.stringify({ value: 'a'.repeat(jsonBodyLimits.ordinary - overhead) });
    expect(Buffer.byteLength(exact)).toBe(102_400);
    await request(app).post('/api/test/body').type('json').send(exact).expect(204);
    const rejected = await request(app).post('/api/test/body').type('json').send(`${exact} `).expect(413);
    expect(rejected.body).toEqual({ error: {
      code: 'PAYLOAD_TOO_LARGE', message: 'The request body exceeds the 102400 bytes limit.',
      details: { limitBytes: 102_400 }
    } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each(['{"secret":"private-source",', 'null', '"private-source"', '{"secret":"private-source"} trailing'])(
    'returns safe structured errors for invalid/strict JSON: %s', async (body) => {
      const { app, handler } = fixture();
      const rejected = await request(app).post('/api/test/body?token=private-token').type('json').send(body).expect(400);
      expect(rejected.body).toEqual({ error: {
        code: 'VALIDATION_ERROR', message: 'The request body must contain valid JSON.',
        details: { reason: 'invalid_json' }
      } });
      expect(handler).not.toHaveBeenCalled();
      const log = vi.mocked(console.log).mock.calls;
      expect(log).toHaveLength(1);
      expect(log[0]![0]).toMatch(/^POST \[invalid_json\] 400 \d+ms$/);
      expect(JSON.stringify([rejected.body, log])).not.toMatch(/private-source|private-token|SyntaxError|stack/);
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it.each(['gzip', 'deflate', 'br', 'unrecognized-private-encoding'])(
    'rejects JSON content encoding %s without inflation', async (encoding) => {
      const { app, handler } = fixture();
      const rejected = await request(app).post('/api/test/body').type('json')
        .set('Content-Encoding', encoding).send(gzipSync('{"secret":"private-source"}')).expect(415);
      expect(rejected.body).toEqual({ error: {
        code: 'VALIDATION_ERROR', message: 'The request body encoding is not supported.',
        details: { reason: 'unsupported_encoding' }
      } });
      expect(handler).not.toHaveBeenCalled();
      expect(JSON.stringify([rejected.body, vi.mocked(console.log).mock.calls])).not.toMatch(/private-source|unrecognized-private/);
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it('rejects unsupported charsets without reflecting the charset or source', async () => {
    const { app, handler } = fixture();
    const rejected = await request(app).post('/api/test/body')
      .set('Content-Type', 'application/json; charset=private-charset').send('{"secret":"private-source"}').expect(415);
    expect(rejected.body.error.details).toEqual({ reason: 'unsupported_encoding' });
    expect(handler).not.toHaveBeenCalled();
    expect(JSON.stringify([rejected.body, vi.mocked(console.log).mock.calls])).not.toMatch(/private-charset|private-source/);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('logs unknown paths as a fixed category rather than user-controlled path data', async () => {
    const { app } = fixture();
    await request(app).get('/private-unmatched-path?token=private-token').expect(404);
    expect(vi.mocked(console.log).mock.calls).toEqual([[expect.stringMatching(/^GET \[unmatched\] 404 \d+ms$/)]]);
  });

  it('enforces the ordinary limit on a real chunked request without Content-Length', async () => {
    const { app, handler } = fixture();
    const server = createServer(app);
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected an owned TCP listener.');
      const result = await new Promise<{ status: number | undefined; body: unknown }>((resolve, reject) => {
        const client = httpRequest({ hostname: '127.0.0.1', port: address.port, path: '/api/test/body',
          method: 'POST', headers: { 'content-type': 'application/json' } }, (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('error', reject);
          response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
        });
        client.on('error', reject);
        client.write('{"value":"');
        client.write('a'.repeat(jsonBodyLimits.ordinary));
        client.end('"}');
      });
      expect(result).toMatchObject({ status: 413, body: { error: { code: 'PAYLOAD_TOO_LARGE', details: { limitBytes: 102_400 } } } });
      expect(handler).not.toHaveBeenCalled();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('sanitizes unexpected middleware errors in both response and logs', async () => {
    const app = express();
    app.use(requestLogger);
    app.use(() => { throw new Error('private middleware source'); });
    app.use(middlewareErrorBoundary);
    const rejected = await request(app).get('/private-path').expect(500);
    expect(rejected.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
    expect(vi.mocked(console.error).mock.calls).toEqual([['Request middleware failed.']]);
    expect(vi.mocked(console.log).mock.calls).toEqual([[expect.stringMatching(/^GET \[internal_error\] 500 \d+ms$/)]]);
    expect(JSON.stringify([rejected.body, vi.mocked(console.error).mock.calls, vi.mocked(console.log).mock.calls])).not.toMatch(/private middleware|private-path|stack/);
  });
});
