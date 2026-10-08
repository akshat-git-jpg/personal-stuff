# 060 · render the moments · [RUN]

```
node lib/run.mjs <slug> render-moments [--only m02] [--force]
```

- **In:** `moments/<id>/index.html`
- **Out:** `<media>/moments/<id>.mp4` at the run's canvas and fps, plus `renders.json`.
- A render newer than every file of its composition is reused; `--force` re-renders.
- Each clip is checked: its length must match the moment (two frames of slack) and it must
  not be black throughout. Either problem exits 1.
