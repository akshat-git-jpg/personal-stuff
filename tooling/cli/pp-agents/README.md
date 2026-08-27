# pp-agents

The agents view, grouped by **tag**, without patching Claude Code.

```bash
kbc                       # the view
kbc --dump                # exactly what the view would draw, as plain text
kbc --list                # one line per session, for scripts
kbc --doctor              # what it can read, and what it can drive
```

`kbc` is the command you type. `pp-agents` is the same program under its
repo-convention name, and both symlinks live in `~/.local/bin`; the folder,
the tests and the verify-map entry all stay `pp-agents`.

## Why this exists instead of `pp-claude-tags`

Claude Code ships session tags (it calls them groups) but the agents view
hardcodes its gate to `false`. `pp-claude-tags` flipped that byte in the binary.
That worked from 2.1.237 to 2.1.245 and **stopped working in 2.1.246**, which
changed how the bundle is built: the executed code no longer comes from the
JavaScript text the patch edits, so the flip became silently cosmetic. The byte
read "unlocked", the stamp was current, the log said `already unlocked`, and the
tag view was gone. Nothing anywhere reported a problem.

Proven, not assumed - the agents view was rendered in a pty with
`fleetViewGroupMode=group` on both builds:

| Build | Headers it drew |
|---|---|
| 2.1.245 | `pp`, `source-filter 2`, `spends-automation`, `vi-prod 2`, `Ungrouped` |
| 2.1.246 | `Ready for review`, `Needs input`, `Working`, `Completed` |

That is `groupMode: o==="group" && !gate ? "state" : o` taking its gate-off
branch on a binary whose gate byte says otherwise.

A patch that can go cosmetic without saying so is not fixable from outside, and
the same thing can happen on any release. So this stops patching and reads the
data instead.

## How it stays working

It never touches the binary. It reads the records Claude Code already writes,
and acts only through published commands:

```
~/.claude-work/jobs/<short>/state.json    name, detail, state, cwd, updatedAt, tokens
~/.claude-work/jobs/<short>/group         the tag - Claude Code's own file

claude attach <short>       open a session in this terminal
claude logs <short>         recent output
claude stop <short>         stop it
claude --bg "<prompt>"      dispatch a new background session
```

Tags are written to the **same `group` file** `ctrl+e` writes. Nothing is
migrated and nothing is duplicated, so if Anthropic ever ships the feature
ungated, every tag set here is already where the built-in view looks.

Two things fall out that the built-in view cannot do:

- **Both accounts in one list.** Work and personal sessions together, each
  driven with its own `CLAUDE_CONFIG_DIR`.
- **Tag is the primary grouping**, not an option behind a dead gate.

## Keys

Close to the built-in view on purpose - the point is not to relearn anything.

| Key | Action |
|---|---|
| `up`/`down`, `j`/`k` | move (the cursor starts on a session, not a header) |
| `enter` | open the session |
| `shift+left` | **come back here from inside a session** |
| `ctrl+e` / `e` | tag this session; `tab` completes an existing tag |
| `ctrl+x` / `x` | remove this session's tag |
| `ctrl+t` / `t` | pin to top |
| `ctrl+s` / `s` | cycle grouping: tag -> folder -> state |
| `space` | fold / unfold the group under the cursor |
| `/` | filter on name, last message, tag or folder; `esc` clears |
| `l` | recent output (`claude logs`) |
| `K` | stop this session (asks first) |
| `d` | delete this session (asks first; stops it first if still running) |
| `n` | new background session in a folder you pick (`claude --bg`) |
| `g` | refresh now (it also refreshes on its own) |
| `?` | help |
| `q` | quit |

Fold every tag but one and only that tag's sessions are listed, so the folded
headers double as a tag picker - the same trick the built-in view supports.

### Getting in and out of a session

`enter` opens it. **`shift+left` brings you back here** - instantly, from
anywhere, including from inside Claude Code's own agents view if you end up
there.

A back key is needed at all because `claude attach` binds the left arrow to
"back to the agents view" and opens **Claude Code's ungrouped one**, which
strands you outside this view - and `esc` there does not exit, so there is no way
home. Claude Code decides that internally and exposes no flag to turn it off.
`claude --resume` is not a way around it either: it refuses a background agent
outright and tells you to use `claude agents`.

So the attach runs on a pty this program owns. Every byte is forwarded verbatim
in both directions - alt-screen, mouse, bracketed paste, window resizes - except
`shift+left`, which never reaches Claude Code and instead detaches and redraws
the list. The plain left arrow is forwarded like anything else, so it still moves
the cursor while you edit a prompt.

An earlier build reused the plain left arrow: it forwarded the key and waited to
*see* Claude Code's own list appear before detaching. It worked, but it could
never be quick - Claude Code's list had to finish drawing first, so every exit
flashed the wrong screen for about a second. Reserving a key removes the wait and
the flash together. `ctrl+o` was a second reserved key and is deliberately gone:
Claude Code binds it to "see full summary", so swallowing it took a working
shortcut away.

Detaching kills only the attach *client*. The session lives in the daemon and
keeps running, exactly as if you had closed the terminal. `PP_AGENTS_BACK_KEY`
adds a second key if `shift+left` ever clashes with something.

Detaching also has to hand the terminal back clean. `claude attach` turns mouse
reporting on and never gets to turn it off, so the modes are cleared here - and
the input queue is flushed as well, because switching reporting off stops new
packets but leaves the queued ones for your shell to print as `35;3;19M`
gibberish.

### The one thing that is missing

The built-in view's `space` replies to a session without opening it. There is no
published command for that, and the only other route is Claude Code's private
`control.sock` / `rv/<id>.sock` - building on those would be *more* fragile than
the byte patch this replaces. So: `enter`, type, `shift+left`.

## How it looks

Colour carries the meaning, so the list can be skimmed rather than read:

| | |
|---|---|
| `●` yellow | needs your input |
| `◐` cyan | working |
| `·` green | done |
| `▲` red | error |
| `▸` steel | pinned |
| `▾` / `▸` steel | group open / folded |
| grey | last message, age |
| a darker background | the cursor row, and the two bars |

Statuses keep saturated colour because that is the thing being scanned for.
Everything else is grey and steel, one shade off the background, so the list
reads as a hierarchy instead of a neon strip. Reverse video is not used at all -
the cursor row and the bars get a slightly lighter background instead.

Only those rows get a background. Everything else is foreground colour on
**your** terminal's background - `curses.use_default_colors()` is what makes that
work. Without it curses paints every cell with its own idea of black, which on a
themed terminal shows up as rectangular blocks behind the text. A terminal
without colour falls back to bold and dim and still reads as a hierarchy.

Below 90 columns the last message is dropped rather than truncated, because a
readable session name is worth more than a fragment of its last line.

## Where state lives

- **Tags** - `$CLAUDE_CONFIG_DIR/jobs/<short>/group`, Claude Code's own file.
  Clearing a tag deletes the file rather than blanking it, because a
  present-but-empty file reads as a tag named `""`.
- **Pins** - `~/.cache/pp-agents/pins.json`. Ours alone; a corrupt file reads as
  no pins rather than failing.
- **Nothing else** is written into a job directory. A test asserts that.
- **Deleting** (`d`) removes the whole `jobs/<short>/` directory, which is what a
  session record is. There is no published `claude` command for it. The path is
  re-derived from the account root and checked against the job's own short id
  first, so a malformed record cannot turn a delete into something worse; tests
  cover both refusals.

## Tests

```bash
python3 tooling/cli/pp-agents/test-pp-agents.py
```

149 checks, in two layers, because the thing this replaces failed by *looking*
fine:

1. **Unit and rendering** - loading, tagging, grouping, sorting, filtering,
   folding, pinning, row layout at four widths, and the exact argv built for
   every action. Layout is asserted through `--dump`, which shares `group_jobs`,
   `flatten` and `row_text` with the screen.
2. **The real program in a real pty** - keys go in; the assertion is what landed
   on disk and which command a stubbed `claude` recorded. Curses transmits only
   the cells that changed, so scraping a live screen proves less than it appears
   to; that is why behaviour is proved by side effects instead.

Everything runs against fixture directories. No test reads or writes the live
session store, except the final read-only `--doctor` and `--list` pass, which
checks the real machine still parses.

Registered in `tooling/cli/pp-land/verify-map.tsv`, so a land touching this
folder runs it.

Five real bugs came out of writing these, all of which would have bitten in
normal use:

- rows overflowed the terminal by six characters
- the age column was silently eaten by the last-message column
- resuming curses after `claude attach` used `initscr()` a second time and
  wedged the program
- opening a session whose folder had been reaped (a landed worktree) crashed the
  view
- curses painted its own background, so the list rendered as black blocks

## When something looks wrong

`pp-agents --doctor` is the first stop. It reports what it found rather than
asserting success:

```
accounts:
  work     /Users/kbtg/.claude-work  (45 job records)
  personal /Users/kbtg/.claude-personal  (3 job records)

session records parsed: 21 of 21
tags found: ai-agent-learn, beta-feature-enable, misc, pp, ...

claude binary: /Users/kbtg/.local/bin/claude
  attach ok
  logs   ok
  stop   ok
```

If a future release moves the record format, `session records parsed: 0 of N`
says so directly, and the view says `run pp-agents --doctor` instead of
rendering an empty list. If `attach`, `logs` or `stop` ever stops being a
command, doctor fails and names it. That is the whole lesson from the patch:
report what is true, never that it worked.

### When the LANDER says this suite failed

Read the land's own output first. `pp-land` records it and names the path in
`land.log`:

```
/Users/kbtg/.local/state/pp-land/<repo-hash>/gl/<pid>-<cycle>-<slug>/greenlight.out
```

Three things have parked this suite, and none of them was a failing check. All
three look identical in `land.log`, which only says `verify failed`:

| What the run output says | What it means |
|---|---|
| `Killed: 9` | the OS killed the suite for memory. It forks a pty per end-to-end test, a land can run several suites back to back, and this machine has 16 GB. Not a code failure - run it again when fewer agents are busy |
| `SSL_ERROR_SYSCALL` / `Could not resolve host: github.com` | the tests passed and the merge happened; only the push failed. Network, nothing else |
| a real `FAIL <label>` line | an actual failing check, and the label names it |

Two habits keep the third case honest, and both are already in place: nothing
here reads the live session store while it is moving - the last section copies
every job record into a temp directory and tests the copy - and no assertion
depends on how long a fake session lives; `got_key` asks which keys the session
actually received.

## Testing overrides

Used only by the test suite; unset in normal use.

| Variable | Effect |
|---|---|
| `PP_AGENTS_ACCOUNTS` | `work=/path:personal=/path` - read fixture stores instead of the real ones |
| `PP_AGENTS_PINS` | pin file path |
| `PP_AGENTS_CLAUDE` | the binary to drive, so a stub can record calls |
