# 2/030 · clean-script-for-tts  ·  [RUN]

Strips markdown + the trailing rubric HTML comment; hard-fails if any
`[VERIFY:` placeholder survived the human review at step 020.

- **In:** `../010-write-script-opus/output/<base>.script.md`
- **Out:** `output/<base>.tts-ready.txt`
- **Run:** `python3 run.py [<base>]`
- **Next:** step 3-voiceover/010 reads `<base>.tts-ready.txt`
