---
name: coffee
description: Keep the Mac awake with the lid shut for a bounded time (max 4h) so a long job survives the laptop going in a bag; a watchdog turns sleep back on when the lease ends or the battery drops under 20%. Triggers on "keep the mac awake", "don't let it sleep", "I'm closing the lid", "putting the laptop in my bag", "coffee 2h", "stop coffee".
---

# coffee

```
CLI: tooling/cli/coffee/coffee      (README: tooling/cli/coffee/README.md)
```

## Commands

```bash
coffee 90m      # start or extend a lease (90m, 2h, 1h30m, bare minutes); max 4h
coffee          # status
coffee off      # end it now
```

## Rules

- Pick the duration from the job: its expected run time plus about 15 minutes. Over 4h is refused, not clamped; say so and offer 4h.
- Exit 2 with "watchdog not loaded" = the one-time install in the README was not done. Point the owner at it; never run the `sudo` steps yourself.
- Run `coffee off` when the job you started it for finishes.
- macOS only. Not for the Windows machine.
