// Spawning `npx` on Windows, in one place.
//
// On Windows `npx` is `npx.cmd`, and spawnSync cannot execute a .cmd without a
// shell: the call returns ENOENT with empty stdout. In review-film that made a
// passing composition look broken ("no JSON object in check output"); in
// render-film it makes `run.sh <slug> intro-render` fail outright.
//
// shell:true concatenates argv into a command line instead of passing it
// through, so any argument holding a path has to be quoted or a path with a
// space silently splits into two arguments.
//
// This lived as a private pair of consts inside review-film.mjs, which is why
// render-film.mjs still had the bug months after review-film was fixed — the
// 140 run ledger for best-no-code-automation-tool recorded exactly that. Shared
// module so the next caller inherits the fix instead of rediscovering it.
export const NPX_NEEDS_SHELL = process.platform === 'win32';

export const npxArgs = (args) =>
  (NPX_NEEDS_SHELL ? args.map((a) => (/\s/.test(String(a)) ? `"${a}"` : a)) : args);

// Options every npx spawn needs. Callers merge their own cwd/stdio/encoding on top.
export const npxSpawnOpts = (extra = {}) => ({ shell: NPX_NEEDS_SHELL, ...extra });
