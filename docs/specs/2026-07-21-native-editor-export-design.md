# Native editor export — layered FCPXML with FX overlay clips (Phase 1)

Owner-approved 2026-07-21 (brainstorm in-session; POC evidence below). Supersedes the
"baked segments" editing story of plan 109 — the baked export stays as a WYSIWYG
ship-check mode; **the native mode becomes the default editing handoff.**

## Problem

The plan-109 export bakes effects into pre-encoded segment clips. In the editor nothing
is a native object: the screen recording is chopped into pieces, effects are pixels, and
the owner's actual want — "everything visible in the timeline like a video editor built
it; I can copy/move/edit each thing" — isn't met.

## Owner decisions (2026-07-21)

1. **Full automation stays.** The pipeline decides and places everything; no
   marker-guided manual drops as the primary path.
2. **Phase 1 container = FCPXML** (proven importing into Resolve 21 free with absolute
   paths). **Phase 2 = native .drp authoring** via the vendored
   `davinci-resolve-mcp/resolve-advanced` drp-format library — DEFERRED until its two
   blob problems are solved (see POC verdict); the Phase 1 data layer carries over.
3. **Effects ship as pre-rendered transparent FX clips on their own timeline lane** —
   native, copyable, deletable objects. This holds in Phase 2 too (Resolve has no
   native flash-wipe transition).
4. Effects that geometrically transform the underlying video (punch-in zoom, Ken Burns
   drift, blur-style whip displacement) **cannot be overlay clips** — Phase 1 drops
   them from the editor export and records each dropped instance as a timeline MARKER
   (note text says what was dropped); the editor can apply Resolve-native equivalents
   (Dynamic Zoom, stock transition) if wanted. The baked/ship path still renders them.

## POC verdict (2026-07-20/21, recorded for Phase 2)

Authored `.drp` projects offline with the vendored library and imported into the
owner's Resolve 21.0.2 (free edition):

- ✅ Timeline structure (tracks, clips, cuts, audio), generators, and **transitions**
  import as first-class native objects (cross-dissolve verified on the timeline).
- ❌ Media-pool items link only if the pool blob's embedded path resolves — the blob is
  **zstd-compressed** and the library clones it verbatim (template's foreign path/name
  leak through: "CKY - Bam and Th…", Media Offline).
- ❌ Text+ titles import as clips but the composition arrives EMPTY (no Title controls,
  renders black) — the CompositionBA blob was captured on a different machine/version.
- Root cause class: **plain-XML elements author perfectly; cloned binary blobs don't
  survive machine/version drift.** Phase 2 preconditions: (a) zstd codec + safe path
  patch inside the media blob (or per-machine template capture for every codec incl.
  ProRes 4444), (b) locally captured Text+ comp template. POC artifacts:
  `~/kb-scratch/video/visuals-flow/test-01/drt-poc/`.

## Phase 1 design

Two build units (plans 111, 112):

### 1. FX clip renderer (`lib/render-fx.mjs`, plan 111)

Reads `videos/<slug>/effects.json` (+ resolved/shots context), renders each enabled
instance that can exist as an overlay into a short transparent ProRes 4444 `.mov` under
`videos/<slug>/renders-fx/` (gitignored, like `renders/`):

- `whip` instances with `style:'flash'` → the orange flash-wipe (band sweep + wash),
  alpha-only recreation of the whip module's flash chain, duration = TRANSITION_DUR.
- `beat` instances → the flash half of flash+punch (punch dropped → marker).
- `bubble` instances → the corner-circle chain rendered against transparency at its
  segment times (no-ops while corner clips are absent, same as assembly).
- `whip` `style:'blur'` and `drift` instances → NOT rendered (marker on export).

Determinism: content-keyed like the assembly cache; a manifest (`renders-fx/manifest.json`)
maps instance id → file, duration, timeline placement.

### 2. Native layered FCPXML mode (plan 112, extends `lib/export-timeline.mjs`)

`export-timeline <slug>` default becomes `--native`; `--baked` keeps the plan-109
behavior. Native layout (no segment encoding at all — near-instant export):

- Spine: `screen.mp4` as ONE continuous clip (the full VO duration).
- lane -1: `vo.mp3`.
- lane 1: avatar span clips (files are already span-length).
- lane 2: fullframe graphic renders at cue times.
- lane 3: overlay graphic renders (transparent ProRes, already exist).
- lane 4: FX clips from `renders-fx/` at instance times.
- Markers: one per dropped effect instance (punch/drift/blur-whip) with a note.
- Captions: sidecar `captions.srt` from the caption planner (editable subtitle track;
  per-word orange highlight is lost in the editor route — accepted; the baked/ship
  path keeps it). FCPXML `<caption>` embedding may be attempted as an extra, SRT is
  the contract.
- Media refs: absolute `file://` everywhere (relative refs proven broken on import);
  `--bundle` copies all referenced media incl. screen/avatars for the remote-editor
  handoff.

### What the editor can now do natively

Move/trim/delete/copy every avatar span, graphic, overlay, and effect; slide any cut
(screen is continuous underneath); retype captions on the subtitle track; add their own
transitions. Re-export overwrites the project file — manual editor work is per-video
(same contract as plan 109; the reverse timeline-diff idea stays deferred).

## Out of scope (deliberate)

- Phase 2 (.drp native authoring) — deferred, tracked as GFX-19 with the POC verdict.
- FCPXML keyframed transforms (Ken Burns in-editor) — dropped from Phase 1.
- Reverse diff of editor changes back into the fold loop — still deferred (2026-07-20).
- Any change to the assembly/ship path — `assemble.mjs` untouched.
