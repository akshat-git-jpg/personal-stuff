<!-- Template = the real file from the kb-editor run (2026-10-17). Copy it, keep the structure, replace every kb-editor specific. -->

# Parallel build rules (2026-10-17)

Five builders work at once, each in its own full copy of the repo:
`/Users/kbtg/codebase/kb-editor-wt/<part>` on branch `kb/<part>` (parts: comments, cards, retime, plugins, sync).

- Use YOUR copy path everywhere the builder brief says `/Users/kbtg/codebase/kb-editor`
  (dev-env, git -C, gh-acct token -C). Never touch `/Users/kbtg/codebase/kb-editor` itself or another copy.
- Commit on your branch; push with `push origin kb/<part>` (NOT main). The orchestrator merges.
- Other builders are adding kb MCP tools at the same time. Add yours in your OWN file under
  `apps/desktop/src/main/kb/mcp/` and register it with a single appended line in the registry/index,
  so merges are trivial. Same for FORK.md and kb/docs/TOOLS.md: append rows/sections, don't reorder.
- Stay inside your part's scope. If you need something from another part, write it down in your
  report instead of building it.
- Machine is shared by 5 builders: run focused test files while iterating; run the full `npm test`
  + `npm run typecheck` once at the end before your final commit.
