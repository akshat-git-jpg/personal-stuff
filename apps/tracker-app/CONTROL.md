# Tutorials Tracker — control matrix

> Auto-generated from `src/shared/control.ts` by `scripts/gen-control-md.ts`.
> **Do not edit by hand** — edit `control.ts` and re-run the generator.

For each stage: what each role sees (`show`), can edit (`edit`), and must
fill before moving forward. Pipeline order: Topic → Script → Recording → Editing → Thumbnail → Upload.

## Topic  ·  worker = Admin

### Admin (worker)

| Status | Shown | Editable | Must fill to advance |
|---|---|---|---|
| To Do | video_title, video_notes, video_description, category, subcategory, topic_date, admin_email, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | video_title, video_notes, video_description, category, subcategory, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email | — |
| In Progress | video_title, video_notes, video_description, category, subcategory, topic_date, admin_email, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | video_title, video_notes, video_description, category, subcategory, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email | video_title, video_notes, video_description, category, subcategory, topic_date, admin_email, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email |
| In Review | video_title, video_notes, video_description, category, subcategory, topic_date, admin_email, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | — | — |
| Done | video_title, video_notes, video_description, category, subcategory, topic_date, admin_email, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | — | — |

### Reviewer

| Status | Shown | Editable |
|---|---|---|
| To Do | video_title, video_notes, video_description, category, subcategory, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Progress | video_title, video_notes, video_description, category, subcategory, reviewer_email, script_writer_email, tutorial_maker_email, video_editor_email, thumbnail_maker_email, uploader_email, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Review | video_title, video_notes, video_description, category, subcategory, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Done | video_title, video_notes, video_description, category, subcategory, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | — |

- **Must fill to Approve** (→ Done): script_instruction
- **Must fill to Request changes** (→ Need Changes): —

## Script  ·  worker = Scriptwriter

### Scriptwriter (worker)

| Status | Shown | Editable | Must fill to advance |
|---|---|---|---|
| To Do | video_title, video_notes, category, subcategory, script_instruction, script_eta | script_eta | script_eta |
| In Progress | video_title, video_notes, category, subcategory, script_instruction, script_eta, script_link | script_link | script_link |
| In Review | video_title, video_notes, category, subcategory, script_instruction, script_eta, script_link | — | — |
| Need Changes | video_title, video_notes, category, subcategory, script_instruction, script_eta, script_link | script_link | script_link |
| Done | video_title, script_eta, script_link | — | — |

### Reviewer

| Status | Shown | Editable |
|---|---|---|
| To Do | video_title, video_notes, category, subcategory, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Progress | video_title, video_notes, category, subcategory, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, script_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Review | video_title, video_notes, category, subcategory, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, script_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Need Changes | video_title, video_notes, category, subcategory, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, script_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Done | video_title, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, script_link | — |

- **Must fill to Approve** (→ Done): tutorial_instruction
- **Must fill to Request changes** (→ Need Changes): script_feedback

## Recording  ·  worker = Recorder

### Recorder (worker)

| Status | Shown | Editable | Must fill to advance |
|---|---|---|---|
| To Do | video_title, video_notes, script_link, tutorial_instruction, tutorial_eta | tutorial_eta | tutorial_eta |
| In Progress | video_title, video_notes, script_link, tutorial_instruction, tutorial_eta, tutorial_link | tutorial_link | tutorial_link |
| In Review | video_title, video_notes, script_link, tutorial_instruction, tutorial_eta, tutorial_link | — | — |
| Need Changes | video_title, video_notes, script_link, tutorial_instruction, tutorial_eta, tutorial_link | tutorial_link | tutorial_link |
| Done | video_title, tutorial_eta, tutorial_link | — | — |

### Reviewer

| Status | Shown | Editable |
|---|---|---|
| To Do | video_title, video_notes, script_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Progress | video_title, video_notes, script_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, tutorial_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Review | video_title, video_notes, script_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, tutorial_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Need Changes | video_title, video_notes, script_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, tutorial_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Done | video_title, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, tutorial_link | — |

- **Must fill to Approve** (→ Done): video_editor_instruction
- **Must fill to Request changes** (→ Need Changes): tutorial_feedback

## Editing  ·  worker = Video Editor

### Video Editor (worker)

| Status | Shown | Editable | Must fill to advance |
|---|---|---|---|
| To Do | video_title, video_notes, tutorial_link, video_editor_instruction, video_editor_eta | video_editor_eta | video_editor_eta |
| In Progress | video_title, video_notes, tutorial_link, video_editor_instruction, video_editor_eta, video_editor_link | video_editor_link | video_editor_link |
| In Review | video_title, video_notes, tutorial_link, video_editor_instruction, video_editor_eta, video_editor_link | — | — |
| Need Changes | video_title, video_notes, tutorial_link, video_editor_instruction, video_editor_eta, video_editor_link | video_editor_link | video_editor_link |
| Done | video_title, video_editor_eta, video_editor_link | — | — |

### Reviewer

| Status | Shown | Editable |
|---|---|---|
| To Do | video_title, video_notes, tutorial_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Progress | video_title, video_notes, tutorial_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, video_editor_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Review | video_title, video_notes, tutorial_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, video_editor_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Need Changes | video_title, video_notes, tutorial_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, video_editor_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Done | video_title, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, video_editor_link | — |

- **Must fill to Approve** (→ Done): thumbnail_instruction
- **Must fill to Request changes** (→ Need Changes): editor_feedback

## Thumbnail  ·  worker = Thumbnail Maker

### Thumbnail Maker (worker)

| Status | Shown | Editable | Must fill to advance |
|---|---|---|---|
| To Do | video_title, video_notes, video_editor_link, thumbnail_instruction, thumbnail_eta | thumbnail_eta | thumbnail_eta |
| In Progress | video_title, video_notes, video_editor_link, thumbnail_instruction, thumbnail_eta, thumbnail_link | thumbnail_link | thumbnail_link |
| In Review | video_title, video_notes, video_editor_link, thumbnail_instruction, thumbnail_eta, thumbnail_link | — | — |
| Need Changes | video_title, video_notes, video_editor_link, thumbnail_instruction, thumbnail_eta, thumbnail_link | thumbnail_link | thumbnail_link |
| Done | video_title, thumbnail_eta, thumbnail_link | — | — |

### Reviewer

| Status | Shown | Editable |
|---|---|---|
| To Do | video_title, video_notes, video_editor_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Progress | video_title, video_notes, video_editor_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, thumbnail_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| In Review | video_title, video_notes, video_editor_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, thumbnail_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Need Changes | video_title, video_notes, video_editor_link, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, thumbnail_link | script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction |
| Done | video_title, script_instruction, tutorial_instruction, video_editor_instruction, thumbnail_instruction, thumbnail_link | — |

- **Must fill to Approve** (→ Done): —
- **Must fill to Request changes** (→ Need Changes): thumbnail_feedback

## Upload  ·  worker = Uploader

### Uploader (worker)

| Status | Shown | Editable | Must fill to advance |
|---|---|---|---|
| To Do | video_title, video_description, video_editor_link, thumbnail_link, yt_eta | yt_eta | yt_eta |
| In Progress | video_title, video_description, video_editor_link, thumbnail_link, yt_eta, yt_link, yt_upload_date, short_links, actual_links | yt_link, yt_upload_date, short_links, actual_links | yt_link |
| Uploaded | video_title, thumbnail_link, yt_eta, yt_link, yt_upload_date, short_links, actual_links | — | — |

### Reviewer

| Status | Shown | Editable |
|---|---|---|
| To Do | video_title, video_description, video_editor_link, thumbnail_link | — |
| In Progress | video_title, video_description, video_editor_link, thumbnail_link, yt_link, yt_upload_date, short_links, actual_links | — |
| Uploaded | video_title, thumbnail_link, yt_link, yt_upload_date, short_links, actual_links | — |

- **Must fill to Approve** (→ Done): —
- **Must fill to Request changes** (→ Need Changes): —

---

Notes:
- Admin always sees & edits everything (not tabled).
- `*_eta` is a calendar date, required before To Do → In Progress, editable only at To Do.
- A shown-but-not-editable column renders read-only; a column not shown is hidden.
