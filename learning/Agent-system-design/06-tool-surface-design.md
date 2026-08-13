# 06 — Tool surface design

## The law

> The model never sees your code. It sees `name`, `description`, and `input_schema`. That's your entire API to it.

A bug in your tool **description** is a bug in your agent.

---

## 1. The description is documentation for a stranger

```
❌ "Search the database."

✅ "Search the customer database by email or name. Returns up to 20
    matches with id, email, plan. Use when the user mentions a customer
    but you don't have their ID. Does not include deleted accounts."
```

Four things the good one has: **what**, **what it returns**, **when to call it**, **what it can't do**.

Most under-described tools don't get called wrong — they don't get called *at all*. Aim for 3–4 sentences minimum. Being prescriptive about *when* gives measurable lift on models that reach for tools conservatively.

---

## 2. Results have a token budget

Every tool result is re-uploaded on **every subsequent turn**. A fat result taxes you for the rest of the run.

```python
❌ return json.dumps(all_1340_rows)      # 40k tokens, forever

✅ return f"{first_20}\n\n[showing 20 of 1340 — narrow your query]"
```

Truncate, and **say you truncated**. Silent truncation makes the model reason confidently over a partial view.

---

## 3. Errors should teach, not just fail

```python
❌ raise FileNotFoundError            # crashes your loop
❌ return "Error"                     # model guesses again, blindly

✅ {"is_error": True,
    "content": "File not found: src/mian.py. Similar files: src/main.py"}
```

One good error message = one recovery turn. A bad one = five flailing turns.

**Rule:** never let a tool exception escape into your loop. Catch it, describe it, hand it back.

---

## 4. Granularity: split on the gate, not the verb

- **Merge** two tools if they're always called together
- **Split** one tool if half its behaviour needs a permission prompt and half doesn't

```python
❌ file_op(action="read"|"write"|"delete")
   → your gate has to parse args to know if it's dangerous

✅ read_file / write_file / delete_file
   → read auto-approves, delete always prompts
```

**Signal you got it wrong:** you're inspecting arguments to decide whether to gate. That's two tools wearing one coat.

---

## 5. Design for retry

Your loop will retry. Make that safe.

| Tool | Retry-safe? | So |
|---|---|---|
| `read_file` | yes | auto-approve, retry freely |
| `write_file(path, content)` | yes — same result twice | auto-approve in a sandbox |
| `send_email` | **no** — sends twice | gate it, or pass an idempotency key |
| `append_row` | **no** | gate it |

No dangerous defaults. `delete(path, recursive=False)` — never `True`.

---

## Worked: `read_file` with all five applied

```python
{
  "name": "read_file",
  "description": (
      "Read a UTF-8 text file from the working directory. Returns the file "
      "contents, truncated to 2000 lines. Use when you need to see actual "
      "code or config before answering. Cannot read binaries or files "
      "outside the working directory."
  ),
  "input_schema": {
    "type": "object",
    "properties": {"path": {"type": "string", "description": "Relative path from cwd"}},
    "required": ["path"],
  },
}
```

```python
def read_file(path):
    p = (CWD / path).resolve()
    if not p.is_relative_to(CWD):
        return err(f"Path outside working directory: {path}")
    if not p.exists():
        near = [f.name for f in CWD.iterdir() if f.name[:3] == p.name[:3]][:3]
        return err(f"Not found: {path}." + (f" Similar: {near}" if near else ""))
    lines = p.read_text(errors="replace").splitlines()
    body = "\n".join(lines[:2000])
    return body + (f"\n[truncated: {len(lines)-2000} more lines]" if len(lines) > 2000 else "")
```

That's #1 (description), #2 (truncation + notice), #3 (helpful errors), #5 (path confinement) in ~10 lines.

---

## Exercise

Run `mini.py` and ask it to read a file that doesn't exist. Watch whether it recovers in one turn or flails. That's your tool surface, measured.
