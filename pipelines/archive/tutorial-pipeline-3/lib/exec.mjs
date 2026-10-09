import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function run(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, opts);
    return { stdout, stderr };
  } catch (error) {
    if (error.stderr) {
      error.message = `${error.message}\nstderr: ${error.stderr}`;
    }
    throw error;
  }
}
