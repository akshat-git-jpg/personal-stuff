#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Do NOT add an --all or all step. The chain has several human gates
# (120 intro idea, 150 intro film, 340 storyboard, 420 avatar spend, 530 final
# cut), an Opus-only fold at 630, and live HeyGen at 430, and a driver that
# walks past them would be actively dangerous. A session runs the steps one at
# a time.

# The verb list, the step folder names and the status next-hint all come from
# the registry (steps/*/step.json + steps/_verbs.json, read by lib/steps.mjs).
# They used to be hand-typed here, which meant renumbering a step silently
# broke this file. A NEW STEP ADDS NO CODE HERE — write its step.json.
usage() {
  echo "Usage: run.sh <slug> <step>"
  echo
  echo "Steps:"
  node lib/steps.mjs usage
}

# The step FOLDER for a number/verb/slug, e.g. step_slug 020 ->
# "020-transcribe-run". Every literal steps/<folder> path in this file used to
# be typed out, so a renumber broke the driver with nothing to catch it.
step_slug() { node lib/steps.mjs slug "$1"; }

if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  usage
  exit 2
fi

# `configure` takes extra flags (--intro/--drive-folder/--drive-account) and
# `status` takes --track; every other step is exactly two args.
if [[ $# -lt 2 ]] || { [[ "$2" != "configure" ]] && [[ "$2" != "status" ]] && [[ $# -ne 2 ]]; }; then
  usage
  exit 2
fi

slug="$1"
step="$2"
shift 2

# A verb the registry does not know never reaches the case below, so the two
# lists cannot drift into "declared but undispatchable" without the behaviour
# test (scripts/test-run-sh.sh) seeing it.
# Read into a variable first: a registry that fails to load must take the whole
# driver down with its E-REG message, not quietly turn every verb into
# "unknown step".
known_verbs="$(node lib/steps.mjs verbs)"
if ! grep -qxF -- "$step" <<<"$known_verbs"; then
  echo "unknown step: $step"
  node lib/steps.mjs suggest "$step" || true
  usage
  exit 2
fi

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

# VF_DRY_RUN=1 prints the command a verb WOULD run, one line per command, and
# exits 0 without running it. This is what lets scripts/test-run-sh.sh assert
# dispatch BEHAVIOUR instead of grepping this file's source text — the old
# grep-pins failed on any correct rename while catching nothing, and had already
# bent production code into "reading literally" for their benefit.
dry() {
  if [[ -n "${VF_DRY_RUN:-}" ]]; then
    local c
    for c in "$@"; do echo "DRY: $c"; done
    return 0
  fi
  return 1
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

    idea_present="missing"
    idea_approved="NOT approved"
    if [[ -f "videos/$slug/intro-film/idea.json" ]]; then
      idea_present="present"
      idea_approved=$(node -e "const i=require('./videos/$slug/intro-film/idea.json');console.log(i.approved?'approved':'NOT approved')")
    fi

    avatar_plan_present="missing"
    avatar_plan_approved="NOT approved"
    if [[ -f "videos/$slug/avatar-plan.json" ]]; then
      avatar_plan_present="present"
      avatar_plan_approved=$(node -e "const a=require('./videos/$slug/avatar-plan.json');console.log(a.approved?'approved':'NOT approved')")
    fi

    # The ledger first: what each step did, from run-log.json. Steps with no
    # entry fall back to probing the artifacts and are labelled as inferred, so
    # a video that ran before the ledger existed still reads correctly.
    # The board's Run tab renders this same view — one source, no disagreement.
    node lib/run-log.mjs "$slug"
    echo

    echo "artifact          status"
    echo "--------          ------"
    echo "transcript.json   $transcript_present"
    echo "segments.json     $segments_present"
    echo "intro idea        $idea_present ($idea_approved)"
    echo "cues.json         $cues_present ($cues_approved)"
    echo "resolved.json     $resolved_present"
    echo "card-plan.json    $card_plan_present ($card_plan_approved)"
    echo "renders/          $renders_present"
    echo "shots.json        $shots_present ($shots_approved)"
    echo "avatar-plan.json  $avatar_plan_present ($avatar_plan_approved)"

    intro_mode=$(node -e "import('./lib/intro-modes.mjs').then(m => console.log(m.introMode('videos/$slug')))")
    other_mode="complex"
    [[ "$intro_mode" == "complex" ]] && other_mode="simple"
    echo
    echo "intro flow: $intro_mode   (run.sh $slug configure --intro $other_mode to switch)"

    # The next-hint walks the registry (consumes/produces/gate/requires.intro)
    # rather than a fixed if/elif chain, and returns one step per track (the
    # intro film and the card plan share no artifact, so a gate on one must
    # not park the hint on the other — plan 199).
    #
    # `--track intro|main` narrows it to one lane. When the two tracks are run
    # as two sessions, each session should pass its own track: an unfiltered
    # hint tempts a session into running the OTHER track's next step, which is
    # how two sessions end up both writing cues.json.
    node lib/steps.mjs next "$slug" "$@"
    ;;

  transcribe)
    d="$(step_slug 020)"
    dry "record_step 020 -- bash steps/$d/run.sh $slug" && exit 0
    record_step 020 "Transcribed the voiceover to word-level timestamps and ran the quality pass." \
      "transcript.json" -- bash "steps/$d/run.sh" "$slug"
    ;;

  clean-transcript)
    d="$(step_slug 030)"
    dry "record_step 030 -- clean-transcript" && exit 0
    if [[ -f "videos/$slug/script.txt" ]]; then
      record_step 030 "Aligned transcript to script.txt" \
        "transcript.json + transcript.diff.json" \
        -- node lib/transcript-quality.mjs align "$slug"
    elif [[ -f "videos/$slug/transcript.cleaned.json" ]]; then
      do_clean() {
        node lib/transcript-quality.mjs apply "$slug" "videos/$slug/transcript.cleaned.json" && \
        node lib/transcript-suspect.mjs "$slug" && \
        node lib/transcript-second-opinion.mjs "$slug"
      }
      record_step 030 "Cleaned transcript with LLM pass" \
        "transcript.json + transcript.diff.json + transcript-suspects.json" \
        -- do_clean
    else
      cat "steps/$d/cleanup-prompt.md"
      echo
      echo "Feed the prompt to your LLM and save the output to videos/$slug/transcript.cleaned.json"
      echo "Then run this command again to apply it."
    fi
    ;;

  configure)
    # Step 010 — the owner's kickoff choices for this video: which INTRO FLOW
    # (`--intro simple|complex`, default simple — plan 218) and the Drive
    # delivery target. The HeyGen engine choice moved to the avatar spend gate
    # (420, plan 197). See steps/010-configure-run-human/README.md.
    dry "node lib/run-config.mjs $slug${*:+ $*}" && exit 0
    node lib/run-config.mjs "$slug" "$@"
    ;;

  segments)
    # Writes segments.json INCLUDING the measured intro/body/conclusion spans
    # (`structure`), read from src/. Without those the zone pass at 220 has
    # nothing to author against. Set `confirmed: true` in the file afterwards.
    dry "record_step 040 -- node lib/segments.mjs $slug --propose" && exit 0
    record_step 040 "Measured the intro/body/conclusion spans from src/ and proposed the demo vs narration split." \
      "segments.json (still needs confirmed: true)" -- node lib/segments.mjs "$slug" --propose
    ;;

  concept-pass)
    record 050 running
    cat <<EOF
050 is an LLM step, not a command. Assemble the prompt:
  1. steps/$(step_slug 050)/concept-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. cat videos/$slug/segments.json             -> {{SEGMENTS}}
After the concept pass: node lib/lint-concept.mjs $slug
EOF
    exit 0
    ;;

  intro-idea|intro-film|intro-review|intro-render)
    if [[ "$step" == "intro-idea" ]]; then
      # 110 — the idea pass. Prose only, and its own gate (120) before 130
      # writes a single beat. See steps/110-propose-intro-idea-llm/IDEA-PASS.md.
      d="$(step_slug 110)"
      dry "cat steps/$d/IDEA-PASS.md | sed s/<slug>/$slug/g" && exit 0
      cat "steps/$d/IDEA-PASS.md" | sed "s/<slug>/$slug/g"
      exit 0
    elif [[ "$step" == "intro-film" ]]; then
      d="$(step_slug 130)"
      dry "cat steps/$d/AUTHORING.md | sed s/<slug>/$slug/g" && exit 0
      cat "steps/$d/AUTHORING.md" | sed "s/<slug>/$slug/g"
      exit 0
    elif [[ "$step" == "intro-review" ]]; then
      dry "node lib/intro-film/review-film.mjs $slug" && exit 0
      node lib/intro-film/review-film.mjs "$slug"
      exit $?
    elif [[ "$step" == "intro-render" ]]; then
      # No approval check here on purpose. Rendering is how the owner GETS a
      # film to watch — gating it behind approval deadlocked the review (see
      # lib/intro-film/approve.mjs). Approval guards assembly instead.
      dry "node lib/intro-film/render-film.mjs $slug" && exit 0
      node lib/intro-film/render-film.mjs "$slug"
      exit $?
    fi
    ;;

  intro-teasers)
    # Renders one 6s teaser per proposed direction so gate 120 judges MOVING
    # pictures. Lints first — a teaser at the wrong length renders fine and
    # misleads the gate, which is worse than not rendering.
    dry "node lib/intro-film/teasers.mjs $slug" && exit 0
    node lib/intro-film/teasers.mjs "$slug"
    ;;

  intro-simple|intro-simple-render|intro-simple-lint)
    if [[ "$step" == "intro-simple" ]]; then
      # 115 — the cut-list authoring pass. Picks a card slug per beat from the
      # locked kit and fills its variables; never writes HTML. See
      # steps/115-author-intro-simple-llm/SIMPLE-PASS.md.
      d="$(step_slug 115)"
      dry "cat steps/$d/SIMPLE-PASS.md | sed s/<slug>/$slug/g" && exit 0
      cat "steps/$d/SIMPLE-PASS.md" | sed "s/<slug>/$slug/g"
      exit 0
    elif [[ "$step" == "intro-simple-render" ]]; then
      # No approval check here on purpose, same reasoning as intro-render:
      # rendering is how the owner GETS a cut to watch (lib/intro-film/approve.mjs).
      # render-simple.mjs itself refuses a cut list that fails the S1-S7 lint.
      dry "record_step 135 -- node lib/intro-kit/render-simple.mjs $slug" && exit 0
      record_step 135 "Rendered the intro cut list to intro-film/out/intro.mp4." \
        "intro-film/out/intro.mp4" -- node lib/intro-kit/render-simple.mjs "$slug"
      exit $?
    elif [[ "$step" == "intro-simple-lint" ]]; then
      # The helper: prints the S1-S7 pacing report without rendering anything.
      dry "node lib/intro-kit/lint-cutlist.mjs $slug" && exit 0
      node lib/intro-kit/lint-cutlist.mjs "$slug"
      exit $?
    fi
    ;;

  intro-simple-rerender)
    # 445 — the cut list was approved at 125 against a static avatar
    # stand-in; this is the encode that swaps in the real avatar.mp4 and
    # ships. Mirrors intro-rerender (440) for the complex flow.
    if [[ ! -f "videos/$slug/avatar.mp4" ]]; then
      echo "no real avatar.mp4 for $slug yet — 445 re-renders against it; run.sh $slug avatar-download (or place it) first"
      exit 1
    fi
    dry "record_step 445 -- node lib/intro-kit/render-simple.mjs $slug" && exit 0
    record_step 445 "Re-rendered the intro cut list against the real avatar clip." \
      "intro-film/out/intro.mp4" -- node lib/intro-kit/render-simple.mjs "$slug"
    exit $?
    ;;

  intro-rerender)
    # 440 — the intro was approved at 150 against a static avatar stand-in;
    # this is the encode that swaps in the real avatar.mp4 and ships. Must
    # fail before rendering anything if there is no real avatar yet, or a
    # session could re-run this and call the stand-in done.
    if [[ ! -f "videos/$slug/avatar.mp4" ]]; then
      echo "no real avatar.mp4 for $slug yet — 440 re-renders against it; run.sh $slug avatar-download (or place it) first"
      exit 1
    fi
    dry "record_step 440 -- node lib/intro-film/render-film.mjs $slug" && exit 0
    record_step 440 "Re-rendered the intro film against the real avatar clip." \
      "intro-film/out/intro.mp4" -- node lib/intro-film/render-film.mjs "$slug"
    exit $?
    ;;

  avatar-plan)
    # 420 — the avatar spend gate. Computes clip/second totals and character
    # candidates from shots.resolved.json; approval happens on the board's
    # Avatar tab, never here.
    dry "node lib/avatar-plan.mjs $slug" && exit 0
    node lib/avatar-plan.mjs "$slug"
    ;;

  cue-pass)
    record 210 running
    cat <<EOF
210 is an LLM step, not a command. It authors the BODY only.
Assemble the prompt:
  1. steps/$(step_slug 210)/cue-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs $slug           -> {{SKELETON}}
  3. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
  5. videos/$slug/concept.json                  -> {{CONCEPT}}
Pre-flight: node lib/feedback-status.mjs and node lib/lint-concept.mjs $slug must exit 0.
The intro and conclusion are authored separately: run.sh $slug zone-pass
After both passes: run.sh $slug validate, then card-plan (235)
EOF
    exit 0
    ;;

  zone-pass)
    record 220 running
    cat <<EOF
220 is an LLM step, not a command. It authors the INTRO and CONCLUSION only,
against their own rulebook (lib/zone-rules.mjs + lib/zone-constants.mjs).
Assemble the prompt:
  1. steps/$(step_slug 220)/zone-pass-prompt.md  (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. ../card-library/catalog.json                -> {{CATALOG}}
  4. the "structure" array in videos/$slug/segments.json -> {{STRUCTURE}}
Pre-flight: node lib/feedback-status.mjs must exit 0, and segments.json must
carry a "structure" block (no measured zones = nothing for this step to do).
Every cue it emits must carry a "zone" field of "intro" or "conclusion".
After the zone pass: run.sh $slug validate, then card-plan (235).
Stillness (W18) needs absolute times, so it runs after 310: node lib/stillness.mjs $slug
EOF
    exit 0
    ;;

  validate)
    # Pre-235: everything checkable before the cards exist. Writes nothing.
    dry "record_step 230 -- node lib/resolve.mjs $slug --validate-only" && exit 0
    record_step 230 "Ran the pre-build check over the whole cue plan: every anchor against the transcript, every card variable against its catalog entry, no timing collisions." \
      "checks/cue-plan.json" -- node lib/resolve.mjs "$slug" --validate-only
    ;;

  resolve)
    dry "record_step 310 -- node lib/resolve.mjs $slug && node lib/lint-cues.mjs $slug" && exit 0
    do_resolve() { node lib/resolve.mjs "$slug" && node lib/lint-cues.mjs "$slug"; }
    record_step 310 "Resolved every cue anchor to an absolute time, merged card variables, and ran the cue lint." \
      "resolved.json" -- do_resolve
    ;;

  storyboard-check)
    dry "record_step 330 -- storyboard-check" && exit 0
    do_storyboard_check() {
      node lib/resolve-shots.mjs "$slug" \
        && node lib/lint-shots.mjs "$slug" \
        && node lib/stillness.mjs "$slug" \
        && node lib/audit-gate.mjs "$slug"
    }
    record_step 330 "Ran the pre-render storyboard check: shot resolve, shot lint, zone stillness and the audit gate." \
      "no artifact — check only" -- do_storyboard_check
    ;;




  card-plan)
    dry "node lib/card-plan.mjs $slug" && exit 0
    node lib/card-plan.mjs "$slug"
    ;;

  outline)
    dry "node lib/card-plan.mjs $slug --outline" && exit 0
    node lib/card-plan.mjs "$slug" --outline
    ;;

  previews)
    # The 240 new-card look-approval gate as a queue instead of a copy-paste
    # loop. This only REPORTS; the extension polls the board's
    # /api/card-previews and fills its own queue. 110 (intro ideas) used to be
    # a second source here; it was removed 2026-08-17 in favour of real
    # Hyperframes teasers (lib/intro-film/teasers.mjs, run.sh intro-teasers).
    dry "node lib/flow-previews.mjs $slug" && exit 0
    node lib/flow-previews.mjs "$slug"
    ;;

  board)
    d="$(step_slug 340)"
    dry "bash steps/$d/run.sh $slug" && exit 0
    bash "steps/$d/run.sh" "$slug"
    ;;

  render)
    d="$(step_slug 410)"
    dry "record_step 410 -- bash steps/$d/run.sh $slug" && exit 0
    record_step 410 "Rendered every approved cue to a clip and wrote the editor manifest." \
      "renders/ + manifest.md" -- bash "steps/$d/run.sh" "$slug"
    ;;

  fold)
    dry "record 630 running + node lib/feedback-status.mjs" && exit 0
    record 630 running
    node lib/feedback-status.mjs
    echo "630 is an Opus-class step. Proceed manually."
    exit 0
    ;;

  sound)
    dry "record_step 450 -- node lib/sound/sfx-plan.mjs $slug" && exit 0
    record_step 450 "Planned the sound design from the resolved cues and effects." \
      "sound.json" -- node lib/sound/sfx-plan.mjs "$slug"
    ;;

  mix)
    dry "record_step 460 -- node lib/sound/build-mix.mjs $slug" && exit 0
    record_step 460 "Mixed the master: voiceover, planned effects and music, loudness-normalised and pinned to the voiceover length." \
      "master.wav" -- node lib/sound/build-mix.mjs "$slug"
    ;;

  shot-pass)
    record 320 running
    cat <<EOF
320 is an LLM step, not a command. Assemble the prompt:
  1. steps/$(step_slug 320)/shot-pass-prompt.md (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs $slug           -> {{SKELETON}}
  3. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
Pre-flight: node lib/feedback-status.mjs must exit 0.
After the shot pass: run.sh $slug shots
EOF
    exit 0
    ;;



  avatar)
    # --submit is mandatory: avatar-render.mjs exits with usage when called
    # bare, so the verb as previously written always failed (found 2026-07-31).
    # Download stays its own verb below.
    # --spans-only: the owner rejected the corner-bubble baseline on the first
    # assembled cut (2026-07-31) — only the planned host spans render now.
    d="$(step_slug 430)"
    dry "record_step 430 -- bash steps/$d/run.sh $slug --submit --spans-only${AVATAR_TEMPLATE:+ --template $AVATAR_TEMPLATE}" && exit 0
    record_step 430 "Submitted the HeyGen avatar clips for the approved shot spans." \
      "avatar-jobs.json + avatar clips in kb-scratch" -- bash "steps/$d/run.sh" "$slug" --submit --spans-only ${AVATAR_TEMPLATE:+--template "$AVATAR_TEMPLATE"}
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
    render_dir="$(step_slug 410)"
    avatar_dir="$(step_slug 430)"
    build_dir="$(step_slug 510)"
    dry "record_step 410 -- bash steps/$render_dir/run.sh $slug" \
        "node lib/effects-plan.mjs $slug" \
        "node lib/sound/sfx-plan.mjs $slug" \
        "node lib/sound/build-mix.mjs $slug" \
        "if avatar-jobs.json: bash steps/$avatar_dir/run.sh $slug --download" \
        "record_step 510 -- bash steps/$build_dir/run.sh $slug --draft" && exit 0
    echo "Running cut..."
    # Graphics render FIRST, on purpose. If avatar jobs are already submitted,
    # HeyGen is rendering them server-side this whole time, so the local CPU
    # work and the remote wait overlap instead of running one after the other.
    # Submitting stays an explicit owner action (`run.sh <slug> avatar --submit`);
    # this only stops you idling while it happens.
    record_step 410 "Rendered every approved cue to a clip and wrote the editor manifest." \
      "renders/ + manifest.md" -- bash "steps/$render_dir/run.sh" "$slug" \
      || { echo "render failed"; exit 1; }
    node lib/effects-plan.mjs "$slug" || { echo "effects-plan failed"; exit 1; }
    node lib/sound/sfx-plan.mjs "$slug" || { echo "sfx-plan failed"; exit 1; }
    node lib/sound/build-mix.mjs "$slug" || { echo "build-mix failed"; exit 1; }

    # Collect whatever HeyGen finished while the graphics were rendering.
    # Downloading is idempotent and free, so a re-run is always safe.
    if [[ -f "videos/$slug/avatar-jobs.json" ]]; then
      echo "collecting avatar clips (HeyGen rendered these while the graphics did)..."
      bash "steps/$avatar_dir/run.sh" "$slug" --download || \
        echo "warning: some avatar clips are still pending — re-run: run.sh $slug avatar-download"
    fi

    record_step 510 "Assembled the screen recording, graphics, avatar clips and mastered audio into a draft cut." \
      "final-draft.mp4 + assembly.md" -- bash "steps/$build_dir/run.sh" "$slug" --draft \
      || { echo "assemble failed"; exit 1; }
    echo "Final Cut URL: http://localhost:8080/ (or equivalent board URL) - Check the Final Cut tab!"
    ;;

  avatar-download)
    # Split out so the overlap is a named thing: submit, go do other work, then
    # collect. Safe to re-run until nothing is pending.
    d="$(step_slug 430)"
    dry "record_step 430 -- bash steps/$d/run.sh $slug --download" && exit 0
    record_step 430 "Downloaded the finished HeyGen avatar clips." \
      "avatar clips in kb-scratch + avatar-manifest.md" \
      -- bash "steps/$d/run.sh" "$slug" --download
    ;;

  assemble)
    d="$(step_slug 510)"
    dry "record_step 510 -- bash steps/$d/run.sh $slug" && exit 0
    record_step 510 "Assembled the screen recording, graphics, avatar clips and mastered audio into the cut." \
      "final.mp4 + assembly.md" -- bash "steps/$d/run.sh" "$slug"
    ;;

  deliver)
    d="$(step_slug 620)"
    dry "record_step 620 -- bash steps/$d/run.sh $slug" && exit 0
    record_step 620 "Uploaded the approved full-resolution final to the video's Drive Output folder." \
      "Output/<slug>-final.mp4 on Drive" -- bash "steps/$d/run.sh" "$slug"
    ;;

  export)
    d="$(step_slug 610)"
    dry "record_step 610 -- bash steps/$d/run.sh $slug" && exit 0
    record_step 610 "Exported the layered timeline for DaVinci." \
      "FCPXML timeline" -- bash "steps/$d/run.sh" "$slug"
    ;;

  qc)
    dry "bash scripts/qc-video.sh $slug" && exit 0
    bash scripts/qc-video.sh "$slug"
    ;;

  *)
    # Unreachable for a registry verb — the pre-case check above already
    # rejected anything the registry does not declare. A verb that lands here
    # is declared in step.json/_verbs.json with no branch to run it, and the
    # behaviour test dispatches every registry verb precisely to catch that.
    echo "unknown step: $step"
    echo "$step is declared in the registry but has no branch in run.sh — add one, or remove it from steps/*/step.json"
    exit 2
    ;;
esac
