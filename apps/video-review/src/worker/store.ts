// D1 + R2 access for projects, versions, notes, and the storage cleanup rules.
import type { Env } from './auth'
import { randomId } from './auth'
import type { HomeView, Note, Project, ProjectSummary, Version, VersionStatus } from '../shared/types'
import { FINAL_FILE_DAYS, STALE_UPLOAD_HOURS, STORAGE_STOP_BYTES, filesToDrop } from '../shared/rules'

type VersionRow = Omit<Version, 'notes'> & { project_id: string; r2_key: string; upload_id: string | null }

const DAY = 86_400_000

export async function createProject(env: Env, title: string): Promise<Project> {
  const p: Project = {
    id: randomId(12),
    title,
    token: randomId(22),
    final_version_id: null,
    final_at: null,
    created_at: Date.now(),
  }
  await env.DB.prepare('INSERT INTO vr_projects (id, title, token, created_at) VALUES (?, ?, ?, ?)')
    .bind(p.id, p.title, p.token, p.created_at)
    .run()
  return p
}

export async function projectByToken(env: Env, token: string): Promise<Project | null> {
  return env.DB.prepare('SELECT id, title, token, final_version_id, final_at, created_at FROM vr_projects WHERE token = ?')
    .bind(token)
    .first<Project>()
}

export async function usedBytes(env: Env): Promise<number> {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(size), 0) AS n FROM vr_versions WHERE status != 'removed'").first<{
    n: number
  }>()
  return r?.n ?? 0
}

export async function home(env: Env): Promise<HomeView> {
  await sweep(env)
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.title, p.token, p.final_version_id, p.final_at, p.created_at,
            COUNT(v.id) AS versions, MAX(v.created_at) AS last_upload
       FROM vr_projects p
       LEFT JOIN vr_versions v ON v.project_id = p.id AND v.status != 'uploading'
      GROUP BY p.id
      ORDER BY COALESCE(MAX(v.created_at), p.created_at) DESC`,
  ).all<ProjectSummary>()
  return { projects: results, used_bytes: await usedBytes(env), stop_bytes: STORAGE_STOP_BYTES }
}

export async function versionRows(env: Env, projectId: string): Promise<VersionRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT id, project_id, name, size, duration, width, height, r2_key, upload_id, status, created_at FROM vr_versions WHERE project_id = ? ORDER BY created_at DESC',
  )
    .bind(projectId)
    .all<VersionRow>()
  return results
}

export async function versions(env: Env, projectId: string): Promise<Version[]> {
  const rows = await versionRows(env, projectId)
  const { results: notes } = await env.DB.prepare(
    'SELECT n.id, n.version_id, n.t, n.x, n.y, n.text, n.created_at FROM vr_notes n JOIN vr_versions v ON v.id = n.version_id WHERE v.project_id = ? ORDER BY n.t',
  )
    .bind(projectId)
    .all<Note>()
  return rows.map(({ project_id: _p, r2_key: _k, upload_id: _u, ...v }) => ({
    ...v,
    notes: notes.filter((n) => n.version_id === v.id),
  }))
}

export async function version(env: Env, projectId: string, id: string): Promise<VersionRow | null> {
  return env.DB.prepare(
    'SELECT id, project_id, name, size, duration, width, height, r2_key, upload_id, status, created_at FROM vr_versions WHERE id = ? AND project_id = ?',
  )
    .bind(id, projectId)
    .first<VersionRow>()
}

export async function startUpload(
  env: Env,
  project: Project,
  facts: { name: string; size: number; duration: number; width: number; height: number },
): Promise<VersionRow> {
  const id = randomId(12)
  const key = `${project.id}/${id}.mp4`
  const mpu = await env.VIDEOS.createMultipartUpload(key, { httpMetadata: { contentType: 'video/mp4' } })
  const row: VersionRow = {
    id,
    project_id: project.id,
    ...facts,
    r2_key: key,
    upload_id: mpu.uploadId,
    status: 'uploading',
    created_at: Date.now(),
  }
  await env.DB.prepare(
    'INSERT INTO vr_versions (id, project_id, name, size, duration, width, height, r2_key, upload_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, project.id, row.name, row.size, row.duration, row.width, row.height, key, mpu.uploadId, row.status, row.created_at)
    .run()
  return row
}

export async function parts(env: Env, versionId: string): Promise<{ n: number; etag: string; size: number }[]> {
  const { results } = await env.DB.prepare('SELECT n, etag, size FROM vr_parts WHERE version_id = ? ORDER BY n')
    .bind(versionId)
    .all<{ n: number; etag: string; size: number }>()
  return results
}

export async function putPart(env: Env, v: VersionRow, n: number, body: ArrayBuffer): Promise<string> {
  const mpu = env.VIDEOS.resumeMultipartUpload(v.r2_key, v.upload_id!)
  const part = await mpu.uploadPart(n, body)
  await env.DB.prepare('INSERT OR REPLACE INTO vr_parts (version_id, n, etag, size) VALUES (?, ?, ?, ?)')
    .bind(v.id, n, part.etag, body.byteLength)
    .run()
  return part.etag
}

export async function completeUpload(env: Env, v: VersionRow): Promise<void> {
  const done = await parts(env, v.id)
  const mpu = env.VIDEOS.resumeMultipartUpload(v.r2_key, v.upload_id!)
  await mpu.complete(done.map((p) => ({ partNumber: p.n, etag: p.etag })))
  await env.DB.batch([
    env.DB.prepare("UPDATE vr_versions SET status = 'ready', upload_id = NULL WHERE id = ?").bind(v.id),
    env.DB.prepare('DELETE FROM vr_parts WHERE version_id = ?').bind(v.id),
  ])
  await tidyProject(env, v.project_id)
}

export async function cancelUpload(env: Env, v: VersionRow): Promise<void> {
  if (v.upload_id) {
    await env.VIDEOS.resumeMultipartUpload(v.r2_key, v.upload_id)
      .abort()
      .catch(() => {})
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM vr_parts WHERE version_id = ?').bind(v.id),
    env.DB.prepare('DELETE FROM vr_versions WHERE id = ?').bind(v.id),
  ])
}

async function setStatus(env: Env, rows: { id: string; r2_key: string }[], status: VersionStatus) {
  if (!rows.length) return
  await env.VIDEOS.delete(rows.map((r) => r.r2_key))
  await env.DB.batch(rows.map((r) => env.DB.prepare('UPDATE vr_versions SET status = ? WHERE id = ?').bind(status, r.id)))
}

/** Keep the newest files (or only the Final one) and remove the rest. Notes always stay. */
export async function tidyProject(env: Env, projectId: string): Promise<void> {
  const p = await env.DB.prepare('SELECT final_version_id FROM vr_projects WHERE id = ?')
    .bind(projectId)
    .first<{ final_version_id: string | null }>()
  const rows = await versionRows(env, projectId)
  const drop = new Set(
    filesToDrop(
      rows.map((r) => ({ id: r.id, created_at: r.created_at, has_file: r.status === 'ready' })),
      p?.final_version_id ?? null,
    ),
  )
  await setStatus(env, rows.filter((r) => drop.has(r.id)), 'removed')
}

/** Drops stale half-uploads and Final files older than FINAL_FILE_DAYS. Runs when the owner opens the home page. */
export async function sweep(env: Env): Promise<void> {
  const nowMs = Date.now()
  const { results: stale } = await env.DB.prepare(
    "SELECT id, project_id, name, size, duration, width, height, r2_key, upload_id, status, created_at FROM vr_versions WHERE status = 'uploading' AND created_at < ?",
  )
    .bind(nowMs - STALE_UPLOAD_HOURS * 3_600_000)
    .all<VersionRow>()
  for (const v of stale) await cancelUpload(env, v)

  const { results: old } = await env.DB.prepare(
    "SELECT v.id, v.r2_key FROM vr_versions v JOIN vr_projects p ON p.final_version_id = v.id WHERE v.status = 'ready' AND p.final_at < ?",
  )
    .bind(nowMs - FINAL_FILE_DAYS * DAY)
    .all<{ id: string; r2_key: string }>()
  await setStatus(env, old, 'removed')
}

export async function markFinal(env: Env, projectId: string, versionId: string): Promise<void> {
  await env.DB.prepare('UPDATE vr_projects SET final_version_id = ?, final_at = ? WHERE id = ?')
    .bind(versionId, Date.now(), projectId)
    .run()
  await tidyProject(env, projectId)
}

export async function deleteProject(env: Env, projectId: string): Promise<void> {
  const rows = await versionRows(env, projectId)
  for (const v of rows.filter((r) => r.status === 'uploading')) await cancelUpload(env, v)
  const files = rows.filter((r) => r.status === 'ready').map((r) => r.r2_key)
  if (files.length) await env.VIDEOS.delete(files)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM vr_notes WHERE version_id IN (SELECT id FROM vr_versions WHERE project_id = ?)').bind(projectId),
    env.DB.prepare('DELETE FROM vr_parts WHERE version_id IN (SELECT id FROM vr_versions WHERE project_id = ?)').bind(projectId),
    env.DB.prepare('DELETE FROM vr_versions WHERE project_id = ?').bind(projectId),
    env.DB.prepare('DELETE FROM vr_projects WHERE id = ?').bind(projectId),
  ])
}

export async function addNote(env: Env, versionId: string, n: { t: number; x: number; y: number; text: string }): Promise<Note> {
  const note: Note = { id: randomId(12), version_id: versionId, ...n, created_at: Date.now() }
  await env.DB.prepare('INSERT INTO vr_notes (id, version_id, t, x, y, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(note.id, versionId, note.t, note.x, note.y, note.text, note.created_at)
    .run()
  return note
}

export async function noteProject(env: Env, noteId: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT v.project_id FROM vr_notes n JOIN vr_versions v ON v.id = n.version_id WHERE n.id = ?')
    .bind(noteId)
    .first<{ project_id: string }>()
  return r?.project_id ?? null
}

export async function updateNote(env: Env, id: string, n: { t: number; x: number; y: number; text: string }) {
  await env.DB.prepare('UPDATE vr_notes SET t = ?, x = ?, y = ?, text = ? WHERE id = ?').bind(n.t, n.x, n.y, n.text, id).run()
}

export async function deleteNote(env: Env, id: string) {
  await env.DB.prepare('DELETE FROM vr_notes WHERE id = ?').bind(id).run()
}
