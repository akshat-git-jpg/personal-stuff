/**
 * Act1 — "THE PROBLEM" (narration 18.7–141.8s → local 0–123.1s). Dark register, three footage modes.
 * Hook → "not prompts/model" → two things → business is change → the folder everyone builds →
 * "second brain" → 1 weekend → the turn → numbers move → THE STREAM → photo vs movie → the aside →
 * who types it in → forever? → the DATABASE that holds it → why ignore it → your files are frozen.
 * Footage plays from 0 (same take → lip sync). Voice only; SFX + music mixed in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  f, clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, STEEL, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Card, Marker, FileGraphic, PhotoCard, Filmstrip, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";
import { FolderOfFiles, DatabaseHolds, NumbersMove, StatBig, Win } from "./bb2/concepts";

const FPS = 30;

/* headline helper */
const H1: React.FC<{ u: number; t: number; children: React.ReactNode; top?: string; left?: string; center?: boolean; size?: number; in0: number; out?: number }> = ({ u, t, children, top = "16%", left = "6%", center, size = 3.6, in0, out }) => (
  <div style={{ position: "absolute", left: center ? "50%" : left, top, transform: center ? "translate(-50%,-50%)" : "none", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", textAlign: center ? "center" : "left", opacity: clamp01((t - in0) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

/* mono chip */
const Chip: React.FC<{ x: number; y: number; u: number; text: string; lime?: boolean; grey?: boolean; o?: number; sc?: number }> = ({ x, y, u, text, lime, grey, o = 1, sc = 1 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${sc})`, opacity: o }}>
    <div style={{ background: grey ? "#1a1f2b" : RAISIN, border: `${u * 0.1}px solid ${grey ? "#3a4256" : lime ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: grey ? SILVER_MID : lime ? LIME : SILVER, whiteSpace: "nowrap" }}>{text}</div>
  </div>
);

export const Act1: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  /* Panel choreography law: the panel changes position/size ONLY in the short gap AT a beat
     boundary, then holds perfectly still for the whole beat. Beat graphics fade in AFTER the
     transition completes. Beats 1 and 13 are full-screen footage for their ENTIRE duration. */
  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },        // beat 1: FULL, holds
    { t: 7.7, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 8.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 2: FULL footage + side graphics
    { t: 13.9, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 14.6, x: 82, y: 68, s: 0.5, dim: 0.15, fr: 1 }, // beat 3: corner, static
    { t: 17.9, x: 82, y: 68, s: 0.5, dim: 0.15, fr: 1 },
    { t: 18.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },      // beats 4–8: hidden (full graphics)
    { t: 48.9, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 49.6, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },// beat 9: panel right, static
    { t: 55.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 55.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },      // beat 10: hidden
    { t: 66.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 67.2, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },// beat 11: panel right, STATIC all beat
    { t: 77.1, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 77.8, x: 86, y: 71, s: 0.44, dim: 0.3, fr: 1 }, // beat 12: corner, static
    { t: 81.3, x: 86, y: 71, s: 0.44, dim: 0.3, fr: 1 },
    { t: 82.3, x: 50, y: 50, s: 1, dim: 0, fr: 0 },      // beat 13: FULL, holds whole beat
    { t: 88.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 89.3, x: 77, y: 52, s: 0.92, dim: 0.06, fr: 1 },// beat 14: panel far-right, static (clears left for the stream→business.md)
    { t: 97.9, x: 77, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 98.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },      // beats 15–16: hidden
    { t: 112.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 113.4, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },// beat 17: panel right, STATIC
    { t: 116.6, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 117.3, x: 50, y: 50, s: 1, dim: 1, fr: 1 },     // beat 18: hidden
    { t: 123.1, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);
  // LIGHT register windows (the paper/file world): folder+stamp, the weekend build, photo-vs-movie
  const liteWins: [number, number][] = [[27.6, 49.2], [77.9, 81.4]];
  const lite = Math.max(...liteWins.map(([a, b]) => clamp01((t - a) / 0.5) * (1 - clamp01((t - b) / 0.5))), 0);
  const ink = lite > 0.5 ? RAISIN : SILVER;        // primary text on current bg
  const inkSoft = lite > 0.5 ? BODY : SILVER_SOFT; // secondary

  /* ---- beat 11: stream (local st) — riders, divers, and debris use DISJOINT label sets so the
     same text can never appear twice on screen (the "ghost duplicate" bug) ---- */
  const st = t - 67;
  const streamOn = clamp01((st - 0.3) / 0.8) * (1 - clamp01((st - 9.6) / 0.7));
  const sRiders: { born: number; label: string; money: boolean }[] = [];
  const SLAB = ["new order #4471", "payout €3,900", "DM: still there?", "+3 subscribers", "5★ review", "€1,240 paid"];
  const SLAB_DIVE = ["refund request", "invoice sent", "new lead", "€480 paid"];
  const SLAB_DEBRIS = ["order #4472", "€96 paid", "DM: hello?", "1★ review", "+1 subscriber", "chargeback"];
  for (let i = 0; i < 12; i++) { const born = 0.6 + i * 1.15; if (born > st || born > 8.0) break; sRiders.push({ born, label: SLAB[i % SLAB.length], money: i % 3 !== 1 }); }
  const sX = (p: number) => -6 + p * 60, sY = (p: number) => 74 - p * 8 + Math.sin(p * 7) * 2;
  const sClear = 1 - clamp01((st - 9.6) / 0.6);
  const sImpacts = [4.0, 4.8, 5.6, 6.4];
  let sSquash = 0; for (const it of sImpacts) { const dt = st - it; if (dt > 0 && dt < 0.3) sSquash = Math.max(sSquash, Math.sin((1 - dt / 0.3) * Math.PI) * 0.1); }
  const sBurst = clamp01((st - 7.1) / 0.5); const sFrozen = st > 7.1;
  const sShake = st > 7.1 && st < 7.6 ? Math.sin((st - 7.1) * 60) * (1 - (st - 7.1) / 0.5) * u * 0.6 : 0;
  const sDebris = Array.from({ length: 6 }, (_, i) => ({ ang: (i / 6) * Math.PI * 2 + 0.5, spd: 26 + (i % 3) * 9, rot: (i % 2 ? 1 : -1) * (55 + i * 10) }));

  /* ---- beat 14: who types it (local wt) ---- */
  const wt = t - 88.5;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("intros/businessbrain/act1_voice.m4a")} />
      <DarkBg u={u} gridOpacity={sk.fr} />
      <LightBg u={u} opacity={lite} />

      {/* ============ GRAPHICS WORLD ============ */}
      <div style={{ position: "absolute", inset: 0, opacity: graphicsOn, transform: `translate(${sShake}px,${sShake * 0.5}px)` }}>

        {/* BEAT 3 — not prompts / not a model → JUST NEVER (14.5–17.9)
            Two "attempted fixes" stack vertically, each struck through as it's dismissed;
            then JUST NEVER lands. Column stays left of the corner footage panel. */}
        {t >= 14.2 && t < 18.4 && (() => { const l = t - 14.4; const on = clamp01(l / 0.4) * (1 - clamp01((l - 3.5) / 0.4));
          // strikes land ON the spoken phrase: "more prompts" ~14.9s, "a better model" ~15.9s
          const rows: { lab: string; icon: React.ReactNode; at: number; strike: number }[] = [
            { lab: "MORE PROMPTS", icon: ">_", at: 0.1, strike: 0.5 },
            { lab: "A BETTER MODEL", icon: <Img src={staticFile("logos/chatgpt.svg")} style={{ width: u * 1.4, height: u * 1.4 }} />, at: 0.7, strike: 1.5 },
          ];
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <div style={{ position: "absolute", left: "44%", top: "42%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", gap: u * 2.2, alignItems: "stretch" }}>
                {rows.map((r, i) => {
                  const ro = clamp01((l - r.at) / 0.35);
                  const cr = clamp01((l - r.strike) / 0.3);
                  return (
                    <div key={i} style={{ position: "relative", opacity: ro, transform: `translateY(${(1 - ro) * u * 1.2}px)` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: u * 1.4, background: "#12151d", border: `${u * 0.12}px solid #2a3145`, borderRadius: u * 0.8, padding: `${u * 1.3}px ${u * 2.2}px`, boxShadow: `0 ${u * 1}px ${u * 2.6}px rgba(0,0,0,0.5)`, filter: `grayscale(${cr}) brightness(${1 - cr * 0.45})` }}>
                        <span style={{ width: u * 3.4, height: u * 3.4, borderRadius: u * 0.5, background: "#1c2233", border: `${u * 0.1}px solid #333c54`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, color: SILVER_SOFT, flexShrink: 0 }}>{r.icon}</span>
                        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.5, color: SILVER, textTransform: "uppercase", whiteSpace: "nowrap" }}>{r.lab}</span>
                      </div>
                      {/* clean strike: ONE line drawn fully INSIDE the card, crossing every letter */}
                      <div style={{ position: "absolute", left: u * 1.6, right: u * 1.6, top: "50%", height: u * 0.4, background: LIME, borderRadius: u * 0.2, transform: `translateY(-50%) scaleX(${cr}) rotate(-1.0deg)`, transformOrigin: "left center", boxShadow: `0 0 ${u * 0.7}px ${LIME}77` }} />
                    </div>
                  );
                })}
              </div>
              {/* the verdict — biggest element of the beat, upright brand caps */}
              <div style={{ position: "absolute", left: "44%", top: "71%", transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * clamp01((l - 2.2) / 0.3)})`, opacity: clamp01((l - 2.2) / 0.35), whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 5.6, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase" }}>JUST <span style={{ color: LIME }}>NEVER.</span></span>
              </div>
            </div>
          ); })()}

        {/* BEAT 4 — two things first (18.6–23.0): two substantial numbered cards, content veiled */}
        {t >= 18.6 && t < 23.4 && (() => { const l = t - 18.8; const on = clamp01(l / 0.4) * (1 - clamp01((l - 3.9) / 0.4));
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "20%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.2em", color: SILVER_MID }}>BEFORE WE START</span>
              </div>
              <div style={{ position: "absolute", left: "50%", top: "29%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, color: SILVER, textTransform: "uppercase" }}>TWO THINGS TO UNDERSTAND</div>
              {[
                { n: "1", hint: "what a business actually is" },
                { n: "2", hint: "what your files actually do" },
              ].map((c, i) => {
                const o = clamp01((l - 0.7 - i * 0.5) / 0.4);
                const pop = interpolate(o, [0, 1], [0.86, 1], { easing: EASE_OVER });
                return (
                  <div key={i} style={{ position: "absolute", left: `${35 + i * 30}%`, top: "56%", transform: `translate(-50%,-50%) translateY(${(1 - o) * u * 1.5}px) scale(${pop})`, opacity: o }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.3 }}>
                      {/* one big lime number badge — reads once, no redundant label */}
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 1.3, transform: `translate(${u * 0.55}px,${u * 0.55}px)`, opacity: 0.4 }} />
                        <div style={{ position: "relative", width: u * 7.4, height: u * 7.4, borderRadius: u * 1.3, background: LIME, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 4.8, color: RAISIN, lineHeight: 1 }}>{c.n}</div>
                      </div>
                      <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.75, color: SILVER, whiteSpace: "nowrap" }}>{c.hint}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ); })()}

        {/* BEAT 5 — business isn't information, it's change (23.0–27.8):
            LEFT a static document that dims on "not"; RIGHT a conveyor of timestamped events
            that never stops. Still vs flowing IS the sentence. */}
        {t >= 23.0 && t < 28.2 && (() => { const l = t - 23.2; const on = clamp01(l / 0.4) * (1 - clamp01((l - 4.4) / 0.4));
          const dimDoc = clamp01((t - 24.3) / 0.5);
          const flowOn = clamp01((t - 25.0) / 0.5);
          const EV = ["ORDER PLACED 14:02", "CLIENT SIGNED 14:07", "REFUND ISSUED 14:11", "INVOICE SENT 14:18", "DM RECEIVED 14:22", "PAYOUT SENT 14:29"];
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "12%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.0, color: SILVER, textTransform: "uppercase", opacity: clamp01(l / 0.4) }}>YOUR BUSINESS ISN'T INFORMATION. IT'S <Marker u={u} t={t} at={25.4}>CHANGE.</Marker></div>
              {/* LEFT: the still document */}
              <div style={{ position: "absolute", left: "28%", top: "50%", transform: "translate(-50%,-50%)", filter: `saturate(${1 - dimDoc * 0.8}) brightness(${1 - dimDoc * 0.45})`, opacity: 1 - dimDoc * 0.25 }}>
                <svg width={u * 14} height={u * 17} viewBox="0 0 28 34">
                  <path d="M2 2 h16 l8 8 v22 h-24 z" fill="#12151d" stroke={SILVER_MID} strokeWidth={1.1} strokeLinejoin="round" />
                  <path d="M18 2 v8 h8" fill="none" stroke={SILVER_MID} strokeWidth={1.1} />
                  <path d="M6 15 h14 M6 19 h14 M6 23 h10 M6 27 h13" stroke="#39415a" strokeWidth={1.0} />
                  {/* markdown mark badge on the lower doc body */}
                  <g transform="translate(9.5 21.5) scale(0.0433)">
                    <rect x={-30} y={-22} width={268} height={172} fill="#12151d" />
                    <path d="M193 128H15a15 15 0 0 1-15-15V15A15 15 0 0 1 15 0h178a15 15 0 0 1 15 15v98a15 15 0 0 1-15 15zM50 98V59l20 25 20-25v39h20V30H90L70 55 50 30H30v68zm134-34h-20V30h-20v34h-20l30 35z" fill="#c3c9cd" />
                  </g>
                </svg>
              </div>
              <div style={{ position: "absolute", left: "28%", top: "70%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.16em", color: SILVER_MID, opacity: clamp01((l - 0.3) / 0.4) }}>INFORMATION</div>
              {/* RIGHT: the conveyor of events, flowing down forever */}
              {flowOn > 0 && (
                <div style={{ position: "absolute", left: "68%", top: "44%", transform: "translate(-50%,-50%)", width: u * 22, height: u * 24, overflow: "hidden", opacity: flowOn, maskImage: "linear-gradient(180deg, transparent 0%, #000 12%, #000 85%, transparent 100%)", WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 12%, #000 85%, transparent 100%)" }}>
                  {EV.map((e, i) => {
                    const period = EV.length * 3.4;
                    // EVEN spacing (period/N) so tags can never bunch up / overlap on wrap-around
                    const y = (((t * 5.6 + i * (period / EV.length)) % period) / period) * 130 - 15;
                    const fresh = y < 12;
                    return (
                      <div key={i} style={{ position: "absolute", left: "50%", top: `${y}%`, transform: "translate(-50%,-50%)" }}>
                        <div style={{ display: "flex", alignItems: "center", background: "#252b3a", border: `${u * 0.09}px solid #3f4760`, borderLeft: `${u * 0.35}px solid ${fresh ? LIME : "#4a5268"}`, borderRadius: u * 0.4, padding: `${u * 0.5}px ${u * 1.05}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: SILVER, whiteSpace: "nowrap" }}>{e}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ position: "absolute", left: "68%", top: "70%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.16em", color: LIME, opacity: clamp01((t - 25.6) / 0.4) }}>CHANGE</div>
            </div>
          ); })()}

        {/* BEAT 6+7 — THE MASS (behind the hero): everyone is building the SAME second-brain folder.
            A dim grid of identical little folder-windows tiles the whole frame and populates in on
            "here's what everyone is building" (~33s), then fades out before the SECOND BRAIN stamp. */}
        {t >= 32.0 && t < 41.0 && (() => {
          const wrap = clamp01((t - 32.2) / 0.5) * (1 - clamp01((t - 39.9) / 0.5));
          const cols = 8, rows = 4;
          const cells: { x: number; y: number; i: number }[] = [];
          let idx = 0;
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const x = 8 + c * (84 / (cols - 1));
            const y = 16 + r * (58 / (rows - 1));
            // keep a clean central pocket so the hero folder (drawn on top) stays the focal point
            cells.push({ x, y, i: idx++ });
          }
          return (
            <div style={{ position: "absolute", inset: 0, opacity: wrap }}>
              {cells.map(({ x, y, i }) => {
                const o = clamp01((t - 32.3 - i * 0.025) / 0.35);
                if (o <= 0) return null;
                const bob = Math.sin((t - 32.3 + i * 0.7) * 2.1) * u * 0.16;
                return (
                  <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) translateY(${(1 - o) * u * 1.2 + bob}px) scale(${0.9 + 0.1 * o})`, opacity: o, display: "flex", alignItems: "flex-end", gap: u * 0.5 }}>
                    {/* a person — head + shoulders silhouette, strong silver on the dark bg */}
                    <svg width={u * 3.4} height={u * 3.7} viewBox="0 0 24 26">
                      <circle cx={12} cy={6.4} r={4.9} fill="#231c2e" />
                      <path d="M2.6 26 v-2.4 a9.4 9.4 0 0 1 18.8 0 v2.4 z" fill="#231c2e" />
                    </svg>
                    {/* the little .md each of them is building */}
                    <svg width={u * 1.85} height={u * 2.35} viewBox="0 0 20 25" style={{ marginBottom: u * 0.15 }}>
                      <path d="M2 1 h11 l5 5 v17 a1 1 0 0 1 -1 1 h-14 a1 1 0 0 1 -1 -1 z" fill="#12151d" stroke={LIME} strokeWidth={1.4} strokeLinejoin="round" />
                      <path d="M13 1 v5 h5" fill="none" stroke={LIME} strokeWidth={1.4} strokeLinejoin="round" />
                      <text x={9.5} y={18.5} textAnchor="middle" fontFamily="monospace" fontWeight={700} fontSize={7} fill={LIME}>md</text>
                    </svg>
                  </div>
                );
              })}
              {/* lime PLATE + dark ink — readable on the white worksheet (lime text on white was invisible) */}
              <div style={{ position: "absolute", left: "50%", top: "90%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", opacity: clamp01((t - 32.8) / 0.4), background: LIME, borderRadius: u * 0.4, padding: `${u * 0.5}px ${u * 1.3}px`, boxShadow: `${u * 0.45}px ${u * 0.45}px 0 rgba(20,16,24,0.9)` }}>
                <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.35, letterSpacing: "0.16em", color: "#141018" }}>EVERYONE'S BUILDING THE SAME ONE</span>
              </div>
            </div>
          );
        })()}

        {/* BEATS 6+7 — the folder of files (27.8–40.5) STAYS on screen, then the gurus' stamp
            slams ONTO it (40.5–45.5) so the name has its referent. */}
        {t >= 27.6 && t < 45.9 && (() => { const on = clamp01((t - 27.7) / 0.5) * (1 - clamp01((t - 45.3) / 0.5));
          return <div style={{ opacity: on }}><FolderOfFiles u={u} t={t} t0={27.8} headlineOutAt={31.5} light={lite > 0.5} /></div>; })()}
        {t >= 40.4 && t < 45.9 && (() => { const l = t - 40.6; const on = clamp01(l / 0.4) * (1 - clamp01((l - 4.5) / 0.4)); const stamp = clamp01((l - 0.5) / 0.35);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {/* eyebrow takes the vacated headline slot */}
              <div style={{ position: "absolute", left: "50%", top: "14%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.2em", color: inkSoft }}>THE GURUS CALL IT</span>
              </div>
              {/* stamp slams across the two windows */}
              <div style={{ position: "absolute", left: "50%", top: "52%", transform: `translate(-50%,-50%) rotate(-5deg) scale(${lerp(1.6, 1, stamp)})`, opacity: stamp, border: `${u * 0.42}px solid ${LIME}`, borderRadius: u * 0.6, padding: `${u * 1}px ${u * 2.4}px`, background: "rgba(13,16,22,0.94)", boxShadow: `0 0 ${u * 3.6}px rgba(0,0,0,0.62)` }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 5, color: LIME, textTransform: "uppercase", whiteSpace: "nowrap" }}>SECOND BRAIN</span>
              </div>
              <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.1, color: inkSoft, opacity: clamp01((l - 1.4) / 0.4), textShadow: lite > 0.5 ? "none" : `0 0 ${u * 1.2}px rgba(15,18,26,0.9)` }}>or {"“"}an AI operating system{"”"}</div>
            </div>
          ); })()}

        {/* BEAT 8 — 1 weekend (45.5–49.0): the build VISIBLY completes inside two day-cards.
            Wireframe window hardens as the lime bar sweeps SAT→SUN; ✓ pops on "amazing". */}
        {t >= 45.4 && t < 49.4 && (() => { const on = clamp01((t - 45.5) / 0.4) * (1 - clamp01((t - 48.8) / 0.4));
          const bar = clamp01((t - 46.3) / 1.3);
          const popP = clamp01((t - 47.9) / 0.3);
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "16%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.2em", color: BODY }}>BUILD TIME</span>
              </div>
              {/* two day cards */}
              {["SAT", "SUN"].map((d, i) => (
                <div key={d} style={{ position: "absolute", left: `${38 + i * 24}%`, top: "34%", transform: "translate(-50%,-50%)", width: u * 20, height: u * 8, background: lite > 0.5 ? WHITE : "#12151d", border: `${u * 0.11}px solid ${lite > 0.5 ? RAISIN : "#2a3145"}`, borderRadius: u * 0.7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: ink, letterSpacing: "0.04em" }}>{d}</div>
              ))}
              {/* one continuous progress bar spanning both cards */}
              <div style={{ position: "absolute", left: "50%", top: "42.5%", transform: "translate(-50%,-50%)", width: u * 45, height: u * 1.0, background: "#181d2a", borderRadius: u * 0.5, overflow: "hidden", border: `${u * 0.06}px solid #2a3145` }}>
                <div style={{ width: `${bar * 100}%`, height: "100%", background: LIME }} />
              </div>
              {/* the app being built: wireframe hardens as the bar advances */}
              <div style={{ position: "absolute", left: "50%", top: "63%", transform: `translate(-50%,-50%) scale(${1 + popP * 0.04})` }}>
                <div style={{ width: u * 26, borderRadius: u * 0.9, overflow: "hidden", border: `${u * 0.12}px ${bar > 0.9 ? "solid" : "dashed"} ${bar > 0.9 ? (lite > 0.5 ? RAISIN : SILVER) : (lite > 0.5 ? "#b5bfc2" : "#3a4256")}`, boxShadow: "none", background: lite > 0.5 ? WHITE : "#12151d" }}>
                  <div style={{ height: u * 2.4, background: bar > 0.15 ? "#181c28" : "transparent", borderBottom: `${u * 0.08}px ${bar > 0.15 ? "solid" : "dashed"} #232939`, display: "flex", alignItems: "center", gap: u * 0.5, padding: `0 ${u * 1.0}px` }}>
                    {[0, 1, 2].map((j) => <span key={j} style={{ width: u * 0.65, height: u * 0.65, borderRadius: "50%", background: bar > 0.15 ? "#3a4256" : "transparent", border: bar > 0.15 ? "none" : `${u * 0.06}px dashed #3a4256` }} />)}
                    <span style={{ marginLeft: u * 0.5, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, color: bar > 0.15 ? SILVER_SOFT : "#3a4256" }}>my-second-brain/</span>
                  </div>
                  <div style={{ padding: `${u * 0.7}px ${u * 1.0}px`, display: "flex", flexDirection: "column", gap: u * 0.5 }}>
                    {[0.35, 0.55, 0.75].map((th, j) => (
                      <div key={j} style={{ height: u * 1.7, borderRadius: u * 0.3, background: bar > th ? "#1c2233" : "transparent", border: bar > th ? "none" : `${u * 0.07}px dashed #2a3145`, display: "flex", alignItems: "center", paddingLeft: u * 0.8 }}>
                        {bar > th && <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 0.9, color: SILVER_MID }}>{["me.md", "business.md", "skills/"][j]}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                {/* corner ✓ */}
                {popP > 0 && <div style={{ position: "absolute", right: -u * 1.1, top: -u * 1.1, width: u * 2.4, height: u * 2.4, borderRadius: "50%", background: LIME, color: RAISIN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.3, transform: `scale(${0.6 + 0.4 * popP})` }}>✓</div>}
              </div>
              {/* caption on the evidence, not the hero — clean SAT/SUN calendar chip + on-brand label */}
              <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 1.1, opacity: clamp01((t - 47.9) / 0.4) }}>
                <div style={{ display: "flex", flexDirection: "column", width: u * 6.6, borderRadius: u * 0.5, overflow: "hidden", border: `${u * 0.11}px solid ${lite > 0.5 ? RAISIN : SILVER_MID}`, background: lite > 0.5 ? WHITE : "#12151d" }}>
                  <div style={{ height: u * 0.65, background: LIME }} />
                  <div style={{ display: "flex" }}>
                    {["SAT", "SUN"].map((d, i) => (
                      <div key={d} style={{ flex: 1, textAlign: "center", padding: `${u * 0.32}px 0`, borderLeft: i ? `${u * 0.08}px solid ${lite > 0.5 ? "#c8cdd2" : "#2a3145"}` : "none", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.03em", color: ink }}>{d}</div>
                    ))}
                  </div>
                </div>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.1, letterSpacing: "0.01em", color: ink, textTransform: "uppercase", whiteSpace: "nowrap" }}>1 WEEKEND</span>
              </div>
            </div>
          ); })()}

        {/* BEAT 9 — the turn (49.0–55.4): the file FREEZES mid-tick (stamp + stopped clock),
            then a live event stream starts flowing UNDER it and never stops. */}
        {t >= 49.6 && t < 55.8 && (() => { const on = clamp01((t - 49.9) / 0.4) * (1 - clamp01((t - 55.2) / 0.4));
          const frz = clamp01((t - 51.2) / 0.4);
          const flow = clamp01((t - 53.3) / 0.4);
          const FEV = ["NEW ORDER €89", "REFUND ISSUED", "INVOICE PAID", "CUSTOMER SIGNED UP", "DM RECEIVED"];
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "6%", top: "13%", display: "inline-flex", alignItems: "center", gap: u * 0.8, opacity: clamp01((t - 49.9) / 0.35) }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.2em", color: LIME }}>THERE'S ONE PROBLEM</span>
              </div>
              {/* LEFT — the static file, visibly frozen (desaturates on frz) */}
              <div style={{ position: "absolute", left: "18%", top: "45%", transform: "translate(-50%,-50%)", filter: `saturate(${1 - frz * 0.9}) brightness(${1 - frz * 0.32})` }}>
                <svg width={u * 12} height={u * 15} viewBox="0 0 26 32">
                  <path d="M2 2 h14 l7 7 v21 h-21 z" fill="#12151d" stroke={SILVER_MID} strokeWidth={1.1} strokeLinejoin="round" />
                  <path d="M16 2 v7 h7" fill="none" stroke={SILVER_MID} strokeWidth={1.1} />
                  <path d="M6 14 h13 M6 18 h13 M6 22 h9" stroke="#39415a" strokeWidth={0.9} />
                  <g transform="translate(8.25 20.5) scale(0.0409)">
                    <rect x={-30} y={-22} width={268} height={172} fill="#12151d" />
                    <path d="M193 128H15a15 15 0 0 1-15-15V15A15 15 0 0 1 15 0h178a15 15 0 0 1 15 15v98a15 15 0 0 1-15 15zM50 98V59l20 25 20-25v39h20V30H90L70 55 50 30H30v68zm134-34h-20V30h-20v34h-20l30 35z" fill="#c3c9cd" opacity={0.55} />
                  </g>
                </svg>
              </div>
              {frz > 0 && (
                <div style={{ position: "absolute", left: "18%", top: "44%", transform: `translate(-50%,-50%) rotate(-6deg) scale(${1.3 - 0.3 * frz})`, opacity: frz, border: `${u * 0.18}px solid #8a93a8`, borderRadius: u * 0.35, padding: `${u * 0.22}px ${u * 0.8}px`, background: "rgba(13,16,22,0.9)" }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.4, color: "#8a93a8", whiteSpace: "nowrap" }}>FROZEN</span>
                </div>
              )}
              <div style={{ position: "absolute", left: "18%", top: "64%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.12em", color: SILVER_MID, opacity: clamp01((t - 50.3) / 0.4) }}>A STATIC FILE</div>
              {/* RIGHT — the change: a compact, high-contrast live stream (silver text, lime accents) */}
              {flow > 0 && (
                <div style={{ position: "absolute", left: "44%", top: "45%", transform: "translate(-50%,-50%)", width: u * 20, height: u * 15, overflow: "hidden", opacity: flow, maskImage: "linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)", WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)" }}>
                  {FEV.map((e, i) => {
                    const period = FEV.length * 2.6;
                    const y = (((t * 5.4 + i * (period / FEV.length)) % period) / period) * 128 - 14;
                    const fresh = y < 24;
                    return (
                      <div key={i} style={{ position: "absolute", left: "50%", top: `${y}%`, transform: "translate(-50%,-50%)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, background: "#242c3d", border: `${u * 0.09}px solid #47536e`, borderLeft: `${u * 0.42}px solid ${LIME}`, borderRadius: u * 0.5, padding: `${u * 0.6}px ${u * 1.15}px`, boxShadow: `0 ${u * 0.5}px ${u * 1.4}px rgba(0,0,0,0.5)` }}>
                          <span style={{ width: u * 0.55, height: u * 0.55, borderRadius: "50%", background: LIME, boxShadow: fresh ? `0 0 ${u * 0.8}px ${LIME}` : "none" }} />
                          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.02em", color: SILVER, whiteSpace: "nowrap" }}>{e}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ position: "absolute", left: "44%", top: "64%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.12em", color: LIME, opacity: flow }}>A REAL BUSINESS</div>
              <div style={{ position: "absolute", left: "6%", top: "86%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 53.4) / 0.4) }}>A REAL BUSINESS IS <Marker u={u} t={t} at={54.0}>CHANGE.</Marker></div>
            </div>
          ); })()}

        {/* BEAT 10 — numbers move (55.4–67.0) */}
        {t >= 55.3 && t < 67.2 && (() => { const on = clamp01((t - 55.4) / 0.5) * (1 - clamp01((t - 66.6) / 0.5));
          return (<div style={{ opacity: on }}>
            <div style={{ position: "absolute", left: "50%", top: "14%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4, color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 55.6) / 0.4) }}>NUMBERS MOVE <Marker u={u} t={t} at={56.4}>EVERY DAY</Marker></div>
            <NumbersMove u={u} t={t} t0={56.2} />
            {/* ONE WEEK of change made concrete: 7 day-bars fill left→right + a running event count */}
            {(() => { const lt = t - 56.2; const wk = clamp01((lt - 2.6) / 0.6);
              if (wk <= 0) return null;
              const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
              const heights = [0.34, 0.5, 0.42, 0.68, 0.56, 0.82, 0.72];
              const prog = clamp01((lt - 3.0) / 5.2);
              const filled = prog * 7;
              const events = Math.floor(prog * 128);
              return (
                <div style={{ position: "absolute", left: "50%", top: "80%", transform: "translate(-50%,-50%)", opacity: wk, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.0 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: u * 1.7, height: u * 6 }}>
                    {DAYS.map((d, i) => { const df = clamp01(filled - i);
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.5 }}>
                          <div style={{ width: u * 2.4, height: u * 6, background: "#181d2a", borderRadius: u * 0.3, display: "flex", alignItems: "flex-end", overflow: "hidden", border: `${u * 0.05}px solid #2a3145` }}>
                            <div style={{ width: "100%", height: `${heights[i] * 100 * df}%`, background: i >= 5 ? LIME : "#4a5268", borderRadius: `${u * 0.3}px ${u * 0.3}px 0 0` }} />
                          </div>
                          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, letterSpacing: "0.04em", color: df > 0.05 ? SILVER_MID : "#3a4256" }}>{d}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.04em", color: SILVER, fontVariantNumeric: "tabular-nums" }}><span style={{ color: LIME }}>+{events}</span> events logged this week</div>
                </div>
              );
            })()}
          </div>); })()}

        {/* BEAT 11 — the stream (67.0–77.7) */}
        {t >= 66.9 && t < 78.0 && (
          <div style={{ opacity: clamp01((t - 67.0) / 0.4) * (1 - clamp01((t - 77.4) / 0.4)) }}>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <defs><linearGradient id="a1w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={LIME} stopOpacity="0" /><stop offset="0.2" stopColor={LIME} stopOpacity="0.9" /><stop offset="1" stopColor={LIME} stopOpacity="0.9" /></linearGradient></defs>
              {streamOn > 0 && <path d={(() => { let d = `M ${sX(0) / 100 * W} ${sY(0) / 100 * H}`; for (let p = 0.02; p <= 1; p += 0.02) d += ` L ${sX(p) / 100 * W} ${sY(p) / 100 * H}`; return d; })()} stroke="url(#a1w)" strokeWidth={u * 0.32} fill="none" strokeLinecap="round" strokeDasharray={`${u * 2.2} ${u * 1.3}`} strokeDashoffset={-st * u * 7} opacity={streamOn} style={{ filter: `drop-shadow(0 0 ${u * 0.7}px ${LIME}aa)` }} />}
            </svg>
            <FileGraphic x={37} y={50} u={u} W={W} H={H} scale={1.08} frozen={sFrozen} crack={0} draw={clamp01((st - 0.8) / 0.8)} squash={sSquash} />
            {sRiders.map((r, i) => { const p = (st - r.born) / 6.5; if (p <= 0 || p >= 0.66) return null; const x = sX(p), y = sY(p); if (x > 49) return null; const vis = clamp01((p - 0.06) / 0.1) * (1 - clamp01((p - 0.5) / 0.12)) * sClear; if (vis <= 0.02) return null; return <Card key={i} x={x} y={y + amb.bob(i * 0.4, 0.5)} u={u} label={r.label} money={r.money} scale={0.66 + p * 0.28} rot={amb.drift(i * 0.5, 2.4)} opacity={vis} />; })}
            {sImpacts.map((it, k) => { const s0 = it - 0.6; if (st < s0 || st > it + 0.08) return null; const p = clamp01((st - s0) / 0.6); const sx = sX(0.36), sy = sY(0.36), ex = 37, ey = 50, mx = (sx + ex) / 2, my = Math.min(sy, ey) - 8; const bz = (a: number, b: number, c: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c; return <Card key={`d${k}`} x={bz(sx, mx, ex)} y={bz(sy, my, ey)} u={u} label={SLAB_DIVE[k % SLAB_DIVE.length]} money={k % 2 === 0} scale={0.95 - p * 0.4} rot={p * -12} />; })}
            {sBurst > 0 && sDebris.map((d, i) => { const dt = st - 7.1; if (dt > 1.0) return null; const x = 37 + Math.cos(d.ang) * d.spd * dt, y = 50 + Math.sin(d.ang) * d.spd * dt * 0.85 + 26 * dt * dt; return <Card key={`b${i}`} x={x} y={y} u={u} label={SLAB_DEBRIS[i % SLAB_DEBRIS.length]} money={i % 2 === 0} scale={0.44} rot={d.rot * dt} opacity={(1 - dt / 1.0) * 0.85} />; })}
            <H1 u={u} t={t} in0={67.4} out={77.2} top="14%">NOT A DOCUMENT.</H1>
            <H1 u={u} t={t} in0={69.0} out={77.2} top="21%">IT'S A <Marker u={u} t={t} at={70.0}>STREAM.</Marker></H1>
            {sFrozen && st < 9.4 && (() => { const p = clamp01((st - 7.4) / 0.3);
              return <div style={{ position: "absolute", left: "37%", top: "72%", transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * p})`, opacity: p * (1 - clamp01((st - 9.0) / 0.4)) }}><div style={{ position: "relative", display: "inline-block" }}><div style={{ position: "absolute", inset: 0, background: LIME, transform: `translate(${u * 0.4}px,${u * 0.4}px)` }} /><div style={{ position: "relative", background: RAISIN, border: `${u * 0.1}px solid ${LIME}`, padding: `${u * 0.5}px ${u}px` }}><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.12em", color: LIME }}>✕ CAN'T HOLD IT</span></div></div></div>; })()}
          </div>
        )}

        {/* BEAT 12 — photo vs movie (77.8–81.3): narration says PHOTO first, then MOVIE.
            A single frozen PHOTO sits still, then COMES ALIVE into a moving MOVIE in the SAME spot.
            The come-alive (flash + motion starting) IS the point. LIGHT register → raisin ink. */}
        {t >= 77.8 && t < 81.6 && (() => { const on = clamp01((t - 77.9) / 0.4) * (1 - clamp01((t - 81.0) / 0.35));
          const alive = clamp01((t - 79.5) / 0.28); // still PHOTO → living MOVIE
          const flash = (t > 79.5 && t < 79.85) ? (1 - (t - 79.5) / 0.35) : 0;
          const acc = lite > 0.5 ? RAISIN : LIME; // never lime on the white worksheet
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {/* eyebrow */}
              <div style={{ position: "absolute", left: "42%", top: "18%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.9, height: u * 0.9, background: acc }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.18em", color: inkSoft }}>A FILE vs A BUSINESS</span>
              </div>
              {/* the screen: a still PHOTO → COMES ALIVE into a MOVIE in the SAME spot */}
              <div style={{ position: "absolute", left: "42%", top: "48%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ opacity: 1 - alive, transform: `scale(${1 - 0.05 * alive})` }}><PhotoCard u={u} /></div>
                <div style={{ position: "absolute", opacity: alive, transform: `scale(${0.9 + 0.1 * alive})` }}><Filmstrip u={u} t={t} /></div>
              </div>
              {/* come-alive flash */}
              <div style={{ position: "absolute", inset: 0, background: WHITE, opacity: flash * 0.7, pointerEvents: "none" }} />
              {/* label swaps as the still comes alive */}
              <div style={{ position: "absolute", left: "42%", top: "74%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", textAlign: "center", width: u * 44 }}>
                <div style={{ opacity: 1 - alive, fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: ink, textTransform: "uppercase" }}>A FILE IS A <Marker u={u} t={t} at={78.6} base={ink}>PHOTO</Marker></div>
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: alive, fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: ink, textTransform: "uppercase" }}>A BUSINESS IS A <span style={{ color: acc }}>MOVIE</span></div>
              </div>
              <div style={{ position: "absolute", left: "42%", top: "80%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", textAlign: "center", width: u * 44, height: u * 2.4, fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.6, color: inkSoft }}>
                <span style={{ position: "absolute", left: 0, right: 0, opacity: 1 - alive }}>one frozen moment</span>
                <span style={{ position: "absolute", left: 0, right: 0, opacity: alive }}>always moving</span>
              </div>
            </div>
          ); })()}

        {/* BEAT 14 — who types it in (89.3–98.3): a clear left-to-right pipe — a LIVE STREAM of events
            piles up, hits a big MANUAL STEP gate (nobody home), and never reaches the frozen business.md.
            Footage sits far right; the stream→file flow owns the whole left with room to breathe. */}
        {t >= 89.3 && t < 98.5 && (() => { const on = clamp01((t - 89.6) / 0.4) * (1 - clamp01((t - 98.1) / 0.4));
          const gate = clamp01((t - 91.0) / 0.4);
          const fade = 1 - clamp01((t - 97.4) / 0.4);
          const QUE = [
            { l: "new order €1,850", money: true, at: 90.2, ty: 28 },
            { l: "email from a client", money: false, at: 91.4, ty: 40 },
            { l: "payout €3,900", money: true, at: 92.6, ty: 52 },
          ];
          return (
            <div style={{ opacity: on }}>
              {/* eyebrow */}
              <div style={{ position: "absolute", left: "6%", top: "11%", display: "inline-flex", alignItems: "center", gap: u * 0.9, opacity: clamp01((t - 89.8) / 0.4) }}>
                <span style={{ width: u * 1.0, height: u * 1.0, background: LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.16em", color: SILVER_SOFT }}>THE LAST STEP IS <span style={{ color: LIME }}>MISSING</span></span>
              </div>
              {/* pipeline connectors on ONE axis: stream → [MANUAL STEP] --broken--> business.md */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {/* stream → gate: events want through (lime, dashed) */}
                <path d={`M ${W * 0.15} ${H * 0.40} L ${W * 0.195} ${H * 0.40}`} stroke={LIME} strokeWidth={u * 0.22} fill="none" strokeLinecap="round" strokeDasharray={`${u * 1.2} ${u * 0.9}`} opacity={0.6 * clamp01((t - 90.6) / 0.4)} />
                {/* gate → file: BROKEN, greyed (nothing passes) */}
                <path d={`M ${W * 0.405} ${H * 0.40} L ${W * 0.42} ${H * 0.40}`} stroke="#4a5268" strokeWidth={u * 0.22} fill="none" strokeLinecap="round" strokeDasharray={`${u * 0.6} ${u * 1.1}`} opacity={gate * 0.7} />
              </svg>
              {/* the incoming STREAM of events — a clean vertical queue on the left */}
              {QUE.map((q, i) => { const dt = t - q.at; if (dt < 0) return null; const p = clamp01(dt / 0.55);
                return <Card key={i} x={lerp(-8, 8, p)} y={q.ty} u={u} label={q.l} money={q.money} scale={1.0} opacity={clamp01(dt / 0.25) * fade} />; })}
              {/* ONE clearly-labeled MANUAL STEP gate — plate + an empty input nobody fills */}
              {gate > 0 && (
                <div style={{ position: "absolute", left: "30%", top: "40%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: gate }}>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.6, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} />
                    {/* no literal "MANUAL STEP" label — a keyboard on a lime plate says "a human has to type it" */}
                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: RAISIN, border: `${u * 0.16}px solid ${LIME}`, borderRadius: u * 0.7, padding: `${u * 1.05}px ${u * 1.25}px` }}>
                      <Img src={staticFile("logos/lucide-keyboard-lime.svg")} style={{ width: u * 3.4, height: u * 3.4, flexShrink: 0 }} />
                    </div>
                  </div>
                  <div style={{ marginTop: u * 1.0, display: "flex", alignItems: "center", gap: u * 0.5, width: u * 13, background: "#12151d", border: `${u * 0.09}px solid #2a3145`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px` }}>
                    <span style={{ display: "inline-block", width: u * 0.45, height: u * 1.5, background: LIME, opacity: Math.floor(t * 2.4) % 2 === 0 ? 1 : 0.15 }} />
                  </div>
                  <div style={{ marginTop: u * 0.9, fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.45, color: SILVER, whiteSpace: "nowrap" }}>you type every event by hand</div>
                </div>
              )}
              {/* the frozen business.md it never reaches */}
              <FileGraphic x={50} y={40} u={u} W={W} H={H} scale={1.0} frozen draw={1} />
              <div style={{ position: "absolute", left: "50%", top: "62%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 600, fontSize: u * 1.2, color: SILVER_MID, opacity: clamp01((t - 90.2) / 0.4) }}>last updated: 3 weeks ago</div>
              {/* the question (spoken ~94.2) */}
              <div style={{ position: "absolute", left: "6%", top: "82%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.0, color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 94.2) / 0.4) * (1 - clamp01((t - 97.6) / 0.4)) }}>
              <Marker u={u} t={t} at={95.0}>WHO</Marker> TYPES IT BACK IN?
              </div>
            </div>
          ); })()}

        {/* BEAT 15 — forever? (98.6–104.5): a FUNNEL — six columns of business events (orders, DMs,
            payouts, reviews, signups, refunds) all pour DOWN and converge into the single business.md,
            far more than anyone could ever type by hand → "Forever?". */}
        {t >= 98.6 && t < 104.7 && (() => { const on = clamp01((t - 98.8) / 0.4) * (1 - clamp01((t - 104.1) / 0.4));
          const flood = clamp01((t - 99.6) / 1.4);   // the columns of events flood in
          const typed = "- new order #1041".slice(0, Math.max(0, Math.floor((t - 99.0) * 11)));
          const foreverP = clamp01((t - 101.9) / 0.45);
          const LANES: { label: string; feed: string[]; money: boolean }[] = [
            { label: "orders", feed: ["order #1041", "order #1042", "order #1043", "order #1044"], money: true },
            { label: "DMs", feed: ["DM: still there?", "DM: hello?", "DM: quote?", "DM: thanks!"], money: false },
            { label: "payouts", feed: ["payout €3,900", "€1,240 paid", "€480 paid", "€96 paid"], money: true },
            { label: "reviews", feed: ["5★ review", "4★ review", "1★ review", "5★ review"], money: false },
            { label: "signups", feed: ["+3 subscribers", "+1 signup", "+2 signups", "+5 subs"], money: false },
            { label: "refunds", feed: ["refund €89", "chargeback", "refund €54", "dispute"], money: true },
          ];
          const L = LANES.length, perLane = 5;
          const topY = 20, mouthY = 62;   // chips travel from topY down to the funnel mouth
          return (
            <div style={{ opacity: on }}>
              {/* eyebrow */}
              <div style={{ position: "absolute", left: "50%", top: "10%", transform: "translate(-50%,-50%)", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap", opacity: clamp01((t - 99.0) / 0.4) }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.18em", color: SILVER_SOFT }}>EVERY EVENT · BY <span style={{ color: LIME }}>HAND</span></span>
              </div>
              {/* funnel guide — wide at the top, narrowing down to the file */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <path d={`M ${W * 0.12} ${H * (mouthY - 4) / 100} L ${W * 0.445} ${H * (mouthY + 6) / 100} L ${W * 0.445} ${H * (mouthY + 11) / 100} L ${W * 0.555} ${H * (mouthY + 11) / 100} L ${W * 0.555} ${H * (mouthY + 6) / 100} L ${W * 0.88} ${H * (mouthY - 4) / 100}`} fill={`${LIME}0e`} stroke="#2f3752" strokeWidth={u * 0.12} strokeLinejoin="round" opacity={flood} />
              </svg>
              {/* lane headers so the volume reads as categories */}
              {flood > 0 && LANES.map((lane, li) => { const laneX = 13 + li * (74 / (L - 1));
                return <div key={`h${li}`} style={{ position: "absolute", left: `${laneX}%`, top: `${topY - 5}%`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.92, letterSpacing: "0.08em", color: SILVER_MID, whiteSpace: "nowrap", opacity: flood }}>{lane.label}</div>;
              })}
              {/* the columns of events funnelling down and converging into the file */}
              {LANES.map((lane, li) => {
                const laneX = 13 + li * (74 / (L - 1));
                return Array.from({ length: perLane }).map((_, k) => {
                  const phase = ((((t * 0.42) + k / perLane + li * 0.11) % 1) + 1) % 1;
                  const conv = phase * phase;                 // hug the lane, then rush to centre
                  const cx = laneX + (50 - laneX) * conv;
                  const cy = topY + (mouthY - topY) * phase;
                  const vis = clamp01(phase / 0.06) * (1 - clamp01((phase - 0.9) / 0.1)) * flood;
                  if (vis <= 0.02) return null;
                  const lab = lane.feed[(k + li) % lane.feed.length];
                  return <Card key={`${li}-${k}`} x={cx} y={cy} u={u} label={lab} money={lane.money} scale={0.66 - phase * 0.16} opacity={vis} />;
                });
              })}
              {/* the ONE business.md file catching it all — typed by hand */}
              <div style={{ position: "absolute", left: "50%", top: "80%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 98.9) / 0.4) }}>
                <Win u={u} w={28} title="business.md">
                  <div style={{ padding: `${u * 0.9}px ${u * 1.2}px`, display: "flex", flexDirection: "column", gap: u * 0.5 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: SILVER_MID }}>## orders</span>
                    <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: SILVER, whiteSpace: "nowrap" }}>
                      {typed}{Math.floor(t * 2.6) % 2 === 0 && <span style={{ display: "inline-block", width: u * 0.4, height: u * 1.4, background: LIME, verticalAlign: "-12%", marginLeft: u * 0.1 }} />}
                    </span>
                  </div>
                </Win>
                <div style={{ marginTop: u * 0.7, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.6, opacity: clamp01((t - 99.6) / 0.4) }}>
                  <Img src={staticFile("logos/lucide-keyboard-lime.svg")} style={{ width: u * 1.35, height: u * 1.35 }} />
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.12em", color: LIME }}>TYPED BY HAND</span>
                </div>
              </div>
              {/* the word — impossible to keep up */}
              {t > 101.9 && (
                <div style={{ position: "absolute", left: "20%", top: "84%", transform: "translate(-50%,-50%)", clipPath: `inset(-6% ${(1 - foreverP) * 102 - 1}% -6% -1%)` }}>
                  <div style={{ background: LIME, padding: `${u * 0.5}px ${u * 1.5}px`, borderRadius: u * 0.3, transform: "rotate(-1.6deg)", boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.5)` }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 4.0, color: RAISIN, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>FOREVER?</span>
                  </div>
                </div>
              )}
            </div>
          ); })()}

        {/* BEAT 16 — the DATABASE (104.5–113.1) */}
        {t >= 104.4 && t < 113.3 && (() => { const on = clamp01((t - 104.5) / 0.4) * (1 - clamp01((t - 112.7) / 0.5));
          return <div style={{ opacity: on }}><DatabaseHolds u={u} t={t} t0={104.7} W={W} H={H} /></div>; })()}

        {/* BEAT 17 — why ignore them? (113.4–117.0): the template stack stands still while
            valuable events stream past it un-caught, greying out as they fall. */}
        {t >= 113.4 && t < 117.4 && (() => { const l = t - 113.8; const on = clamp01(l / 0.4) * (1 - clamp01((l - 3.0) / 0.4));
          const PASS = [{ l: "Client said yes — €6k", at: 113.8 }, { l: "Pricing changed", at: 114.7 }, { l: "New hire decision", at: 115.6 }];
          return (
            <div style={{ opacity: on }}>
              {/* the indifferent template stack — three offset windows, clearly a stack */}
              <div style={{ position: "absolute", left: "28%", top: "40%", transform: "translate(-50%,-50%)", width: u * 23, height: u * 15 }}>
                {[2, 1, 0].map((i) => (
                  <div key={i} style={{ position: "absolute", left: u * (2 - i) * 1.1, top: u * (2 - i) * 1.3, width: u * 20, height: u * 12, background: "#12151d", border: `${u * 0.1}px solid #2a3145`, borderRadius: u * 0.7, filter: "saturate(0.3)" }}>
                    <div style={{ height: u * 2.0, borderBottom: `${u * 0.07}px solid #232939`, display: "flex", alignItems: "center", paddingLeft: u * 0.9, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, color: "#5a6478" }}>{["tasks/", "journal/", "notes/"][i]}</div>
                  </div>
                ))}
                <div style={{ position: "absolute", left: 0, top: u * 16, width: u * 23, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.14em", color: "#5a6478" }}>SECOND BRAIN TEMPLATE</div>
              </div>
              {/* events stream past, un-caught, greying out as they fall away */}
              {PASS.map((p, i) => {
                const dt = t - p.at; if (dt < 0 || dt > 2.6) return null;
                const pr = dt / 2.6;
                const x = 8 + pr * 37, y = 82 - Math.sin(pr * Math.PI) * 34 + pr * 6;
                const grey = clamp01((pr - 0.45) / 0.25);
                return (
                  <div key={i} style={{ position: "absolute", inset: 0, filter: `saturate(${1 - grey})`, opacity: 1 - clamp01((pr - 0.82) / 0.18), pointerEvents: "none" }}>
                    <Card x={x} y={y} u={u} label={p.l} money scale={0.95} rot={pr * 10 - 5} />
                  </div>
                );
              })}
              <div style={{ position: "absolute", left: "6%", top: "82%", opacity: clamp01((t - 114.2) / 0.4), whiteSpace: "nowrap" }}><div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.2, color: SILVER, textTransform: "uppercase" }}>SO WHY <Marker u={u} t={t} at={114.6}>IGNORE</Marker> THEM?</div></div>
            </div>
          ); })()}

        {/* BEAT 18 — files frozen, business alive (117.3–123.1): shared axis, and the ALIVE side
            is literally alive — cards keep dropping in, rows flash, glow breathes. */}
        {t >= 117.3 && t < 123.2 && (() => { const l = t - 117.5; const on = clamp01(l / 0.4);
          const GY = 47, LY = 70, SY = 76; // shared baselines
          const drops = [1.4, 3.0, 4.6]; // looping arrivals into the database
          const arrived = drops.filter((d) => l >= d + 0.55).length;
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <div style={{ position: "absolute", left: "50%", top: "14%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 1.2 }}>
                <div style={{ position: "relative" }}><div style={{ position: "absolute", inset: 0, background: LIME, transform: `translate(${u * 0.4}px,${u * 0.4}px)` }} /><div style={{ position: "relative", background: RAISIN, border: `${u * 0.14}px solid ${SILVER}`, padding: `${u * 0.3}px ${u * 1.1}px`, fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: LIME }}>1</div></div>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.14em", color: BODY, whiteSpace: "nowrap" }}>NUMBER ONE</span>
              </div>
              {/* FROZEN file (left) */}
              <div style={{ position: "absolute", left: "35%", top: `${GY}%`, transform: "translate(-50%,-50%)", opacity: clamp01((l - 0.4) / 0.5) }}>
                <svg width={u * 15} height={u * 19} viewBox="0 0 32 40">
                  <g transform="translate(4 3)">
                    <path d="M0 2 h15 l8 8 v25 h-23 z" fill="#1b2030" stroke={SILVER_MID} strokeWidth={1.1} strokeLinejoin="round" />
                    <path d="M15 2 v8 h8" fill="none" stroke={SILVER_MID} strokeWidth={1.1} strokeLinejoin="round" />
                    <path d="M5 16 h13 M5 20 h15 M5 24 h10 M5 28 h13" stroke="#39415a" strokeWidth={0.9} />
                    {/* markdown mark badge — muted, the doc is frozen */}
                    <g transform="translate(7 23.5) scale(0.0433)">
                      <rect x={-30} y={-22} width={268} height={172} fill="#1b2030" />
                      <path d="M193 128H15a15 15 0 0 1-15-15V15A15 15 0 0 1 15 0h178a15 15 0 0 1 15 15v98a15 15 0 0 1-15 15zM50 98V59l20 25 20-25v39h20V30H90L70 55 50 30H30v68zm134-34h-20V30h-20v34h-20l30 35z" fill="#c3c9cd" opacity={0.6} />
                    </g>
                  </g>
                </svg>
              </div>
              <div style={{ position: "absolute", left: "35%", top: `${LY}%`, transform: "translate(-50%,-50%)", fontFamily: SANS, fontWeight: 800, fontSize: u * 2, color: SILVER_MID, textTransform: "uppercase", opacity: clamp01((l - 0.4) / 0.5) }}>FROZEN</div>
              <div style={{ position: "absolute", left: "35%", top: `${SY}%`, transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: "#4a5268", opacity: clamp01((l - 0.7) / 0.4) }}>0 updates since you wrote it</div>
              {/* vs — on the graphics axis */}
              <div style={{ position: "absolute", left: "50%", top: `${GY}%`, transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.4, color: BODY, opacity: clamp01((l - 0.8) / 0.4) }}>vs</div>
              {/* ALIVE database (right): breathing glow + cards dropping in + rows flashing */}
              <div style={{ position: "absolute", left: "65%", top: `${GY}%`, transform: "translate(-50%,-50%)", opacity: clamp01((l - 1.0) / 0.5) }}>
                <div style={{ position: "absolute", left: "50%", top: "50%", width: u * 22, height: u * 22, transform: "translate(-50%,-50%)", background: `radial-gradient(circle, ${LIME}${Math.round(18 + amb.pulse(0, 0.5) * 8).toString(16)} 0%, transparent 65%)` }} />
                <svg width={u * 15} height={u * 19} viewBox="0 0 32 40" style={{ position: "relative" }}>
                  <g transform="translate(16 19)">
                    <g fill="none" stroke={LIME} strokeWidth={1} strokeLinecap="round">
                      <path d="M-11 -13 a11 4 0 1 0 22 0 a11 4 0 1 0 -22 0" />
                      <path d="M-11 -13 L-11 13 M11 -13 L11 13 M-11 13 a11 4 0 0 0 22 0" />
                    </g>
                    {Array.from({ length: 3 + arrived }).map((_, i) => {
                      const flash = drops.map((d) => 1 - clamp01((l - d - 0.55) / 0.35))[i - 3] ?? 0;
                      return <rect key={i} x={-8} y={9 - i * 3.2} width={16} height={2.1} rx={0.5} fill={LIME} opacity={0.18 + (i >= 3 ? flash * 0.5 : 0)} />;
                    })}
                  </g>
                </svg>
                {/* mini cards dropping in, forever */}
                {drops.map((d, i) => {
                  const p = clamp01((l - d) / 0.55);
                  if (p <= 0 || p >= 1) return null;
                  return <div key={i} style={{ position: "absolute", left: "50%", top: `${-38 + p * 42}%`, transform: `translate(-50%,-50%) scale(${1 - p * 0.35})`, opacity: 1 - clamp01((p - 0.8) / 0.2) }}>
                    <div style={{ background: RAISIN_DEEP, border: `${u * 0.1}px solid ${LIME}`, borderRadius: u * 0.4, padding: `${u * 0.35}px ${u * 0.8}px`, fontFamily: SANS, fontWeight: 600, fontSize: u * 1.0, color: SILVER, whiteSpace: "nowrap" }}>{["new order", "€780 paid", "+1 subscriber"][i]}</div>
                  </div>;
                })}
              </div>
              <div style={{ position: "absolute", left: "65%", top: `${LY}%`, transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 0.6, whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2, color: LIME, textTransform: "uppercase", opacity: clamp01((l - 1.0) / 0.5) }}><Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.2, height: u * 1.2 }} />ALIVE</div>
              <div style={{ position: "absolute", left: "65%", top: `${SY}%`, transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 600, fontSize: u * 1.05, color: LIME, opacity: clamp01((l - 1.3) / 0.4) }}>+{3 + arrived} rows today</div>
            </div>
          ); })()}
      </div>

      {/* ============ SCRIM (full-footage readability) ============ */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.55) 0%, transparent 26%, transparent 60%, rgba(8,10,14,0.72) 100%)`, opacity: full, pointerEvents: "none" }} />

      {/* ============ FOOTAGE (hook punch-in: 1.0 → 1.06 → settle, gone by 3.2s) ============ */}
      {(() => {
        const zoomIn = interpolate(t, [0.05, 1.1], [1.0, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        const zoomOut = interpolate(t, [1.1, 3.2], [0, 0.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        const hookZoom = t < 3.3 ? zoomIn - zoomOut : 1;
        return (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${hookZoom})`, transformOrigin: "50% 42%" }}>
            <FootageLayer sk={sk} u={u} src="footage/act1.mp4" />
          </div>
        );
      })()}

      {/* ============ OVERLAYS ON FOOTAGE ============ */}
      {/* BEAT 1 — hook (0–7.7) FULL footage the whole beat.
          Exclusion zone (his head): x 40–64%. Headline on a raisin plate top-left; coach chips
          stack right of the head; callout shares the headline's exact left edge. Nothing moves. */}
      {t < 8.0 && (() => { const out = 1 - clamp01((t - 7.2) / 0.4);
        const panelIn = clamp01((t - 0.6) / 0.4);
        const win = clamp01((t - 4.1) / 0.45);   // Claude's answer lands → the coaches get struck
        const coaches = [
          { name: "COACH #1", price: "€2,500/mo", advice: "“post more content”", at: 1.5 },
          { name: "COACH #2", price: "€1,800/mo", advice: "“raise your prices”", at: 2.4 },
        ];
        return (
          <div style={{ position: "absolute", left: "6%", top: "50%", transform: "translateY(-50%)", opacity: panelIn * out }}>
            {/* eyebrow */}
            <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, marginBottom: u * 1.05 }}>
              <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.2em", color: SILVER, textTransform: "uppercase" }}>Better than my coaches</span>
            </div>
            {/* ONE clean comparison — generic paid advice (struck) vs the real free answer (lit) */}
            <div style={{ width: u * 35, background: "rgba(11,13,19,0.9)", border: `${u * 0.1}px solid #2a3145`, borderRadius: u * 1.0, padding: `${u * 1.35}px ${u * 1.5}px`, display: "flex", flexDirection: "column", gap: u * 1.05, boxShadow: `0 ${u * 1.2}px ${u * 3.2}px rgba(0,0,0,0.5)`, backdropFilter: "blur(2px)" }}>
              {coaches.map((c, i) => { const o = clamp01((t - c.at) / 0.35); if (o <= 0) return null;
                const struck = win > 0.5;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 0.9, opacity: o * (1 - win * 0.4), transform: `translateY(${(1 - o) * u}px)` }}>
                    <Img src={staticFile("logos/lucide-users-dim.svg")} style={{ width: u * 1.6, height: u * 1.6, flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, color: SILVER_SOFT, width: u * 6.6, textDecoration: struck ? "line-through" : "none" }}>{c.name}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, color: SILVER_MID, width: u * 5.8, textDecoration: struck ? "line-through" : "none" }}>{c.price}</span>
                    <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.35, color: SILVER_MID, flex: 1, whiteSpace: "nowrap", textDecoration: struck ? "line-through" : "none" }}>{c.advice}</span>
                  </div>
                );
              })}
              {/* divider + the winner */}
              <div style={{ height: u * 0.08, background: "#2a3145", opacity: win }} />
              {win > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: u * 0.9, opacity: win, transform: `translateY(${(1 - win) * u}px)` }}>
                  <Img src={staticFile("logos/claude.svg")} style={{ width: u * 2.0, height: u * 2.0, flexShrink: 0 }} />
                  <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.3, color: LIME, width: u * 6.6, letterSpacing: "0.04em" }}>CLAUDE</span>
                  <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.3, color: LIME, width: u * 5.8 }}>€0</span>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.6, color: SILVER, flex: 1, whiteSpace: "nowrap" }}>go all-in on <span style={{ color: LIME }}>ONE</span> thing</span>
                </div>
              )}
            </div>
          </div>
        ); })()}

      {/* BEAT 2 — you ask your second brain and it can't answer (8.6–14.5): a near-1:1 Claude session.
          The user types "What should I focus on?" into a Claude-style chat; Claude searches the
          second-brain files and comes back EMPTY — a clear, failed Claude session. FULL footage under. */}
      {t >= 8.6 && t < 14.5 && (() => { const out = 1 - clamp01((t - 13.9) / 0.4);
        const win = clamp01((t - 8.7) / 0.4) * out;
        const Q = "What should I focus on?";
        const typedN = Math.round(clamp01((t - 9.5) / 1.5) * Q.length);
        const sent = t > 11.15;
        const searching = t > 11.35 && t < 12.85;
        const answer = clamp01((t - 12.85) / 0.35);
        const caret = Math.floor(t * 2.4) % 2 === 0;
        const files = [
          { n: "me.md", at: 11.6 },
          { n: "business.md", at: 11.95 },
          { n: "priorities.md", at: 12.3 },
        ];
        return (<>
          {/* mono eyebrow */}
          <div style={{ position: "absolute", left: "6%", top: "10%", display: "inline-flex", alignItems: "center", gap: u * 1.0, opacity: clamp01((t - 8.8) / 0.4) * out }}>
            <span style={{ width: u * 1.1, height: u * 1.1, background: LIME }} />
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.95, letterSpacing: "0.16em", color: SILVER_SOFT }}>YOU ASK YOUR <span style={{ color: LIME }}>SECOND BRAIN</span></span>
          </div>
          {/* the Claude chat window */}
          <div style={{ position: "absolute", left: "26%", top: "56%", transform: "translate(-50%,-50%)", opacity: win, width: u * 37 }}>
            <div style={{ position: "relative", background: "#12151d", border: `${u * 0.12}px solid #2a3145`, borderRadius: u * 1.0, overflow: "hidden", boxShadow: `0 ${u * 1.6}px ${u * 4}px rgba(0,0,0,0.65)` }}>
              {/* Claude header */}
              <div style={{ height: u * 3.4, background: "#181c28", borderBottom: `${u * 0.09}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.9, padding: `0 ${u * 1.3}px` }}>
                <Img src={staticFile("logos/claude-white.svg")} style={{ width: u * 1.9, height: u * 1.9 }} />
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.4, color: SILVER }}>Claude</span>
                <span style={{ marginLeft: u * 0.6, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, letterSpacing: "0.06em", color: SILVER_MID, border: `${u * 0.08}px solid #2a3145`, borderRadius: u * 0.4, padding: `${u * 0.2}px ${u * 0.7}px` }}>+ my second brain</span>
              </div>
              {/* transcript */}
              <div style={{ padding: `${u * 1.3}px ${u * 1.4}px`, display: "flex", flexDirection: "column", gap: u * 1.2, minHeight: u * 13 }}>
                {/* user message */}
                {sent && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: "#222838", border: `${u * 0.09}px solid #333c54`, borderRadius: u * 0.9, borderTopRightRadius: u * 0.2, padding: `${u * 0.75}px ${u * 1.2}px`, maxWidth: "82%", fontFamily: SANS, fontWeight: 500, fontSize: u * 1.45, color: SILVER }}>{Q}</div>
                  </div>
                )}
                {/* Claude reply */}
                {sent && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: u * 1.0 }}>
                    <Img src={staticFile("logos/claude-white.svg")} style={{ width: u * 2.1, height: u * 2.1, flexShrink: 0, marginTop: u * 0.15 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {searching && (
                        <div style={{ display: "flex", flexDirection: "column", gap: u * 0.6 }}>
                          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.15, color: SILVER_MID }}>Searching your second brain…</span>
                          <div style={{ display: "flex", gap: u * 0.6, flexWrap: "wrap" }}>
                            {files.map((fl, i) => { const fo = clamp01((t - fl.at) / 0.2); const fail = clamp01((t - fl.at - 0.15) / 0.2); if (fo <= 0) return null;
                              return (
                                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: u * 0.4, opacity: fo, background: "#181d2a", border: `${u * 0.07}px solid #2a3145`, borderRadius: u * 0.4, padding: `${u * 0.3}px ${u * 0.7}px`, fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, color: fail > 0.5 ? "#6a7288" : SILVER_SOFT }}>
                                  <span style={{ color: fail > 0.5 ? "#8a93a8" : SILVER_MID }}>{fail > 0.5 ? "✕" : "•"}</span>{fl.n}
                                </span>
                              ); })}
                          </div>
                        </div>
                      )}
                      {answer > 0 && (
                        <div style={{ opacity: answer }}>
                          <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: u * 1.4, lineHeight: 1.35, color: SILVER }}>I can't answer that from your files. They haven't changed in weeks — there's nothing here about what's happening now.</span>
                          <div style={{ marginTop: u * 0.9, display: "inline-flex", alignItems: "center", gap: u * 0.5, background: RAISIN_DEEP, border: `${u * 0.1}px solid #6a7288`, borderRadius: u * 0.4, padding: `${u * 0.3}px ${u * 0.9}px` }}>
                            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.1, letterSpacing: "0.08em", color: "#8a93a8" }}>NO ANSWER</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* input box (the question is typed here, then sent) */}
              <div style={{ padding: `0 ${u * 1.4}px ${u * 1.3}px` }}>
                <div style={{ display: "flex", alignItems: "center", gap: u * 0.9, background: "#0f121a", border: `${u * 0.1}px solid ${sent ? "#2a3145" : LIME}`, borderRadius: u * 0.8, padding: `${u * 0.75}px ${u * 1.05}px` }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 500, fontSize: u * 1.4, color: sent ? "#4a5268" : SILVER, whiteSpace: "nowrap", overflow: "hidden" }}>
                    {sent ? "Reply to Claude…" : Q.slice(0, typedN)}
                    {!sent && caret && <span style={{ display: "inline-block", width: u * 0.16, height: u * 1.65, background: LIME, verticalAlign: "-15%", marginLeft: u * 0.1 }} />}
                  </span>
                  <span style={{ width: u * 2.5, height: u * 2.5, borderRadius: "50%", background: LIME, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5, color: RAISIN, lineHeight: 1 }}>↑</span>
                </div>
              </div>
            </div>
          </div>
        </>); })()}

      {/* BEAT 13 — the aside (82.3–88.5): footage stays FULL; the whole screen FILLS with real-looking
          YouTube replies — scattered, stacked, a little messy — all calling out what got missed. */}
      {t >= 82.3 && t < 88.6 && (() => { const on = clamp01((t - 82.6) / 0.5) * (1 - clamp01((t - 88.1) / 0.4));
        const CM = [
          { h: "@marcus.builds", a: "M", col: LIME, txt: "Hey Luuk, you missed this — the notes never update themselves 👀", x: 21, y: 19, rot: -4, w: 27, at: 82.9 },
          { h: "@sarahcodes", a: "S", col: "#8ab4f8", txt: "wait so the file just sits there frozen?? that's my whole problem 😅", x: 76, y: 16, rot: 3, w: 26, at: 83.3 },
          { h: "@founder_mike", a: "F", col: "#f28b82", txt: "this is literally what happens to me every single week", x: 50, y: 31, rot: -1.5, w: 25, at: 83.7 },
          { h: "@dev_amelia", a: "A", col: "#fbbc04", txt: "so who is actually typing it all back in???", x: 16, y: 49, rot: 2.5, w: 22, at: 84.1 },
          { h: "@jaywtf", a: "J", col: "#c58af9", txt: "3 weeks out of date lmao same", x: 83, y: 45, rot: -3, w: 20, at: 84.5 },
          { h: "@buildwithtom", a: "T", col: LIME, txt: "nobody talks about the UPDATE problem. this is it.", x: 27, y: 73, rot: 3.5, w: 25, at: 84.9 },
          { h: "@nora.exe", a: "N", col: "#8ab4f8", txt: "my second brain is basically a graveyard 💀", x: 71, y: 71, rot: -2, w: 24, at: 85.3 },
          { h: "@rachel.ops", a: "R", col: "#f28b82", txt: "you just described my entire Notion", x: 48, y: 85, rot: 1.5, w: 22, at: 85.7 },
          { h: "@leo_makes", a: "L", col: "#fbbc04", txt: "ok this one hurt 😭", x: 91, y: 85, rot: -4, w: 16, at: 86.1 },
        ];
        return (
          <div style={{ position: "absolute", inset: 0, opacity: on }}>
            {CM.map((c, i) => { const co = clamp01((t - c.at) / 0.32); const pop = 0.9 + 0.1 * clamp01((t - c.at) / 0.42);
              return (
                <div key={i} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, transform: `translate(-50%,-50%) rotate(${c.rot}deg) scale(${pop})`, opacity: co, width: u * c.w }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: u * 0.8, background: "rgba(18,21,29,0.95)", border: `${u * 0.09}px solid #2a3145`, borderRadius: u * 0.9, padding: `${u * 0.9}px ${u * 1.1}px`, boxShadow: `0 ${u * 1.0}px ${u * 2.4}px rgba(0,0,0,0.6)` }}>
                    <div style={{ width: u * 2.4, height: u * 2.4, borderRadius: "50%", background: c.col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.2, color: RAISIN }}>{c.a}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: u * 0.6, marginBottom: u * 0.2 }}>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: SILVER_MID }}>{c.h}</span>
                        <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 0.8, color: "#8a93a8" }}>{i + 1}h</span>
                      </div>
                      <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: u * 1.15, lineHeight: 1.3, color: SILVER }}>{c.txt}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* small YouTube tag to anchor the context */}
            <div style={{ position: "absolute", left: "6%", top: "8%", display: "inline-flex", alignItems: "center", gap: u * 0.7, background: "rgba(18,21,29,0.9)", border: `${u * 0.08}px solid #2a3145`, borderRadius: u * 0.6, padding: `${u * 0.5}px ${u * 1.0}px`, opacity: clamp01((t - 82.7) / 0.4) }}>
              <Img src={staticFile("logos/youtube.svg")} style={{ width: u * 1.6, height: u * 1.6 }} />
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.14em", color: SILVER_SOFT }}>COMMENTS · 1.2K</span>
            </div>
          </div>
        ); })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default Act1;
