# My Planner — Claude Instructions

This project drives Google Tasks through the `google-tasks` MCP server
(`tooling/mcp/google-task-mcp-server`). It triages new tasks into the right lists,
sets priority order, marks completion, and maintains the scheduling preferences.

## Account

This project defaults to **akshatpatidar17@gmail.com** (where the actual task
lists live: "My Tasks", "Anusha", "To Do", "To buy", etc.). Pass
`account="akshatpatidar17@gmail.com"` to every `google-tasks` MCP call unless
the user explicitly asks to act on a different account. When switching, use the
full email address and confirm in your reply which account ran the action.

## Processing Workflow

When the user says "process my tasks" (or similar):

1. Call `read_preferences` (with the account) to load current rules.
2. Call `list_tasks` with `list_name="My Tasks"` to see what needs processing.
3. If My Tasks is empty, tell the user and stop.
4. For each task in My Tasks:
   - Based on preferences and task content, decide which list it belongs to.
   - If genuinely ambiguous, ask the user before moving (don't guess).
   - Call `move_task` to move it from "My Tasks" to the target list.
5. After all tasks are moved, apply priority ordering within each affected list:
   - Call `reorder_tasks` for each list that received tasks, ordering by the
     user's priority rules.
6. Confirm to the user: list which tasks went where, and show the priority order
   in each list.

## Preference Updates

When the user states a new rule (e.g., "remember that gym is always flexible"):
1. Call `read_preferences` (with the account) to get current content.
2. Append the new rule in plain English.
3. Call `update_preferences` with the full updated content.
4. Confirm: "Got it — I've saved that preference."

## Reviewing Tasks

When user asks "what's on my [list name] list":
1. Call `list_tasks` (with the account) with that list name.
2. Present the tasks clearly, numbered by priority order.

## Completing Tasks

When user says "mark [task] as done":
1. Ask which list it's in if not obvious.
2. Call `complete_task` (with the account).
3. Confirm removal.
