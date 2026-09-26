# kushal-income (Kushal Money)

The owner's personal ledger at https://kushal-income.agrolloo.com: every payment from SBI
savings, SBI Card, Tata Neu Infinity and Amazon Pay ICICI, tagged. Password-gated.

- The data is built by `pipelines/personal-finance/ledger` and posted to `/api/ingest`.
  How it works, the month-end routine and the rules: `pipelines/personal-finance/README.md`.
- To sync: the `my-income` skill ("sync Kushal Money").
- Worker (Hono) + D1 `kushal-money`; client is Vite + React in `src/client`.

```bash
npm run typecheck && npm run build && npm run deploy
```

`npm run lint` is broken (typescript-eslint not installed). Check UI changes by rendering
`dist/` in Playwright with `/api/ledger` routed to `data/ledger.json`.
