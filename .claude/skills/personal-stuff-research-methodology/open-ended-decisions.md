# Open-ended decisions: research, POC, then build

The owner's preferred flow for any open-ended choice: which tool, which base to build on,
build vs buy, which architecture. Modelled on the kb-editor session (2026-10-17), which the
owner called the way he wants this done. Evidence: `docs/research/kb-editor/`, spec
`docs/specs/2026-10-17-kb-editor-design.md`.

**The rule: no decision from memory, reputation or a README.** Every pick is backed by
desk research with sources AND a hands-on test on the owner's real data, with numbers.

## The flow

```
1 brainstorm ─► 2 requirements file ─► 3 parallel desk research ─► 4 verify key facts yourself
      ─► 5 shortlist ≥2 ─► 6 hands-on test (protocol, real data, numbers) ─► 7 decide
      ─► 8 design doc + builder check ─► 9 build in parallel ─► 10 real-app smoke test
```

1. **Brainstorm the why.** `superpowers:brainstorming`: the real pain, the owner's actual
   workflow (ask for it; it changed the kb-editor test), goals, anti-goals. One question per
   message. Play back what you heard with a picture.
2. **Write the requirements to a file** (`templates/REQUIREMENTS.md`). Every agent gets this
   file, never a paraphrase. Append owner decisions to it as they happen.
3. **Desk research in parallel.** One subagent per dimension (e.g. the candidate the owner
   linked, the leading option in depth, the whole landscape, the platform/shell + policy, the
   core technical architecture). Each scores against the requirements file, cites URLs, marks
   **fact vs inference**, clones repos read-only into scratch, and writes a report file.
4. **Verify the decisive facts yourself** before you recommend. Licence, last commit, and
   **adoption: stars AND release download counts AND contributor count** (GitHub API). The
   owner caught "WeftCut isn't popular": 233 stars, 11 Mac downloads, one author. Popularity
   is a trust signal, not the decider, but say it up front.
5. **Never bet on one candidate.** Test at least two, with "build our own" as the named
   fallback. Say why each rejected option lost, in one line each.
6. **Hands-on test** (`templates/TEST-PROTOCOL.md`):
   - Real owner data in a scratch **test kit** (copies, never originals), including the hard
     case on purpose (here: a 4K variable-frame-rate screen recording).
   - Numbered checks with PASS / PARTIAL / FAIL and a number for each.
   - Each candidate in its own subagent, installed only inside scratch, isolated profile,
     no global config, telemetry off, processes killed at the end.
   - Run candidates in parallel; a `mkdir` **perf lock** keeps speed measurements fair.
   - Drive apps the way the end user's agent would (MCP), measure through a debug port (CDP),
     compare outputs with ffmpeg.
   - Tell the owner not to touch the apps while a test runs; if they do, tell the tester.
   - **Fast-track on request** by cutting low-value checks (answer them from code reading)
     and shortening long ones (2-min export instead of 15), never by dropping the decisive ones.
7. **Decide.** Side-by-side table, then the call. Settle minor forks yourself and list them
   as "my calls"; ask the owner only the forks that change what gets built (2 options max,
   recommendation first). A new owner requirement can flip an earlier call: raise it once,
   with the trade-off (kb-editor's code home moved to a separate fork for upstream sync).
8. **Design doc + builder check.** Write the spec, then a fresh subagent reads it as a
   builder and lists only the questions it would have to guess. Sort into: answered already,
   minor (your call, marked), owner's. One round of owner questions.
9. **Build in parallel.**
   - First a read-only **hook map** subagent: exact files and the smallest hook point per
     feature, plus "things you would wrongly assume".
   - A **builder brief** (`templates/BUILDER-BRIEF.md`) every builder reads: env, rules,
     commit format, TDD, isolation.
   - One shared foundation part first (the registry everyone plugs into), then N builders at
     once, each in its own **APFS clone** (`cp -cR`, instant) on its own branch
     (`templates/PARALLEL-RULES.md`), then one merger subagent that unions all sides.
   - **One backlog file** from the first minute. Every "not done" lands there (the owner
     caught that leftovers were only in reports).
10. **Real-app smoke test** on the real data in an isolated profile: every new feature once,
    screenshots, PASS/FAIL. Fix small bugs; the rest goes to the backlog.

Then: delete merged branches and scratch copies (the owner runs the big `rm -rf` because
the dcg hook blocks it), record the verdict in `decisions.md`, add a Research-verdicts row
to **personal-stuff-failure-archaeology**.

## Keep the owner oriented

- One short status line whenever a background job starts or finishes; never go quiet.
- A time estimate before every long wait, revised when asked.
- If the owner sends a screenshot of something odd, investigate it yourself (logs, debug
  port, process CPU) before guessing, and pass it to the tester.

## Traps from the kb-editor run

- Recommending a base after one search ("HyperFrames Studio looks close") before the owner
  asked for proper research. Research first, even when one result looks perfect.
- GitHub cannot keep a private fork of a public repo: make a private repo, push a full
  clone, add the original as `upstream` with push disabled.
- The owner's global `~/.npmrc` points at a work registry: set `npm_config_registry` to the
  public one inside the project's env script.
- personal-stuff hooks judge git commands by the command text: one `cd <literal path>` or one
  `git -C <literal path>` per command, never a `$var` in the path, never two in one command.
