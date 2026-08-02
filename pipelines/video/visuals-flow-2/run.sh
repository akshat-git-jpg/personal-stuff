#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Do NOT add an --all or all step. The chain has three human gates
# (037 card plan, 080 storyboard, 120 final cut), an Opus-only fold at 130,
# and live HeyGen at 100, and a driver that walks past them would be
# actively dangerous. The ONLY sanctioned bypass is the owner's own kickoff
# choice recorded by `configure` (run-config review=express) — it waives the
# 037/080 board approvals, never the new-card look-preview or the 120 final
# cut, and a session still runs the steps one at a time.

usage() {
  cat <<EOF
Usage: run.sh <slug> <step>

Steps:
  status
  configure [--engine heygen3|heygen4] [--review full|express]
  transcribe
  segments
  concept-pass
  intro-film
  intro-review
  intro-render
  cue-pass
  validate
  resolve
  zone-pass
  stillness
  audit
  audit-gate
  card-plan
  outline
  board
  render
  fold
  sound
  mix
  shot-pass
  shots
  avatar
  avatar-download
  cut
  assemble
  deliver
  export
  qc
EOF
}

if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  usage
  exit 2
fi

# `configure` takes extra flags (--engine/--review); every other step is
# exactly two args.
if [[ $# -lt 2 ]] || { [[ "$2" != "configure" ]] && [[ $# -ne 2 ]]; }; then
  usage
  exit 2
fi

slug="$1"
step="$2"
shift 2

# Record a deterministic step into videos/<slug>/run-log.json as it runs, so the
# board's Run tab and `status` can say what happened without anyone reading the
# terminal. The `did`/`output` strings are fixed because a script does the same
# thing every time; `issues` is scraped from the step's own output, so a run that
# printed warnings never gets filed as clean.
#
# Ledger writes must never take a step down: every call is `|| true`.
record() {
  node lib/run-log.mjs "$slug" "$@" >/dev/null 2>&1 || true
}

# record_step <step-number> <did> <output> -- <command...>
record_step() {
  local num="$1" did="$2" out="$3"
  shift 3
  [[ "${1:-}" == "--" ]] && shift

  record "$num" running

  local logfile rc issues
  logfile="$(mktemp)"
  # tee keeps the output live in the terminal while capturing it; PIPESTATUS[0]
  # is the real exit code, which `set -o pipefail` alone would not give us here.
  set +e
  "$@" 2>&1 | tee "$logfile"
  rc="${PIPESTATUS[0]}"
  set -e

  # Whole lines only, capped per line and counted — the old pipe joined every
  # warning into one string and chopped it at 500 chars MID-WORD, so the board
  # showed "…between z03 (starts 33." and silently hid the rest (owner report
  # 2026-07-31). Now: first 8 warning lines (each trimmed to 220 chars), plus
  # an explicit "+N more" so truncation is visible instead of silent.
  local issue_total
  issue_total="$(grep -aciE '^[[:space:]]*(W[0-9]+|E[0-9]+|warn|warning|error)' "$logfile" || true)"
  # `|| true` is load-bearing: zero warning lines makes grep exit 1, and under
  # `set -euo pipefail` that killed record_step AFTER the step command had
  # succeeded — the ledger stayed "running" on a clean run (bitten 2026-07-31,
  # both 090 and 100 on opusclip-vs-submagic).
  issues="$(grep -aiE '^[[:space:]]*(W[0-9]+|E[0-9]+|warn|warning|error)' "$logfile" | head -8 | cut -c1-220 | paste -sd '|' - | sed 's/|/  |  /g' || true)"
  if [[ "${issue_total:-0}" -gt 8 ]]; then
    issues="$issues  |  (+$((issue_total - 8)) more warning/error lines — re-run the verb to see all)"
  fi
  if [[ "$rc" -eq 0 ]]; then
    if [[ -n "$issues" ]]; then
      record "$num" done --did "$did" --output "$out" --issues "$issues"
    else
      record "$num" done --did "$did" --output "$out"
    fi
  else
    record "$num" blocked --issues "${issues:-exited $rc, see terminal}"
  fi
  rm -f "$logfile"
  return "$rc"
}

case "$step" in
  status)
    if [[ ! -d "videos/$slug" ]]; then
      echo "no workdir: videos/$slug"
      exit 1
    fi
    
    transcript_present="missing"
    [[ -f "videos/$slug/transcript.json" ]] && transcript_present="present"
    
    segments_present="missing"
    [[ -f "videos/$slug/segments.json" ]] && segments_present="present"
    
    cues_present="missing"
    cues_approved="NOT approved"
    if [[ -f "videos/$slug/cues.json" ]]; then
      cues_present="present"
      cues_approved=$(node -e "const c=require('./videos/$slug/cues.json');console.log(c.approved?'approved':'NOT approved')")
    fi
    
    resolved_present="missing"
    [[ -f "videos/$slug/resolved.json" ]] && resolved_present="present"
    
    card_plan_present="missing"
    card_plan_approved="NOT approved"
    if [[ -f "videos/$slug/card-plan.json" ]]; then
      card_plan_present="present"
      card_plan_approved=$(node -e "const z=require('./videos/$slug/card-plan.json');console.log(z.approved?'approved':'NOT approved')")
    fi
    
    renders_present="missing"
    [[ -d "videos/$slug/renders/" ]] && renders_present="present"
    
    shots_present="missing"
    shots_approved="NOT approved"
    if [[ -f "videos/$slug/shots.json" ]]; then
      shots_present="present"
      shots_approved=$(node -e "const s=require('./videos/$slug/shots.json');console.log(s.approved?'approved':'NOT approved')")
    fi

    # Kickoff config (step 005): engine + review mode. Express waives the 037
    # and 080 board gates in the next-hints below — the artifact table still
    # shows the raw approved flags.
    run_engine="heygen3"; run_review="full"
    if [[ -f "videos/$slug/run-config.json" ]]; then
      run_engine=$(node -e "console.log(require('./videos/$slug/run-config.json').engine||'heygen3')")
      run_review=$(node -e "console.log(require('./videos/$slug/run-config.json').review||'full')")
    fi
    if [[ "$run_review" == "express" ]]; then
      card_plan_gate="approved"; cues_gate="approved"; shots_gate="approved"
    else
      card_plan_gate="$card_plan_approved"; cues_gate="$cues_approved"; shots_gate="$shots_approved"
    fi

    # The ledger first: what each step did, from run-log.json. Steps with no
    # entry fall back to probing the artifacts and are labelled as inferred, so
    # a video that ran before the ledger existed still reads correctly.
    # The board's Run tab renders this same view — one source, no disagreement.
    node lib/run-log.mjs "$slug"
    echo

    echo "run-config        engine=$run_engine review=$run_review"
    echo "artifact          status"
    echo "--------          ------"
    echo "transcript.json   $transcript_present"
    echo "segments.json     $segments_present"
    echo "cues.json         $cues_present ($cues_approved)"
    echo "resolved.json     $resolved_present"
    echo "card-plan.json    $card_plan_present ($card_plan_approved)"
    echo "renders/          $renders_present"
    echo "shots.json        $shots_present ($shots_approved)"

    # Order follows the 2026-07-25 review model (decisions.md): shot-pass runs
    # BEFORE the storyboard gate, and that single gate approves cues AND shots.
    # Nothing renders until both are approved.
    if [[ "$transcript_present" == "missing" ]]; then
      echo "next: run.sh $slug transcribe"
    elif [[ "$segments_present" == "missing" ]]; then
      echo "next: run.sh $slug segments  (then set confirmed: true in segments.json)"
    elif [[ "$cues_present" == "missing" ]]; then
      echo "next: run.sh $slug cue-pass"
    elif [[ "$card_plan_gate" == "NOT approved" ]]; then
      echo "next: run.sh $slug validate, then outline + board  (HUMAN GATE 1 — 037 card plan)"
    elif [[ "$resolved_present" == "missing" ]]; then
      echo "next: run.sh $slug resolve  (build any NEW cards at step 038 first)"
    elif [[ "$shots_present" == "missing" ]]; then
      echo "next: run.sh $slug shot-pass  (before the storyboard gate)"
    elif [[ "$cues_gate" == "NOT approved" || "$shots_gate" == "NOT approved" ]]; then
      echo "next: run.sh $slug board  (HUMAN GATE 2 — 080 storyboard: approve cues AND shots)"
    elif [[ "$renders_present" == "missing" ]]; then
      echo "next: run.sh $slug render"
    else
      echo "next: run.sh $slug cut  (then HUMAN GATE 3 — 120 final cut)"
    fi
    ;;

  transcribe)
    record_step 010 "Transcribed the voiceover to word-level timestamps and ran the quality pass." \
      "transcript.json" -- bash steps/010-transcribe-run/run.sh "$slug"
    ;;

  configure)
    # Step 005 — the owner's kickoff choices for this video: which HeyGen
    # engine (heygen3 free | heygen4 metered) and how much they review along
    # the way (full = every gate | express = straight to final cut). See
    # steps/005-configure-run-human/README.md — express NEVER skips the
    # new-card look-preview or the 120 final-cut review.
    node lib/run-config.mjs "$slug" "$@"
    ;;

  segments)
    # Writes segments.json INCLUDING the measured intro/body/conclusion spans
    # (`structure`), read from src/. Without those the zone pass at 035 has
    # nothing to author against. Set `confirmed: true` in the file afterwards.
    record_step 015 "Measured the intro/body/conclusion spans from src/ and proposed the demo vs narration split." \
      "segments.json (still needs confirmed: true)" -- node lib/segments.mjs "$slug" --propose
    ;;

  concept-pass)
    record 020 running
    cat <<EOF
020 is an LLM step, not a command. Assemble the prompt:
  1. steps/020-choose-concept-llm/concept-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. cat videos/$slug/segments.json             -> {{SEGMENTS}}
After the concept pass: node lib/lint-concept.mjs $slug
EOF
    exit 0
    ;;

  intro-film|intro-review|intro-render)
    intro_mode=$(node -e "import('./lib/run-config.mjs').then(m=>console.log(m.loadRunConfig('videos/$slug').intro))")
    if [[ "$intro_mode" != "film" ]]; then
      echo "intro=$intro_mode — this video does not use the bespoke intro film."
      echo "Opt in with: bash run.sh $slug configure --intro film"
      exit 1
    fi
    if [[ "$step" == "intro-film" ]]; then
      cat steps/025-author-intro-film-llm/AUTHORING.md | sed "s/<slug>/$slug/g"
      exit 0
    elif [[ "$step" == "intro-review" ]]; then
      node lib/intro-film/review-film.mjs "$slug"
      exit 0
    elif [[ "$step" == "intro-render" ]]; then
      node lib/intro-film/film-gate.mjs "$slug"
      exit 0
    fi
    ;;

  cue-pass)
    record 030 running
    cat <<EOF
030 is an LLM step, not a command. It authors the BODY only.
Assemble the prompt:
  1. steps/030-pick-or-propose-graphics-llm/cue-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs $slug           -> {{SKELETON}}
  3. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
  5. videos/$slug/concept.json                  -> {{CONCEPT}}
Pre-flight: node lib/feedback-status.mjs and node lib/lint-concept.mjs $slug must exit 0.
The intro and conclusion are authored separately: run.sh $slug zone-pass
After both passes: run.sh $slug validate, then card-plan (HUMAN GATE 1 at 037)
EOF
    exit 0
    ;;

  zone-pass)
    record 035 running
    cat <<EOF
035 is an LLM step, not a command. It authors the INTRO and CONCLUSION only,
against their own rulebook (lib/zone-rules.mjs + lib/zone-constants.mjs).
Assemble the prompt:
  1. steps/035-pick-or-propose-intro-outro-llm/zone-pass-prompt.md  (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. ../card-library/catalog.json                -> {{CATALOG}}
  4. the "structure" array in videos/$slug/segments.json -> {{STRUCTURE}}
Pre-flight: node lib/feedback-status.mjs must exit 0, and segments.json must
carry a "structure" block (no measured zones = nothing for this step to do).
Every cue it emits must carry a "zone" field of "intro" or "conclusion".
After the zone pass: run.sh $slug validate, then card-plan (HUMAN GATE 1 at 037).
Stillness (W18) needs absolute times, so it runs after 040: node lib/stillness.mjs $slug
EOF
    exit 0
    ;;

  validate)
    # Pre-037: everything checkable before the cards exist. Writes nothing.
    node lib/resolve.mjs "$slug" --validate-only
    ;;

  resolve)
    # Kept as a function so the command reads literally, both here and to the
    # grep in scripts/test-run-sh.sh that pins it.
    do_resolve() { node lib/resolve.mjs "$slug" && node lib/lint-cues.mjs "$slug"; }
    record_step 040 "Resolved every cue anchor to an absolute time, merged card variables, and ran the cue lint." \
      "resolved.json" -- do_resolve
    ;;

  stillness)
    node lib/stillness.mjs "$slug"
    ;;

  audit)
    record 050 running
    cat <<EOF
050 is an LLM step, not a command. Assemble the prompt:
  1. steps/050-review-graphics-llm/audit-prompt.md     (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. cat videos/$slug/resolved.json             -> {{CUES}}
  4. node -e "const c=require('../card-library/catalog.json'); c.cards.forEach(card => console.log(card.slug + ': ' + card.purpose));" -> {{CATALOG_PURPOSES}}
  5. node -e "const c=require('../card-library/catalog.json'); c.cards.forEach(card => console.log(card.slug));" -> {{CATALOG_SLUGS}}
After the audit pass: run.sh $slug audit-gate
EOF
    exit 0
    ;;

  audit-gate)
    node lib/audit-gate.mjs "$slug"
    ;;

  card-plan)
    node lib/card-plan.mjs "$slug"
    ;;

  outline)
    node lib/card-plan.mjs "$slug" --outline
    ;;

  board)
    bash steps/080-approve-storyboard-human/run.sh "$slug"
    ;;

  render)
    record_step 090 "Rendered every approved cue to a clip and wrote the editor manifest." \
      "renders/ + manifest.md" -- bash steps/090-render-graphics-run/run.sh "$slug"
    ;;

  fold)
    record 130 running
    node lib/feedback-status.mjs
    echo "130 is an Opus-class step. Proceed manually."
    exit 0
    ;;

  sound)
    node lib/sound/sfx-plan.mjs "$slug"
    ;;

  mix)
    node lib/sound/build-mix.mjs "$slug"
    ;;

  shot-pass)
    record 060 running
    cat <<EOF
060 is an LLM step, not a command. Assemble the prompt:
  1. steps/060-place-avatar-llm/shot-pass-prompt.md (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs $slug           -> {{SKELETON}}
  3. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
Pre-flight: node lib/feedback-status.mjs must exit 0.
After the shot pass: run.sh $slug shots
EOF
    exit 0
    ;;

  shots)
    node lib/resolve-shots.mjs "$slug" && node lib/lint-shots.mjs "$slug"
    ;;

  avatar)
    # --submit is mandatory: avatar-render.mjs exits with usage when called
    # bare, so the verb as previously written always failed (found 2026-07-31).
    # Download stays its own verb below.
    # --spans-only: the owner rejected the corner-bubble baseline on the first
    # assembled cut (2026-07-31) — only the planned host spans render now.
    record_step 100 "Submitted the HeyGen avatar clips for the approved shot spans." \
      "avatar-jobs.json + avatar clips in kb-scratch" -- bash steps/100-render-avatar-run/run.sh "$slug" --submit --spans-only --template "${AVATAR_TEMPLATE:-specs-man}"
    ;;

  cut)
    # exit-code check, NOT string compare — captured stdout can carry ANSI color
    # codes (rtk hook / forced-color node), which broke `!= "true"` (2026-07-24)
    if ! node -e "process.exit(require('./videos/$slug/cues.json').approved===true?0:1)" 2>/dev/null; then
      echo "approve the storyboard first"
      exit 1
    fi
    if [[ -f "videos/$slug/shots.json" ]] && [[ ! -f "videos/$slug/avatar-jobs.json" ]]; then
      echo "shots approved but avatars not rendered — cutting without avatar"
    fi
    echo "Running cut..."
    # Graphics render FIRST, on purpose. If avatar jobs are already submitted,
    # HeyGen is rendering them server-side this whole time, so the local CPU
    # work and the remote wait overlap instead of running one after the other.
    # Submitting stays an explicit owner action (`run.sh <slug> avatar --submit`);
    # this only stops you idling while it happens.
    record_step 090 "Rendered every approved cue to a clip and wrote the editor manifest." \
      "renders/ + manifest.md" -- bash steps/090-render-graphics-run/run.sh "$slug" \
      || { echo "render failed"; exit 1; }
    node lib/effects-plan.mjs "$slug" || { echo "effects-plan failed"; exit 1; }
    node lib/sound/sfx-plan.mjs "$slug" || { echo "sfx-plan failed"; exit 1; }
    node lib/sound/build-mix.mjs "$slug" || { echo "build-mix failed"; exit 1; }

    # Collect whatever HeyGen finished while the graphics were rendering.
    # Downloading is idempotent and free, so a re-run is always safe.
    if [[ -f "videos/$slug/avatar-jobs.json" ]]; then
      echo "collecting avatar clips (HeyGen rendered these while the graphics did)..."
      bash steps/100-render-avatar-run/run.sh "$slug" --download || \
        echo "warning: some avatar clips are still pending — re-run: run.sh $slug avatar-download"
    fi

    record_step 110 "Assembled the screen recording, graphics, avatar clips and mastered audio into a draft cut." \
      "final-draft.mp4 + assembly.md" -- bash steps/110-build-video-run/run.sh "$slug" --draft \
      || { echo "assemble failed"; exit 1; }
    echo "Final Cut URL: http://localhost:8080/ (or equivalent board URL) - Check the Final Cut tab!"
    ;;

  avatar-download)
    # Split out so the overlap is a named thing: submit, go do other work, then
    # collect. Safe to re-run until nothing is pending.
    record_step 100 "Downloaded the finished HeyGen avatar clips." \
      "avatar clips in kb-scratch + avatar-manifest.md" \
      -- bash steps/100-render-avatar-run/run.sh "$slug" --download
    ;;

  assemble)
    record_step 110 "Assembled the screen recording, graphics, avatar clips and mastered audio into the cut." \
      "final.mp4 + assembly.md" -- bash steps/110-build-video-run/run.sh "$slug"
    ;;

  deliver)
    record_step 150 "Uploaded the approved full-resolution final to the video's Drive Output folder." \
      "Output/<slug>-final.mp4 on Drive" -- bash steps/150-deliver-drive-run/run.sh "$slug"
    ;;

  export)
    record_step 140 "Exported the layered timeline for DaVinci." \
      "FCPXML timeline" -- bash steps/140-davinci-export-run/run.sh "$slug"
    ;;

  qc)
    bash scripts/qc-video.sh "$slug"
    ;;

  *)
    echo "unknown step: $step"
    usage
    exit 2
    ;;
esac
