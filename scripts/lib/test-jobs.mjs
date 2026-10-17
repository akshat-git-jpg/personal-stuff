// One parallelism number for every test runner: PP_TEST_JOBS, else half the cores (a land and a session can overlap on 16 GB).
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function testJobs(env = process.env, cpus = os.availableParallelism?.() ?? os.cpus().length) {
  const forced = Number.parseInt(env.PP_TEST_JOBS ?? '', 10);
  if (Number.isInteger(forced) && forced >= 1) return forced;
  return Math.max(1, Math.floor(cpus / 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(testJobs());
}
