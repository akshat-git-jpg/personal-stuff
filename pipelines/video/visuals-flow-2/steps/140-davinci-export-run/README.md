# 140 · davinci export · [RUN]

Same gates as assembly (the exporter enforces them itself: cues approved +
rendered, shots approved with clips downloaded, screen.mp4 present).

    bash steps/140-davinci-export-run/run.sh <slug> [--baked] [--bundle] [--force]

DEFAULT is the NATIVE layered project (near-instant, no encoding):
continuous screen on the spine, avatar/graphics/overlays/FX clips each on
their own lane (every effect a copyable clip), markers for dropped
transform-effects, sidecar captions.srt.

`--baked` = the WYSIWYG pre-encoded variant (plays exactly like final.mp4; for ship checks).

Out: `~/kb-scratch/video/visuals-flow-2/<slug>/resolve-export/`

`--bundle` copies every source file into `resolve-export/media/` so the folder
is self-contained. The assets still point at absolute `file://` URLs inside
that folder — FCPXML's `src` is a URL, and Resolve resolves no relative ones.
Emitting `./media/x.mp4` imports without an error and leaves every clip
offline: "97 of 97 clips were not yet found" (2026-08-02, the first bundled
run). `lib/export-timeline.mjs`'s `makeSrcUrl` owns this and is tested.

If a bundled folder is MOVED after export, the URLs go stale — that one is
fixable in the import dialog: answer Yes to "select another folder to search"
and point at `media/`, which relinks by basename.

Audio is baked, not raw: each SFX is rendered at its planned gain and
pitch through `sound/build-mix.mjs`'s `sfxInstanceChain` (the SAME builder
the ffmpeg mix uses), and the voiceover lane is `vo-processed.wav` carrying
`VO_CHAIN`. Before that, the export shipped raw samples at unity and a raw
vo.mp3 — a -30 dB drone bed played 30 dB hot under an unprocessed VO
(2026-08-02). Only the master `loudnorm` is not baked; it applies to the
sum, so the editor puts a loudness normalize on the master bus.

Captions are scoped the same way the burn scopes them (`planSegments` →
screen segments only), carry a zero-anchor cue, and cannot be styled from
SRT. Resolve REFUSES .ass on import, so the orange keyword colour is not
reachable in Resolve from a sidecar. See the generated README in the export
folder for the exact track-style numbers.

Import: DaVinci Resolve → File → Import → Timeline → timeline.fcpxml,
then File → Import → Subtitle → captions.srt. Effect LOOK tweaks stay
effects.json + re-export; structural edits are native drags now.
