import { createServer, type Server } from 'node:http';
import type { AddressInfo, ListenOptions } from 'node:net';

import { describe, expect, it } from 'vitest';

import request from './support/local-http.js';

async function close(server: Server) {
  if (server.listening) await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function listen(server: Server, options: ListenOptions) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options, () => { server.off('error', reject); resolve(); });
  });
}

describe('owned local HTTP destination', () => {
  it('reaches the IPv6 listener without touching a different IPv4 service on the same port', async () => {
    let sentinelRequests = 0;
    const sentinel = createServer((_req, res) => { sentinelRequests++; res.writeHead(401).end('sentinel'); });
    const intended = createServer((_req, res) => res.end('intended application'));
    try {
      await listen(sentinel, { port: 0, host: '127.0.0.1' });
      const port = (sentinel.address() as AddressInfo).port;
      await listen(intended, { port, host: '::', ipv6Only: true });
      await request(intended).get('/').expect(200, 'intended application');
      expect(sentinelRequests).toBe(0);
    } finally {
      await close(intended);
      await close(sentinel);
    }
  });

  it('retains IPv4 support and normal Supertest assertions', async () => {
    const intended = createServer((_req, res) => res.end('IPv4 application'));
    try {
      await listen(intended, { port: 0, host: '127.0.0.1' });
      await request(intended).post('/').send({ value: 1 }).expect(200, 'IPv4 application');
    } finally {
      await close(intended);
    }
  });
});
