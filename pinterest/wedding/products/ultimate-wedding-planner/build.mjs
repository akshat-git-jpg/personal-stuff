// build.mjs — generates planner.html (The Ultimate Wedding Planner) then it's rendered to PDF.
// Static printable workbook on the locked blush theme. Run: node build.mjs  ->  writes planner.html
import { writeFileSync } from "fs";

/* ---------- helpers ---------- */
const esc = (s) => s;
const lines = (n) => Array.from({ length: n }, () => `<div class="ln"></div>`).join("");
const field = (label, w = "") =>
  `<div class="fld" style="${w}"><span class="flab">${label}</span><span class="fline"></span></div>`;
const fgrid = (arr) => `<div class="fgrid">${arr.map((l) => field(l)).join("")}</div>`;
const checks = (items) =>
  `<div class="items">${items.map((i) => `<div class="item"><span class="cb"></span>${i}</div>`).join("")}</div>`;
const phase = (when, tag, items) =>
  `<div class="phase"><div class="tf"><span class="when">${when}</span><span class="tag">${tag}</span></div>${checks(items)}</div>`;
function table(headers, rows, widths = []) {
  const th = headers.map((h, i) => `<th${widths[i] ? ` style="width:${widths[i]}"` : ""}>${h}</th>`).join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${headers.map((_, i) => `<td>${(r && r[i] != null && r[i] !== "" ? r[i] : "&nbsp;")}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table class="tbl"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
const blanks = (n) => Array.from({ length: n }, () => null);
const head = (eyebrow, title, sub = "") =>
  `<div class="ph"><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><hr class="rule">${
    sub ? `<p class="lead">${sub}</p>` : ""
  }`;
const page = (cls, inner, footer = true) =>
  `<section class="page ${cls}">${inner}${
    footer ? `<div class="foot"><span class="bm">Bride Bestie</span><span>bridebestie.com</span></div>` : ""
  }</section>`;

/* ---------- content ---------- */
const pages = [];

// 1. COVER
pages.push(
  page(
    "cover",
    `<div class="frame"></div>
     <div class="eyebrow" style="margin-bottom:26px;">Bride Bestie</div>
     <h1>The Ultimate<br>Wedding <span class="script">Planner</span></h1>
     <hr class="rule" style="margin:24px auto;">
     <p class="sub">Everything you need to plan the whole day — in one beautiful place.</p>
     <div class="owner"><span>This planner belongs to</span><span class="oline"></span></div>
     <div class="cfoot">bridebestie.com</div>`,
    false
  )
);

// 2. WELCOME
pages.push(
  page(
    "welcome",
    head("Start here", "Hey, bride-to-be 👋") +
      `<p class="body">Congratulations — you're getting married! Planning a wedding has a thousand
       moving parts, and this planner exists to hold all of them so your brain doesn't have to. Work
       through it section by section, fill things in as you book them, and keep it somewhere you'll
       actually look. You don't have to do it all today; just take the next step.</p>
      <div class="how">
        <h3>What's inside</h3>
        <div class="howcols">
          <ul>
            <li>Your wedding at a glance + key dates</li>
            <li>A page for your vision, style &amp; colors</li>
            <li>The full 12-month planning checklist</li>
            <li>Budget tracker (every category)</li>
            <li>Guest list &amp; RSVP tracker</li>
          </ul>
          <ul>
            <li>Vendor contacts &amp; payments</li>
            <li>Wedding party details</li>
            <li>Day-of timeline + ceremony &amp; reception</li>
            <li>Seating chart &amp; menu planner</li>
            <li>Final-week checklist, emergency kit &amp; notes</li>
          </ul>
        </div>
      </div>
      <p class="body">However you use it, take it at your own pace. Book the big things first, let the
       little details fall into place, and come back to these pages whenever your head feels full.
       Everything you decide has a home in here.</p>
      <p class="sign">You've got this — I'm right here with you. xo, your Bride Bestie</p>`
  )
);

// 3. AT A GLANCE
pages.push(
  page(
    "",
    head("The basics", "Your wedding at a glance") +
      fgrid([
        "Couple's names", "Wedding date",
        "Days to go", "Overall budget",
        "Ceremony venue", "Ceremony time",
        "Reception venue", "Reception time",
        "Guest count", "Wedding style / theme",
        "Colors", "Wedding party size",
        "Officiant", "Planner / coordinator",
      ]) +
      `<div class="spacer"></div>` +
      head("", "Key dates to remember") +
      table(["Milestone", "Date", "Done"], [
        ["Engagement", "", ""], ["Booked the venue", "", ""], ["Save-the-dates sent", "", ""],
        ["Invitations sent", "", ""], ["RSVP deadline", "", ""], ["Final headcount due", "", ""],
        ["Final dress fitting", "", ""], ["Marriage license", "", ""], ["Rehearsal dinner", "", ""],
        ["Wedding day", "", ""], ["Honeymoon", "", ""], ["", "", ""], ["", "", ""],
      ], ["58%", "30%", "12%"]) +
      `<div class="spacer-sm"></div>` +
      head("", "Our wedding countdown") +
      `<div class="countdown">
        <div class="cdbox"><span class="cdnum"></span><span class="cdlab">months to go</span></div>
        <div class="cdbox"><span class="cdnum"></span><span class="cdlab">weeks to go</span></div>
        <div class="cdbox"><span class="cdnum"></span><span class="cdlab">days to go</span></div>
      </div>`
  )
);

// 4. VISION
pages.push(
  page(
    "",
    head("The dream", "Our wedding vision", "Before the logistics — capture the feeling you want.") +
      `<div class="vis">
        <div class="vblock"><h3>Three words for our day</h3>${lines(2)}</div>
        <div class="vblock"><h3>Our color palette</h3>
          <div class="swatches"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="hint">color in or label each swatch</div>
        </div>
      </div>
      <div class="vis">
        <div class="vblock"><h3>The feeling we want</h3>${lines(7)}</div>
        <div class="vblock"><h3>Our style &amp; theme</h3>${lines(7)}</div>
      </div>
      <div class="vis">
        <div class="vblock"><h3>Absolute must-haves</h3>${lines(8)}</div>
        <div class="vblock"><h3>Nice-to-haves</h3>${lines(8)}</div>
      </div>
      <div class="vis">
        <div class="vblock"><h3>Definitely not</h3>${lines(6)}</div>
        <div class="vblock"><h3>Inspiration &amp; ideas</h3>${lines(6)}</div>
      </div>`
  )
);

// 5-7. CHECKLIST
const phases = [
  ["12+ months out", "Just engaged", ["Celebrate &amp; share the news", "Set your overall budget", "Decide a rough date / season", "Draft a guest-count range", "Choose your wedding party", "Start an inspiration board", "Settle on a vibe / style", "Tour &amp; book your venue"]],
  ["10–12 months", "Big vendors", ["Hire a planner / coordinator", "Book your photographer", "Book your videographer", "Book your caterer", "Start the dress search", "Build your guest list + addresses", "Reserve hotel room block", "Create your wedding website"]],
  ["8–10 months", "Style &amp; save-the-dates", ["Order your dress", "Book your florist", "Book band or DJ", "Book your officiant", "Choose &amp; order save-the-dates", "Send save-the-dates", "Decide bridesmaid dresses", "Plan ceremony details"]],
  ["6–8 months", "Food &amp; logistics", ["Book cake baker; tastings", "Arrange transportation", "Set up gift registry", "Book the honeymoon; check passports", "Reserve rentals", "Shop groom / groomsmen attire", "Book hair &amp; makeup; trial", "Plan rehearsal dinner"]],
  ["4–6 months", "Paper &amp; promises", ["Finalize menu &amp; tasting", "Order invitations", "Choose wedding rings", "Plan readings &amp; vows", "Confirm honeymoon", "Plan the bachelorette / party", "Book extras (photo booth, etc.)", "Draft day-of timeline"]],
  ["2–4 months", "Send &amp; confirm", ["Mail invitations (~8 wks out)", "Finalize playlist + do-not-play", "First dress fitting", "Purchase favors", "Write your vows", "Buy gifts for party &amp; parents", "Apply for marriage license", "Confirm all vendors"]],
  ["6–8 weeks", "Numbers &amp; seating", ["Track RSVPs; chase stragglers", "Final headcount to caterer", "Build seating chart", "Final dress fitting", "Break in your shoes", "Confirm timeline w/ vendors", "Pick up marriage license", "Write thank-yous as gifts arrive"]],
  ["1–2 weeks", "Hand it off", ["Confirm arrival times", "Delegate day-of tasks", "Final payments + tip envelopes", "Assemble emergency kit", "Pack for honeymoon", "Confirm transport &amp; hotel", "Rehearse vows", "Plan something relaxing"]],
];
const cl = (a, b, title, extra = "") => page("", head("The timeline", title) + phases.slice(a, b).map((p) => phase(...p)).join("") + extra);
pages.push(cl(0, 3, "12-month checklist · part 1"));
pages.push(cl(3, 6, "12-month checklist · part 2"));
pages.push(cl(6, 8, "12-month checklist · part 3",
  `<div class="spacer"></div>` + head("", "Notes &amp; reminders for the final stretch") + lines(8)));

// 8-9. BUDGET
const budgetCats = ["Venue", "Catering &amp; bar", "Photography", "Videography", "Flowers &amp; florals",
  "Music / DJ / band", "Bride attire &amp; alterations", "Groom attire", "Hair &amp; makeup",
  "Cake / dessert", "Stationery &amp; invites", "Wedding rings", "Decor &amp; rentals", "Transportation",
  "Favors &amp; gifts", "Officiant", "Marriage license", "Planner / coordinator", "Beauty &amp; prep",
  "Photo booth / extras", "Ceremony fees", "Welcome / rehearsal dinner", "Honeymoon", "Vendor tips",
  "Miscellaneous"];
const budgetCols = ["Category", "Estimated", "Actual", "Deposit paid", "Balance due"];
const budgetW = ["32%", "17%", "17%", "17%", "17%"];
pages.push(
  page(
    "",
    head("Money", "Wedding budget tracker", "Set a number first — almost everything else flexes around it.") +
      fgrid(["Total budget", "Total spent", "Remaining", "Who's contributing"]) +
      `<div class="spacer-sm"></div>` +
      table(budgetCols,
        [...budgetCats.slice(0, 18).map((c) => [c, "", "", "", ""]), ...blanks(4).map(() => ["", "", "", "", ""])],
        budgetW)
  )
);
pages.push(
  page(
    "",
    head("Money", "Budget tracker (continued)") +
      table(budgetCols,
        [...budgetCats.slice(18).map((c) => [c, "", "", "", ""]), ...blanks(17).map(() => ["", "", "", "", ""]), ["TOTAL", "", "", "", ""]],
        budgetW)
  )
);

// 10-11. GUEST LIST
const guestHdr = ["Name", "# in party", "Address", "RSVP", "Meal", "Gift", "Thank-you"];
const guestW = ["24%", "9%", "27%", "8%", "12%", "10%", "10%"];
pages.push(page("", head("Guests", "Guest list &amp; RSVP tracker") + table(guestHdr, blanks(28).map(() => []), guestW)));
pages.push(page("", head("Guests", "Guest list (continued)") + table(guestHdr, blanks(28).map(() => []), guestW)));

// 12. VENDORS
pages.push(
  page(
    "",
    head("Vendors", "Vendor contacts &amp; payments") +
      table(["Vendor type", "Company / name", "Phone / email", "Total", "Deposit", "Balance", "Due"],
        ["Venue", "Caterer", "Bar service", "Photographer", "Videographer", "Florist", "DJ / band",
         "Baker", "Hair &amp; makeup", "Officiant", "Rentals", "Transport", "Stationery",
         "Photo booth", "Planner"].map((v) => [v, "", "", "", "", "", ""])
          .concat(blanks(11).map(() => ["", "", "", "", "", "", ""])),
        ["16%", "21%", "21%", "11%", "11%", "11%", "9%"])
  )
);

// 13. WEDDING PARTY
pages.push(
  page(
    "",
    head("Your people", "Wedding party") +
      table(["Role", "Name", "Phone", "Attire / notes"],
        ["Maid / matron of honor", "Best man", "Bridesmaid", "Bridesmaid", "Bridesmaid", "Bridesmaid",
         "Bridesmaid", "Groomsman", "Groomsman", "Groomsman", "Groomsman", "Groomsman",
         "Flower girl", "Ring bearer", "Ushers", "Officiant", "Parents of the bride",
         "Parents of the groom"].map((r) => [r, "", "", ""])
          .concat(blanks(8).map(() => ["", "", "", ""])),
        ["26%", "27%", "20%", "27%"])
  )
);

// 14. DAY-OF TIMELINE
pages.push(
  page(
    "",
    head("The big day", "Wedding day timeline", "Block out the hours — share this with every vendor.") +
      table(["Time", "What's happening", "Who / where"],
        [...["Hair &amp; makeup begins", "Photographer arrives", "Getting dressed", "First look",
         "Wedding party photos", "Family photos", "Guests arrive", "Ceremony begins", "Cocktail hour",
         "Grand entrance", "First dance", "Welcome &amp; dinner", "Toasts", "Parent dances",
         "Cake cutting", "Open dancing", "Bouquet / garter", "Last dance", "Send-off"].map((e) => ["", e, ""]),
         ...blanks(7).map(() => ["", "", ""])],
        ["16%", "50%", "34%"])
  )
);

// 15. CEREMONY
pages.push(
  page(
    "",
    head("Ceremony", "Ceremony planner") +
      `<div class="vis"><div class="vblock"><h3>Order of events</h3>${lines(13)}</div>
       <div class="vblock"><h3>Processional order</h3>${lines(13)}</div></div>` +
      head("", "Music") +
      fgrid(["Prelude", "Processional", "Bride's entrance", "Recessional"]) +
      `<div class="spacer"></div>` +
      `<div class="vis"><div class="vblock"><h3>Readings &amp; readers</h3>${lines(11)}</div>
       <div class="vblock"><h3>Vows &amp; special touches</h3>${lines(11)}</div></div>`
  )
);

// 16. RECEPTION
pages.push(
  page(
    "",
    head("Reception", "Reception planner") +
      `<div class="vis"><div class="vblock"><h3>Must-play songs</h3>${lines(13)}</div>
       <div class="vblock"><h3>Do NOT play</h3>${lines(13)}</div></div>` +
      head("", "Special moments &amp; songs") +
      fgrid(["First dance song", "Father–daughter song", "Mother–son song", "Cake-cutting song", "Bouquet toss song", "Last dance song"]) +
      `<div class="spacer"></div>` +
      `<div class="vis"><div class="vblock"><h3>Toast order</h3>${lines(11)}</div>
       <div class="vblock"><h3>Reception flow &amp; reminders</h3>${lines(11)}</div></div>`
  )
);

// 17. SEATING
const tableBox = (n) => `<div class="seat"><div class="seathd">Table ${n}</div>${lines(8)}</div>`;
pages.push(page("", head("Seating", "Seating chart", "One card per table — list every guest seated there.") + `<div class="seatgrid">${Array.from({ length: 12 }, (_, i) => tableBox(i + 1)).join("")}</div>`));

// 18. MENU
pages.push(
  page(
    "",
    head("Food", "Menu &amp; catering") +
      `<div class="vis"><div class="vblock"><h3>Cocktail hour</h3>${lines(6)}</div>
       <div class="vblock"><h3>Appetizers</h3>${lines(6)}</div></div>
      <div class="vis"><div class="vblock"><h3>Main course(s)</h3>${lines(7)}</div>
       <div class="vblock"><h3>Sides</h3>${lines(7)}</div></div>
      <div class="vis"><div class="vblock"><h3>Cake &amp; dessert</h3>${lines(6)}</div>
       <div class="vblock"><h3>Bar &amp; drinks</h3>${lines(6)}</div></div>` +
      head("", "Dietary needs &amp; allergies") + lines(5)
  )
);

// 19. FINAL WEEK
pages.push(
  page(
    "",
    head("Almost there", "The final week") +
      checks(["Confirm arrival times with every vendor", "Hand off rings, vows &amp; payments to your point person",
        "Give the day-of timeline to the wedding party", "Confirm final headcount &amp; seating", "Pick up attire &amp; do a final try-on",
        "Break in your shoes", "Pack for the honeymoon", "Prepare tip envelopes (labeled)", "Confirm transportation &amp; hotel",
        "Steam / press all attire", "Charge cameras / phones", "Get a manicure", "Drink water &amp; sleep", "Take a breath — it's almost here"]) +
      head("", "Day-of emergency kit") +
      checks(["Sewing kit &amp; safety pins", "Stain remover (Tide pen)", "Band-aids &amp; pain reliever", "Deodorant &amp; mints",
        "Makeup for touch-ups", "Bobby pins &amp; hairspray", "Tissues", "Phone charger", "Snacks &amp; water", "Flat shoes",
        "Comfortable socks", "Cash for tips", "Lint roller", "Clear nail polish", "Eye drops &amp; allergy meds", "Straws (for lipstick)",
        "Umbrella, just in case", "Copy of the day-of timeline"]) +
      head("", "Who to call if something comes up") +
      fgrid(["Planner / coordinator", "Maid of honor", "Best man", "Venue contact"])
  )
);

// 20. NOTES
pages.push(page("", head("Notes", "Notes &amp; ideas") + lines(40)));

// 21. BACK / UPSELL
pages.push(
  page(
    "back",
    `<div class="bcard">
       <div class="eyebrow">Keep going, bestie</div>
       <h2>Want it to do the math for you?</h2>
       <p>This planner keeps everything in one place. The <b>Complete Wedding Vault</b> adds the
          auto-calculating budget spreadsheet, editable templates, and every printable bundled together.</p>
       <a class="cta" href="https://bridebestie.gumroad.com">See the Complete Vault →</a>
     </div>
     <div class="bend"><div class="big">Happy planning.</div><div class="site">bridebestie.com · @bridebestie</div></div>`,
    false
  )
);

/* ---------- shell + CSS ---------- */
const css = `
:root{ --cream:#FBF5F2; --charcoal:#34302B; --blush:#C58A86; --gold:#C9A24B; --soft:#6f6a62; --line:rgba(52,48,43,.16); }
@page{ size:Letter; margin:0; }
*{ box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html,body{ margin:0; padding:0; }
body{ font-family:'Lato',sans-serif; color:var(--charcoal); }
.page{ width:8.5in; height:11in; background:var(--cream); padding:0.62in 0.66in 0.5in; page-break-after:always; position:relative; overflow:hidden; }
.page:last-child{ page-break-after:auto; }
h1,h2,h3{ font-family:'Playfair Display',serif; font-weight:600; }
.eyebrow{ font-size:10.5px; letter-spacing:.34em; text-transform:uppercase; color:var(--blush); font-weight:700; }
.ph h2{ font-size:27px; margin:4px 0 0; }
.rule{ height:2px; width:58px; background:var(--gold); border:0; margin:13px 0; }
.lead{ font-size:12.5px; color:var(--soft); margin:-4px 0 15px; max-width:6.4in; }
.body{ font-size:12.8px; line-height:1.6; color:#46413a; max-width:6.4in; margin:0 0 14px; }
.foot{ position:absolute; bottom:0.34in; left:0.66in; right:0.66in; display:flex; justify-content:space-between; font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--soft); }
.foot .bm{ color:var(--blush); font-weight:700; }
.spacer{ height:24px; } .spacer-sm{ height:13px; }

/* welcome — vertically balance the airy page */
.welcome{ display:flex; flex-direction:column; justify-content:center; }

/* countdown */
.countdown{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:8px; }
.cdbox{ background:#fff; border:1px solid var(--line); border-radius:11px; padding:22px 12px 16px; text-align:center; display:flex; flex-direction:column; gap:14px; }
.cdnum{ height:34px; border-bottom:1px solid rgba(52,48,43,.3); margin:0 14px; }
.cdlab{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--soft); font-weight:700; }

/* cover */
.cover{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
.cover .frame{ position:absolute; inset:0.34in; border:1px solid var(--line); }
.cover h1{ font-size:52px; line-height:1.08; }
.cover h1 .script{ font-style:italic; color:var(--blush); }
.cover .sub{ font-size:15px; color:var(--soft); max-width:4.6in; }
.cover .owner{ margin-top:64px; display:flex; flex-direction:column; align-items:center; gap:10px; font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--soft); }
.cover .owner .oline{ width:3in; height:1px; background:rgba(52,48,43,.3); }
.cover .cfoot{ position:absolute; bottom:0.6in; font-size:11px; letter-spacing:.06em; color:var(--soft); }

/* fields */
.fgrid{ display:grid; grid-template-columns:1fr 1fr; gap:15px 34px; }
.fld{ display:flex; flex-direction:column; gap:5px; }
.flab{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--soft); font-weight:700; }
.fline{ height:1px; background:rgba(52,48,43,.32); }
.ln{ height:1px; background:rgba(52,48,43,.26); margin:16px 0; }

/* how */
.how{ background:#fff; border:1px solid var(--line); border-radius:11px; padding:18px 22px; margin-top:4px; }
.how h3{ font-size:16px; margin:0 0 9px; }
.howcols{ display:grid; grid-template-columns:1fr 1fr; gap:0 30px; }
.howcols ul{ margin:0; padding-left:0; list-style:none; }
.howcols li{ font-size:12px; margin-bottom:6px; padding-left:18px; position:relative; }
.howcols li::before{ content:"♥"; color:var(--gold); position:absolute; left:0; font-size:10px; }
.sign{ font-family:'Playfair Display',serif; font-style:italic; font-size:14px; color:var(--blush); margin-top:16px; }

/* checklist */
.phase{ margin-bottom:30px; }
.phase .tf{ display:flex; align-items:baseline; gap:12px; border-bottom:1.5px solid var(--gold); padding-bottom:6px; margin-bottom:14px; }
.phase .when{ font-family:'Playfair Display',serif; font-size:19px; font-weight:600; }
.phase .tag{ font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:var(--blush); font-weight:700; }
.items{ display:grid; grid-template-columns:1fr 1fr; gap:13px 26px; }
.item{ display:flex; align-items:flex-start; font-size:11.6px; line-height:1.3; color:#3c3833; }
.cb{ flex:0 0 auto; width:12px; height:12px; border:1.4px solid var(--charcoal); border-radius:3px; margin-right:9px; margin-top:1px; }

/* tables */
.tbl{ width:100%; border-collapse:collapse; margin-top:4px; }
.tbl th{ font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--soft); font-weight:700; text-align:left; padding:0 6px 7px; border-bottom:1.5px solid var(--blush); }
.tbl td{ height:25px; border-bottom:1px solid var(--line); padding:0 6px; font-size:11px; }
.tbl tbody tr:nth-child(even) td{ background:rgba(197,138,134,.06); }

/* vision blocks */
.vis{ display:grid; grid-template-columns:1fr 1fr; gap:0 34px; margin-bottom:14px; }
.vblock h3{ font-size:14px; margin:6px 0 4px; }
.swatches{ display:flex; gap:10px; margin-top:8px; }
.swatches span{ width:46px; height:46px; border:1px solid var(--line); border-radius:8px; background:#fff; }
.hint{ font-size:9px; color:var(--soft); margin-top:6px; font-style:italic; }

/* seating */
.seatgrid{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:6px; }
.seat{ border:1px solid var(--line); border-radius:9px; padding:10px 12px 6px; background:#fff; }
.seathd{ font-family:'Playfair Display',serif; font-size:14px; font-weight:600; color:var(--blush); margin-bottom:6px; }
.seat .ln{ margin:9px 0; }

/* back */
.back{ display:flex; flex-direction:column; justify-content:center; }
.bcard{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:34px 38px; }
.bcard h2{ font-size:30px; margin:6px 0 8px; }
.bcard p{ font-size:13.5px; line-height:1.6; color:#46413a; max-width:5.4in; margin:0 0 22px; }
.cta{ display:inline-block; background:var(--blush); color:#fff; text-decoration:none; font-weight:700; font-size:14px; padding:14px 32px; border-radius:40px; }
.bend{ text-align:center; margin-top:46px; }
.bend .big{ font-family:'Playfair Display',serif; font-style:italic; font-size:22px; }
.bend .site{ font-size:11px; letter-spacing:.05em; color:var(--soft); margin-top:8px; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>The Ultimate Wedding Planner — Bride Bestie</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${pages.join("\n")}</body></html>`;

writeFileSync(new URL("./planner.html", import.meta.url), html);
console.log(`planner.html written — ${pages.length} pages`);
