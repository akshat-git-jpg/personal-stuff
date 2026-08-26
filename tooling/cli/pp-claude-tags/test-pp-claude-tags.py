#!/usr/bin/env python3
"""Tests for pp-claude-tags.

Everything here runs against temp files. The module is imported and its path
globals are repointed, so no test touches the real `.claude.json`, the real
stamp, or the real binary — and nothing can fire a desktop notification.

Two things are covered, because those are the two that have actually broken:

1. **The view setting.** Three separate times the binary was patched correctly
   and the agents view still showed no tags, because something rewrote
   `fleetViewGroupMode`. The heal must be unconditional, must count a fight, and
   must respect the opt-out file.
2. **Finding the gate.** The minified variable name changes every release, so the
   two search strategies are exercised against a synthetic bundle — including the
   cases where they must refuse to patch rather than guess.

    python3 tooling/cli/pp-claude-tags/test-pp-claude-tags.py
"""
import importlib.util
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))

spec = importlib.util.spec_from_loader(
    "pp_claude_tags",
    importlib.machinery.SourceFileLoader("pp_claude_tags", os.path.join(HERE, "pp-claude-tags")),
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

FAILS = []


def check(label, cond, extra=""):
    print(("  ok   " if cond else "  FAIL ") + label + (f"   [{extra}]" if extra and not cond else ""))
    if not cond:
        FAILS.append(label)


def sandbox(tmp, configs=("work", "personal"), mode="group"):
    """Point the module at temp files and return the config paths."""
    paths = []
    for name in configs:
        p = os.path.join(tmp, f"{name}.json")
        with open(p, "w") as fh:
            json.dump({"fleetViewGroupMode": mode, "keep": "me"}, fh)
        paths.append(p)
    mod.CONFIGS = paths
    mod.STAMP = os.path.join(tmp, "stamp.json")
    mod.NOHEAL = os.path.join(tmp, "noheal")
    mod.QUIET = True
    return paths


def mode_of(path):
    return json.load(open(path)).get("fleetViewGroupMode")


def alerts_captured():
    """Replace alert() with a recorder — a test must never notify the desktop."""
    seen = []
    mod.alert = lambda msg: seen.append(msg)
    return seen


# ---------------------------------------------------------------- the heal

print("the view setting")
with tempfile.TemporaryDirectory() as tmp:
    work, personal = sandbox(tmp, mode="group")
    alerts_captured()
    check("a correct value is left alone", mod.restore_group_view() is False)

with tempfile.TemporaryDirectory() as tmp:
    work, personal = sandbox(tmp, mode="directory")
    alerts_captured()
    check("a clamped value is corrected", mod.restore_group_view() is True)
    check("both accounts are corrected",
          mode_of(work) == "group" and mode_of(personal) == "group")
    check("other settings survive the rewrite", json.load(open(work)).get("keep") == "me")

with tempfile.TemporaryDirectory() as tmp:
    work, _ = sandbox(tmp, mode="state")
    alerts_captured()
    open(mod.NOHEAL, "w").close()
    check("the opt-out file stops the heal",
          mod.restore_group_view() is False and mode_of(work) == "state")
    os.remove(mod.NOHEAL)
    check("removing the opt-out file resumes it",
          mod.restore_group_view() is True and mode_of(work) == "group")

# The heal has to survive a config file that is missing or unreadable — both
# accounts do not always exist, and .claude.json is written live.
with tempfile.TemporaryDirectory() as tmp:
    work, _ = sandbox(tmp, mode="directory")
    alerts_captured()
    mod.CONFIGS = [work, os.path.join(tmp, "does-not-exist.json")]
    check("a missing config is skipped, not fatal",
          mod.restore_group_view() is True and mode_of(work) == "group")

with tempfile.TemporaryDirectory() as tmp:
    work, personal = sandbox(tmp, mode="directory")
    alerts_captured()
    with open(work, "w") as fh:
        fh.write("{ this is not json")
    # `.claude.json` is written live, so a read can land mid-write. That must not
    # abort the run, and it must not clobber the file with a rewrite either.
    check("a half-written config does not stop the other account",
          mod.restore_group_view() is True and mode_of(personal) == "group")
    check("a half-written config is left untouched",
          open(work).read() == "{ this is not json")

# ------------------------------------------------------- the fight counter

print("the fight counter")
with tempfile.TemporaryDirectory() as tmp:
    work, _ = sandbox(tmp, mode="group")
    seen = alerts_captured()
    mod.heal_view()
    check("a clean run records no heals", mod.read_stamp().get("heals") in (0, None))
    check("a clean run does not warn", seen == [])

with tempfile.TemporaryDirectory() as tmp:
    work, _ = sandbox(tmp, mode="group")
    seen = alerts_captured()
    for i in range(1, mod.FIGHT_AFTER + 1):
        json.dump({"fleetViewGroupMode": "directory"}, open(work, "w"))
        mod.heal_view()
        check(f"heal {i} of {mod.FIGHT_AFTER} counted", mod.read_stamp().get("heals") == i)
    check("a repeated fight warns once", len(seen) == 1, repr(seen))
    check("the warning says what to do", "quit" in seen[0] and "ctrl+s" in seen[0])

    json.dump({"fleetViewGroupMode": "directory"}, open(work, "w"))
    mod.heal_view()
    check("the warning does not repeat every tick", len(seen) == 1)

    mod.heal_view()  # nothing to correct now
    check("a clean run clears the counter", mod.read_stamp().get("heals") == 0)

    json.dump({"fleetViewGroupMode": "directory"}, open(work, "w"))
    mod.heal_view()
    check("the counter restarts after a clean run", mod.read_stamp().get("heals") == 1)

with tempfile.TemporaryDirectory() as tmp:
    work, _ = sandbox(tmp, mode="directory")
    alerts_captured()
    mod.STAMP = os.path.join(tmp, "stamp.json")
    with open(mod.STAMP, "w") as fh:
        fh.write("not json either")
    mod.heal_view()
    check("an unreadable stamp does not stop the heal", mode_of(work) == "group")

# The patch stamp and the fight counter share one file; neither may erase the
# other, or an update would look unpatched (or a fight would reset every tick).
with tempfile.TemporaryDirectory() as tmp:
    sandbox(tmp, mode="directory")
    alerts_captured()
    mod.heal_view()
    binary = os.path.join(tmp, "fake-binary")
    with open(binary, "w") as fh:
        fh.write("x")
    mod.write_stamp(binary)
    stamp = mod.read_stamp()
    check("writing the patch stamp keeps the fight counter", stamp.get("heals") == 1)
    check("writing the patch stamp records the fingerprint",
          stamp.get("fingerprint") == mod.fingerprint(binary) and stamp.get("patched") is True)

# ---------------------------------------------------------- finding the gate

print("finding the gate")


def gate_in(tmp, blob, name="bundle"):
    p = os.path.join(tmp, name)
    with open(p, "wb") as fh:
        fh.write(blob)
    return mod.find_gate(p)


# A minimal stand-in for the real thing: the `capExpanded` destructure, the gate
# declared `=!1`, and the same name read back as `groupsEnabled:`.
def bundle(gate="F", value=b"1", pad=b"\x00" * 64):
    return (
        b"...capExpanded:aa}=hk(M)," + gate.encode() + b"=!" + value + b","
        b"[S]=R.useState(()=>mk(host," + gate.encode() + b"))"
        + pad + b"attachView({groupsEnabled:" + gate.encode() + b"})"
    )


with tempfile.TemporaryDirectory() as tmp:
    offset, value = gate_in(tmp, bundle())
    check("a locked gate is found", offset is not None, repr(value))
    check("the offset points at the flag digit", value == "1")
    blob = bundle()
    check("the offset is the byte to flip", blob[offset:offset + 1] == b"1", repr(offset))

    offset, value = gate_in(tmp, bundle(value=b"0"), name="unlocked")
    check("an already-unlocked gate reads back as 0", value == "0")

    # Only the code shape is present: no `groupsEnabled:` read anywhere.
    shape_only = bundle().split(b"attachView")[0]
    offset, value = gate_in(tmp, shape_only, name="shape-only")
    check("the code shape alone is enough", offset is not None, repr(value))

    # Only the property read is present, with a declaration beside it.
    prop_only = b"var G=!1;" + b"\x00" * 32 + b"attachView({groupsEnabled:G})"
    offset, value = gate_in(tmp, prop_only, name="prop-only")
    check("the property name alone is enough", offset is not None, repr(value))

    # Neither anchor. Must refuse rather than guess — this is the case that
    # raises a notification instead of writing a byte.
    offset, reason = gate_in(tmp, b"nothing recognisable here at all", name="neither")
    check("an unrecognisable build is refused", offset is None)
    check("and says why", reason == "gate not found", repr(reason))

    # Two different candidates. Ambiguity must never be resolved by picking one.
    two = b"var A=!1;" + b"\x00" * 8 + b"attachView({groupsEnabled:A})" + b"\x00" * 8 + \
          b"var B=!1;" + b"\x00" * 8 + b"attachView({groupsEnabled:B})"
    offset, reason = gate_in(tmp, two, name="ambiguous")
    check("two candidates are refused", offset is None, repr(reason))

# ---------------------------------------------------------------- the plist

print("the launch agent")
plist = os.path.join(HERE, "com.kbtg.pp-claude-tags.plist")
text = open(plist).read()
check("the plist watches the versions directory", "/.local/share/claude/versions" in text)
check("the plist runs the installed launcher", "/.local/bin/pp-claude-tags" in text)
# The interval bounds how long the wrong grouping can show. Ten minutes was the
# whole visible symptom on 2026-08-26.
import re
interval = re.search(r"StartInterval</key>\s*<integer>(\d+)</integer>", text)
check("the tick interval is at most 2 minutes",
      interval is not None and int(interval.group(1)) <= 120,
      interval.group(1) if interval else "missing")

print()
if FAILS:
    print(f"FAILED: {len(FAILS)}")
    for f in FAILS:
        print("  - " + f)
    sys.exit(1)
print("all checks passed")
