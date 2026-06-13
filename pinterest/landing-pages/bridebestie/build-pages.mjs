// build-pages.mjs — generate per-product landing pages into public/<slug>/index.html.
// One shared template + per-product copy. No prices anywhere: pricing lives on Gumroad
// only, so it can change without touching these pages. Run: node build-pages.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, "public");
const PRODUCTS_DIR = "/Users/kbtg/codebase/TY/pinterest/wedding/products";
const GUMROAD = "https://bridebestie.gumroad.com/l";

const PRODUCTS = [
  {
    slug: "12-month-wedding-checklist",
    coverFrom: "free-12-month-checklist/cover.png",
    title: "The 12-Month Wedding Checklist",
    metaTitle: "The 12-Month Wedding Planning Checklist — Bride Bestie",
    metaDesc: "A month-by-month wedding planning checklist. About 90 real tasks from \"just engaged\" to the wedding day, in one elegant printable.",
    eyebrow: "Start here",
    h1: 'Where do you even <span class="it">start?</span> Right here.',
    lead: "The whole wedding, broken into small monthly steps — about 90 of them, from \"just engaged\" all the way to handing off the rings. You only ever have to think about this month.",
    cta: "Get the checklist",
    inside: [
      "A complete month-by-month timeline, 12+ months out to the day itself",
      "Print-friendly checkboxes for every task",
      "A short \"how to use it\" page so you actually stick with it",
      "Notes space on every page for your own to-dos",
      "8 pages, US Letter, designed to look good on a fridge",
    ],
    body: [
      "Most wedding checklists are one giant wall of tasks. This one hands you the wedding a month at a time, so booking the venue, finding the dress, and chasing RSVPs each show up exactly when they should — and not a moment before.",
      "Print it at home or keep the PDF on your phone. Tick things off with a pen. That part is weirdly satisfying.",
    ],
    crossSell: ["wedding-planner", "wedding-budget-tracker"],
  },
  {
    slug: "wedding-planner",
    coverFrom: "ultimate-wedding-planner/cover.png",
    title: "The Ultimate Wedding Planner",
    metaTitle: "The Ultimate Wedding Planner — 21-Page Printable Workbook — Bride Bestie",
    metaDesc: "A 21-page printable wedding planning workbook: checklist, budget, guest list, vendors, day-of timeline, seating, menu and more.",
    eyebrow: "The workbook",
    h1: 'Your whole wedding, in <span class="it">one place</span>',
    lead: "A 21-page printable workbook that holds every list, number, and phone call between \"just engaged\" and \"I do\" — so your brain doesn't have to.",
    cta: "Get the planner",
    inside: [
      "Your wedding at a glance, key dates, and a countdown",
      "Pages to capture your vision, style, and colors",
      "The full 12-month planning checklist",
      "A budget tracker with 25 categories — estimated, actual, deposits, balances",
      "Guest list and RSVP tracker with 56 spots",
      "Vendor contacts and payment tracker",
      "An hour-by-hour day-of timeline",
      "Ceremony and reception planners, song requests, toasts",
      "Seating chart for 12 tables, menu planner, final-week checklist, emergency kit",
    ],
    body: [
      "Wedding planning scatters itself across notes apps, screenshots, and three different group chats. The planner pulls all of it onto paper: one binder you can flip open at a vendor meeting and actually find the number you wrote down.",
      "Print it at home on regular letter paper, as many times as you like. Mess a page up? Print it again.",
    ],
    crossSell: ["wedding-budget-tracker", "wedding-vault"],
  },
  {
    slug: "wedding-budget-tracker",
    coverFrom: null,
    title: "The Wedding Budget Tracker",
    metaTitle: "The Wedding Budget Tracker — Auto-Calculating Google Sheet — Bride Bestie",
    metaDesc: "A wedding budget spreadsheet that does the math for you. Totals, balances, and percentages update as you type.",
    eyebrow: "The spreadsheet",
    h1: 'Know exactly where the money is <span class="it">going</span>',
    lead: "An auto-calculating Google Sheet. You type the numbers, it does everything else — totals, balances owed, percentages, and a clear flag the moment you drift over budget.",
    cta: "Get the tracker",
    inside: [
      "Total budget vs. spent vs. remaining, always current",
      "An over/under flag that catches overspending the day it happens",
      "Balance still owed per vendor (cost minus deposits paid)",
      "A \"still to pay\" total across everything, at a glance",
      "22 categories pre-loaded, from venue to honeymoon to tips, plus blank rows for your own",
    ],
    body: [
      "Wedding budgets fail in the gap between \"what we said we'd spend\" and \"what we've actually put down in deposits.\" The tracker keeps both in view on one screen, which is usually all it takes to stay honest.",
      "It opens as a \"make a copy\" link, so the sheet lands in your own Google Drive — fully editable, completely yours. Works in Google Sheets and Excel, no formulas to build.",
    ],
    crossSell: ["wedding-planner", "wedding-vault"],
  },
  {
    slug: "wedding-day-timeline",
    coverFrom: "free-day-timeline/cover.png",
    title: "The Wedding Day Timeline",
    metaTitle: "The Wedding Day Timeline — Sample + Template — Bride Bestie",
    metaDesc: "An hour-by-hour wedding day timeline: a worked sample for a 4 PM ceremony plus a build-your-own template.",
    eyebrow: "The day itself",
    h1: 'How a wedding day actually <span class="it">flows</span>',
    lead: "A real, hour-by-hour timeline for a 4 PM ceremony — from hair and makeup at 9 AM to the send-off at 10 — plus a blank template to map your own day and share with every vendor.",
    cta: "Get the timeline",
    inside: [
      "A worked sample timeline, 19 moments, for the most common ceremony time",
      "The timing rules vendors wish couples knew: anchor to the ceremony, pad everything by 15 minutes, plan the first look, chase golden hour",
      "The timing mistakes that quietly wreck schedules",
      "A clean build-your-own template with 26 rows",
    ],
    body: [
      "The difference between a calm wedding day and a chaotic one is usually 15-minute padding and one shared schedule. Shift the sample to match your ceremony time, fill in the template, and send it to your photographer, DJ, and coordinator so everyone is reading the same page.",
    ],
    crossSell: ["wedding-planner", "wedding-decor-checklist"],
  },
  {
    slug: "name-change-guide",
    coverFrom: "name-change-guide/cover.png",
    title: "The Newlywed Name-Change Guide",
    metaTitle: "The Newlywed Name-Change Guide — Step-by-Step Checklist — Bride Bestie",
    metaDesc: "The exact order to change your name after the wedding, plus a master checklist of everywhere to update it. US process.",
    eyebrow: "After the wedding",
    h1: 'Change your name <span class="it">once</span>, in the right order',
    lead: "There is an order to this, and doing it backwards means repeat trips to the DMV. This guide walks the five steps in sequence, then hunts down everywhere else your old name is hiding.",
    cta: "Get the guide",
    inside: [
      "The 5-step order: certified certificates, Social Security, driver's license, passport, then everything else",
      "What to bring and which forms you need at each stop, with date-tracking lines",
      "A master checklist across government, banks, work, home, health, and your digital life",
      "The honeymoon travel-name gotcha that catches people at the airport gate",
    ],
    body: [
      "Eight pages, US process. Print it, keep every document in one folder like it tells you to, and get the whole thing done in one organized sweep instead of six annoyed afternoons.",
    ],
    crossSell: ["wedding-planner", "12-month-wedding-checklist"],
  },
  {
    slug: "adhd-wedding-checklist",
    coverFrom: "adhd-wedding-checklist/cover.png",
    title: "The ADHD-Friendly Wedding Checklist",
    metaTitle: "The ADHD-Friendly Wedding Checklist — Bride Bestie",
    metaDesc: "A wedding checklist built for ADHD brains: tiny concrete steps, a brain-dump page, and systems that actually work.",
    eyebrow: "A kinder way to plan",
    h1: 'A checklist that doesn’t make you <span class="it">freeze</span>',
    lead: "If a normal wedding checklist sends you straight into avoidance, you're not lazy and you're not behind. It's just too much at once. This one is built differently.",
    cta: "Get the checklist",
    inside: [
      "Tiny, concrete next steps — \"pick the season, just the season,\" \"email 2–3 venues\"",
      "A brain-dump page to get everything out of your head first",
      "A single-column, low-clutter layout that's easy on the eyes",
      "10 real ADHD systems: the 2-minute rule, alarms instead of memory, body-doubling, the 15-minute timer date",
      "A \"today's one thing\" tracker and a one-tiny-thing-a-day week strip",
    ],
    body: [
      "Every task in here is sized to be started. That's the whole trick — a wedding gets planned one stupidly small step at a time, and this checklist never asks for more than the next one.",
      "Warm, shame-free, and written by someone who gets it. Stick it on the fridge.",
    ],
    crossSell: ["wedding-day-timeline", "wedding-planner"],
  },
  {
    slug: "wedding-decor-checklist",
    coverFrom: "decor-checklist/cover.png",
    title: "The Wedding Decor Checklist",
    metaTitle: "The Wedding Decor Checklist — Ceremony to Reception — Bride Bestie",
    metaDesc: "Every wedding decor detail organized zone by zone, with the easy-to-miss items everyone forgets.",
    eyebrow: "The details",
    h1: 'The decor nobody remembers until it’s <span class="it">missing</span>',
    lead: "The cake knife. The extension cords. The easel for the seating chart. This checklist walks your wedding zone by zone so every detail is accounted for before the day, not during it.",
    cta: "Get the checklist",
    inside: [
      "Ceremony and cocktail hour: arch, aisle, signage, programs, bar decor",
      "Reception: centerpieces, table settings, favors, the sweetheart table",
      "Cake, dessert, lighting, and dance floor",
      "The \"don't forget these\" list — lighters, easels, teardown bins, a trash kit",
      "Quantity, setup, and teardown lines per zone, so someone owns every item",
    ],
    body: [
      "It's organized the way a real setup happens: walk the venue zone by zone with this in hand, note quantities, and write a name next to who sets up and who tears down. The day runs better when the small stuff has owners.",
    ],
    crossSell: ["wedding-day-timeline", "wedding-vault"],
  },
  {
    slug: "wedding-vault",
    coverFrom: "complete-wedding-vault/cover.png",
    title: "The Complete Wedding Vault",
    metaTitle: "The Complete Wedding Vault — Every Planner, Tracker & Checklist — Bride Bestie",
    metaDesc: "Every Bride Bestie wedding planner, tracker, and checklist in one bundle, on one matching design.",
    eyebrow: "The whole toolkit",
    h1: 'Everything, in <span class="it">one</span> download',
    lead: "Every Bride Bestie planner, tracker, and checklist, together on one matching blush design. Open the welcome file, follow the suggested order, and the whole wedding is handled.",
    cta: "Get the Vault",
    inside: [
      "The Ultimate Wedding Planner — the 21-page workbook at the center of it all",
      "The Wedding Budget Tracker — the auto-calculating Google Sheet",
      "The Wedding Day Timeline — sample plus build-your-own template",
      "The Wedding Decor Checklist — ceremony to reception, zone by zone",
      "The Newlywed Name-Change Guide — for after the big day",
      "The ADHD-Friendly Wedding Checklist — for when it all feels like too much",
      "The 12-Month Planning Checklist — the whole timeline at a glance",
    ],
    body: [
      "The Vault ships with a welcome guide that explains what's inside and the order that works: start with the 12-month checklist, set up the budget sheet before you book anything, make the planner your home base, and save the name-change guide for after the wedding.",
      "Instant download. Print anything as often as you like.",
    ],
    crossSell: ["wedding-planner", "wedding-budget-tracker"],
  },
];

const byName = Object.fromEntries(PRODUCTS.map((pr) => [pr.slug, pr]));

const page = (pr) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pr.metaTitle}</title>
<meta name="description" content="${pr.metaDesc}" />
<meta property="og:title" content="${pr.metaTitle}" />
<meta property="og:description" content="${pr.metaDesc}" />
${pr.coverFrom ? `<meta property="og:image" content="https://bridebestie.com/${pr.slug}/cover.png" />` : ""}
<meta property="og:type" content="website" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
<style>
  :root{
    --cream:#FBF5F2; --cream-deep:#F3EAD9;
    --charcoal:#34302B; --soft:#6f6a62;
    --sage:#C58A86; --gold:#C9A24B;
    --line:rgba(52,48,43,.14);
    --shadow:0 24px 60px -30px rgba(52,48,43,.4);
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Lato',sans-serif;background:var(--cream);color:var(--charcoal);line-height:1.65;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:880px;margin:0 auto;padding:0 24px;}
  h1,h2,h3{font-family:'Playfair Display',serif;font-weight:600;line-height:1.12;}
  a{color:inherit;}
  .eyebrow{font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:var(--sage);font-weight:700;}
  .btn{display:inline-block;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em;
       padding:15px 34px;border-radius:40px;background:var(--sage);color:#fff;
       box-shadow:0 12px 28px -14px rgba(197,138,134,.9);transition:transform .15s ease;}
  .btn:hover{transform:translateY(-2px);}
  header{padding:26px 0;}
  header .wrap{display:flex;align-items:center;justify-content:space-between;}
  .logo{font-family:'Playfair Display',serif;font-size:21px;font-weight:600;text-decoration:none;}
  .logo .amp{color:var(--sage);font-style:italic;}
  header nav a{text-decoration:none;font-size:14px;margin-left:26px;}
  header nav a:hover{color:var(--sage);}
  .hero{text-align:center;padding:54px 0 36px;
        background:radial-gradient(circle at 15% 12%, rgba(197,138,134,.10), transparent 42%),
                   radial-gradient(circle at 88% 86%, rgba(201,162,75,.12), transparent 44%);}
  .hero h1{font-size:clamp(34px,5.4vw,54px);max-width:16ch;margin:18px auto 0;}
  .hero h1 .it{font-style:italic;color:var(--sage);}
  .hero p.lead{font-size:clamp(16px,2vw,19px);color:var(--soft);max-width:52ch;margin:20px auto 0;}
  .hero .btn{margin-top:32px;}
  .hero .note{font-size:12.5px;color:var(--soft);margin-top:14px;}
  .coverimg{display:block;max-width:760px;width:100%;margin:44px auto 0;border-radius:14px;box-shadow:var(--shadow);}
  .inside{padding:64px 0 10px;}
  .inside h2{font-size:clamp(24px,3vw,32px);}
  .inside ul{list-style:none;margin:22px 0 0;columns:2;column-gap:36px;}
  @media(max-width:680px){.inside ul{columns:1;}}
  .inside li{font-size:15px;padding-left:26px;position:relative;margin-bottom:12px;break-inside:avoid;color:#46413a;}
  .inside li::before{content:"\\2713";color:var(--sage);font-weight:700;position:absolute;left:0;}
  .body-copy{padding:40px 0 0;}
  .body-copy p{font-size:15.5px;color:#46413a;max-width:62ch;margin-bottom:16px;}
  .closer{text-align:center;padding:64px 0 40px;}
  .closer h2{font-size:clamp(24px,3.2vw,34px);}
  .closer .btn{margin-top:24px;}
  .more{padding:34px 0 70px;}
  .more .label{text-align:center;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--soft);font-weight:700;margin-bottom:20px;}
  .more .row{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:680px;margin:0 auto;}
  @media(max-width:600px){.more .row{grid-template-columns:1fr;}}
  .more a.card{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px;
               text-decoration:none;transition:transform .15s ease, box-shadow .15s ease;}
  .more a.card:hover{transform:translateY(-3px);box-shadow:var(--shadow);}
  .more h3{font-size:17px;}
  .more p{font-size:13px;color:var(--soft);margin-top:5px;}
  footer{background:#fff;border-top:1px solid var(--line);padding:40px 0;text-align:center;}
  footer p{font-size:13px;color:var(--soft);margin-top:8px;}
  footer a{color:var(--sage);text-decoration:none;}
</style>
</head>
<body>

<header>
  <div class="wrap">
    <a class="logo" href="/">Bride <span class="amp">Bestie</span></a>
    <nav>
      <a href="/#shop">All planners</a>
      <a href="${GUMROAD}/${pr.slug}">Get it</a>
    </nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <div class="eyebrow">${pr.eyebrow}</div>
    <h1>${pr.h1}</h1>
    <p class="lead">${pr.lead}</p>
    <a class="btn" href="${GUMROAD}/${pr.slug}">${pr.cta} &rarr;</a>
    <div class="note">Instant download from Gumroad.</div>
    ${pr.coverFrom ? `<img class="coverimg" src="cover.png" alt="${pr.title} — preview of the pages inside" />` : ""}
  </div>
</section>

<section class="inside">
  <div class="wrap">
    <h2>What's inside</h2>
    <ul>
      ${pr.inside.map((i) => `<li>${i}</li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="body-copy">
  <div class="wrap">
    ${pr.body.map((b) => `<p>${b}</p>`).join("\n    ")}
  </div>
</section>

<section class="closer">
  <div class="wrap">
    <h2>${pr.title}</h2>
    <a class="btn" href="${GUMROAD}/${pr.slug}">${pr.cta} &rarr;</a>
  </div>
</section>

<section class="more">
  <div class="wrap">
    <div class="label">More from Bride Bestie</div>
    <div class="row">
      ${pr.crossSell
        .map((s) => byName[s])
        .map((x) => `<a class="card" href="/${x.slug}/"><h3>${x.title}</h3><p>${x.metaDesc}</p></a>`)
        .join("\n      ")}
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <a class="logo" href="/">Bride <span class="amp">Bestie</span></a>
    <p>Wedding planning, made simple. &nbsp;&middot;&nbsp; <a href="mailto:hello@bridebestie.com">hello@bridebestie.com</a></p>
    <p>&copy; Bride Bestie</p>
  </div>
</footer>

</body>
</html>
`;

for (const pr of PRODUCTS) {
  const dir = path.join(PUB, pr.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(pr));
  if (pr.coverFrom) {
    fs.copyFileSync(path.join(PRODUCTS_DIR, pr.coverFrom), path.join(dir, "cover.png"));
  }
  console.log("built:", `/${pr.slug}/`);
}
