# 02 — The agent loop

## The one idea

**An AI agent is a while loop.** Everything else is plumbing.

```
while True:
    response = call_model(conversation)
    if model didn't ask for a tool: break
    result = run_the_tool(response.tool_call)
    conversation.append(result)
```

Claude Code is that loop with good tools, a good system prompt, and permission checks.

---

## Tool calling: how a model acts

You give the model a list of tools (name + description + JSON schema). **The model can't run them.** It just emits structured JSON: *"call `read_file` with `{path: 'main.py'}`"*.

**Your code runs it.** You feed the result back as a message. The model never touches your machine — your code does, on its behalf.

This is the entire security story. Permission prompts are your code deciding whether to execute what the model asked for.

Loop terminates when `stop_reason == "end_turn"` instead of `"tool_use"`.

---

## Level 1 `mini.py` — the whole thing

```python
import anthropic, pathlib

client = anthropic.Anthropic()

TOOLS = [{
    "name": "read_file",
    "description": "Read a file from disk. Use when you need to see file contents.",
    "input_schema": {
        "type": "object",
        "properties": {"path": {"type": "string", "description": "Path to the file"}},
        "required": ["path"],
    },
}]

def run_tool(name, args):
    if name == "read_file":
        return pathlib.Path(args["path"]).read_text()
    return f"unknown tool: {name}"

messages = [{"role": "user", "content": input("> ")}]

while True:
    res = client.messages.create(
        model="claude-opus-5",
        max_tokens=16000,
        tools=TOOLS,
        messages=messages,
    )
    messages.append({"role": "assistant", "content": res.content})

    if res.stop_reason != "tool_use":
        print(next(b.text for b in res.content if b.type == "text"))
        break

    results = []
    for block in res.content:
        if block.type == "tool_use":
            print(f"  [tool] {block.name}({block.input})")
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": run_tool(block.name, block.input),
            })
    messages.append({"role": "user", "content": results})
```

---

# Worked example: the thumbnail agent

Task: make a 1280×720 thumbnail for *"I built an AI agent in 100 lines"*.
On disk: `ref.jpg` (a reference thumbnail), `face.png`, `logo.png`.

## Step 0 — raw API call, no harness

```python
client.messages.create(
    model="claude-sonnet-5", max_tokens=4096,
    messages=[{"role": "user", "content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": ref_b64}},
        {"type": "text", "text": "Make me a thumbnail like this. Face is face.png."},
    ]}],
)
```

Response: *"Here's a design I'd suggest: bold yellow text on the left third..."*

**It described a thumbnail. It did not make one.** It can't see `face.png` (never sent), can't write files, can't generate images.

> A raw API call is a very expensive design consultant with no hands.

## Step 1 — add a harness

Three tools:

```python
list_assets()          # → "face.png (820x1100), logo.png, ref.jpg"
render_html(html, out) # → headless Chrome screenshots at 1280x720 → PNG
view_image(path)       # → returns the PNG back INTO context as an image block
```

## The turns, on the wire

**Turn 1** — send system prompt + tools + `ref.jpg` + request.
```json
{"content": [
   {"type": "text", "text": "Let me see what assets I have."},
   {"type": "tool_use", "id": "toolu_01", "name": "list_assets", "input": {}}],
 "stop_reason": "tool_use"}
```
`stop_reason: "tool_use"` → loop does not break.

**Turn 2** — feed result back, call API again **with the whole conversation from scratch**.
```json
{"role": "user", "content": [
   {"type": "tool_result", "tool_use_id": "toolu_01",
    "content": "face.png (820x1100), logo.png (400x400), ref.jpg (1280x720)"}]}
```
Model writes HTML, calls `render_html` → `v1.png`. **Your code fired Chrome. The model wrote a string.**

**Turn 3** — model calls `view_image("v1.png")`.

**Turn 4 — the moment that matters.** `view_image` doesn't return text, it returns an **image block**:
```json
{"type": "tool_result", "tool_use_id": "toolu_03", "content": [
   {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "..."}}]}
```
Model can now literally see what it built:
> *"Problem: at 110px the headline wraps to four lines and collides with the face. Shrinking to 84px and moving the face up 60px."*

**Turn 5** — renders v2, views it, `stop_reason: "end_turn"` → loop breaks.

**Act → observe → correct. That's the whole game.**

---

## What the context actually held

By turn 5, every API call was re-sending all of this:

| Piece | ~Tokens |
|---|---|
| System prompt + 3 tool schemas | 600 |
| ref.jpg | 1,500 |
| Tool calls + HTML written | 2,100 |
| v1.png (image) | 1,500 |
| v2.png (image) | 1,500 |
| **Total on the final call** | **~7,200** |

Two lessons:
1. **Images are expensive.** An agent that screenshots 40 times blows its context window.
2. **You paid for turn 1 five times.** This is exactly what prompt caching exists to fix.

---

## Same model, three harnesses

| | Harness A (custom) | Harness B (Claude Code) | Harness C (no `view_image`) |
|---|---|---|---|
| Tools | 3, purpose-built | 7, general | 1 |
| Can self-correct | ✅ | ✅ | ❌ |
| Can go off-script | ❌ | ✅ | ❌ |
| Blast radius | one folder | your machine | one folder |
| Turns | 5 | 10 (2 prompts) | 2 |
| Output | good | good | **broken** |

Harness B had no `render_html` tool — so it invented its own pipeline with bash + Pillow. Harness C never saw its output, so it **reported success from imagination**.

Identical brain in all three. **Every difference came from the harness.**

---

## Five takeaways

1. A raw API call is a mouth, not a worker.
2. Tools are your ordinary code. The model emits JSON; your Python runs it.
3. The loop is `stop_reason`. `"tool_use"` → continue. `"end_turn"` → stop.
4. **Feedback tools are what make it good.** Any agent that acts without observing will hallucinate success.
5. The harness decides capability, safety, cost, and speed.

---

## Exercise

Build Harness C on purpose — one tool, no `view_image` — and watch it lie to you. Then add `view_image` and watch the same model catch its own mistake. That before/after teaches more than any diagram.
