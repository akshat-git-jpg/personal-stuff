---
name: notebooklm
description: Complete API for Google NotebookLM - full programmatic access including features not in the web UI. Create notebooks, add sources, generate all artifact types, download in multiple formats. Activates on explicit /notebooklm or intent like "create a podcast about X"
user-invocable: true
metadata:
  author: teng-lin
  version: 0.6.0
---
<!-- notebooklm-py v0.6.0 -->
# NotebookLM Automation

## Read on demand
- First run / broken install → references/setup.md
- Building a podcast/artifact flow → references/workflows.md
- Parsing output, exit codes, limits, languages, troubleshooting → references/reference.md


Complete programmatic access to Google NotebookLM—including capabilities not exposed in the web UI. Create notebooks, add sources (URLs, YouTube, PDFs, audio, video, images), chat with content, generate all artifact types, and download results in multiple formats.

## When This Skill Activates

**Explicit:** User says "/notebooklm", "use notebooklm", or mentions the tool by name

**Intent detection:** Recognize requests like:
- "Create a podcast about [topic]"
- "Summarize these URLs/documents"
- "Generate a quiz from my research"
- "Turn this into an audio overview"
- "Create flashcards for studying"
- "Generate a video explainer"
- "Make an infographic"
- "Create a mind map of the concepts"
- "Download the quiz as markdown"
- "Add these sources to NotebookLM"

## Autonomy Rules

**Run automatically (no confirmation):**
- `notebooklm status` - check context
- `notebooklm auth check` - diagnose auth issues
- `notebooklm auth inspect` - list Google accounts visible to a browser (read-only)
- `notebooklm auth refresh` - server-side SIDTS refresh of the active profile (no new profile, no destructive writes)
- `notebooklm auth refresh --browser-cookies <browser>` - re-extract cookies from a browser into the active profile (rebuilds `storage_state.json` for the same `--profile`, not a new one)
- `notebooklm list` - list notebooks
- `notebooklm source list` - list sources
- `notebooklm artifact list` - list artifacts
- `notebooklm language list` - list supported languages
- `notebooklm language get` - get current language
- `notebooklm language set` - set language (global setting)
- `notebooklm artifact wait` - wait for artifact completion (in subagent context)
- `notebooklm source wait` - wait for source processing (in subagent context)
- `notebooklm research status` - check research status
- `notebooklm research wait` - wait for research (in subagent context)
- `notebooklm use <id>` - set context (⚠️ SINGLE-AGENT ONLY - use `-n` flag in parallel workflows)
- `notebooklm create` - create notebook
- `notebooklm ask "..."` - chat queries (without `--save-as-note`)
- `notebooklm history` - display conversation history (read-only)
- `notebooklm source add` - add sources
- `notebooklm profile list` - list profiles
- `notebooklm profile create` - create profile
- `notebooklm profile switch` - switch active profile
- `notebooklm doctor` - check environment health

**Ask before running:**
- `notebooklm delete` - destructive
- `notebooklm generate *` - long-running, may fail
- `notebooklm download *` - writes to filesystem
- `notebooklm artifact wait` - long-running (when in main conversation)
- `notebooklm source wait` - long-running (when in main conversation)
- `notebooklm research wait` - long-running (when in main conversation)
- `notebooklm ask "..." --save-as-note` - writes a note
- `notebooklm history --save` - writes a note

## Quick Reference

| Task | Command |
|------|---------|
| Authenticate | `notebooklm login` |
| Authenticate from browser cookies | `notebooklm login --browser-cookies <browser>` |
| Authenticate from one Chromium profile | `notebooklm login --browser-cookies 'chrome::Profile 1'` |
| Authenticate from one Firefox container | `notebooklm login --browser-cookies 'firefox::Work'` |
| Import every signed-in account into its own profile | `notebooklm login --browser-cookies <browser> --all-accounts` |
| Inspect signed-in accounts (read-only, by email) | `notebooklm auth inspect --browser <browser>` |
| Inspect one browser profile/container | `notebooklm auth inspect --browser 'chrome::Profile 1'` |
| Diagnose auth issues | `notebooklm auth check` |
| Diagnose auth (full) | `notebooklm auth check --test` |
| Refresh active profile in place (server-side) | `notebooklm auth refresh` |
| Refresh active profile from a re-signed-in browser | `notebooklm auth refresh --browser-cookies <browser>` |
| Refresh from one Chromium profile | `notebooklm auth refresh --browser-cookies 'chrome::Profile 1'` |
| One-shot cookie keepalive (for cron) | `notebooklm auth refresh --quiet` |
| List notebooks | `notebooklm list` |
| Create notebook | `notebooklm create "Title"` |
| Set context | `notebooklm use <notebook_id>` |
| Show context | `notebooklm status` |
| Add URL source | `notebooklm source add "https://..."` |
| Add file | `notebooklm source add ./file.pdf` |
| Add YouTube | `notebooklm source add "https://youtube.com/..."` |
| List sources | `notebooklm source list` |
| Delete source by ID | `notebooklm source delete <source_id>` |
| Delete source by exact title | `notebooklm source delete-by-title "Exact Title"` |
| Wait for source processing | `notebooklm source wait <source_id>` |
| Web research (fast) | `notebooklm source add-research "query"` |
| Web research (deep) | `notebooklm source add-research "query" --mode deep --no-wait` |
| Web research (query from file) | `notebooklm source add-research --prompt-file research_query.txt --mode deep` |
| Check research status | `notebooklm research status` |
| Wait for research | `notebooklm research wait --import-all` |
| Chat | `notebooklm ask "question"` |
| Chat (long prompt from file) | `notebooklm ask --prompt-file question.txt` |
| Chat (specific sources) | `notebooklm ask "question" -s src_id1 -s src_id2` |
| Chat (with references) | `notebooklm ask "question" --json` |
| Chat (save answer as note) | `notebooklm ask "question" --save-as-note` |
| Chat (save with title) | `notebooklm ask "question" --save-as-note --note-title "Title"` |
| Show conversation history | `notebooklm history` |
| Save all history as note | `notebooklm history --save` |
| Continue specific conversation | `notebooklm ask "question" -c <conversation_id>` |
| Save history with title | `notebooklm history --save --note-title "My Research"` |
| Get source fulltext | `notebooklm source fulltext <source_id>` |
| Get source guide | `notebooklm source guide <source_id>` |
| Generate podcast | `notebooklm generate audio "instructions"` |
| Generate (long prompt from file) | `notebooklm generate audio --prompt-file instructions.txt` |
| Generate podcast (JSON) | `notebooklm generate audio --json` |
| Generate podcast (specific sources) | `notebooklm generate audio -s src_id1 -s src_id2` |
| Generate video | `notebooklm generate video "instructions"` |
| Generate report | `notebooklm generate report --format briefing-doc` |
| Generate report (append instructions) | `notebooklm generate report --format study-guide --append "Target audience: beginners"` |
| Generate quiz | `notebooklm generate quiz` |
| Revise a slide | `notebooklm generate revise-slide "prompt" --artifact <id> --slide 0` |
| Check artifact status | `notebooklm artifact list` |
| Wait for completion | `notebooklm artifact wait <artifact_id>` |
| Download audio | `notebooklm download audio ./output.mp3` |
| Download video | `notebooklm download video ./output.mp4` |
| Download slide deck (PDF) | `notebooklm download slide-deck ./slides.pdf` |
| Download slide deck (PPTX) | `notebooklm download slide-deck ./slides.pptx --format pptx` |
| Download report | `notebooklm download report ./report.md` |
| Download mind map | `notebooklm download mind-map ./map.json` |
| Download data table | `notebooklm download data-table ./data.csv` |
| Download quiz | `notebooklm download quiz quiz.json` |
| Download quiz (markdown) | `notebooklm download quiz --format markdown quiz.md` |
| Download flashcards | `notebooklm download flashcards cards.json` |
| Download flashcards (markdown) | `notebooklm download flashcards --format markdown cards.md` |
| Delete notebook | `notebooklm delete -n <id>` |
| List languages | `notebooklm language list` |
| Get language | `notebooklm language get` |
| Set language | `notebooklm language set zh_Hans` |
| List profiles | `notebooklm profile list` |
| Create profile | `notebooklm profile create work` |
| Switch profile | `notebooklm profile switch work` |
| Delete profile | `notebooklm profile delete old` |
| Rename profile | `notebooklm profile rename old new` |
| Use profile (one-off) | `notebooklm -p work list` |
| Health check | `notebooklm doctor` |
| Health check (auto-fix) | `notebooklm doctor --fix` |

**Parallel safety:** Use explicit notebook IDs in parallel workflows. Commands supporting `-n` shorthand: `artifact wait`, `source wait`, `research wait/status`, `download *`. Download commands also support `-a/--artifact`. Other commands use `--notebook`. For chat, use `-c <conversation_id>` to target a specific conversation.

**Partial IDs:** Use first 6+ characters of UUIDs. Must be unique prefix (fails if ambiguous). Works for ID-based commands such as `use`, `source delete`, and `wait`. For exact source-title deletion, use `source delete-by-title "Title"`. For automation, prefer full UUIDs to avoid ambiguity.

## Output Style

**Progress updates:** Brief status for each step
- "Creating notebook 'Research: AI'..."
- "Adding source: https://example.com..."
- "Starting audio generation... (task ID: abc123)"

**Fire-and-forget for long operations:**
- Start generation, return artifact ID immediately
- Do NOT poll or wait in main conversation - generation takes 5-45 minutes (see timing table)
- User checks status manually, OR use subagent with `artifact wait`

**JSON output:** Use `--json` flag for machine-readable output:
```bash
notebooklm list --json
notebooklm auth check --test --json   # use --test for network-validated auth (see § Agent Setup Verification)
notebooklm source list --json
notebooklm artifact list --json
```

**JSON schemas (key fields):**

`notebooklm list --json`:
```json
{"notebooks": [{"index": 1, "id": "...", "title": "...", "is_owner": true, "created_at": "..."}], "count": 1}
```

`notebooklm auth check --test --json` (use `--test` to drive the network token-fetch — bare `--json` would leave `"token_fetch": null`):
```json
{"status": "ok", "checks": {"storage_exists": true, "json_valid": true, "cookies_present": true, "sid_cookie": true, "token_fetch": true}, "details": {"storage_path": "...", "auth_source": "file", "cookies_found": ["SID", "HSID", "..."], "cookie_domains": [".google.com"]}}
```

`notebooklm source list --json`:
```json
{"notebook_id": "...", "notebook_title": "...", "sources": [{"index": 1, "id": "...", "title": "...", "type": "SourceType.WEB_PAGE", "url": "...", "status": "ready|processing|error", "status_id": 1, "created_at": "..."}], "count": 1}
```

`notebooklm artifact list --json`:
```json
{"notebook_id": "...", "notebook_title": "...", "artifacts": [{"index": 1, "id": "...", "title": "...", "type": "Audio", "type_id": 1, "status": "in_progress|pending|completed|unknown", "status_id": 1, "created_at": "..."}], "count": 1}
```

**Status values:**
- Sources: `processing` → `ready` (or `error`)
- Artifacts: `pending` or `in_progress` → `completed` (or `unknown`)

## Error Handling

**On failure, offer the user a choice:**
1. Retry the operation
2. Skip and continue with something else
3. Investigate the error

**Error decision tree:**

| Error | Cause | Action |
|-------|-------|--------|
| Auth/cookie error | Session expired | Run `notebooklm auth check` then `notebooklm login` |
| "No notebook context" | Context not set | Use `-n <id>` or `--notebook <id>` flag (parallel), or `notebooklm use <id>` (single-agent) |
| "No result found for RPC ID" | Rate limiting | Wait 5-10 min, retry |
| `GENERATION_FAILED` | Google rate limit | Wait and retry later |
| Download fails | Generation incomplete | Check `artifact list` for status |
| Invalid notebook/source ID | Wrong ID | Run `notebooklm list` to verify |
| RPC protocol error | Google changed APIs | May need CLI update |

