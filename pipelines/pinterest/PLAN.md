# Pinterest Business — Action Plan

> A repeatable, free system for turning a niche pin business into something Claude can run.
> **Phase 1 (this plan): you hand Claude an idea, Claude produces a finished, ready-to-post
> pin.** Research and tracking come in Phase 1.5. The PDF product + funnel come in Phase 2.

**First niche:** keto (sell a paid recipe/meal-plan PDF on Gumroad). Posting is manual.

---

## 1. Architecture — ONE skill + ONE folder per niche

The key decision: **post-generation is a single global skill, fed by a small data folder
per niche.** Not a skill per niche; not a folder alone.

> The **skill is the machine** (a chef / a printing press). It knows *how* to make a pin
> **in general** — rendering, layouts, Pinterest rules, the step-by-step. Identical for
> every niche.
>
> The **niche folder is the recipe card + ingredients**. It says: here's the brand, the
> voice, the offer link, the niche hooks, example titles, the image vibe. Different per niche.
>
> **One machine, many recipe cards.** Add a niche = drop a new folder, not a new machine.

**Why not a skill per niche?** The renderer, templates, and Pinterest know-how would be
copy-pasted into every niche skill — fix one bug, edit it 10 times. The point of going
multi-niche is to write the engine **once**.

**Why not a folder with no skill?** A folder can't *run* — can't render an image or execute
steps. The folder holds the *knowledge*; the skill holds the *ability*.

| Lives in the global skill `pinterest-make-post` (write once) | Lives in the per-niche folder `pinterest/<niche>/` (one per niche) |
|---|---|
| The step-by-step generation process | Brand: colors, fonts, logo/handle |
| HTML/CSS pin templates (the layouts) | Voice / tone |
| The Playwright image renderer | Offer URL (Gumroad link) |
| Pinterest best practices (size, SEO, hashtags) | Board names |
| Image sourcing logic (CSS / stock / AI) | **Niche playbook**: hooks, what sells, do/don'ts, example titles, image vibe, keywords |
| Art-direction reasoning | The generated pins (`posts/`) |

---

## 2. Folder structure (niche folders = DATA only)

```
pinterest/
├─ PLAN.md
└─ keto/                      ← the "recipe card" for this niche
   ├─ config.json             # brand, offer URL, boards, fonts/colors
   ├─ playbook.md             # niche "brain" — voice, hooks, what sells,
   │                          #   example titles, image vibe, keywords, do/don'ts
   └─ posts/                  # OUTPUT — one folder per generated pin
      └─ 2026-06-02-7-keto-breakfasts/
         ├─ image.png         # final 1000x1500 pin, ready to upload
         └─ post.md           # title, description, alt text, hashtags, board, best time
```

The skill itself (global, installed via `claude-router`, NOT in this repo):
```
pinterest-make-post/
├─ SKILL.md            # the generation process Claude follows
├─ templates/          # shared pin layouts (HTML/CSS)
│  ├─ listicle.html        ·  big numbered text ("7 Keto Breakfasts")
│  ├─ photo-bar.html       ·  food photo + title bar
│  ├─ free-guide.html      ·  PDF mockup + "grab the plan"
│  └─ recipe-card.html     ·  clean saveable card
├─ render.mjs          # Playwright: fills a template -> exports 1000x1500 PNG
└─ lib/                # stock.mjs (Pexels), ai-image.mjs (Pollinations), helpers
```

---

## 3. The per-niche files

### `config.json` — structured settings
```json
{
  "niche": "keto",
  "offerUrl": "https://gumroad.com/l/<placeholder>",
  "handle": "@yourketohandle",
  "boards": ["Keto Recipes", "Keto Meal Plans", "Low Carb Dinners"],
  "brand": {
    "palette": ["#1B4332", "#FFB703", "#FFFFFF"],
    "headlineFont": "Poppins",
    "bodyFont": "Inter"
  }
}
```

### `playbook.md` — the niche knowledge (makes a keto pin feel like keto)
- **Voice:** warm, encouraging, no-nonsense.
- **Hooks that sell:** carb counts ("under 10g carbs"), speed ("15-min"), "no-cook", "meal prep".
- **Example winning titles** to imitate.
- **Image vibe:** bright natural light, single dish, bacon/eggs/avocado palette; avoid sad-diet look.
- **Keywords** to weave into descriptions.
- **Do / Don't:** no medical claims, no "lose 10 lbs in a week".

---

## 4. What happens when you share an idea

You say: *"Make a keto pin: 7 high-protein keto breakfasts."*

1. **Load the niche** — skill reads `keto/config.json` + `keto/playbook.md`.
2. **Art-direct** — picks a template + a backdrop layer (CSS gradient / stock photo / AI).
3. **Write copy** — keto-voice title, keyword-rich description, alt text, hashtags, best
   board, suggested time, the Gumroad link.
4. **Render** — `render.mjs` fills the template with copy + brand colors/fonts (+ backdrop)
   and exports a crisp **1000x1500 `image.png`**.
5. **Save** — `keto/posts/<slug>/` with `image.png` + `post.md`.
6. **You** upload `image.png` to Pinterest and copy the fields from `post.md`. Done.

Second niche later: *"make a yoga pin: …"* — same machine, reads `pinterest/yoga/`. The
skill never changes.

---

## 5. Image engine — catchy, free, Claude art-directs per pin

The scroll-stopper is the **design**, not the photo. 3 layers, chosen per pin:
- **Layer A — Design template (~70% of the catchiness):** bold typographic layouts as
  HTML/CSS (listicle, photo-bar, free-guide, recipe-card), rendered to PNG.
- **Layer B — Backdrop (Claude picks):** (1) pure CSS gradients/patterns; (2) free stock
  food photos (Pexels/Unsplash — bright, single-dish, natural light); (3) free AI
  (Pollinations.ai, no key) for custom backgrounds/mood.
- **Layer C — Brand polish:** fonts, palette, handle watermark from `config.json`.

Pin specs: **1000x1500 (2:3)**, static. (Motion pins = later.)

---

## 6. Build / install (Phase 1)

| Item | Cost | Notes |
|---|---|---|
| Node + Playwright (chromium) | free | the renderer; bundled with the skill |
| Pollinations.ai | free, no key | AI backdrop layer |
| Pexels free API key | free | optional stock layer (can skip) |
| Gumroad link | free | placeholder for now |
| The skill `pinterest-make-post` | — | via `claude-router`, both accounts |
| `keto/config.json` + `keto/playbook.md` | — | filled in together |

No paid services.

---

## 7. Deferred

- **Phase 1.5:** `pinterest-validate` (Claude critiques + researches an idea you bring) and
  `pinterest-track` (metrics → make more of what wins), with a Google Sheet idea bank.
- **Phase 2:** write the actual keto PDF; own landing page + email list; motion pins.
- **Later / maybe:** automated API posting (multi-account ban risk).

---

## 8. Status — Phase 1 built ✅ (2026-06-02)

- ✅ Skill `pinterest-make-post` built + installed in **both** accounts
  (`~/.claude-personal/skills/` and `~/.claude-work/skills/`). Bundles SKILL.md, 4
  templates, `render.mjs` (Playwright), `lib/stock.mjs` + `lib/ai-image.mjs`.
- ✅ `keto/config.json` + `keto/playbook.md` created.
- ✅ All 4 templates smoke-tested; AI backdrop (Pollinations) verified working.
- ✅ First real pin generated: `keto/posts/2026-06-02-7-high-protein-keto-breakfasts/`.
- ⏭️ Next: add a free `PEXELS_API_KEY` to `~/.zshrc` to unlock the stock-photo layer;
  fill in real `handle` + Gumroad `offerUrl` in `keto/config.json`; open the keto posting
  account; start a safe ramp (2-3 pins/day, then up).

## 9. How to use

Restart your `claude-personal` session, then just say:
> "Make a keto pin: 15-minute keto dinners for busy weeknights"

The skill reads `keto/config.json` + `keto/playbook.md`, art-directs, renders, and saves
`image.png` + `post.md` + `post.json` into `keto/posts/<slug>/`.

**To post:** say "open my pinterest board" → the `pinterest-board` skill launches a local
server at `http://localhost:4000`: a per-niche board with a big image preview and one-tap
**Copy** buttons for each field. Copy them into Pinterest one by one, then tick **Posted**
(optionally paste the live pin URL) — status is saved to `<niche>/posts.json` automatically.

New niche later: create `pinterest/<niche>/config.json` + `playbook.md` — the skill is unchanged.

## 10. Portability (using another laptop)

Skills are **local files**, NOT synced by your Claude login. On a new machine the skill
won't exist until you copy it there. To make it portable:
1. Keep the skill in a git repo (push `pinterest-make-post/` minus `node_modules`).
2. On the new machine: clone into `~/.claude-personal/skills/pinterest-make-post/`, then run
   `npm install --registry=https://registry.npmjs.org && npx playwright install chromium`
   (Playwright/Chromium are per-machine and can't travel via git).
3. The niche data (`TY/pinterest/`) travels with the TY repo via git as normal.
