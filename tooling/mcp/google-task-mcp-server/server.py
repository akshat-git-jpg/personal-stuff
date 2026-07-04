# STATUS: RETIRED — referenced by telegram-my-planner; NOT in .mcp.json
from __future__ import annotations
import asyncio
from pathlib import Path
from typing import Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

BASE_DIR = Path(__file__).parent
REPO_ROOT = BASE_DIR.parent.parent.parent  # tooling/mcp/google-task-mcp-server -> tooling/mcp -> tooling -> repo root
PREFS_DIR = REPO_ROOT / "apps" / "telegram-my-planner"  # prefs live next to the consuming project

app = Server("google-tasks")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_service(account: str):
    from auth import get_credentials
    creds = get_credentials(account)
    return build("tasks", "v1", credentials=creds)


def prefs_path(account: str) -> Path:
    return PREFS_DIR / f"preferences-tasks-{account}.md"


def find_list_id(service, list_name: str) -> Optional[str]:
    result = service.tasklists().list().execute()
    for lst in result.get("items", []):
        if lst["title"].lower() == list_name.lower():
            return lst["id"]
    return None


def format_task_list(tasks: list[dict]) -> str:
    if not tasks:
        return "No tasks found."
    lines = []
    for i, t in enumerate(tasks, 1):
        note = f" — {t['notes']}" if t.get("notes") else ""
        lines.append(f"{i}. {t['title']}{note}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

ACCOUNT_PROP = {
    "account": {
        "type": "string",
        "description": "Full email address of the Google account to act as (e.g. 'you@gmail.com'). Required.",
    }
}


def _schema(props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {**ACCOUNT_PROP, **props},
        "required": ["account", *required],
    }


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_task_lists",
            description="Returns all Google Task lists with their names.",
            inputSchema=_schema({}, []),
        ),
        types.Tool(
            name="list_tasks",
            description="Returns all tasks in a named task list.",
            inputSchema=_schema(
                {"list_name": {"type": "string", "description": "Exact name of the task list"}},
                ["list_name"],
            ),
        ),
        types.Tool(
            name="move_task",
            description="Moves a task from one list to another by title.",
            inputSchema=_schema(
                {
                    "task_title": {"type": "string"},
                    "source_list": {"type": "string"},
                    "target_list": {"type": "string"},
                },
                ["task_title", "source_list", "target_list"],
            ),
        ),
        types.Tool(
            name="reorder_tasks",
            description="Sets the priority order of tasks in a list. Pass titles in desired order (index 0 = highest priority).",
            inputSchema=_schema(
                {
                    "list_name": {"type": "string"},
                    "ordered_titles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Task titles in desired priority order",
                    },
                },
                ["list_name", "ordered_titles"],
            ),
        ),
        types.Tool(
            name="complete_task",
            description="Marks a task as completed and removes it from the list.",
            inputSchema=_schema(
                {
                    "task_title": {"type": "string"},
                    "list_name": {"type": "string"},
                },
                ["task_title", "list_name"],
            ),
        ),
        types.Tool(
            name="read_preferences",
            description="Reads the per-account tasks preferences file.",
            inputSchema=_schema({}, []),
        ),
        types.Tool(
            name="update_preferences",
            description="Overwrites the per-account tasks preferences file with new content.",
            inputSchema=_schema(
                {"content": {"type": "string", "description": "Full new preferences content"}},
                ["content"],
            ),
        ),
        types.Tool(
            name="add_task",
            description="Adds a new task to a named list (defaults to 'My Tasks' if list_name omitted).",
            inputSchema=_schema(
                {
                    "task_title": {"type": "string", "description": "Title of the new task"},
                    "list_name": {"type": "string", "description": "Target list name (default: 'My Tasks')"},
                    "notes": {"type": "string", "description": "Optional notes/description"},
                },
                ["task_title"],
            ),
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    account = arguments.get("account")
    if not account:
        return [types.TextContent(
            type="text",
            text="Error: 'account' is required (full email of the Google account to use).",
        )]

    try:
        if name == "read_preferences":
            path = prefs_path(account)
            content = path.read_text().strip() if path.exists() else ""
            return [types.TextContent(type="text", text=content or "(No preferences set yet.)")]

        if name == "update_preferences":
            path = prefs_path(account)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(arguments["content"])
            return [types.TextContent(type="text", text=f"Preferences saved to {path.name}.")]

        service = get_service(account)

        if name == "list_task_lists":
            result = service.tasklists().list().execute()
            names = [lst["title"] for lst in result.get("items", [])]
            return [types.TextContent(type="text", text="\n".join(names) or "No lists found.")]

        if name == "list_tasks":
            list_name = arguments["list_name"]
            list_id = find_list_id(service, list_name)
            if not list_id:
                return [types.TextContent(type="text", text=f"List '{list_name}' not found.")]
            result = service.tasks().list(tasklist=list_id).execute()
            tasks = result.get("items", [])
            return [types.TextContent(type="text", text=format_task_list(tasks))]

        if name == "move_task":
            task_title = arguments["task_title"]
            source_list = arguments["source_list"]
            target_list = arguments["target_list"]

            source_id = find_list_id(service, source_list)
            target_id = find_list_id(service, target_list)
            if not source_id:
                return [types.TextContent(type="text", text=f"Source list '{source_list}' not found.")]
            if not target_id:
                return [types.TextContent(type="text", text=f"Target list '{target_list}' not found.")]

            tasks = service.tasks().list(tasklist=source_id).execute().get("items", [])
            task = next((t for t in tasks if t["title"].lower() == task_title.lower()), None)
            if not task:
                return [types.TextContent(type="text", text=f"Task '{task_title}' not found in '{source_list}'.")]

            service.tasks().insert(
                tasklist=target_id,
                body={"title": task["title"], "notes": task.get("notes", ""), "status": "needsAction"},
            ).execute()
            service.tasks().delete(tasklist=source_id, task=task["id"]).execute()
            return [types.TextContent(type="text", text=f"Moved '{task_title}' → '{target_list}'.")]

        if name == "reorder_tasks":
            list_name = arguments["list_name"]
            ordered_titles = arguments["ordered_titles"]
            list_id = find_list_id(service, list_name)
            if not list_id:
                return [types.TextContent(type="text", text=f"List '{list_name}' not found.")]

            tasks = service.tasks().list(tasklist=list_id).execute().get("items", [])
            title_to_id = {t["title"].lower(): t["id"] for t in tasks}

            previous_task_id = None
            moved = []
            for title in ordered_titles:
                task_id = title_to_id.get(title.lower())
                if not task_id:
                    continue
                service.tasks().move(
                    tasklist=list_id,
                    task=task_id,
                    **({} if previous_task_id is None else {"previous": previous_task_id}),
                ).execute()
                previous_task_id = task_id
                moved.append(title)

            return [types.TextContent(type="text", text=f"Reordered {len(moved)} tasks in '{list_name}'.")]

        if name == "complete_task":
            task_title = arguments["task_title"]
            list_name = arguments["list_name"]
            list_id = find_list_id(service, list_name)
            if not list_id:
                return [types.TextContent(type="text", text=f"List '{list_name}' not found.")]

            tasks = service.tasks().list(tasklist=list_id).execute().get("items", [])
            task = next((t for t in tasks if t["title"].lower() == task_title.lower()), None)
            if not task:
                return [types.TextContent(type="text", text=f"Task '{task_title}' not found in '{list_name}'.")]

            service.tasks().delete(tasklist=list_id, task=task["id"]).execute()
            return [types.TextContent(type="text", text=f"Completed and removed '{task_title}'.")]

        if name == "add_task":
            task_title = arguments["task_title"]
            list_name = arguments.get("list_name", "My Tasks")
            notes = arguments.get("notes", "")
            list_id = find_list_id(service, list_name)
            if not list_id:
                return [types.TextContent(type="text", text=f"List '{list_name}' not found.")]
            body = {"title": task_title, "status": "needsAction"}
            if notes:
                body["notes"] = notes
            service.tasks().insert(tasklist=list_id, body=body).execute()
            return [types.TextContent(type="text", text=f"Added '{task_title}' to '{list_name}'.")]

        return [types.TextContent(type="text", text=f"Unknown tool: {name}")]

    except HttpError as exc:
        return [types.TextContent(type="text", text=f"Google Tasks API error: {exc}")]
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        return [types.TextContent(type="text", text=f"Error: {exc}")]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="google-tasks",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
