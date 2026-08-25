# Artifact Template: Visual Plan Review

When generating the interactive HTML artifact for a plan review, output a SINGLE self-contained HTML file following these precise instructions.

## Technical Constraints

- **Self-contained**: Must be a single HTML file with inline CSS (`<style>`). Do NOT use external stylesheets or scripts.
- **Design System**: Use a system font stack (`font-family: system-ui, -apple-system, sans-serif;`), a light background, and ensure it is readable at a 900px max-width layout.
- **No external libraries**: Do not load any JS libraries.

## JavaScript Wiring (Lavish)

The only JavaScript allowed is the inline call to lavish-axi for decision cards. A decision card must use this exact structure:

```html
<form data-lavish-question="slug-for-decision" onsubmit="event.preventDefault(); window.lavish.queuePrompt('Answer for ' + this.dataset.lavishQuestion, {tag: 'choice', data: {question: this.dataset.lavishQuestion, answer: new FormData(this).get('answer')}})">
  <!-- radio inputs named "answer" with values "Approve as planned" and "Change (explain in an annotation)" -->
  <button type="submit">Queue answer</button>
</form>
```

## Page Structure

The HTML must mirror the markdown plan in the following order:

1. **Header Strip**: 
   - Plan Number and Title (e.g., `<h1>Plan 036: /plan-review</h1>`)
   - Status Fields rendered as inline badges (Priority, Effort, Risk, Executor, Difficulty).
   
2. **Risk Panel (CRITICAL - must be at the very top below header)**:
   - Must have a distinct warning visual style (e.g., red/amber border or background).
   - Show the plan's Risk level.
   - Show all STOP conditions.
   - If you find any line in the plan containing "push", "merge", "delete", or "deploy", quote it verbatim in this panel so the reviewer sees destructive actions immediately.

3. **Why this matters**: Rendered as standard prose.

4. **Current state**: Rendered inside a collapsible `<details>` tag (with `<summary>Current state</summary>`).

5. **Scope**: 
   - Render as a two-column layout: one column for "In scope", one for "Out of scope".

6. **Steps**: 
   - Render each step as a distinct visual card.
   - Each step's "Verify" instruction MUST be rendered in a monospace font block.

7. **Decision Cards**:
   - As you read the plan, identify 2–5 load-bearing decisions (e.g., chosen approach, risky defaults, scope cuts).
   - Render a `<form>` card (using the lavish HTML above) for each identified decision.
   - The card should be titled with the decision being made.
   - Radio options MUST be: "Approve as planned" and "Change (explain in an annotation)".
   
8. **Done criteria**: Render as a visual checklist (using checkboxes).

9. **Maintenance notes**: Rendered inside a collapsible `<details>` tag.
