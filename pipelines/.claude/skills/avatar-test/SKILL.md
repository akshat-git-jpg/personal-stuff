---
name: avatar-test
description: >-
  Test a HeyGen photo avatar from one picture: strip a Gemini watermark, create the avatar, render a free Avatar III
  video with the owner's audio, prove 0 credits used, file it in "Test Avatar" and record it in a mapping. Also
  list, finalize, delete. Use for "avatar-test", "test this avatar", "try this pic as an avatar", "which avatars
  have I tested", "finalize this avatar".
user-invocable: true
---

# avatar-test

The owner is looking for avatars that suit his voice and brand and look real, not AI. He experiments with many
pictures. Each test must be quick, free and recorded, so any avatar can be rebuilt later.

**Selection-first.** At every decision, use `AskUserQuestion` with 2-4 ready options (recommended one first, marked
"(Recommended)"), never an open question. The owner picks; you act. Keep replies in the owner's ELI5 style.

## Fixed facts

| Thing | Value |
|---|---|
| CLI | `node tooling/cli/heygen-web/heygen-web.mjs` (run inside a pp-work workspace; it appends to `pipelines/video/heygen/RENDERS.md`) |
| Auth env | `HEYGEN_WEB_CURLS=/Users/kbtg/codebase/personal-stuff/infra/secrets/heygen-web-curls.txt` |
| Engine | Avatar III (`heygen3`) only. Free. Never Avatar IV here. |
| HeyGen folder | "Test Avatar" `f214dcf8986a4114ba69b9630e38fe00` (built into `avatar-test`) |
| Drive folder for pictures | "Avatar Tests" `1I8ajZmG6xuRHOxuz1emRDvAWuFDQpf_g`, account `kushalbakliwal25@gmail.com` |
| Local pictures | `~/kb-scratch/avatar-tests/` |
| Mapping (committed) | `pipelines/video/heygen/avatar-test/avatar-tests.json` |
| Voice samples (committed list) | `pipelines/video/heygen/avatar-test/voices.json`; files in `~/kb-scratch/avatar-tests/voices/` + Drive |
| Watermark tool | `python3 pipelines/video/heygen/avatar-test/unwatermark.py <in> <out>` |
| Photo avatar slots | Unlimited on the current plan (`credits` / `/v1/payment/subscription`). |

## Verb: test (default)

1. **Get the picture.** A pasted image is saved at `/private/tmp/claude-501/<project>/<session>/images/N.png`; a file
   path or a Drive link also works (`pp-drive download <id> --out … --account kushalbakliwal25@gmail.com`).
   Copy it to `~/kb-scratch/avatar-tests/<name>-original.<ext>`. **Name** it yourself: 2-3 lowercase words from what
   the picture shows (e.g. `helen office`). If that name is already in the mapping, add a number.
   Blocked with `Operation not permitted` on `~/Downloads`? See personal-stuff-debugging-playbook row 20.
2. **Watermark.** Run `unwatermark.py <original> ~/kb-scratch/avatar-tests/<name>-clean.png`. It prints JSON.
   `found: true` → it removed the sparkle (only those pixels change); zoom-crop the box before/after and look at it
   before going on. `found: false` → the clean copy is identical; use it.
3. **Voice.** Always ask (owner rule). `AskUserQuestion` "Which voice for the test video?": one option per entry in
   `pipelines/video/heygen/avatar-test/voices.json` (label + description), plus "Other file" (the built-in free-text
   choice). Use the entry's `local` file; if it is missing, `pp-drive download` its `drive` link back to `local`.
   A new sample the owner wants to keep: cut ~15-20 s ending on a pause (`silencedetect`), save it under
   `~/kb-scratch/avatar-tests/voices/`, upload to the Drive folder, add an entry. Keep samples under ~60 s.
4. **Upload the pictures to Drive**: original and clean, into the Avatar Tests folder (`pp-drive upload <file>
   --parent 1I8ajZmG6xuRHOxuz1emRDvAWuFDQpf_g --account kushalbakliwal25@gmail.com`). Keep both links.
5. **Run the test** (one command; it saves credits before, creates the avatar, renders on Avatar III, waits for
   the render, re-reads credits, moves the video to Test Avatar and appends the mapping row):
   ```
   avatar-test --image <clean.png> --audio <file> --name "<name>" --watermark removed|none \
     --source-pic <original> --pic-drive <clean link> --source-drive <original link>
   ```
   - Exit 2 = **credits were used**. Stop. Tell the owner exactly which meter moved. Do not run another test.
   - Avatar create fails with a slot/limit message → `AskUserQuestion` which test avatar to delete (list the oldest
     from the mapping, recommend the oldest non-finalized one), then `delete-avatar <id>` and re-run.
   - Render `failed` → show `status <video_id>`'s `error_message`; offer a retry.
6. **Commit** the mapping row (`chore(heygen): avatar test <name>`) with commit-now.
7. **Report**: avatar name, video title, "0 credits used", "in Test Avatar". Do not download the video. Then
   `AskUserQuestion` "What next?": Try another picture / Finalize this avatar / Delete this avatar.

## Verb: list

Read the mapping. Show a short table: date, avatar name, video title, watermark, status. Newest first.

## Verb: finalize

The owner picked a winner. `AskUserQuestion` for a registry slug (offer 2 slugs you made up from the name).
Add it to `pipelines/video/heygen/registry.json` as `{"avatar_id": "<id>", "description": "…"}` (photo avatars are
`avatar_id`; templates are `template_id`), mark `"finalized": true` on its mapping row, and commit. Mention that a
HeyGen template with this avatar is only needed for layouts; `generate-from-audio` already fills the frame.

## Verb: delete

`AskUserQuestion` which avatar (multi-select, from the mapping). Confirm once more with the names. Then
`delete-avatar <id>` and set `"deleted": "<date>"` on the row. The pictures stay in Drive, so it can be rebuilt.

## Picking a photo

Cover the neck (high neckline, collar or hair), head straight, mouth closed or slightly open, even front light.
Why: `pipelines/video/heygen/AVATAR-III-QUALITY.md`.

## Rules

- 0 credits per test is the contract. Never pass `--engine heygen4` or `--iv`.
- Never download test videos; the owner watches them in HeyGen.
- The owner keeps his own recorded voice. Never re-voice audio (decisions.md 2026-10-09).
- Pictures and videos never go into git; only the mapping does.
