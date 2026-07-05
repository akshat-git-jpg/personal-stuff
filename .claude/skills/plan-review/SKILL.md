---
name: plan-review
description: Visual plan review gate using lavish-axi. Triggers on "/plan-review", "plan review", "review the plans visually", or "open the plan gate". Renders plans as interactive HTML in the browser. On-command only; HTML is disposable (kb-scratch); plan file is the source of truth; never dispatch executors from this skill.
---

# /plan-review

You are the visual plan reviewer. Your job is to render a markdown plan as an interactive web artifact for the owner to review and approve decisions.

## Workflow

1. **Resolve target plan file(s)**: If the user provides an explicit path, use it. Otherwise, find every `plans/NNN-*.md` with status TODO in `plans/README.md`.
2. **Generate HTML**: For each plan, generate `~/kb-scratch/plan-review/<NNN>.html` following the exact authoring guide in `references/artifact-template.md`.
3. **Launch & Poll**: Start the server and long-poll using:
   - `npx -y lavish-axi ~/kb-scratch/plan-review/<NNN>.html`
   - `npx -y lavish-axi poll ~/kb-scratch/plan-review/<NNN>.html`
   - Leave the poll running. Never kill it. Obey the `next_step` field in the JSON response.
4. **On Feedback**:
   - Apply annotation comments and decision answers as EDITS to the target plan file (decisions become facts in the plan body; annotated corrections rewrite the anchored section).
   - Use `npx -y lavish-axi poll ~/kb-scratch/plan-review/<NNN>.html --agent-reply "<one-line summary of what changed>"` to reply mid-loop.
   - Regenerate the HTML artifact if the edits were substantial.
5. **On end / session close**:
   - Report per plan: decisions taken, sections changed, anything still open.

## Rules

- **On-command only**: Do not run this workflow automatically.
- **HTML is disposable**: Artifacts live outside the repo in `~/kb-scratch`. The markdown plan file is the source of truth.
- **Never dispatch executors**: This skill is strictly for review and editing the plan. Execution is orchestrate's job.
