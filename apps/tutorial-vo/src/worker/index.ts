import { Hono } from "hono";
import type { Env, SectionRow } from "./types";
import { mergePublish, canGenerate, validateRespell, takeKey, TAKES_MAX } from "./logic";
import { timingSafeEqual, sectionToken } from "./auth";
import { synthesize } from "./tts";
import { notifyCapHit } from "./telegram";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/admin/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return c.json({ error: "unauthorized" }, 401);
  const token = auth.slice(7);
  if (!timingSafeEqual(token, c.env.ADMIN_TOKEN)) return c.json({ error: "unauthorized" }, 401);
  await next();
});

app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/admin/")) return next();
  const slug = c.req.param("slug");
  if (!slug) return c.json({ error: "missing slug" }, 400);
  const t = c.req.query("t");
  if (!t) return c.json({ error: "unauthorized" }, 401);
  const expected = await sectionToken(c.env.LINK_SECRET, slug);
  if (!timingSafeEqual(t, expected)) return c.json({ error: "unauthorized" }, 401);
  await next();
});

app.post("/api/admin/publish/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const script = body.script;
  const drive_url = body.drive_url || "";

  if (script.stage !== "tts") return c.json({ error: "stage must be tts" }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO videos (slug, script_json, drive_url, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO UPDATE SET script_json = excluded.script_json, drive_url = excluded.drive_url, updated_at = excluded.updated_at"
  ).bind(slug, JSON.stringify(script), drive_url, now).run();

  const existingRes = await c.env.DB.prepare("SELECT * FROM sections WHERE slug = ?").bind(slug).all<SectionRow>();
  const existingMap = new Map(existingRes.results.map((r) => [r.id, r]));

  const statements = [];
  let n = 0;
  for (const s of script.sections) {
    const existing = existingMap.get(s.id) || null;
    const incoming = {
      id: s.id,
      version: s.version,
      demo: !!s.demo,
      spoken_text: s.tts?.spoken_text || s.display_text || "",
    };
    const res = mergePublish(existing, incoming, slug, now);
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO sections (slug, id, version, demo, spoken_text, takes_used, locked, take_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (slug, id) DO UPDATE SET version=excluded.version, demo=excluded.demo, spoken_text=excluded.spoken_text, takes_used=excluded.takes_used, locked=excluded.locked, take_key=excluded.take_key, updated_at=excluded.updated_at"
      ).bind(
        res.row.slug,
        res.row.id,
        res.row.version,
        res.row.demo,
        res.row.spoken_text,
        res.row.takes_used,
        res.row.locked,
        res.row.take_key,
        res.row.updated_at
      )
    );
    n++;
  }

  if (statements.length > 0) {
    await c.env.DB.batch(statements);
  }

  const t = await sectionToken(c.env.LINK_SECRET, slug);
  const link = `https://vo.agrolloo.com/v/${slug}?t=${t}`;
  return c.json({ ok: true, sections: n, link });
});

app.get("/api/admin/state/:slug", async (c) => {
  const slug = c.req.param("slug");
  const v = await c.env.DB.prepare("SELECT drive_url FROM videos WHERE slug = ?").bind(slug).first<{ drive_url: string }>();
  if (!v) return c.json({ error: "not found" }, 404);
  const sections = await c.env.DB.prepare("SELECT id, version, demo, spoken_text, takes_used, locked, take_key FROM sections WHERE slug = ?").bind(slug).all();
  return c.json({ slug, drive_url: v.drive_url, sections: sections.results });
});

app.get("/api/admin/audio/:slug/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT locked, take_key FROM sections WHERE slug = ? AND id = ?").bind(slug, id).first<SectionRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.locked !== 1 || !row.take_key) return c.json({ error: "not locked or no take" }, 409);
  
  const object = await c.env.AUDIO.get(row.take_key);
  if (!object) return c.json({ error: "audio not found" }, 404);
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body as any, { headers });
});

app.get("/api/admin/link/:slug", async (c) => {
  const slug = c.req.param("slug");
  const t = await sectionToken(c.env.LINK_SECRET, slug);
  return c.json({ link: `https://vo.agrolloo.com/v/${slug}?t=${t}` });
});

app.get("/api/video/:slug", async (c) => {
  const slug = c.req.param("slug");
  const video = await c.env.DB.prepare("SELECT script_json, drive_url FROM videos WHERE slug = ?").bind(slug).first<{ script_json: string, drive_url: string }>();
  if (!video) return c.json({ error: "not found" }, 404);
  
  const script = JSON.parse(video.script_json);
  const dbSections = await c.env.DB.prepare("SELECT * FROM sections WHERE slug = ?").bind(slug).all<SectionRow>();
  const dbMap = new Map(dbSections.results.map((r) => [r.id, r]));

  const sections = script.sections.map((s: any) => {
    const dbRow = dbMap.get(s.id);
    return {
      id: s.id,
      demo: !!s.demo,
      display_text: s.display_text,
      notes: s.notes,
      spoken_text: dbRow?.spoken_text || "",
      takes_used: dbRow?.takes_used || 0,
      locked: dbRow?.locked || 0,
      has_take: !!dbRow?.take_key
    };
  });

  return c.json({ drive_url: video.drive_url, sections });
});

app.post("/api/tts/:slug/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  
  const row = await c.env.DB.prepare("SELECT * FROM sections WHERE slug = ? AND id = ?").bind(slug, id).first<SectionRow>();
  if (!row) return c.json({ error: "not found" }, 404);

  const can = canGenerate(row);
  if (!can.ok) return c.json({ error: can.error }, can.status as any);

  const res = await synthesize(c.env, id, row.spoken_text);
  if (!res.ok) return c.json({ error: res.error }, res.status as any);

  const newTakes = row.takes_used + 1;
  const key = takeKey(slug, id, row.version, newTakes);
  
  await c.env.AUDIO.put(key, res.bytes);
  
  await c.env.DB.prepare("UPDATE sections SET takes_used = ?, take_key = ?, updated_at = ? WHERE slug = ? AND id = ?")
    .bind(newTakes, key, new Date().toISOString(), slug, id).run();

  if (newTakes === TAKES_MAX) {
    c.executionCtx.waitUntil(notifyCapHit(c.env, slug, id));
  }

  return c.json({ ok: true, takes_used: newTakes, takes_max: TAKES_MAX });
});

app.post("/api/respell/:slug/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const { spoken_text } = await c.req.json();
  
  const row = await c.env.DB.prepare("SELECT * FROM sections WHERE slug = ? AND id = ?").bind(slug, id).first<SectionRow>();
  if (!row) return c.json({ error: "not found" }, 404);

  const val = validateRespell(spoken_text, row.locked === 1);
  if (!val.ok) return c.json({ error: val.error }, val.status as any);

  await c.env.DB.prepare("UPDATE sections SET spoken_text = ?, updated_at = ? WHERE slug = ? AND id = ?")
    .bind(spoken_text, new Date().toISOString(), slug, id).run();
    
  return c.json({ ok: true });
});

app.post("/api/lock/:slug/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  
  const row = await c.env.DB.prepare("SELECT take_key FROM sections WHERE slug = ? AND id = ?").bind(slug, id).first<SectionRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (!row.take_key) return c.json({ error: "no take" }, 409);

  await c.env.DB.prepare("UPDATE sections SET locked = 1, updated_at = ? WHERE slug = ? AND id = ?")
    .bind(new Date().toISOString(), slug, id).run();

  return c.json({ ok: true });
});

app.get("/api/audio/:slug/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  
  const row = await c.env.DB.prepare("SELECT take_key FROM sections WHERE slug = ? AND id = ?").bind(slug, id).first<SectionRow>();
  if (!row || !row.take_key) return c.json({ error: "not found" }, 404);

  const object = await c.env.AUDIO.get(row.take_key);
  if (!object) return c.json({ error: "not found" }, 404);
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body as any, { headers });
});

app.get("/v/:slug", async (c) => {
  const res = await c.env.ASSETS.fetch(new Request("http://localhost/index.html"));
  return new Response(res.body, res);
});

export default app;
