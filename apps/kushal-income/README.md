# kushal-income (Kushal Money)

The owner's personal ledger at https://kushal-income.agrolloo.com: every payment from SBI
savings, SBI Card, Tata Neu Infinity and Amazon Pay ICICI, tagged. Password-gated.

- The data is built by `pipelines/personal-finance/ledger` and posted to `/api/ingest`.
  How it works, the month-end routine and the rules: `pipelines/personal-finance/README.md`.
- To sync: the `my-income` skill ("sync Kushal Money").
- Worker (Hono) + D1 `kushal-money`; client is Vite + React in `src/client`.
- Tags are a tree (`tags` table; `src/worker/tags.ts`). Each payment sits on one tag; the sync
  sends a path per row and the Worker makes missing tags on ingest. `src/shared/tagpath.ts`
  converts tag lists saved before the tree. Schema changes: `migrations/`, then
  `npx wrangler d1 migrations apply kushal-money --remote` (after `. ../../scripts/node22-path.sh`).

```bash
npm run typecheck && npm run build && npm run deploy
```

`npm run lint` is broken (typescript-eslint not installed). Check UI changes against real data
locally: `wrangler d1 export --remote` into `--local`, apply migrations `--local`, a throwaway
`.dev.vars`, `wrangler dev --local`, POST `data/ledger.json` to `/api/ingest`, then Playwright.
Routing `/api/ledger` to `data/ledger.json` no longer works: that file has no tag tree.
