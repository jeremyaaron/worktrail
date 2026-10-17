export function parseArguments(args) {
  const options = { mode: 'full', database: 'docker', cleanup: null, help: false, ui: false, grep: null, ports: {} };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') options.help = true;
    else if (argument === '--ui') options.ui = true;
    else if (argument === '--cleanup') {
      options.cleanup = args[++index];
      if (!options.cleanup || options.cleanup.startsWith('--')) throw new Error('Cleanup requires a manifest path.');
    } else if (argument.startsWith('--mode=')) options.mode = argument.slice(7);
    else if (argument.startsWith('--database=')) options.database = argument.slice(11);
    else if (argument.startsWith('--grep=')) options.grep = argument.slice(7);
    else if (/^--(api|web|preview|editor)-port=/.test(argument)) {
      const [, name, value] = /^--(\w+)-port=(.*)$/.exec(argument);
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Requested ports must be integers from 1 to 65535.');
      options.ports[name] = Number(value);
    }
    else throw new Error('Unknown verification argument. Use --help.');
  }
  if (!['full', 'api', 'e2e', 'preview', 'editor', 'site'].includes(options.mode)) throw new Error('Unknown verification mode.');
  if (!['docker', 'service'].includes(options.database)) throw new Error('Unknown verification database mode.');
  if (options.ui && options.mode !== 'e2e') throw new Error('--ui requires --mode=e2e.');
  if (options.grep !== null && !['e2e', 'editor', 'preview'].includes(options.mode)) throw new Error('--grep requires a focused browser mode.');
  if (options.grep !== null) { try { new RegExp(options.grep); } catch { throw new Error('Invalid --grep expression.'); } }
  return options;
}
