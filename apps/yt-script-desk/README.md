# yt-script-desk

A two-track script editor for YouTube tutorial makers, replacing the old PDF handoff.

## What it is

The desk separates instructions from content. It splits every beat into two columns:
- **Left track (Script):** The exact words that will be spoken on camera.
- **Right track (instructions):** four blocks, each behind its own toggle — **What to cover** (the brief for a body beat), **Screen Recording notes**, **General Notes** (the section rules plus the beat's facts), **Video Editor Notes**. The `Instructions` toggle is the master for all four.

This separation prevents the maker from accidentally reading production notes as part of the script, and prevents instructions from bleeding into the final voiceover feed.

## The two views

1. **Freelancer view**: The maker reads the **What to cover** brief and writes their lines in the left track. They cannot edit the instructions.
2. **Review view**: The owner sees what was changed against the locked pre-filled copy and approves or restores lines.

## Running locally

```bash
npm install
npm run dev:local
```
Then open `http://localhost:5175/?key=vox-style-video-ai` (or any other valid video key you are working on).

## CLI Workflow

The app provides a CLI to push/pull drafts from the skill:

**Publish a script to the desk:**
```bash
DESK_ADMIN_TOKEN=… node bin/desk.mjs publish <key>
```
It prints a single secret URL. This URL is the only thing sent to the freelancer.

**Find an older video's link:**
```bash
DESK_ADMIN_TOKEN=… node bin/desk.mjs list
```
Prints every published video — date, key, title and its secret URL. This is the
registry: the links cannot be kept in a file here because this repo is public,
so the database is the record and this reads it back.

**Pull the completed draft:**
```bash
DESK_ADMIN_TOKEN=… node bin/desk.mjs pull <key>
```
This downloads their final words to `videos/<key>/script-draft.md` in the pipeline folder and prints a list of any locked lines they edited.

## What the freelancer sees

The freelancer receives a secret link to the desk. There is no login.
They see a clean, two-column UI where they write their lines on the left, guided by the non-editable instructions on the right.
