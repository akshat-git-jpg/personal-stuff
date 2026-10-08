# 070 · assemble the cut · [RUN]

```
node lib/run.mjs <slug> assemble            # draft: final-draft.mp4 at 2/3 size
node lib/run.mjs <slug> assemble --final    # full size: final.mp4
```

Maps this recipe onto the kit's edit plan (`visuals-flow/lib/kit/edit-plan.mjs`) and calls
`assembleEditPlan()`:

| Clip | What |
|---|---|
| `footage` `bed` | `screen.mp4`, or a flat clip in the design system's `tokens.json` `background` |
| `composition` per moment | `<media>/moments/<id>.mp4` over `[start, end]`, base layer |
| plan `audio` | `<media>/audio.wav` for the whole cut |

- **Out:** `<media>/final-draft.mp4` (or `final.mp4`), `edit-plan.json`, `assembly.md`, and a
  registered version `<media>/versions/vN.mp4` that 080 plays.
- v1 has no captions, no transitions and no punch-ins; the kit's effect modules belong to
  the template recipe. The tail after the last moment stays on the bed (`holdTail: false`).
- The kit's scratch folders live in the media folder, never in the repo.
