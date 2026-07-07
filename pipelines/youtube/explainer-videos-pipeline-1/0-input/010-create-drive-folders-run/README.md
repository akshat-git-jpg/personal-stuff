# 0/010 · create-drive-folders  ·  [RUN]  (first step)

Creates `<topic>/{input,output}/` under the fixed root Drive folder, mirrors it
locally, and writes the per-topic manifest every later step appends to.

- **Run:** `python3 run.py --topic "Video Topic"`
- **Out:** `output/<base>.manifest.json` + `output/<base>/{input,output}/` locally;
  same tree in Drive under the fixed root folder
  (`https://drive.google.com/drive/folders/1nnTXY8sSXOVyHxHX1aPPUR3gQxtpcWFO`).
- **Idempotent:** re-running finds existing folders and preserves manifest
  fields other steps have already filled in.
- **Next:** step 2-scripting/010 reads `<base>` from this manifest.
