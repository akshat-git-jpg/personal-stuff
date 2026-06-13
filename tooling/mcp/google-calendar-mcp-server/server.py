from __future__ import annotations
import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel.server import NotificationOptions

BASE_DIR = Path(__file__).parent

app = Server("google-calendar")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_service(account: str):
    from auth import get_credentials
    creds = get_credentials(account)
    return build("calendar", "v3", credentials=creds)


def _text(s: str) -> list[types.TextContent]:
    return [types.TextContent(type="text", text=s)]


def _event_summary(event: dict) -> dict:
    """Compact representation of an event for JSON output."""
    start = event.get("start", {})
    end = event.get("end", {})
    return {
        "id": event.get("id"),
        "summary": event.get("summary", "(no title)"),
        "start": start.get("dateTime") or start.get("date"),
        "end": end.get("dateTime") or end.get("date"),
        "location": event.get("location"),
        "description": event.get("description"),
        "attendees": [a.get("email") for a in event.get("attendees", []) if a.get("email")],
        "html_link": event.get("htmlLink"),
        "status": event.get("status"),
    }


def _build_event_body(args: dict) -> dict:
    """Convert tool args into a Calendar API event body."""
    body: dict = {}
    if "summary" in args:
        body["summary"] = args["summary"]
    if args.get("description") is not None:
        body["description"] = args["description"]
    if args.get("location") is not None:
        body["location"] = args["location"]
    if args.get("start"):
        body["start"] = _to_event_time(args["start"], args.get("timezone"))
    if args.get("end"):
        body["end"] = _to_event_time(args["end"], args.get("timezone"))
    if "attendees" in args and args["attendees"] is not None:
        body["attendees"] = [{"email": e} for e in args["attendees"]]
    return body


def _to_event_time(value: str, tz: str | None) -> dict:
    """Accept an ISO-8601 datetime ('2026-05-25T10:00:00+05:30' or
    '2026-05-25T10:00:00') or a bare date ('2026-05-25') for all-day events."""
    v = value.strip()
    if "T" in v:
        # datetime
        out = {"dateTime": v}
        if tz:
            out["timeZone"] = tz
        return out
    # date only -> all-day
    return {"date": v}


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

_ACCT = {
    "type": "string",
    "description": "Full email address of the Google account to act as. Required.",
}


def _schema(props: dict, required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {"account": _ACCT, **props},
        "required": ["account", *required],
    }


_CAL_ID = {
    "type": "string",
    "description": "Calendar ID. Use 'primary' for the account's main calendar (default).",
    "default": "primary",
}


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list_calendars",
            description="Lists all calendars on the account (primary + subscribed + shared).",
            inputSchema=_schema({}, []),
        ),
        types.Tool(
            name="list_events",
            description=(
                "Lists events in a time range. 'time_min' and 'time_max' are ISO-8601 "
                "datetimes (e.g. '2026-05-25T00:00:00+05:30'). Defaults to next 7 days "
                "starting now."
            ),
            inputSchema=_schema(
                {
                    "calendar_id": _CAL_ID,
                    "time_min": {
                        "type": "string",
                        "description": "ISO-8601 start of range (inclusive). Optional; defaults to now.",
                    },
                    "time_max": {
                        "type": "string",
                        "description": "ISO-8601 end of range (exclusive). Optional; defaults to time_min+7days.",
                    },
                    "query": {
                        "type": "string",
                        "description": "Free-text search across event title/description/attendees.",
                    },
                    "max_results": {"type": "integer", "default": 50},
                },
                [],
            ),
        ),
        types.Tool(
            name="get_event",
            description="Returns the full details of a single event.",
            inputSchema=_schema(
                {"calendar_id": _CAL_ID, "event_id": {"type": "string"}},
                ["event_id"],
            ),
        ),
        types.Tool(
            name="create_event",
            description=(
                "Creates an event. 'start' and 'end' are ISO-8601 datetimes "
                "('2026-05-25T10:00:00+05:30') or bare dates ('2026-05-25') for all-day. "
                "'attendees' is an array of email addresses. 'timezone' is an IANA name "
                "like 'Asia/Kolkata' (used only with datetimes that lack a TZ offset)."
            ),
            inputSchema=_schema(
                {
                    "calendar_id": _CAL_ID,
                    "summary": {"type": "string", "description": "Event title"},
                    "start": {"type": "string", "description": "ISO-8601 datetime or date"},
                    "end": {"type": "string", "description": "ISO-8601 datetime or date"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "timezone": {"type": "string", "description": "IANA TZ, e.g. 'Asia/Kolkata'"},
                    "attendees": {"type": "array", "items": {"type": "string"}},
                    "send_invites": {
                        "type": "boolean",
                        "description": "Send email invites to attendees. Default false.",
                        "default": False,
                    },
                },
                ["summary", "start", "end"],
            ),
        ),
        types.Tool(
            name="update_event",
            description=(
                "Updates fields of an existing event (patch — only fields you provide are "
                "changed). Pass 'attendees' to fully replace the attendee list."
            ),
            inputSchema=_schema(
                {
                    "calendar_id": _CAL_ID,
                    "event_id": {"type": "string"},
                    "summary": {"type": "string"},
                    "start": {"type": "string", "description": "ISO-8601 datetime or date"},
                    "end": {"type": "string", "description": "ISO-8601 datetime or date"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "timezone": {"type": "string"},
                    "attendees": {"type": "array", "items": {"type": "string"}},
                    "send_updates": {
                        "type": "boolean",
                        "description": "Email change notifications to attendees. Default false.",
                        "default": False,
                    },
                },
                ["event_id"],
            ),
        ),
        types.Tool(
            name="delete_event",
            description="Deletes an event.",
            inputSchema=_schema(
                {
                    "calendar_id": _CAL_ID,
                    "event_id": {"type": "string"},
                    "send_updates": {
                        "type": "boolean",
                        "description": "Email cancellation notices to attendees. Default false.",
                        "default": False,
                    },
                },
                ["event_id"],
            ),
        ),
        types.Tool(
            name="find_free_time",
            description=(
                "Finds free time slots across the given calendars in a time range. "
                "Returns busy blocks and the largest free gap. Use this for scheduling."
            ),
            inputSchema=_schema(
                {
                    "calendar_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Calendars to combine. Default ['primary'].",
                    },
                    "time_min": {"type": "string", "description": "ISO-8601 start"},
                    "time_max": {"type": "string", "description": "ISO-8601 end"},
                    "timezone": {
                        "type": "string",
                        "description": "IANA TZ for the response. Default 'UTC'.",
                    },
                },
                ["time_min", "time_max"],
            ),
        ),
    ]


# ---------------------------------------------------------------------------
# Tool dispatch
# ---------------------------------------------------------------------------

def _handle(name: str, args: dict) -> list[types.TextContent]:
    account = args.get("account")
    if not account:
        return _text("Error: 'account' is required (full email of the Google account to use).")
    service = get_service(account)
    cal_id = args.get("calendar_id", "primary")

    if name == "list_calendars":
        result = service.calendarList().list().execute()
        out = []
        for c in result.get("items", []):
            out.append({
                "id": c.get("id"),
                "summary": c.get("summary"),
                "primary": c.get("primary", False),
                "access": c.get("accessRole"),
                "timezone": c.get("timeZone"),
            })
        return _text(json.dumps(out, indent=2, ensure_ascii=False))

    if name == "list_events":
        time_min = args.get("time_min")
        time_max = args.get("time_max")
        if not time_min:
            time_min = datetime.now(timezone.utc).isoformat()
        if not time_max:
            try:
                base = datetime.fromisoformat(time_min.replace("Z", "+00:00"))
            except ValueError:
                base = datetime.now(timezone.utc)
            time_max = (base + timedelta(days=7)).isoformat()
        params = dict(
            calendarId=cal_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            maxResults=int(args.get("max_results", 50)),
        )
        if args.get("query"):
            params["q"] = args["query"]
        result = service.events().list(**params).execute()
        events = [_event_summary(e) for e in result.get("items", [])]
        header = f"{len(events)} events in {cal_id} [{time_min} → {time_max}]"
        return _text(header + "\n" + json.dumps(events, indent=2, ensure_ascii=False))

    if name == "get_event":
        event = service.events().get(calendarId=cal_id, eventId=args["event_id"]).execute()
        return _text(json.dumps(_event_summary(event), indent=2, ensure_ascii=False))

    if name == "create_event":
        body = _build_event_body(args)
        send = "all" if args.get("send_invites") else "none"
        result = service.events().insert(
            calendarId=cal_id, body=body, sendUpdates=send,
        ).execute()
        return _text(
            f"Created event {result.get('id')} in {cal_id}.\n"
            f"Link: {result.get('htmlLink')}"
        )

    if name == "update_event":
        body = _build_event_body(args)
        if not body:
            return _text("No fields to update — pass at least one field other than event_id.")
        send = "all" if args.get("send_updates") else "none"
        result = service.events().patch(
            calendarId=cal_id, eventId=args["event_id"], body=body, sendUpdates=send,
        ).execute()
        return _text(
            f"Updated event {result.get('id')}.\n"
            f"Link: {result.get('htmlLink')}"
        )

    if name == "delete_event":
        send = "all" if args.get("send_updates") else "none"
        service.events().delete(
            calendarId=cal_id, eventId=args["event_id"], sendUpdates=send,
        ).execute()
        return _text(f"Deleted event {args['event_id']} from {cal_id}.")

    if name == "find_free_time":
        cals = args.get("calendar_ids") or ["primary"]
        body = {
            "timeMin": args["time_min"],
            "timeMax": args["time_max"],
            "timeZone": args.get("timezone", "UTC"),
            "items": [{"id": c} for c in cals],
        }
        result = service.freebusy().query(body=body).execute()
        out = {}
        for c, info in (result.get("calendars") or {}).items():
            out[c] = {
                "busy": info.get("busy", []),
                "errors": info.get("errors", []),
            }
        # Compute a single merged busy list + largest free gap
        all_busy: list[tuple[str, str]] = []
        for info in out.values():
            for b in info["busy"]:
                all_busy.append((b["start"], b["end"]))
        all_busy.sort()
        merged: list[list[str]] = []
        for s, e in all_busy:
            if merged and s <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])
        # Largest free gap inside [time_min, time_max]
        gaps = []
        prev_end = body["timeMin"]
        for s, e in merged:
            if prev_end < s:
                gaps.append({"start": prev_end, "end": s})
            prev_end = max(prev_end, e)
        if prev_end < body["timeMax"]:
            gaps.append({"start": prev_end, "end": body["timeMax"]})
        return _text(json.dumps({
            "calendars": out,
            "merged_busy": [{"start": s, "end": e} for s, e in merged],
            "free_gaps": gaps,
        }, indent=2, ensure_ascii=False))

    return _text(f"Unknown tool: {name}")


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        return _handle(name, arguments)
    except HttpError as e:
        return _text(f"Calendar API error: {e}")
    except ValueError as e:
        return _text(f"Error: {e}")
    except Exception as e:  # noqa: BLE001 — surface, never crash the tool call
        return _text(f"Unexpected error: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="google-calendar",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
