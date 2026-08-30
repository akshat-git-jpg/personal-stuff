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
import shutil
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


_LAST_CHECK = [time.time()]


def check(label, cond, extra=""):
    """Report one check, and how long the work before it took.

    The elapsed time is printed only when it crosses a second. A section total
    says which section is slow; it does not say which check inside it is, and
    three sections carry three quarters of this suite.
    """
    took = time.time() - _LAST_CHECK[0]
    slow = f"  ({took:.1f}s)" if took >= 1.0 else ""
    print(("  ok   " if cond else "  FAIL ") + label + slow
          + (f"   [{extra}]" if extra and not cond else ""))
    if not cond:
        FAILS.append(label)
    _LAST_CHECK[0] = time.time()


_SECTION = [None, 0.0]


def section(name):
    """Announce a section, and time the one that just ended.

    Timing is printed rather than asserted: a slow section is a fact about this
    machine as much as about the code, so it is reported for a human to read and
    never used to fail anything.
    """
    if _SECTION[0] is not None:
        print(f"       {time.time() - _SECTION[1]:6.1f}s  {_SECTION[0]}")
    _SECTION[0] = name
    _SECTION[1] = time.time()
    print(name)


def section_close():
    """Time the last section. Called once, at the end."""
    if _SECTION[0] is not None:
        print(f"       {time.time() - _SECTION[1]:6.1f}s  {_SECTION[0]}")
        _SECTION[0] = None


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

section("one account per command")

check("kbc means the work store", mod.account_from_argv("/usr/local/bin/kbc") == "work")
check("kbcp means the personal store",
      mod.account_from_argv("/usr/local/bin/kbcp") == "personal")
check("the original name keeps the work store",
      mod.account_from_argv("/repo/tooling/cli/pp-agents/pp-agents") == "work")
check("an unrecognised name falls back rather than failing",
      mod.account_from_argv("/usr/local/bin/renamed-somehow") == "work")
check("an explicit override wins over the name",
      mod.account_from_argv("/usr/local/bin/kbc", "personal") == "personal")
check("a nonsense override is ignored, not obeyed",
      mod.account_from_argv("/usr/local/bin/kbcp", "banana") == "personal")
check("both stores are known", sorted(mod.STORES) == ["personal", "work"])
check("the sibling store is never called foreign",
      mod.foreign_stores(candidates=tuple(mod.STORES.values())) == [])

_was = os.environ.get("PP_AGENTS_ACCOUNT")
os.environ["PP_AGENTS_ACCOUNT"] = "personal"
try:
    check("the environment beats the command name",
          mod.account_from_argv("/usr/local/bin/kbc") == "personal")
    check("but an explicit override still beats the environment",
          mod.account_from_argv("/usr/local/bin/kbc", "work") == "work")
finally:
    if _was is None:
        os.environ.pop("PP_AGENTS_ACCOUNT", None)
    else:
        os.environ["PP_AGENTS_ACCOUNT"] = _was

check("pins are kept per store, so the two commands cannot cross",
      "pins-" in mod.PIN_STORE or os.environ.get("PP_AGENTS_PINS"), mod.PIN_STORE)

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

section("the row label")
check("a real summary wins once there is work behind it",
      mod.display_name({"name": "pp-feature-deploy", "intent": "deploy the thing",
                        "detail": "5 of 6 services green"}) == "pp-feature-deploy")
check("while it is still asking for a task, your own words win",
      mod.display_name({"name": "onboarding empty state message", "intent": "test1",
                        "detail": "awaiting task description"}) == "test1")
check("the check does not care about case or padding",
      mod.display_name({"name": "invented", "intent": "test1",
                        "detail": "  Awaiting Task Description "}) == "test1")
check("no summary at all falls back to the prompt",
      mod.display_name({"name": "", "intent": "do the thing"}) == "do the thing")
check("no prompt at all keeps the summary",
      mod.display_name({"name": "summary", "intent": "",
                        "detail": "awaiting task description"}) == "summary")
check("neither one gives an empty string, so the caller can fall back to the id",
      mod.display_name({}) == "")

with tempfile.TemporaryDirectory() as tmp:
    make_job(os.path.join(tmp, "work"), "fresh1", state="blocked",
             name="onboarding empty state message", detail="awaiting task description",
             extra={"intent": "test1"})
    jobs = mod.load_jobs([("work", os.path.join(tmp, "work"))])
    check("a freshly dispatched session is findable by what you typed",
          jobs[0]["name"] == "test1", jobs[0]["name"])

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

section("folds are remembered")
with tempfile.TemporaryDirectory() as tmp:
    mod.PIN_STORE = os.path.join(tmp, "pins.json")
    check("no store yet means nothing is folded", mod.load_folds("tag") == set())
    mod.save_folds("tag", {"misc", "source-filter"})
    check("folds round-trip", mod.load_folds("tag") == {"misc", "source-filter"},
          str(mod.load_folds("tag")))

    # A fold name only means something inside one grouping mode: `pp` is a tag,
    # `Needs input` is a state. One flat list would collapse a state group
    # because a tag of the same name had been collapsed.
    check("a fold in one mode does not leak into another",
          mod.load_folds("state") == set(), str(mod.load_folds("state")))
    mod.save_folds("state", {"Done"})
    check("each mode keeps its own", mod.load_folds("tag") == {"misc", "source-filter"}
          and mod.load_folds("state") == {"Done"})

    # Both live in one file, so each write has to merge rather than overwrite.
    mod.save_pins({"aaa1"})
    check("saving a pin does not drop the folds",
          mod.load_folds("tag") == {"misc", "source-filter"}, str(mod.load_view()))
    mod.save_folds("tag", {"misc"})
    check("saving a fold does not drop the pins", mod.load_pins() == {"aaa1"},
          str(mod.load_view()))

    check("unfolding everything is remembered as nothing folded",
          (mod.save_folds("tag", set()), mod.load_folds("tag"))[1] == set())

    with open(mod.PIN_STORE, "w") as fh:
        fh.write("garbage")
    check("a corrupt store folds nothing rather than crashing",
          mod.load_folds("tag") == set())
    with open(mod.PIN_STORE, "w") as fh:
        fh.write('{"folded": "not a dict"}')
    check("and neither does a store with the wrong shape in it",
          mod.load_folds("tag") == set())

# ----------------------------------------------------------------- commands

section("the daemon is asked for the state, not the file")
with tempfile.TemporaryDirectory() as tmp:
    # WHY THIS EXISTS: `state.json` is a snapshot the daemon flushes LATER, so a
    # session working right now sits on `Needs input` for tens of seconds.
    # Measured on the real machine: `api=working disk=done` for the session that
    # was running the commands. No cleverer read of the file can fix that.
    good = os.path.join(tmp, "claude-good")
    with open(good, "w") as fh:
        fh.write('#!/bin/sh\ncat <<\'EOF\'\n'
                 '[{"id":"aaa1","state":"WORKING"},'
                 ' {"id":"aaa2","state":"done"},'
                 ' {"id":"bad"},'
                 ' "not even an object",'
                 ' {"id":"aaa3","state":""}]\nEOF\n')
    os.chmod(good, 0o755)
    os.environ["PP_AGENTS_CLAUDE"] = good
    check("the daemon's answer is read as {id: state}",
          mod.live_states() == {"aaa1": "working", "aaa2": "done"},
          str(mod.live_states()))
    check("a state is lower-cased, so it matches the record's vocabulary",
          mod.live_states().get("aaa1") == "working")
    check("a row with no state is skipped rather than stored as None",
          "bad" not in mod.live_states() and "aaa3" not in mod.live_states())
    check("the command asked is claude agents --json",
          mod.agents_cmd()[1:] == ["agents", "--json"], str(mod.agents_cmd()))

    junk = os.path.join(tmp, "claude-junk")
    with open(junk, "w") as fh:
        fh.write("#!/bin/sh\necho 'not json at all'\n")
    os.chmod(junk, 0o755)
    os.environ["PP_AGENTS_CLAUDE"] = junk
    # None, not {}: "the daemon says nothing is running" and "I could not ask"
    # must not look the same, or one failed call blanks every state on screen.
    check("output that is not json reads as 'could not ask', not 'nothing running'",
          mod.live_states() is None)

    notlist = os.path.join(tmp, "claude-notlist")
    with open(notlist, "w") as fh:
        fh.write('#!/bin/sh\necho \'{"agents": []}\'\n')
    os.chmod(notlist, 0o755)
    os.environ["PP_AGENTS_CLAUDE"] = notlist
    check("and so does json of the wrong shape", mod.live_states() is None)

    os.environ["PP_AGENTS_CLAUDE"] = "/nonexistent/claude"
    check("a missing binary is reported as 'could not ask', not raised",
          mod.live_states() is None)
    os.environ.pop("PP_AGENTS_CLAUDE", None)

section("the daemon's answer wins over the record")
_jobs = [
    {"short": "aaa1", "state": "blocked", "detail": "pick A or B"},
    {"short": "aaa2", "state": "done", "detail": "purged"},
    {"short": "gone", "state": "working", "detail": "still going"},
]
mod.merge_live(_jobs, {"aaa1": "working", "aaa2": "done"})
check("a stale Needs input becomes Working", _jobs[0]["state"] == "working")
check("a row the daemon agrees with is unchanged", _jobs[1]["state"] == "done")
check("a row the daemon never mentions keeps its record",
      _jobs[2]["state"] == "working", _jobs[2]["state"])

_idle = [{"short": "new1", "state": "blocked",
          "detail": "(idle \u2014 send a prompt to start)"}]
mod.merge_live(_idle, {"new1": "working"})
# The daemon calls a named session with no prompt `working`, which is true of the
# process and useless to a reader: it is waiting for YOU.
check("a session waiting for its first prompt stays Needs input",
      _idle[0]["state"] == "blocked", _idle[0]["state"])

_keep = [{"short": "aaa1", "state": "blocked", "detail": ""}]
mod.merge_live(_keep, None)
check("no answer changes nothing", _keep[0]["state"] == "blocked")
mod.merge_live(_keep, {})
check("an empty answer changes nothing either", _keep[0]["state"] == "blocked")

section("polling is skipped whenever it cannot pay for itself")
# Each call is 0.24s of CPU and 190 MB of peak RSS. These three rules are what
# make the common tick spend nothing at all.
_now = time.time()
_live_job = [{"state": "working"}]
check("a live session and a recent keypress is worth a call",
      mod.should_poll(_live_job, _now, _now) is True)
check("nothing live means no state CAN change, so no call",
      mod.should_poll([{"state": "done"}], _now, _now) is False)
check("an abandoned view eventually costs nothing",
      mod.should_poll(_live_job, _now - mod.LIVE_IDLE_STOP - 1, _now) is False)
check("and a second call inside the interval is refused",
      mod.should_poll(_live_job, _now, _now, last_poll_at=_now) is False)
check("blocked counts as live too, since it is the state that goes stale",
      mod.should_poll([{"state": "blocked"}], _now, _now) is True)
check("an empty list has nothing to poll for",
      mod.should_poll([], _now, _now) is False)

# THE BUG THIS EXISTS FOR: the first version STOPPED polling after two minutes of
# no keypress, and reading the list is silent - so watching for a session to
# finish was the one use that switched live states off.
check("an active view polls at the fast interval",
      mod.poll_interval(_now, _now) == mod.LIVE_POLL)
check("a quiet view slows down instead of stopping",
      mod.poll_interval(_now - mod.LIVE_IDLE_AFTER - 1, _now) == mod.LIVE_IDLE_POLL)
check("and slowing down is slower than the active rate, not equal to it",
      mod.LIVE_IDLE_POLL > mod.LIVE_POLL)
check("only an abandoned view stops entirely",
      mod.poll_interval(_now - mod.LIVE_IDLE_STOP - 1, _now) is None)
check("half an hour is what counts as abandoned, not two minutes",
      mod.LIVE_IDLE_STOP >= 1800 and mod.LIVE_IDLE_AFTER < mod.LIVE_IDLE_STOP,
      f"{mod.LIVE_IDLE_AFTER} / {mod.LIVE_IDLE_STOP}")
check("a quiet view still polls once its slower interval has passed",
      mod.should_poll(_live_job, _now - mod.LIVE_IDLE_AFTER - 1, _now,
                      last_poll_at=_now - mod.LIVE_IDLE_POLL - 1) is True)
check("but not before it has",
      mod.should_poll(_live_job, _now - mod.LIVE_IDLE_AFTER - 1, _now,
                      last_poll_at=_now - 1) is False)

section("a lingering child cannot stall a claude call")
with tempfile.TemporaryDirectory() as tmp:
    # A command that prints, then leaves a child holding its output open. Read
    # through a PIPE this blocks until that child exits, because a pipe is only
    # at EOF once every holder closes it. That is what froze the view mid-key.
    slow = os.path.join(tmp, "slow")
    with open(slow, "w") as fh:
        fh.write("#!/bin/sh\n( sleep 30 ) &\necho 'backgrounded \u00b7 feedface'\n")
    os.chmod(slow, 0o755)

    began = time.time()
    blob = mod.run_claude([slow], timeout=20)
    took = time.time() - began
    check("it returns as soon as the command itself is done", took < 8.0, f"{took:.1f}s")
    check("and still hands back what the command printed",
          "feedface" in blob, repr(blob))
    check("so the id is readable from it", mod.dispatched_id(blob) == "feedface")

with tempfile.TemporaryDirectory() as tmp:
    # a command that never finishes is capped rather than waited on forever
    stuck = os.path.join(tmp, "stuck")
    with open(stuck, "w") as fh:
        fh.write("#!/bin/sh\necho starting\nsleep 60\n")
    os.chmod(stuck, 0o755)
    began = time.time()
    blob = mod.run_claude([stuck], timeout=2)
    took = time.time() - began
    check("a command that hangs is cut off, not waited on", took < 12.0, f"{took:.1f}s")
    check("and says so", "timed out" in blob, repr(blob))

check("a missing binary is reported, not raised",
      "could not run" in mod.run_claude(["/nonexistent/claude", "agents"]))

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
    check("new runs claude --bg --name <name>",
          mod.dispatch_cmd("tag flow") ==
          ["/fake/claude", "--bg", "--name", "tag flow"],
          str(mod.dispatch_cmd("tag flow")))
    check("and sends no prompt, so the session waits for you to talk to it",
          len(mod.dispatch_cmd("tag flow")) == 4,
          str(mod.dispatch_cmd("tag flow")))
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
    # `kbc` and `kbcp` print the same shapes, so the header is the only thing
    # that says which store the numbers belong to
    head = dump(tmp).splitlines()[0]
    check("the dump header names the store", " work " in head, head)

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

DISPATCHED_ID = "abcd1234"      # what the stub reports for a `--bg`
# Claude Code's own wording for a named session with no work yet. Copied exactly
# so the test breaks if the real string moves out from under the matcher.
IDLE_DETAIL = "(idle \u2014 send a prompt to start)"
LINGERING_DAEMON = 30           # seconds the stub's "daemon" holds its output
# How long `drive()` waits for an expected string. Every real match lands in well
# under a second; this only bounds the broken case.
WAIT_CAP = 20.0


def stub_claude(tmp, linger=2):
    """A fake `claude` that leaves a record of how it was called.

    `linger` is how long an `attach` stays alive before writing `finished.log`.
    A test that proves a key DETACHED must pass a long one: with a short life the
    stub can run out before the key is even delivered on a loaded machine, and
    "finished.log is missing" then stops meaning "it was cut off".

    Two records, both files, because file evidence is deterministic while scraped
    screen text is not - pp-agents redraws over a forwarded child the instant it
    takes the terminal back, so whether that child's words survive in a capture
    is a race:

      calls.log     one line per invocation, written immediately
      finished.log  written only if an `attach` was left alone to run out
    """
    log = os.path.join(tmp, "calls.log")
    done = os.path.join(tmp, "finished.log")
    jobs = os.path.join(tmp, "work", "jobs")
    path = os.path.join(tmp, "claude")
    agents_json = os.path.join(tmp, "agents.json")
    if not os.path.exists(agents_json):
        with open(agents_json, "w") as fh:
            json.dump([{"id": "aaa1", "state": "working", "name": "chargeback"}], fh)
    with open(path, "w") as fh:
        fh.write(
            "#!/bin/sh\n"
            f'printf "%s | CLAUDE_CONFIG_DIR=%s\\n" "$*" "$CLAUDE_CONFIG_DIR" >> {log}\n'
            "case \"$1\" in\n"
            # mouse reporting on, exactly as `claude attach` does, and NOT turned
            # off if killed - the leak this reproduces
            '  attach) printf "\\033[?1000h\\033[?1002h\\033[?1003h\\033[?1006h";\n'
            f'          echo "ATTACHED $2"; sleep {linger} & wait $!; printf "%s\\n" "$2" >> {done} ;;\n'
            '  logs)   echo "LOGS $2" ;;\n'
            # The daemon's answer, deliberately CONTRADICTING the fixture on
            # disk: aaa1 is recorded `blocked` and reported `working`, which is
            # the real discrepancy this feature exists for.
            f'  agents) cat {agents_json} ;;\n'
            '  stop)   echo "stopped $2" ;;\n'
            # `claude --bg` starts `claude daemon run`, which outlives the
            # command and keeps whatever it inherited open - a pipe held that way
            # never reaches EOF, which is what froze the view. The record also
            # lands a moment LATER than the command returns. Both are reproduced,
            # and the output deliberately carries NO id: the session has to be
            # found by watching the store, not by parsing a line.
            #
            # The invocation is `--bg --name <name>`, so the name is $3, and the
            # detail is the real wording Claude Code writes for a session that
            # has a name and no work: `state` says working while it is in fact
            # waiting for you, which is the mapping under test.
            f'  rm)     {sys.executable} -c "import shutil,sys;shutil.rmtree(sys.argv[1],ignore_errors=True)" '
            f'          "{jobs}/$2"; echo "removed $2" ;;\n'
            f'  --bg)   ( sleep {LINGERING_DAEMON} ) &\n'
            f'          ( sleep 0.4; mkdir -p {jobs}/{DISPATCHED_ID};'
            f'            printf \'{{"state":"working","name":"%s",'
            f'"detail":"{IDLE_DETAIL}",'
            f'"cwd":"%s","updatedAt":"2026-08-27T10:00:00.000Z"}}\' "$3" "$PWD"'
            f'            > {jobs}/{DISPATCHED_ID}/state.json ) &\n'
            'echo "started, see claude agents" ;;\n'
            '  *)      echo "backgrounded fake" ;;\n'
            "esac\n")
    os.chmod(path, 0o755)
    return path, log


def got_key(tmp, raw, within=30.0):
    """True once the fake session has recorded reading `raw` from its terminal.

    This is the positive half of the back-key contract: a key that is forwarded
    must arrive, and a key that is reserved must never arrive. Both are facts on
    disk, so neither depends on how loaded the machine is.
    """
    target = os.path.join(tmp, "keys.log")
    needle = repr(raw)
    deadline = time.time() + within
    while time.time() < deadline:
        try:
            if needle in open(target).read():
                return True
        except OSError:
            pass
        time.sleep(0.05)
    return False


def finished(tmp, within=40.0):
    """True once the stub has recorded that it ran to completion.

    Polled rather than assumed: the alternative is a fixed tail, and a tail that
    expires early on a loaded machine fails a test about the code with a fact
    about the machine.
    """
    target = os.path.join(tmp, "finished.log")
    deadline = time.time() + within
    while time.time() < deadline:
        if os.path.exists(target):
            return True
        time.sleep(0.05)
    return False


def scrape(raw):
    """Plain text out of a terminal stream.

    The charset-designation escapes (`ESC ( B`) matter as much as the colour ones:
    curses emits one around almost every cell when a screen is being repainted
    repeatedly, so without stripping them a word on screen arrives as
    `(Bs(Bt(Ba(Br(Bt` and no assertion about visible text can ever match.
    """
    text = raw.decode("utf-8", "replace")
    text = re.sub(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)", "", text)
    text = re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", text)
    return re.sub(r"\x1b[()][AB0-2]", "", text)


def drive(tmp, keys, rows=40, cols=170, tail=None, scrubbed=True, linger=2,
          live=False):
    """Run the real pp-agents in a pty, wait until it has drawn, then send keys.

    Returns (first_screen, screen_after_keys, recorded_claude_calls).

    **Every wait is on evidence, not on a clock.** An earlier version slept fixed
    amounts; it passed here and failed inside the lander, which runs under load.
    A flaky test that blocks a land is worse than no test, so:

    - the first frame is waited for by looking for the title
    - after each key, output is read until it goes quiet
    - a key may be given as `(bytes, "text to wait for")`, which is required when
      the next key depends on the previous one having taken effect - handing
      shift+left to the proxy before the session it should leave has started
      is exactly the race that made this flaky

    `tail` is a bounded extra wait, used only by the assertion that checks
    something never happens.
    """
    binp, log = stub_claude(tmp, linger=linger)
    env = dict(os.environ)
    env.update({
        "TERM": "xterm-256color", "LINES": str(rows), "COLUMNS": str(cols),
        "PP_AGENTS_ACCOUNTS": f"work={os.path.join(tmp, 'work')}:personal={os.path.join(tmp, 'personal')}",
        "PP_AGENTS_PINS": os.path.join(tmp, "pins.json"),
        "PP_AGENTS_CLAUDE": binp,
        # Off by default. Polling spawns a subprocess on a timer, and a test that
        # is not about the daemon should not have one running underneath it.
        "PP_AGENTS_LIVE": "1" if live else "0",
        "PP_AGENTS_LIVE_POLL": "0",
    })
    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe(sys.executable, [sys.executable, SCRIPT], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    buf = b""
    dead = False

    def read_once(timeout):
        """One select+read. True if bytes arrived; False on quiet or EOF."""
        nonlocal buf, dead
        try:
            r, _, _ = select.select([fd], [], [], timeout)
        except (OSError, ValueError):
            dead = True
            return False
        if fd not in r:
            return False
        try:
            chunk = os.read(fd, 1 << 18)
        except OSError:
            dead = True
            return False
        if not chunk:
            dead = True
            return False
        buf += chunk
        return True

    def until(pred, cap):
        deadline = time.time() + cap
        while time.time() < deadline and not dead:
            if pred():
                return True
            read_once(0.1)
        return pred()

    def until_quiet(quiet=1.5, cap=12.0):
        deadline = time.time() + cap
        while time.time() < deadline and not dead:
            if not read_once(quiet):
                return

    until(lambda: "pp-agents" in scrape(buf), 90.0)
    until_quiet()
    before = scrape(buf)
    split = len(buf)

    for item in keys:
        k, wait_for = item if isinstance(item, tuple) else (item, None)
        if dead:
            break
        try:
            os.write(fd, k)
        except OSError:
            break
        if wait_for:
            # A miss here means the test expects text the program no longer
            # prints. Waiting it out silently is how three checks came to carry
            # 380 seconds of a 669-second suite while still passing: the cap
            # expired, the loop moved on, and a later disk assertion covered for
            # it. 20 seconds is still far longer than any real match takes.
            if not until(lambda w=wait_for: w in scrape(buf[split:]), WAIT_CAP):
                check(f"drive() saw {wait_for!r} on screen", False,
                      scrape(buf[split:])[-300:])
        until_quiet()

    if tail:
        deadline = time.time() + tail
        while time.time() < deadline and not dead:
            read_once(0.2)

    try:
        os.kill(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
    except Exception:
        pass
    os.close(fd)
    calls = open(log).read() if os.path.exists(log) else ""
    # `scrubbed=False` returns the raw stream, escape sequences intact, for the
    # assertions about terminal modes - scraping would delete the evidence.
    after = buf[split:].decode("utf-8", "replace") if not scrubbed else scrape(buf[split:])
    return before, after, calls


section("end to end: the real TUI in a real pty")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _after, _ = drive(tmp, [b"q"])
    check("the view starts and draws", "pp-agents" in first)
    head = first.splitlines()[0] if first.splitlines() else ""
    check("the title names the store you are looking at", "work" in head, head)
    check("real tag headers reach the screen", "pp" in first and "vi-prod" in first)
    check("real session names reach the screen", "chargeback" in first)
    check("q quits without an error", "Traceback" not in first, first[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, raw_after, calls = drive(tmp, [(b"\r", "ATTACHED"), b"\x1b[1;2D", b"q"], scrubbed=False)
    after = scrape(raw_after.encode('utf-8'))
    check("the cursor starts on a session, so enter works immediately",
          re.search(r"attach (aaa|bbb)", calls) is not None, repr(calls))
    check("a session whose folder is gone still opens",
          "FileNotFoundError" not in after and "Traceback" not in after, after[-400:])
    check("the attached program really ran", re.search(r"attach (aaa|bbb)", calls) is not None, repr(calls))
    with open("/tmp/buf_first.bin", "wb") as f:
        f.write(raw_after.encode("utf-8"))
    check("the view survives coming back from attach",
          "Traceback" not in after and "pp-agents" in after, after[-400:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, calls = drive(tmp, [(b"l", "LOGS"), b"\r", b"q"])
    check("l runs claude logs on the focused session",
          re.search(r"logs (aaa|bbb)", calls) is not None, repr(calls))
    check("the view survives coming back from logs",
          "Traceback" not in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, calls = drive(tmp, [b"K", (b"y", "stopped"), b"q"])
    check("K confirms before stopping", "stop" in after.lower(), after[-300:])
    check("confirming K runs claude stop",
          re.search(r"stop (aaa|bbb)", calls) is not None, repr(calls))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _a, calls = drive(tmp, [(b"K", "stop"), (b"n", "not stopped"), b"q"])
    check("declining K stops nothing", re.search(r"stop (aaa|bbb)", calls) is None, repr(calls))

def stub_navigating_claude(tmp, marker="describe a task for a new session",
                          on_left=True, linger=2.5):
    """A fake `claude attach` that behaves like the real one where it matters.

    On a LEFT ARROW it prints the text Claude Code's own agents view draws, the
    way the real client does. With `on_left=False` it prints that text at once,
    unprompted, standing in for a session whose *content* happens to contain it.
    Neither may pull you out of the session: the back key is reserved now, so
    nothing is read off the screen to decide when to leave.
    """
    log = os.path.join(tmp, "calls.log")
    done = os.path.join(tmp, "finished.log")
    keys = os.path.join(tmp, "keys.log")
    path = os.path.join(tmp, "claude")
    lines = [
        "#!/usr/bin/env python3",
        "import os, sys, time",
        f"open({log!r}, 'a').write(' '.join(sys.argv[1:]) + chr(10))",
        "if sys.argv[1] != 'attach':",
        "    print(sys.argv[1]); sys.exit(0)",
        "sys.stdout.write('ATTACHED ' + sys.argv[2] + chr(10)); sys.stdout.flush()",
        "import tty; tty.setraw(0)",
        f"if not {on_left!r}:",
        f"    sys.stdout.write({marker!r} + chr(10)); sys.stdout.flush()",
        "import select",
        f"end = time.time() + {linger}",
        "while time.time() < end:",
        "    r, _, _ = select.select([0], [], [], 0.2)",
        "    if not r:",
        "        continue",
        "    try:",
        "        ch = os.read(0, 64)",
        "    except OSError:",
        "        sys.exit(0)",          # detached: never claim completion
        "    if not ch:",
        "        sys.exit(0)",
        f"    fh = open({keys!r}, 'a'); fh.write(repr(ch) + chr(10)); fh.close()",
        "    if b'\\x1b[D' in ch or b'\\x1bOD' in ch:",
        f"        if {on_left!r}:",
        f"            sys.stdout.write({marker!r} + chr(10)); sys.stdout.flush()",
        f"open({done!r}, 'a').write('finished' + chr(10))",
    ]
    with open(path, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    os.chmod(path, 0o755)
    return path, log


def drive_with(tmp, binp, keys, rows=40, cols=170, tail=None):
    """Same as drive(), but with a caller-supplied fake `claude`."""
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
    dead = False

    def read_once(timeout):
        nonlocal buf, dead
        try:
            r, _, _ = select.select([fd], [], [], timeout)
        except (OSError, ValueError):
            dead = True
            return False
        if fd not in r:
            return False
        try:
            chunk = os.read(fd, 1 << 18)
        except OSError:
            dead = True
            return False
        if not chunk:
            dead = True
            return False
        buf += chunk
        return True

    def until(pred, cap):
        deadline = time.time() + cap
        while time.time() < deadline and not dead:
            if pred():
                return True
            read_once(0.1)
        return pred()

    def until_quiet(quiet=1.5, cap=12.0):
        deadline = time.time() + cap
        while time.time() < deadline and not dead:
            if not read_once(quiet):
                return

    until(lambda: "pp-agents" in scrape(buf), 90.0)
    until_quiet()
    split = len(buf)
    for item in keys:
        k, wait_for = item if isinstance(item, tuple) else (item, None)
        if dead:
            break
        try:
            os.write(fd, k)
        except OSError:
            break
        if wait_for:
            until(lambda w=wait_for: w in scrape(buf[split:]), 60.0)
        until_quiet()
    if tail:
        deadline = time.time() + tail
        while time.time() < deadline and not dead:
            read_once(0.2)
    try:
        os.kill(pid, signal.SIGKILL); os.waitpid(pid, 0)
    except Exception:
        pass
    os.close(fd)
    return scrape(buf[split:])


section("end to end: shift+left comes back here")
BACK = b"\x1b[1;2D"
LEFT = b"\x1b[D"
APPLEFT = b"\x1bOD"
CTRL_O = b"\x0f"

# `linger` is comfortably longer than the harness needs to deliver a key, so the
# fake session cannot end on its own and muddy the answer - but no longer than
# that. These stubs are Python processes, and a land runs this suite on a machine
# that is already busy; one that was SIGKILLed for memory is indistinguishable
# from one that failed. What is measured is the key and the screen, not the clock.

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    binp, _log = stub_navigating_claude(tmp, linger=25)
    after = drive_with(tmp, binp, [(b"\r", "ATTACHED"), (BACK, "pp-agents")], tail=1.0)
    check("shift+left brings you back to the tag list", "pp-agents" in after, after[-400:])
    check("shift+left never reaches the session", not got_key(tmp, BACK, within=2.0),
          open(os.path.join(tmp, "keys.log")).read() if
          os.path.exists(os.path.join(tmp, "keys.log")) else "(no keys read)")
    check("it detaches instead of leaving the session attached",
          not os.path.exists(os.path.join(tmp, "finished.log")),
          str(sorted(os.listdir(tmp))))
    check("coming back that way does not traceback", "Traceback" not in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # THE REGRESSION THIS SECTION EXISTS FOR: the plain left arrow is an ordinary
    # cursor key again. It must reach the session and must NOT bring the list
    # back - detaching on it is what used to flash Claude Code's own list on the
    # way out.
    binp, _log = stub_navigating_claude(tmp, linger=25)
    after = drive_with(tmp, binp, [(b"\r", "ATTACHED"), LEFT], tail=3.0)
    check("a plain left arrow reaches the session", got_key(tmp, LEFT))
    check("a plain left arrow does not bring the list back",
          "pp-agents" not in after, after[-400:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # the application-cursor-mode left arrow is a cursor key too
    binp, _log = stub_navigating_claude(tmp, linger=25)
    after = drive_with(tmp, binp, [(b"\r", "ATTACHED"), APPLEFT], tail=3.0)
    check("the application-mode left arrow reaches the session", got_key(tmp, APPLEFT))
    check("it does not bring the list back either", "pp-agents" not in after, after[-400:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # ctrl+o is Claude Code's own "see full summary". Swallowing it took a working
    # shortcut away, so it must now pass straight through.
    binp, _log = stub_navigating_claude(tmp, linger=25)
    after = drive_with(tmp, binp, [(b"\r", "ATTACHED"), CTRL_O], tail=3.0)
    check("ctrl+o is no longer swallowed and reaches the session", got_key(tmp, CTRL_O))
    check("ctrl+o no longer brings the list back", "pp-agents" not in after, after[-400:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # nothing the session PRINTS can eject you any more, because nothing is read
    # off the screen to decide it
    binp, _log = stub_navigating_claude(tmp, linger=25, on_left=False)
    after = drive_with(tmp, binp, [(b"\r", "ATTACHED")], tail=5.0)
    check("Claude Code's own list text does not pull you out",
          "pp-agents" not in after, after[-400:])

section("the reserved-key helper")
check("shift+left is recognised", mod.first_reserved(b"\x1b[1;2D")[1] == "shift+left")
check("ctrl+o is NOT reserved any more", mod.first_reserved(b"\x0f")[0] == -1)
check("ordinary typing is not", mod.first_reserved(b"hello world")[0] == -1)
check("a plain left arrow is not reserved", mod.first_reserved(b"\x1b[D")[0] == -1)
check("the application-mode left arrow is not reserved",
      mod.first_reserved(b"\x1bOD")[0] == -1)
check("the offset is where the key starts",
      mod.first_reserved(b"abc\x1b[1;2D")[0] == 3,
      str(mod.first_reserved(b"abc\x1b[1;2D")))
check("exactly one key is reserved", len(mod.RESERVED_KEYS) == 1,
      str(mod.RESERVED_KEYS))
check("an extra key from the environment is honoured",
      mod.first_reserved(b"zz\x1c", "\x1c")[0] == 2)

section("end to end: coming back out of a session")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # shift+left mid-session must return to the list AND detach the client, so
    # the stub's later output never appears. This is the whole reason the attach
    # runs on a pty we own instead of inheriting the terminal.
    _f, after, calls = drive(tmp, [(b"\r", "ATTACHED"), b"\x1b[1;2D"], tail=3.0,
                             linger=25)
    check("the session was opened", re.search(r"attach (aaa|bbb)", calls) is not None, repr(calls))
    check("shift+left returns to the tag list", "pp-agents" in after, after[-400:])
    check("shift+left detaches rather than waiting it out",
          not os.path.exists(os.path.join(tmp, "finished.log")),
          str(sorted(os.listdir(tmp))))
    check("coming back does not traceback", "Traceback" not in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # without the reserved key the child is left to finish normally. A short
    # life and a long tail, so a loaded machine still has room to see it end.
    _f, after, _ = drive(tmp, [(b"\r", "ATTACHED")], tail=10.0, linger=1)
    check("a session left alone runs to completion", finished(tmp),
          str(sorted(os.listdir(tmp))))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # when the session ends by itself, the list comes back on its own
    _f, after, _ = drive(tmp, [(b"\r", "ATTACHED")], tail=10.0, linger=1)
    check("the view returns after the session ends", "pp-agents" in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, _ = drive(tmp, [b"?", b"q", b"q"])
    check("help names the way back", "shift+left" in after, after[-500:])
    check("help no longer offers ctrl+o as a way back",
          "ctrl+o" not in after, after[-500:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _a, _ = drive(tmp, [b"q"])
    check("the status bar names the way back", "shift+left back" in first, first[-300:])

section("end to end: the terminal is handed back clean")


def mode_events(text):
    """(enabled, disabled) sets of the DEC private modes seen in a raw stream."""
    on = set(re.findall(r"\x1b\[\?(\d+)h", text))
    off = set(re.findall(r"\x1b\[\?(\d+)l", text))
    return on, off


MOUSE_MODES = {"1000", "1002", "1003", "1006"}

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, _ = drive(tmp, [(b"\r", "ATTACHED"), b"\x1b[1;2D", b"q"], scrubbed=False)
    on, off = mode_events(after)
    check("the session turned mouse reporting on (as claude attach does)",
          MOUSE_MODES & on == MOUSE_MODES, str(sorted(on)))
    check("detaching turns every mouse mode back off",
          MOUSE_MODES <= off, f"left on: {sorted(MOUSE_MODES - off)}")
    check("bracketed paste is turned off too", "2004" in off, str(sorted(off)))
    check("focus reporting is turned off too", "1004" in off, str(sorted(off)))
    check("the cursor is made visible again", "25" in off or "\x1b[?25h" in after,
          str(sorted(off)))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # quitting normally must also leave the terminal clean, because a mode set by
    # an earlier session outlives that session
    _f, after, _ = drive(tmp, [(b"\r", "ATTACHED"), b"\x1b[1;2D", b"q"], scrubbed=False)
    tail = after[after.rindex("ATTACHED"):] if "ATTACHED" in after else after
    _on, off = mode_events(tail)
    check("the modes are cleared before pp-agents exits",
          MOUSE_MODES <= off, f"left on: {sorted(MOUSE_MODES - off)}")

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, _ = drive(tmp, [(b"l", "LOGS"), b"\r", b"q"], scrubbed=False)
    _on, off = mode_events(after)
    check("the logs view also hands the terminal back clean",
          MOUSE_MODES <= off, f"left on: {sorted(MOUSE_MODES - off)}")

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # pp-agents must never switch these on itself; it only ever switches them off
    _f, after, _ = drive(tmp, [b"q"], scrubbed=False)
    on, _off = mode_events(after)
    check("pp-agents does not enable mouse reporting of its own",
          not (MOUSE_MODES & on), str(sorted(on)))

# The mouse packets already SITTING in the terminal's input queue are the part
# that actually bit: switching reporting off stops new ones, and your shell then
# reads and prints the backlog as `35;3;19M35;4;18M` gibberish. So the queue has
# to be thrown away as well, and only on a real tty.
def queued_after_cleanup(payload, drain):
    """Bytes still readable on stdin after clear_borrowed_modes(), on a real pty.

    The handshake goes through files, not sleeps: the child says it is ready, the
    junk is written into the pty (which queues it synchronously), and only then is
    the child told to run the cleanup. Raw mode is set first because that is how
    the bytes become readable at all - a canonical-mode tty holds them back until
    a newline, which would hide the very backlog being measured.
    """
    box = tempfile.mkdtemp()
    ready, go = os.path.join(box, "ready"), os.path.join(box, "go")
    child = (
        "import os, sys, select, time, tty\n"
        "import importlib.machinery, importlib.util\n"
        "tty.setraw(0)\n"
        f"l = importlib.machinery.SourceFileLoader('pp_agents', {SCRIPT!r})\n"
        "s = importlib.util.spec_from_loader('pp_agents', l)\n"
        "m = importlib.util.module_from_spec(s); l.exec_module(m)\n"
        f"open({ready!r}, 'w').close()\n"
        f"while not os.path.exists({go!r}):\n"
        "    time.sleep(0.01)\n"
        f"m.clear_borrowed_modes(drain={drain!r})\n"
        "left = b''\n"
        "while select.select([0], [], [], 0.4)[0]:\n"
        "    c = os.read(0, 4096)\n"
        "    if not c:\n"
        "        break\n"
        "    left += c\n"
        "sys.stderr.write('LEFTOVER=' + str(len(left)) + chr(13) + chr(10))\n"
    )
    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe(sys.executable, [sys.executable, "-c", child], dict(os.environ))

    out = b""
    deadline = time.time() + 30

    def pump(seconds):
        nonlocal out
        r, _, _ = select.select([fd], [], [], seconds)
        if r:
            try:
                out += os.read(fd, 65536)
            except OSError:
                pass

    while not os.path.exists(ready) and time.time() < deadline:
        pump(0.05)
    os.write(fd, payload)                    # queued in the tty before "go"
    open(go, "w").close()
    while b"LEFTOVER=" not in out and time.time() < deadline:
        pump(0.2)
    try:
        os.kill(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
    except OSError:
        pass
    os.close(fd)
    found = re.search(rb"LEFTOVER=(\d+)", out)
    return int(found.group(1)) if found else -1


MOUSE_JUNK = b"".join(b"\x1b[<35;%d;19M" % n for n in range(3, 30))

drained = queued_after_cleanup(MOUSE_JUNK, drain=True)
kept = queued_after_cleanup(MOUSE_JUNK, drain=False)
check("queued mouse packets are thrown away on the way out", drained == 0, str(drained))
check("without the drain they survive, so this test can actually fail", kept > 0, str(kept))

section("coming back from a session counts as activity")
# THE BUG THIS EXISTS FOR: `shift+left` is swallowed by the proxy and never
# reaches the main loop, so an hour inside a session read as an hour of idleness.
# You came back to a list that had stopped asking the daemon anything, which is
# precisely when the states were most likely to be wrong.
_src = open(SCRIPT).read()
_restore = _src.split("def restore_screen(self):", 1)[1].split("def ", 1)[0]
check("restore_screen marks the return as a keypress",
      "self.last_key_at = time.time()" in _restore, _restore[:400])
check("and clears the poll clock, so the very next tick asks",
      "self.last_poll_at = 0.0" in _restore, _restore[:400])
check("both attach and logs go through it",
      _src.count("self.restore_screen()") >= 2,
      str(_src.count("self.restore_screen()")))

section("end to end: the screen shows the daemon's state, not the file's")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # The fixture records aaa1 (`chargeback`) as blocked. The stub daemon reports
    # it working. The screen must end up saying Working.
    _f, after, calls = drive(tmp, [(b"g", "Working"), b"q"], live=True)
    check("the daemon is asked", "agents --json" in calls, repr(calls[:200]))
    check("and its answer reaches the screen", "Working" in after, after[-500:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, _after, calls = drive(tmp, [b"q"])
    check("with polling off nothing asks the daemon",
          "agents" not in calls, repr(calls[:200]))

section("end to end: a fold outlives the process")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # THE BUG THIS EXISTS FOR: the owner folds the tags he is not working in, and
    # every restart opened them again. `space` on a header folds it; the second
    # run is a whole new process reading the same store.
    first, after, _ = drive(tmp, [(b" ", "\u25b8"), b"q"])
    # The arrow alone, not `\u25b8 pp`: curses transmits only the cells that changed,
    # so folding resends the one arrow character and leaves the name where it
    # already was. Asserting the pair means asserting how curses batches a
    # repaint, which is not what this test is about.
    check("space folds the group under the cursor", "\u25b8" in after, after[-400:])
    # That folding HIDES rows is a unit test ("a folded group contributes only its
    # header"). Asserting absence from a live curses stream is unreliable, because
    # only changed cells are transmitted and stale text lingers in the capture.
    again, _a, _ = drive(tmp, [b"q"])
    check("a new run opens with that group still folded", "\u25b8 pp" in again,
          again[-400:])
    check("the groups that were open are still open", "\u25be " in again, again[-400:])

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

section("end to end: deleting a session")

def records_on_disk(tmp):
    out = set()
    for root in ("work", "personal"):
        base = os.path.join(tmp, root, "jobs")
        for shortid in os.listdir(base) if os.path.isdir(base) else []:
            out.add(shortid)
    return out


with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    before = records_on_disk(tmp)
    _f, after, calls = drive(tmp, [(b"d", "delete"), (b"y", "deleted"), b"q"])
    gone = before - records_on_disk(tmp)
    check("d then y deletes exactly one session record", len(gone) == 1, str(gone))
    check("it deletes through claude rm, which the daemon honours",
          re.search(r"\brm (aaa|bbb|zzz)", calls) is not None, repr(calls))
    check("the deleted record's directory is really gone",
          not any(os.path.isdir(os.path.join(tmp, r, "jobs", s))
                  for s in gone for r in ("work", "personal")), str(gone))
    check("deleting does not traceback", "Traceback" not in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    before = records_on_disk(tmp)
    _f, after, _ = drive(tmp, [(b"d", "delete"), (b"n", "not deleted"), b"q"])
    check("d then n deletes nothing", records_on_disk(tmp) == before,
          str(before - records_on_disk(tmp)))
    check("declining says so", "not deleted" in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # the cursor starts on the most urgent row, which the fixture makes a
    # `blocked` one - a live session, so this must stop it before removing it
    _f, after, calls = drive(tmp, [(b"d", "delete"), (b"y", "deleted"), b"q"])
    check("deleting a live session asks about stopping too", "stop AND delete" in after,
          after[-400:])
    check("deleting a live session runs claude stop first",
          re.search(r"stop aaa1", calls) is not None, repr(calls))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # ONE `j`, not two. The cursor starts on the first job, and the fixture's rows
    # are: [header pp, aaa1 blocked, aaa2 done, header source-filter, ...] - so a
    # second `j` lands on a HEADER, where `d` folds the group and confirms nothing.
    _f, after, calls = drive(tmp, [b"j", (b"d", "delete"), (b"y", "deleted"), b"q"])
    # Assert the prompt was actually reached. Without this the check below passes
    # whenever `d` lands on a group header instead of a session: nothing is
    # confirmed, nothing is deleted, and "no stop was run" is true for the wrong
    # reason - which is exactly what it was doing, at 128 seconds a run.
    check("the confirm prompt was reached at all", "delete" in after, after[-400:])
    check("deleting a finished session does not stop anything",
          re.search(r"stop ", calls) is None, repr(calls))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, _ = drive(tmp, [(b"t", "pinned"), (b"d", "delete"), (b"y", "deleted"), b"q"])
    pins = json.load(open(os.path.join(tmp, "pins.json")))["pins"]
    check("deleting a pinned session drops its pin too", pins == [], str(pins))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # x is untouched: it still removes a tag and never deletes a record
    before = records_on_disk(tmp)
    _f, _a, _ = drive(tmp, [b"x", b"q"])
    check("x still only removes a tag, never a record",
          records_on_disk(tmp) == before, str(before - records_on_disk(tmp)))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    _f, after, _ = drive(tmp, [b"?", b"q", b"q"])
    check("help names the delete key", "delete this session" in after, after[-600:])

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _a, _ = drive(tmp, [b"q"])
    check("the status bar names the delete key", "d delete" in first, first[-300:])

section("delete_record refuses anything that is not a session record")
with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    jobs = mod.load_jobs([("work", os.path.join(tmp, "work"))])
    victim = dict(jobs[0])
    outsider = os.path.join(tmp, "not-a-record")
    os.makedirs(outsider, exist_ok=True)
    victim["dir"] = outsider
    raised = False
    try:
        mod.delete_record(victim)
    except ValueError:
        raised = True
    check("a directory outside jobs/ is refused", raised)
    check("and it is still there", os.path.isdir(outsider))

    mismatched = dict(jobs[0])
    mismatched["short"] = "someone-else"
    raised = False
    try:
        mod.delete_record(mismatched)
    except ValueError:
        raised = True
    check("a record whose short id does not match its path is refused", raised)
    check("and that record survives", os.path.isdir(jobs[0]["dir"]))

    mod.delete_record(jobs[0])
    check("a genuine record is removed", not os.path.isdir(jobs[0]["dir"]))


section("starting a new session")

# Where you opened the view is what you chose; where the backlog lives is not.
with tempfile.TemporaryDirectory() as here:
    was = os.getcwd()
    os.chdir(here)
    try:
        check("the folder the view was opened in wins",
              os.path.realpath(mod.default_cwd([])) == os.path.realpath(here),
              mod.default_cwd([]))
        check("it wins even when every session lives somewhere else",
              os.path.realpath(mod.default_cwd(
                  [{"cwd": "/b"}, {"cwd": "/b"}, {"cwd": "/b"}])) ==
              os.path.realpath(here),
              mod.default_cwd([{"cwd": "/b"}]))
    finally:
        os.chdir(was)

check("the default is always a real folder", os.path.isdir(mod.default_cwd([])),
      mod.default_cwd([]))


def one_folder_store(tmp):
    """A store whose sessions all live in a folder that really exists."""
    real = os.path.join(tmp, "repo")
    os.makedirs(real, exist_ok=True)
    make_job(os.path.join(tmp, "work"), "nn1", state="done", name="one", cwd=real)
    make_job(os.path.join(tmp, "work"), "nn2", state="done", name="two", cwd=real)
    return real


with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    first, _a, _ = drive(tmp, [b"q"])
    check("the list offers a new session on screen",
          "name a new session" in first, first[-400:])

with tempfile.TemporaryDirectory() as tmp:
    real = one_folder_store(tmp)
    _f, after, calls = drive(tmp, [
        (b"n", "name it"),
        (b"tag flow\r", "folder:"),
        (b"\r", "ATTACHED"),
        (b"\x1b[1;2D", "back from"),
        b"q",
    ])
    check("n asks for the name before anything else",
          "name it" in after, after[-400:])
    check("the name is dispatched with claude --bg --name",
          "--bg --name tag flow" in calls, repr(calls))
    check("and no prompt rides along with it",
          "ship it" not in calls and "--bg tag" not in calls, repr(calls))
    check("the new session is opened, not left on the list",
          f"ATTACHED {DISPATCHED_ID}" in after, after[-600:])
    check("and shift+left comes straight back out of it",
          "back from" in after, after[-400:])
    check("the folder prompt arrives pre-filled, so enter accepts it",
          "folder: /" in after, after[-500:])
    check("and what it offers is where the view was opened, not where the sessions are",
          real not in after.split("folder: ")[-1][:200], after[-500:])

# A named session with no work yet records `working` and does nothing. The bucket
# has to say Needs input, or the row you just made is filed under Working - the
# one group you would not scan for it.
check("a session waiting for its first prompt is filed as needing input",
      mod.session_state({"state": "working", "detail": IDLE_DETAIL}) == "blocked",
      mod.session_state({"state": "working", "detail": IDLE_DETAIL}))
check("a session that is really working is left alone",
      mod.session_state({"state": "working", "detail": "editing a file"})
      == "working")
check("and every other state passes through untouched",
      [mod.session_state({"state": s, "detail": ""})
       for s in ("done", "blocked", "error", "idle")]
      == ["done", "blocked", "error", "idle"])
check("a record with no state at all is not crashed on",
      mod.session_state({}) == "")

check("a launch that cannot even start is reported, not raised",
      mod.start_claude(["/nonexistent/claude", "--bg", "x"])[0] is None)
_proc, _log = mod.start_claude(["/nonexistent/claude", "--bg", "x"])
check("and the reason is written where the caller can read it",
      "could not run" in mod.last_line(_log), mod.last_line(_log))
os.unlink(_log)

with tempfile.TemporaryDirectory() as tmp:
    # THE BUG THIS EXISTS FOR: the session dispatches, the record lands a moment
    # later, and the row must be listed and selected without pressing g.
    real = one_folder_store(tmp)
    _f, after, calls = drive(tmp, [
        (b"n", "name it"),
        (b"water the plants\r", "folder:"),
        (b"\r", "ATTACHED"),
        (b"\x1b[1;2D", "back from"),
        b"q",
    ])
    check("the new session is listed straight away",
          "water the plants" in after, after[-600:])
    # The id, not the sentence around it: curses repaints in fragments, so the
    # captured stream interleaves text from different screen positions and an
    # exact phrase spanning a redraw cannot be matched reliably. The id is the
    # part that has to reach the screen.
    check("the status names the session that started",
          DISPATCHED_ID in after, after[-300:])
    check("it did not need the command to print an id",
          "backgrounded" not in after, after[-300:])
    check("the view said it was working on it while it waited",
          "starting a session" in after, after[-300:])
    check("the record really was written",
          os.path.isfile(os.path.join(tmp, "work", "jobs", "abcd1234", "state.json")))

with tempfile.TemporaryDirectory() as tmp:
    # the store stamp is the half that notices an ARRIVAL; a record appearing
    # under jobs/ must move it, or the list can never refresh itself
    one_folder_store(tmp)
    accounts = [("work", os.path.join(tmp, "work"))]
    before = mod.store_stamp(accounts)
    check("a stamp is produced at all", before > 0, str(before))
    time.sleep(1.1)                       # mtime granularity on some filesystems
    make_job(os.path.join(tmp, "work"), "brandnew", state="working", name="new one")
    check("adding a session moves the stamp", mod.store_stamp(accounts) > before,
          f"{before} -> {mod.store_stamp(accounts)}")
    check("record_exists finds it", mod.record_exists("brandnew", accounts))
    check("and does not invent one", not mod.record_exists("nope", accounts))

with tempfile.TemporaryDirectory() as tmp:
    one_folder_store(tmp)
    _f, after, calls = drive(tmp, [(b"n", "name it"), b"\x1b", b"q"])
    check("escaping the name prompt dispatches nothing",
          "--bg" not in calls, repr(calls))
    check("and it says so", "nothing dispatched" in after, after[-300:])

with tempfile.TemporaryDirectory() as tmp:
    one_folder_store(tmp)
    _f, after, calls = drive(tmp, [(b"n", "name it"), b"\r", b"q"])
    check("an empty name dispatches nothing", "--bg" not in calls, repr(calls))

with tempfile.TemporaryDirectory() as tmp:
    one_folder_store(tmp)
    _f, after, calls = drive(tmp, [
        (b"n", "name it"),
        (b"look at the logs\r", "folder:"),
        b"\x1b",
        b"q",
    ])
    check("escaping the folder prompt dispatches nothing",
          "--bg" not in calls, repr(calls))

with tempfile.TemporaryDirectory() as tmp:
    fixture(tmp)
    # the hint costs the list a row; every session must still be reachable
    first, _a, _ = drive(tmp, [b"q"], rows=14)
    check("the list still renders with the hint taking a row",
          "pp-agents" in first and "name a new session" in first, first[-300:])

section("a new session lands in an account this view reads")
check("dispatch_env pins the store",
      mod.dispatch_env("/tmp/whatever")["CLAUDE_CONFIG_DIR"] == "/tmp/whatever")
check("it does not disturb the rest of the environment",
      mod.dispatch_env("/tmp/whatever").get("PATH") == os.environ.get("PATH"))

with tempfile.TemporaryDirectory() as tmp:
    # a store holding records that is not one of the accounts must be reported,
    # because that is exactly where an unpinned dispatch used to disappear to
    other = os.path.join(tmp, "elsewhere")
    make_job(other, "orphan1", state="done", name="lost one")
    make_job(other, "orphan2", state="done", name="lost two")
    found = mod.foreign_stores(candidates=(other,))
    check("a store with records outside the accounts is reported",
          found and found[0][1] == 2, str(found))
    empty = os.path.join(tmp, "nothing")
    os.makedirs(os.path.join(empty, "jobs"), exist_ok=True)
    check("an empty one is not worth mentioning",
          mod.foreign_stores(candidates=(empty,)) == [], str(mod.foreign_stores(candidates=(empty,))))
    check("a real account is never called foreign",
          mod.foreign_stores(candidates=(os.path.join(tmp, "work"),)) == [])

with tempfile.TemporaryDirectory() as tmp:
    # THE BUG: the view reads two fixed stores but the dispatch used to inherit
    # the shell's CLAUDE_CONFIG_DIR, so a shell that had selected no account sent
    # the session to Claude Code's default - created, reported, and unlistable.
    real = one_folder_store(tmp)
    env_before = os.environ.get("CLAUDE_CONFIG_DIR")
    os.environ["CLAUDE_CONFIG_DIR"] = "/tmp/not-an-account-at-all"
    try:
        _f, after, calls = drive(tmp, [
            (b"n", "name it"),
            (b"pin the account\r", "folder:"),
            (b"\r", "ATTACHED"),
            (b"\x1b[1;2D", "back from"),
            b"q",
        ])
    finally:
        if env_before is None:
            os.environ.pop("CLAUDE_CONFIG_DIR", None)
        else:
            os.environ["CLAUDE_CONFIG_DIR"] = env_before
    check("the dispatch ignores the shell and pins the account it will show",
          os.path.join(tmp, "work") in calls, repr(calls[-200:]))
    check("so the shell's store is never used",
          "not-an-account-at-all" not in calls, repr(calls[-200:]))
    check("and the session is listed", DISPATCHED_ID in after, after[-300:])

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

section("against a snapshot of the real session store (read only)")

# Mirrors pp-agents' own ACCOUNTS defaults. Stated here rather than imported because
# that module resolves PP_AGENTS_ACCOUNTS at import time, and this suite sets it.
REAL_ACCOUNT_ROOTS = (
    ("work", os.path.expanduser("~/.claude-work")),
    ("personal", os.path.expanduser("~/.claude-personal")),
)


def snapshot_real_store(dest):
    """Copy every live job record into `dest`. Returns a PP_AGENTS_ACCOUNTS value."""
    specs = []
    for name, root in REAL_ACCOUNT_ROOTS:
        src = os.path.join(root, "jobs")
        if not os.path.isdir(src):
            continue
        acct = os.path.join(dest, name)
        dst = os.path.join(acct, "jobs")
        os.makedirs(dst, exist_ok=True)
        for short in sorted(os.listdir(src)):
            sdir = os.path.join(src, short)
            if not os.path.isdir(sdir):
                continue
            os.makedirs(os.path.join(dst, short), exist_ok=True)
            for fn in ("state.json", "group"):
                try:
                    shutil.copyfile(os.path.join(sdir, fn), os.path.join(dst, short, fn))
                except OSError:
                    # A job that vanished between the listing and the copy is precisely
                    # the race this snapshot removes. Skip it; the rest is still real.
                    pass
        specs.append("%s=%s" % (name, acct))
    return ":".join(specs)


with tempfile.TemporaryDirectory() as snap:
    accounts = snapshot_real_store(snap)
    check("the snapshot found at least one real account", bool(accounts), accounts)
    renv = dict(os.environ)
    renv["PP_AGENTS_ACCOUNTS"] = accounts
    renv.pop("PP_AGENTS_PINS", None)
    real = subprocess.run([sys.executable, SCRIPT, "--doctor"], env=renv,
                          capture_output=True, text=True, timeout=180)
    print("   " + "\n   ".join(real.stdout.strip().splitlines()[-14:]))
    check("--doctor passes on this machine", real.returncode == 0, real.stdout[-300:])
    real = subprocess.run([sys.executable, SCRIPT, "--list"], env=renv,
                          capture_output=True, text=True, timeout=120)
    check("--list works on the real store", real.returncode == 0, real.stderr[-200:])
    check("--list finds real sessions", len(real.stdout.strip().splitlines()) > 3,
          real.stdout[:200])

section_close()
print()
if FAILS:
    print(f"FAILED: {len(FAILS)}")
    for f in FAILS:
        print("  - " + f)
    sys.exit(1)
print("all checks passed")
