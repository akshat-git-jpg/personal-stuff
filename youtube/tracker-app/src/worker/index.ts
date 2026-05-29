import { Hono } from 'hono'

type Bindings = {
  ASSETS: Fetcher
  SESSIONS: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('ok'))

export default app
