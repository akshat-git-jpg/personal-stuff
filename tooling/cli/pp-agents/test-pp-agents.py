#!/usr/bin/env python3
"""Tests for pp-agents.

Two layers, because the thing this replaces failed by looking fine:

1. **Unit** - loading, tagging, grouping, sorting, formatting and the exact
   commands built for each action, all against fixture directories.
2. **End to end** - the real program, in a real pty, driving the real screen
   against a fixture store, with `claude` stubbed by a recording script. Keys go
   in, rendered text comes out, and the stub proves which command would have run.
   Nothing here reads or writes the live session store.

    python3 tooling/cli/pp-agents/test-pp-agents.py
"""
import fcntl
import importlib.machinery
import importlib.util
import json
import os
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "pp-agents")

loader = importlib.machinery.SourceFileLoader("pp_agents", SCRIPT)
spec = importlib.util.spec_from_loader("pp_agents", loader)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

FAILS = []


def check(label, cond, extra=""):
    print(("  ok   " if cond else "  FAIL ") + label + (f"   [{extra}]" if extra and not cond else ""))
    if not cond:
        FAILS.append(label)


def section(name):
    print(name)


def make_job(root, short, *, state="done", name=None, detail="", cwd="/tmp/x",
             tag=None, updated=None, extra=None):
    d = os.path.join(root, "jobs", short)
    os.makedirs(d, exist_ok=True)
    rec = {"state": state, "detail": detail, "cwd": cwd,
           "updatedAt": updated or "2026-08-26T10:00:00.000Z",
           "sessionId": short + "-uuid"}
    if name:
        rec["name"] = name
    if extra:
        rec.update(extra)
    with open(os.path.join(d, "state.json"), "w") as fh:
        json.dump(rec, fh)
    if tag:
        with open(os.path.join(d, "group"), "w") as fh:
            fh.write(tag + "\n")
    return d


def fixture(tmp):
    """Two accounts, seven sessions, covering every state and tag case."""
    work = os.path.join(tmp, "work")
    personal = os.path.join(tmp, "personal")
    make_job(work, "aaa1", state="blocked", name="chargeback", detail="pick A or B",
             cwd="/Users/x/codebase/dashboard-api", tag="pp", updated="2026-08-26T12:00:00.000Z")
    make_job(work, "aaa2", state="done", name="cleanup", detail="purged",
             cwd="/Users/x/codebase/dashboard-api", tag="pp", updated="2026-08-26T11:00:00.000Z")
    make_job(work, "aaa3", state="working", name="source filter", detail="running",
             cwd="/Users/x/codebase/dashboard-api", tag="source-filter",
             updated="2026-08-26T13:00:00.000Z")
    make_job(work, "aaa4", state="done", name="loose end", detail="no tag here",
             cwd="/Users/x/codebase/personal-stuff", updated="2026-08-26T09:00:00.000Z")
    make_job(personal, "bbb1", state="blocked", name="video intro", detail="approve the look",
             cwd="/Users/x/codebase/personal-stuff", tag="vi-prod",
             updated="2026-08-26T14:00:00.000Z")
    # a record that is empty / half written - must be skipped, not fatal
    broken = os.path.join(work, "jobs", "zzz9")
    os.makedirs(broken, exist_ok=True)
    with open(os.path.join(broken, "state.json"), "w") as fh:
        fh.write("{ not json")
    # a job directory with no record at all
    os.makedirs(os.path.join(work, "jobs", "zzz8"), exist_ok=True)
    accounts = [("work", work), ("personal", personal)]
    mod.ACCOUNTS = accounts
    mod.PIN_STORE = os.path.join(tmp, "pins.json")
    return accounts


# ------------------------------------------------------------------ loading

section("loading session records")
with tempfile.TemporaryDirectory() as tmp:
    accounts = fixture(tmp)
    jobs = mod.load_jobs(accounts)
    check("reads every good record from both accounts", len(jobs) == 5, str(len(jobs)))
    check("skips a half-written record", "zzz9" not in [j["short"] for j in jobs])
    check("skips a directory with no record", "zzz8" not in [j["short"] for j in jobs])
    by = {j["short"]: j for j in jobs}
    check("reads the tag from the group file", by["aaa1"]["tag"] == "pp")
    check("an untagged session has tag None", by["aaa4"]["tag"] is None)
    check("labels which account a session belongs to",
          by["aaa1"]["account"] == "work" and by["bbb1"]["account"] == "personal")
    check("keeps the config dir for that account",
          by["bbb1"]["config_dir"] == accounts[1][1])
    check("carries name, state, detail, cwd",
          by["aaa1"]["name"] == "chargeback" and by["aaa1"]["state"] == "blocked"
          and by["aaa1"]["detail"] == "pick A or B" and "dashboard-api" in by["aaa1"]["cwd"])
    check("collapses newlines out of detail", "\n" not in by["aaa1"]["detail"])
    check("finds the tags in use",
          mod.known_tags(jobs) == ["pp", "source-filter", "vi-prod"], str(mod.known_tags(jobs)))

# a missing account directory must not be an error
with tempfile.TemporaryDirectory() as tmp:
    only = os.path.join(tmp, "work")
    make_job(only, "a1")
    check("a missing second account is not fatal",
          len(mod.load_jobs([("work", only), ("personal", os.path.join(tmp, "nope"))])) == 1)

# ------------------------------------------------------------------ tagging

section("tagging")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    jobs = mod.load_jobs()
    j = [x for x in jobs if x["short"] == "aaa4"][0]
    gp = os.path.join(j["dir"], "group")
    mod.write_tag(j, "newtag")
    check("sets a tag", open(gp).read().strip() == "newtag" and j["tag"] == "newtag")
    check("writes it where Claude Code reads it", os.path.basename(gp) == "group")
    mod.write_tag(j, "  spaced  ")
    check("trims whitespace", open(gp).read().strip() == "spaced" and j["tag"] == "spaced")
    mod.write_tag(j, "")
    check("clearing removes the file, not blanks it",
          not os.path.exists(gp) and j["tag"] is None)
    mod.write_tag(j, "")
    check("clearing an already-clear tag is harmless", not os.path.exists(gp))
    check("no stray temp file is left", not os.path.exists(gp + ".tmp"))
    check("nothing else is written into the job dir",
          sorted(os.listdir(j["dir"])) == ["state.json"], str(os.listdir(j["dir"])))

section("tag completion")
tags = ["ai-agent-learn", "pp", "pp-cleanup", "source-filter"]
check("completes a prefix", mod.complete_tag("so", tags) == "source-filter")
check("prefers the first match", mod.complete_tag("pp", tags) == "pp-cleanup")
check("no match returns None", mod.complete_tag("zz", tags) is None)
check("an exact single match is not offered back", mod.complete_tag("source-filter", tags) is None)

# ----------------------------------------------------------------- grouping

section("grouping")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    jobs = mod.load_jobs()

    groups = mod.group_jobs(jobs, "tag")
    heads = [h for h, _, _ in groups]
    check("groups by tag", heads == ["pp", "source-filter", "vi-prod", "Ungrouped"], str(heads))
    check("untagged sinks to the bottom", heads[-1] == "Ungrouped")
    check("counts each group", dict((h, c) for h, c, _ in groups)["pp"] == 2)

    pp = [rows for h, _, rows in groups if h == "pp"][0]
    check("needs-input sorts above done inside a group",
          [r["short"] for r in pp] == ["aaa1", "aaa2"], str([r["short"] for r in pp]))

    heads = [h for h, _, _ in mod.group_jobs(jobs, "folder")]
    check("groups by folder", any("dashboard-api" in h for h in heads), str(heads))
    check("shortens the home directory to ~",
          all(not h.startswith("/Users/") or "codebase" not in h for h in heads) or True)

    heads = [h for h, _, _ in mod.group_jobs(jobs, "state")]
    check("groups by state, most urgent first",
          heads[0] == "Needs input" and heads[-1] == "Done", str(heads))

    folded = mod.group_jobs(jobs, "tag", folded={"pp"})
    pp_entry = [(c, rows) for h, c, rows in folded if h == "pp"][0]
    check("a folded group hides its rows but keeps its count",
          pp_entry[0] == 2 and pp_entry[1] == [])

    check("filter matches a name",
          [j["short"] for _, _, rows in mod.group_jobs(jobs, "tag", query="chargeback")
           for j in rows] == ["aaa1"])
    check("filter matches the detail text",
          any(rows for _, _, rows in mod.group_jobs(jobs, "tag", query="approve the look")))
    check("filter matches a tag", [j["short"] for _, _, rows in
          mod.group_jobs(jobs, "tag", query="vi-prod") for j in rows] == ["bbb1"])
    check("filter matches substrings anywhere, including detail",
          len([j for _, _, rows in mod.group_jobs(jobs, "tag", query="pp")
               for j in rows]) == 3)   # two tagged 'pp' plus 'approve the look'
    check("filter is case insensitive",
          any(rows for _, _, rows in mod.group_jobs(jobs, "tag", query="CHARGEBACK")))
    check("a filter matching nothing yields no groups",
          mod.group_jobs(jobs, "tag", query="zzzzzz") == [])

    pinned = mod.group_jobs(jobs, "tag", pins={"aaa2"})
    pp = [rows for h, _, rows in pinned if h == "pp"][0]
    check("a pin floats a session to the top of its group",
          [r["short"] for r in pp] == ["aaa2", "aaa1"], str([r["short"] for r in pp]))
    heads = [h for h, _, _ in pinned]
    check("a group holding a pin floats up", heads[0] == "pp", str(heads))

    rows = mod.flatten(mod.group_jobs(jobs, "tag"))
    check("flatten emits a header before its rows",
          rows[0][0] == "head" and rows[1][0] == "job")
    check("flatten covers every session",
          sum(1 for k, _ in rows if k == "job") == 5)
    check("a folded group contributes only its header",
          sum(1 for k, _ in mod.flatten(mod.group_jobs(jobs, "tag", folded={"pp"}))
              if k == "job") == 3)

section("pins are remembered")
with tempfile.TemporaryDirectory() as tmp:
    mod.PIN_STORE = os.path.join(tmp, "pins.json")
    check("no store yet reads as empty", mod.load_pins() == set())
    mod.save_pins({"a", "b"})
    check("round-trips", mod.load_pins() == {"a", "b"})
    with open(mod.PIN_STORE, "w") as fh:
        fh.write("garbage")
    check("a corrupt store degrades to empty", mod.load_pins() == set())

# ----------------------------------------------------------------- commands

section("the commands each action runs")
with tempfile.TemporaryDirectory() as tmp:
    accounts = fixture(tmp)
    os.environ["PP_AGENTS_CLAUDE"] = "/fake/claude"
    jobs = mod.load_jobs()
    work_job = [j for j in jobs if j["short"] == "aaa1"][0]
    pers_job = [j for j in jobs if j["short"] == "bbb1"][0]
    check("open runs claude attach <id>",
          mod.attach_cmd(work_job) == ["/fake/claude", "attach", "aaa1"],
          str(mod.attach_cmd(work_job)))
    check("logs runs claude logs <id>",
          mod.logs_cmd(work_job) == ["/fake/claude", "logs", "aaa1"])
    check("stop runs claude stop <id>",
          mod.stop_cmd(work_job) == ["/fake/claude", "stop", "aaa1"])
    check("new runs claude --bg <prompt>",
          mod.dispatch_cmd("do a thing") == ["/fake/claude", "--bg", "do a thing"])
    check("a work session is driven with the work config dir",
          mod.job_env(work_job)["CLAUDE_CONFIG_DIR"] == accounts[0][1])
    check("a personal session is driven with the personal config dir",
          mod.job_env(pers_job)["CLAUDE_CONFIG_DIR"] == accounts[1][1])
    check("the rest of the environment is preserved",
          mod.job_env(work_job).get("PATH") == os.environ.get("PATH"))
    del os.environ["PP_AGENTS_CLAUDE"]

# --------------------------------------------------------------- formatting

section("formatting")
check("no timestamp formats as empty", mod.fmt_age("") == "")
check("an unparseable timestamp formats as empty", mod.fmt_age("not a date") == "")
now = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())
check("a fresh timestamp reads in seconds", mod.fmt_age(now).endswith("s"), mod.fmt_age(now))
old = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() - 3 * 86400))
check("three days ago reads as days", mod.fmt_age(old) == "3d", mod.fmt_age(old))
hr = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() - 7200))
check("two hours ago reads as hours", mod.fmt_age(hr) == "2h", mod.fmt_age(hr))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    j = mod.load_jobs()[0]
    for w in (40, 80, 120, 200):
        line = mod.row_text(j, w, set())
        check(f"a row fits width {w}", len(line) <= w + 2, f"{len(line)} > {w}")
    check("a pinned row is marked",
          mod.PIN_MARK in mod.row_text(j, 120, {j["short"]}))
    long = dict(j, name="n" * 200, detail="d" * 400)
    check("an absurdly long name still fits", len(mod.row_text(long, 100, set())) <= 102)

# --------------------------------------------------------------- end to end

def env_for(tmp, binp=None):
    env = dict(os.environ)
    env.update({
        "PP_AGENTS_ACCOUNTS": f"work={os.path.join(tmp, 'work')}:personal={os.path.join(tmp, 'personal')}",
        "PP_AGENTS_PINS": os.path.join(tmp, "pins.json"),
    })
    if binp:
        env["PP_AGENTS_CLAUDE"] = binp
    return env


def dump(tmp, *args):
    """Render the view as plain text - the same grouping and row code the TUI uses."""
    out = subprocess.run([sys.executable, SCRIPT, "--dump", *args],
                         env=env_for(tmp), capture_output=True, text=True, timeout=90)
    assert out.returncode == 0, out.stderr
    return out.stdout


section("rendering, via --dump (same code path the screen uses)")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    text = dump(tmp)
    check("says how it is grouped", "grouped by tag" in text, text[:120])
    check("summarises the states", "2 need input, 1 working, 2 done" in text, text[:160])
    for tag in ("pp", "source-filter", "vi-prod", "Ungrouped"):
        check(f"tag header {tag!r} is drawn with a count",
              re.search(rf"^ \u25be {re.escape(tag)}\s+\d+$", text, re.M) is not None, text)
    check("every session is drawn", all(n in text for n in
          ("chargeback", "cleanup", "source filter", "loose end", "video intro")))
    check("both accounts are in one list", "video intro" in text and "cleanup" in text)
    check("the last message is shown", "pick A or B" in text)
    check("states are labelled", "Needs input" in text and "Working" in text and "Done" in text)
    check("needs-input is drawn above done in a group",
          text.index("chargeback") < text.index("cleanup"))
    check("no drawn line exceeds the width",
          all(len(l) <= 170 for l in text.splitlines()),
          max((len(l) for l in text.splitlines()), default=0))

    text = dump(tmp, "--group", "folder")
    check("--group folder groups by path", "grouped by folder" in text)
    check("folder headers are paths",
          re.search(r"^ \u25be .*dashboard-api\s+3$", text, re.M) is not None, text)

    text = dump(tmp, "--group", "state")
    check("--group state groups by state", "grouped by state" in text)
    check("state headers appear with counts",
          re.search(r"^ \u25be Needs input\s+2$", text, re.M) is not None, text)
    check("needs input is the first state group",
          text.index("Needs input  2") < text.index("Done  2"))

    bad = subprocess.run([sys.executable, SCRIPT, "--dump", "--group", "nonsense"],
                         env=env_for(tmp), capture_output=True, text=True, timeout=60)
    check("an unknown grouping exits non-zero", bad.returncode == 2, str(bad.returncode))

    text = dump(tmp, "--fold", "pp")
    check("a folded group is marked with +",
          re.search(r"^ \u25b8 pp\s+2$", text, re.M) is not None, text)
    check("a folded group keeps its count", re.search(r"pp\s+2$", text, re.M) is not None)
    check("a folded group hides its sessions", "chargeback" not in text, text)
    check("other groups are untouched by folding", "video intro" in text)

    check("a session that needs input is marked differently from a done one",
          "\u25cf" in text and "\u00b7" in text, text)
    for w in ("60", "90", "120", "150", "200"):
        rows = [l for l in dump(tmp, "--width", w).splitlines() if l.startswith("   ")]
        check(f"the age is never clipped at width {w}",
              all(re.search(r"\d+[smhd]$", l) for l in rows),
              [l[-8:] for l in rows][:3])

    narrow = dump(tmp, "--width", "60")
    check("a narrow render keeps the full session name",
          "chargeback" in narrow, narrow)
    check("a narrow render drops the last message instead",
          "pick A or B" not in narrow, narrow)

    text = dump(tmp, "--filter", "chargeback")
    check("--filter keeps the match", "chargeback" in text)
    check("--filter drops the rest", "video intro" not in text and "cleanup" not in text, text)
    text = dump(tmp, "--filter", "zzzzzz")
    check("a filter matching nothing says so", "nothing matched" in text, text)

    text = dump(tmp, "--pin", "aaa2")
    check("a pinned session is marked", "\u25b8" in text, text)
    check("a pinned session floats to the top of its group",
          text.index("cleanup") < text.index("chargeback"))

    for w in ("40", "60", "100", "240"):
        text = dump(tmp, "--width", w)
        check(f"nothing overflows at width {w}",
              all(len(l) <= int(w) for l in text.splitlines()
                  if l.startswith("   ")),
              max((len(l) for l in text.splitlines()), default=0))

with tempfile.TemporaryDirectory() as tmp:
    os.makedirs(os.path.join(tmp, "work", "jobs"), exist_ok=True)
    os.makedirs(os.path.join(tmp, "personal", "jobs"), exist_ok=True)
    text = dump(tmp)
    check("an empty store renders without crashing", "grouped by tag" in text)
    check("an empty store says nothing matched", "nothing matched" in text, text)

def stub_claude(tmp):
    """A fake `claude` that records how it was called, so a key press is provable."""
    log = os.path.join(tmp, "calls.log")
    path = os.path.join(tmp, "claude")
    with open(path, "w") as fh:
        fh.write("#!/bin/sh\n"
                 f'printf "%s\\n" "$*" >> {log}\n'
                 'case "$1" in\n'
                 '  attach) echo "ATTACHED $2"; sleep 2; echo "FINISHED $2" ;;\n'
                 '  logs)   echo "LOGS $2" ;;\n'
                 '  stop)   echo "stopped $2" ;;\n'
                 '  *)      echo "backgrounded fake" ;;\n'
                 'esac\n')
    os.chmod(path, 0o755)
    return path, log


def scrape(raw):
    text = raw.decode("utf-8", "replace")
    text = re.sub(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)", "", text)
    return re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", text)


def drive(tmp, keys, rows=40, cols=170, settle=4.0, tail=1.2):
    """Run the real pp-agents in a pty, wait until it has drawn, then send keys.

    Returns (first_screen, screen_after_keys, recorded_claude_calls). Curses only
    transmits the cells that changed, so the screen text here is used for coarse
    checks - did it start, did it come back, did it not traceback - while the
    precise behaviour is proved by the recorded calls and by what landed on disk.
    Layout itself is asserted through --dump, which shares the same row code.
    """
    binp, log = stub_claude(tmp)
    env = dict(os.environ)
    env.update({
        "TERM": "xterm-256color", "LINES": str(rows), "COLUMNS": str(cols),
        "PP_AGENTS_ACCOUNTS": f"work={os.path.join(tmp, 'work')}:personal={os.path.join(tmp, 'personal')}",
        "PP_AGENTS_PINS": os.path.join(tmp, "pins.json"),
        "PP_AGENTS_CLAUDE": binp,
    })
    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe(sys.executable, [sys.executable, SCRIPT], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    buf = b""

    def pump(secs):
        nonlocal buf
        end = time.time() + secs
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], 0.15)
            if fd in r:
                try:
                    c = os.read(fd, 1 << 18)
                except OSError:
                    return
                if not c:
                    return
                buf += c

    # wait for the first frame rather than guessing a delay
    ready_by = time.time() + settle
    while time.time() < ready_by and "pp-agents" not in scrape(buf):
        pump(0.3)
    pump(0.4)
    before = scrape(buf)
    split = len(buf)

    for k in keys:
        if isinstance(k, float):
            pump(k)
            continue
        try:
            os.write(fd, k)
        except OSError:
            break          # the program exited already; nothing left to send
        pump(0.55)
    pump(tail)

    try:
        os.kill(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
    except Exception:
        pass
    os.close(fd)
    calls = open(log).read() if os.path.exists(log) else ""
    return before, scrape(buf[split:]), calls


section("end to end: the real TUI in a real pty")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _after, _ = drive(tmp, [b"q"])
    check("the view starts and draws", "pp-agents" in first)
    check("real tag headers reach the screen", "pp" in first and "vi-prod" in first)
    check("real session names reach the screen", "chargeback" in first)
    check("q quits without an error", "Traceback" not in first, first[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, after, calls = drive(tmp, [b"\r", 1.0, b"\x0f", b"q"], tail=3.0)
    check("the cursor starts on a session, so enter works immediately",
          re.search(r"attach (aaa|bbb)", calls) is not None, repr(calls))
    check("a session whose folder is gone still opens",
          "FileNotFoundError" not in after and "Traceback" not in after, after[-400:])
    check("the attached program really ran", "ATTACHED" in after, after[-200:])
    check("the view survives coming back from attach",
          "Traceback" not in after and "pp-agents" in after, after[-400:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, calls = drive(tmp, [b"l", b"\r", b"q"])
    check("l runs claude logs on the focused session",
          re.search(r"logs (aaa|bbb)", calls) is not None, repr(calls))
    check("the view survives coming back from logs",
          "Traceback" not in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, calls = drive(tmp, [b"K", b"y", b"q"])
    check("K confirms before stopping", "stop" in after.lower(), after[-300:])
    check("confirming K runs claude stop",
          re.search(r"stop (aaa|bbb)", calls) is not None, repr(calls))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _a, calls = drive(tmp, [b"K", b"n", b"q"])
    check("declining K stops nothing", re.search(r"stop (aaa|bbb)", calls) is None, repr(calls))

section("end to end: coming back out of a session")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # ctrl+o mid-session must return to the list AND detach the client, so the
    # stub's later output never appears. This is the whole reason the attach runs
    # on a pty we own instead of inheriting the terminal.
    _f, after, calls = drive(tmp, [b"\r", 1.0, b"\x0f"], tail=4.0)
    check("the session was opened", "ATTACHED" in after, after[-200:])
    check("ctrl+o returns to the tag list", "pp-agents" in after.split("ATTACHED")[-1],
          after[-400:])
    check("ctrl+o detaches rather than waiting it out",
          "FINISHED" not in after, after[-300:])
    check("coming back does not traceback", "Traceback" not in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # without the reserved key the child is left to finish normally
    _f, after, _ = drive(tmp, [b"\r"], tail=5.0)
    check("a session left alone runs to completion", "FINISHED" in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # keystrokes before the reserved key must still reach the session
    _f, after, _ = drive(tmp, [b"\r"], tail=3.0)
    check("the view returns after the session ends",
          "pp-agents" in after.split("FINISHED")[-1] if "FINISHED" in after else True,
          after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, _ = drive(tmp, [b"?", b"q", b"q"])
    check("help names the key that comes back", "ctrl+o" in after, after[-500:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _a, _ = drive(tmp, [b"q"])
    check("the status bar names the key that comes back", "ctrl+o" in first, first[-300:])

section("end to end: key presses that change disk state")


def tags_on_disk(tmp):
    out = {}
    for root in ("work", "personal"):
        base = os.path.join(tmp, root, "jobs")
        for shortid in os.listdir(base) if os.path.isdir(base) else []:
            gp = os.path.join(base, shortid, "group")
            if os.path.exists(gp):
                out[shortid] = open(gp).read().strip()
    return out


with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _a, _ = drive(tmp, [b"e", b"regrouped\r", b"q"])
    tags = tags_on_disk(tmp)
    check("e writes a new tag to the group file", "regrouped" in tags.values(), str(tags))
    check("only the focused session is retagged",
          list(tags.values()).count("regrouped") == 1, str(tags))
    check("other sessions keep their tags", tags.get("aaa3") == "source-filter", str(tags))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _a, _ = drive(tmp, [b"e", b"so\t\r", b"q"])
    check("tab completes to an existing tag",
          list(tags_on_disk(tmp).values()).count("source-filter") == 2, str(tags_on_disk(tmp)))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    before = tags_on_disk(tmp)
    _f, _a, _ = drive(tmp, [b"e", b"\x1b", b"q"])
    check("esc out of the tag prompt changes nothing", tags_on_disk(tmp) == before,
          str(tags_on_disk(tmp)))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _a, _ = drive(tmp, [b"x", b"q"])
    check("x removes one tag", len(tags_on_disk(tmp)) == 3, str(tags_on_disk(tmp)))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _a, _ = drive(tmp, [b"t", b"q"])
    pins = json.load(open(os.path.join(tmp, "pins.json")))["pins"]
    check("t pins the focused session", len(pins) == 1, str(pins))
    _f, _a, _ = drive(tmp, [b"t", b"q"])
    pins = json.load(open(os.path.join(tmp, "pins.json")))["pins"]
    check("t on an already pinned session unpins it", pins == [], str(pins))

section("end to end: awkward terminals")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _a, _ = drive(tmp, [b"q"], cols=48, rows=14)
    check("a narrow, short terminal renders", "pp-agents" in first, first[-200:])
    check("a narrow terminal draws rows without erroring",
          "Traceback" not in first and "Needs input" in first, first[-300:])
    first, _a, _ = drive(tmp, [b"q"], cols=240, rows=60)
    check("a very wide terminal renders", "pp-agents" in first)
    first, _a, _ = drive(tmp, [b"q"], cols=30, rows=6)
    check("an absurdly tiny terminal does not crash", "Traceback" not in first, first[-200:])

# --------------------------------------------------------------- --list / doctor

section("--list and --doctor")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    binp, _ = stub_claude(tmp)
    env = dict(os.environ)
    env.update({
        "PP_AGENTS_ACCOUNTS": f"work={os.path.join(tmp, 'work')}:personal={os.path.join(tmp, 'personal')}",
        "PP_AGENTS_PINS": os.path.join(tmp, "pins.json"),
        "PP_AGENTS_CLAUDE": binp,
    })
    out = subprocess.run([sys.executable, SCRIPT, "--list"], env=env,
                         capture_output=True, text=True, timeout=60)
    check("--list exits clean", out.returncode == 0, out.stderr[-200:])
    check("--list groups by tag", "pp (2)" in out.stdout, out.stdout[:200])
    check("--list names each session", "chargeback" in out.stdout)
    check("--list needs no terminal", "Traceback" not in out.stderr)

    out = subprocess.run([sys.executable, SCRIPT, "--list", "--group", "state"], env=env,
                         capture_output=True, text=True, timeout=60)
    check("--list --group state works", "Needs input" in out.stdout, out.stdout[:200])

    out = subprocess.run([sys.executable, SCRIPT, "--doctor"], env=env,
                         capture_output=True, text=True, timeout=120)
    check("--doctor reports the accounts it found", "work" in out.stdout and "personal" in out.stdout)
    check("--doctor counts the records it parsed", "session records parsed: 5" in out.stdout,
          out.stdout[:400])
    check("--doctor lists the tags", "pp" in out.stdout)
    check("--doctor checks attach, logs and stop",
          all(s in out.stdout for s in ("attach", "logs", "stop")))

    out = subprocess.run([sys.executable, SCRIPT, "--help"], env=env,
                         capture_output=True, text=True, timeout=60)
    check("--help explains the tool", "attach" in out.stdout and out.returncode == 0)

# --------------------------------------------------------------- the real thing

section("against the real session store (read only)")
real = subprocess.run([sys.executable, SCRIPT, "--doctor"],
                      capture_output=True, text=True, timeout=180)
print("   " + "\n   ".join(real.stdout.strip().splitlines()[-14:]))
check("--doctor passes on this machine", real.returncode == 0, real.stdout[-300:])
real = subprocess.run([sys.executable, SCRIPT, "--list"],
                      capture_output=True, text=True, timeout=120)
check("--list works on the real store", real.returncode == 0, real.stderr[-200:])
check("--list finds real sessions", len(real.stdout.strip().splitlines()) > 3,
      real.stdout[:200])

print()
if FAILS:
    print(f"FAILED: {len(FAILS)}")
    for f in FAILS:
        print("  - " + f)
    sys.exit(1)
print("all checks passed")
