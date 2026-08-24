# Type: cinematic vlog (assembled from many raw clips + monologue VO)

What's specific to building a vlog from a shoot's footage. (Universal rules still apply.)

- **Voice-first assembly:** the monologue is the spine. Pull the storyline from ALL the
  talking-head transcripts, keep it roughly chronological and coherent, then cover it with
  b-roll. Don't force a shot list onto chopped sentences.
- **Two-tier metadata per clip** (from `broll-ingest`): a lean feed (description + timecoded
  transcript) for bulk story planning, plus rich per-clip sidecars (word-level transcript +
  stills) for exact in-points. Feed it all into context — no semantic search.
- **Coverage from real footage**, never freezes: extend a b-roll shot into its source to fill
  the VO, capped at ~4s/shot; cut to the next distinct clip beyond that.
- Grade to the scenery (this trip: Nordic — teal shadows, warm highlights, gentle film curve).
  Grade is per-video config, not a fixed LUT.
- Mute native audio on b-roll that has speech (so it doesn't fight the VO); keep native audio
  only where it's wanted (e.g. laughter on an end-screen BTS clip).
- Close warm: climax/laughing/celebration shots into the final line; optional end-screen credits.
