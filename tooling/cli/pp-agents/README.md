# pp-agents

The agents view, grouped by **tag**, without patching Claude Code.

```bash
kbc                       # the view, on the WORK store (~/.claude-work)
kbcp                      # the same view, PERSONAL store (~/.claude-personal)
kbc --dump                # exactly what the view would draw, as plain text
kbc --list                # one line per session, for scripts
kbc --doctor              # what it can read, and what it can drive
```

`kbc` and `kbcp` are the commands you type - one store each. `pp-agents` is the
same program under its repo-convention name; the folder, the tests and the
verify-map entry all stay `pp-agents`.

All three are symlinks in `~/.local/bin` to this one file, and the NAME is what
selects the store, so a missing link is a missing account. On a fresh machine:

```
for n in kbc kbcp pp-agents; do
  ln -sf "$PWD/tooling/cli/pp-agents/pp-agents" ~/.local/bin/$n
done
```

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

## One account per command

`kbc` is the work store, `kbcp` is the personal one. Each shows only its own
sessions and dispatches only into its own store, and the title says which you are
looking at. Both are the same file behind two symlinks: the account comes from the
name it was invoked as, with `--account work|personal` and `PP_AGENTS_ACCOUNT` for
scripts. Pins are kept per store, so neither can pin the other's rows.

The first build merged both stores into one list. It read well and cost more than
it gave: the account of a row had to be inferred from a column, and - the part
that actually broke - a NEW session had to be dispatched into *some* account. That
ambiguity is what let sessions land in `~/.claude`, created and unlistable. One
command, one store: what you see and what you create are the same place, and there
is nothing left to infer.

`--doctor` still names any OTHER store holding records, so an old orphan is
visible instead of silently accumulating. The sibling account is never reported
that way - it belongs to the other command, not to nobody.

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
| `n` | start a new session: the task first, then the folder (`claude --bg`) |
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

### Starting a new session

`n` asks for the task, then for the folder - pre-filled with **the directory you
opened the view in**, so enter accepts it and `tab` completes to any folder your
other sessions use. The task comes first because that is the part you already have
in your head; the folder is a detail.

The row shows **the words you typed** until the session has done something. Claude
Code writes two labels - `intent` is your prompt, `name` is a summary it generates -
and the summary is written at dispatch time, before there is anything to summarise.
A one-line prompt therefore gets an invented one: `test1` came back as `onboarding
empty state message`, unfindable by the person who typed `test1`. While a session is
still `awaiting task description` the prompt wins; once it starts work the summary
takes over, because by then `pp-feature-deploy` beats a paragraph.

Related, and not a bug here: a prompt with no actual task in it (`test1`) leaves the
session asking you what to do. It shows as **Needs input**, which is correct.

The dispatch names the account explicitly. This view READS two fixed stores
whatever the shell says - that is the point of it - but the dispatch used to
inherit `CLAUDE_CONFIG_DIR` from the launching shell, and a terminal that never
ran `clw`/`clp` points at Claude Code's own default, `~/.claude`. So the session
was created, its id was printed, and it was unlistable by construction. Nine of
them had collected there before anyone noticed, and every symptom looked like a
failed dispatch. New sessions are now pinned to the account whose row they will
appear as, and `--doctor` names any other store that holds records.

The dispatch does not wait for `claude --bg` at all. It launches it detached and
then watches the store for a session to APPEAR, by diffing the set of short ids -
redrawing every pass, so the view stays alive throughout. Waiting on the command
was the whole problem: one blocking call inside the key handler stalls the entire
view, and a stalled curses program is indistinguishable from a working one showing
a stale frame. That is how a dead `n` key survived a day of fixes - each attempt
wedged the view, and every key after it went into a frozen process.

Watching the store also removes the need to read an id out of the command's
output, so a reworded `backgrounded ·` line cannot break dispatch. The stub in the
tests prints no id at all, to keep it that way.

`d` deletes through **`claude rm <id>`**, the published command for it ("Delete a
background session and its worktree. Unlike `stop`, works on already-exited
sessions"). Removing the record directory instead does not work: the daemon owns
the session list and wrote both probe records back minutes later. The directory
removal survives only as a tidy-up for a directory that outlives a successful
`rm`.

Every other `claude` call goes through `run_claude`, which writes the child's
output to a temp **file** and never a pipe. This is not tidiness. `claude --bg` starts a
`claude daemon run` child when none is up, that child inherits whatever it was
given, and a pipe reaches EOF only once every holder closes it - so
`capture_output=True` waits for the daemon, i.e. forever. The view froze
mid-keystroke while the session it had just started ran happily in the background:
the record existed, the row never appeared, and `n` looked like a dead key.

It hid for a whole day because of how it fails: when a daemon is ALREADY running,
nothing is spawned, the pipe closes, and the identical code returns at once. Every
by-hand test from a shell passed. The stub in the tests now leaves a child sitting
on its output for 30 seconds, so the pipe version cannot pass again. `stdin` is
closed for the child too - this view holds the terminal in raw mode, and a child
must never read the keys meant for it.

The new session appears in the list by itself, selected, with the status line
naming its short id. Two things had to be true for that: the dispatch waits for
the daemon to write `jobs/<short>/state.json`, which lands a moment after
`claude --bg` returns; and the auto-refresh watches the `jobs` DIRECTORIES, not
just the records of sessions already on screen. Watching only known records is
how a brand-new session stayed invisible until `g` was pressed - the list had no
way to notice an arrival.

The first version offered the folder most sessions already ran in. That is a fact
about the backlog, not about intent: open the view inside one repo and it proposed
a different one. Where the terminal is, is the thing you actually chose.

The list carries a permanent line above the status bar:

```
> n   describe a task for a new session
```

`n` did this from the first build and nobody could find it, which is the whole
argument for the line: the built-in view has the same affordance and that is where
the habit comes from. It is a label, not a live input - in this view the letters are
shortcuts, so typing into it would collide with `j`, `k`, `e`, `d` and the rest.

### What this cannot show

**Interactive sessions.** A `claude` you start and talk to yourself writes no
`state.json` - its job directory holds only `tmp/` - so there is nothing on disk
to list. 22 such directories sit alongside the records here. The built-in view
shows "current session" because it IS that session and does not need a file.
`claude agents --json` does report exactly one `interactive` entry, so this could
be closed later by merging that in; it is not free, because the JSON needs a
subprocess call and this view refreshes on a timer.

Only background sessions - `claude --bg`, and anything dispatched from an agents
view - keep a record, and those are what appear here.

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
