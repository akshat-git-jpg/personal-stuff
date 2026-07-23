import { run as defaultRun } from './exec.mjs';

export async function durationOf(file, runner = defaultRun) {
  const { stdout } = await runner('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    file
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration)) {
    throw new Error(`Invalid duration returned by ffprobe: ${stdout.trim()}`);
  }
  return duration;
}

export async function heightOf(file, runner = defaultRun) {
  const { stdout } = await runner('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=height',
    '-of', 'csv=p=0',
    file
  ]);
  const height = Number(stdout.trim());
  if (!Number.isFinite(height)) {
    throw new Error(`Invalid height returned by ffprobe: ${stdout.trim()}`);
  }
  return height;
}
