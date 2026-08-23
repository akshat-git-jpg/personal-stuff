// The /d/:token shell must be fetched from '/', never '/index.html'.
//
// Cloudflare's assets binding applies html_handling to ASSETS.fetch too: a
// request for /index.html is answered with a 307 to '/'. The browser follows
// it, the token is stripped from the pathname, and the SPA boots with nothing
// to look up — every freelancer link dead, with the Worker reporting success.
// Caught only in production on 2026-08-23, because routes.test.ts covers the
// API and never exercised this branch.

import { describe, it, expect, vi } from 'vitest'
import worker from '../index'

function envWithAssetSpy() {
  const seen: string[] = []
  const ASSETS = {
    fetch: vi.fn(async (req: Request) => {
      seen.push(new URL(req.url).pathname)
      return new Response('<!doctype html><script type="module"></script>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }),
  }
  return { env: { ASSETS } as never, seen }
}

describe('the SPA shell for /d/:token', () => {
  it('asks the assets binding for "/" and not "/index.html"', async () => {
    const { env, seen } = envWithAssetSpy()
    const res = await worker.fetch(new Request('https://desk.test/d/sometoken'), env)

    expect(res.status).toBe(200)
    expect(seen, 'SHELL_REDIRECT: /index.html is 307-redirected to / and strips the token').not.toContain('/index.html')
    expect(seen).toContain('/')
  })

  it('serves the shell for a trailing-slash link too', async () => {
    const { env, seen } = envWithAssetSpy()
    await worker.fetch(new Request('https://desk.test/d/sometoken/'), env)
    expect(seen).not.toContain('/index.html')
    expect(seen).toContain('/')
  })

  it('passes anything that is not /d/:token straight through untouched', async () => {
    const { env, seen } = envWithAssetSpy()
    await worker.fetch(new Request('https://desk.test/assets/index-abc.js'), env)
    expect(seen).toEqual(['/assets/index-abc.js'])
  })
})
