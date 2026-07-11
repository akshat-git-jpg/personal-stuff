# Reference voices — catalog

Every reference voice the TTS engines can clone. The wav + its transcript (`.txt`) live in
`references/`; consumers refer to a voice by its **slug**. Add a row when adding a voice.

| Slug | Files | Character / use | Source | Notes |
|---|---|---|---|---|
| `jamila-30s` | `jamila-walking-30s.wav` + `.txt` | production female tutorial voice | owner-supplied (was `~/Desktop/my-ref-voices/30-sec-soft-women/`) | soft women's voice; wired into the IndexTTS-2 Modal runs |
| `jamila-45s` | `jamila-walking-45s.wav` + `.txt` | longer variant of `jamila-30s` | owner-supplied (was `~/Desktop/my-ref-voices/45-sec-soft-women/`) | use when the engine benefits from a longer prompt |
| `ref-6s-soft` | `ref-6s-soft.wav` | early "soft and elegant speaker" test voice | YouTube Short, extracted + loudnorm'd (was `work/refvoice/ref.wav`) | 6.2s; wired into `engines/omnivoice/config.json`; calm → plain output |
