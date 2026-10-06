---
name: travel
description: Entry point for any travel ask - flights, trains, buses, stays/hotels, tickets, PNRs, bookings, itineraries, trip planning, "how do I get from X to Y", "cheapest way home for Diwali", "check my booking email", "add this to my trip". Routes to pp-flights, pp-trains, pp-bus and the trip-planner (pp-trip skill), and carries the booking-to-trip checklist. Triggers on travel, trip, flight, train, bus, stay, hotel, ticket, PNR, booking, itinerary, journey, airport, station, metro.
---

# travel - route the ask, then finish the job

## Which tool

| Ask | Tool | Read first |
|---|---|---|
| Flight prices, times, direct vs connecting | `tooling/cli/flights/pp-flights` | `tooling/cli/flights/README.md` |
| Trains: search, seats, fares, route, coach order, PNR, live status | `tooling/cli/trains/pp-trains` | `tooling/cli/trains/README.md` and `docs/indian-railways-data-sources.md` |
| Local buses (Indore - Badnagar and any route on file) | `tooling/cli/bus/pp-bus` | `tooling/cli/bus/README.md` |
| Booking emails (tickets, PNR, hotel vouchers) | `gmail` skill (`pp-gmail`) | - |
| Showing the trip on the phone: map pins, day plan, booking cards, Drive files | `pp-trip` skill | `.claude/skills/pp-trip/SKILL.md` |

None of these tools can book or pay. The owner books; you find, check and record.

## Rules for any price comparison (the owner makes money decisions on these)

On 2026-09-30 a hand-written search script kept only `stops == 0 or price < 6000`,
threw away every 1-stop fare, and the owner was told "direct is cheapest" when a
1-stop was ₹1,850 cheaper. The owner found it on Skyscanner. So:

1. **Never write your own search loop or filter.** Use `pp-flights range` for
   "which day is cheapest" and `pp-flights search` for one date. `range` always
   searches all stops and prints cheapest-overall next to cheapest-direct.
2. **Never drop stops unless the owner said "direct only".** "I prefer direct"
   means show the direct price next to the cheapest, not hide the cheapest.
3. **Match the constraint with `--after` / `--before`**, not by eye. "No leave"
   on a work day means departing after work, so say which window you used.
4. **Say exactly what was searched**: routes, dates, sources, time window. The
   owner must be able to check the answer against his own screen.
5. **If a date could not be searched, say so** and do not rank it.
6. **Skyscanner is the only price source.** The owner chose it; Google Flights was
   removed after it showed ₹13,352 for a ₹7,262 fare. Do not add another source
   without asking.

## How to present options (one format, every time)

The owner asked for this after several summaries that changed shape and left out
the flight's day. Always:

- **Show every workable option in the window, not just the best.** One row per
  option, sorted by date, then price.
- **Fixed columns, in this order:** date with weekday · days at home (if relevant)
  · flight numbers · departs → arrives (with the arrival day if it differs) ·
  travel time · stops · price · leave needed.
- **Leave needed is computed, not guessed**: from the bus or train that gets the
  owner to the airport in time (ground time + 90 min before departure), against a
  09:30-18:30 work day. Name the bus.
- **The recommendation comes after the table**, one line, naming its row.
- Keep the same columns in every follow-up so rows can be compared.

## Traps

- **Run searches through pp-flights one after another, never in parallel.** It
  paces Skyscanner itself (45 s apart per route) and caches answers for 30 minutes.
- **A flight number is shown only when Skyscanner includes it.** Otherwise get it
  from the owner's screen or the e-ticket, never invent one.
- **Recheck a price right before the owner books.** Say when it was checked.
- **Airport and station codes are not cities.** BOM and NMI are both "Mumbai" but
  50 km apart; MMCT and CSMT are different stations. Name the exact one.
- **The terminal is on the airline's e-ticket PDF**, not in the email body.
  Read the PDF (`pdftotext`) before saying which terminal.

## After the owner books: the checklist

A booking is not done until it is on the trip page with its files. Do all of it
without being asked:

1. Read the confirmation email (`pp-gmail search`), pull the PNR, times, seat and
   price. Download the PDF attachments. If the booking email has no PDF (IRCTC often
   does not), print the email HTML to PDF with headless Chrome.
2. Add it to the trip with the `pp-trip` skill, and work through its **New trip
   checklist** (pins, days, bookings, Drive folder, deploy, layout check). That
   checklist is the single source; do not stop at the booking card.
3. Add only what is fixed or agreed. No suggested cafes or sights unless the owner
   asked for them.
