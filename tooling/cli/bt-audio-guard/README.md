# bt-audio-guard

Stops Bluetooth earbuds sounding like a bad phone call, without breaking calls that
genuinely need the earbud mic.

Registered in [`MAC-LAUNCHD.md`](../../../MAC-LAUNCHD.md) with the repo's other launchd jobs.

## The problem

A Bluetooth headset can be in exactly one of two modes at a time. That is the Bluetooth
spec, not a macOS bug:

| Mode | Sound | Mic |
|---|---|---|
| **A2DP** | stereo, 44.1 kHz — correct for music and video | none |
| **HFP** | mono, 16 kHz — correct for calls | works |

On every reconnect, macOS re-selects the headset **mic** as the default input. That drags
the link into HFP, and music suddenly sounds thin and broken.

So "fix it" can never mean "force A2DP always" — that would kill the mic on calls. It means
*be in the right mode for the activity*. That constraint is load-bearing for any change here.

## What it does

Polls every 3 seconds. When the earbuds connect, it waits 15 seconds for things to settle,
then switches the **input** back to the MacBook microphone — leaving the earbuds as output
only, free to use A2DP.

Diagnose by hand: read the output device's `Current SampleRate` in
`system_profiler SPAudioDataType`. **16000 means broken, 44100 means correct.**

## Commands

Defined as shell functions in `~/.zshrc`, not here:

```sh
btguard              # status: active/paused, process running or not
btguard off          # pause it — do this when you WANT the earbud mic
btguard on           # resume
btguard log          # last 20 lines
btguard restart
fixaudio             # force one correction now
```

`btguard off` works by touching `~/.bt-audio-guard-off`, which the watcher checks each poll.

## Install

The script is **symlinked** into `~/.local/bin/`, not copied — the plist and both zsh
functions point at that path, so a symlink keeps them working while the real file stays in
git. Full steps in [`MAC-LAUNCHD.md`](../../../MAC-LAUNCHD.md).

## History

Installed 2026-07-31. **v1 was wrong in an instructive way:** it policed the state every 2
seconds and forced input off the headset unconditionally, including mid-call. That tore down
HFP while Google Meet was using it, Meet lost its output device, and Chrome fell over. Hence
the 15-second settle window and the pause switch — the guard must never fight a call that
legitimately wants the mic.

Moved into this repo on 2026-08-24. Before that its only copy was on the laptop, so a disk
failure would have lost it; the only record of its existence was a Claude memory note.
