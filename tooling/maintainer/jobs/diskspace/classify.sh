#!/bin/bash
# The safety rule of the diskspace job, in ONE place. Sourced by check.sh (to
# report) and by fix.sh (to refuse). Two copies of this would mean one of them
# is wrong the first time either is edited.
#
# It is an ALLOWLIST of what may go, never a denylist of what may not.
# The gitignored list holds .dev.vars, .mcp.json, seed.sql and every
# owner-recorded screen capture under videos/*/src/. None of them has a copy in
# git. A path this function does not recognise is UNCLASSIFIED, which fix.sh
# refuses. Silence is not permission.

classify() {
  case "$1" in
    # --- KEEP: named first so no pattern below can ever claim them -----------
    *videos/*/src|*videos/*/src/)                        echo KEEP ;;
    *videos/*/screen.mp4|*videos/*/*.full.mp4)           echo KEEP ;;
    *videos/*/vo.mp3|*videos/*/intro-vo.mp3)             echo KEEP ;;
    *videos/*/avatar.mp4|*videos/*/stand-in-avatar.mp4)  echo KEEP ;;
    *.dev.vars|*.mcp.json|*.env|*.env.*)                 echo KEEP ;;
    *settings.local.json*|*config.json|*seed.sql)        echo KEEP ;;
    *references/*.wav|*characters/*)                     echo KEEP ;;

    # --- CACHE: reappears by itself on the next run --------------------------
    */assembly-cache|*/assembly-cache/)                  echo CACHE ;;
    */render-cache|*/render-cache/)                      echo CACHE ;;
    */assembly-tmp|*/assembly-tmp/)                      echo CACHE ;;
    */.test-tmp|*/.test-tmp/)                            echo CACHE ;;
    */.posters|*/.posters/|*/checks|*/checks/)           echo CACHE ;;
    */.wrangler|*/.wrangler/|*/dist|*/dist/)             echo CACHE ;;
    */__pycache__|*/__pycache__/|*.tsbuildinfo)          echo CACHE ;;
    */.pytest_cache*|*/.ruff_cache*|*/.mypy_cache*)      echo CACHE ;;
    */.turbo*|*/.next*|*/.parcel-cache*|*/.vite*)        echo CACHE ;;

    # --- REBUILD: one documented command brings it back ----------------------
    */node_modules|*/node_modules/)                      echo REBUILD ;;
    */.venv|*/.venv/|*/venv|*/venv/)                     echo REBUILD ;;
    */checkpoints|*/checkpoints/|*/hf_cache*)            echo REBUILD ;;
    */models|*/models/)                                  echo REBUILD ;;

    # --- DERIVED: a pipeline re-run, which costs time or money ---------------
    */renders|*/renders/|*/renders.run*)                 echo DERIVED ;;
    */renders-fx|*/renders-fx/|*/renders-fx.run*)        echo DERIVED ;;
    */slices|*/slices/|*/slices-avatar|*/slices-avatar/) echo DERIVED ;;
    *videos/*/master.wav|*videos/*/sfx-bus.wav)          echo DERIVED ;;
    *videos/*/music-ducked.wav|*videos/*/versions.run*)  echo DERIVED ;;
    */card-images*|*/feedback-images*)                   echo DERIVED ;;
    */output|*/output/|*/work|*/work/)                   echo DERIVED ;;

    *)                                                   echo UNCLASSIFIED ;;
  esac
}

# The command that brings a REBUILD path back. Quoted verbatim in the proposal
# so the owner approves a reversible act and not a hopeful one.
rebuild_cmd() {
  case "$1" in
    */node_modules*)   echo "npm install   (in $(dirname "$1"))" ;;
    */.venv*|*/venv*)  echo "uv sync   (in $(dirname "$1"))" ;;
    */checkpoints*)    echo "huggingface-cli download IndexTeam/IndexTTS-2 --local-dir $1" ;;
    */hf_cache*)       echo "re-downloads itself on the next model load" ;;
    */models*)         echo "see the engine's README for its model fetch step" ;;
    *)                 echo "UNKNOWN — do not approve until this is filled in" ;;
  esac
}
