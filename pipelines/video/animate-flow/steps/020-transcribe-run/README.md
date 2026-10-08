# 020 · transcribe the voiceover · [RUN]

```
node lib/run.mjs <slug> transcribe
```

- **In:** `<media>/vo.mp3`
- **Out:** `transcript.json` (flat `[{text,start,end}]`, word level) and `transcript-meta.json`
  (which engine produced it).
- Groq `whisper-large-v3-turbo` through the shared `visuals-flow/lib/transcribe-groq.mjs`
  CLI when `GROQ_API_KEY` is set (run.sh sources `~/.zshenv` for it); local whisper
  (`npx hyperframes transcribe -m small.en`) otherwise. The CLI is called, not copied, and it
  carries no editing judgment: it only turns audio into timed words.
- v1 has no transcript cleanup pass. Moments anchor on word indices, so a misheard word
  only matters if a graphic quotes it; 040 sees the words and can spell a product name right.
