/**
 * tags.ts
 * The tag tree: create, rename, move and delete tags, and find or make the tag for a sync path.
 *
 * A tag made for a sync path keeps that path as its `key` forever, so renames and moves never
 * break the sync. A path the owner already built by hand (same names, no key) is adopted, not
 * duplicated.
 */

import type { Env } from "./auth";

export interface Tag { id: string; parent_id: string | null; name: string; key: string | null }

export async function loadTags(env: Env): Promise<Tag[]> {
  return (await env.DB.prepare("SELECT id, parent_id, name, key FROM tags").all<Tag>()).results;
}

/** Make sure every path has a tag. Returns key -> tag id and the statements to run. */
export function ensurePaths(tags: Tag[], paths: Iterable<string>): { ids: Map<string, string>; stmts: string[][] } {
  const byKey = new Map(tags.filter((t) => t.key).map((t) => [t.key!, t]));
  const stmts: string[][] = [];
  const now = new Date().toISOString();
  for (const path of paths) {
    const parts = path.split("/");
    let parent: string | null = null;
    for (let i = 1; i <= parts.length; i++) {
      const key = parts.slice(0, i).join("/");
      let t = byKey.get(key);
      if (!t) {
        const name = parts[i - 1];
        t = tags.find((x) => x.parent_id === parent && !x.key && x.name.toLowerCase() === name);
        if (t) {
          t.key = key;
          stmts.push(["UPDATE tags SET key = ? WHERE id = ?", key, t.id]);
        } else {
          t = { id: key, parent_id: parent, name, key };
          tags.push(t);
          stmts.push(["INSERT INTO tags (id, parent_id, name, key, created_at) VALUES (?, ?, ?, ?, ?)",
            t.id, parent ?? (null as unknown as string), name, key, now]);
        }
        byKey.set(key, t);
      }
      parent = t.id;
    }
  }
  return { ids: new Map([...byKey].map(([k, t]) => [k, t.id])), stmts };
}

function cleanName(v: unknown): string {
  const n = typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : "";
  if (!n || n.length > 40 || n.includes("/")) throw new Error("a tag name is 1-40 characters, no /");
  return n;
}

function siblingClash(tags: Tag[], parent: string | null, name: string, self?: string) {
  if (tags.some((t) => t.parent_id === parent && t.name === name && t.id !== self)) {
    throw new Error(`"${name}" already exists there`);
  }
}

export async function createTag(env: Env, b: { parent_id?: unknown; name?: unknown }): Promise<Tag> {
  const tags = await loadTags(env);
  const parent = typeof b.parent_id === "string" ? b.parent_id : null;
  if (parent && !tags.some((t) => t.id === parent)) throw new Error("unknown parent");
  const name = cleanName(b.name);
  siblingClash(tags, parent, name);
  const t: Tag = { id: crypto.randomUUID(), parent_id: parent, name, key: null };
  await env.DB.prepare("INSERT INTO tags (id, parent_id, name, key, created_at) VALUES (?, ?, ?, NULL, ?)")
    .bind(t.id, parent, name, new Date().toISOString()).run();
  return t;
}

/** Rename and/or move. A tag cannot move inside itself. */
export async function updateTag(env: Env, id: string, b: { name?: unknown; parent_id?: unknown }): Promise<void> {
  const tags = await loadTags(env);
  const t = tags.find((x) => x.id === id);
  if (!t) throw new Error("unknown tag");
  const name = b.name === undefined ? t.name : cleanName(b.name);
  let parent = t.parent_id;
  if (b.parent_id !== undefined) {
    parent = typeof b.parent_id === "string" ? b.parent_id : null;
    for (let p = parent; p; p = tags.find((x) => x.id === p)?.parent_id ?? null) {
      if (p === id) throw new Error("a tag cannot move inside itself");
    }
    if (parent && !tags.some((x) => x.id === parent)) throw new Error("unknown parent");
  }
  siblingClash(tags, parent, name, id);
  await env.DB.prepare("UPDATE tags SET name = ?, parent_id = ? WHERE id = ?").bind(name, parent, id).run();
}

/** Only an empty tag: no children, no payments, no saved rule. */
export async function deleteTag(env: Env, id: string): Promise<void> {
  const t = await env.DB.prepare("SELECT key FROM tags WHERE id = ?").bind(id).first<{ key: string | null }>();
  if (!t) throw new Error("unknown tag");
  const used = await env.DB.prepare(
    `SELECT (SELECT count(*) FROM tags WHERE parent_id = ?1)
          + (SELECT count(*) FROM overrides WHERE tag_id = ?1)
          + (SELECT count(*) FROM rules WHERE tag_id = ?1)
          + (SELECT count(*) FROM rows WHERE ?2 IS NOT NULL AND json_extract(data, '$.path') = ?2) AS n`,
  ).bind(id, t.key).first<{ n: number }>();
  if (used && used.n > 0) throw new Error("only an empty tag can be deleted: move its payments and tags out first");
  await env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
}
