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

## Traps

- **pp-flights is Skyscanner and rate-limits with a 403.** Run searches one at a
  time with a few seconds between them. Never fan them out in parallel.
- **pp-flights gives no flight number.** Get it from the owner's screen or the
  e-ticket, never invent one.
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
2. Add it to the trip with the `pp-trip` skill. For a new trip that means: pins,
   `days`, `bookings`, **and** the Drive folder (`My Drive / Trips / <trip name> -
   <Mon YYYY>`) with every document uploaded and linked in `files`, plus
   `docsFolderUrl`. Deploy, then run `check-layout.py`.
3. Add only what is fixed or agreed. No suggested cafes or sights unless the owner
   asked for them.
