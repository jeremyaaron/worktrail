import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from '../src/adapters/express/request-logging.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestLogger', () => {
  it('logs only the method, path, status, and duration', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = express();

    app.use(express.json());
    app.use(requestLogger);
    app.get('/search', (_request, response) => response.status(200).json({ ok: true }));
    app.post('/search', (_request, response) => response.status(204).end());

    await request(app).get('/search?query=confidential%20roadmap').expect(200);
    await request(app).post('/search').send({ query: 'private body terms' }).expect(204);

    const messages = log.mock.calls.map(([message]) => String(message));

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatch(/^GET \/search 200 \d+ms$/);
    expect(messages[1]).toMatch(/^POST \/search 204 \d+ms$/);
    expect(messages.join('\n')).not.toMatch(/confidential|roadmap|private|query=|\?/);
  });
});
