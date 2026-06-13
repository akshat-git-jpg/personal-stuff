import { Hono } from "hono";
import type { Env } from "./google";
import {
  addExercise,
  appendLog,
  bootstrap,
  deleteExercise,
  deleteLog,
  readLog,
  reorderExercises,
  updateExercise,
  updateLog,
} from "./repo";
import type { LogPatch } from "../shared";
import type { ExerciseInput, LogInput } from "../shared";

const app = new Hono<{ Bindings: Env }>();

// Everything in one batched read: groups + all exercises + full log.
app.get("/api/bootstrap", async (c) => c.json(await bootstrap(c.env)));

// ---- Library ---------------------------------------------------------------

app.post("/api/groups/:tab/exercises", async (c) => {
  const tab = decodeURIComponent(c.req.param("tab"));
  const input = await c.req.json<ExerciseInput>();
  if (!input.name?.trim()) return c.json({ error: "Name required" }, 400);
  return c.json(await addExercise(c.env, tab, input));
});

app.put("/api/groups/:tab/exercises/:id", async (c) => {
  const tab = decodeURIComponent(c.req.param("tab"));
  const id = c.req.param("id");
  const input = await c.req.json<ExerciseInput>();
  return c.json(await updateExercise(c.env, tab, id, input));
});

app.delete("/api/groups/:tab/exercises/:id", async (c) => {
  const tab = decodeURIComponent(c.req.param("tab"));
  const id = c.req.param("id");
  await deleteExercise(c.env, tab, id);
  return c.json({ ok: true });
});

app.post("/api/groups/:tab/reorder", async (c) => {
  const tab = decodeURIComponent(c.req.param("tab"));
  const { orderedIds } = await c.req.json<{ orderedIds: string[] }>();
  return c.json(await reorderExercises(c.env, tab, orderedIds));
});

// ---- Workout log -----------------------------------------------------------

app.get("/api/log", async (c) => {
  const exerciseId = c.req.query("exerciseId");
  return c.json(await readLog(c.env, exerciseId));
});

app.post("/api/log", async (c) => {
  const input = await c.req.json<LogInput>();
  const dateIso = new Date().toISOString();
  return c.json(await appendLog(c.env, input, dateIso));
});

app.put("/api/log/:date", async (c) => {
  const date = decodeURIComponent(c.req.param("date"));
  const patch = await c.req.json<LogPatch>();
  await updateLog(c.env, date, patch);
  return c.json({ ok: true });
});

app.delete("/api/log/:date", async (c) => {
  const date = decodeURIComponent(c.req.param("date"));
  await deleteLog(c.env, date);
  return c.json({ ok: true });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err?.message ?? err) }, 500);
});

export default app;
