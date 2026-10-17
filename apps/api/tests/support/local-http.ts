import { Server } from 'node:net';

import supertest from 'supertest';

type LocalApp = Exclude<Parameters<typeof supertest>[0], string>;
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

// Supertest builds an IPv4 URL even when its owned listener is IPv6. On macOS the same port can
// belong to a different IPv4 service. Connect to the listener's actual family, never that service.
export default function request(app: LocalApp) {
  const client = supertest(app);
  const method = (verb: Method) => (path: string) => {
    const test = client[verb](path);
    if (!(test.app instanceof Server)) throw new Error('Local HTTP tests require an owned server.');
    const address = test.app.address();
    if (!address || typeof address === 'string') throw new Error('Local HTTP listener has no TCP address.');
    if (!['::', '::1', '0.0.0.0', '127.0.0.1'].includes(address.address)) {
      throw new Error('Local HTTP tests require a loopback or wildcard listener.');
    }
    const host = address.family === 'IPv6' ? '::1' : '127.0.0.1';
    return test.connect({ '127.0.0.1': host });
  };
  return {
    get: method('get'), post: method('post'), put: method('put'), patch: method('patch'),
    delete: method('delete'), head: method('head'), options: method('options')
  };
}
