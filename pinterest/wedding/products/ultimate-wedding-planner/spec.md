# Product 2 — The Ultimate Wedding Planner (paid flagship)

**Brand:** Bride Bestie · **Price:** ~$12 · **Format:** print-ready PDF, **21 pages** (US Letter)
**Deliverable:** `out/ultimate-wedding-planner.pdf` · **Source:** `build.mjs` → `planner.html` · **Render:** `../render-pdf.mjs`
**Theme:** locked blush/dusty-rose + gold on warm ivory, Playfair + Lato.

## What it is
The paid workbook the free checklist upsells to. Turns the whole wedding into one fill-in-as-you-go
planner — every list, tracker, and template a bride needs, in a single beautiful document.

## The 21 pages
1 Cover · 2 Welcome + what's inside · 3 Wedding at a glance + key dates · 4 Our wedding vision ·
5–7 Full 12-month checklist (8 phases) · 8–9 Budget tracker (20 categories, est/actual/deposit/balance) ·
10–11 Guest list & RSVP tracker (40 rows) · 12 Vendor contacts & payments · 13 Wedding party ·
14 Day-of timeline (19 moments) · 15 Ceremony planner · 16 Reception planner (songs/toasts) ·
17 Seating chart (9 tables) · 18 Menu & catering · 19 Final-week checklist + emergency kit ·
20 Notes · 21 Upsell to the Complete Vault.

## Why it over-delivers at $12
- **21 designed pages** vs competitors' thin 2–13 page PDFs; covers budget + guests + vendors +
  timeline + seating + menu, not just a checklist.
- Genuinely usable: real categories, real day-of moments, real emergency-kit list — not filler.
- Looks like a $25–30 Etsy planner; priced at $12 because Pinterest (not a marketplace) is our traffic.

## Build notes
- `build.mjs` generates the HTML with JS loops (table rows, checklist phases) → easy to extend.
- QA: programmatic overflow check (`tmp/overflow.mjs` pattern) confirmed **0 pages clip**.

## Pending before launch
- [ ] Review + approve
- [ ] Create the Gumroad product (price $12) → confirm `bridebestie.gumroad.com/l/wedding-planner`
- [ ] (Optional) add true fillable form fields via pdf-lib for the digital-planner crowd
- [ ] (Optional) sell an editable Canva version later as the premium upgrade
