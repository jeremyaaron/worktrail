export function parseArguments(args) {
  const options = { mode: 'api', database: 'docker', cleanup: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') options.help = true;
    else if (argument === '--cleanup') {
      options.cleanup = args[++index];
      if (!options.cleanup || options.cleanup.startsWith('--')) throw new Error('Cleanup requires a manifest path.');
    } else if (argument.startsWith('--mode=')) options.mode = argument.slice(7);
    else if (argument.startsWith('--database=')) options.database = argument.slice(11);
    else throw new Error('Unknown verification argument. Use --help.');
  }
  if (!['full', 'api', 'e2e', 'preview', 'editor', 'site'].includes(options.mode)) throw new Error('Unknown verification mode.');
  if (!['docker', 'service'].includes(options.database)) throw new Error('Unknown verification database mode.');
  if (!options.help && !options.cleanup && options.mode !== 'api') {
    throw new Error('Only --mode=api is implemented in Phase 1. Other modes arrive in Phase 2.');
  }
  return options;
}
