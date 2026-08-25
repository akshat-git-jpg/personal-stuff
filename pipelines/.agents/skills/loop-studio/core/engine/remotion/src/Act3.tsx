/**
 * Act3 — "THE ANSWER AND THE MACHINE" (narration 263.34–377.38s → local 0–114.0s).
 * Beats 1–6: the answer returns (query chip ANSWERED, receipt card, ALREADY THERE spike, collapse
 * to a lime dot). Beats 7–20: THE MACHINE ASSEMBLY — one persistent scene: cylinder → lists drawer
 * out → stream docks cards → loop rings tick at four speeds → drumroll fill (TYPED BY ME: 0) →
 * file window docks (HOW) → dashboard docks (WHAT reads live) → tiny AI MODEL last → named
 * "A BUSINESS BRAIN" (pulse + bracket) → then everything greys except the lonely file window:
 * "a note about a business." Voice only; SFX + music in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Card, Marker, DarkBg, GRAIN_URL,
} from "./bb2/scene";
import { Win } from "./bb2/concepts";

const FPS = 30;

/* mono chip */
const Chip: React.FC<{ x: number; y: number; u: number; text: string; lime?: boolean; grey?: boolean; white?: boolean; o?: number; sc?: number }> = ({ x, y, u, text, lime, grey, white, o = 1, sc = 1 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${sc})`, opacity: o }}>
    <div style={{ background: white ? WHITE : grey ? "#1a1f2b" : RAISIN, border: `${u * 0.1}px solid ${white ? WHITE : grey ? "#3a4256" : lime ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: white ? RAISIN : grey ? SILVER_MID : lime ? LIME : SILVER, whiteSpace: "nowrap", boxShadow: white ? `0 ${u * 0.3}px ${u * 0.9}px rgba(0,0,0,0.35)` : "none" }}>{text}</div>
  </div>
);
const HL: React.FC<{ u: number; t: number; at: number; out?: number; x?: string; y?: string; size?: number; children: React.ReactNode; center?: boolean }> = ({ u, t, at, out, x = "6%", y = "12%", size = 3.1, children, center }) => (
  <div style={{ position: "absolute", left: center ? "50%" : x, top: y, transform: center ? "translate(-50%,-50%)" : undefined, whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - at) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

/* mini list stack: a small drawer of row-bars with a mono label */
const ListStack: React.FC<{ x: number; y: number; u: number; label: string; rows: number; on: number; grey?: boolean; icons?: string[] }> = ({ x, y, u, label, rows, on, grey, icons }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) translateX(${(1 - on) * u * 2}px)`, opacity: on }}>
    {/* real source-brand logos sit ABOVE the drawer so it reads as "this list is fed by these apps" */}
    {icons && icons.length > 0 && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.5, marginBottom: u * 0.45, opacity: grey ? 0.4 : 1, filter: grey ? "grayscale(1)" : "none" }}>
        {icons.map((ic, i) => (
          <div key={i} style={{ width: u * 1.7, height: u * 1.7, borderRadius: u * 0.35, background: "#12151d", border: `${u * 0.08}px solid ${grey ? "#3a4256" : "#2a3145"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Img src={staticFile(ic)} style={{ width: u * 1.05, height: u * 1.05, objectFit: "contain" }} />
          </div>
        ))}
      </div>
    )}
    <div style={{ width: u * 7.5, background: "#12151d", border: `${u * 0.09}px solid ${grey ? "#3a4256" : "#2a3145"}`, borderRadius: u * 0.5, padding: `${u * 0.55}px ${u * 0.65}px`, display: "flex", flexDirection: "column", gap: u * 0.35 }}>
      {Array.from({ length: Math.min(5, rows) }).map((_, i) => (
        <div key={i} style={{ height: u * 0.6, borderRadius: u * 0.15, background: grey ? "#3a4256" : LIME, opacity: 0.4 + (i === rows - 1 ? 0.4 : 0) }} />
      ))}
    </div>
    <div style={{ marginTop: u * 0.4, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, color: grey ? "#4a5268" : SILVER_SOFT }}>
      {label}
    </div>
  </div>
);

/* loop ring: circular arrow + rotating hand + badge */
const LoopRing: React.FC<{ x: number; y: number; u: number; badge: string; speed: number; t: number; on: number; grey?: boolean; flash?: number }> = ({ x, y, u, badge, speed, t, on, grey, flash = 0 }) => {
  const ang = grey ? 45 : (t * speed * 360) % 360;
  const col = grey ? "#3a4256" : LIME;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * on + flash * 0.1})`, opacity: on }}>
      <svg width={u * 4.6} height={u * 4.6} viewBox="0 0 46 46">
        <circle cx={23} cy={23} r={17} fill="#12151d" stroke={col} strokeWidth={2.4} strokeDasharray="80 27" strokeLinecap="round" transform="rotate(-60 23 23)" opacity={0.9 + flash * 0.1} />
        <polygon points="38,9 44,13 37,16" fill={col} />
        <line x1={23} y1={23} x2={23 + 11 * Math.sin(ang * Math.PI / 180)} y2={23 - 11 * Math.cos(ang * Math.PI / 180)} stroke={grey ? "#4a5268" : SILVER} strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={23} cy={23} r={1.8} fill={grey ? "#4a5268" : SILVER} />
      </svg>
      <div style={{ marginTop: u * 0.15, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.72, letterSpacing: "0.08em", color: grey ? "#4a5268" : SILVER_MID, whiteSpace: "nowrap" }}>{badge}</div>
    </div>
  );
};

export const Act3: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // b1-2 full
    { t: 24.1, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // b1-4 FULL footage + side graphics
    { t: 24.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // b5 hidden
    { t: 30.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 31.1, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // b6 full
    { t: 34.9, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 35.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // b7-20 hidden: THE MACHINE
    { t: 114.0, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);

  /* ============================== MACHINE STATE (beats 7–20) ============================== */
  const CYL = { x: 46, y: 50 };
  const LISTS = [
    { key: "revenue", icons: ["logos/brand-stripe.svg", "logos/brand-revolut.svg"], x: 22, y: 32 },
    { key: "messages", icons: ["logos/brand-gmail.svg", "logos/brand-whatsapp.svg", "logos/brand-instagram.svg"], x: 14, y: 50 },
    { key: "content", icons: ["logos/youtube.svg", "logos/brand-tiktok.svg"], x: 22, y: 68 },
    { key: "jobs", icons: ["logos/lucide-briefcase-silver.svg"], x: 60, y: 79 },
  ];
  const listOnAt = [44.3, 45.6, 46.8, 48.4];
  const RINGS = [
    { badge: "EVERY HOUR", x: 8, y: 34, speed: 0.02, at: 58.8 },
    { badge: "EVERY MINUTE", x: 5.5, y: 55, speed: 0.35, at: 59.7 },
    { badge: "EVERY DAY", x: 11, y: 74, speed: 0.006, at: 60.5 },
    { badge: "EVERY WEEK", x: 34, y: 84, speed: 0.0012, at: 61.7 },
  ];
  // counter: every increment event in order
  const INC = [40.8, 41.1, 41.4, 51.6, 52.6, 53.8, 63.9, 66.1, 68.3, 70.4, 70.7, 71.0, 71.4, 71.8, 72.2, 72.6, 73.0, 75.4, 98.4];
  const frozenAt = 108.6;
  const rowCount = 4812 + INC.filter((x) => t > x && (t < frozenAt || x < frozenAt)).length;
  const machineOn = t >= 35.4 && t < 114.2;
  const fillGrow = clamp01((t - 42) / 34);          // beat 8-13: DB physically fills & grows (42→76s)
  const dotP = clamp01((t - 31.6) / 0.8);           // beat 6 collapse
  const cylP = clamp01((t - 35.8) / 0.7);           // beat 7 expand
  const searchP = clamp01((t - 41.6) / 0.8);
  const fileDockP = clamp01((t - 77.0) / 0.5);      // beat 14
  const dashDockP = clamp01((t - 94.0) / 0.5);      // beat 17
  const taskP = clamp01((t - 81.3) / 0.4);          // beat 15
  const howP = clamp01((t - 84.6) / 0.6);
  const whatP = clamp01((t - 86.5) / 0.6);
  const modelP = clamp01((t - 101.6) / 0.5);        // beat 18
  const pullP = clamp01((t - 105.6) / 0.6);         // beat 19 pull-back
  const heartbeat = clamp01((t - 106.1) / 0.9);
  const greyP = clamp01((t - frozenAt) / 0.8);      // beat 20
  const fileAwayP = clamp01((t - 110.2) / 0.9);
  const fileAwayE = EASE(fileAwayP);               // eased so the window glides to rest (no linear snap)
  const greyFilter = greyP > 0 ? `saturate(${1 - greyP}) brightness(${1 - greyP * 0.35})` : "none";

  /* loop firing cycles (beat 11 named + beat 12 drumroll) */
  // Each loop feeds ONLY its matching list (from ring -> to list): ring0 payments->revenue,
  // ring1 conversations->messages, ring3 yt-subs->content, ring2 jobs->jobs. A payment never routes to jobs.
  const FIRES = [
    { from: 0, to: 0, card: "payout €3,900", m: true, at: 63.6, name: "payments-loop" },
    { from: 1, to: 1, card: "convo saved", m: false, at: 65.8, name: "conversations-loop" },
    { from: 3, to: 2, card: "+12 subs", m: false, at: 68.0, name: "yt-subs-loop" },
    // drumroll (unlabeled, fast) — every ring fires only its own type to its own list
    { from: 0, to: 0, card: "€240", m: true, at: 70.2 }, { from: 1, to: 1, card: "msg", m: false, at: 70.5 },
    { from: 3, to: 2, card: "+3", m: false, at: 70.8 }, { from: 2, to: 3, card: "run ✓", m: false, at: 71.2 },
    { from: 0, to: 0, card: "€89", m: true, at: 71.6 }, { from: 1, to: 1, card: "msg", m: false, at: 72.0 },
    { from: 3, to: 2, card: "+1", m: false, at: 72.4 }, { from: 2, to: 3, card: "run ✓", m: false, at: 72.8 },
  ];

  /* stream cards docking (beat 9) */
  const DOCKS = [
    { card: "new order #4471", m: true, at: 50.8, list: 0 },
    { card: "DM: still there?", m: false, at: 51.9, list: 1 },
    { card: "video published", m: false, at: 53.0, list: 2 },
  ];
  const listRows = (li: number) => 3
    + DOCKS.filter((d) => d.list === li && t > d.at + 1.1).length
    + FIRES.filter((f) => f.to === li && t > f.at + 0.55).length;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("intros/businessbrain/act3_voice.m4a")} />
      <DarkBg u={u} gridOpacity={Math.max(0.4, sk.fr)} />

      {/* ============================ GRAPHICS WORLD ============================ */}
      <div style={{ position: "absolute", inset: 0, opacity: Math.max(graphicsOn, t > 13.5 && t < 24.5 ? 1 : 0) }}>

        
        
        {/* B5 (24.5–30.8): nothing was fed — chips bounce; threads snap to the base (SPIKE) */}
        {t >= 24.8 && t < 31.1 && (() => { const on = clamp01((t - 25.0) / 0.3) * (1 - clamp01((t - 30.7) / 0.35));
          const CAL = [{ l: "TODAY", at: 25.4 }, { l: "YESTERDAY", at: 26.6 }, { l: "LAST WEEK", at: 27.6 }];
          const threadP = clamp01((t - 29.0) / 0.35);
          return (
            <div style={{ opacity: on }}>
              {/* Claude's answer — a REAL dark Claude chat window (matches the NEW TASK window), markdown-style reply */}
              <div style={{ position: "absolute", left: "36%", top: "26%", transform: "translate(-50%,-50%)", width: u * 30 }}>
                <div style={{ background: RAISIN_DEEP, border: `${u * 0.1}px solid #2c3446`, borderRadius: u * 0.8, overflow: "hidden", boxShadow: `0 ${u * 0.8}px ${u * 2.2}px rgba(0,0,0,0.55)` }}>
                  {/* window chrome + Claude identity */}
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.5, padding: `${u * 0.55}px ${u * 0.9}px`, background: "#14171f", borderBottom: `${u * 0.07}px solid #20242f` }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.62, height: u * 0.62, borderRadius: "50%", background: i === 2 ? LIME : "#3a4256" }} />)}
                    <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.05, height: u * 1.05, marginLeft: u * 0.4 }} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.02em", color: SILVER_SOFT }}>claude</span>
                  </div>
                  {/* body: Claude's reply, revealed line-by-line like a real typed answer */}
                  <div style={{ padding: `${u * 0.9}px ${u * 1.1}px ${u * 1.0}px` }}>
                    <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 0.95, color: SILVER_MID, marginBottom: u * 0.7 }}>Here's what's dragging you down:</div>
                    {[
                      { label: "Margin per product", val: "€124", tail: " (your best lever)", strong: true },
                      { label: "Complaint", val: "“slow replies”", tail: "", strong: false },
                      { label: "Time sink", val: "11 h/week", tail: "", strong: true },
                    ].map((r, i) => {
                      const rp = clamp01((t - (25.6 + i * 0.5)) / 0.35);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: u * 0.4, marginBottom: i < 2 ? u * 0.5 : 0, fontFamily: SANS, fontWeight: 600, fontSize: u * 0.92, opacity: rp, transform: `translateY(${(1 - rp) * u * 0.5}px)`, whiteSpace: "nowrap" }}>
                          <span style={{ color: LIME, fontWeight: 700 }}>•</span>
                          <span style={{ color: SILVER_MID }}>{r.label} —</span>
                          <span style={{ color: SILVER, fontWeight: r.strong ? 800 : 600 }}>{r.val}</span>
                          {r.tail && <span style={{ color: SILVER_MID }}>{r.tail}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* calendar chips bounce off the card — WHITE plate, black text for contrast on the dark bg */}
              {CAL.map((c, i) => {
                const dt = t - c.at; if (dt < 0 || dt > 1.5) return null;
                const p = clamp01(dt / 0.5);
                const x = p < 0.5 ? lerp(4, 26, p * 2) : lerp(26, 12, (p - 0.5) * 2);
                const y = p < 0.5 ? lerp(60, 36, p * 2) : lerp(36, 78, (p - 0.5) * 2);
                return <Chip key={i} x={x} y={y} u={u} text={c.l} white o={1 - clamp01((dt - 1.0) / 0.5)} sc={1 - p * 0.15} />;
              })}
              {/* the database below; threads SNAP from rows to base rows */}
              <Cyl3 u={u} W={W} H={H} x={62} y={64} s={0.72} rows={5} flash={threadP > 0 && t < 30.0} />
              <div style={{ position: "absolute", left: "62%", top: "89.5%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 0.5, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.4, color: SILVER, fontVariantNumeric: "tabular-nums", opacity: clamp01((t - 25.4) / 0.4), whiteSpace: "nowrap" }}>
                <Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.2, height: u * 1.2, flexShrink: 0 }} />
                <span>4,812 ROWS</span>
              </div>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {[0, 1, 2].map((i) => {
                  // anchored at each fact row's right edge; top row travels farthest so paths stay parallel
                  const x1 = W * 0.512, y1 = H * (0.207 + i * 0.053);
                  const x2 = W * (0.66 - i * 0.04), y2 = H * (0.58 + i * 0.05);
                  const d = `M ${x1} ${y1} C ${x1 + u * 10} ${y1}, ${x2} ${y2 - u * 13}, ${x2} ${y2}`;
                  const len = u * 46;
                  return <path key={i} d={d} fill="none" stroke={LIME} strokeWidth={u * 0.22} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - threadP)} opacity={0.9} style={{ filter: `drop-shadow(0 0 ${u * 0.5}px ${LIME}66)` }} />;
                })}
              </svg>
              <HL u={u} t={t} at={29.0} x="5%" y="86%" size={3.4}><Marker u={u} t={t} at={29.4}>ALREADY</Marker> THERE</HL>
            </div>
          ); })()}

        {/* ================== THE MACHINE (beats 7–20, one persistent scene) ================== */}
        {machineOn && (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${1 - pullP * 0.12})`, transformOrigin: "46% 52%" }}>
            {/* --- everything that greys out lives in this wrapper --- */}
            <div style={{ position: "absolute", inset: 0, filter: greyFilter }}>
              {/* cylinder (expands from the beat-6 dot) */}
              <Cyl3 u={u} W={W} H={H} x={CYL.x} y={CYL.y} s={0.78 * (0.75 + 0.25 * cylP)} grow={fillGrow} opacity={cylP} rows={3 + Math.round(fillGrow * 6)} flash={INC.some((x) => t > x && t < x + 0.3)} grey={greyP > 0.5} />
              {/* search sweep (beat 7: "count and search") */}
              {searchP > 0 && searchP < 1 && (
                <div style={{ position: "absolute", left: `${CYL.x - 8}%`, top: `${CYL.y - 12 + searchP * 22}%`, width: "16%", height: u * 0.5, background: LIME, opacity: 0.75, boxShadow: `0 0 ${u}px ${LIME}` }} />
              )}
              {/* counter + zero tile */}
              <div style={{ position: "absolute", left: `${CYL.x}%`, top: "78.5%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: clamp01((t - 36.2) / 0.5) }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.5, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.6, color: greyP > 0.5 ? "#4a5268" : SILVER, fontVariantNumeric: "tabular-nums" }}>
                  <Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.2, height: u * 1.2, flexShrink: 0 }} />
                  <span>{rowCount.toLocaleString("en-US")} ROWS</span>
                </div>
                {t > 72.5 && <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, letterSpacing: "0.14em", color: greyP > 0.5 ? "#4a5268" : LIME, marginTop: u * 0.15 }}>AUTOMATIC</div>}
              </div>
              {/* lists drawer out with wires */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {LISTS.map((L, i) => {
                  const on = clamp01((t - listOnAt[i]) / 0.45);
                  if (on <= 0) return null;
                  const x1 = L.x / 100 * W, y1 = L.y / 100 * H;
                  const x2 = lerp(L.x, CYL.x, 0.72) / 100 * W, y2 = lerp(L.y, CYL.y, 0.72) / 100 * H;
                  const len = Math.hypot(x2 - x1, y2 - y1);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={greyP > 0.5 ? "#3a4256" : LIME} strokeWidth={u * 0.16} strokeDasharray={len} strokeDashoffset={len * (1 - on)} opacity={0.45} />;
                })}
                {/* orbit path (beat 10) */}
                {t > 56.2 && <ellipse cx={W * 0.40} cy={H * 0.54} rx={W * 0.36} ry={H * 0.40} fill="none" stroke={greyP > 0.5 ? "#2a3145" : "#2f3a2a"} strokeWidth={u * 0.1} strokeDasharray={`${u * 1.2} ${u * 1.0}`} opacity={clamp01((t - 56.2) / 0.6) * 0.7} />}
                {/* HOW / WHAT wires (beats 15-16) */}
                {howP > 0 && (() => { const x1 = W * 0.68, y1 = H * 0.34, x2 = W * 0.725, y2 = H * 0.30; const len = Math.hypot(x2 - x1, y2 - y1);
                  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={greyP > 0.5 ? "#3a4256" : SILVER_MID} strokeWidth={u * (whatP >= 1 ? 0.26 : 0.18)} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - howP)} />; })()}
                {whatP > 0 && (() => { const x1 = W * 0.52, y1 = H * 0.44, x2 = W * 0.645, y2 = H * 0.345; const len = Math.hypot(x2 - x1, y2 - y1);
                  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LIME} strokeWidth={u * 0.26} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - whatP)} opacity={greyP > 0.5 ? 0.3 : 1} />; })()}
                {/* dashboard wire (beat 17) */}
                {dashDockP > 0 && (() => { const x1 = W * 0.55, y1 = H * 0.52, x2 = W * 0.70, y2 = H * 0.52; const len = x2 - x1;
                  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LIME} strokeWidth={u * 0.2} strokeDasharray={len} strokeDashoffset={len * (1 - clamp01((t - 95.2) / 0.5))} opacity={greyP > 0.5 ? 0.3 : 0.8} />; })()}
                {/* heartbeat pulse (beat 19): a ring expanding from the cylinder along everything */}
                {heartbeat > 0 && heartbeat < 1 && <circle cx={W * 0.46} cy={H * 0.52} r={heartbeat * W * 0.42} fill="none" stroke={LIME} strokeWidth={u * 0.24 * (1 - heartbeat)} opacity={1 - heartbeat} />}
              </svg>
              {LISTS.map((L, i) => (
                <ListStack key={L.key} x={L.x} y={L.y} u={u} label={L.key} icons={L.icons} rows={listRows(i)} on={clamp01((t - listOnAt[i]) / 0.45)} grey={greyP > 0.5} />
              ))}
              {/* stream + docking cards (beat 9) */}
              {t > 50.4 && t < 55.2 && (
                <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                  <path d={`M ${-W * 0.02} ${H * 0.92} C ${W * 0.1} ${H * 0.86}, ${W * 0.16} ${H * 0.74}, ${W * 0.2} ${H * 0.62}`} stroke={LIME} strokeWidth={u * 0.24} fill="none" strokeLinecap="round" strokeDasharray={`${u * 1.8} ${u * 1.2}`} strokeDashoffset={-t * u * 5} opacity={clamp01((t - 50.6) / 0.4) * 0.8} />
                </svg>
              )}
              {DOCKS.map((d, i) => {
                const p = clamp01((t - d.at) / 1.2); if (p <= 0 || p >= 1) return null;
                const pe = EASE(p);
                const L = LISTS[d.list];
                const x = lerp(2, L.x, pe), y = lerp(88 - i * 4, L.y, pe);
                return <Card key={i} x={x} y={y} u={u} label={d.card} money={d.m} scale={0.95 - pe * 0.2} opacity={clamp01(p * 5) * (1 - clamp01((p - 0.88) / 0.12))} />;
              })}
              {/* loop rings (beats 10-12) */}
              {RINGS.map((R, i) => (
                <LoopRing key={i} x={R.x} y={R.y} u={u} badge={R.badge} speed={greyP > 0.5 ? 0 : R.speed} t={t} on={clamp01((t - R.at) / 0.4)} grey={greyP > 0.5} flash={FIRES.reduce((m, f) => { const dt = t - f.at; return f.from === i && dt > -0.2 && dt < 0.2 ? 1 : m; }, 0)} />
              ))}
              {/* loop name tags (beat 11) */}
              {[{ n: "payments-loop", icon: "logos/lucide-banknote-lime.svg", x: 8, y: 27, at: 63.6 }, { n: "conversations-loop", icon: "logos/lucide-message-circle-silver.svg", x: 5.5, y: 48, at: 65.8 }, { n: "yt-subs-loop", icon: "logos/youtube.svg", x: 34, y: 91, at: 68.0 }].map((L, i) => (
                <div key={i} style={{ position: "absolute", left: `${L.x}%`, top: `${L.y}%`, transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 0.4, fontFamily: MONO, fontWeight: 600, fontSize: u * 0.85, color: greyP > 0.5 ? "#4a5268" : SILVER_MID, opacity: clamp01((t - L.at) / 0.3), whiteSpace: "nowrap" }}>
                  <Img src={staticFile(L.icon)} style={{ width: u * 0.95, height: u * 0.95, flexShrink: 0 }} />
                  {L.n}
                </div>
              ))}
              {/* fired cards riding to lists */}
              {FIRES.map((f, i) => {
                const p = clamp01((t - f.at) / 0.55); if (p <= 0 || p >= 1) return null;
                const R = RINGS[f.from], L = LISTS[f.to];
                return <Card key={`f${i}`} x={lerp(R.x, L.x, p)} y={lerp(R.y, L.y, p)} u={u} label={f.card} money={f.m} scale={0.72 - p * 0.2} opacity={clamp01(p * 5) * (1 - clamp01((p - 0.85) / 0.15))} />;
              })}
              {/* task input — a new task is TYPED into a REAL Claude chat window (beat 15) */}
              {taskP > 0 && (() => {
                const label = "edit video";
                const typeP = clamp01((t - 81.5) / 1.5);
                const shown = label.slice(0, Math.round(typeP * label.length));
                const caretOn = Math.floor(t * 2) % 2 === 0;
                const flash = t > 87.5 && t < 88.3;
                const dim = greyP > 0.5;
                const accent = dim ? "#4a5268" : LIME;
                return (
                  <div style={{ position: "absolute", left: "66%", top: "39%", transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * taskP})`, opacity: taskP }}>
                    <div style={{ width: u * 21, background: RAISIN_DEEP, border: `${u * 0.1}px solid ${dim ? "#262c3c" : "#2c3446"}`, borderRadius: u * 0.8, overflow: "hidden", boxShadow: flash ? `0 0 ${u * 1.9}px ${LIME}88` : `0 ${u * 0.8}px ${u * 2.2}px rgba(0,0,0,0.55)` }}>
                      {/* window chrome + Claude identity */}
                      <div style={{ display: "flex", alignItems: "center", gap: u * 0.5, padding: `${u * 0.55}px ${u * 0.9}px`, background: "#14171f", borderBottom: `${u * 0.07}px solid #20242f` }}>
                        {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.62, height: u * 0.62, borderRadius: "50%", background: i === 2 ? accent : "#3a4256" }} />)}
                        <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.05, height: u * 1.05, marginLeft: u * 0.4, opacity: dim ? 0.5 : 1 }} />
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.02em", color: dim ? "#4a5268" : SILVER_SOFT }}>claude</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.3, fontFamily: MONO, fontWeight: 800, fontSize: u * 0.66, letterSpacing: "0.1em", color: accent }}>
                          <span style={{ width: u * 0.42, height: u * 0.42, borderRadius: "50%", background: accent }} />NEW TASK
                        </span>
                      </div>
                      {/* body: the prompt line, typed in */}
                      <div style={{ padding: `${u * 0.8}px ${u * 1.0}px` }}>
                        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 0.78, color: dim ? "#4a5268" : SILVER_MID, marginBottom: u * 0.55 }}>What should I do next?</div>
                        <div style={{ display: "flex", alignItems: "center", gap: u * 0.45, background: "#12151d", border: `${u * 0.07}px solid ${dim ? "#262c3c" : "#2c3446"}`, borderRadius: u * 0.45, padding: `${u * 0.5}px ${u * 0.75}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, whiteSpace: "nowrap" }}>
                          <span style={{ color: accent }}>›</span>
                          <span style={{ color: dim ? "#4a5268" : SILVER }}>{shown}</span>
                          <span style={{ width: u * 0.13, height: u * 1.3, background: LIME, opacity: dim ? 0 : (typeP < 1 || caretOn) ? 1 : 0 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* HOW / WHAT labels (beat 16) */}
              {t > 88.4 && <div style={{ position: "absolute", left: "78%", top: "9%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 88.4) / 0.3) }}><div style={{ background: "rgba(14,16,22,0.95)", border: `${u * 0.09}px solid #3a4256`, borderRadius: u * 0.4, padding: `${u * 0.25}px ${u * 0.8}px`, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.6, color: greyP > 0.5 ? "#4a5268" : SILVER }}>HOW</div></div>}
              {t > 90.3 && <div style={{ position: "absolute", left: "52.5%", top: "48%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 90.3) / 0.3) }}><div style={{ background: "rgba(14,16,22,0.95)", border: `${u * 0.09}px solid ${greyP > 0.5 ? "#3a4256" : LIME}`, borderRadius: u * 0.4, padding: `${u * 0.25}px ${u * 0.8}px`, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.6, color: greyP > 0.5 ? "#4a5268" : LIME }}>WHAT</div></div>}
              {/* dashboard (beat 17) */}
              {dashDockP > 0 && (
                <div style={{ position: "absolute", left: "82%", top: "52%", transform: `translate(-50%,-50%) translateY(${(1 - dashDockP) * -u * 3}px)`, opacity: dashDockP }}>
                  <Win u={u} w={19} title="dashboard" accent={greyP < 0.5}>
                    <div style={{ padding: u * 0.8, display: "flex", flexDirection: "column", gap: u * 0.6 }}>
                      <div style={{ display: "flex", gap: u * 0.6 }}>
                        {[{ v: Math.round(interpolate(clamp01((t - 96.0) / 1.2), [0, 1], [11200, 14910])), pre: "€", l: "MRR", icon: "logos/lucide-trending-up-dim.svg" }, { v: Math.round(interpolate(clamp01((t - 96.3) / 1.2), [0, 1], [120, 312])), pre: "", l: "MSGS", icon: "logos/lucide-message-circle-dim.svg" }].map((s, i) => (
                          <div key={i} style={{ flex: 1, background: "#181d2a", borderRadius: u * 0.4, padding: `${u * 0.5}px ${u * 0.6}px` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: u * 0.35, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.7, letterSpacing: "0.1em", color: BODY }}>
                              <Img src={staticFile(s.icon)} style={{ width: u * 1.0, height: u * 1.0, flexShrink: 0 }} />
                              {s.l}
                            </div>
                            <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.25, color: greyP > 0.5 ? "#4a5268" : LIME, fontVariantNumeric: "tabular-nums" }}>{s.pre}{s.v.toLocaleString("en-US")}</div>
                          </div>
                        ))}
                      </div>
                      <svg width={u * 15.5} height={u * 3.6} viewBox="0 0 100 22">
                        <path d={`M2 19 L18 15 L34 16 L50 10 L66 11 L82 5 ${t > 98.4 ? "L96 3" : ""}`} fill="none" stroke={greyP > 0.5 ? "#4a5268" : LIME} strokeWidth={1.8} strokeLinecap="round" strokeDasharray={140} strokeDashoffset={140 * (1 - clamp01((t - 96.0) / 1.4))} />
                      </svg>
                    </div>
                  </Win>
                </div>
              )}
              {/* AI MODEL chip — deliberately the smallest thing on canvas (beat 18) */}
              {modelP > 0 && (
                <div style={{ position: "absolute", left: `${lerp(97, 64, modelP)}%`, top: "52%", transform: "translate(-50%,-50%)", opacity: modelP }}>
                  <div style={{ background: "#12151d", border: `${u * 0.08}px solid ${greyP > 0.5 ? "#3a4256" : SILVER_MID}`, borderRadius: u * 0.35, padding: `${u * 0.3}px ${u * 0.7}px`, display: "flex", alignItems: "center", gap: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, color: greyP > 0.5 ? "#4a5268" : SILVER_MID, whiteSpace: "nowrap" }}>
                    <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.0, height: u * 1.0, flexShrink: 0 }} />
                    AI MODEL
                  </div>
                  {t > 103.4 && t < 104.4 && <div style={{ position: "absolute", inset: -u * 0.5, border: `${u * 0.08}px solid ${SILVER_MID}`, borderRadius: u * 0.5, opacity: 1 - clamp01((t - 103.9) / 0.5) }} />}
                </div>
              )}
              {t > 104.2 && t < 108.6 && <div style={{ position: "absolute", left: "62%", top: "60%", transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.3, color: SILVER_MID, opacity: clamp01((t - 104.2) / 0.4), whiteSpace: "nowrap" }}>the least important part</div>}
            </div>

            {/* file window — stays LIT through the grey-out, then detaches and we ZOOM IN on just the md files (beats 14 + 20) */}
            {fileDockP > 0 && (
              <div style={{ position: "absolute", left: `${lerp(78, 33, fileAwayE)}%`, top: `${lerp(20, 46, fileAwayE)}%`, transform: `translate(-50%,-50%) translateY(${(1 - fileDockP) * -u * 4}px) scale(${lerp(1, 1.7, fileAwayE)})`, opacity: Math.max(fileDockP, 0.99) }}>
                {fileAwayP > 0.5 && <div style={{ position: "absolute", left: "50%", top: "40%", width: u * 30, height: u * 30, transform: "translate(-50%,-50%)", background: `radial-gradient(circle, rgba(233,236,237,0.14) 0%, transparent 62%)`, pointerEvents: "none" }} />}
                {/* clean solid on-brand light panel (no heavy window outline) */}
                <div style={{ position: "relative", width: u * 16, background: WHITE, border: `${u * 0.06}px solid #e2e6e9`, borderRadius: u * 0.7, overflow: "hidden", boxShadow: `0 ${u * 1.0}px ${u * 2.8}px rgba(0,0,0,0.32)` }}>
                  <div style={{ height: u * 2.3, background: "#f3f5f6", borderBottom: `${u * 0.05}px solid #e6eaed`, display: "flex", alignItems: "center", gap: u * 0.5, padding: `0 ${u * 0.9}px` }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.58, height: u * 0.58, borderRadius: "50%", background: "#c3c9cd" }} />)}
                    <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 1.35, height: u * 1.35, marginLeft: u * 0.45, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.88, letterSpacing: "0.02em", color: BODY, whiteSpace: "nowrap" }}>my-second-brain/</span>
                  </div>
                  <div style={{ padding: `${u * 0.35}px 0` }}>
                    {["me.md", "business.md", "priorities.md", "skills/"].map((n, i) => (
                      <div key={i} style={{ height: u * 1.9, display: "flex", alignItems: "center", gap: u * 0.6, padding: `0 ${u * 0.9}px`, background: n === "skills/" && t > 78.2 && t < 80 ? "rgba(15,18,26,0.06)" : "transparent" }}>
                        {n === "skills/"
                          ? <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 1.5, height: u * 1.5, flexShrink: 0 }} />
                          : <Img src={staticFile("logos/markdown-dark.svg")} style={{ width: u * 1.4, height: u * 0.86, flexShrink: 0 }} />}
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, color: RAISIN }}>{n}</span>
                      </div>
                    ))}
                    {/* recipe fan-out (beat 15) — olive ink is the light-worksheet accent (lime is illegal on white) */}
                    {t > 79.0 && t < 88.5 && (
                      <div style={{ padding: `0 ${u * 0.9}px ${u * 0.4}px ${u * 2.2}px`, display: "flex", flexDirection: "column", gap: u * 0.2 }}>
                        {["edit-video.md", "draft-reply.md"].map((n, i) => (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: u * 0.4, fontFamily: MONO, fontWeight: 600, fontSize: u * 0.8, color: "#5f7a00", opacity: clamp01((t - 79.0 - i * 0.25) / 0.3) * 0.9 }}>
                            <Img src={staticFile("logos/markdown-dark.svg")} style={{ width: u * 1.2, height: u * 0.74, flexShrink: 0 }} />
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {fileAwayP >= 1 && (
                  <div style={{ marginTop: u * 0.8, textAlign: "center", whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.2, color: SILVER }}>a <Marker u={u} t={t} at={111.6} base={SILVER}>note</Marker> about a business.</span>
                  </div>
                )}
              </div>
            )}

            {/* travelers on HOW/WHAT wires */}
            {howP > 0 && howP < 1 && <Chip x={lerp(72.5, 68, howP)} y={lerp(30, 34, howP)} u={u} text="steps" grey sc={0.7} />}
            {whatP > 0 && whatP < 1 && <Chip x={lerp(52, 64.5, whatP)} y={lerp(44, 34.5, whatP)} u={u} text="facts" lime sc={0.7} />}

            {/* machine headlines (each on its beat, bottom band which stays clear) */}
            <HL u={u} t={t} at={36.4} out={42.6} center y="90%" size={3.0}><Marker u={u} t={t} at={36.7}>ONE</Marker> DATABASE</HL>
            <HL u={u} t={t} at={53.9} out={56.0} center y="90%" size={2.8}>EVERYTHING HAS A <Marker u={u} t={t} at={54.2}>HOME</Marker></HL>
            {/* the naming (beat 19) */}
            {t > 106.6 && t < 108.9 && (
              <div style={{ position: "absolute", left: "46%", top: "92%", transform: "translate(-50%,-50%)", clipPath: `inset(-8% ${(1 - clamp01((t - 106.8) / 0.5)) * 102 - 1}% -8% -1%)` }}>
                <div style={{ background: LIME, padding: `${u * 0.5}px ${u * 1.5}px`, borderRadius: u * 0.3, transform: "rotate(-1.2deg)" }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4, color: RAISIN, letterSpacing: "-0.02em", whiteSpace: "nowrap", textTransform: "uppercase" }}>A BUSINESS BRAIN</span>
                </div>
              </div>
            )}
            {/* bracket around the whole machine (beat 19) */}
            {t > 106.8 && (() => { const bp = clamp01((t - 106.8) / 0.5) * (1 - greyP * 0.6);
              return (
                <div style={{ position: "absolute", left: "3%", top: "4%", right: "9%", bottom: "13%", opacity: bp, pointerEvents: "none" }}>
                  {[["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].map(([hx, vy], i) => (
                    <div key={i} style={{ position: "absolute", [hx]: 0, [vy]: 0, width: u * 3, height: u * 3, [`border${vy === "top" ? "Top" : "Bottom"}`]: `${u * 0.18}px solid ${LIME}`, [`border${hx === "left" ? "Left" : "Right"}`]: `${u * 0.18}px solid ${LIME}` } as React.CSSProperties} />
                  ))}
                </div>
              ); })()}
          </div>
        )}
      </div>

      {/* ============================ SCRIM + FOOTAGE ============================ */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.55) 0%, transparent 26%, transparent 60%, rgba(8,10,14,0.72) 100%)`, opacity: full, pointerEvents: "none" }} />
      <FootageLayer sk={sk} u={u} src="footage/act3.mp4" />

      {/* B4 (18.2–24.5): the receipt — three facts slam in complete */}
        {t >= 18.2 && t < 24.8 && (() => { const on = clamp01((t - 18.4) / 0.3) * (1 - clamp01((t - 24.4) / 0.3));
          const ROWS = [
            { at: 19.0, icon: "logos/lucide-percent-lime.svg", label: "MARGIN / PRODUCT", val: "€31 · €58 · €124", graph: "bars" },
            { at: 21.2, icon: "logos/lucide-message-circle-lime.svg", label: "TOP COMPLAINT", val: "“slow email replies”", graph: "quote" },
            { at: 23.3, icon: "logos/lucide-clock-4-lime.svg", label: "TIME SINK", val: "EMAIL — 11 H/WK", graph: "bar" },
          ];
          return (
            <div style={{ opacity: on }}>
              {/* a real Claude session, skinned to our raisin/silver/lime brand */}
              <div style={{ position: "absolute", left: "30%", top: "50%", transform: "translate(-50%,-50%)", width: u * 42 }}>
                <div style={{ background: RAISIN_DEEP, border: `${u * 0.1}px solid #262c3c`, borderRadius: u * 1.1, overflow: "hidden", boxShadow: `0 ${u * 1.4}px ${u * 3.6}px rgba(0,0,0,0.6)` }}>
                  {/* window chrome + Claude identity */}
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, padding: `${u * 0.75}px ${u * 1.2}px`, borderBottom: `${u * 0.08}px solid #20263400`, background: "#14171f" }}>
                    <div style={{ width: u * 2.3, height: u * 2.3, borderRadius: "50%", background: "rgba(207,255,5,0.10)", border: `${u * 0.08}px solid ${LIME}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.4, height: u * 1.4 }} />
                    </div>
                    <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 1.15, color: SILVER, letterSpacing: "-0.01em" }}>Claude</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.72, letterSpacing: "0.1em", color: SILVER_MID, marginTop: u * 0.15 }}>· business brain</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.35, fontFamily: MONO, fontWeight: 800, fontSize: u * 0.82, letterSpacing: "0.06em", color: LIME, opacity: clamp01((t - 19.0) / 0.4) }}>
                      <span style={{ width: u * 0.6, height: u * 0.6, borderRadius: "50%", background: LIME }} />ANSWERED
                    </span>
                  </div>
                  <div style={{ padding: `${u * 1.0}px ${u * 1.3}px ${u * 1.2}px` }}>
                    {/* the user's question, as a chat bubble */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: u * 0.9 }}>
                      <div style={{ background: "#1c2230", border: `${u * 0.07}px solid #2c3446`, borderRadius: `${u * 0.7}px ${u * 0.7}px ${u * 0.2}px ${u * 0.7}px`, padding: `${u * 0.5}px ${u * 0.95}px`, fontFamily: SANS, fontWeight: 600, fontSize: u * 1.0, color: SILVER_SOFT }}>What should I focus on?</div>
                    </div>
                    {/* Claude's reply */}
                    <div style={{ display: "flex", gap: u * 0.8, alignItems: "flex-start" }}>
                      <div style={{ width: u * 1.9, height: u * 1.9, borderRadius: "50%", background: "rgba(207,255,5,0.10)", border: `${u * 0.07}px solid ${LIME}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: u * 0.2 }}>
                        <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.15, height: u * 1.15 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.0, color: SILVER_SOFT, marginBottom: u * 0.7, opacity: clamp01((t - 18.6) / 0.4) }}>Here's what's actually costing you:</div>
                        {ROWS.map((r, i) => {
                          const p = clamp01((t - r.at) / 0.25);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 0.85, padding: `${u * 0.6}px ${u * 0.9}px`, marginBottom: i < 2 ? u * 0.55 : 0, background: "#161b26", border: `${u * 0.07}px solid #232a3a`, borderLeft: `${u * 0.28}px solid ${LIME}`, borderRadius: u * 0.5, opacity: p, transform: `translateY(${(1 - p) * u * 0.8}px)` }}>
                              <Img src={staticFile(r.icon)} style={{ width: u * 1.15, height: u * 1.15, flexShrink: 0 }} />
                              <div style={{ width: u * 8.6, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, letterSpacing: "0.07em", color: SILVER_MID, flexShrink: 0 }}>{r.label}</div>
                              <div style={{ flex: 1, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, color: SILVER, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.val}</div>
                              {r.graph === "bars" && (
                                <div style={{ display: "flex", alignItems: "flex-end", gap: u * 0.25, height: u * 2.0, flexShrink: 0 }}>
                                  {[0.35, 0.6, 1].map((h, j) => <div key={j} style={{ width: u * 0.75, height: `${h * 100}%`, background: j === 2 ? LIME : "#2c3446", borderRadius: `${u * 0.15}px ${u * 0.15}px 0 0` }} />)}
                                </div>
                              )}
                              {r.graph === "bar" && <div style={{ width: u * 4.0, height: u * 0.95, background: "#2c3446", borderRadius: u * 0.2, overflow: "hidden", flexShrink: 0 }}><div style={{ width: "78%", height: "100%", background: LIME, opacity: 0.9 }} /></div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ); })()}


      {/* ============================ OVERLAYS ON FOOTAGE ============================ */}
      {/* B1 (0–4.4): THE MACHINE → THE ANSWER, causation as a pulse */}
      {t < 4.7 && (() => { const out = 1 - clamp01((t - 4.3) / 0.35);
        const wireP = clamp01((t - 3.4) / 0.5);
        const pulseP = clamp01((t - 3.8) / 0.5);
        const arrived = pulseP > 0.85;
        const mIn = clamp01((t - 2.9) / 0.3);
        const aIn = clamp01((t - 1.9) / 0.3);
        // cause → effect, spelled out: the SYSTEM (database) produces THE ANSWER.
        return (
          <div style={{ opacity: out }}>
            {/* left: the machine, marked with the real database it runs on */}
            <div style={{ position: "absolute", left: "29%", top: "78%", transform: `translate(-50%,-50%) scale(${1.1 + 0.06 * mIn})`, opacity: mIn }}>
              <div style={{ background: RAISIN, border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.6, padding: `${u * 0.55}px ${u * 1.05}px`, display: "flex", alignItems: "center", gap: u * 0.55, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: SILVER, whiteSpace: "nowrap", boxShadow: `0 0 ${u * 1.2}px ${LIME}44` }}>
                <Img src={staticFile("logos/lucide-database-lime.svg")} style={{ width: u * 1.35, height: u * 1.35, flexShrink: 0 }} />
                THE MACHINE
              </div>
            </div>
            {/* right: the answer — lands lit the instant the pulse arrives */}
            <div style={{ position: "absolute", left: "64%", top: "78%", transform: `translate(-50%,-50%) scale(${1.1 + (arrived ? 0.08 : 0)})`, opacity: aIn }}>
              <div style={{ background: arrived ? LIME : RAISIN, border: `${u * 0.12}px solid ${arrived ? LIME : SILVER_MID}`, borderRadius: u * 0.6, padding: `${u * 0.55}px ${u * 1.05}px`, display: "flex", alignItems: "center", gap: u * 0.5, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.15, letterSpacing: "0.06em", color: arrived ? RAISIN : SILVER_MID, whiteSpace: "nowrap", boxShadow: arrived ? `0 0 ${u * 1.6}px ${LIME}88` : "none" }}>
                THE ANSWER
                {arrived && <span style={{ fontWeight: 800 }}>✓</span>}
              </div>
            </div>
            {/* directed arrow with a caption so the causation is explicit */}
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <line x1={W * 0.375} y1={H * 0.78} x2={W * 0.55} y2={H * 0.78} stroke={LIME} strokeWidth={u * 0.2} strokeLinecap="round" strokeDasharray={W * 0.175} strokeDashoffset={W * 0.175 * (1 - wireP)} opacity={0.9} />
              {wireP > 0.9 && <polygon points={`${W * 0.55},${H * 0.78} ${W * 0.55 - u * 1.3},${H * 0.78 - u * 0.8} ${W * 0.55 - u * 1.3},${H * 0.78 + u * 0.8}`} fill={LIME} />}
              {pulseP > 0 && pulseP < 1 && <circle cx={W * (0.375 + 0.175 * pulseP)} cy={H * 0.78} r={u * 0.55} fill={LIME} style={{ filter: `drop-shadow(0 0 ${u * 0.8}px ${LIME})` }} />}
            </svg>
            <div style={{ position: "absolute", left: "46.5%", top: "74.2%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.18em", color: SILVER_MID, opacity: clamp01((t - 3.6) / 0.4), whiteSpace: "nowrap" }}>PRODUCES</div>
          </div>
        ); })()}

      {/* B2 (4.4–13.5): like/subscribe, human; LIVE heartbeat */}
      {t >= 4.7 && t < 13.4 && (() => { const on = clamp01((t - 5.4) / 0.4);
        const chipsOut = 1 - clamp01((t - 12.4) / 0.5);
        return (
          <div style={{ opacity: on }}>
            {/* the REAL subscribe moment: branded channel card, cursor clicks Subscribe → Subscribed */}
            {t > 6.2 && t < 12.4 && (() => { const inP = clamp01((t - 6.2) / 0.45); const outP = clamp01((t - 11.6) / 0.5);
              return (
                <div style={{ position: "absolute", left: "76%", top: "36%", transform: `translate(-50%,-50%) translateX(${(1 - inP) * u * 14 + outP * u * 14}px)`, opacity: inP * (1 - outP) }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.9, transform: `translate(${u * 0.6}px,${u * 0.6}px)`, opacity: 0.9 }} />
                    <div style={{ position: "relative", width: u * 28, borderRadius: u * 0.9, overflow: "hidden", border: `${u * 0.14}px solid ${SILVER}`, boxShadow: `0 ${u}px ${u * 2.6}px rgba(0,0,0,0.55)` }}>
                      <Sequence from={Math.round(6.4 * 30)} layout="none">
                        <OffthreadVideo src={staticFile("assets/subscribe-bug-21k.mp4")} muted style={{ width: "100%", display: "block" }} />
                      </Sequence>
                    </div>
                  </div>
                </div>
              ); })()}
            {t > 9.8 && (
              <div style={{ position: "absolute", left: "11%", top: "88%", display: "inline-flex", alignItems: "center", gap: u * 0.7, opacity: clamp01((t - 9.8) / 0.4) }}>
                <span style={{ width: u * 0.8, height: u * 0.8, borderRadius: "50%", background: LIME, opacity: 0.5 + 0.5 * Math.abs(Math.sin((t - 9.8) * 2.6)) }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.14em", color: SILVER_SOFT }}>REAL BUSINESSES · LIVE</span>
              </div>
            )}
          </div>
        ); })()}

      {/* B6 (30.8–35.4): parts fly in and SNAP together — the machine is being assembled */}
      {t >= 31.1 && t < 35.5 && (() => { const on = clamp01((t - 32.7) / 0.4) * (1 - clamp01((t - 35.1) / 0.35));
        // five blocks slide in from staggered offsets and lock into a row, wired by a lime line
        const BLOCKS = [
          { dx: -12, dy: -7, lime: false }, { dx: 10, dy: -6, lime: false },
          { dx: -9, dy: 8, lime: true }, { dx: 13, dy: 7, lime: false }, { dx: 6, dy: -9, lime: false },
        ];
        const wireP = EASE(clamp01((t - 33.9) / 0.5));
        return (
          <div style={{ position: "absolute", left: "50%", top: "79%", transform: "translate(-50%,-50%)", opacity: on }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: u * 0.9, height: u * 4.2 }}>
              {/* connecting rail draws through the blocks as they lock */}
              <svg width={u * 24} height={u * 1.2} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
                <line x1={u * 1.5} y1={u * 0.6} x2={u * 22.5} y2={u * 0.6} stroke={LIME} strokeWidth={u * 0.16} strokeLinecap="round" strokeDasharray={u * 21} strokeDashoffset={u * 21 * (1 - wireP)} opacity={0.7} />
              </svg>
              {BLOCKS.map((b, i) => { const bp = EASE(clamp01((t - (33.0 + i * 0.13)) / 0.32));
                return (
                  <div key={i} style={{ position: "relative", width: u * 3.4, height: u * 3.4, borderRadius: u * 0.5, background: "#12151d", border: `${u * 0.13}px solid ${b.lime ? LIME : SILVER_MID}`, boxShadow: b.lime ? `0 0 ${u * 1.2}px ${LIME}66` : "none", transform: `translate(${(1 - bp) * u * b.dx}px, ${(1 - bp) * u * b.dy}px) scale(${0.6 + 0.4 * bp})`, opacity: bp, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: u * 1.0, height: u * 1.0, borderRadius: u * 0.2, background: b.lime ? LIME : SILVER_MID, opacity: b.lime ? 1 : 0.55 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: u * 0.9, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.18em", color: SILVER, opacity: clamp01((t - 33.6) / 0.4) }}>HOW IT'S BUILT</div>
          </div>
        ); })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />

      {/* ============================ FLASHBACK (17.6s "back to the start") ============================ */}
      {/* the moment Luuk first asked the question, replayed as a desaturated, grainy REC memory */}
      {t >= 13.5 && t < 18.0 && (() => {
        const fbP = clamp01((t - 13.5) / 0.3) * (1 - clamp01((t - 17.4) / 0.55));
        const el = Math.max(0, t - 13.5);
        const ss = String(Math.floor(el) % 60).padStart(2, "0");
        const ff = String(Math.floor((el * 24) % 24)).padStart(2, "0");
        const tc = `00:00:${ss}:${ff}`;
        const recOn = Math.floor(t * 1.6) % 2 === 0;
        const caretOn = Math.floor(t * 2) % 2 === 0;
        return (
          <AbsoluteFill style={{ opacity: fbP, zIndex: 60 }}>
            <AbsoluteFill style={{ background: "#04050a" }} />
            {/* the footage — desaturated, low-contrast, slightly slowed and pushed in */}
            <AbsoluteFill style={{ filter: "saturate(0.2) contrast(0.92) brightness(0.82) sepia(0.16)", transform: `scale(${1.07 - fbP * 0.03})` }}>
              <OffthreadVideo src={staticFile("intros/businessbrain/side_lut.mp4")} startFrom={0} playbackRate={0.8} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </AbsoluteFill>
            {/* heavier film grain for the memory */}
            <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 7}px`, mixBlendMode: "overlay", opacity: 0.18, pointerEvents: "none" }} />
            {/* deep vignette */}
            <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 28}px rgba(0,0,0,0.9)`, pointerEvents: "none" }} />
            {/* a faint scanline sweep */}
            <div style={{ position: "absolute", left: 0, right: 0, top: `${((el * 40) % 120) - 10}%`, height: u * 4, background: `linear-gradient(180deg, transparent, rgba(255,255,255,0.05), transparent)`, pointerEvents: "none" }} />
            {/* REC ● + timecode */}
            <div style={{ position: "absolute", left: "5.5%", top: "8%", display: "flex", alignItems: "center", gap: u * 0.7 }}>
              <span style={{ width: u * 1.0, height: u * 1.0, borderRadius: "50%", background: "#ff3b30", opacity: recOn ? 1 : 0.25, boxShadow: recOn ? `0 0 ${u * 0.8}px #ff3b30` : "none" }} />
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.4, letterSpacing: "0.16em", color: SILVER }}>REC</span>
            </div>
            <div style={{ position: "absolute", right: "5.5%", top: "8%", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.4, letterSpacing: "0.1em", color: SILVER, fontVariantNumeric: "tabular-nums" }}>{tc}</div>
            {/* THE QUESTION — the single line the viewer must read: what Luuk first asked, typed back at him */}
            <div style={{ position: "absolute", left: "50%", bottom: "16%", transform: "translateX(-50%)", textAlign: "center", zIndex: 2 }}>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.92, letterSpacing: "0.3em", color: LIME, textTransform: "uppercase", marginBottom: u * 0.7 }}>you asked</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: u * 0.55, background: "rgba(6,8,14,0.74)", border: `${u * 0.08}px solid rgba(231,233,238,0.30)`, borderRadius: u * 0.65, padding: `${u * 0.8}px ${u * 1.4}px`, boxShadow: `0 ${u * 0.6}px ${u * 1.8}px rgba(0,0,0,0.55)` }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, letterSpacing: "0.01em", color: WHITE, whiteSpace: "nowrap" }}>What should I focus on — and how do I 10× my revenue?</span>
                <span style={{ width: u * 0.16, height: u * 1.7, background: SILVER, opacity: caretOn ? 1 : 0.12 }} />
              </div>
            </div>
            {/* caption (kept subtle and dropped to the very bottom so it never crowds the question) */}
            <div style={{ position: "absolute", left: "50%", bottom: "5.5%", transform: "translateX(-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.22em", color: SILVER_MID, whiteSpace: "nowrap" }}>◄◄ BACK TO THE START</div>
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
};

/* local cylinder (drawn, rows, flash). `grow` (0..1) makes the tank physically taller as it fills — it extends UPWARD so the counter below never collides. */
const Cyl3: React.FC<{ u: number; W: number; H: number; x: number; y: number; s: number; rows: number; flash?: boolean; grey?: boolean; opacity?: number; grow?: number }> = ({ u, W, H, x, y, s, rows, flash, grey, opacity = 1, grow = 0 }) => {
  const col = grey ? "#3a4256" : LIME;
  const S = u * s;
  const top = -(13 + grow * 11);   // body top rises as rows accumulate
  const nRows = Math.min(9, rows);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}>
      <g transform={`translate(${x / 100 * W} ${y / 100 * H}) scale(${S})`}>
        <g fill="none" stroke={col} strokeWidth={0.5} strokeLinecap="round">
          <path d={`M-11 ${top} a11 4 0 1 0 22 0 a11 4 0 1 0 -22 0`} />
          <path d={`M-11 ${top} L-11 13 M11 ${top} L11 13 M-11 13 a11 4 0 0 0 22 0`} />
        </g>
        {Array.from({ length: nRows }).map((_, i) => (
          <rect key={i} x={-8.5} y={9.5 - i * 2.9} width={17} height={1.9} rx={0.5} fill={col} opacity={0.16 + (flash && i === nRows - 1 ? 0.45 : 0)} />
        ))}
      </g>
    </svg>
  );
};

export default Act3;
