import type { Exercise, ExerciseInput, Group, LogEntry, LogInput, LogPatch } from "../shared";

export interface BootstrapData {
  groups: Group[];
  exercises: Record<string, Exercise[]>;
  log: LogEntry[];
  logCutoff: string;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const E = encodeURIComponent;

export const api = {
  bootstrap: () => req<BootstrapData>("GET", "/bootstrap"),
  fullLog: () => req<LogEntry[]>("GET", "/log"),
  addExercise: (tab: string, input: ExerciseInput) =>
    req<Exercise>("POST", `/groups/${E(tab)}/exercises`, input),
  updateExercise: (tab: string, id: string, input: ExerciseInput) =>
    req<Exercise>("PUT", `/groups/${E(tab)}/exercises/${E(id)}`, input),
  deleteExercise: (tab: string, id: string) =>
    req<{ ok: true }>("DELETE", `/groups/${E(tab)}/exercises/${E(id)}`),
  reorder: (tab: string, orderedIds: string[]) =>
    req<Exercise[]>("POST", `/groups/${E(tab)}/reorder`, { orderedIds }),
  addLog: (input: LogInput) => req<LogEntry>("POST", "/log", input),
  updateLog: (date: string, patch: LogPatch) =>
    req<{ ok: true }>("PUT", `/log/${E(date)}`, patch),
  deleteLog: (date: string) => req<{ ok: true }>("DELETE", `/log/${E(date)}`),
};
