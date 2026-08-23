// D1 access for the hosted desk. Reads/writes the same shape server/local.mjs
// keeps in desk-draft.json, split across three tables (migrations/0001_init.sql).
// D1 is a copy, never the source — see plan 234's "direction of truth".

import type { Beat, Edit, VideoDoc } from '../types'
import { mintToken } from './auth'

export type VideoRow = {
  key: string
  title: string
  beats_json: string
  token: string
  finished: number
  published_at: string
}

export async function getVideoRow(db: D1Database, key: string): Promise<VideoRow | null> {
  const row = await db
    .prepare('SELECT key, title, beats_json, token, finished, published_at FROM videos WHERE key = ?')
    .bind(key)
    .first<VideoRow>()
  return row ?? null
}

// Republishing replaces title/beats_json/published_at but never touches
// token or finished — the ON CONFLICT clause simply doesn't mention them, so
// a sent link keeps working and a maker's "finished" flag survives an
// outline re-render.
export async function upsertVideo(
  db: D1Database,
  args: { key: string; title: string; beatsJson: string; publishedAt: string },
): Promise<{ token: string }> {
  const existing = await getVideoRow(db, args.key)
  const token = existing?.token ?? mintToken()
  await db
    .prepare(
      `INSERT INTO videos (key, title, beats_json, token, finished, published_at)
       VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT(key) DO UPDATE SET title = excluded.title, beats_json = excluded.beats_json, published_at = excluded.published_at`,
    )
    .bind(args.key, args.title, args.beatsJson, token, args.publishedAt)
    .run()
  return { token }
}

// Newest first, so `desk.mjs list` reads as "what am I working on".
// `finished` comes back as D1's 0/1 integer — normalise it here, not at the
// call site, or the CLI prints a truthy 0.
export async function listVideos(
  db: D1Database,
): Promise<Array<{ key: string; title: string; token: string; finished: boolean; publishedAt: string }>> {
  const { results } = await db
    .prepare('SELECT key, title, token, finished, published_at FROM videos ORDER BY published_at DESC')
    .all<{ key: string; title: string; token: string; finished: number; published_at: string }>()
  return (results ?? []).map((r) => ({
    key: r.key,
    title: r.title,
    token: r.token,
    finished: r.finished === 1,
    publishedAt: r.published_at,
  }))
}

export async function setFinished(db: D1Database, key: string, finished: boolean): Promise<void> {
  await db
    .prepare('UPDATE videos SET finished = ? WHERE key = ?')
    .bind(finished ? 1 : 0, key)
    .run()
}

export async function getAnswers(db: D1Database, videoKey: string): Promise<Record<string, string>> {
  const { results } = await db
    .prepare('SELECT beat_num, text FROM answers WHERE video_key = ?')
    .bind(videoKey)
    .all<{ beat_num: string; text: string }>()
  const draft: Record<string, string> = {}
  for (const row of results) draft[row.beat_num] = row.text
  return draft
}

export async function putAnswer(
  db: D1Database,
  videoKey: string,
  num: string,
  text: string,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO answers (video_key, beat_num, text, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(video_key, beat_num) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
    )
    .bind(videoKey, num, text, updatedAt)
    .run()
}

export async function getSayEdits(
  db: D1Database,
  videoKey: string,
): Promise<{ says: Record<string, string[]>; edits: Record<string, Edit> }> {
  const { results } = await db
    .prepare('SELECT beat_num, original_json, lines_json, edited_at FROM say_edits WHERE video_key = ?')
    .bind(videoKey)
    .all<{ beat_num: string; original_json: string; lines_json: string; edited_at: string }>()
  const says: Record<string, string[]> = {}
  const edits: Record<string, Edit> = {}
  for (const row of results) {
    says[row.beat_num] = JSON.parse(row.lines_json)
    edits[row.beat_num] = { original: JSON.parse(row.original_json), at: row.edited_at }
  }
  return { says, edits }
}

// The first edit for a beat captures the original; a later edit leaves it
// alone — the ON CONFLICT clause never writes original_json on an update, so
// the original is always the FIRST version, never the previous one.
export async function putSayEdit(
  db: D1Database,
  videoKey: string,
  num: string,
  originalLines: string[],
  newLines: string[],
  editedAt: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO say_edits (video_key, beat_num, original_json, lines_json, edited_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(video_key, beat_num) DO UPDATE SET lines_json = excluded.lines_json, edited_at = excluded.edited_at`,
    )
    .bind(videoKey, num, JSON.stringify(originalLines), JSON.stringify(newLines), editedAt)
    .run()
}

export async function restoreSayEdit(db: D1Database, videoKey: string, num: string): Promise<void> {
  await db.prepare('DELETE FROM say_edits WHERE video_key = ? AND beat_num = ?').bind(videoKey, num).run()
}

// Same shape server/local.mjs's buildVideoDoc returns: any edited spoken
// lines are applied on top of the parsed beats before the doc goes out.
export async function buildVideoDoc(db: D1Database, key: string): Promise<VideoDoc | null> {
  const row = await getVideoRow(db, key)
  if (!row) return null
  const beats: Beat[] = JSON.parse(row.beats_json)
  const draft = await getAnswers(db, key)
  const { says, edits } = await getSayEdits(db, key)
  const beatsWithSays = beats.map((b) => (says[b.num] ? { ...b, say: says[b.num] } : b))
  return {
    key: row.key,
    title: row.title,
    beats: beatsWithSays,
    draft,
    edits,
    says,
    finished: Boolean(row.finished),
  }
}
