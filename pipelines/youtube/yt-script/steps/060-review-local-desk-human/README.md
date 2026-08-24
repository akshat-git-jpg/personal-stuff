# 060 - review the local desk

**[OWNER]** &nbsp; You open it on your machine and give feedback.

The owner runs the desk locally against `script-plan.md` on disk and reviews the real UI before anything is published. Added 2026-08-23: until then step 2 published the live freelancer URL BEFORE any owner review, so approval came after the link already existed.

**Reads:** `script-plan.md`

**Gate:** the script plan reads right in the actual UI

---

## What you do

```bash
cd apps/yt-script-desk
npm run dev:local
```

Open `http://localhost:5175/?key=<key>`.

It serves the same `script-plan.md` that is on disk, so what you see is what your
freelancer will see. Read it, toggle the instruction lanes, check the Full script
tab. Give feedback in the terminal and the session edits `script-plan.md`.

## Why this is a gate

Publishing mints a live secret URL. Reviewing after that is reviewing something
already shipped. This is also the only place a beat that reads fine as markdown
but badly in two tracks shows up.

## You have already read the words

Step 055 is where you read `script-plan.md` as markdown, so the wording and the
section order are settled before you get here. This gate asks the narrower
question: **does it work in the UI?** A beat that splits badly across the two
tracks, a `SHOW` lane that says nothing on its own, an instruction track he will
misread. If you find yourself rewriting sentences here, that belonged at 055 —
still fix it, but the file is the same file.

## Also registered in localapps

`tooling/cli/local-apps-dashboard/apps.json`, id `script-desk`, ports 5175 + 4327.
