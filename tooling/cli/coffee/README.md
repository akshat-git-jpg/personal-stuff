# coffee

Keep the Mac awake with the lid shut, for a bounded time, so a long Claude Code
job survives the laptop going in a bag.

## Why this exists

macOS gives exactly one lever here: `sudo pmset -a disablesleep 1`. It works, and
that is the problem. It is a persistent global setting with no expiry. Flip it
once, forget it, and the machine never sleeps again — it cooks in a bag and
flattens its own battery.

The owner's actual worry was never "will it work". It was **"what if I forget to
turn it off"**.

So `coffee` inverts the default. Staying awake is not a setting you flip; it is a
**lease** that something alive has to keep holding. A background watchdog
re-asserts the correct power setting every 20 seconds, and `disablesleep 0` —
normal sleep — is what it asserts unless a valid, unexpired lease exists.

The watchdog deliberately **never reads the current power setting**. It only
writes. That removes a whole failure class: there is no parse that can go wrong
and leave the Mac awake by accident. Every path out of the decision that is not
"a clearly valid lease" ends in sleep being switched back on.

Concretely, there is no way to leave it on:

| Your worry | What actually happens |
|---|---|
| I forget to turn it off | The deadline passes and the watchdog turns it off. There is no "forever" option to pick. |
| It dies flat in my bag | Under 20% on battery, the lease is revoked immediately. |
| The watchdog crashes | `KeepAlive` restarts it in seconds, and its first act on start is to force sleep back on. |
| The Mac reboots while it is on | Same thing — a fresh watchdog forces sleep on before reading any state. |
| The state file gets corrupted | A lease that is not a plain number is not a lease. Revoked. |
| I ask for a silly duration | Over 4 hours is refused, not clamped. Clamping would quietly grant most of a bad request. |
| The watchdog is not installed | `coffee 90m` refuses outright rather than write a lease nobody enforces. |

## Contract

```
coffee <duration>   start or extend a lease   (90m, 2h, 1h30m, or bare minutes)
coffee off          end the lease now
coffee              show status
coffee -h           help

exit 0   ok
exit 2   usage error, unparseable duration, over the ceiling, or watchdog not loaded
```

The CLI only writes a deadline file. It never touches a power setting itself.

## The four safety nets

| Net | Trigger | What happens |
|---|---|---|
| Deadline | the lease time runs out (hard ceiling 4h) | sleep re-enabled, lease file deleted, Telegram ping |
| Battery floor | under 20% **while discharging** | same. On mains power a low battery is not a hazard, so the lease is held |
| Watchdog dies | process killed, crash, reboot | `KeepAlive` restarts it; it forces `disablesleep 0` before reading state |
| No valid lease | file missing, empty, non-numeric, or over the ceiling | sleep re-asserted every 20s regardless |

Every revoke sends a Telegram message via `../notify`, so you learn the job is no
longer protected without having to check.

## Install (owner, once)

Three privileged steps. Run them from the repo root.

```sh
# 1. Symlink the watchdog into ~/.local/bin — the plist points there, not at the
#    repo, matching the bt-audio-guard pattern in MAC-LAUNCHD.md.
mkdir -p ~/.local/bin
ln -sfn "$PWD/tooling/cli/coffee/coffee-watchdog.sh" ~/.local/bin/coffee-watchdog.sh
ln -sfn "$PWD/tooling/cli/coffee/coffee"             ~/.local/bin/coffee

# 2. The scoped sudoers rule. Two exact command lines, nothing else.
sudo install -m 0440 -o root -g wheel \
  tooling/cli/coffee/sudoers.d-coffee.example /etc/sudoers.d/coffee
sudo visudo -c                      # must print "parsed OK"

# 3. Install and load the watchdog.
cp tooling/cli/coffee/com.kbtg.coffee-watchdog.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.kbtg.coffee-watchdog.plist

# Verify — one line with a PID, and coffee reporting OFF.
launchctl list | grep coffee-watchdog
coffee
```

**Smoke test, once, with a human and a lid.** No automated test can prove macOS
actually stays awake with the lid physically shut, so do this once:

```sh
coffee 5m
# shut the lid, wait 2 minutes, open it — the session should still be running
coffee            # should still say ON
# wait for the 5 minutes to elapse
coffee            # should say OFF, and your phone should have a ping
```

## Logs

| What | Where |
|---|---|
| Lease grants and revokes | `~/Library/Logs/coffee.log` |
| Watchdog crashes | `/tmp/coffee-watchdog.err` |
| Current lease state | `~/.local/state/coffee/deadline` (epoch seconds; absent = off) |

## Testing

```sh
bash tooling/cli/coffee/test-coffee.sh     # 21 cases, exit 0, prints ALL PASS
```

The suite injects fake `pmset`, `sudo`, `notify` and `launchctl` binaries and a
temp state dir, so **it never touches a real power setting** and runs safely
anywhere with no privileges. Nine cases cover the watchdog's decision table,
twelve cover the CLI.

The three load-bearing assertions were mutation-tested at build time: breaking
the battery floor, skipping the no-lease assert, and clamping instead of refusing
an over-ceiling lease each turn the suite red.

## Gotchas

- **Bash 3.2 only.** macOS ships GNU bash 3.2.57 as `/bin/bash`. No associative
  arrays, no `${var,,}`, no `mapfile`. Shebangs are `#!/bin/bash`, not `env bash`.
- **`notify` is not on `PATH` under launchd.** The watchdog calls it by absolute
  path, overridable with `COFFEE_NOTIFY`.
- **The watchdog never reads the current `pmset` value** — that is deliberate, not
  an oversight. See "Why this exists".
- **The sudoers rule matches arguments literally.** If the `pmset` path or flag
  order ever changes, the rule silently stops matching and the watchdog can no
  longer revoke — which fails toward "stuck awake". Re-run the smoke test after
  any macOS upgrade.
- **macOS only.** The repo's other operator is on Windows; this tool is a
  deliberate exception and does not pretend to be portable.
