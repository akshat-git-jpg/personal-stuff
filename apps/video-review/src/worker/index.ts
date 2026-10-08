// video-review Worker. The owner signs in with a PIN; a freelancer reaches one project by its secret token.
import { Hono, type Context } from 'hono'
import type { Env } from './auth'
import { checkPassword, clearAuthCookie, isOwner, makeToken, requireOwner, setAuthCookie } from './auth'
import { parseRange } from './range'
import * as db from './store'
import { DEFAULT_PART_MB, MB, STORAGE_STOP_BYTES, checkFile } from '../shared/rules'
import type { Project } from '../shared/types'

type C = Context<{ Bindings: Env }>
const app = new Hono<{ Bindings: Env }>()

const partSize = (env: Env) => (Number(env.PART_MB) || DEFAULT_PART_MB) * MB
const bad = (c: C, error: string, status: 400 | 403 | 404 | 409 | 413 | 416 | 507 = 400) => c.json({ error }, status)

async function body<T>(c: C): Promise<Partial<T>> {
  try {
    return (await c.req.json()) as Partial<T>
  } catch {
    return {}
  }
}

app.post('/api/login', async (c) => {
  const { password } = await body<{ password: string }>(c)
  if (!checkPassword(c.env, password)) return c.json({ error: 'Wrong PIN' }, 401)
  setAuthCookie(c, await makeToken(c.env))
  return c.json({ ok: true })
})

app.post('/api/logout', (c) => {
  clearAuthCookie(c)
  return c.json({ ok: true })
})

app.get('/api/me', async (c) => c.json({ owner: await isOwner(c) }))

app.get('/api/projects', requireOwner, async (c) => c.json(await db.home(c.env)))

app.post('/api/projects', requireOwner, async (c) => {
  const { title } = await body<{ title: string }>(c)
  const t = typeof title === 'string' ? title.trim() : ''
  if (!t || t.length > 120) return bad(c, 'Give the project a title (up to 120 characters).')
  return c.json(await db.createProject(c.env, t))
})

// Everything below is scoped to one project by its secret token.
const p = new Hono<{ Bindings: Env; Variables: { project: Project; owner: boolean } }>()

p.use('*', async (c, next) => {
  const project = await db.projectByToken(c.env, c.req.param('token') ?? '')
  if (!project) return c.json({ error: 'This link does not work. Ask for a new one.' }, 404)
  c.set('project', project)
  c.set('owner', await isOwner(c as unknown as C))
  await next()
})

const ownerOnly = (c: { get: (k: 'owner') => boolean }) => c.get('owner')

p.get('/', async (c) => {
  const project = c.get('project')
  return c.json({
    project,
    versions: await db.versions(c.env, project.id),
    owner: c.get('owner'),
    part_size: partSize(c.env),
  })
})

p.delete('/', async (c) => {
  if (!ownerOnly(c)) return c.json({ error: 'unauthorized' }, 401)
  await db.deleteProject(c.env, c.get('project').id)
  return c.json({ ok: true })
})

p.post('/uploads', async (c) => {
  const project = c.get('project')
  if (project.final_version_id) return c.json({ error: 'This project is final. Uploads are closed.' }, 409)
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name || name.length > 80) return c.json({ error: 'Give the version a name (up to 80 characters).' }, 400)
  const facts = {
    size: Number(b.size),
    duration: Number(b.duration),
    width: Math.round(Number(b.width)),
    height: Math.round(Number(b.height)),
  }
  const problems = checkFile({ ...facts, type: String(b.type ?? '') })
  if (problems.length) return c.json({ error: problems.join(' ') }, 400)
  if ((await db.usedBytes(c.env)) + facts.size > STORAGE_STOP_BYTES) {
    return c.json({ error: 'Storage is full. Please message the owner.' }, 507)
  }
  const v = await db.startUpload(c.env, project, { name, ...facts })
  return c.json({ version_id: v.id, part_size: partSize(c.env) })
})

async function uploading(c: { env: Env; get: (k: 'project') => Project; req: { param: (k: string) => string | undefined } }) {
  const v = await db.version(c.env, c.get('project').id, c.req.param('vid') ?? '')
  return v && v.status === 'uploading' ? v : null
}

p.get('/uploads/:vid', async (c) => {
  const v = await uploading(c)
  if (!v) return c.json({ error: 'Upload not found.' }, 404)
  return c.json({ size: v.size, part_size: partSize(c.env), parts: (await db.parts(c.env, v.id)).map((x) => x.n) })
})

p.put('/uploads/:vid/parts/:n', async (c) => {
  const v = await uploading(c)
  if (!v) return c.json({ error: 'Upload not found.' }, 404)
  const n = Number(c.req.param('n'))
  const size = partSize(c.env)
  const count = Math.ceil(v.size / size)
  if (!Number.isInteger(n) || n < 1 || n > count) return c.json({ error: 'Bad part number.' }, 400)
  const buf = await c.req.arrayBuffer()
  const expected = n < count ? size : v.size - size * (count - 1)
  if (buf.byteLength !== expected) return c.json({ error: 'Part size does not match the file.' }, 400)
  return c.json({ etag: await db.putPart(c.env, v, n, buf) })
})

p.post('/uploads/:vid/complete', async (c) => {
  const v = await uploading(c)
  if (!v) return c.json({ error: 'Upload not found.' }, 404)
  const done = await db.parts(c.env, v.id)
  const count = Math.ceil(v.size / partSize(c.env))
  if (done.length !== count || done.reduce((s, x) => s + x.size, 0) !== v.size) {
    return c.json({ error: 'Some parts are missing. Press Resume.' }, 409)
  }
  await db.completeUpload(c.env, v)
  return c.json({ ok: true })
})

p.delete('/uploads/:vid', async (c) => {
  const v = await uploading(c)
  if (!v) return c.json({ error: 'Upload not found.' }, 404)
  await db.cancelUpload(c.env, v)
  return c.json({ ok: true })
})

p.get('/versions/:vid/video', async (c) => {
  const v = await db.version(c.env, c.get('project').id, c.req.param('vid') ?? '')
  if (!v || v.status !== 'ready') return c.json({ error: 'Video file not found.' }, 404)
  const head = await c.env.VIDEOS.head(v.r2_key)
  if (!head) return c.json({ error: 'Video file not found.' }, 404)
  const range = parseRange(c.req.header('Range'), head.size)
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } })
  }
  const obj = await c.env.VIDEOS.get(v.r2_key, range ? { range } : {})
  if (!obj) return c.json({ error: 'Video file not found.' }, 404)
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    ETag: head.httpEtag,
  })
  if (!range) {
    headers.set('Content-Length', String(head.size))
    return new Response(obj.body, { status: 200, headers })
  }
  headers.set('Content-Length', String(range.length))
  headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`)
  return new Response(obj.body, { status: 206, headers })
})

function noteInput(b: Record<string, unknown>, duration: number): { t: number; x: number; y: number; text: string } | string {
  const t = Number(b.t)
  const x = b.x === undefined ? 0.5 : Number(b.x)
  const y = b.y === undefined ? 0.5 : Number(b.y)
  const text = typeof b.text === 'string' ? b.text.trim() : ''
  if (!text || text.length > 2000) return 'Write a note (up to 2000 characters).'
  if (!(t >= 0 && t <= duration + 1)) return 'Bad time.'
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return 'Bad spot.'
  return { t, x, y, text }
}

p.post('/versions/:vid/notes', async (c) => {
  if (!ownerOnly(c)) return c.json({ error: 'unauthorized' }, 401)
  const v = await db.version(c.env, c.get('project').id, c.req.param('vid') ?? '')
  if (!v || v.status === 'uploading') return c.json({ error: 'Version not found.' }, 404)
  const n = noteInput(await c.req.json<Record<string, unknown>>().catch(() => ({})), v.duration)
  if (typeof n === 'string') return c.json({ error: n }, 400)
  return c.json(await db.addNote(c.env, v.id, n))
})

p.put('/notes/:id', async (c) => {
  if (!ownerOnly(c)) return c.json({ error: 'unauthorized' }, 401)
  const id = c.req.param('id') ?? ''
  if ((await db.noteProject(c.env, id)) !== c.get('project').id) return c.json({ error: 'Note not found.' }, 404)
  const n = noteInput(await c.req.json<Record<string, unknown>>().catch(() => ({})), Number.MAX_SAFE_INTEGER)
  if (typeof n === 'string') return c.json({ error: n }, 400)
  await db.updateNote(c.env, id, n)
  return c.json({ ok: true })
})

p.delete('/notes/:id', async (c) => {
  if (!ownerOnly(c)) return c.json({ error: 'unauthorized' }, 401)
  const id = c.req.param('id') ?? ''
  if ((await db.noteProject(c.env, id)) !== c.get('project').id) return c.json({ error: 'Note not found.' }, 404)
  await db.deleteNote(c.env, id)
  return c.json({ ok: true })
})

p.post('/final', async (c) => {
  if (!ownerOnly(c)) return c.json({ error: 'unauthorized' }, 401)
  const { version_id } = await c.req.json<{ version_id?: string }>().catch(() => ({}) as { version_id?: string })
  const project = c.get('project')
  const v = await db.version(c.env, project.id, version_id ?? '')
  if (!v || v.status !== 'ready') return c.json({ error: 'Only a version with its video can be Final.' }, 400)
  await db.markFinal(c.env, project.id, v.id)
  return c.json({ ok: true })
})

app.route('/api/p/:token', p)

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
