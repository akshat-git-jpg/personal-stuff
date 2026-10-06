/**
 * Hono entry-point for the kushal-health Worker.
 * Reports arrive from the kushal-health skill via scripts/push-report.mjs (INGEST_TOKEN);
 * the SPA reads them behind the PIN cookie. PDFs are cookie-only.
 */
import { Hono } from 'hono'
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
import { getReport, ingest, read, setPdf } from './blood'
import { validateIngest } from './validate'

const MAX_PDF_BYTES = 15 * 1024 * 1024

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

app.get('/api/blood', requireAuthOrIngest, async (c) => c.json(await read(c.env)))

app.post('/api/reports', async (c) => {
  if (!checkIngest(c.env, c.req.header('Authorization'))) return c.json({ error: 'unauthorized' }, 401)
  let body
  try {
    body = validateIngest(await c.req.json())
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400)
  }
  return c.json({ ok: true, ...(await ingest(c.env, body)) })
})

app.put('/api/reports/:id/pdf', async (c) => {
  if (!checkIngest(c.env, c.req.header('Authorization'))) return c.json({ error: 'unauthorized' }, 401)
  if (!(c.req.header('content-type') ?? '').startsWith('application/pdf')) {
    return c.json({ error: 'expected a PDF' }, 415)
  }
  const id = c.req.param('id') ?? ''
  const buf = await c.req.arrayBuffer()
  if (buf.byteLength === 0) return c.json({ error: 'empty body' }, 400)
  if (buf.byteLength > MAX_PDF_BYTES) return c.json({ error: 'PDF too large' }, 413)
  if (!(await getReport(c.env, id))) return c.json({ error: 'no such report' }, 404)
  const key = `reports/${id}.pdf`
  await c.env.REPORTS.put(key, buf, { httpMetadata: { contentType: 'application/pdf' } })
  await setPdf(c.env, id, key)
  return c.json({ ok: true, key })
})

// Cookie only: the ingest bearer must never be able to download a PDF.
app.get('/api/reports/:id/pdf', requireAuth, async (c) => {
  const report = await getReport(c.env, c.req.param('id') ?? '')
  if (!report?.pdf_key) return c.json({ error: 'not found' }, 404)
  const obj = await c.env.REPORTS.get(report.pdf_key)
  if (!obj) return c.json({ error: 'not found' }, 404)
  const name = report.source_file.replace(/["\\\r\n]/g, '')
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
