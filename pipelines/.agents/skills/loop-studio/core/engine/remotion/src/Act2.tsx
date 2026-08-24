/**
 * Act2 — "FILES DO THE WRONG JOB" (narration 141.79–263.34s → local 0–121.5s).
 * Built from design_act2.json (enactment-first, critiqued). Objects persist and transform:
 * cracked business.md → task/fact chips → the browser full of skills → invoice.md opened,
 * scanned, interrogated (✕ 0 RESULTS) → template DONE vs the real system → HOW/WHAT diagram →
 * the stuffing mistake → the self-filling database running → query answered fresh → the law → badges.
 * Voice only; SFX + music in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Card, Marker, FileGraphic, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";
import { Win } from "./bb2/concepts";

const FPS = 30;

/* ---------- local: database cylinder (position %, width u-units) ---------- */
const Cyl: React.FC<{ x: number; y: number; u: number; W: number; H: number; s?: number; rows: number; ghost?: number; draw?: number; flashRow?: number; brand?: boolean; ink?: string }> = ({ x, y, u, W, H, s = 0.95, rows, ghost = 0, draw = 1, flashRow = -1, brand, ink }) => {
  const S = u * s;
  const col = ghost > 0.5 ? "#3a4256" : (ink ?? LIME);
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 1 - ghost * 0.55 }}>
        <g transform={`translate(${x / 100 * W} ${y / 100 * H}) scale(${S})`}>
          <g fill="none" stroke={col} strokeWidth={0.5} strokeLinecap="round" strokeDasharray={ghost > 0.5 ? "1.6 1.2" : undefined}>
            <path d="M-11 -13 a11 4 0 1 0 22 0 a11 4 0 1 0 -22 0" strokeDasharray={90} strokeDashoffset={90 * (1 - draw)} />
            <path d="M-11 -13 L-11 13" strokeDasharray={26} strokeDashoffset={26 * (1 - draw)} />
            <path d="M11 -13 L11 13" strokeDasharray={26} strokeDashoffset={26 * (1 - draw)} />
            <path d="M-11 13 a11 4 0 0 0 22 0" strokeDasharray={40} strokeDashoffset={40 * (1 - draw)} />
          </g>
          {ghost < 0.5 && Array.from({ length: Math.min(7, rows) }).map((_, i) => (
            <rect key={i} x={-8.5} y={9.5 - i * 2.9} width={17} height={1.9} rx={0.5} fill={ink ?? LIME} opacity={0.16 + (i === flashRow ? 0.5 : 0)} />
          ))}
        </g>
      </svg>
      {brand && ghost < 0.5 && (
        <Img src={staticFile("logos/supabase.svg")} style={{ position: "absolute", left: x / 100 * W - S * 1.8, top: y / 100 * H + S * 12.4, width: S * 3.6, height: S * 3.6, opacity: clamp01((draw - 0.5) * 2), pointerEvents: "none" }} />
      )}
    </>
  );
};

/* ---------- local: mono chip ---------- */
const Chip: React.FC<{ x: number; y: number; u: number; text: string; lime?: boolean; grey?: boolean; o?: number; sc?: number; icon?: React.ReactNode }> = ({ x, y, u, text, lime, grey, o = 1, sc = 1, icon }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${sc})`, opacity: o }}>
    <div style={{ background: grey ? "#1a1f2b" : RAISIN, border: `${u * 0.1}px solid ${grey ? "#3a4256" : lime ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: grey ? SILVER_MID : lime ? LIME : SILVER, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: icon ? u * 0.55 : 0 }}>{icon}{text}</div>
  </div>
);

/* ---------- local: headline ---------- */
const HL: React.FC<{ u: number; t: number; at: number; out?: number; x?: string; y?: string; size?: number; children: React.ReactNode; center?: boolean }> = ({ u, t, at, out, x = "6%", y = "14%", size = 3.3, children, center }) => (
  <div style={{ position: "absolute", left: center ? "50%" : x, top: y, transform: center ? "translate(-50%,-50%)" : undefined, whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - at) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

/* ---------- invoice.md content lines ---------- */
const REC_LINES = [
  { g: 0, txt: "1. pull unpaid orders" }, { g: 0, txt: "2. build the PDF" }, { g: 0, txt: "3. send + log it" },
  { g: 1, txt: "> always reverse-charge VAT" }, { g: 1, txt: "> due in 14 days" },
  { g: 2, txt: "$ python invoice.py --send" },
];

export const Act2: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 8.9, x: 50, y: 50, s: 1, dim: 0, fr: 0 },         // b1-3 FULL footage + side graphics
    { t: 9.6, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },   // b4-5 panel
    { t: 22.6, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 23.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },        // b6-8 hidden
    { t: 37.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 38.2, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },  // b9 panel (the miss, enacted left)
    { t: 41.4, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 42.2, x: 28, y: 52, s: 1.18, dim: 0.05, fr: 1 },  // b10 panel — FLIPPED left + enlarged (break the repeated right/left format)
    { t: 49.2, x: 28, y: 52, s: 1.18, dim: 0.05, fr: 1 },
    { t: 50.0, x: 50, y: 50, s: 1, dim: 1, fr: 1 },        // b11-13 hidden
    { t: 74.7, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 75.4, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },  // b14 panel
    { t: 78.9, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 79.7, x: 50, y: 50, s: 1, dim: 1, fr: 1 },        // b15-16 hidden
    { t: 100.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 101.2, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 }, // b17 panel (full build vs starter)
    { t: 109.7, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 110.5, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // b18 hidden
    { t: 115.0, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 115.8, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // b19 full
    { t: 121.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);
  // LIGHT register: inside the file (b6-8), the template race (b10), the law (b18)
  const liteWins: [number, number][] = [[23.2, 37.5], [42.0, 49.3], [110.3, 115.1]];
  const lite = Math.max(...liteWins.map(([a, b]) => clamp01((t - a) / 0.5) * (1 - clamp01((t - b) / 0.5))), 0);
  const ink = lite > 0.5 ? RAISIN : SILVER;
  const inkSoft = lite > 0.5 ? BODY : SILVER_SOFT;

  const GY = (n: number) => `${n}%`;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("intros/businessbrain/act2_voice.m4a")} />
      <DarkBg u={u} gridOpacity={sk.fr} />
      <LightBg u={u} opacity={lite} />

      {/* ================= GRAPHICS WORLD ================= */}
      <div style={{ position: "absolute", inset: 0, opacity: Math.max(graphicsOn, t < 9.3 ? 1 : 0) }}>

        
        
        {/* B4 (9.3–16.5): the browser bursts with skills */}
        {t >= 9.3 && t < 16.7 && (() => { const on = clamp01((t - 9.8) / 0.4) * (1 - clamp01((t - 16.4) / 0.3));
          const cascade = ["video-edit.md", "invoice.md", "thumbnail.md", "deploy.md", "broll.md"];
          const nRows = 4 + cascade.filter((_, i) => t > 13.6 + i * 0.35).length;
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={15.6} size={3.1} y="14%"><Marker u={u} t={t} at={15.9}>FULL</Marker> OF MARKDOWN</HL>
              <div style={{ position: "absolute", left: "26%", top: "56%", transform: "translate(-50%,-50%)" }}>
                <Win u={u} w={30} title="my-second-brain/">
                  <div style={{ padding: `${u * 0.4}px 0`, height: u * 22, overflow: "hidden" }}>
                    {["me.md", "business.md", "priorities.md", "skills/ ▸", ...cascade].slice(0, 4 + cascade.length).map((n, i) => {
                      const at = i < 4 ? 10.2 + i * 0.35 : 13.6 + (i - 4) * 0.35;
                      const o = clamp01((t - at) / 0.3);
                      const isSkill = i >= 4;
                      return (
                        <div key={i} style={{ height: u * 2.4, display: "flex", alignItems: "center", gap: u * 0.8, padding: `0 ${u * 1.2}px`, paddingLeft: isSkill ? u * 2.6 : u * 1.2, opacity: o, transform: `translateX(${(1 - o) * u}px)` }}>
                          {n.endsWith(".md")
                            ? <Img src={staticFile(`logos/markdown-${n === "business.md" ? "lime" : "silver"}.svg`)} style={{ width: u * 1.6, height: u * 0.98, flexShrink: 0 }} />
                            : <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 1.7, height: u * 1.7, flexShrink: 0 }} />}
                          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: n === "business.md" ? LIME : SILVER_SOFT }}>{n}</span>
                          {n === "business.md" && <span style={{ fontFamily: MONO, fontSize: u * 0.9, color: LIME }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </Win>
              </div>
              {/* counter tile */}
              <div style={{ position: "absolute", left: "44%", top: "33%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 13.4) / 0.4) }}>
                <div style={{ background: "#12151d", border: `${u * 0.1}px solid #2a3145`, borderRadius: u * 0.6, padding: `${u * 0.6}px ${u * 1.1}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.6, color: SILVER, fontVariantNumeric: "tabular-nums" }}>
                  {Math.min(38, 10 + Math.max(0, Math.floor((t - 13.6) * 14)))} FILES
                </div>
              </div>
            </div>
          ); })()}

        {/* B5 (16.5–22.8): invoice.md EATS the manual busywork chip by chip while the weekly
            timer collapses 4:00H → 0:05 — saving time and money is shown, not captioned. */}
        {t >= 16.5 && t < 23.0 && (() => { const on = clamp01((t - 17.0) / 0.4) * (1 - clamp01((t - 22.6) / 0.3));
          const grow = clamp01((t - 17.2) / 0.5);
          const CHORES = ["OPEN ORDERS", "COPY DETAILS", "MAKE PDF", "EMAIL IT", "LOG IT"];
          const CHORE_ICONS = ["shopping-cart", "copy", "file-text", "mail", "database"];
          const eatAt = (i: number) => 18.6 + i * 0.42;
          const eaten = CHORES.filter((_, i) => t > eatAt(i) + 0.4).length;
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={17.4} size={3.0} y="12%">THIS ONE IS <Marker u={u} t={t} at={17.7}>AMAZING</Marker></HL>
              {/* the busywork stack */}
              {CHORES.map((c, i) => {
                const p = clamp01((t - eatAt(i)) / 0.4);
                const x = lerp(9, 24, p), y = lerp(30 + i * 8, 52, p);
                if (p >= 1) return null;
                return <Chip key={i} x={x} y={y} u={u} text={c} grey o={clamp01((t - 17.6 - i * 0.1) / 0.3) * (1 - clamp01((p - 0.82) / 0.18))} sc={1 - p * 0.3} icon={<Img src={staticFile(`logos/lucide-${CHORE_ICONS[i]}-silver.svg`)} style={{ width: u * 1.1, height: u * 1.1, flexShrink: 0 }} />} />;
              })}
              {/* invoice.md, the eater */}
              <div style={{ position: "absolute", left: "30%", top: "52%", transform: `translate(-50%,-50%) scale(${(0.75 + 0.25 * grow) * (1 + (eaten > 0 && t < eatAt(eaten - 1) + 0.55 ? 0.02 : 0))})`, opacity: grow }}>
                <Win u={u} w={22} title="invoice.md" accent>
                  <div style={{ padding: `${u * 0.9}px ${u * 1.2}px`, display: "flex", flexDirection: "column", gap: u * 0.5 }}>
                    {REC_LINES.slice(0, 3).map((l, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.0, color: SILVER_SOFT, opacity: 0.85 }}>{l.txt}</div>
                    ))}
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: LIME, opacity: eaten > 0 ? 1 : 0.3 }}>✓ handled: {eaten}/5</div>
                  </div>
                </Win>
              </div>
              {/* the money it keeps */}
              <Chip x={30} y={76} u={u} text="+€400 KEPT /MO" lime o={clamp01((t - 21.8) / 0.35)} sc={1 + 0.1 * (1 - clamp01((t - 21.8) / 0.4))} icon={<Img src={staticFile("logos/lucide-coins-lime.svg")} style={{ width: u * 1.1, height: u * 1.1, flexShrink: 0 }} />} />
            </div>
          ); })()}

        {/* B6+7 (22.8–33.6): hero window self-types (steps/rules/commands), then RECIPE tag + scan + 0 FACTS */}
        {t >= 23.0 && t < 33.9 && (() => { const on = clamp01((t - 23.4) / 0.4) * (1 - clamp01((t - 33.6) / 0.3));
          const scanP = clamp01((t - 31.2) / 1.3);
          const GROUP_AT = [25.4, 26.3, 27.1];
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "10%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.2, letterSpacing: "-0.02em", color: ink, textTransform: "uppercase", opacity: clamp01((t - 23.5) / 0.4) }}>LOOK <Marker u={u} t={t} at={23.7} base={ink}>INSIDE</Marker></div>
              <div style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)" }}>
                <Win u={u} w={44} title="my-second-brain/invoice.md" accent light={lite > 0.5}>
                  <div style={{ position: "relative", padding: `${u * 1.4}px ${u * 1.8}px`, display: "flex", flexDirection: "column", gap: u * 0.7 }}>
                    {[0, 1, 2].map((g) => (
                      <div key={g} style={{ display: "flex", flexDirection: "column", gap: u * 0.5, marginBottom: u * 0.5 }}>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.18em", color: lite > 0.5 ? RAISIN : LIME, opacity: clamp01((t - GROUP_AT[g]) / 0.3) }}>{["STEPS", "RULES", "COMMANDS"][g]}</span>
                        {REC_LINES.filter((l) => l.g === g).map((l, i) => {
                          const typed = Math.max(0, Math.floor((t - GROUP_AT[g] - 0.15 - i * 0.28) * 40));
                          return <span key={i} style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.3, color: inkSoft, minHeight: u * 1.7 }}>{l.txt.slice(0, typed)}</span>;
                        })}
                      </div>
                    ))}
                    {/* scanner sweep */}
                    {scanP > 0 && scanP < 1 && <div style={{ position: "absolute", left: 0, right: 0, top: `${scanP * 100}%`, height: u * 0.35, background: lite > 0.5 ? "#7a9a00" : LIME, opacity: 0.85, boxShadow: lite > 0.5 ? "none" : `0 0 ${u * 1.2}px ${LIME}` }} />}
                  </div>
                </Win>
              </div>
              {/* facts found: 0 */}
              <Chip x={50} y={87} u={u} text={`FACTS FOUND: ${scanP >= 1 ? 0 : "…"}`} grey={scanP < 1} lime={false} o={clamp01((t - 31.4) / 0.3)} />
              {t > 33.0 && <div style={{ position: "absolute", left: "50%", top: "93%", transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.6, color: inkSoft, opacity: clamp01((t - 33.2) / 0.4) }}>just instructions.</div>}
            </div>
          ); })()}

        {/* B8 (33.6–37.6): search interrogation — ✕ column takes over (REPLAY SPIKE) */}
        {t >= 33.6 && t < 37.9 && (() => { const on = clamp01((t - 33.8) / 0.3) * (1 - clamp01((t - 37.6) / 0.3));
          const searches = [{ q: "revenue", at: 33.9 }, { q: "customer", at: 35.3 }, { q: "anything that changes", at: 36.4 }];
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "12%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.0, letterSpacing: "-0.02em", color: ink, textTransform: "uppercase", opacity: clamp01((t - 36.3) / 0.4) }}><Marker u={u} t={t} at={36.5} base={ink}>NOTHING</Marker> THAT CAN CHANGE</div>
              {/* dimmed recipe window behind */}
              <div style={{ position: "absolute", left: "68%", top: "56%", transform: "translate(-50%,-50%) scale(0.8)", opacity: 0.5, filter: "grayscale(0.6)" }}>
                <Win u={u} w={30} title="invoice.md — RECIPE" light={lite > 0.5}><div style={{ height: u * 14 }} /></Win>
              </div>
              {/* search bar */}
              <div style={{ position: "absolute", left: "50%", top: "29%", transform: "translate(-50%,-50%)" }}>
                <div style={{ background: lite > 0.5 ? WHITE : "#12151d", border: `${u * 0.12}px solid ${lite > 0.5 ? RAISIN : LIME}`, borderRadius: u * 0.6, padding: `${u * 0.7}px ${u * 1.2}px`, width: u * 26, fontFamily: MONO, fontWeight: 600, fontSize: u * 1.3, color: ink, display: "flex", alignItems: "center", gap: u * 0.7 }}>
                  <Img src={staticFile(`logos/lucide-search-${lite > 0.5 ? "dark" : "silver"}.svg`)} style={{ width: u * 1.2, height: u * 1.2, flexShrink: 0 }} />
                  <span>{(() => { const cur = searches.filter((s) => t >= s.at).pop(); if (!cur) return ""; return cur.q.slice(0, Math.max(0, Math.floor((t - cur.at) * 28))); })()}</span>
                </div>
              </div>
              {/* one clean, HELD "0 RESULTS" verdict — the queries cross out under it as they run */}
              {(() => { const rp = clamp01((t - 34.4) / 0.4); if (rp <= 0) return null;
                return (
                  <div style={{ position: "absolute", left: "50%", top: "62%", transform: `translate(-50%,-50%) scale(${0.95 + 0.05 * rp})`, opacity: rp }}>
                    <div style={{ background: lite > 0.5 ? WHITE : "#12151d", border: `${u * 0.12}px solid ${lite > 0.5 ? RAISIN : "#3a4256"}`, borderRadius: u * 0.9, padding: `${u * 1.5}px ${u * 2.8}px`, textAlign: "center", boxShadow: lite > 0.5 ? `0 ${u}px ${u * 2.6}px rgba(15,18,26,0.16)` : `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.5)` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: u * 1.0, fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4, color: ink, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: u * 3.2, height: u * 3.2, borderRadius: "50%", border: `${u * 0.18}px solid ${ink}`, fontSize: u * 2.0 }}>✕</span>
                        0 RESULTS
                      </div>
                      <div style={{ marginTop: u * 1.0, display: "flex", flexDirection: "column", gap: u * 0.4 }}>
                        {searches.map((s, i) => (
                          <div key={i} style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: inkSoft, textDecoration: "line-through", opacity: clamp01((t - s.at - 0.2) / 0.3) }}>{s.q}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ); })()}
            </div>
          ); })()}

        {/* B10 (41.6–49.4): template races to DONE on the first "weekend"... and then just STOPS.
            Finished = frozen: the window dims dead while the plate stamps the price of that. */}
        {t >= 42.2 && t < 49.6 && (() => { const on = clamp01((t - 42.4) / 0.3) * (1 - clamp01((t - 49.3) / 0.25));
          const bar = clamp01((t - 42.8) / 1.7);
          const done = clamp01((t - 44.6) / 0.25);
          const deadP = clamp01((t - 45.6) / 0.8); // after DONE, the window visibly dies
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "71%", top: "15%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.9, letterSpacing: "-0.02em", color: ink, textTransform: "uppercase", opacity: clamp01((t - 43.2) / 0.4) }}>BUILT FOR 1 <Marker u={u} t={t} at={43.5} base={ink}>WEEKEND</Marker></div>
              <div style={{ position: "absolute", left: "71%", top: "48%", transform: "translate(-50%,-50%)", filter: `saturate(${1 - deadP * 0.75}) brightness(${1 - deadP * 0.3})` }}>
                <Win u={u} w={24} title="template/" light={lite > 0.5}>
                  <div style={{ padding: `${u * 0.5}px 0` }}>
                    {["me.md", "business.md", "goals.md", "notes.md"].map((n, i) => (
                      <div key={i} style={{ height: u * 2.5, display: "flex", alignItems: "center", gap: u * 0.8, padding: `0 ${u * 1.2}px`, opacity: clamp01((t - 42.3 - i * 0.12) / 0.25) * (1 - done * 0.5) }}>
                        <Img src={staticFile(`logos/markdown-${lite > 0.5 ? "dark" : "silver"}.svg`)} style={{ width: u * 1.6, height: u * 0.98, flexShrink: 0 }} />
                        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: inkSoft }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </Win>
                {/* progress bar */}
                <div style={{ marginTop: u * 1.0, height: u * 1.1, background: lite > 0.5 ? "#dde2e5" : "#181d2a", borderRadius: u * 0.55, overflow: "hidden", border: `${u * 0.07}px solid ${lite > 0.5 ? "#b5bfc2" : "#2a3145"}` }}>
                  <div style={{ width: `${bar * 100}%`, height: "100%", background: LIME }} />
                </div>
              </div>
              {/* finished = frozen tag */}
              {deadP > 0.3 && (
                <div style={{ position: "absolute", left: "71%", top: "73%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.14em", color: lite > 0.5 ? "#8a93a8" : "#5a6478", opacity: clamp01((deadP - 0.3) / 0.4), whiteSpace: "nowrap" }}>FINISHED = FROZEN · nothing moves anymore</div>
              )}
              {/* DONE stamp */}
              {done > 0 && (
                <div style={{ position: "absolute", left: "71%", top: "45%", transform: `translate(-50%,-50%) rotate(-10deg) scale(${1.35 - 0.35 * done})`, opacity: done, border: `${u * 0.28}px solid ${LIME}`, borderRadius: u * 0.4, padding: `${u * 0.25}px ${u * 1.0}px` }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: LIME }}>DONE ✓</span>
                </div>
              )}
            </div>
          ); })()}

        {/* B11 (49.4–54.8): the REAL system dwarfs the toy */}
        {t >= 50.0 && t < 55.1 && (() => { const on = clamp01((t - 50.2) / 0.35) * (1 - clamp01((t - 54.8) / 0.3));
          const dbDraw = clamp01((t - 51.6) / 0.7);
          const rows = Math.min(7, Math.floor((t - 51.8) * 3));
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={50.1} size={3.2} y="10%" x="34%">A <Marker u={u} t={t} at={50.3}>REAL</Marker> SYSTEM</HL>
              {/* stream */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={`M ${-W * 0.02} ${H * 0.72} C ${W * 0.22} ${H * 0.66}, ${W * 0.35} ${H * 0.6}, ${W * 0.435} ${H * 0.565}`} stroke={LIME} strokeWidth={u * 0.3} fill="none" strokeLinecap="round" strokeDasharray={`${u * 2.2} ${u * 1.3}`} strokeDashoffset={-t * u * 6} opacity={clamp01((t - 50.6) / 0.5) * 0.85} />
              </svg>
              <Cyl x={55} y={52} u={u} W={W} H={H} rows={Math.max(0, rows)} draw={dbDraw} brand />
              <div style={{ position: "absolute", left: "76%", top: "62%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: dbDraw }}>
                <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.7, color: SILVER, fontVariantNumeric: "tabular-nums" }}>{Math.min(4812, 4700 + Math.max(0, Math.floor((t - 51.8) * 60))).toLocaleString("en-US")} ROWS</div>
              </div>
              {/* dashboard docks right */}
              <div style={{ position: "absolute", left: "80%", top: "42%", transform: `translate(-50%,-50%) translateY(${(1 - clamp01((t - 52.6) / 0.5)) * u * 2}px)`, opacity: clamp01((t - 52.6) / 0.5) }}>
                <Win u={u} w={20} title="dashboard" accent>
                  <div style={{ padding: u * 0.9 }}>
                    <svg width={u * 17} height={u * 4.6} viewBox="0 0 100 26">
                      <path d="M2 22 L20 17 L38 19 L56 11 L74 13 L96 4" fill="none" stroke={LIME} strokeWidth={2} strokeLinecap="round" strokeDasharray={130} strokeDashoffset={130 * (1 - clamp01((t - 52.9) / 0.8))} />
                    </svg>
                  </div>
                </Win>
              </div>
              {/* the honest timeline — a real month calendar: the template is ONE weekend,
                  the real build lands day after day across the following weeks */}
              {(() => { const calOn = clamp01((t - 50.6) / 0.5); if (calOn <= 0) return null;
                const grow = clamp01((t - 52.2) / 2.0);
                const cell = u * 2.0, gap = u * 0.3;
                const WD = ["M", "T", "W", "T", "F", "S", "S"];
                const weekendIdx = [5, 6];                                   // the template's one weekend (Sat/Sun of week 1)
                const buildIdx = [7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25]; // real build: weekdays of weeks 2-4
                const litCount = Math.floor(grow * buildIdx.length + 0.0001);
                const swatch = (border: string, bg: string) => (
                  <span style={{ width: u * 0.95, height: u * 0.95, borderRadius: u * 0.2, border: `${u * 0.08}px solid ${border}`, background: bg, flexShrink: 0 }} />
                );
                return (
                  <div style={{ position: "absolute", left: "5%", top: "45%", opacity: calOn }}>
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.16em", color: SILVER_MID, marginBottom: u * 0.7 }}>THE HONEST TIMELINE</div>
                    {/* weekday header */}
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cell}px)`, gap, marginBottom: u * 0.4 }}>
                      {WD.map((d, i) => (
                        <div key={i} style={{ textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.78, color: "#5a6478" }}>{d}</div>
                      ))}
                    </div>
                    {/* 4 weeks */}
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cell}px)`, gap }}>
                      {Array.from({ length: 28 }).map((_, i) => {
                        const isWeekend = weekendIdx.includes(i);
                        const bIdx = buildIdx.indexOf(i);
                        const lit = bIdx >= 0 && bIdx < litCount;
                        const appear = clamp01((t - 50.9 - i * 0.02) / 0.25);
                        return (
                          <div key={i} style={{ width: cell, height: cell, borderRadius: u * 0.28, border: `${u * 0.08}px solid ${isWeekend ? "#6b7488" : lit ? LIME : "#2a3145"}`, background: lit ? "rgba(207,255,5,0.16)" : isWeekend ? "rgba(122,132,152,0.14)" : "transparent", opacity: appear, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, color: lit ? LIME : isWeekend ? SILVER_MID : "#3a4256" }}>{i + 1}</div>
                        );
                      })}
                    </div>
                    {/* legend */}
                    <div style={{ display: "flex", gap: u * 1.8, marginTop: u * 0.85, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.45, color: SILVER_MID }}>{swatch("#6b7488", "rgba(122,132,152,0.14)")}TEMPLATE · 1 WEEKEND</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.45, color: LIME, opacity: clamp01((t - 52.2) / 0.4) }}>{swatch(LIME, "rgba(207,255,5,0.16)")}REAL BUILD · WEEKS</span>
                    </div>
                  </div>
                ); })()}
              {/* plate re-stamp */}
              {t > 53.9 && (
                <div style={{ position: "absolute", left: "31%", top: "80%", transform: `translate(-50%,-50%) scale(${1.15 - 0.15 * clamp01((t - 53.9) / 0.3)})`, opacity: clamp01((t - 53.9) / 0.3) }}>
                  <div style={{ background: LIME, padding: `${u * 0.4}px ${u * 1.2}px`, borderRadius: u * 0.25, transform: "rotate(-1.2deg)" }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: RAISIN, textTransform: "uppercase", whiteSpace: "nowrap" }}>NOT A WEEKEND</span>
                  </div>
                </div>
              )}
            </div>
          ); })()}

        {/* B12 (54.8–64.5): HOW vs WHAT diagram */}
        {t >= 54.9 && t < 64.8 && (() => { const on = clamp01((t - 55.1) / 0.35) * (1 - clamp01((t - 64.5) / 0.3));
          const howP = clamp01((t - 56.6) / 0.5), whatP = clamp01((t - 59.4) / 0.5), inputP = clamp01((t - 62.6) / 0.6);
          const FIL = { x: 24, y: 30 }, DB = { x: 24, y: 68 }, CL = { x: 62, y: 49 };
          return (
            <div style={{ opacity: on }}>
              {/* FILES container */}
              <div style={{ position: "absolute", left: `${FIL.x}%`, top: `${FIL.y}%`, transform: "translate(-50%,-50%)", opacity: clamp01((t - 55.3) / 0.4) }}>
                <Win u={u} w={22} title="FILES — the recipes">
                  <div style={{ padding: `${u * 0.6}px ${u * 1.2}px`, display: "flex", flexDirection: "column", gap: u * 0.45 }}>
                    {["invoice.md", "video-edit.md", "thumbnail.md"].map((n, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, color: SILVER_SOFT, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.55 }}><Img src={staticFile("logos/markdown-silver.svg")} style={{ width: u * 1.3, height: u * 0.8, flexShrink: 0 }} />{n}</span>
                        {inputP >= 1 && n === "invoice.md" && <span style={{ color: LIME }}>MRR €15,240 ✓</span>}
                      </div>
                    ))}
                  </div>
                </Win>
              </div>
              <Cyl x={DB.x} y={DB.y} u={u} W={W} H={H} s={0.62} rows={5} draw={clamp01((t - 55.5) / 0.5)} />
              <div style={{ position: "absolute", left: `${DB.x}%`, top: `${DB.y + 20.5}%`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.12em", color: SILVER, opacity: clamp01((t - 55.7) / 0.4) }}>DATABASE</div>
              {/* CLAUDE node */}
              <div style={{ position: "absolute", left: `${CL.x}%`, top: `${CL.y}%`, transform: "translate(-50%,-50%)", opacity: clamp01((t - 55.6) / 0.4) }}>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.8, transform: `translate(${u * 0.55}px,${u * 0.55}px)`, opacity: 0.85 }} />
                  <div style={{ position: "relative", background: RAISIN, border: `${u * 0.14}px solid ${SILVER}`, borderRadius: u * 0.8, padding: `${u * 1.1}px ${u * 2.2}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 2.0, color: SILVER, display: "flex", alignItems: "center", gap: u * 0.8 }}><Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.4, height: u * 1.4, flexShrink: 0 }} />CLAUDE</div>
                </div>
              </div>
              {/* arrows */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {(() => { const a = []; const seg = (x1: number, y1: number, x2: number, y2: number, p: number, col: string) => {
                  const len = Math.hypot((x2 - x1) * W / 100, (y2 - y1) * H / 100);
                  return <line x1={x1 / 100 * W} y1={y1 / 100 * H} x2={x2 / 100 * W} y2={y2 / 100 * H} stroke={col} strokeWidth={u * 0.28} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />; };
                  a.push(<g key="h">{seg(FIL.x + 11, FIL.y + 2, CL.x - 7, CL.y - 3, howP, SILVER_MID)}</g>);
                  a.push(<g key="w">{seg(DB.x + 8, DB.y - 3, CL.x - 7, CL.y + 3, whatP, LIME)}</g>);
                  a.push(<g key="i">{seg(DB.x, DB.y - 14.5, FIL.x, FIL.y + 8.5, inputP, LIME)}</g>);
                  if (inputP >= 1) a.push(<polygon key="ih" points={`${FIL.x / 100 * W - u * 0.7},${(FIL.y + 8.5) / 100 * H + u * 1.1} ${FIL.x / 100 * W + u * 0.7},${(FIL.y + 8.5) / 100 * H + u * 1.1} ${FIL.x / 100 * W},${(FIL.y + 8.5) / 100 * H - u * 0.2}`} fill={LIME} />);
                  return a; })()}
              </svg>
              <Chip x={42} y={33} u={u} text="HOW" o={howP} />
              <Chip x={42} y={63} u={u} text="WHAT IS TRUE" lime o={whatP} />
              <Chip x={15} y={44} u={u} text="input ↑" lime o={inputP} />
            </div>
          ); })()}

        {/* B13 (64.5–74.9): the stuffing mistake — bulge + crack */}
        {t >= 64.6 && t < 75.1 && (() => { const on = clamp01((t - 64.8) / 0.35) * (1 - clamp01((t - 74.8) / 0.3));
          const shoves = [68.3, 69.5, 70.6];
          const JAM = [
            { l: "new order #4471", m: true, x: 34, y: 44, r: -9 },
            { l: "payout €3,900", m: true, x: 37, y: 53, r: 12 },
            { l: "DM: still there?", m: false, x: 31, y: 62, r: -14 },
          ]; // final CROOKED rest poses — overlapping, corners poking past the panel border
          const bulge = shoves.reduce((m, s) => { const dt = t - s + 0.45; return dt > 0.4 && dt < 0.75 ? Math.max(m, Math.sin(((dt - 0.4) / 0.35) * Math.PI) * 0.07) : m; }, 0);
          const ghostOn = clamp01((t - 66.0) / 0.5);
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={68.2} x="50%" y="10%" size={3.2}>FACTS <Marker u={u} t={t} at={68.5}>STUFFED</Marker> INTO HOW</HL>
              {/* the empty right-shaped container, RIGHT THERE, ignored — now big on the right */}
              <Cyl x={71} y={48} u={u} W={W} H={H} s={0.9} rows={0} ghost={ghostOn} />
              <div style={{ position: "absolute", left: "71%", top: "74%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: clamp01((t - 66.2) / 0.4) }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: u * 0.7, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.12em", color: SILVER_MID }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: u * 1.9, height: u * 1.9, borderRadius: "50%", border: `${u * 0.13}px solid ${SILVER_MID}`, fontSize: u * 1.1 }}>✕</span>
                  NO DATABASE
                </div>
                <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: "#6b7488", marginTop: u * 0.6 }}>the facts never land here</div>
              </div>
              {/* FILES panel that gets jammed — bigger, centered on the left */}
              <div style={{ position: "absolute", left: "29%", top: "52%", transform: `translate(-50%,-50%) scale(${1 + bulge}, ${1 - bulge * 0.55})` }}>
                <Win u={u} w={26} title="FILES — the recipes">
                  <div style={{ padding: `${u * 0.9}px ${u * 1.5}px`, display: "flex", flexDirection: "column", gap: u * 0.7, minHeight: u * 17 }}>
                    {["invoice.md", "video-edit.md", "thumbnail.md"].map((n, i) => <span key={i} style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.25, color: SILVER_SOFT, display: "inline-flex", alignItems: "center", gap: u * 0.6 }}><Img src={staticFile("logos/markdown-silver.svg")} style={{ width: u * 1.6, height: u * 0.98, flexShrink: 0 }} />{n}</span>)}
                  </div>
                </Win>
              </div>
              {/* cards fly in from the ignored database and JAM crooked into the files — corners poking out */}
              {shoves.map((s, i) => {
                const p = clamp01((t - s + 0.45) / 0.45);
                if (p <= 0) return null;
                const J = JAM[i];
                const x = p < 1 ? lerp(66, J.x, p) : J.x;
                const y = p < 1 ? lerp(48, J.y, p) : J.y;
                const r = p < 1 ? lerp(0, J.r, p) : J.r;
                const squash = p >= 1 && t < s + 0.25 ? 0.12 : 0;
                return <Card key={i} x={x} y={y} u={u} label={J.l} money={J.m} scale={1.3 * (1 - squash * 0.5)} rot={r} />;
              })}
            </div>
          ); })()}

        {/* B14 (74.9–79.1): the database feeds ITSELF — an arm rooted between its own rows rises
            out of the open top, arcs over, and drops a card back in. Row +1, counter ticks. */}
        {t >= 75.4 && t < 79.4 && (() => { const on = clamp01((t - 75.6) / 0.3) * (1 - clamp01((t - 79.1) / 0.25));
          const armP = clamp01((t - 76.6) / 0.8);
          const dropP = clamp01((t - 77.6) / 0.5);
          const landed = t > 78.15;
          // cylinder center (26%,52%), s=0.8 → top rim ≈ y 33.5%, right edge ≈ x 34.8%
          const CXp = 26 / 100 * W, TOPp = 33.5 / 100 * H;
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={77.3} size={2.9} y="12%">IT FILLS <Marker u={u} t={t} at={77.6}>ITSELF</Marker></HL>
              <Cyl x={26} y={52} u={u} W={W} H={H} s={0.8} rows={5 + (landed ? 1 : 0)} flashRow={landed ? 5 : -1} brand />
              {/* the arm: tail anchored INSIDE, rising out and curling back over the mouth */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={`M ${CXp} ${52 / 100 * H} L ${CXp} ${TOPp - u * 4} C ${CXp + u * 5.5} ${TOPp - u * 7.5}, ${CXp + u * 8} ${TOPp - u * 4}, ${CXp + u * 3.4} ${TOPp - u * 1.4}`}
                  fill="none" stroke={LIME} strokeWidth={u * 0.32} strokeLinecap="round"
                  strokeDasharray={u * 30} strokeDashoffset={u * 30 * (1 - armP)} opacity={0.95}
                  style={{ filter: `drop-shadow(0 0 ${u * 0.6}px ${LIME}88)` }} />
                {armP >= 1 && <polygon points={`${CXp + u * 2.6},${TOPp - u * 1.9} ${CXp + u * 4.4},${TOPp - u * 1.6} ${CXp + u * 3.2},${TOPp - u * 0.2}`} fill={LIME} />}
              </svg>
              {/* the card it drops back in */}
              {dropP > 0 && dropP < 1 && (
                <Card x={26 + 3.4 * (1 - dropP)} y={lerp(28, 40, dropP)} u={u} label="new row" money scale={0.8 - dropP * 0.25} opacity={1 - clamp01((dropP - 0.8) / 0.2)} />
              )}
              <div style={{ position: "absolute", left: "26%", top: "80%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 800, fontSize: u * 1.5, color: landed ? LIME : SILVER, fontVariantNumeric: "tabular-nums" }}>{landed ? "4,813" : "4,812"} ROWS</div>
            </div>
          ); })()}

        {/* B15 (79.1–93.7): clocks fire cards → rows (REPLAY SPIKE) */}
        {t >= 79.7 && t < 94.0 && (() => { const on = clamp01((t - 79.9) / 0.35) * (1 - clamp01((t - 93.7) / 0.3));
          // each firing: its clock pulses a ring, EJECTS a card, the card rides to the cylinder
          const CARDS = [
            { l: "MSG · Sara", m: false, at: 81.6, clock: 1 },
            { l: "ORDER #1041", m: true, at: 82.4, clock: 0 },
            { l: "VISITS 1,198", m: false, at: 83.8, clock: 1 },
            { l: "new order #4482", m: true, at: 85.8, clock: 0 },
            { l: "DM: invoice?", m: false, at: 87.4, clock: 1 },
            { l: "visits 1,204", m: false, at: 88.9, clock: 1 },
          ];
          const arrived = CARDS.filter((c) => t > c.at + 1.0).length;
          const ring = (at: number) => { const dt = t - at; return dt > 0 && dt < 0.5 ? Math.sin((dt / 0.5) * Math.PI) : 0; };
          const lastRing = (ci: number) => CARDS.filter((c) => c.clock === ci).reduce((m, c) => Math.max(m, ring(c.at)), 0);
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={80.9} center y="10%" size={3.1}><Marker u={u} t={t} at={81.2}>AUTOMATIC</Marker> EVERY HOUR</HL>
              {/* clock chips — each firing pulses a lime ring around its clock */}
              {[{ tx: "EVERY 1 HR", y: 30, at: 80.9 }, { tx: "EVERY 5 MIN", y: 44, at: 82.4 }].map((c, ci) => (
                <div key={ci}>
                  {lastRing(ci) > 0 && <div style={{ position: "absolute", left: "16%", top: `${c.y}%`, width: u * (10 + lastRing(ci) * 6), height: u * (5 + lastRing(ci) * 3), transform: "translate(-50%,-50%)", border: `${u * 0.14}px solid ${LIME}`, borderRadius: u * 3, opacity: 1 - lastRing(ci) * 0.8 }} />}
                  <Chip x={16} y={c.y} u={u} text={c.tx} lime o={clamp01((t - c.at) / 0.35)} sc={1 + lastRing(ci) * 0.08} icon={<Img src={staticFile("logos/lucide-clock-4-silver.svg")} style={{ width: u * 1.05, height: u * 1.05, flexShrink: 0 }} />} />
                </div>
              ))}
              {/* stream into cylinder */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={`M ${W * 0.1} ${H * 0.62} C ${W * 0.3} ${H * 0.66}, ${W * 0.42} ${H * 0.6}, ${W * 0.56} ${H * 0.5}`} stroke={LIME} strokeWidth={u * 0.3} fill="none" strokeLinecap="round" strokeDasharray={`${u * 2.2} ${u * 1.3}`} strokeDashoffset={-t * u * 6} opacity={0.8} />
              </svg>
              <Cyl x={62} y={46} u={u} W={W} H={H} rows={1 + arrived} flashRow={arrived > 0 && t < CARDS[arrived - 1].at + 1.35 ? arrived : -1} />
              <div style={{ position: "absolute", left: "62%", top: "81%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.14em", color: LIME }}>DATABASE</div>
                <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.9, color: SILVER, fontVariantNumeric: "tabular-nums" }}>{(4810 + arrived).toLocaleString("en-US")} ROWS</div>
              </div>
              {/* cards eject FROM their clock and ride to the cylinder */}
              {CARDS.map((c, i) => { const p = clamp01((t - c.at) / 1.0); if (p <= 0 || p >= 1) return null;
                const sy = c.clock === 0 ? 30 : 44;
                const x = lerp(21, 58, p), y = lerp(sy, 40, p) + Math.sin(p * Math.PI) * 7;
                return <Card key={i} x={x} y={y} u={u} label={c.l} money={c.m} scale={0.92 - p * 0.28} opacity={clamp01(p * 5) * (1 - clamp01((p - 0.88) / 0.12))} />; })}
              {/* manual: none */}
              <Chip x={62} y={91} u={u} text="MANUAL WORK: ✕ NONE" grey o={clamp01((t - 91.5) / 0.4)} />
            </div>
          ); })()}

        {/* B16 (93.7–100.6): I open Claude and ask — Claude is CABLED into the Supabase database.
            The question rides down the cable into the cylinder; the answer comes back, always fresh. */}
        {t >= 93.7 && t < 100.9 && (() => { const on = clamp01((t - 93.9) / 0.3) * (1 - clamp01((t - 100.6) / 0.3));
          const q = "WHAT'S REVENUE THIS WEEK?";
          const typed = q.slice(0, Math.max(0, Math.floor((t - 94.4) * 24)));
          const cableP = clamp01((t - 95.0) / 0.6);   // the cable connects Claude → database
          const ansP = clamp01((t - 95.9) / 0.35);
          const freshP = clamp01((t - 96.8) / 1.2);   // the new order arriving
          const flipP = clamp01((t - 98.4) / 0.3);    // the answer UPDATES because of it
          const cxA = 0.30 * W, cyA = 0.44 * H;        // cable start (Claude side)
          const cxB = 0.545 * W, cyB = 0.46 * H;       // cable end (plug at the database)
          const cable = `M ${cxA} ${cyA} C ${cxA + (cxB - cxA) * 0.4} ${cyA}, ${cxB - (cxB - cxA) * 0.4} ${cyB}, ${cxB} ${cyB}`;
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={99.3} center y="10%" size={3.0}><Marker u={u} t={t} at={99.6}>ALWAYS</Marker> UP TO DATE</HL>
              {/* the cable: Claude plugged straight into the Supabase database */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={cable} fill="none" stroke="#2a3145" strokeWidth={u * 0.75} strokeLinecap="round" strokeDasharray={u * 42} strokeDashoffset={u * 42 * (1 - cableP)} />
                <path d={cable} fill="none" stroke={LIME} strokeWidth={u * 0.28} strokeLinecap="round" strokeDasharray={`${u * 2.0} ${u * 1.4}`} strokeDashoffset={-t * u * 7} opacity={cableP * 0.9} />
              </svg>
              {/* plug where the cable meets the cylinder */}
              {cableP > 0.5 && <div style={{ position: "absolute", left: "54.5%", top: "46%", transform: "translate(-50%,-50%)", width: u * 1.5, height: u * 2.6, background: LIME, borderRadius: u * 0.3, opacity: clamp01((cableP - 0.5) * 2) }} />}
              {/* Claude node */}
              <div style={{ position: "absolute", left: "20%", top: "40%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 94.0) / 0.4) }}>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.8, transform: `translate(${u * 0.5}px,${u * 0.5}px)`, opacity: 0.85 }} />
                  <div style={{ position: "relative", background: RAISIN, border: `${u * 0.14}px solid ${SILVER}`, borderRadius: u * 0.8, padding: `${u * 1.0}px ${u * 1.8}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.9, color: SILVER, display: "flex", alignItems: "center", gap: u * 0.7 }}><Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.6, height: u * 1.6, flexShrink: 0 }} />CLAUDE</div>
                </div>
              </div>
              {/* the question I ask */}
              <div style={{ position: "absolute", left: "20%", top: "55%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 94.4) / 0.3) }}>
                <div style={{ background: RAISIN, border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.6, padding: `${u * 0.7}px ${u * 1.2}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, color: LIME, whiteSpace: "nowrap", width: u * 24 }}>{typed}<span style={{ opacity: Math.floor(t * 2.4) % 2 === 0 && t < 96.6 ? 1 : 0 }}>▌</span></div>
              </div>
              {/* the Supabase database (brand mark renders under the cylinder) */}
              <Cyl x={62} y={46} u={u} W={W} H={H} rows={t > 97.9 ? 7 : 6} flashRow={t > 97.9 && t < 98.9 ? 6 : -1} brand />
              <div style={{ position: "absolute", left: "62%", top: "81%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.14em", color: LIME }}>DATABASE</div>
              {/* NEW data arrives while we watch — this is what makes the answer fresh */}
              {freshP > 0 && freshP < 1 && (
                <Card x={lerp(96, 62, freshP)} y={lerp(20, 33, freshP)} u={u} label="ORDER · €120 · just now" money scale={0.95 - freshP * 0.25} opacity={clamp01(freshP * 5) * (1 - clamp01((freshP - 0.85) / 0.15))} />
              )}
              {/* the answer comes back to Claude */}
              {ansP > 0 && (
                <div style={{ position: "absolute", left: "20%", top: "70%", transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * ansP})`, opacity: ansP }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.7, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} />
                    <div style={{ position: "relative", background: "#12151d", border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.7, padding: `${u * 0.9}px ${u * 1.6}px`, textAlign: "center" }}>
                      <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 3.0, color: LIME, fontVariantNumeric: "tabular-nums", textShadow: flipP > 0 && flipP < 1 ? `0 0 ${u * 1.4}px ${LIME}` : "none" }}>{flipP > 0.5 ? "€3,940" : "€3,820"}</div>
                      <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 0.95, color: flipP > 0.5 ? LIME : BODY, marginTop: u * 0.2, opacity: clamp01((t - 96.4) / 0.3) }}>{flipP > 0.5 ? "updated just now ↺" : "updated 2 min ago"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ); })()}

        {/* B18 (109.9–115.2): the two-column law */}
        {t >= 110.5 && t < 115.5 && (() => { const on = clamp01((t - 110.7) / 0.35) * (1 - clamp01((t - 115.2) / 0.25));
          const divP = clamp01((t - 110.4) / 0.5);
          const lP = clamp01((t - 111.7) / 0.4), rP = clamp01((t - 113.5) / 0.4);
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "12%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: lite > 0.5 ? RAISIN : LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.2em", color: inkSoft }}>THE LAW</span>
              </div>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <line x1={W * 0.5} y1={H * 0.22} x2={W * 0.5} y2={H * 0.22 + H * 0.56 * divP} stroke={lite > 0.5 ? "#c3c9cd" : "#2a3145"} strokeWidth={u * 0.14} />
              </svg>
              {/* things visibly HELD: a recipe drops into the file, a fact into the cylinder */}
              {(() => { const rp2 = clamp01((t - 111.9) / 0.5); if (rp2 <= 0 || rp2 >= 1) return null;
                return <Chip x={30} y={lerp(22, 42, rp2)} u={u} text="IF refund > €100 → escalate" o={1 - clamp01((rp2 - 0.8) / 0.2)} sc={0.9 - rp2 * 0.2} />; })()}
              {(() => { const fp2 = clamp01((t - 113.6) / 0.5); if (fp2 <= 0 || fp2 >= 1) return null;
                return <Chip x={70} y={lerp(22, 40, fp2)} u={u} text="MRR €15,240" lime o={1 - clamp01((fp2 - 0.8) / 0.2)} sc={0.9 - fp2 * 0.2} />; })()}
              {/* left: files → recipes */}
              <div style={{ position: "absolute", left: "30%", top: "45%", transform: "translate(-50%,-50%)", opacity: lP }}>
                <svg width={u * 13} height={u * 16} viewBox="0 0 26 32">
                  <path d="M2 2 h14 l7 7 v21 h-21 z" fill={lite > 0.5 ? WHITE : "#12151d"} stroke={lite > 0.5 ? RAISIN : SILVER} strokeWidth={1.1} strokeLinejoin="round" />
                  <path d="M16 2 v7 h7" fill="none" stroke={lite > 0.5 ? RAISIN : SILVER} strokeWidth={1.1} />
                  <path d="M6 14 h13 M6 18 h13 M6 22 h9" stroke={BODY} strokeWidth={0.9} />
                </svg>
                <Img src={staticFile(`logos/markdown-${lite > 0.5 ? "dark" : "silver"}.svg`)} style={{ position: "absolute", left: "48%", top: u * 11.6, transform: "translateX(-50%)", width: u * 3.2, height: u * 1.97 }} />
              </div>
              <div style={{ position: "absolute", left: "30%", top: "66%", transform: "translate(-50%,-50%)", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: ink, textTransform: "uppercase", opacity: lP }}>RECIPES</div>
              <div style={{ position: "absolute", left: "30%", top: "72%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: BODY, opacity: lP }}>files</div>
              {/* right: database → truth */}
              <Cyl x={70} y={44} u={u} W={W} H={H} s={0.56} rows={5} draw={clamp01((t - 111.7) / 0.5)} ink={lite > 0.5 ? RAISIN : LIME} />
              <div style={{ position: "absolute", left: "70%", top: "66%", transform: "translate(-50%,-50%)", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: lite > 0.5 ? RAISIN : LIME, textTransform: "uppercase", opacity: rP }}>TRUTH</div>
              <div style={{ position: "absolute", left: "70%", top: "72%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: BODY, opacity: rP }}>database</div>
            </div>
          ); })()}
      </div>

      {/* ================= SCRIM + FOOTAGE ================= */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.55) 0%, transparent 26%, transparent 60%, rgba(8,10,14,0.72) 100%)`, opacity: full, pointerEvents: "none" }} />
      <FootageLayer sk={sk} u={u} src="footage/act2.mp4" />

      {/* B3 (6.2–9.3): task chip clicks INTO the file (✓ rides its edge); fact chip bounces OFF
            and rests clearly outside (✕ attached to the chip, moving with it) */}
        {t >= 6.2 && t < 9.6 && (() => { const on = clamp01((t - 6.4) / 0.3) * (1 - clamp01((t - 9.3) / 0.3));
          const taskP = clamp01((t - 6.9) / 0.5);
          const factT = clamp01((t - 7.8) / 1.2);   // slower so the REJECTION reads clearly
          // fly in toward the file edge (x≈22), SLAM at 0.42, get thrown back out to rest far outside-left (x=6)
          const factX = factT < 0.42 ? lerp(-1, 22, factT / 0.42) : lerp(22, 6, EASE_OVER((factT - 0.42) / 0.58));
          const hit = factT >= 0.4;
          const repel = factT > 0.4 && factT < 0.66 ? Math.sin(((factT - 0.4) / 0.26) * Math.PI) : 0; // impact flash: the md shoves it back
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={6.6} size={3.1} y="16%">TASKS, NOT <Marker u={u} t={t} at={6.8}>FACTS</Marker></HL>
              <FileGraphic x={26} y={46} u={u} W={W} H={H} draw={1} />
              {/* task chip: slides fully INSIDE the file body */}
              <div style={{ position: "absolute", left: `${taskP < 1 ? 6 + taskP * 19 : 25}%`, top: "41%", transform: "translate(-50%,-50%)", opacity: taskP > 0 ? 1 : 0 }}>
                <div style={{ position: "relative", background: "#1c2233", border: `${u * 0.1}px solid ${SILVER_MID}`, borderRadius: u * 0.4, padding: `${u * 0.4}px ${u * 0.9}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: SILVER, whiteSpace: "nowrap" }}>
                  ☐ send invoice
                  {taskP >= 1 && <span style={{ position: "absolute", right: -u * 0.9, top: "50%", transform: `translateY(-50%) scale(${1 + 0.2 * (1 - clamp01((t - 7.4) / 0.3))})`, width: u * 1.7, height: u * 1.7, borderRadius: "50%", background: LIME, color: RAISIN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.0 }}>✓</span>}
                </div>
              </div>
              {/* impact flash at the file face — the md physically repels the fact */}
              {repel > 0 && (
                <div style={{ position: "absolute", left: "21%", top: "52%", transform: `translate(-50%,-50%) scale(${0.5 + repel * 1.3})`, width: u * 7, height: u * 7, borderRadius: "50%", border: `${u * 0.22}px solid ${SILVER}`, opacity: repel * 0.85 }} />
              )}
              {/* fact chip: SLAMS the file, gets thrown back out BIG with a bold ✕ — the md can't hold a fact */}
              {factT > 0 && (
                <div style={{ position: "absolute", left: `${factX}%`, top: "52%", transform: `translate(-50%,-50%) rotate(${hit ? lerp(0, -9, clamp01((factT - 0.42) / 0.35)) : 0}deg) scale(${1.3 * (1 - (hit && factT < 0.56 ? 0.1 : 0))})` }}>
                  <div style={{ position: "relative", background: RAISIN, border: `${u * 0.13}px solid ${LIME}`, borderRadius: u * 0.45, padding: `${u * 0.55}px ${u * 1.1}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, color: LIME, whiteSpace: "nowrap" }}>
                    MRR €15,240
                    {factT >= 0.5 && <span style={{ position: "absolute", right: -u * 1.3, top: "50%", transform: `translateY(-50%) scale(${1 + 0.4 * (1 - clamp01((t - 8.6) / 0.35))})`, width: u * 2.4, height: u * 2.4, borderRadius: "50%", background: "#2a2f3d", border: `${u * 0.12}px solid ${SILVER}`, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5 }}>✕</span>}
                  </div>
                </div>
              )}
            </div>
          ); })()}


      {/* B2 (2.4–6.2): the wrong job — THREE cards tap the file, fail to stick, and slide off
            into a crooked pile below. The file never reacts: it just can't do this job. */}
        {t >= 3.0 && t < 6.4 && (() => { const on = clamp01((t - 3.2) / 0.4) * (1 - clamp01((t - 6.0) / 0.3));
          const DRP = [
            { l: "payout €3,900", at: 2.6, restX: 27, restY: 79, restR: -8 },
            { l: "refund €120", at: 3.4, restX: 31, restY: 76, restR: 6 },
            { l: "invoice paid", at: 4.2, restX: 24, restY: 74, restR: -4 },
          ];
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={4.6} size={3.1} y="14%">THE <Marker u={u} t={t} at={4.8}>WRONG</Marker> JOB</HL>
              <FileGraphic x={24} y={42} u={u} W={W} H={H} frozen draw={1} />
              {DRP.map((c, i) => {
                const dt = t - c.at; if (dt < 0) return null;
                const inP = clamp01(dt / 0.4);            // fly in diagonally to the file face
                const hold = clamp01((dt - 0.4) / 0.2);    // brief hit-pause on the face
                const off = clamp01((dt - 0.6) / 0.45);    // slide off to the pile
                const x = off > 0 ? lerp(24, c.restX, off) : lerp(6, 24, inP);
                const y = off > 0 ? lerp(36, c.restY, off * off) : lerp(16, 36, inP);
                const r = off > 0 ? lerp(0, c.restR + 14 * Math.sin(off * Math.PI), off) : 0;
                return <Card key={i} x={x} y={y} u={u} label={c.l} money={i !== 2} scale={0.98 - hold * 0.04} rot={off > 0 ? r : inP * 2} />;
              })}
              {t > 5.5 && (
                <div style={{ position: "absolute", left: "31%", top: "52%", transform: `translate(-50%,-50%) scale(${1.2 - 0.2 * clamp01((t - 5.5) / 0.25)})`, opacity: clamp01((t - 5.5) / 0.25) }}>
                  <div style={{ position: "relative" }}><div style={{ position: "absolute", inset: 0, background: LIME, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} /><div style={{ position: "relative", background: RAISIN, border: `${u * 0.14}px solid ${SILVER}`, padding: `${u * 0.5}px ${u * 1.3}px`, fontFamily: SANS, fontWeight: 800, fontSize: u * 2.7, color: LIME }}>02</div></div>
                </div>
              )}
            </div>
          ); })()}


      {/* ================= OVERLAYS ON FOOTAGE ================= */}
      {/* B1 (0–2.4): it gets worse — the cracked file takes a SECOND hit: a new fissure traces
          with a lime flash, and a corner shard snaps off exactly on "worse". No text plate. */}
      {t < 2.8 && (() => { const out = 1 - clamp01((t - 2.2) / 0.4);
        const dieP = clamp01((t - 1.9) / 0.6); // on "worse": the glow dies, the file sags lifeless
        return (
          <div style={{ position: "absolute", left: "14%", top: "55%", transform: `translate(-50%,-50%) rotate(${dieP * -5}deg) translateY(${dieP * u * 0.8}px)`, opacity: out }}>
            <div style={{ position: "absolute", inset: -u * 2, background: `radial-gradient(circle, ${LIME}18 0%, transparent 65%)`, opacity: 1 - dieP }} />
            <svg width={u * 12} height={u * 15.5} viewBox="0 0 28 36" style={{ filter: `saturate(${1 - dieP * 0.8}) brightness(${1 - dieP * 0.3})` }}>
              <path d="M2 2 h15 l8 8 v24 h-23 z" fill="#1b2030" stroke={SILVER_MID} strokeWidth={1.2} strokeLinejoin="round" />
              <path d="M17 2 v8 h8" fill="none" stroke={SILVER_MID} strokeWidth={1.2} />
              <path d="M6 16 h13 M6 21 h15 M6 26 h10" stroke="#39415a" strokeWidth={1.0} />
            </svg>
            <Img src={staticFile("logos/markdown-silver.svg")} style={{ position: "absolute", left: "48%", top: u * 11.9, transform: "translateX(-50%)", width: u * 3.0, height: u * 1.85, filter: `saturate(${1 - dieP * 0.8}) brightness(${1 - dieP * 0.3})` }} />
            <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: SILVER_MID, marginTop: u * 0.5, textAlign: "center" }}>business.md</div>
          </div>
        ); })()}

      {/* B9 (37.6–41.6): the difference everyone missed — TEXT (a file) is NOT the same thing as
          FACTS (the database). One clear, slow reveal: a big lime "≠" draws between them and holds. */}
      {t >= 38.2 && t < 41.8 && (() => { const on = clamp01((t - 38.4) / 0.4) * (1 - clamp01((t - 41.4) / 0.3));
        const fileP = clamp01((t - 38.6) / 0.6);
        const dbP = clamp01((t - 39.1) / 0.6);
        const neP = clamp01((t - 39.5) / 1.2);        // the ≠ draws SLOWLY on "the difference"
        const cx = 0.30 * W, cy = 0.46 * H, r = u * 3.0;
        return (
          <div style={{ opacity: on }}>
            <HL u={u} t={t} at={38.7} size={2.7} y="13%">EVERYONE <Marker u={u} t={t} at={38.9}>MISSED</Marker> THIS</HL>
            {/* LEFT: the text file */}
            <div style={{ opacity: fileP }}>
              <FileGraphic x={15} y={44} u={u} W={W} H={H} scale={0.92} draw={1} name="business.md" />
            </div>
            <div style={{ position: "absolute", left: "15%", top: "70%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: fileP }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: SILVER, textTransform: "uppercase" }}>TEXT</div>
              <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, letterSpacing: "0.12em", color: SILVER_MID }}>instructions</div>
            </div>
            {/* RIGHT: the database (facts) */}
            <Cyl x={46} y={44} u={u} W={W} H={H} s={0.78} rows={5} draw={dbP} />
            <div style={{ position: "absolute", left: "46%", top: "70%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: dbP }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: LIME, textTransform: "uppercase" }}>FACTS</div>
              <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, letterSpacing: "0.12em", color: SILVER_MID }}>what's true</div>
            </div>
            {/* the difference: a big lime ≠ drawn slowly between them, then held */}
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <line x1={cx - r} y1={cy - u * 1.0} x2={cx + r} y2={cy - u * 1.0} stroke={LIME} strokeWidth={u * 0.6} strokeLinecap="round" strokeDasharray={2 * r} strokeDashoffset={2 * r * (1 - clamp01(neP * 2.2))} />
              <line x1={cx - r} y1={cy + u * 1.0} x2={cx + r} y2={cy + u * 1.0} stroke={LIME} strokeWidth={u * 0.6} strokeLinecap="round" strokeDasharray={2 * r} strokeDashoffset={2 * r * (1 - clamp01((neP - 0.28) * 2.2))} />
              <line x1={cx + r * 0.72} y1={cy - r} x2={cx - r * 0.72} y2={cy + r} stroke={LIME} strokeWidth={u * 0.6} strokeLinecap="round" strokeDasharray={2.7 * r} strokeDashoffset={2.7 * r * (1 - clamp01((neP - 0.55) * 2.5))} />
            </svg>
          </div>
        ); })()}

      {/* B17 (100.6–109.9): "not too technical" — the heavy FULL BUILD cluster dims small at top,
          while ONE simple lime STARTER card lands big below it. Small scary vs big easy. */}
      {t >= 101.2 && t < 110.1 && (() => { const on = clamp01((t - 101.4) / 0.4) * (1 - clamp01((t - 109.7) / 0.3));
        const starterP = clamp01((t - 105.0) / 0.4);
        return (
          <div style={{ opacity: on }}>
            {/* the full build — dense, dim, small */}
            <div style={{ position: "absolute", left: "26%", top: "34%", transform: "translate(-50%,-50%)", opacity: 0.42, filter: "saturate(0.35)" }}>
              <div style={{ position: "relative", width: u * 34, height: u * 12 }}>
                <div style={{ position: "absolute", left: 0, top: u * 1 }}><Win u={u} w={9} title="files"><div style={{ height: u * 3.5 }} /></Win></div>
                <div style={{ position: "absolute", left: u * 10.5, top: 0 }}><Win u={u} w={9} title="loops"><div style={{ height: u * 3.5 }} /></Win></div>
                <div style={{ position: "absolute", left: u * 20.5, top: u * 1.4 }}><Win u={u} w={13.5} title="dashboard"><div style={{ height: u * 3.5 }} /></Win></div>
                <svg width={u * 34} height={u * 12} viewBox="0 0 68 24" style={{ position: "absolute", inset: 0 }}>
                  <g transform="translate(34 17) scale(0.5)"><g fill="none" stroke={SILVER_MID} strokeWidth={1}><path d="M-11 -13 a11 4 0 1 0 22 0 a11 4 0 1 0 -22 0" /><path d="M-11 -13 L-11 13 M11 -13 L11 13 M-11 13 a11 4 0 0 0 22 0" /></g></g>
                </svg>
              </div>
              <div style={{ marginTop: u * 0.5, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.14em", color: "#5a6478" }}>THE FULL BUILD · later</div>
            </div>
            {/* the starter — one clean lime card, the simplest place to begin */}
            {starterP > 0 && (
              <div style={{ position: "absolute", left: "26%", top: "68%", transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * starterP})`, opacity: starterP }}>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.9, transform: `translate(${u * 0.7}px,${u * 0.7}px)` }} />
                  <div style={{ position: "relative", background: RAISIN, border: `${u * 0.14}px solid ${LIME}`, borderRadius: u * 0.9, padding: `${u * 1.6}px ${u * 3.0}px`, textAlign: "center" }}>
                    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.5, color: LIME, textTransform: "uppercase", whiteSpace: "nowrap" }}>STARTER VERSION</div>
                    <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.1, color: SILVER_MID, marginTop: u * 0.5, whiteSpace: "nowrap" }}>the simplest version — start here</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ); })()}

      {/* B19 (115.2–121.5): closer — the TWO things you now understand, flanking Luuk's head:
          a clean simple markdown file on the LEFT, a clean simple database on the RIGHT. */}
      {t >= 115.8 && t < 121.5 && (() => { const on = clamp01((t - 116.0) / 0.4);
        const fileOn = clamp01((t - 116.6) / 0.4);
        const dbOn = clamp01((t - 117.4) / 0.4);
        return (<>
          {/* headline, centered top */}
          <div style={{ position: "absolute", left: "50%", top: "89%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", opacity: on }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.4, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} />
              <div style={{ position: "relative", background: "rgba(14,16,22,0.92)", borderRadius: u * 0.4, padding: `${u * 0.7}px ${u * 1.4}px` }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.7, color: SILVER, textTransform: "uppercase" }}>YOU UNDERSTAND <Marker u={u} t={t} at={117.6}>BOTH</Marker></span>
              </div>
            </div>
          </div>
          {/* LEFT of the head: one clean markdown file */}
          <div style={{ opacity: fileOn }}>
            <div style={{ position: "absolute", left: "21%", top: "60%", transform: "translate(-50%,-50%)", width: u * 20, height: u * 26, background: "radial-gradient(ellipse at center, rgba(10,12,18,0.62) 0%, transparent 72%)" }} />
            <FileGraphic x={21} y={57} u={u} W={W} H={H} scale={0.92} name="business.md" />
            <div style={{ position: "absolute", left: "21%", top: "80%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.0, color: SILVER, textTransform: "uppercase" }}>ONE FILE</div>
              <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, letterSpacing: "0.14em", color: SILVER_MID }}>the recipes</div>
            </div>
          </div>
          {/* RIGHT of the head: one clean database */}
          <div style={{ opacity: dbOn }}>
            <div style={{ position: "absolute", left: "79%", top: "58%", transform: "translate(-50%,-50%)", width: u * 24, height: u * 28, background: "radial-gradient(ellipse at center, rgba(10,12,18,0.62) 0%, transparent 72%)" }} />
            <Cyl x={79} y={55} u={u} W={W} H={H} s={0.72} rows={6} draw={dbOn} />
            <div style={{ position: "absolute", left: "79%", top: "80%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.0, color: SILVER, textTransform: "uppercase" }}>ONE DATABASE</div>
              <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, letterSpacing: "0.14em", color: SILVER_MID }}>the truth</div>
            </div>
          </div>
        </>); })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default Act2;
