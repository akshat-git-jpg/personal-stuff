// Cloudflare Worker entry point. Serves the token-gated API under /api/*, the
// SPA shell for /d/:token, and everything else straight from ASSETS (the
// built dist/). See plan 234 — this is the hosted twin of server/local.mjs.

import { handleApiRequest } from './routes'

export interface Env {
  DESK_DB: D1Database
  ASSETS: Fetcher
  DESK_ADMIN_TOKEN?: string
}

const SHELL_PATH_RE = /^\/d\/[^/]+\/?$/

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url)
    }

    // The SPA reads its token from location.pathname, so /d/:token itself
    // isn't a static file — serve the built shell for it. Fetch '/' and NOT
    // '/index.html': the assets binding's default html_handling redirects
    // /index.html to / with a 307, which strips the token before the SPA ever
    // boots and makes every freelancer link dead.
    if (SHELL_PATH_RE.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL('/', url), request))
    }

    return env.ASSETS.fetch(request)
  },
}
