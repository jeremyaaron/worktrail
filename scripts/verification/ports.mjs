// @ts-check
import { createServer } from 'node:net';

/** @param {number} [requested] @returns {Promise<number>} */
export function selectPort(requested = 0) {
  return new Promise((resolve, reject) => {
    const reservation = createServer();
    reservation.once('error', () => reject(new Error(
      requested ? `Requested port ${requested} is occupied or unavailable; its occupant was not stopped.` : 'Could not allocate a loopback port.'
    )));
    reservation.listen(requested, '127.0.0.1', () => {
      const address = reservation.address();
      if (!address || typeof address === 'string') { reservation.close(); reject(new Error('Could not allocate a loopback port.')); return; }
      reservation.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

/** @param {string | undefined} value @returns {number | undefined} */
export function requestedPort(value) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Requested ports must be integers from 1 to 65535.');
  return Number(value);
}

/** @param {string} name @param {Record<string, number>} ports @param {NodeJS.ProcessEnv} env */
export function browserPortRequest(name, ports, env) {
  const variables = /** @type {Record<string, string>} */ ({ api: 'API_PORT', web: 'WORKTRAIL_E2E_WEB_PORT', preview: 'WORKTRAIL_PREVIEW_PORT', editor: 'WORKTRAIL_EDITOR_TEST_PORT' });
  return ports[name] ?? (name === 'preview' ? ports.api : undefined) ??
    requestedPort(env[variables[name]] ?? (name === 'preview' ? env.API_PORT : undefined));
}

/** @param {string} mode @param {Record<string, number>} requested @param {NodeJS.ProcessEnv} [env] */
export async function planBrowserPorts(mode, requested, env = process.env) {
  const names = mode === 'full' ? ['api', 'web', 'preview', 'editor'] : mode === 'e2e' ? ['api', 'web'] :
    ['preview', 'editor'].includes(mode) ? [mode] : [];
  const ports = /** @type {Record<string, number>} */ ({});
  for (const name of names) {
    const desired = browserPortRequest(name, requested, env);
    if (name === 'web' && desired !== undefined && desired === ports['api']) throw new Error('Requested API/web ports must be distinct.');
    do { ports[name] = await selectPort(desired); } while (name === 'web' && ports[name] === ports['api']);
  }
  return ports;
}
