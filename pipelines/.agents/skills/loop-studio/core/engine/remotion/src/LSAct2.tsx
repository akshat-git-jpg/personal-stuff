/**
 * LSAct2 — "IT WRITES CODE" (0–75.5s). The claim → the template indictment → the turn (template
 * shatters into a self-writing editor) → super custom → one window makes anything → the transcript
 * playhead → any niche / FULL CREATIVITY → the US-map-to-computer showpiece → the old way (412
 * keyframes) → watch it write/look/highlight/render → the register turn (IT READS FIRST, light) →
 * the ONE thing distilled → the storyline rail. Traveling clip-card carries CUT ✓ then earns CODE ✓.
 * Footage plays from 0 (same take → lip sync). Voice only; SFX + music mixed in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO,
  SK, skf, FootageLayer, Marker, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";
import { Win } from "./bb2/concepts";

const FPS = 30;

/* ---------------- shared helpers (Act1 patterns) ---------------- */
/* GLOBAL TEXT RULE — every headline lives BOTTOM-MIDDLE, one exact placement across all scenes,
   clear of the footage head. SANS 800 uppercase, u*2.9, one lime Marker word allowed. */
const H1: React.FC<{ u: number; t: number; children: React.ReactNode; in0: number; out?: number; ink?: string }> = ({ u, t, children, in0, out, ink = SILVER }) => (
  <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.9, letterSpacing: "-0.02em", color: ink, textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.7)", opacity: clamp01((t - in0) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

const Eyebrow: React.FC<{ u: number; x: number; y: number; text: string; o: number; ink?: string; center?: boolean }> = ({ u, x, y, text, o, ink = SILVER_SOFT, center }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: center ? "translate(-50%,-50%)" : "none", display: "inline-flex", alignItems: "center", gap: u * 0.8, whiteSpace: "nowrap", opacity: o }}>
    {/* on the light worksheet the swatch is raisin — lime-on-white is illegal */}
    <span style={{ width: u * 0.85, height: u * 0.85, background: ink === RAISIN ? RAISIN : LIME }} />
    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.2em", color: ink }}>{text}</span>
  </div>
);

const GreyChip: React.FC<{ u: number; text: string; o: number; sc?: number }> = ({ u, text, o, sc = 1 }) => (
  <div style={{ display: "inline-block", opacity: o, transform: `scale(${sc})` }}>
    <div style={{ background: "#1a1f2b", border: `${u * 0.11}px solid #6a7288`, borderRadius: u * 0.4, padding: `${u * 0.35}px ${u * 0.9}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.08em", color: "#9aa4b8", whiteSpace: "nowrap" }}>{text}</div>
  </div>
);

/* ---------------- the traveling clip-card (from Act 1's CUT station) ----------------
   A small filmstrip card. Ticks ride the top edge as lime badges: CUT ✓ (always) + CODE ✓ (earned
   in beat 10). Light variant for the paper register. */
const ClipCard: React.FC<{ x: number; y: number; u: number; s?: number; rot?: number; o?: number; code?: number; light?: boolean; bob?: number; sqx?: number; sqy?: number }> = ({ x, y, u, s = 1, rot = 0, o = 1, code = 0, light, bob = 0, sqx = 1, sqy = 1 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) translateY(${bob}px) rotate(${rot}deg) scale(${s * sqx},${s * sqy})`, opacity: o }}>
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.4}px,${u * 0.4}px)`, opacity: 0.65 }} />
      <div style={{ position: "relative", width: u * 10, background: light ? WHITE : "#12151d", border: `${u * 0.13}px solid ${light ? RAISIN : SILVER}`, borderRadius: u * 0.5, padding: u * 0.45, boxShadow: `0 ${u * 0.7}px ${u * 1.8}px rgba(0,0,0,${light ? 0.22 : 0.55})` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: u * 0.28 }}>
          {Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ width: u * 0.5, height: u * 0.5, borderRadius: u * 0.12, background: light ? "#c8cdd2" : "#2a3145" }} />)}
        </div>
        <div style={{ display: "flex", gap: u * 0.3 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, height: u * 2.5, background: light ? "#eef1f2" : "#1b2130", borderRadius: u * 0.2, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: u * 0.22, padding: `0 ${u * 0.28}px ${u * 0.28}px` }}>
              {[0.5, 0.75, 0.6].map((h, j) => <span key={j} style={{ width: u * 0.5, height: `${Math.max(14, h * 100 - i * 9)}%`, background: light ? "#9aa4a8" : SILVER_MID }} />)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: u * 0.28 }}>
          {Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ width: u * 0.5, height: u * 0.5, borderRadius: u * 0.12, background: light ? "#c8cdd2" : "#2a3145" }} />)}
        </div>
      </div>
      {/* station ticks — lime badges riding the top edge */}
      <div style={{ position: "absolute", left: u * 0.45, top: 0, transform: "translateY(-55%)", display: "flex", gap: u * 0.4, whiteSpace: "nowrap" }}>
        <span style={{ background: LIME, color: RAISIN, borderRadius: u * 0.28, padding: `${u * 0.16}px ${u * 0.5}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 0.82, letterSpacing: "0.06em", boxShadow: `0 ${u * 0.25}px ${u * 0.7}px rgba(0,0,0,0.35)` }}>CUT ✓</span>
        {code > 0 && <span style={{ background: LIME, color: RAISIN, borderRadius: u * 0.28, padding: `${u * 0.16}px ${u * 0.5}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 0.82, letterSpacing: "0.06em", transform: `scale(${0.5 + 0.5 * code})`, opacity: code, boxShadow: `0 ${u * 0.25}px ${u * 0.7}px rgba(0,0,0,0.35)` }}>CODE ✓</span>}
      </div>
    </div>
  </div>
);

/* ---------------- editor window with self-typing code ---------------- */
type CodeLn = { s: string; at: number; fire?: boolean };
const EdWin: React.FC<{ u: number; w: number; title: string; children: React.ReactNode }> = ({ u, w, title, children }) => (
  <div style={{ position: "relative", width: u * w }}>
    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.9, transform: `translate(${u * 0.6}px,${u * 0.6}px)`, opacity: 0.55 }} />
    <div style={{ position: "relative", background: "#12151d", border: `${u * 0.14}px solid ${SILVER_MID}`, borderRadius: u * 0.9, overflow: "hidden", boxShadow: `0 ${u * 1.4}px ${u * 3.4}px rgba(0,0,0,0.6)` }}>
      <div style={{ height: u * 2.6, background: "#181c28", borderBottom: `${u * 0.09}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.55, padding: `0 ${u * 1.1}px` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.72, height: u * 0.72, borderRadius: "50%", background: "#3a4256" }} />)}
        <span style={{ marginLeft: u * 0.5, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.04em", color: SILVER_SOFT }}>{title}</span>
      </div>
      {children}
    </div>
  </div>
);

const CodeBody: React.FC<{ u: number; t: number; lines: CodeLn[]; cps?: number; fz?: number }> = ({ u, t, lines, cps = 26, fz = 1.12 }) => (
  <div style={{ padding: `${u * 0.8}px ${u * 1.1}px`, display: "flex", flexDirection: "column" }}>
    {lines.map((ln, i) => {
      const started = t >= ln.at;
      const n = !started ? 0 : ln.fire ? ln.s.length : Math.floor((t - ln.at) * cps);
      const done = n >= ln.s.length;
      const pop = !started ? 0 : ln.fire ? clamp01((t - ln.at) / 0.2) : 1;
      const hot = ln.fire && started && t - ln.at < 0.5;
      return (
        <div key={i} style={{ height: u * 1.8, display: "flex", gap: u * 0.8, alignItems: "center", opacity: started ? pop : 1, transform: `translateY(${(1 - pop) * u * 0.7}px)` }}>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 0.9, color: "#4a5268", width: u * 1.1, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
          {started && (
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * fz, color: hot ? LIME : SILVER, whiteSpace: "pre" }}>
              {ln.s.slice(0, Math.max(0, n))}
              {!done && <span style={{ display: "inline-block", width: u * 0.5, height: u * 1.3, background: LIME, verticalAlign: "-12%", marginLeft: u * 0.1 }} />}
            </span>
          )}
        </div>
      );
    })}
  </div>
);

/* ---------------- mini rendered-frame thumbs (bar chart / map / node diagram) ---------------- */
const US_D = "M 5 6 L 20 5 L 36 5 L 42 9 L 46 6 L 51 10 L 56 6 L 62 3 L 66 1 L 68 5 L 66 9 L 67 13 L 64 17 L 66 20 L 63 24 L 65 28 L 62 31 L 61 35 L 63 39 L 67 47 L 69 54 L 66 53 L 62 45 L 59 40 L 52 40 L 48 42 L 44 40 L 42 44 L 38 42 L 36 52 L 32 45 L 28 40 L 22 37 L 15 32 L 9 28 L 6 22 L 8 14 L 4 10 Z";

const Thumb: React.FC<{ u: number; kind: "bars" | "map" | "nodes"; w?: number }> = ({ u, kind, w = 10.5 }) => (
  <div style={{ width: u * w, height: u * w * 0.62, background: "#12151d", border: `${u * 0.13}px solid ${SILVER_MID}`, borderRadius: u * 0.5, overflow: "hidden", boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {kind === "bars" && (
      <svg width={u * (w - 2)} height={u * (w * 0.62 - 1.6)} viewBox="0 0 100 60">
        <path d="M8 54 h84" stroke={SILVER_MID} strokeWidth={1.6} />
        {[26, 44, 34, 52, 40].map((h, i) => <rect key={i} x={12 + i * 16} y={54 - h} width={10} height={h} fill={i === 3 ? LIME : SILVER_MID} rx={1.5} />)}
      </svg>
    )}
    {kind === "map" && (
      <svg width={u * (w - 2)} height={u * (w * 0.62 - 1.6)} viewBox="-4 -6 108 68">
        <path d={US_D} fill="#232a3a" stroke={SILVER_MID} strokeWidth={2.2} strokeLinejoin="round" />
        {[[20, 16], [42, 22], [58, 18]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={3.4} fill={i === 1 ? LIME : SILVER} />)}
      </svg>
    )}
    {kind === "nodes" && (
      <svg width={u * (w - 2)} height={u * (w * 0.62 - 1.6)} viewBox="0 0 100 60">
        <path d="M26 18 L52 42 M52 42 L78 16 M52 42 L84 46" stroke={SILVER_MID} strokeWidth={1.6} />
        {[[26, 18], [78, 16], [84, 46]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={5.5} fill="#12151d" stroke={SILVER} strokeWidth={1.8} />)}
        <circle cx={52} cy={42} r={6.5} fill={LIME} />
      </svg>
    )}
  </div>
);

/* ---------------- the dot-laptop (beat 8 showpiece target) ---------------- */
const LAP_PTS: { x: number; y: number; power?: boolean }[] = (() => {
  const p: { x: number; y: number; power?: boolean }[] = [];
  for (let i = 0; i < 7; i++) p.push({ x: 20 + (60 * i) / 6, y: 4 });          // screen top L→R
  for (let i = 1; i <= 4; i++) p.push({ x: 80, y: 4 + (40 * i) / 5 });         // screen right T→B
  for (let i = 0; i < 7; i++) p.push({ x: 80 - (60 * i) / 6, y: 44 });         // screen bottom R→L
  for (let i = 1; i <= 4; i++) p.push({ x: 20, y: 44 - (40 * i) / 5 });        // screen left B→T
  for (let i = 0; i < 8; i++) p.push({ x: 15 + (70 * i) / 7, y: 53 });         // keyboard line
  for (let i = 0; i < 9; i++) p.push({ x: 8 + (84 * i) / 8, y: 61 });          // base line
  p.push({ x: 50, y: 48.5, power: true });                                     // power light, LAST
  return p;
})();

/* ---------------- the computer the atoms BUILD (beat 8 payoff → carried into beat 9) ----------------
   A clean premium laptop that resolves out of the converging atoms. Its screen shows SCENE CODE (the
   film's through-line) — NEVER a US map. Geometry matches the beat-8 atom-assembly targets exactly
   (same screen half-extents 12u × 7.2u, same base deck) so the flown atoms land ON its silhouette and
   the solid chrome resolves beneath them. `assembleGlow` is the lime pack-in flash as the atoms fuse. */
const AtomLaptop: React.FC<{ u: number; cx: number; cy: number; s: number; o?: number; powerLit?: number; assembleGlow?: number; screenW?: number }> = ({ u, cx, cy, s, o = 1, powerLit = 0, assembleGlow = 0, screenW = 24 }) => {
  const sw = u * screenW, sh = sw * 0.6;
  const CODE = [{ w: 9, lime: false }, { w: 13, lime: false }, { w: 7, lime: true }, { w: 11, lime: false }, { w: 6, lime: false }];
  return (
    <div style={{ position: "absolute", left: `${cx}%`, top: `${cy}%`, transform: `translate(-50%,-50%) scale(${s})`, opacity: o }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* screen (lime hard-offset, silver bezel, dark glass, scene-code glowing inside) */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.7, transform: `translate(${u * 0.5}px,${u * 0.5}px)`, opacity: 0.4 }} />
          {/* the pack-in glow as the atoms fuse into the shell */}
          {assembleGlow > 0 && <div style={{ position: "absolute", inset: -u * 1.3, borderRadius: u * 1.4, border: `${u * 0.12}px solid ${LIME}`, boxShadow: `0 0 ${u * 2.8}px ${LIME}, inset 0 0 ${u * 1.6}px ${LIME}88`, opacity: assembleGlow }} />}
          <div style={{ position: "relative", width: sw, height: sh, background: "#0d1017", border: `${u * 0.2}px solid ${SILVER}`, borderRadius: u * 0.7, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.6)` }}>
            {/* powered lime wash */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 72% 92% at 28% 26%, ${LIME}22, transparent 68%)` }} />
            {/* faint scene code — the screen is CODE, not a map */}
            <div style={{ position: "absolute", inset: 0, padding: `${u * 1.5}px ${u * 1.9}px`, display: "flex", flexDirection: "column", justifyContent: "center", gap: u * 0.85 }}>
              {CODE.map((ln, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 0.7 }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, color: "#39415a", width: u * 1.0, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ height: u * 0.7, width: u * ln.w, borderRadius: u * 0.12, background: ln.lime ? LIME : "#2c3348" }} />
                  {i === CODE.length - 1 && <span style={{ width: u * 0.4, height: u * 1.0, background: LIME, boxShadow: `0 0 ${u * 0.6}px ${LIME}` }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* base / keyboard deck */}
        <div style={{ position: "relative", width: sw * 1.22, height: u * 1.35, background: `linear-gradient(${SILVER_SOFT}, ${SILVER_MID})`, borderRadius: `0 0 ${u * 0.9}px ${u * 0.9}px`, marginTop: u * 0.18, boxShadow: `0 ${u * 0.5}px ${u * 1.2}px rgba(0,0,0,0.5)` }}>
          <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: sw * 0.17, height: u * 0.3, background: SILVER_MID, borderRadius: `0 0 ${u * 0.3}px ${u * 0.3}px` }} />
          {powerLit > 0 && <div style={{ position: "absolute", right: u * 0.7, top: "50%", transform: "translateY(-50%)", width: u * 0.55, height: u * 0.55, borderRadius: "50%", background: LIME, boxShadow: `0 0 ${u * 1.0}px ${LIME}`, opacity: powerLit }} />}
        </div>
      </div>
    </div>
  );
};

/* static mini dot-laptop (beat 10 render thumb) */
const DotLapSVG: React.FC<{ u: number; w: number }> = ({ u, w }) => (
  <svg width={u * w} height={u * w * 0.66} viewBox="0 0 100 66">
    <rect x={20} y={5} width={60} height={40} fill={`${SILVER}10`} stroke={SILVER} strokeWidth={0.7} opacity={0.4} />
    <path d="M15 54 H85 M8 62 H92" stroke={SILVER} strokeWidth={0.7} opacity={0.4} />
    {LAP_PTS.map((p, i) => <circle key={i} cx={p.x} cy={p.y + 1} r={1.7} fill={p.power ? LIME : SILVER} />)}
  </svg>
);

/* ---------------- dull grey template frame (beat 2) ---------------- */
const TemplateFrame: React.FC<{ u: number; full?: boolean; children?: React.ReactNode }> = ({ u, full, children }) => (
  <div style={{ position: "relative", width: u * 26, height: u * 15, border: `${u * 0.15}px dashed ${SILVER_MID}`, borderRadius: u * 0.6, background: "rgba(18,21,29,0.82)", boxShadow: `0 ${u * 0.8}px ${u * 2.2}px rgba(0,0,0,0.45)` }}>
    {/* TITLE HERE placeholder bar */}
    <div style={{ position: "absolute", left: "15%", top: u * 1.1, width: "70%", height: u * 2.1, border: `${u * 0.1}px dashed ${SILVER_MID}`, borderRadius: u * 0.3, background: "#2c3242", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.14em", color: SILVER_MID }}>TITLE HERE</div>
    {full && (
      <>
        {/* confetti placeholders — dull grey clusters */}
        {[3.2, 20.4].map((cx, k) => (
          <svg key={k} width={u * 2.6} height={u * 2.2} viewBox="0 0 26 22" style={{ position: "absolute", left: u * cx, top: u * 3.9 }}>
            {[[4, 6, 20], [12, 3, -14], [20, 7, 30], [8, 14, -25], [17, 15, 12]].map(([x, y, r], i) => <rect key={i} x={x} y={y} width={3.4} height={2.1} fill={SILVER_MID} opacity={0.75} transform={`rotate(${r} ${x} ${y})`} />)}
          </svg>
        ))}
        {/* subscribe placeholder plate */}
        <div style={{ position: "absolute", right: u * 1.1, bottom: u * 1.0, border: `${u * 0.1}px dashed ${SILVER_MID}`, borderRadius: u * 0.8, background: "#2c3242", padding: `${u * 0.35}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, letterSpacing: "0.12em", color: SILVER_MID }}>SUBSCRIBE</div>
        {/* the clip slot — wrong aspect on purpose; clips whatever lands in it */}
        <div style={{ position: "absolute", left: "50%", top: "56%", transform: "translate(-50%,-50%)", width: u * 8.4, height: u * 6.8, border: `${u * 0.12}px dashed ${SILVER_MID}`, borderRadius: u * 0.35, overflow: "hidden" }}>
          <span style={{ position: "absolute", left: u * 0.4, top: u * 0.25, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.78, letterSpacing: "0.1em", color: SILVER_MID, zIndex: 2 }}>CLIP</span>
          {children}
        </div>
      </>
    )}
  </div>
);

/* glyph shards for the beat-3 shatter */
const GLYPHS = ["{", "}", "=", "<", ">", "/", "(", ")", "[", "]", ";", "=>", "==", ":", "&&", "+"];

/* ---------------- BEAT 7: three FULL-SCREEN niche columns (fitness / finance / cooking) ----------------
   Each column ~1/3 of the frame, edge to edge, tall, with its own full-blown live animation. Silver/steel
   throughout so lime stays the single accent (one lime header + purposeful lime accents per column). */
const ECG_PTS = (() => {
  const p: string[] = [];
  for (let k = 0; k < 11; k++) {
    const x = k * 20;
    p.push(`${x},22`, `${x + 7},22`, `${x + 9},17`, `${x + 10},22`, `${x + 11},6`, `${x + 12},34`, `${x + 13},20`, `${x + 14.5},23`, `${x + 16},22`, `${x + 20},22`);
  }
  return p.join(" ");
})();

const NicheIcon: React.FC<{ u: number; kind: "fitness" | "finance" | "cooking" }> = ({ u, kind }) => (
  <svg width={u * 2.1} height={u * 2.1} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
    {kind === "fitness" && <path d="M8 14C8 14 1.5 9.6 1.5 5.2C1.5 2.9 3.3 1.4 5.2 1.4C6.5 1.4 7.6 2.2 8 3.2C8.4 2.2 9.5 1.4 10.8 1.4C12.7 1.4 14.5 2.9 14.5 5.2C14.5 9.6 8 14 8 14Z" fill={RAISIN} />}
    {kind === "finance" && <g fill={RAISIN}><rect x="1.5" y="8" width="3" height="6.5" rx="0.6" /><rect x="6.5" y="3" width="3" height="11.5" rx="0.6" /><rect x="11.5" y="6" width="3" height="8.5" rx="0.6" /></g>}
    {kind === "cooking" && <g fill={RAISIN}><path d="M2 6.6H14V12C14 13.1 13.1 14 12 14H4C2.9 14 2 13.1 2 12Z" /><rect x="0.4" y="7.4" width="2.2" height="2.2" rx="1.1" /><rect x="13.4" y="7.4" width="2.2" height="2.2" rx="1.1" /><rect x="4.5" y="2.2" width="1.4" height="3.6" rx="0.7" /><rect x="7.3" y="1.5" width="1.4" height="4.3" rx="0.7" /><rect x="10.1" y="2.2" width="1.4" height="3.6" rx="0.7" /></g>}
  </svg>
);

const NicheCol: React.FC<{ u: number; t: number; cx: number; at: number; kind: "fitness" | "finance" | "cooking"; name: string; dimv: number }> = ({ u, t, cx, at, kind, name, dimv }) => {
  const o = clamp01((t - at) / 0.4);
  if (o <= 0) return null;
  const pe = EASE_OVER(clamp01((t - at) / 0.6));
  const lt = t - at;
  const CW = u * 30, CH = u * 43;
  const CO = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE };
  const steel = "#20263a", panelLine = "#2a3145", inkDim = SILVER_MID;
  return (
    <div style={{ position: "absolute", left: `${cx}%`, top: "50%", transform: `translate(-50%,-50%) translateY(${(1 - pe) * u * 3.4}px) scale(${lerp(0.9, 1, pe)})`, opacity: o * dimv }}>
      <div style={{ position: "relative", width: CW }}>
        <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.95, transform: `translate(${u * 0.55}px,${u * 0.55}px)`, opacity: 0.28 }} />
        <div style={{ position: "relative", width: CW, height: CH, background: "linear-gradient(180deg,#151a27,#0d1017)", border: `${u * 0.13}px solid ${SILVER_MID}`, borderRadius: u * 0.95, overflow: "hidden", boxShadow: `0 ${u * 1.4}px ${u * 3.2}px rgba(0,0,0,0.55)`, display: "flex", flexDirection: "column" }}>
          {/* lime header — the one lime block per column */}
          <div style={{ height: u * 4.6, background: LIME, display: "flex", alignItems: "center", gap: u * 0.85, padding: `0 ${u * 1.5}px`, flexShrink: 0 }}>
            <NicheIcon u={u} kind={kind} />
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.0, letterSpacing: "0.01em", color: RAISIN }}>{name}</span>
          </div>
          {/* content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: u * 1.5, gap: u * 1.4 }}>
            {kind === "fitness" && (() => {
              const scroll = (lt * 20) % 20;
              const beatP = Math.pow(Math.max(0, Math.sin(lt * Math.PI * 2 * 1.9)), 6);
              const bpm = Math.round(146 + 7 * Math.sin(lt * 1.2));
              const reps = Math.max(0, Math.floor(interpolate(lt, [0.3, 3.4], [0, 32], CO)));
              const fillP = clamp01(reps / 32);
              const kcal = Math.floor(interpolate(lt, [0.3, 3.6], [0, 318], CO));
              return (
                <>
                  {/* live ECG monitor */}
                  <div style={{ position: "relative", height: u * 12, background: "#0b0e15", border: `${u * 0.09}px solid ${panelLine}`, borderRadius: u * 0.6, overflow: "hidden" }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <polyline points={ECG_PTS} fill="none" stroke={SILVER} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${-scroll} 0)`} />
                    </svg>
                    <div style={{ position: "absolute", right: u * 0.9, top: u * 0.8, display: "flex", alignItems: "center", gap: u * 0.5 }}>
                      <span style={{ width: u * 0.85, height: u * 0.85, borderRadius: "50%", background: LIME, boxShadow: `0 0 ${u * 1.1}px ${LIME}`, transform: `scale(${1 + 0.6 * beatP})`, opacity: 0.55 + 0.45 * beatP }} />
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: SILVER, fontVariantNumeric: "tabular-nums" }}>{bpm}<span style={{ color: inkDim, fontSize: u * 0.8, marginLeft: u * 0.25 }}>BPM</span></span>
                    </div>
                  </div>
                  {/* counting reps + filling bar */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: u * 1.1 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.18em", color: inkDim }}>SET 3 / 4</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: u * 0.7 }}>
                      <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 5.2, lineHeight: 1, color: SILVER, fontVariantNumeric: "tabular-nums" }}>{reps}</span>
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, letterSpacing: "0.12em", color: inkDim }}>REPS</span>
                    </div>
                    <div style={{ height: u * 1.05, background: steel, borderRadius: u * 0.5, overflow: "hidden" }}>
                      <div style={{ width: `${fillP * 100}%`, height: "100%", background: `linear-gradient(90deg,${SILVER_MID},${SILVER})`, borderRight: `${u * 0.28}px solid ${LIME}` }} />
                    </div>
                  </div>
                  {/* stat row */}
                  <div style={{ display: "flex", gap: u * 1.0 }}>
                    {[["KCAL", `${kcal}`], ["TIME", "18:04"]].map(([l, v], i) => (
                      <div key={i} style={{ flex: 1, background: "#12151d", border: `${u * 0.08}px solid ${panelLine}`, borderRadius: u * 0.5, padding: `${u * 0.7}px ${u * 0.9}px` }}>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.14em", color: inkDim }}>{l}</div>
                        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.7, color: SILVER, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {kind === "finance" && (() => {
              const CD = [
                { x: 9, o: 46, c: 40, hi: 37, lo: 49 }, { x: 22, o: 41, c: 44, hi: 38, lo: 47 },
                { x: 35, o: 44, c: 33, hi: 30, lo: 46 }, { x: 48, o: 34, c: 29, hi: 26, lo: 37 },
                { x: 61, o: 29, c: 33, hi: 26, lo: 36 }, { x: 74, o: 33, c: 22, hi: 19, lo: 35 },
                { x: 87, o: 22, c: 15, hi: 12, lo: 24 },
              ];
              const lineDraw = clamp01((lt - 0.7) / 1.6);
              const pct = interpolate(lt, [0.5, 3.2], [0, 12.4], CO);
              const bal = Math.floor(interpolate(lt, [0.5, 3.4], [43120, 48920], CO));
              return (
                <>
                  {/* candlesticks drawing in + a rising trend line */}
                  <div style={{ position: "relative", flex: 1, background: "#0b0e15", border: `${u * 0.09}px solid ${panelLine}`, borderRadius: u * 0.6, overflow: "hidden" }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
                      {[15, 30, 45].map((gy) => <line key={gy} x1="4" y1={gy} x2="96" y2={gy} stroke={panelLine} strokeWidth={0.5} />)}
                      {CD.map((d, k) => {
                        const dp = clamp01((lt - (0.2 + k * 0.13)) / 0.28);
                        if (dp <= 0) return null;
                        const up = d.c < d.o;
                        const bt = Math.min(d.o, d.c), bb = Math.max(d.o, d.c), cyv = (bt + bb) / 2;
                        return (
                          <g key={k} opacity={dp} transform={`translate(${d.x} ${cyv}) scale(1 ${dp}) translate(${-d.x} ${-cyv})`}>
                            <line x1={d.x} y1={d.hi} x2={d.x} y2={d.lo} stroke={SILVER_MID} strokeWidth={1} />
                            <rect x={d.x - 3.4} y={bt} width={6.8} height={Math.max(1.4, bb - bt)} rx={0.6} fill={up ? SILVER : steel} stroke={SILVER_MID} strokeWidth={0.9} />
                          </g>
                        );
                      })}
                      <path d="M4,47 Q26,41 46,32 T96,13" fill="none" stroke={LIME} strokeWidth={1.7} strokeLinecap="round" strokeDasharray={140} strokeDashoffset={140 * (1 - lineDraw)} />
                      <circle cx={96} cy={13} r={2.1} fill={LIME} opacity={clamp01((lineDraw - 0.85) / 0.15)} />
                    </svg>
                  </div>
                  {/* ticking % + balance */}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.16em", color: inkDim }}>TODAY</div>
                      <div style={{ display: "flex", alignItems: "center", gap: u * 0.45 }}>
                        <span style={{ width: 0, height: 0, borderLeft: `${u * 0.55}px solid transparent`, borderRight: `${u * 0.55}px solid transparent`, borderBottom: `${u * 0.9}px solid ${LIME}` }} />
                        <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 2.7, color: LIME, fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.16em", color: inkDim }}>BALANCE</div>
                      <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.9, color: SILVER, fontVariantNumeric: "tabular-nums" }}>${bal.toLocaleString("en-US")}</div>
                    </div>
                  </div>
                </>
              );
            })()}

            {kind === "cooking" && (() => {
              const ring = clamp01(interpolate(lt, [0.3, 3.6], [0.12, 0.82], CO));
              const secs = Math.round(interpolate(lt, [0.3, 3.8], [272, 236], CO));
              const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
              const C = 2 * Math.PI * 15;
              const ITEMS = [["Flour", "300 g"], ["Butter", "120 g"], ["Sugar", "90 g"], ["Eggs", "2"], ["Vanilla", "1 tsp"]];
              return (
                <>
                  {/* the timer, ticking down + a filling progress ring */}
                  <div style={{ display: "flex", alignItems: "center", gap: u * 1.4 }}>
                    <svg width={u * 8.4} height={u * 8.4} viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="15" fill="none" stroke={steel} strokeWidth="3.4" />
                      <circle cx="20" cy="20" r="15" fill="none" stroke={LIME} strokeWidth="3.4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform="rotate(-90 20 20)" />
                    </svg>
                    <div>
                      <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 3.0, color: SILVER, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{mm}:{ss}</div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, letterSpacing: "0.16em", color: inkDim, marginTop: u * 0.4 }}>BAKE TIMER</div>
                    </div>
                  </div>
                  <div style={{ height: u * 0.08, background: panelLine }} />
                  {/* ingredients checking off, one by one */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: u * 1.15 }}>
                    {ITEMS.map(([nm, qty], k) => {
                      const ck = clamp01((lt - (0.6 + k * 0.4)) / 0.25);
                      const on2 = ck > 0.5;
                      return (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: u * 0.95 }}>
                          <span style={{ width: u * 1.6, height: u * 1.6, borderRadius: u * 0.35, background: on2 ? LIME : "transparent", border: `${u * 0.12}px solid ${on2 ? LIME : SILVER_MID}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.1, color: RAISIN, flexShrink: 0, transform: `scale(${0.7 + 0.3 * EASE_OVER(ck)})` }}>{on2 ? "✓" : ""}</span>
                          <span style={{ flex: 1, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, color: on2 ? SILVER_MID : SILVER, textDecoration: on2 ? "line-through" : "none" }}>{nm}</span>
                          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.15, color: inkDim }}>{qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- BEAT 8: the atoms (dense dots tracing the EXACT US silhouette) ----------------
   US_DOTS = 197 tiny atoms whose normalized (nx,ny) positions were baked by rasterizing the real
   public/assets/us-map.svg to an occupancy grid and keeping a dense jittered fill INSIDE the mainland
   mask — so they follow the true continental-US form (West Coast, Texas, Florida, Maine, Great-Lakes
   notch), aligned to the same bounding box the SVG is drawn in. Third field = rest-lime flag (a sparse
   sprinkle; the rest energize to lime as they merge). */
const US_DOTS: [number, number, number][] = [
  [0.1195,0.0582,0],[0.1924,0.0627,0],[0.081,0.0778,0],[0.1054,0.0957,0],[0.1509,0.0882,0],[0.1994,0.1184,0],
  [0.2154,0.0742,0],[0.2666,0.0889,0],[0.3099,0.0864,0],[0.4301,0.1249,0],[0.4964,0.1128,0],[0.518,0.0896,0],
  [0.9312,0.0793,1],[0.0564,0.1838,0],[0.0863,0.1597,0],[0.1272,0.1574,0],[0.1819,0.1475,0],[0.2394,0.178,0],
  [0.2659,0.1685,0],[0.2978,0.1582,0],[0.3434,0.1482,0],[0.4075,0.1416,0],[0.4355,0.1714,0],[0.464,0.1911,0],
  [0.505,0.1895,0],[0.5708,0.1657,0],[0.9078,0.1574,0],[0.9534,0.1511,0],[0.0709,0.26,0],[0.1157,0.2478,0],
  [0.1411,0.2394,0],[0.1776,0.2309,0],[0.2182,0.2415,0],[0.2889,0.2266,0],[0.3246,0.2067,0],[0.3695,0.2105,0],
  [0.3972,0.2306,0],[0.4472,0.2184,0],[0.4652,0.2595,0],[0.5086,0.2243,0],[0.5737,0.2519,0],[0.6107,0.2483,0],
  [0.6348,0.2063,0],[0.6753,0.2572,0],[0.8219,0.2619,0],[0.8696,0.2567,0],[0.9015,0.2207,0],[0.0384,0.2979,0],
  [0.0791,0.3092,0],[0.0989,0.3,0],[0.1355,0.2704,0],[0.1917,0.2856,0],[0.2234,0.2903,0],[0.2746,0.2864,0],
  [0.3241,0.3006,0],[0.3463,0.3174,0],[0.4067,0.2753,0],[0.4302,0.3218,0],[0.4632,0.3035,0],[0.5197,0.3111,0],
  [0.5571,0.3261,0],[0.6012,0.2913,1],[0.7016,0.3194,0],[0.8223,0.287,0],[0.8388,0.2888,0],[0.8932,0.3092,0],
  [0.0226,0.3591,0],[0.0613,0.3866,0],[0.0968,0.3565,0],[0.1287,0.387,0],[0.2014,0.3416,0],[0.2465,0.3686,0],
  [0.2692,0.348,0],[0.3128,0.3752,0],[0.3584,0.3957,0],[0.3839,0.3631,0],[0.4445,0.3902,0],[0.4738,0.3814,0],
  [0.5158,0.3728,0],[0.5576,0.3937,0],[0.601,0.3557,0],[0.6772,0.3847,0],[0.7167,0.3437,0],[0.7597,0.363,0],
  [0.8011,0.3536,0],[0.8604,0.3385,0],[0.0652,0.4573,0],[0.1065,0.4155,0],[0.1449,0.4238,0],[0.1981,0.4598,0],
  [0.2414,0.4567,1],[0.28,0.4249,0],[0.3196,0.4501,0],[0.3428,0.4595,0],[0.3961,0.4241,0],[0.4251,0.4627,1],
  [0.4948,0.4224,0],[0.5023,0.4156,0],[0.5508,0.4486,1],[0.6141,0.4548,0],[0.6297,0.4405,0],[0.687,0.4311,0],
  [0.7261,0.4291,1],[0.7707,0.4069,0],[0.8094,0.4623,0],[0.8464,0.455,0],[0.0608,0.4935,0],[0.1027,0.53,0],
  [0.1433,0.4909,0],[0.1924,0.5296,0],[0.241,0.5086,0],[0.2807,0.5224,0],[0.316,0.4868,0],[0.3563,0.527,1],
  [0.4092,0.5083,0],[0.4487,0.5057,0],[0.4731,0.5034,0],[0.5181,0.5066,0],[0.5681,0.5112,0],[0.5874,0.5259,0],
  [0.6304,0.4758,0],[0.6871,0.4934,0],[0.7224,0.5058,0],[0.7684,0.5125,0],[0.8243,0.5146,0],[0.1179,0.546,0],
  [0.1355,0.5917,0],[0.1808,0.546,0],[0.2126,0.5494,0],[0.2536,0.5546,0],[0.2951,0.5458,0],[0.3551,0.539,0],
  [0.4053,0.5828,0],[0.4389,0.5711,0],[0.4971,0.5869,0],[0.527,0.571,0],[0.5515,0.5452,0],[0.6027,0.588,0],
  [0.6611,0.5741,1],[0.697,0.5814,0],[0.7399,0.5886,0],[0.7596,0.555,0],[0.8281,0.5897,0],[0.8617,0.548,0],
  [0.0971,0.6195,0],[0.1526,0.6596,0],[0.1884,0.6475,0],[0.2118,0.6529,0],[0.2687,0.6221,0],[0.314,0.6446,0],
  [0.3495,0.6354,0],[0.3872,0.6298,0],[0.4332,0.6532,0],[0.4639,0.6183,0],[0.5352,0.6101,0],[0.5456,0.6155,0],
  [0.6189,0.6586,0],[0.6473,0.6334,0],[0.692,0.6565,0],[0.7352,0.6396,0],[0.7667,0.6447,0],[0.8134,0.6226,0],
  [0.198,0.6732,0],[0.2379,0.6789,0],[0.2643,0.6895,0],[0.3115,0.6748,0],[0.3713,0.7135,0],[0.3831,0.6839,0],
  [0.4378,0.7269,0],[0.4963,0.6838,0],[0.5211,0.6784,0],[0.5526,0.6858,0],[0.5894,0.672,0],[0.6349,0.7183,0],
  [0.6827,0.67,0],[0.7418,0.7258,0],[0.7572,0.6847,0],[0.3656,0.765,0],[0.4137,0.7494,0],[0.4318,0.7844,0],
  [0.4977,0.7473,0],[0.515,0.7412,0],[0.5743,0.7757,0],[0.6166,0.7563,0],[0.6448,0.738,0],[0.725,0.7566,0],
  [0.7608,0.7682,0],[0.4475,0.8133,1],[0.494,0.8083,0],[0.5285,0.8322,0],[0.5794,0.8186,1],[0.7986,0.836,0],
  [0.425,0.8938,1],[0.4888,0.8793,0],[0.7787,0.8751,0],[0.8166,0.8707,0],[0.4674,0.9635,0],
];

/* point on the perimeter of a rectangle, param tt in [0,1) → [lx,ly]. Used to lay atoms along the
   laptop's screen frame + base as they assemble. */
const rectPerim = (tt: number, x0: number, y0: number, x1: number, y1: number): [number, number] => {
  const w = x1 - x0, h = y1 - y0, per = 2 * (w + h);
  let dd = ((tt % 1) + 1) % 1 * per;
  if (dd < w) return [x0 + dd, y0]; dd -= w;
  if (dd < h) return [x1, y0 + dd]; dd -= h;
  if (dd < w) return [x1 - dd, y1]; dd -= w;
  return [x0, y1 - dd];
};

/* LAP_ASSEMBLE = where each atom lands to BUILD the laptop: most trace the screen frame + base deck
   (so the computer's silhouette is literally drawn by the atoms), some fill the screen, a few form the
   power light. One entry per atom, computed once. */
type LapRole = "sf" | "fill" | "deck" | "hinge" | "pwr";
const LAP_ASSEMBLE: { role: LapRole; a: number; b: number }[] = (() => {
  const out: { role: LapRole; a: number; b: number }[] = [];
  let s = 20240712;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const N = US_DOTS.length;
  const nSF = 80, nFill = 34, nDeck = 52, nHinge = 25; // remainder → pwr
  for (let i = 0; i < N; i++) {
    if (i < nSF) out.push({ role: "sf", a: i / nSF, b: 0 });
    else if (i < nSF + nFill) out.push({ role: "fill", a: rnd(), b: rnd() });
    else if (i < nSF + nFill + nDeck) out.push({ role: "deck", a: (i - (nSF + nFill)) / nDeck, b: rnd() });
    else if (i < nSF + nFill + nDeck + nHinge) out.push({ role: "hinge", a: (i - (nSF + nFill + nDeck)) / nHinge, b: 0 });
    else out.push({ role: "pwr", a: rnd(), b: rnd() });
  }
  return out;
})();

export const LSAct2: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();
  const CO = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: EASE };

  /* Panel choreography law: panel moves ONLY in the short gap AT a beat boundary, then holds. */
  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // beat 1: FULL
    { t: 3.3, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 4.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },  // beats 2–3: panel right
    { t: 14.8, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 15.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 4: FULL
    { t: 18.0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 18.8, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 }, // beat 5: panel
    { t: 20.8, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 21.5, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 6: hidden
    { t: 27.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 28.6, x: 74, y: 52, s: 0.92, dim: 1, fr: 1 },    // beat 7: footage hides — the three niches take the frame
    { t: 34.8, x: 74, y: 52, s: 0.92, dim: 1, fr: 1 },
    { t: 35.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 8: FULL — I point right; map overlays on my face
    { t: 44.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 45.2, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 }, // beat 9: panel
    { t: 51.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 51.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 10: hidden (replay spike)
    { t: 57.3, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 58.1, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beats 11–12: panel, STATIC (light)
    { t: 71.0, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 71.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 13: hidden closer
    { t: 75.5, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);
  /* LIGHT register: the rewind lands on the white worksheet at 59.4 and holds to the act's end */
  const liteWins: [number, number][] = [[58.95, 90]];
  const lite = Math.max(...liteWins.map(([a, b]) => clamp01((t - a) / 0.5) * (1 - clamp01((t - b) / 0.5))), 0);


  /* beat 10 rewind (the register turn's time travel) */
  const rw = interpolate(t, [58.6, 59.2], [0, 1], CO);

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("footage/ls_th2_voice.m4a")} />
      <DarkBg u={u} gridOpacity={sk.fr} />
      <LightBg u={u} opacity={lite} />

      {/* ============ GRAPHICS WORLD ============ */}
      <div style={{ position: "absolute", inset: 0, opacity: graphicsOn }}>

        {/* BEATS 2+3 — the template indictment → the shatter → the self-writing editor (3.64–15.16).
            Everything left of x=52%. The clip-card is docked, then dropped into the slot, letterboxed,
            then pops FREE as the templates shatter into glyphs that assemble scene.tsx. */}
        {t >= 3.64 && t < 15.2 && (() => {
          const on = clamp01((t - 3.9) / 0.4) * (1 - clamp01((t - 14.7) / 0.4));
          const tplIn = clamp01((t - 4.4) / 0.45);                    // front template draws on 'video'
          const clone1 = clamp01((t - 6.76) / 0.3), clone2 = clamp01((t - 6.92) / 0.3);
          const stamp = clamp01((t - 9.04) / 0.3);                    // TEMPLATE slam
          const shatter = t >= 10.44;                                  // beat 3 turn
          const tplGone = clamp01((t - 10.44) / 0.22);
          const shake = t > 10.3 && t < 10.46 ? Math.sin((t - 10.3) * 90) * u * 0.35 : 0;
          /* clip-card: dock → flight (7.74) → slot (letterboxed 8.6) → pops free (10.8) */
          const fly = clamp01((t - 7.74) / 0.6);
          const fe = EASE(fly);
          const boxed = clamp01((t - 8.6) / 0.3);
          const free = clamp01((t - 10.8) / 0.5);
          const fre = EASE_OVER(free);
          const bz = (a: number, c: number, b: number, p: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * c + p * p * b;
          const cardX = free > 0 ? lerp(26, 13, fre) : fly > 0 ? bz(10, 14, 26, fe) : 10;
          const cardY = free > 0 ? lerp(46.2, 22.5, fre) : fly > 0 ? bz(84, 58, 46.2, fe) : 84;
          const sqx = free > 0 ? lerp(0.8, 1, fre) : lerp(1, 0.8, boxed);
          const sqy = free > 0 ? lerp(0.84, 1, fre) : lerp(1, 0.84, boxed);
          const inSlot = fly >= 1 && free <= 0;
          /* editor + code (beat 3) */
          const edOn = clamp01((t - 11.46) / 0.25);
          const edPop = 0.94 + 0.06 * EASE_OVER(clamp01((t - 11.46) / 0.35));
          const L3: CodeLn[] = [
            { s: "export const Scene = () => {", at: 11.55 },
            { s: "  const t = frame / 30;", at: 12.0 },
            { s: "  return <Stage bg={RAISIN}>", at: 12.45 },
            { s: '    <Headline marker="CODE" />', at: 12.9 },
            { s: "    <BarChart data={reps} />", at: 13.7, fire: true },
            { s: "    <UsMap dots={40} />", at: 14.15, fire: true },
            { s: '    <Caption say="…said" />', at: 14.62, fire: true },
          ];
          /* NOTE 14.25: Claude is the AUTHOR — a big clay-orange mark writing the code. No token
             strip, no restating labels; the mark + the beam + the self-typing editor carry it. */
          const claudeOn = clamp01((t - 11.35) / 0.4);
          const claudePop = EASE_OVER(clamp01((t - 11.35) / 0.5));
          const writing = t >= 11.55 && t < 14.72;
          const beamPulse = ((t - 11.55) % 0.9) / 0.9; // a lime bead running Claude → editor
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {/* headline: beat 2 then beat 3 swaps in the same slot */}
              {t < 10.44 && <H1 u={u} t={t} in0={6.76} out={10.2}>THE <Marker u={u} t={t} at={6.9}>SAME</Marker> THING</H1>}
              {t >= 10.44 && <H1 u={u} t={t} in0={12.38}>IT WRITES <Marker u={u} t={t} at={12.5}>CODE</Marker></H1>}

              {/* the template stack (beat 2), shaking then gone at the shatter */}
              {tplGone < 1 && (
                <div style={{ position: "absolute", left: "26%", top: "44%", transform: `translate(-50%,-50%) translateX(${shake}px) scale(${1 + tplGone * 0.05})`, opacity: (1 - tplGone) }}>
                  {/* clones behind — same, same, same (a visible print run) */}
                  {clone2 > 0 && <div style={{ position: "absolute", left: u * 4.4, top: u * 4.8, opacity: 0.6 * clone2, transform: `scale(${0.9 + 0.1 * clone2}) rotate(1.2deg)` }}><TemplateFrame u={u} /></div>}
                  {clone1 > 0 && <div style={{ position: "absolute", left: u * 2.2, top: u * 2.4, opacity: 0.8 * clone1, transform: `scale(${0.94 + 0.06 * clone1}) rotate(0.6deg)` }}><TemplateFrame u={u} /></div>}
                  {/* front template with the slot */}
                  <div style={{ position: "relative", opacity: tplIn, clipPath: `inset(-4% ${(1 - tplIn) * 102 - 1}% -4% -1%)` }}>
                    <TemplateFrame u={u} full>
                      {inSlot && (
                        <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
                          <ClipCard x={0} y={0} u={u} s={0.92} sqx={sqx / 0.92 * 0.92} sqy={sqy} />
                          {/* letterbox bars squeezing the wrong-aspect card */}
                          <div style={{ position: "absolute", left: -u * 4.5, width: u * 9, top: -u * 3.6, height: u * 1.1 * boxed, background: "#1a1f2b", borderBottom: boxed > 0.1 ? `${u * 0.08}px solid ${SILVER_MID}` : "none" }} />
                          <div style={{ position: "absolute", left: -u * 4.5, width: u * 9, bottom: -u * 3.6, height: u * 1.1 * boxed, background: "#1a1f2b", borderTop: boxed > 0.1 ? `${u * 0.08}px solid ${SILVER_MID}` : "none" }} />
                        </div>
                      )}
                    </TemplateFrame>
                  </div>
                  {/* grey TEMPLATE stamp slamming across the stack */}
                  {stamp > 0 && (
                    <div style={{ position: "absolute", left: "50%", top: "48%", transform: `translate(-50%,-50%) rotate(-9deg) scale(${lerp(1.5, 1, EASE(stamp))})`, opacity: stamp, border: `${u * 0.32}px solid #9aa4b8`, borderRadius: u * 0.5, padding: `${u * 0.4}px ${u * 1.6}px`, background: "rgba(13,16,22,0.9)" }}>
                      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4, letterSpacing: "0.06em", color: "#9aa4b8", whiteSpace: "nowrap" }}>TEMPLATE</span>
                    </div>
                  )}
                </div>
              )}

              {/* the clip-card travelling (dock → slot handled above; flight + free states here) */}
              {!inSlot && t < 10.8 + 4.4 && (
                <ClipCard x={cardX} y={cardY} u={u} s={fly > 0 ? lerp(1, 0.92, fe) : 1} sqx={sqx} sqy={sqy} rot={free > 0 ? lerp(-6, 0, fre) : fly > 0 ? Math.sin(fe * Math.PI) * -5 : 0} bob={fly <= 0 ? amb.bob(0, 0.1) * u : 0} />
              )}

              {/* shatter: template becomes mono glyphs that assemble the editor */}
              {shatter && t < 12.4 && GLYPHS.map((g, i) => {
                const ang = (i / GLYPHS.length) * Math.PI * 2 + 0.6;
                const bp = clamp01((Math.min(t, 11.46) - 10.44) / 1.02);
                const bx = 26 + Math.cos(ang) * (10 + (i % 4) * 3) * bp;
                const by = 44 + Math.sin(ang) * (8 + (i % 3) * 3) * bp * 0.8 + 14 * bp * bp;
                const cv = EASE(clamp01((t - 11.46) / 0.38));
                const targ = { x: 26 + Math.cos(ang) * 15 * 0.55, y: 54 + Math.sin(ang) * 8 };
                const gx = lerp(bx, targ.x, cv), gy = lerp(by, targ.y, cv);
                const go = clamp01((t - 10.44) / 0.15) * (1 - clamp01((t - 11.75) / 0.25));
                if (go <= 0) return null;
                return <span key={i} style={{ position: "absolute", left: `${gx}%`, top: `${gy}%`, transform: `translate(-50%,-50%) rotate(${(i % 2 ? 1 : -1) * (40 + i * 14) * bp * (1 - cv)}deg)`, opacity: go, fontFamily: MONO, fontWeight: 700, fontSize: u * (1.6 + (i % 3) * 0.5), color: SILVER, textShadow: `0 0 ${u * 0.8}px rgba(0,0,0,0.7)` }}>{g}</span>;
              })}

              {/* the editor, self-typing (beat 3) */}
              {edOn > 0 && (
                <div style={{ position: "absolute", left: "26%", top: "54%", transform: `translate(-50%,-50%) scale(${edPop})`, opacity: edOn }}>
                  <EdWin u={u} w={32} title="scene.tsx">
                    <CodeBody u={u} t={t} lines={L3} />
                  </EdWin>
                </div>
              )}

              {/* NOTE 14.25 — Claude AUTHORS the code: a big clay-orange mark with a lime write-beam
                  running into the self-typing editor. No transcript strip / restating labels; the
                  causality (Claude → code) IS the visual. */}
              {claudeOn > 0 && (
                <div style={{ position: "absolute", inset: 0, opacity: claudeOn }}>
                  {/* the write-beam Claude → editor, with a lime bead streaming down it */}
                  {writing && (
                    <>
                      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                        <line x1={0.145 * W} y1={0.345 * H} x2={0.19 * W} y2={0.47 * H} stroke={LIME} strokeWidth={u * 0.12} strokeLinecap="round" opacity={0.5} />
                      </svg>
                      <span style={{ position: "absolute", left: `${lerp(14.5, 19, beamPulse)}%`, top: `${lerp(34.5, 47, beamPulse)}%`, transform: "translate(-50%,-50%)", width: u * 0.72, height: u * 0.72, borderRadius: "50%", background: LIME, boxShadow: `0 0 ${u * 1.3}px ${LIME}` }} />
                    </>
                  )}
                  {/* the author — big Claude mark in clay orange */}
                  <div style={{ position: "absolute", left: "14%", top: "27%", transform: `translate(-50%,-50%) scale(${claudePop})` }}>
                    {writing && <div style={{ position: "absolute", inset: -u * 1.8, borderRadius: "50%", background: "radial-gradient(circle, #D9775736 0%, transparent 68%)", transform: `scale(${amb.pulse(0, 0.06)})` }} />}
                    <div style={{ position: "relative", width: u * 8.6, height: u * 8.6, borderRadius: u * 2.0, background: "#12151d", border: `${u * 0.14}px solid #3a4256`, boxShadow: `0 ${u * 1.0}px ${u * 2.6}px rgba(0,0,0,0.55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Img src={staticFile("logos/claude.svg")} style={{ width: u * 5.4, height: u * 5.4 }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 5 — one window bursts three different frames (18.38–21.6) */}
        {t >= 18.3 && t < 21.7 && (() => {
          const exitP = clamp01((t - 21.1) / 0.45);
          const on = (1 - exitP);
          const grow = EASE(clamp01((t - 18.7) / 0.5));
          const ex = lerp(10, 24, grow), ey = lerp(81, 58, grow), es = lerp(0.4, 1, grow);
          const pulse = 1 + 0.06 * Math.sin(clamp01((t - 19.94) / 0.3) * Math.PI);
          const L5: CodeLn[] = [
            { s: "export const Scene = () => {", at: 0 },
            { s: "  const t = frame / 30;", at: 0 },
            { s: "  return <Anything…", at: 0 },
          ];
          const FAN = [
            { kind: "bars" as const, x: 11, y: 28, at: 19.94 },
            { kind: "map" as const, x: 24, y: 19, at: 20.24 },
            { kind: "nodes" as const, x: 37, y: 28, at: 20.54 },
          ];
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on, transform: `translateX(${-exitP * u * 10}px)` }}>
              <H1 u={u} t={t} in0={19.0}>IT CAN MAKE <Marker u={u} t={t} at={20.24}>ANYTHING</Marker></H1>
              {/* the editor, re-grown to hero of the left column */}
              <div style={{ position: "absolute", left: `${ex}%`, top: `${ey}%`, transform: `translate(-50%,-50%) scale(${es * pulse})` }}>
                <EdWin u={u} w={26} title="scene.tsx">
                  <CodeBody u={u} t={t} lines={L5} fz={1.05} />
                </EdWin>
              </div>
              {/* three mini frames fanning out of it */}
              {FAN.map((fr2, i) => {
                const p = clamp01((t - fr2.at) / 0.32);
                const pe = EASE_OVER(p);
                if (p <= 0) return null;
                const x = lerp(24, fr2.x, pe), y = lerp(50, fr2.y, pe);
                return (
                  <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${lerp(0.45, 1, pe)}) rotate(${(i - 1) * 2.2 * pe}deg)`, opacity: Math.min(1, p * 2.2) }}>
                    <Thumb u={u} kind={fr2.kind} />
                  </div>
                );
              })}
              {/* clip-card stays docked, dim */}
              <ClipCard x={8.5} y={86} u={u} s={0.72} o={0.5} bob={amb.bob(0.3, 0.1) * u} />
            </div>
          );
        })()}

        {/* BEAT 6 — the transcript strip + playhead: each word spawns its graphic (21.12–28.2) */}
        {t >= 21.05 && t < 28.55 && (() => {
          const on = clamp01((t - 21.3) / 0.4) * (1 - clamp01((t - 28.05) / 0.4));
          const WORDS = [
            { w: "ALL", at: 21.36 }, { w: "THE", at: 21.44 }, { w: "GRAPHICS", at: 21.54, g: "bars" },
            { w: "ARE", at: 21.96 }, { w: "SUPER", at: 22.2 }, { w: "CUSTOM", at: 22.64, g: "map" },
            { w: "ON", at: 23.1 }, { w: "EXACTLY", at: 23.38 }, { w: "WHAT", at: 23.9 },
            { w: "IS", at: 24.14 }, { w: "BEING", at: 24.38 }, { w: "SAID", at: 24.66, g: "cap" },
          ];
          const xs = WORDS.map((_, i) => 9 + i * 6.4);
          const ph = interpolate(t, [21.34, ...WORDS.map((w2) => w2.at).slice(1), 27.6], [7, ...xs.slice(1), 86], CO);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <H1 u={u} t={t} in0={22.9}>ON <Marker u={u} t={t} at={23.38}>EVERY</Marker> WORD</H1>
              {/* Playfair counterpoint */}
              {/* NOTE 27.67 — "like a human would": SHOW the human, don't write it. The real footage
                  head frames into the top-right (on-brand lime-offset panel) exactly on 'real editor'. */}
              {(() => {
                const hp = clamp01((t - 26.32) / 0.45) * (1 - clamp01((t - 27.98) / 0.28));
                if (hp <= 0) return null;
                const headSk: SK = { t: 0, x: 79, y: 25, s: 0.62, dim: 0, fr: 1 };
                return (
                  <div style={{ position: "absolute", inset: 0, opacity: hp }}>
                    <FootageLayer sk={headSk} u={u} src="footage/ls_th2.mp4" />
                  </div>
                );
              })()}
              {/* baseline + playhead */}
              <div style={{ position: "absolute", left: "6%", right: "12%", top: "76%", height: u * 0.09, background: SILVER_MID, opacity: 0.4 }} />
              <div style={{ position: "absolute", left: `${ph}%`, top: "71.5%", width: u * 0.18, height: u * 5.2, background: LIME, boxShadow: `0 0 ${u * 1.0}px ${LIME}aa` }} />
              {/* word tokens */}
              {WORDS.map((wd, i) => {
                const lit = t >= wd.at;
                return <span key={i} style={{ position: "absolute", left: `${xs[i]}%`, top: "76%", transform: `translate(-50%,-50%) scale(${lit ? 1.08 : 1})`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.28, letterSpacing: "0.04em", color: lit ? WHITE : SILVER_MID, background: RAISIN, padding: `${u * 0.22}px ${u * 0.4}px` }}>{wd.w}</span>;
              })}
              {/* micro-graphics tethered to their words */}
              {WORDS.map((wd, i) => {
                if (!wd.g) return null;
                const p = clamp01((t - wd.at) / 0.35);
                if (p <= 0) return null;
                const pe = EASE_OVER(p);
                return (
                  <div key={`g${i}`} style={{ position: "absolute", inset: 0 }}>
                    {/* hairline stem */}
                    <div style={{ position: "absolute", left: `${xs[i]}%`, top: "62.5%", width: u * 0.09, height: `${11 * p}%`, background: SILVER_MID, opacity: 0.65, transformOrigin: "top" }} />
                    <div style={{ position: "absolute", left: `${xs[i]}%`, top: "55%", transform: `translate(-50%,-50%) scale(${lerp(0.5, 1, pe)})`, opacity: Math.min(1, p * 2) }}>
                      {wd.g === "cap" ? (
                        <div style={{ background: "rgba(13,16,22,0.95)", border: `${u * 0.12}px solid ${SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.7}px ${u * 1.1}px`, boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.55)` }}>
                          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.25, color: WHITE, whiteSpace: "nowrap", textShadow: `0 ${u * 0.12}px ${u * 0.35}px rgba(0,0,0,0.8)` }}>…exactly what is being said</span>
                        </div>
                      ) : (
                        <Thumb u={u} kind={wd.g as "bars" | "map"} w={9.5} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* BEAT 7 — any niche, then FULL CREATIVITY (28.2–35.16) */}
        {t >= 28.2 && t < 35.5 && (() => {
          const on = clamp01((t - 28.6) / 0.4) * (1 - clamp01((t - 35.05) / 0.35));
          const dim = 1 - 0.6 * clamp01((t - 33.5) / 0.35);
          const plate = clamp01((t - 33.94) / 0.4);
          const settle = 1 + 0.02 * Math.sin(clamp01((t - 34.5) / 0.3) * Math.PI);
          /* NOTE 33.08 — three fine-tuned niches as FULL-SCREEN columns, edge to edge, each with its own
             full-blown live animation. The niche changes, the craft doesn't. Silver/steel; one lime header
             per column keeps lime the single accent. Footage hides for this beat (SKF dim=1). */
          const COLS = [
            { name: "FITNESS", at: 30.16, cx: 17.5, kind: "fitness" as const },
            { name: "FINANCE", at: 30.88, cx: 50, kind: "finance" as const },
            { name: "COOKING", at: 31.44, cx: 82.5, kind: "cooking" as const },
          ];
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {COLS.map((c, i) => <NicheCol key={i} u={u} t={t} cx={c.cx} at={c.at} kind={c.kind} name={c.name} dimv={dim} />)}
              {/* the mode switch: FULL CREATIVITY stat plate, centered over the three columns */}
              {plate > 0 && (
                <div style={{ position: "absolute", left: "50%", top: "47%", transform: `translate(-50%,-50%) rotate(-1.2deg) scale(${settle})` }}>
                  <div style={{ clipPath: `inset(-8% ${(1 - EASE(plate)) * 103 - 1}% -8% -2%)` }}>
                    <div style={{ background: LIME, padding: `${u * 0.9}px ${u * 2.0}px`, borderRadius: u * 0.4, boxShadow: `${u * 0.55}px ${u * 0.55}px 0 rgba(15,18,26,0.92), 0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.5)` }}>
                      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 4.2, letterSpacing: "-0.02em", color: RAISIN, whiteSpace: "nowrap" }}>FULL CREATIVITY</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 9 — the flex ("I can do that") vs the keyframe nightmare (44.88–51.38). The finished
            map-computer from beat 8 shrinks to the upper-left with a one-gesture lime tick; the grey
            NLE timeline clogs with 412 by-hand keyframes beside it. Panel: face right, graphics ≤52%. */}
        {t >= 44.8 && t < 51.5 && (() => {
          const b9 = clamp01((t - 46.9) / 0.4) * (1 - clamp01((t - 51.0) / 0.35));
          const kf = Math.floor(interpolate(t, [49.96, 50.45], [0, 412], CO));
          const tick = clamp01((t - 46.22) / 0.3);
          const lcx = interpolate(t, [45.2, 45.95], [28, 15], CO);   // carried from beat 8 → upper-left
          const lcy = interpolate(t, [45.2, 45.95], [46, 27], CO);
          const ls = interpolate(t, [45.2, 45.95], [1, 0.42], CO);
          const lo = clamp01((t - 44.85) / 0.4);
          return (
            <div style={{ position: "absolute", inset: 0 }}>
              {/* the finished atom-built computer carried straight from beat 8, shrinking to the upper-left */}
              <AtomLaptop u={u} cx={lcx} cy={lcy} s={ls} o={lo} powerLit={1} />
              {/* the one-gesture tick — done, in a single move */}
              {tick > 0 && (
                <div style={{ position: "absolute", left: "20.5%", top: "20.5%", transform: `translate(-50%,-50%) scale(${0.5 + 0.5 * EASE_OVER(tick)})`, opacity: tick }}>
                  <div style={{ width: u * 2.5, height: u * 2.5, borderRadius: "50%", background: LIME, color: RAISIN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.4, boxShadow: `0 ${u * 0.4}px ${u * 1.2}px rgba(0,0,0,0.5)` }}>✓</div>
                </div>
              )}
              {/* beat 9 headline + counter row (panel: left of 52%) */}
              {b9 > 0 && (
                <div style={{ position: "absolute", inset: 0, opacity: b9 }}>
                  <H1 u={u} t={t} in0={47.64}>THE <Marker u={u} t={t} at={47.8}>OLD</Marker> WAY</H1>
                  <div style={{ position: "absolute", left: "6%", top: "50%", display: "flex", alignItems: "center", gap: u * 1.2, opacity: clamp01((t - 49.96) / 0.3) }}>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.06em", color: SILVER, fontVariantNumeric: "tabular-nums" }}>KEYFRAMES: <span style={{ color: "#9aa4b8" }}>{kf}</span></span>
                    <GreyChip u={u} text="BY HAND" o={clamp01((t - 50.76) / 0.25)} sc={0.7 + 0.3 * EASE_OVER(clamp01((t - 50.76) / 0.3))} />
                  </div>
                  {/* the grey NLE timeline, clogging with keyframe diamonds */}
                  {(() => {
                    const wIn = clamp01((t - 47.18) / 0.45);
                    return (
                      <div style={{ position: "absolute", left: "27%", top: "70%", transform: `translate(-50%,-50%) translateY(${(1 - EASE(wIn)) * u * 2}px)`, opacity: wIn }}>
                        <div style={{ width: u * 36, background: "#161a24", border: `${u * 0.13}px solid #6a7288`, borderRadius: u * 0.7, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.55)` }}>
                          <div style={{ height: u * 2.1, background: "#1d2230", borderBottom: `${u * 0.08}px solid #2a3145`, display: "flex", alignItems: "center", gap: u * 0.5, padding: `0 ${u * 1.0}px` }}>
                            {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.6, height: u * 0.6, borderRadius: "50%", background: "#3a4256" }} />)}
                            <span style={{ marginLeft: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, color: "#9aa4b8" }}>timeline</span>
                          </div>
                          <div style={{ position: "relative", padding: `${u * 0.6}px ${u * 0.9}px` }}>
                            {["V1", "V2", "A1", "A2"].map((lane, L) => (
                              <div key={lane} style={{ position: "relative", height: u * 2.0, marginBottom: L < 3 ? u * 0.45 : 0, background: "#1b2130", border: `${u * 0.07}px solid #2a3145`, borderRadius: u * 0.3, display: "flex", alignItems: "center" }}>
                                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, color: "#7a849c", paddingLeft: u * 0.5, flexShrink: 0 }}>{lane}</span>
                                {Array.from({ length: 30 }).map((_, s2) => {
                                  const born = 49.96 + (s2 * 4 + L) * 0.0085;
                                  const dp = clamp01((t - born) / 0.22);
                                  if (dp <= 0) return null;
                                  return <span key={s2} style={{ position: "absolute", left: `${7 + s2 * 3.1}%`, top: "50%", width: u * 0.62, height: u * 0.62, background: "#9aa4b8", transform: `translate(-50%,-50%) translateY(${(1 - EASE(dp)) * -u * 3}px) rotate(45deg)`, opacity: dp }} />;
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 10 — watch it write / pick the look / drop the highlight / render (51.38–59.3),
            then the whole build REWINDS on 'before' (58.6) into the register turn. */}
        {t >= 51.4 && t < 59.3 && (() => {
          const on = clamp01((t - 51.8) / 0.4) * (1 - rw);
          const L10: CodeLn[] = [
            { s: "export const Scene = () => {", at: 52.4 },
            { s: "  const t = useCurrentFrame() / 30;", at: 52.72 },
            { s: "  const look = brand.tokens;", at: 53.05 },
            { s: '  return <Frame grade="cinematic">', at: 53.38 },
            { s: "    <Marker at={55.3}>WORD</Marker>", at: 53.7 },
            { s: '    <Render out="scene.mp4" />', at: 54.02 },
            { s: "  </Frame>;", at: 54.35 },
            { s: "};", at: 54.6 },
          ];
          const tokRow = clamp01((t - 54.14) / 0.35);
          const prevOn = clamp01((t - 54.9) / 0.4);
          const bar = clamp01((t - 56.82) / 0.6);
          const thumbP = EASE_OVER(clamp01((t - 57.25) / 0.35));
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {/* plain silver headline — the demo Marker at 55.3 is this beat's ONE marker gesture */}
              <H1 u={u} t={t} in0={52.4}>WATCH IT WRITE</H1>
              {/* hero editor, typing fast; rewinds left */}
              <div style={{ position: "absolute", left: "26%", top: "50%", transform: `translate(-50%,-50%) translateX(${-rw * u * 46}px) scale(${0.92 + 0.08 * EASE_OVER(clamp01((t - 51.8) / 0.4))})` }}>
                <EdWin u={u} w={38} title="scene.tsx">
                  <CodeBody u={u} t={t} lines={L10} cps={44} fz={1.2} />
                </EdWin>
              </div>
              {/* right column: look tokens → marker preview → render bar → the frame */}
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${rw * u * 40}px)`, opacity: 1 - rw }}>
                {/* the look, chosen */}
                {tokRow > 0 && (
                  <div style={{ position: "absolute", left: "72%", top: "26%", transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * EASE_OVER(tokRow)})`, opacity: tokRow }}>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 0.9, background: "#12151d", border: `${u * 0.12}px solid #2a3145`, borderRadius: u * 0.7, padding: `${u * 0.8}px ${u * 1.3}px`, boxShadow: `0 ${u * 0.9}px ${u * 2.2}px rgba(0,0,0,0.5)` }}>
                      {[RAISIN, SILVER, LIME].map((c2, i) => <span key={i} style={{ width: u * 1.7, height: u * 1.7, borderRadius: u * 0.35, background: c2, border: `${u * 0.1}px solid ${c2 === RAISIN ? SILVER_MID : "transparent"}`, flexShrink: 0 }} />)}
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.04em", color: SILVER_SOFT, whiteSpace: "nowrap" }}>Space Grotesk 700</span>
                    </div>
                  </div>
                )}
                {/* the highlight, dropped — the REAL two-layer Marker doing its thing */}
                {prevOn > 0 && (
                  <div style={{ position: "absolute", left: "72%", top: "44%", transform: "translate(-50%,-50%)", opacity: prevOn }}>
                    <div style={{ width: u * 20, background: "#12151d", border: `${u * 0.12}px solid #2a3145`, borderRadius: u * 0.7, overflow: "hidden", boxShadow: `0 ${u * 0.9}px ${u * 2.2}px rgba(0,0,0,0.5)` }}>
                      <div style={{ height: u * 1.9, background: "#181c28", borderBottom: `${u * 0.08}px solid #232939`, display: "flex", alignItems: "center", paddingLeft: u * 0.9, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, color: SILVER_MID }}>preview</div>
                      <div style={{ padding: `${u * 1.1}px ${u * 1.3}px`, fontFamily: SANS, fontWeight: 800, fontSize: u * 2.3, color: SILVER, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        ON EVERY <Marker u={u} t={t} at={55.3}>WORD</Marker>
                      </div>
                    </div>
                  </div>
                )}
                {/* the render, completed */}
                {t >= 56.6 && (
                  <div style={{ position: "absolute", left: "72%", top: "56.5%", transform: "translate(-50%,-50%)", width: u * 20, opacity: clamp01((t - 56.7) / 0.25) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 0.7 }}>
                      <div style={{ flex: 1, height: u * 0.85, background: "#181d2a", border: `${u * 0.07}px solid #2a3145`, borderRadius: u * 0.45, overflow: "hidden" }}>
                        <div style={{ width: `${bar * 100}%`, height: "100%", background: LIME }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: bar >= 1 ? LIME : SILVER_MID, fontVariantNumeric: "tabular-nums" }}>{Math.round(bar * 100)}%</span>
                    </div>
                  </div>
                )}
                {thumbP > 0 && (
                  <div style={{ position: "absolute", left: "72%", top: "71%", transform: `translate(-50%,-50%) scale(${lerp(0.5, 1, thumbP)}) rotate(${(1 - thumbP) * -3}deg)`, opacity: Math.min(1, thumbP * 2) }}>
                    <div style={{ background: "#0d1017", border: `${u * 0.14}px solid ${SILVER}`, borderRadius: u * 0.5, padding: `${u * 0.6}px ${u * 0.9}px`, boxShadow: `0 ${u * 1.0}px ${u * 2.4}px rgba(0,0,0,0.6)` }}>
                      <DotLapSVG u={u} w={12} />
                    </div>
                  </div>
                )}
              </div>
              {/* the traveling clip slides back in and earns CODE ✓ */}
              {t >= 57.0 && (() => {
                const inP = EASE(clamp01((t - 57.2) / 0.4));
                return <ClipCard x={lerp(-8, 12, inP)} y={80} u={u} s={0.85} code={clamp01((t - 57.45) / 0.3)} o={1 - rw} bob={amb.bob(0.5, 0.1) * u} />;
              })()}
            </div>
          );
        })()}

        {/* BEATS 11+12 — the light worksheet: transcript.json read line by line, then distilled
            into the ONE thing (58.9–71.9). */}
        {t >= 59.2 && t < 71.9 && (() => {
          const on = clamp01((t - 59.4) / 0.4) * (1 - clamp01((t - 71.45) / 0.4));
          const winIn = EASE_OVER(clamp01((t - 59.86) / 0.45));
          const pageDim = 1 - 0.7 * clamp01((t - 70.22) / 0.45);
          const barTop = interpolate(t, [60.4, 61.7], [12, 56], CO); // sweeps, then stops mid-page
          const LINES = [
            { ts: "00:03", pre: "Okay, here's where people stop…", hl: 0 },
            { ts: "00:10", pre: "", key: "Mine doesn't.", post: "", hl: 63.24 },
            { ts: "00:11", pre: "It ", key: "writes actual code", post: "…", hl: 63.9 },
            { ts: "00:21", pre: "All the graphics are custom…", hl: 0 },
            { ts: "00:35", pre: "If I want this ", key: "US map", post: "…", hl: 64.34 },
          ];
          /* the three phrase-chips lifting off the page and fusing into the plate */
          const CHIPS = [
            { s: "Mine doesn't.", x: 21.5, y: 44.4 },
            { s: "writes actual code", x: 24.5, y: 49.1 },
            { s: "US map", x: 22.5, y: 58.5 },
          ];
          const snap = clamp01((t - 69.08) / 0.3);      // plate snaps
          const bz = (a: number, c: number, b: number, p: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * c + p * p * b;
          /* each chip arcs to its own staging point (a loose triangle), then all collapse to the plate */
          const CH_STAGE = [{ x: 19, y: 34 }, { x: 36, y: 40 }, { x: 24, y: 56 }];
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <H1 u={u} t={t} in0={60.9} out={66.2} ink={RAISIN}>IT <Marker u={u} t={t} at={61.3} base={RAISIN}>READS</Marker> FIRST</H1>
              {/* transcript window */}
              <div style={{ position: "absolute", left: "27%", top: "47%", transform: `translate(-50%,-50%) translateY(${(1 - winIn) * u * 2.2}px)`, opacity: Math.min(1, winIn * 1.6) * pageDim }}>
                <Win u={u} w={34} title="transcript.json" light>
                  <div style={{ position: "relative", padding: `${u * 1.0}px ${u * 1.3}px`, display: "flex", flexDirection: "column", gap: u * 0.85 }}>
                    {/* the reading bar, sweeping then frozen mid-page */}
                    <div style={{ position: "absolute", left: u * 0.5, right: u * 0.5, top: `${barTop}%`, height: u * 2.2, background: `${RAISIN}14`, borderLeft: `${u * 0.3}px solid ${RAISIN}`, borderRadius: u * 0.25, opacity: clamp01((t - 60.4) / 0.3) }} />
                    {LINES.map((ln, i) => (
                      <div key={i} style={{ display: "flex", gap: u * 1.0, alignItems: "baseline" }}>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: BODY, flexShrink: 0 }}>{ln.ts}</span>
                        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.22, color: ln.hl ? RAISIN : BODY, whiteSpace: "nowrap" }}>
                          {ln.pre}
                          {ln.hl > 0 && <Marker u={u} t={t} at={ln.hl} base={RAISIN}>{(ln as { key?: string }).key}</Marker>}
                          {(ln as { post?: string }).post}
                        </span>
                      </div>
                    ))}
                  </div>
                </Win>
              </div>
              {/* phrase chips lift, arc to their staging spots, then fuse into the plate */}
              {t >= 66.2 && snap < 1 && CHIPS.map((c2, i) => {
                const pA = EASE(clamp01((t - (66.2 + i * 0.3)) / 1.5));
                const pB = EASE(clamp01((t - 68.18) / 0.8));
                const o = (1 - clamp01((t - 68.85) / 0.25)) * Math.min(1, pA * 3 + 0.35);
                if (pA <= 0 || o <= 0) return null;
                const st = CH_STAGE[i];
                const sx = bz(c2.x, (c2.x + st.x) / 2 - 4, st.x, pA);
                const sy = bz(c2.y, Math.min(c2.y, st.y) - 7, st.y, pA);
                const x = lerp(sx, 27, pB), y = lerp(sy, 43.5, pB);
                return (
                  <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${(1 - pB) * (i - 1) * 2.5}deg) scale(${1 + pA * 0.12})`, opacity: o }}>
                    <span style={{ background: LIME, color: RAISIN, borderRadius: u * 0.3, padding: `${u * 0.3}px ${u * 0.8}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.5}px ${u * 1.4}px rgba(15,18,26,0.3)` }}>{c2.s}</span>
                  </div>
                );
              })}
              {/* the ONE thing */}
              {snap > 0 && (
                <>
                  <Eyebrow u={u} x={27} y={31} text="THE ONE THING" o={snap} ink={RAISIN} center />
                  <div style={{ position: "absolute", left: "27%", top: "43.5%", transform: `translate(-50%,-50%) rotate(-1.2deg) scale(${(0.8 + 0.2 * EASE_OVER(snap)) * (1 + 0.03 * Math.sin(clamp01((t - 70.22) / 0.3) * Math.PI))})`, opacity: snap }}>
                    <div style={{ background: LIME, padding: `${u * 0.85}px ${u * 1.8}px`, borderRadius: u * 0.4, boxShadow: `${u * 0.5}px ${u * 0.5}px 0 rgba(15,18,26,0.9)` }}>
                      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.1, letterSpacing: "-0.02em", color: RAISIN, whiteSpace: "nowrap" }}>EVERY SCENE IS CODE</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* BEAT 13 — the plan: takeaway → storyline rail → beat-cards → the clip rolls on (71.4–75.5) */}
        {t >= 69.0 && t < 75.51 && t >= 71.35 && (() => {
          const slide = EASE(clamp01((t - 71.74) / 0.55));
          const railP = EASE(clamp01((t - 73.4) / 0.55));
          const CARDS = ["hook", "claim", "proof", "demo", "plan", "ship"];
          const rollP = EASE_OVER(clamp01((t - 74.78) / 0.5));
          return (
            <div style={{ position: "absolute", inset: 0 }}>
              {/* the takeaway plate rides to top-center */}
              <div style={{ position: "absolute", left: `${lerp(27, 50, slide)}%`, top: `${lerp(43.5, 15, slide)}%`, transform: `translate(-50%,-50%) rotate(-1.2deg) scale(${lerp(1, 0.92, slide)})` }}>
                <div style={{ background: LIME, padding: `${u * 0.85}px ${u * 1.8}px`, borderRadius: u * 0.4, boxShadow: `${u * 0.5}px ${u * 0.5}px 0 rgba(15,18,26,0.9)` }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.1, letterSpacing: "-0.02em", color: RAISIN, whiteSpace: "nowrap" }}>EVERY SCENE IS CODE</span>
                </div>
              </div>
              <Eyebrow u={u} x={50} y={41} text="THE PLAN" o={clamp01((t - 73.4) / 0.35)} ink={RAISIN} center />
              {/* the storyline rail with six slots */}
              <div style={{ position: "absolute", left: "6%", top: "55%", width: "84%", height: u * 0.22, background: RAISIN, transformOrigin: "left center", transform: `translateY(-50%) scaleX(${railP})`, borderRadius: u * 0.11 }} />
              {CARDS.map((c2, i) => {
                const tickO = clamp01((t - (73.55 + i * 0.09)) / 0.2);
                const dealP = EASE_OVER(clamp01((t - (74.12 + i * 0.11)) / 0.3));
                const sx = 20 + i * 12.8;
                return (
                  <React.Fragment key={i}>
                    {/* slot tick */}
                    <div style={{ position: "absolute", left: `${sx}%`, top: "55%", width: u * 0.2, height: u * 1.3, background: RAISIN, transform: "translate(-50%,-50%)", opacity: tickO * (1 - dealP * 0.8) }} />
                    {/* beat-card */}
                    {dealP > 0 && (
                      <div style={{ position: "absolute", left: `${sx}%`, top: "55%", transform: `translate(-50%,-50%) translateY(${(1 - dealP) * -u * 3.2}px) scale(${lerp(0.7, 1, dealP)}) rotate(${(1 - dealP) * (i % 2 ? 3 : -3)}deg)`, opacity: Math.min(1, dealP * 2) }}>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "absolute", inset: 0, background: RAISIN, borderRadius: u * 0.45, transform: `translate(${u * 0.3}px,${u * 0.3}px)`, opacity: 0.25 }} />
                          <div style={{ position: "relative", width: u * 8.6, height: u * 5.4, background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 0.45, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: `${u * 0.5}px ${u * 0.7}px` }}>
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, color: BODY }}>{String(i + 1).padStart(2, "0")}</span>
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.04em", color: RAISIN }}>{c2}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              {/* the traveling clip rolls onto the left end of the rail, both ticks earned */}
              <ClipCard x={rollP > 0 ? lerp(10, 9.5, rollP) : 10} y={rollP > 0 ? lerp(84, 55, rollP) : 84} u={u} s={0.85} light code={1} rot={(1 - rollP) * -10} bob={rollP >= 1 ? amb.bob(0.2, 0.08) * u : 0} />
            </div>
          );
        })()}

        {/* the clip-card on the light worksheet, docked through beats 11–12 (hands off to beat 13) */}
        {t >= 59.4 && t < 71.35 && (
          <ClipCard x={10} y={84} u={u} s={0.85} light code={1} o={clamp01((t - 59.4) / 0.4)} bob={amb.bob(0.2, 0.08) * u} />
        )}
      </div>

      {/* ============ SCRIM (full-footage readability) ============ */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.5) 0%, transparent 26%, transparent 58%, rgba(8,10,14,0.74) 100%)`, opacity: full, pointerEvents: "none" }} />

      {/* ============ FOOTAGE ============ */}
      <FootageLayer sk={sk} u={u} src="footage/ls_th2.mp4" />

      {/* ============ OVERLAYS ON FOOTAGE ============ */}
      {/* BEAT 1 — the claim to camera (0–3.64): full face; the traveling clip-card idles in its
          Act-1 dock; the headline wipes on above it. */}
      {t < 4.05 && (() => {
        const out = 1 - clamp01((t - 3.55) / 0.45);
        const cardIn = clamp01((t - 0.3) / 0.4);
        return (
          <div style={{ position: "absolute", inset: 0, opacity: out }}>
            {/* NOTE 3.30: the 'stop believing' headline removed — the claim is carried by the face
                to camera; only the traveling clip-card idles in its dock. Cleaner, zero label. */}
            <ClipCard x={10} y={82} u={u} o={cardIn} bob={amb.bob(0, 0.1) * u} />
          </div>
        );
      })()}

      {/* BEAT 4 — the confession (15.16–18.38): full face; editor + clip-card dock bottom-left;
          the docked cursor gives ONE lime blink on 'secret'. */}
      {t >= 15.2 && t < 18.6 && (() => {
        const out = 1 - clamp01((t - 18.1) / 0.4);
        const dockIn = EASE_OVER(clamp01((t - 15.3) / 0.45));
        const blink = t >= 17.96 && t < 18.22 ? 1 : 0;
        return (
          <div style={{ position: "absolute", inset: 0, opacity: out }}>
            <H1 u={u} t={t} in0={15.7}>SUPER <Marker u={u} t={t} at={15.98}>CUSTOM</Marker></H1>
            {/* docked mini editor */}
            <div style={{ position: "absolute", left: "10%", top: "81%", transform: `translate(-50%,-50%) translateY(${(1 - dockIn) * u * 3}px) scale(${lerp(1.25, 1, dockIn)})`, opacity: Math.min(1, dockIn * 1.8) }}>
              <EdWin u={u} w={13} title="scene.tsx">
                <div style={{ padding: `${u * 0.6}px ${u * 0.9}px`, display: "flex", flexDirection: "column", gap: u * 0.42 }}>
                  {[7.5, 9.5, 6].map((w2, i) => <span key={i} style={{ width: u * w2, height: u * 0.62, borderRadius: u * 0.2, background: "#2c3242" }} />)}
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.3 }}>
                    <span style={{ width: u * 4, height: u * 0.62, borderRadius: u * 0.2, background: "#2c3242" }} />
                    <span style={{ width: u * 0.5, height: u * 1.1, background: blink ? LIME : "#3f4760", boxShadow: blink ? `0 0 ${u * 0.9}px ${LIME}` : "none" }} />
                  </div>
                </div>
              </EdWin>
            </div>
            <ClipCard x={22} y={81} u={u} s={0.8} o={Math.min(1, dockIn * 1.8)} bob={amb.bob(0.3, 0.1) * u} />
          </div>
        );
      })()}

      {/* BEAT 8 — the showpiece (35.16–44.88): FULL face (I point to the right). NOTE 40.67 — a DENSE
          field of tiny atoms lays on the EXACT continental-US silhouette (center-right). On 'make it
          into a computer' the atoms DETACH from the map (which dissolves), swarm left, and ASSEMBLE the
          laptop themselves — tracing its screen frame + base — then the solid computer resolves beneath
          them (screen = code, NOT a map). The atom-build IS the visual; the map never enters the laptop. */}
      {t >= 35.4 && t < 45.3 && (() => {
        const mapIn = clamp01((t - 37.14) / 0.6);
        const merge = clamp01((t - 42.44) / 1.3);              // atoms detach → swarm → assemble
        const mCX = 66, mCY = 43;                              // US silhouette: fixed center-right
        const msc = lerp(0.92, 1, EASE_OVER(mapIn));
        const Wm = u * 34, Hm = (Wm * 593) / 959;              // matches the SVG's 959×593 box → dots align
        const mapSilO = mapIn * (1 - clamp01((merge - 0.08) / 0.4));   // dissolves as the atoms leave it

        /* the computer the atoms BUILD — geometry mirrors <AtomLaptop screenW=24> exactly so the atoms
           land ON its silhouette. cx/cy match beat-9's carry-in (28,46) → seamless handoff. */
        const lapCx = 28, lapCy = 46;
        const cxP = (lapCx / 100) * W, cyP = (lapCy / 100) * H;
        const sh = u * 24 * 0.6;
        const colH = sh + u * 0.18 + u * 1.35;                 // screen + gap + base deck
        const scrCenterP = cyP - colH / 2 + sh / 2;            // screen-panel center (px)
        const baseCenterP = cyP - colH / 2 + sh + u * 0.18 + u * 1.35 / 2;
        const HW = u * 12, HH = u * 7.2, BHW = u * 14.64;      // screen half-extents + base half-width
        const target = (k: number): { x: number; y: number } => {
          const A = LAP_ASSEMBLE[k];
          if (A.role === "sf") { const [lx, ly] = rectPerim(A.a, -1, -1, 1, 1); return { x: cxP + lx * (HW - u * 0.7), y: scrCenterP + ly * (HH - u * 0.7) }; }
          if (A.role === "fill") return { x: cxP + (A.a * 2 - 1) * HW * 0.78, y: scrCenterP + (A.b * 2 - 1) * HH * 0.72 };
          if (A.role === "deck") return { x: cxP + (A.a * 2 - 1) * BHW * 0.9, y: baseCenterP + (A.b - 0.5) * u * 0.9 };
          if (A.role === "hinge") return { x: cxP + (A.a * 2 - 1) * HW * 0.86, y: scrCenterP + HH + u * 0.2 };
          return { x: cxP + 0.62 * BHW + (A.a - 0.5) * u * 1.4, y: baseCenterP + (A.b - 0.5) * u * 0.9 };
        };

        const lapOn = clamp01((merge - 0.5) / 0.42);           // solid shell resolves as the atoms pack in
        const lapO = lapOn * (1 - clamp01((t - 44.85) / 0.45));        // long crossfade → beat 9
        const nucleus = clamp01((merge - 0.3) / 0.4) * (1 - clamp01((merge - 0.72) / 0.28)); // gather glow
        const bz = (a: number, cc: number, b: number, p: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * cc + p * p * b;
        return (
          <div style={{ position: "absolute", inset: 0 }}>
            {/* the real US map as a receded dark plate — the atoms lay on top of it and pop */}
            {mapSilO > 0 && (
              <div style={{ position: "absolute", left: `${mCX}%`, top: `${mCY}%`, transform: `translate(-50%,-50%) scale(${msc})`, opacity: mapSilO }}>
                <Img src={staticFile("assets/us-map.svg")} style={{ width: Wm, height: Hm, filter: `brightness(0.4) saturate(0) drop-shadow(0 ${u * 0.6}px ${u * 1.4}px rgba(0,0,0,0.6))` }} />
              </div>
            )}
            {/* the coalescing nucleus — energy gathering where the atoms fuse */}
            {nucleus > 0 && (
              <div style={{ position: "absolute", left: cxP, top: scrCenterP, transform: `translate(-50%,-50%) scale(${0.5 + 0.9 * nucleus})`, width: u * 13, height: u * 13, borderRadius: "50%", background: `radial-gradient(circle, ${LIME}55 0%, ${LIME}18 44%, transparent 72%)`, opacity: nucleus }} />
            )}
            {/* the atoms: rest on the EXACT US shape → swarm and assemble the computer */}
            {mapIn > 0 && merge < 1 && US_DOTS.map((d, k) => {
              const appear = clamp01((t - (37.9 + k * 0.006)) / 0.5);  // settle onto the map
              if (appear <= 0) return null;
              const x0 = (mCX / 100) * W + (d[0] - 0.5) * Wm * msc;     // on-map px (aligned to the SVG box)
              const y0 = (mCY / 100) * H + (d[1] - 0.5) * Hm * msc;
              const tg = target(k);
              const d0 = (k % 11) * 0.02;                               // per-atom stagger
              const dm = EASE(clamp01((merge - d0) / (1 - d0)));
              const perp = (k % 2 ? 1 : -1) * (10 + (k % 6) * 5) * dm * (1 - dm) * u; // swirl arc
              const x = bz(x0, (x0 + tg.x) / 2 + perp, tg.x, dm);
              const y = bz(y0, (y0 + tg.y) / 2 - perp * 0.7, tg.y, dm);
              const rest = amb.bob(k * 0.13, 0.06) * u * (1 - dm);      // faint atomic shimmer at rest
              const sz = u * (0.5 - 0.13 * dm) * (0.4 + 0.6 * EASE_OVER(appear));
              const dotO = appear * (1 - clamp01((dm - 0.8) / 0.2)) * (1 - lapO);
              const isLime = d[2] > 0 || dm > 0.35;                     // atoms energize to lime as they merge
              return <span key={k} style={{ position: "absolute", left: x, top: y + rest, transform: "translate(-50%,-50%)", width: sz, height: sz, borderRadius: "50%", background: isLime ? LIME : SILVER, boxShadow: isLime ? `0 0 ${u * (0.4 + 0.7 * dm)}px ${LIME}` : `0 ${u * 0.12}px ${u * 0.3}px rgba(0,0,0,0.55)`, opacity: dotO }} />;
            })}
            {/* the computer, BUILT from the atoms (screen = code, never a map) */}
            {lapO > 0 && <AtomLaptop u={u} cx={lapCx} cy={lapCy} s={1} o={lapO} powerLit={clamp01((merge - 0.86) / 0.14)} assembleGlow={clamp01((merge - 0.5) / 0.2) * (1 - clamp01((merge - 0.82) / 0.2))} />}
          </div>
        );
      })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,${0.5 - lite * 0.3})`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default LSAct2;
