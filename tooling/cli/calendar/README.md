# pp-cal

Read-only agenda from Google Calendar. Defaults: `kushalbakliwal25@gmail.com`, calendar
`primary`, IST, 2 days.

```bash
tooling/cli/calendar/pp-cal agenda --days 7 --no-routine   # hide repeating events
```

Only `primary` by default: the account has 13 calendars and 11 duplicate the primary's day
(see `apps/dayboard/CLAUDE.md`). Auth reuses `tooling/mcp/google-shared/tokens/<email>.json`,
same as pp-gmail. Exit 3 when the fetch fails. Tests: `test_pp_cal.py` (pure formatter).
