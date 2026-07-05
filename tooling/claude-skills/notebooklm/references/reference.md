## Command Output Formats

Commands with `--json` return structured data for parsing:

**Create notebook:**
```bash
$ notebooklm create "Research" --json
{"notebook": {"id": "abc123de-...", "title": "Research", "created_at": null}}
# parse with: jq -r .notebook.id
```

**Add source:**
```bash
$ notebooklm source add "https://example.com" --json
{"source": {"id": "def456...", "title": "Example", "type": "SourceType.WEB_PAGE", "url": "https://example.com"}}
# parse with: jq -r .source.id
# Note: no `status` field on add — use `source list --json` or `source wait` to check processing state.
```

**Generate artifact:**
```bash
$ notebooklm generate audio "Focus on key points" --json
{"task_id": "xyz789...", "status": "pending"}
# When run with --wait, completed status also includes a `url` field.
```

**Chat with references:**
```bash
$ notebooklm ask "What is X?" --json
{"answer": "X is... [1] [2]", "conversation_id": "...", "turn_number": 1, "is_follow_up": false, "references": [{"source_id": "abc123...", "citation_number": 1, "cited_text": "Relevant passage from source..."}, {"source_id": "def456...", "citation_number": 2, "cited_text": "Another passage..."}]}
```

**Source fulltext (get indexed content):**
```bash
$ notebooklm source fulltext <source_id> --json
{"source_id": "...", "title": "...", "content": "Full indexed text...", "_type_code": null, "url": null, "char_count": 12345}
```

**Understanding citations:** The `cited_text` in references is often a snippet or section header, not the full quoted passage. The `start_char`/`end_char` positions reference NotebookLM's internal chunked index, not the raw fulltext. Use `SourceFulltext.find_citation_context()` to locate citations:
```python
fulltext = await client.sources.get_fulltext(notebook_id, ref.source_id)
matches = fulltext.find_citation_context(ref.cited_text)  # Returns list[(context, position)]
if matches:
    context, pos = matches[0]  # First match; check len(matches) > 1 for duplicates
```

**Extract IDs:** Singular endpoints wrap their result in an envelope —
parse `.notebook.id` (from `create`), `.source.id` (from `source add`),
or `.task_id` (from `generate *`). The chat `--json` references list uses
`.references[].source_id`.

## Exit Codes

All commands use consistent exit codes:

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | Error (not found, processing failed) | Check stderr, see Error Handling |
| 2 | Timeout (wait commands only) | Extend timeout or check status manually |

**Examples:**
- `source wait` returns 1 if source not found or processing failed
- `artifact wait` returns 2 if timeout reached before completion
- `generate` returns 1 if rate limited (check stderr for details)

## Known Limitations

**Rate limiting:** Audio, video, quiz, flashcards, infographic, and slide deck generation may fail due to Google's rate limits. This is an API limitation, not a bug.

**Reliable operations:** These always work:
- Notebooks (list, create, delete, rename)
- Sources (add, list, delete)
- Chat/queries
- Mind-map, study-guide, report, data-table generation

**Unreliable operations:** These may fail with rate limiting:
- Audio (podcast) generation
- Video generation
- Quiz and flashcard generation
- Infographic and slide deck generation

**Workaround:** If generation fails:
1. Check status: `notebooklm artifact list`
2. Retry after 5-10 minutes
3. Use the NotebookLM web UI as fallback

**Processing times vary significantly.** Use the subagent pattern for long operations:

| Operation | Typical time | Suggested timeout |
|-----------|--------------|-------------------|
| Source processing | 30s - 10 min | 600s |
| Research (fast) | 30s - 2 min | 180s |
| Research (deep) | 15 - 30+ min | 1800s |
| Notes | instant | n/a |
| Mind-map | instant (sync) | n/a |
| Quiz, flashcards | 5 - 15 min | 900s |
| Report, data-table | 5 - 15 min | 900s |
| Audio generation | 10 - 20 min | 1200s |
| Video generation | 15 - 45 min | 2700s |

**Polling intervals:** When checking status manually, poll every 15-30 seconds to avoid excessive API calls.

## Language Configuration

Language setting controls the output language for generated artifacts (audio, video, etc.).

**Important:** Language is a **GLOBAL** setting that affects all notebooks in your account.

```bash
# List all 80+ supported languages with native names
notebooklm language list

# Show current language setting
notebooklm language get

# Set language for artifact generation
notebooklm language set zh_Hans  # Simplified Chinese
notebooklm language set ja       # Japanese
notebooklm language set en       # English (default)
```

**Common language codes:**
| Code | Language |
|------|----------|
| `en` | English |
| `zh_Hans` | 中文（简体） - Simplified Chinese |
| `zh_Hant` | 中文（繁體） - Traditional Chinese |
| `ja` | 日本語 - Japanese |
| `ko` | 한국어 - Korean |
| `es` | Español - Spanish |
| `fr` | Français - French |
| `de` | Deutsch - German |
| `pt_BR` | Português (Brasil) |

**Override per command:** Use `--language` flag on generate commands:
```bash
notebooklm generate audio --language ja   # Japanese podcast
notebooklm generate video --language zh_Hans  # Chinese video
```

**Offline mode:** Use `--local` flag to skip server sync:
```bash
notebooklm language set zh_Hans --local  # Save locally only
notebooklm language get --local  # Read local config only
```

## Troubleshooting

```bash
notebooklm --help              # Main commands
notebooklm auth check          # Diagnose auth issues
notebooklm auth check --test   # Full auth validation with network test
notebooklm source --help       # Source management
notebooklm research --help     # Research status/wait
notebooklm generate --help     # Content generation
notebooklm artifact --help     # Artifact management
notebooklm download --help     # Download content
notebooklm language --help     # Language settings
```

**Diagnose auth:** `notebooklm auth check` - shows cookie domains, storage path, validation status
**Re-authenticate:** `notebooklm login`
**Check version:** `notebooklm --version`
**Refresh a CLI-managed install:** `notebooklm skill install`
## Long Prompts

When a prompt or query exceeds shell command-line length limits, use `--prompt-file` to read it from a file:

```bash
notebooklm ask --prompt-file ./long_question.txt
notebooklm generate report --prompt-file ./custom_report_prompt.txt
notebooklm source add-research --prompt-file ./research_query.txt --mode deep
```

`--prompt-file` is mutually exclusive with the positional text argument. The file is read as UTF-8 with trailing whitespace stripped. Supported on: `ask`, all `generate` subcommands (except `mind-map`), and `source add-research`.

> **Note:** `--prompt-file` reads a *prompt/query text file*, not a source document. To upload a file as a notebook source, use `source add ./file.pdf`.
