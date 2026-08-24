#!/bin/zsh
# Keep Bluetooth earbuds on the wideband A2DP music link (44.1kHz) WITHOUT breaking
# calls that legitimately need the headset mic.
#
# ---------------------------------------------------------------------------
# The physics (why "fix both" cannot mean "force A2DP always")
#
#   A2DP : stereo, 44.1kHz, OUTPUT ONLY. No microphone. Correct for music/video.
#   HFP  : mono, 16kHz, bidirectional. Microphone works. Correct for calls.
#
# A Bluetooth headset can be in exactly one of these at a time. That is the
# Bluetooth spec, not a macOS bug. So the goal is not "always A2DP" -- it is
# "the right mode for what you are actually doing".
#
# ---------------------------------------------------------------------------
# The bug this fixes, precisely
#
# On every RECONNECT, macOS re-selects the headset mic as default input even
# though nothing asked for a mic. That silently pins the link to 16kHz HFP, so
# music breaks up. That is the thing worth correcting.
#
# v1 of this script policed the state continuously and forced input off the
# headset every 2s. That also fired mid-call, tearing down HFP while Meet was
# using it, which made Chrome lose its output device and fall back to the
# laptop speakers. Continuous policing is the wrong model.
#
# v2 triggers on CONNECTION EVENTS only: when a Bluetooth output device newly
# appears, correct the input once (over a short settle window, because macOS
# re-grabs it a beat after connecting), then stand down completely until the
# next connection. A call that grabs the mic later is left alone.
#
# Kill switch:  touch ~/.bt-audio-guard-off   (undo: rm ~/.bt-audio-guard-off)
# Run once:     bt-audio-guard.sh --once
# ---------------------------------------------------------------------------

zmodload zsh/datetime   # provides $EPOCHSECONDS without forking date(1)

SAS=${BT_GUARD_SAS:-/opt/homebrew/bin/SwitchAudioSource}   # overridable for tests
POLL=${BT_GUARD_POLL:-3}
SETTLE_WINDOW=15          # seconds after a connection during which we correct
LOG="$HOME/Library/Logs/bt-audio-guard.log"
BUILTIN_DEFAULT="MacBook Pro Microphone"

mkdir -p "$(dirname "$LOG")"

_log() {
  # keep the file small; no logrotate dependency
  if [[ -f "$LOG" ]] && (( $(stat -f%z "$LOG" 2>/dev/null || echo 0) > 200000 )); then
    tail -200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
  print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

# Physical Bluetooth/USB headsets, excluding built-ins and virtual drivers.
_external_outputs() {
  "$SAS" -a -t output 2>/dev/null | grep -vE '^(MacBook Pro Speakers|ZoomAudioDevice)$' \
    | grep -viE 'aggregate|multi-output|blackhole|loopback|soundflower'
}

_resolve_builtin_mic() {
  local exclude="$1" mic
  if "$SAS" -a -t input 2>/dev/null | grep -qxF "$BUILTIN_DEFAULT"; then
    print -r -- "$BUILTIN_DEFAULT"; return 0
  fi
  mic=$("$SAS" -a -t input 2>/dev/null | grep -F "Microphone" | grep -vxF "$exclude" | head -1)
  [[ -n "$mic" ]] && print -r -- "$mic"
}

# Correct the input IF the headset is currently serving as both input and output.
_correct_once() {
  [[ -f "$HOME/.bt-audio-guard-off" ]] && return 0

  local in out mic
  in=$("$SAS" -c -t input 2>/dev/null)   || return 0
  out=$("$SAS" -c -t output 2>/dev/null) || return 0

  # The bad state is one device doing both jobs.
  [[ "$in" == "$out" ]] || return 0

  # Never touch the built-in mic or a virtual driver.
  case "$in" in
    *Microphone|ZoomAudioDevice|*Aggregate*|*Multi-Output*|*BlackHole*|*Loopback*) return 0 ;;
  esac

  mic=$(_resolve_builtin_mic "$in")
  [[ -n "$mic" ]] || return 0

  if "$SAS" -t input -s "$mic" >/dev/null 2>&1; then
    _log "corrected: input '$in' -> '$mic' (output '$out' can now use A2DP)"
  fi
}

if [[ "$1" == "--once" ]]; then
  _correct_once
  exit 0
fi

[[ -x "$SAS" ]] || exit 0

_log "watcher started (pid $$, poll ${POLL}s, settle ${SETTLE_WINDOW}s)"
trap '_log "watcher stopped"; exit 0' TERM INT

known=$(_external_outputs)
settle_until=0

while true; do
  current=$(_external_outputs)

  # Pure-zsh set difference: no subshells, no external processes per cycle.
  cur_arr=(${(f)current})
  known_arr=(${(f)known})
  arrived=(${cur_arr:|known_arr})
  departed=(${known_arr:|cur_arr})

  if (( ${#arrived} )); then
    _log "connected: ${(j:, :)arrived} -- correcting for ${SETTLE_WINDOW}s"
    settle_until=$(( EPOCHSECONDS + SETTLE_WINDOW ))
  fi
  (( ${#departed} )) && _log "disconnected: ${(j:, :)departed}"

  known="$current"

  # Only act inside the settle window. Outside it, a headset mic in use is a
  # deliberate call -- leave it completely alone.
  if (( EPOCHSECONDS < settle_until )); then
    _correct_once
  fi

  sleep "$POLL"
done
