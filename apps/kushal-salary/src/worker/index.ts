/**
 * Hono entry-point for the kushal-salary Worker.
 * Payslips and mail notes arrive from the kushal-salary skill via scripts/push-month.mjs and
 * push-note.mjs (INGEST_TOKEN); the SPA reads them behind the PIN cookie. PDFs are cookie-only.
 */
import { Hono, type Context } from 'hono'
import type { Env } from './auth'
import {
  checkIngest,
  checkPassword,
  clearAuthCookie,
  makeToken,
  requireAuth,
  requireAuthOrIngest,
  setAuthCookie,
} from './auth'
import { getMonth, getNote, putMonth, putNote, read, setPdf, type PdfRef } from './salary'
import { validateMonth, validateNote } from './validate'

const MAX_PDF_BYTES = 15 * 1024 * 1024

type C = Context<{ Bindings: Env }>
const app = new Hono<{ Bindings: Env }>()

app.post('/api/login', async (c) => {
  let body: { password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad request' }, 400)
  }
  if (!(await checkPassword(c.env, body.password))) return c.json({ error: 'invalid PIN' }, 401)
  setAuthCookie(c, await makeToken(c.env))
  return c.json({ ok: true })
})

app.post('/api/logout', (c) => {
  clearAuthCookie(c)
  return c.json({ ok: true })
})

app.get('/api/salary', requireAuthOrIngest, async (c) => c.json(await read(c.env)))

app.post('/api/months', async (c) => {
  if (!checkIngest(c.env, c.req.header('Authorization'))) return c.json({ error: 'unauthorized' }, 401)
  try {
    const m = validateMonth(await c.req.json())
    await putMonth(c.env, m)
    return c.json({ ok: true, month: m.month })
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
})

app.post('/api/notes', async (c) => {
  if (!checkIngest(c.env, c.req.header('Authorization'))) return c.json({ error: 'unauthorized' }, 401)
  try {
    const n = validateNote(await c.req.json())
    await putNote(c.env, n)
    return c.json({ ok: true, id: n.id })
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
})

async function uploadPdf(c: C, table: 'months' | 'notes', id: string, load: () => Promise<PdfRef | null>) {
  if (!checkIngest(c.env, c.req.header('Authorization'))) return c.json({ error: 'unauthorized' }, 401)
  if (!(c.req.header('content-type') ?? '').startsWith('application/pdf')) return c.json({ error: 'expected a PDF' }, 415)
  const buf = await c.req.arrayBuffer()
  if (buf.byteLength === 0) return c.json({ error: 'empty body' }, 400)
  if (buf.byteLength > MAX_PDF_BYTES) return c.json({ error: 'PDF too large' }, 413)
  if (!(await load())) return c.json({ error: 'not found' }, 404)
  const key = `${table === 'months' ? 'slips' : 'notes'}/${id}.pdf`
  await c.env.SLIPS.put(key, buf, { httpMetadata: { contentType: 'application/pdf' } })
  await setPdf(c.env, table, id, key)
  return c.json({ ok: true, key })
}

async function servePdf(c: C, ref: PdfRef | null) {
  if (!ref?.pdf_key) return c.json({ error: 'not found' }, 404)
  const obj = await c.env.SLIPS.get(ref.pdf_key)
  if (!obj) return c.json({ error: 'not found' }, 404)
  const name = ref.source_file.replace(/["\\\r\n]/g, '') || 'document.pdf'
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

app.put('/api/months/:month/pdf', async (c) => {
  const month = c.req.param('month') ?? ''
  return uploadPdf(c, 'months', month, () => getMonth(c.env, month))
})
app.put('/api/notes/:id/pdf', async (c) => {
  const id = c.req.param('id') ?? ''
  return uploadPdf(c, 'notes', id, () => getNote(c.env, id))
})

// Cookie only: the ingest bearer must never be able to download a PDF.
app.get('/api/months/:month/pdf', requireAuth, async (c) => servePdf(c, await getMonth(c.env, c.req.param('month') ?? '')))
app.get('/api/notes/:id/pdf', requireAuth, async (c) => servePdf(c, await getNote(c.env, c.req.param('id') ?? '')))

app.get('/api/me', requireAuth, (c) => c.json({ ok: true }))

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
