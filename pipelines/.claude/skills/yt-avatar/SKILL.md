---
name: yt-avatar
description: >-
  HeyGen avatars, free Avatar III only. clip: turn one part of a script into an avatar video (VO via yt-vo, then
  render with a finalized avatar, download). test: try a new photo as an avatar. retest: a saved avatar with another
  voice. Also download, list, finalize, delete. Use for "avatar for this part", "avatar clip", "yt-avatar",
  "avatar-test", "test this avatar", "try this pic as an avatar", "which avatars have I tested", "finalize this avatar".
user-invocable: true
---

# yt-avatar

Two jobs. **Make avatar clips** for a part of a script (`clip`). **Find new avatars** that suit the owner's voice and
brand and look real, not AI (`test`, `retest`, then `finalize`). Each run must be free and recorded, so any avatar
or clip can be rebuilt later.

Full video edits do not come here: `yt-video-edit` places and renders avatars for a whole video (steps 320-430).

**Selection-first.** At every decision, use `AskUserQuestion` with 2-4 ready options (recommended one first, marked
"(Recommended)"), never an open question. The owner picks; you act. Keep replies in the owner's ELI5 style.

| Verb | Use when the owner says |
|---|---|
| `clip` | "make an avatar for the pricing part", "avatar clip of this paragraph" |
| `test` (default for a picture) | "test this avatar", "try this pic as an avatar" |
| `retest` | "try helen with the Modal voice", "same avatar, another voice" |
| `download` | "download that test video", "give me the mp4" |
| `list` / `finalize` / `delete` | "which avatars have I tested", "finalize this avatar", "delete these" |

## Fixed facts

| Thing | Value |
|---|---|
| CLI | `node tooling/cli/heygen-web/heygen-web.mjs` (run inside a pp-work workspace; it appends to `pipelines/video/heygen/RENDERS.md`) |
| Auth env | `HEYGEN_WEB_CURLS=/Users/kbtg/codebase/personal-stuff/infra/secrets/heygen-web-curls.txt` |
| Engine | Avatar III (`heygen3`) only. Free. Never Avatar IV here. |
| HeyGen folder | "Test Avatar" `f214dcf8986a4114ba69b9630e38fe00` (built into the CLI's `avatar-test` command) |
| Finalized avatars | `pipelines/video/heygen/registry.json`: a slug with `avatar_id` (photo avatar) or `template_id` (template) |
| Clips folder (local) | `~/kb-scratch/video/heygen/clips/<clip-name>/` (VO text, VO audio, video). Never in git |
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

## Verb: clip — one part of a script as an avatar video

1. **Get the part.** The owner gives a script (file, doc, paste) and names the part ("the pricing section",
   "paragraph 3", a pasted chunk). Cut out exactly that text and show it back. `AskUserQuestion`: "Is this the
   part?" (Yes / Add the next paragraph / Different part). Name the clip yourself: 2-4 lowercase words
   (`everbee-pricing`). Make `~/kb-scratch/video/heygen/clips/<clip-name>/` and save the text there as `<clip-name>.txt`.
   Every file is named after the clip: the word check uses the file name as its job, so a shared name
   would mix two clips' words.
2. **Make the VO with yt-vo**, following its flow for a doc (read `pipelines/.claude/skills/yt-vo/SKILL.md`):
   prep `<clip-name>.txt` into `<clip-name>.vo.txt`, run the **word check** with job `<clip-name>` (STOP until the
   owner approves every risky word in the word pronunciation check app), then
   `say --file <clip-name>.vo.txt --out <clip-name>.mp3`. Never skip the word check:
   a wrong name in a clip means a second render.
3. **Pick the avatar.** `AskUserQuestion` with the slugs from `registry.json` that carry an `avatar_id` or a
   `template_id` (recommend the one its description calls the default). Skip entries with neither.
4. **Render on Avatar III** (free; the CLI checks credits before and after and waits for the render):
   ```
   heygen-web generate-from-audio --avatar <slug> --audio <clip-name>.mp3 --title "<clip-name>"      # avatar_id
   heygen-web generate-from-template --template <slug> --audio <clip-name>.mp3 --title "<clip-name>" # template_id
   ```
   Exit 2 = **credits were used**. Stop and tell the owner which meter moved.
5. **Download** to the clip folder: `heygen-web download <video_id> --out ~/kb-scratch/video/heygen/clips/<clip-name>/<clip-name>.mp4`.
6. **Commit** the `RENDERS.md` row the CLI appended (`chore(heygen): avatar clip <clip-name>`), with commit-now.
7. **Report**: the clip path, its length, the avatar, "0 credits used". Then `AskUserQuestion` "What next?":
   Another part / Same part, other avatar / Done.

## Verb: retest — a saved avatar with another voice

For a face already in the mapping, when only the voice changes. No new picture, no new avatar.

1. `AskUserQuestion` which avatar (newest non-deleted rows of the mapping), then which voice (as in `test` step 3).
2. Run: `avatar-test --avatar-id <avatar_id from the row> --audio <file> --name "<same avatar name>"`. Same exit
   codes as `test`. The mapping gets a new row with `reused_avatar: true`.
3. Commit and report as in `test` steps 6-7.

## Verb: download

Only when the owner asks. `AskUserQuestion` which video (newest mapping rows, or clips from `RENDERS.md`), then
`heygen-web download <video_id> --out ~/kb-scratch/avatar-tests/videos/<avatar-name>-<date>.mp4` (tests) or the
clip folder (clips). Report the path.

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
- Test videos stay in HeyGen unless the owner asks (`download`). Clips are always downloaded.
- The owner keeps his own recorded voice. Never re-voice audio (decisions.md 2026-10-09).
- Pictures, audio and videos never go into git; only the mapping and `RENDERS.md` rows do.
