# pp-lists

Read-only reader for lists.agrolloo.com (`apps/lists-app`). Logs in with the app password
the same way the browser does, then prints every list.

```bash
tooling/cli/lists/pp-lists show                 # text, one "## list" block each
tooling/cli/lists/pp-lists show --format json   # raw /api/state
```

Password: `infra/secrets/lists-app.env` (`LISTS_APP_PASSWORD=`), copied from the `.example`
next to it, or the `LISTS_APP_PASSWORD` env var. `LISTS_URL` overrides the base URL.

Exit codes: 2 no password, 3 login failed, 4 fetch failed. Tests: `test_pp_lists.py`
(local stub server, no network).
