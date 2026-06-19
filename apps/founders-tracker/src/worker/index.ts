import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { COOKIE, loginPage, requireAuth, signSession } from "./auth";
import {
  computeScoreboard, createTask, createTemplate, deleteTask, deleteTemplate,
  listTasks, listTemplates, patchTask, patchTemplate, reorderTasks,
} from "./db";
import { runGenerator } from "./recurring";
import type { Owner, TaskInput, TaskPatch, TaskStatus, TemplateInput } from "../shared";

export interface Env {
  DB: D1Database;
  APP_PIN: string;
  SESSION_SECRET: string;
  ASSETS: { fetch: typeof fetch };
}

const app = new Hono<{ Bindings: Env }>();

// ---- Auth ------------------------------------------------------------------
app.get("/login", (c) => c.html(loginPage()));

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const pin = String(body.pin ?? "");
  if (pin && pin === c.env.APP_PIN) {
    setCookie(c, COOKIE, await signSession(c.env.SESSION_SECRET), {
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
    return c.redirect("/", 302);
  }
  return c.html(loginPage(true), 401);
});

// ---- Gate everything below -------------------------------------------------
app.use("/api/*", requireAuth);

// ---- Tasks -----------------------------------------------------------------
app.get("/api/bootstrap", async (c) => {
  // Backstop: also materialize recurring tasks on load.
  await runGenerator(c.env.DB).catch((e) => console.error("on-load generator:", e));
  const [tasks, templates, scoreboard] = await Promise.all([
    listTasks(c.env.DB), listTemplates(c.env.DB), computeScoreboard(c.env.DB),
  ]);
  return c.json({ tasks, templates, scoreboard });
});

app.post("/api/tasks", async (c) => {
  const input = await c.req.json<TaskInput>();
  if (!input.title?.trim()) return c.json({ error: "Title required" }, 400);
  return c.json(await createTask(c.env.DB, input));
});

app.patch("/api/tasks/reorder", async (c) => {
  const { owner, status, orderedIds } =
    await c.req.json<{ owner: Owner; status: TaskStatus; orderedIds: number[] }>();
  await reorderTasks(c.env.DB, owner, status, orderedIds);
  return c.json({ ok: true });
});

app.patch("/api/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const patch = await c.req.json<TaskPatch>();
  return c.json(await patchTask(c.env.DB, id, patch));
});

app.delete("/api/tasks/:id", async (c) => {
  await deleteTask(c.env.DB, Number(c.req.param("id")));
  return c.json({ ok: true });
});

// ---- Templates -------------------------------------------------------------
app.get("/api/templates", async (c) => c.json(await listTemplates(c.env.DB)));

app.post("/api/templates", async (c) => {
  const input = await c.req.json<TemplateInput>();
  if (!input.title?.trim()) return c.json({ error: "Title required" }, 400);
  return c.json(await createTemplate(c.env.DB, input));
});

app.patch("/api/templates/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const patch = await c.req.json<Partial<TemplateInput>>();
  return c.json(await patchTemplate(c.env.DB, id, patch));
});

app.delete("/api/templates/:id", async (c) => {
  await deleteTemplate(c.env.DB, Number(c.req.param("id")));
  return c.json({ ok: true });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err?.message ?? err) }, 500);
});

// ---- Worker entry: fetch (Hono) + scheduled (cron generator) ---------------
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const n = await runGenerator(env.DB);
    console.log(`generator inserted ${n} task(s)`);
  },
};
