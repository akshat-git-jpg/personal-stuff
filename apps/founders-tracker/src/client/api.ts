import type {
  Scoreboard,
  Task,
  TaskInput,
  TaskPatch,
  TaskStatus,
  Template,
  TemplateInput,
  Owner,
} from "../shared";

export interface BootstrapData {
  tasks: Task[];
  templates: Template[];
  scoreboard: Scoreboard;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
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

export const api = {
  bootstrap: () => req<BootstrapData>("GET", "/bootstrap"),
  createTask: (input: TaskInput) => req<Task>("POST", "/tasks", input),
  patchTask: (id: number, patch: TaskPatch) =>
    req<Task>("PATCH", `/tasks/${id}`, patch),
  deleteTask: (id: number) => req<{ ok: true }>("DELETE", `/tasks/${id}`),
  reorder: (owner: Owner, status: TaskStatus, orderedIds: number[]) =>
    req<{ ok: true }>("PATCH", "/tasks/reorder", { owner, status, orderedIds }),
  listTemplates: () => req<Template[]>("GET", "/templates"),
  createTemplate: (input: TemplateInput) =>
    req<Template>("POST", "/templates", input),
  patchTemplate: (id: number, patch: Partial<TemplateInput>) =>
    req<Template>("PATCH", `/templates/${id}`, patch),
  deleteTemplate: (id: number) => req<{ ok: true }>("DELETE", `/templates/${id}`),
};
