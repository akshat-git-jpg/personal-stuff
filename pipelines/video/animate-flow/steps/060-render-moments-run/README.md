# 060 · render the moments · [RUN]

```
node lib/run.mjs <slug> render-moments [--only m02] [--force]
```

- **In:** `moments/<id>/index.html`
- **Out:** `<media>/moments/<id>.mp4` at the run's canvas and fps (and `<id>--9x16.mp4` per
  extra format), plus `renders.json`.
- An overlay renders on a key-green plate (a scratch copy of its page; the committed
  composition stays transparent), which 070 keys out over the recording.
- A render newer than every file of its composition is reused; `--force` re-renders.
- Each clip is checked: its length must match the moment (two frames of slack) and it must
  not be black throughout. Either problem exits 1.
