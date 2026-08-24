/**
 * Act4 — "THE UNLOCK" (narration 377.38–431.1s → local 0–53.6s).
 * The full machine FLIPS: arrows reverse, a cable plugs Claude in (supabase-mcp), a question rides
 * the pipe INTO the base, the base scans/bands/braids three feeds into ONE answer card, priced
 * against a €90k data scientist, then the CTA: links, build your own, like & subscribe.
 * Voice only; SFX + music in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Card, Marker, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";
import { Win } from "./bb2/concepts";

const FPS = 30;

const Chip: React.FC<{ x: number; y: number; u: number; text: string; lime?: boolean; grey?: boolean; o?: number; sc?: number; icon?: string; iconW?: number }> = ({ x, y, u, text, lime, grey, o = 1, sc = 1, icon, iconW = 1.2 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${sc})`, opacity: o }}>
    <div style={{ display: "flex", alignItems: "center", gap: u * 0.6, background: grey ? "#1a1f2b" : RAISIN, border: `${u * 0.1}px solid ${grey ? "#3a4256" : lime ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: grey ? SILVER_MID : lime ? LIME : SILVER, whiteSpace: "nowrap" }}>
      {icon && <Img src={staticFile(`logos/${icon}`)} style={{ width: u * iconW, height: u * iconW, flexShrink: 0 }} />}
      {text}
    </div>
  </div>
);
const HL: React.FC<{ u: number; t: number; at: number; out?: number; x?: string; y?: string; size?: number; children: React.ReactNode; center?: boolean }> = ({ u, t, at, out, x = "6%", y = "12%", size = 3.0, children, center }) => (
  <div style={{ position: "absolute", left: center ? "50%" : x, top: y, transform: center ? "translate(-50%,-50%)" : undefined, whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - at) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

export const Act4: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // b1 full
    { t: 2.7, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 3.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },        // b2-8 hidden: the flip → the answer
    { t: 30.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 31.1, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // b9-10 FULL footage + side graphics
    { t: 38.9, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 39.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // b11 full
    { t: 43.3, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 44.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 }, // b12 panel
    { t: 49.8, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 50.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // b13 full closer
    { t: 53.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);
  const lite = clamp01((t - 44.0) / 0.5) * (1 - clamp01((t - 49.9) / 0.5)); // b12: build your own, on paper
  const ink = lite > 0.5 ? RAISIN : SILVER;
  const inkSoft = lite > 0.5 ? BODY : SILVER_SOFT;

  /* ---------- machine scene state (beats 2–8) ---------- */
  const CYL = { x: 28, y: 46 };
  const S = u * 0.95;
  const flipP = clamp01((t - 4.9) / 0.5);        // arrows reverse
  const cableP = clamp01((t - 8.9) / 1.2);       // cable to CLAUDE
  const plugP = clamp01((t - 11.2) / 0.35);      // socket click
  const fireP = clamp01((t - 15.0) / 0.85);      // question rides left
  const rimFlash = t > 15.85 && t < 16.5;
  const scanP = clamp01((t - 16.8) / 1.6);
  const bandsP = clamp01((t - 22.6) / 0.4);
  const BANDS = [
    { l: "SOCIAL", at: 22.6, card: "DM: still there?", m: false, icon: "lucide-message-circle-lime.svg" },
    { l: "REVENUE", at: 23.9, card: "payout €3,900", m: true, icon: "lucide-banknote-lime.svg" },
    { l: "SUPPORT", at: 25.2, card: "ticket #218: refund?", m: false, icon: "lucide-headset-lime.svg" },
  ];
  // real source logos that stream INTO the database (all the data lives inside)
  const SOURCES = [
    { icon: "brand-stripe.svg", x: 7, y: 22, at: 22.6 },      // revenue
    { icon: "brand-revolut-white.svg", x: 14, y: 12, at: 23.0 }, // revenue
    { icon: "brand-gmail.svg", x: 23, y: 8, at: 23.4 },        // support
    { icon: "brand-instagram.svg", x: 33, y: 11, at: 23.8 },   // social
    { icon: "brand-whatsapp.svg", x: 40, y: 18, at: 24.2 },    // social
    { icon: "brand-x-white.svg", x: 6, y: 35, at: 24.6 },      // social
    { icon: "brand-tiktok-white.svg", x: 11, y: 45, at: 25.0 },// social
  ];
  const braidP = clamp01((t - 26.7) / 1.4);
  const unfurlP = clamp01((t - 28.3) / 0.5);
  const glowPulse = t > 29.9 && t < 30.6 ? Math.sin((t - 29.9) / 0.7 * Math.PI) : 0;
  const machineOn = t >= 3.1 && t < 30.9;
  // cable path: cylinder right edge → CLAUDE tile left edge
  const cx1 = (CYL.x + 11) / 100 * 100, cy1 = CYL.y;
  const TILE = { x: 72, y: 40 };

  /* answer card content */
  const ANSWER = "focus: fix checkout → +€3.9k/mo";

  /* b9-10: the €90k dot-grid comparison */
  const rgbMix = (a: number[], b: number[], p: number) => `rgb(${Math.round(lerp(a[0], b[0], p))},${Math.round(lerp(a[1], b[1], p))},${Math.round(lerp(a[2], b[2], p))})`;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("intros/businessbrain/act4_voice.m4a")} />
      <DarkBg u={u} gridOpacity={Math.max(0.4, sk.fr)} />
      <LightBg u={u} opacity={lite} />

      {/* ================= GRAPHICS WORLD ================= */}
      <div style={{ position: "absolute", inset: 0, opacity: Math.max(graphicsOn, t > 31.0 && t < 39.4 ? 1 : 0) }}>

        {/* ===== beats 2–8: the FLIP → the plug → the question → the braid → ONE ANSWER ===== */}
        {machineOn && (() => {
          const on = clamp01((t - 3.4) / 0.4) * (1 - clamp01((t - 30.5) / 0.35));
          return (
            <div style={{ opacity: on }}>
              {/* cylinder, packed to the brim, with bands after 22.6 */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <g transform={`translate(${CYL.x / 100 * W} ${CYL.y / 100 * H}) scale(${S})`}>
                  <g fill="none" stroke={LIME} strokeWidth={0.5} strokeLinecap="round">
                    <path d="M-11 -13 a11 4 0 1 0 22 0 a11 4 0 1 0 -22 0" style={{ filter: rimFlash ? `drop-shadow(0 0 ${u * 0.15}px ${LIME})` : "none" }} strokeWidth={rimFlash ? 0.7 : 0.5} />
                    <path d="M-11 -13 L-11 13 M11 -13 L11 13 M-11 13 a11 4 0 0 0 22 0" />
                  </g>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const bandIdx = i >= 5 ? 0 : i >= 2 ? 1 : 2; // top=social, mid=revenue, bottom=support
                    const bandFlash = BANDS[bandIdx] && t > BANDS[bandIdx].at && t < BANDS[bandIdx].at + 0.5 ? 0.4 : 0;
                    const glint = t > 4.3 && t < 4.8 && i === 6 ? 0.4 : 0;
                    return <rect key={i} x={-8.5} y={9.5 - i * 2.9} width={17} height={1.9} rx={0.5} fill={LIME} opacity={0.18 + glint + bandFlash} />;
                  })}
                  {/* band dividers */}
                  {bandsP > 0 && (<>
                    <line x1={-9.5 * bandsP} y1={-3.2} x2={9.5 * bandsP} y2={-3.2} stroke={LIME} strokeWidth={0.22} opacity={0.7} />
                    <line x1={-9.5 * bandsP} y1={5.5} x2={9.5 * bandsP} y2={5.5} stroke={LIME} strokeWidth={0.22} opacity={0.7} />
                  </>)}
                  {/* scan line (beat 6) */}
                  {scanP > 0 && scanP < 1 && <line x1={-9} y1={-12 + scanP * 24} x2={9} y2={-12 + scanP * 24} stroke={LIME} strokeWidth={0.35} opacity={0.9} />}
                </g>
                {/* stream arrows: IN before the flip, OUT after (they rotate) */}
                {[0, 1, 2].map((i) => {
                  const ang = (-30 + i * 30) * Math.PI / 180;
                  const bx = CYL.x / 100 * W - Math.cos(ang) * u * 16, by = CYL.y / 100 * H - Math.sin(ang) * u * 12;
                  const ex = CYL.x / 100 * W - Math.cos(ang) * u * 11.5, ey = CYL.y / 100 * H - Math.sin(ang) * u * 9;
                  // arrowhead flips: points at cylinder before, away after
                  const hx = lerp(ex, bx, flipP), hy = lerp(ey, by, flipP);
                  const dirx = lerp(1, -1, flipP) * Math.cos(ang), diry = lerp(1, -1, flipP) * Math.sin(ang);
                  return (
                    <g key={i} opacity={clamp01((t - 3.5 - i * 0.1) / 0.3)}>
                      <line x1={bx} y1={by} x2={ex} y2={ey} stroke={LIME} strokeWidth={u * 0.2} strokeDasharray={`${u * 1.2} ${u * 0.9}`} strokeDashoffset={(flipP > 0.5 ? 1 : -1) * t * u * 5} opacity={0.75} />
                      <polygon points={`${hx + dirx * u * 0.9},${hy + diry * u * 0.9} ${hx - diry * u * 0.5},${hy + dirx * u * 0.5} ${hx + diry * u * 0.5},${hy - dirx * u * 0.5}`} fill={LIME} opacity={0.9} />
                    </g>
                  );
                })}
                {/* the cable to CLAUDE */}
                {cableP > 0 && (() => {
                  const x1 = (CYL.x + 11) / 100 * W, y1 = CYL.y / 100 * H;
                  const x2 = (TILE.x - 7.5) / 100 * W, y2 = TILE.y / 100 * H;
                  const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + u * 6;
                  const len = u * 55;
                  return (<>
                    <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={LIME} strokeWidth={u * 0.24}
                      strokeDasharray={plugP >= 1 ? undefined : `${u * 1.4} ${u * 1.1}`} strokeDashoffset={plugP >= 1 ? 0 : len * (1 - cableP)} opacity={0.9}
                      style={{ filter: plugP >= 1 && t < 12.2 ? `drop-shadow(0 0 ${u * 0.7}px ${LIME})` : "none" }} />
                    {/* mcp tag on the wire */}
                    {t > 10.3 && <g opacity={clamp01((t - 10.3) / 0.3)}><rect x={mx - u * 5} y={my - u * 2.2} width={u * 10} height={u * 2.2} rx={u * 0.4} fill="#12151d" stroke={LIME} strokeWidth={u * 0.08} />
                      <foreignObject x={mx - u * 5} y={my - u * 2.2} width={u * 10} height={u * 2.2}>
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.45 }}>
                          <Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.1, height: u * 1.1, flexShrink: 0 }} />
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: u * 1.05, color: LIME, whiteSpace: "nowrap" }}>supabase-mcp</span>
                        </div>
                      </foreignObject></g>}
                  </>); })()}
                {/* the braid: three threads → one line (beat 8) */}
                {braidP > 0 && (() => {
                  const x2 = (TILE.x - 7.5) / 100 * W, y2 = TILE.y / 100 * H;
                  return [0, 1, 2].map((i) => {
                    const y0 = CYL.y / 100 * H + (i - 1) * u * 6;
                    const x0 = (CYL.x + 10.5) / 100 * W;
                    const len = u * 60;
                    return <path key={i} d={`M ${x0} ${y0} C ${x0 + u * 8} ${y0}, ${x2 - u * 14} ${y2}, ${x2} ${y2}`} fill="none" stroke={LIME} strokeWidth={u * 0.22} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - braidP)} opacity={0.85} style={{ filter: `drop-shadow(0 0 ${u * 0.5}px ${LIME}88)` }} />;
                  }); })()}
              </svg>
              {/* counter */}
              <div style={{ position: "absolute", left: `${CYL.x}%`, top: "78%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 0.45, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.5, color: SILVER, fontVariantNumeric: "tabular-nums", opacity: clamp01((t - 3.8) / 0.4) }}>
                <Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.2, height: u * 1.2, flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap" }}>{t > 4.3 ? "12,438" : "12,437"} ROWS</span>
              </div>
              {/* beat 7: real SOURCE logos stream INTO the database (all the data lives inside) */}
              {t > 22.4 && t < 30.2 && SOURCES.map((s, i) => {
                const p = clamp01((t - s.at) / 1.9);
                const cx = lerp(s.x, CYL.x, p * p);
                const cy = lerp(s.y, CYL.y, p * p);
                const o = clamp01((t - s.at) / 0.3) * (1 - clamp01((p - 0.8) / 0.2));
                const sc = lerp(1, 0.34, p);
                if (o <= 0) return null;
                return (
                  <div key={i} style={{ position: "absolute", left: `${cx}%`, top: `${cy}%`, transform: `translate(-50%,-50%) scale(${sc})`, opacity: o, width: u * 3.4, height: u * 3.4, display: "flex", alignItems: "center", justifyContent: "center", background: "#12151d", border: `${u * 0.09}px solid ${SILVER_MID}`, borderRadius: u * 0.7, boxShadow: `0 ${u * 0.15}px ${u * 0.6}px rgba(0,0,0,0.55)` }}>
                    <Img src={staticFile(`logos/${s.icon}`)} style={{ width: u * 2.0, height: u * 2.0, objectFit: "contain" }} />
                  </div>
                );
              })}
              {/* CLAUDE + CHATGPT tiles → unfurl into the ANSWER CARD */}
              {t > 7.0 && unfurlP < 0.4 && (
                <div style={{ position: "absolute", left: `${TILE.x}%`, top: `${TILE.y}%`, transform: "translate(-50%,-50%)", opacity: (1 - unfurlP * 2.5) }}>
                  {t > 8.2 && (() => { const dim = 0.9 - clamp01((t - 9.6) / 0.8) * 0.5;
                    return (
                      <div style={{ position: "absolute", left: u * 5.5, top: -u * 5.2, display: "flex", alignItems: "center", gap: u * 0.7, background: "#12151d", border: `${u * 0.09}px solid #3a4256`, borderRadius: u * 0.6, padding: `${u * 0.6}px ${u * 1.4}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, color: "#8a93a8", opacity: dim * clamp01((t - 8.2) / 0.3) }}>
                        <Img src={staticFile("logos/chatgpt.svg")} style={{ width: u * 1.5, height: u * 1.5 }} />
                        CHATGPT
                      </div>
                    ); })()}
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: u * 0.8, background: RAISIN, border: `${u * 0.12}px solid ${plugP >= 1 ? LIME : SILVER_MID}`, borderRadius: u * 0.6, padding: `${u * 0.9}px ${u * 2.0}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.5, color: SILVER, boxShadow: plugP >= 1 && t < 12.2 ? `0 0 ${u * 1.6}px ${LIME}66` : "none" }}>
                    <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.9, height: u * 1.9, flexShrink: 0 }} />
                    CLAUDE
                    {/* socket notch */}
                    <div style={{ position: "absolute", left: -u * 0.65, top: "50%", transform: "translateY(-50%)", width: u * 0.9, height: u * 1.6, background: plugP >= 1 ? LIME : "#2a3145", borderRadius: u * 0.2, transition: "none" }} />
                  </div>
                </div>
              )}
              {/* the QUESTION: a prompt bubble types out, then rises INTO the Claude spark */}
              {t > 13.0 && fireP < 1 && (() => {
                const q = "What should I focus on?";
                const typed = q.slice(0, Math.max(0, Math.floor((t - 13.0) * 19)));
                const caret = Math.floor(t * 2.4) % 2 === 0 ? "▌" : "";
                const y = lerp(TILE.y + 14, TILE.y + 2, fireP);
                const o = 1 - clamp01((fireP - 0.7) / 0.3);
                const sc = 1 - fireP * 0.45;
                return (
                  <div style={{ position: "absolute", left: `${TILE.x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${sc})`, opacity: o }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: u * 0.7, background: "#12151d", border: `${u * 0.11}px solid ${LIME}`, borderRadius: u * 0.8, padding: `${u * 0.75}px ${u * 1.35}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, color: SILVER, whiteSpace: "nowrap", boxShadow: `0 0 ${u * 1.1}px ${LIME}44` }}>
                      <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.4, height: u * 1.4, flexShrink: 0 }} />
                      <span>{fireP > 0 ? q : typed + caret}</span>
                      {/* tail points up to the Claude spark */}
                      <div style={{ position: "absolute", top: -u * 0.65, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: u * 1.15, height: u * 1.15, background: "#12151d", borderLeft: `${u * 0.11}px solid ${LIME}`, borderTop: `${u * 0.11}px solid ${LIME}` }} />
                    </div>
                  </div>
                );
              })()}
              {/* Claude ANSWERS: the answer lands as a REAL Claude chat reply (beat 8 spike) */}
              {unfurlP > 0 && (
                <div style={{ position: "absolute", left: `${TILE.x}%`, top: `${TILE.y + 3}%`, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * unfurlP + glowPulse * 0.05})`, opacity: unfurlP }}>
                  <div style={{ position: "relative", width: u * 40 }}>
                    {/* soft lime bloom on the beat spike */}
                    <div style={{ position: "absolute", inset: -u * 0.7, background: LIME, borderRadius: u * 1.3, opacity: glowPulse * 0.35, filter: `blur(${u * 1.4}px)` }} />
                    {/* the Claude window */}
                    <div style={{ position: "relative", background: "#12151d", border: `${u * 0.1}px solid ${glowPulse > 0 ? LIME : "#2a3145"}`, borderRadius: u * 1.0, overflow: "hidden", boxShadow: glowPulse > 0 ? `0 0 ${u * (1.4 + glowPulse * 2)}px ${LIME}aa` : `0 ${u * 1.4}px ${u * 3.4}px rgba(0,0,0,0.6)` }}>
                      {/* top chrome bar: three dots (last LIME) + claude mark + label */}
                      <div style={{ height: u * 2.8, background: "#181c28", borderBottom: `${u * 0.09}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.55, padding: `0 ${u * 1.2}px` }}>
                        {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.72, height: u * 0.72, borderRadius: "50%", background: i === 2 ? LIME : "#3a4256" }} />)}
                        <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.35, height: u * 1.35, marginLeft: u * 0.7, flexShrink: 0 }} />
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.04em", color: SILVER_SOFT }}>claude</span>
                      </div>
                      {/* response body: Claude states the answer as natural text */}
                      <div style={{ padding: `${u * 1.3}px ${u * 1.6}px ${u * 1.5}px` }}>
                        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: u * 1.2, color: SILVER_SOFT, marginBottom: u * 0.9 }}>Your single highest-leverage move:</div>
                        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.7, color: SILVER, lineHeight: 1.35 }}>
                          Focus on <span style={{ fontWeight: 800, color: LIME }}>fixing checkout</span> — it's worth <span style={{ fontWeight: 800, color: LIME, whiteSpace: "nowrap" }}>+€3.9k/mo</span>.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* headlines, bottom band */}
              <HL u={u} t={t} at={5.8} out={8.4} center y="90%" size={3.2}><Marker u={u} t={t} at={6.1}>FLIP</Marker> IT AROUND</HL>
              <HL u={u} t={t} at={9.0} out={12.4} center y="90%" size={2.8}>GIVE CLAUDE <Marker u={u} t={t} at={9.3}>ACCESS</Marker></HL>
              <HL u={u} t={t} at={20.4} out={22.4} center y="90%" size={2.8}>IT SEES <Marker u={u} t={t} at={20.7}>EVERYTHING</Marker></HL>
              <HL u={u} t={t} at={29.9} center y="90%" size={3.2}>ONE <Marker u={u} t={t} at={30.1}>ANSWER</Marker></HL>
              {t > 11.9 && t < 14.5 && <div style={{ position: "absolute", left: "50%", top: "84%", transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.5, color: SILVER_MID, opacity: clamp01((t - 11.9) / 0.4) * (1 - clamp01((t - 14.0) / 0.4)) }}>a cable AI can plug into</div>}
            </div>
          );
        })()}

        
        {/* ===== beat 12: build your own (panel) ===== */}
        {t >= 44.0 && t < 50.1 && (() => { const on = clamp01((t - 44.2) / 0.35) * (1 - clamp01((t - 49.7) / 0.3));
          const rows = ["me.md", "business.md", "priorities.md", "skills/"];
          const cnt = Math.round(interpolate(clamp01((t - 48.6) / 1.2), [0, 1], [0, 12438]) / 7) * 7;
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", left: "6%", top: "13%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.8, letterSpacing: "-0.02em", color: ink, textTransform: "uppercase", opacity: clamp01((t - 44.4) / 0.4) }}>YOUR SECOND <Marker u={u} t={t} at={44.7} base={ink}>BRAIN</Marker></div>
              <div style={{ position: "absolute", left: "26%", top: "48%", transform: "translate(-50%,-50%)" }}>
                <Win u={u} w={24} title="my-second-brain/" light={lite > 0.5}>
                  <div style={{ padding: `${u * 0.4}px 0`, minHeight: u * 11 }}>
                    {rows.map((n, i) => {
                      const o = clamp01((t - 46.2 - i * 0.8) / 0.3);
                      return (
                        <div key={i} style={{ height: u * 2.6, display: "flex", alignItems: "center", gap: u * 0.8, padding: `0 ${u * 1.2}px`, opacity: o, transform: `translateX(${(1 - o) * u}px)` }}>
                          {n.endsWith("/")
                            ? <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 1.4, height: u * 1.4, flexShrink: 0 }} />
                            : <Img src={staticFile("logos/markdown-dark.svg")} style={{ width: u * 1.4, height: u * 0.86, flexShrink: 0 }} />}
                          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.1, color: inkSoft }}>{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </Win>
                <div style={{ marginTop: u * 0.7, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.45, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.4, color: cnt > 0 ? (lite > 0.5 ? "#5a7a00" : LIME) : inkSoft, fontVariantNumeric: "tabular-nums", opacity: clamp01((t - 48.4) / 0.4) }}>
                  <Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.2, height: u * 1.2, flexShrink: 0 }} />
                  <span style={{ whiteSpace: "nowrap" }}>{cnt.toLocaleString("en-US")} rows — and growing</span>
                </div>
              </div>
            </div>
          ); })()}
      </div>

      {/* ================= SCRIM + FOOTAGE ================= */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.55) 0%, transparent 26%, transparent 60%, rgba(8,10,14,0.72) 100%)`, opacity: full, pointerEvents: "none" }} />
      <FootageLayer sk={sk} u={u} src="footage/act4.mp4" />

      {/* ===== beats 9–10: the $90k comparison — the real US map fills with $90k dots ===== */}
        {t >= 31.1 && t < 39.4 && (() => { const on = clamp01((t - 31.3) / 0.35) * (1 - clamp01((t - 39.0) / 0.3));
          const MAP_W = u * 42, MAP_H = MAP_W * 593 / 959;
          const COLS = 34, ROWS = Math.round(COLS * 593 / 959), N = COLS * ROWS;
          const DCOLS = 62, DROWS = Math.round(DCOLS * 593 / 959), DN = DCOLS * DROWS;  // fine density layer
          const mask = `url("${staticFile("assets/us-map.svg")}")`;
          const maskStyle = { WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" } as const;
          const litFrac = clamp01((t - 32.6) / 3.4);     // dots light up across the map
          const fillRatio = 0.42;                          // ~share of grid cells inside the silhouette
          const litCount = Math.round(N * fillRatio * litFrac);
          const dollars = litCount * 90000;
          const plateP = clamp01((t - 37.0) / 0.5);        // YOUR STRUCTURE: $0
          const DIM = [58, 66, 88], LM = [207, 255, 5];
          const MAP_CX = "27%", MAP_CY = "45%";
          return (
            <div style={{ opacity: on }}>
              {/* soft legibility scrim behind the left column */}
              <div style={{ position: "absolute", left: MAP_CX, top: "48%", transform: "translate(-50%,-50%)", width: MAP_W * 1.34, height: u * 82, background: `radial-gradient(ellipse at center, rgba(11,13,18,0.8) 0%, rgba(11,13,18,0.58) 45%, transparent 78%)`, pointerEvents: "none" }} />

              {/* framed panel so the map reads clearly over the footage */}
              <div style={{ position: "absolute", left: MAP_CX, top: "48%", transform: "translate(-50%,-50%)", width: MAP_W * 1.30, height: u * 47, background: "linear-gradient(180deg, rgba(19,22,30,0.94) 0%, rgba(11,13,18,0.96) 100%)", border: `${u * 0.1}px solid rgba(231,233,238,0.16)`, borderRadius: u * 1.3, boxShadow: `0 ${u * 0.9}px ${u * 2.8}px rgba(0,0,0,0.6)`, pointerEvents: "none" }} />

              <div style={{ position: "absolute", left: MAP_CX, top: "10%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.8, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 31.8) / 0.4) }}>THE <Marker u={u} t={t} at={32.1}>$90K</Marker> QUESTION</div>
              <div style={{ position: "absolute", left: MAP_CX, top: "18%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.14em", color: SILVER_SOFT, textTransform: "uppercase", whiteSpace: "nowrap", opacity: clamp01((t - 32.2) / 0.4) }}>U.S. BUSINESSES PAY DATA SCIENTISTS</div>

              {/* the real US map, filled with a dot grid that lights up lime */}
              <div style={{ position: "absolute", left: MAP_CX, top: MAP_CY, transform: "translate(-50%,-50%)", width: MAP_W, height: MAP_H }}>
                {/* SOLID US silhouette — a soft raisin/olive fill so the country shape reads immediately */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(50,58,32,0.82) 0%, rgba(33,40,24,0.9) 100%)", ...maskStyle }} />
                {/* subtle lime wash + inner glow on the silhouette */}
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(207,255,5,0.12) 0%, rgba(207,255,5,0.04) 55%, transparent 80%)", ...maskStyle }} />
                {/* DENSITY layer: many small dim dots, clipped to the silhouette, for texture */}
                <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${DCOLS}, 1fr)`, gridTemplateRows: `repeat(${DROWS}, 1fr)`, justifyItems: "center", alignItems: "center", ...maskStyle }}>
                  {Array.from({ length: DN }).map((_, i) => {
                    const ord = ((i * 47 + 13) % 100) / 100;
                    const app = clamp01((t - 31.7) / 0.6);
                    const dl = clamp01((litFrac * 1.05 - ord) / 0.1);
                    return <div key={i} style={{ width: u * 0.26, height: u * 0.26, borderRadius: "50%", background: rgbMix(DIM, LM, dl * 0.85), opacity: app * (0.32 + 0.5 * dl) }} />;
                  })}
                </div>
                {/* MAIN dot grid, clipped to the silhouette, lights up lime */}
                <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)`, justifyItems: "center", alignItems: "center", ...maskStyle }}>
                  {Array.from({ length: N }).map((_, i) => {
                    const ord = ((i * 73 + 29) % 100) / 100;            // deterministic light-up order
                    const app = clamp01((t - 31.7) / 0.5);
                    const dl = clamp01((litFrac - ord) / 0.06);         // this dot's lit strength
                    const color = rgbMix(DIM, LM, dl);
                    return <div key={i} style={{ width: u * 0.66, height: u * 0.66, borderRadius: "50%", background: color, opacity: app * (0.6 + 0.4 * dl), transform: `scale(${0.55 + 0.45 * dl})`, boxShadow: dl > 0.5 ? `0 0 ${u * 0.4}px ${LIME}cc` : "none" }} />;
                  })}
                </div>
              </div>

              {/* running tally: each lit dot ≈ $90k in data-scientist salary */}
              <div style={{ position: "absolute", left: MAP_CX, top: "76%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.5, opacity: clamp01((t - 33.0) / 0.4) }}>
                <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 2.9, color: LIME, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textShadow: `0 0 ${u * 1.2}px ${LIME}55` }}>${dollars.toLocaleString("en-US")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: u * 0.5 }}>
                  <span style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: LIME, flexShrink: 0, boxShadow: `0 0 ${u * 0.35}px ${LIME}` }} />
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.06em", color: SILVER_SOFT, textTransform: "uppercase", whiteSpace: "nowrap" }}>each ≈ $90k / yr per data scientist</span>
                </div>
              </div>

              {/* the payoff */}
              {plateP > 0 && (
                <div style={{ position: "absolute", left: MAP_CX, top: "86%", transform: "translate(-50%,-50%)", clipPath: `inset(-8% ${(1 - plateP) * 102 - 1}% -8% -1%)` }}>
                  <div style={{ background: LIME, padding: `${u * 0.5}px ${u * 1.4}px`, borderRadius: u * 0.3, transform: "rotate(-1.2deg)" }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: RAISIN, whiteSpace: "nowrap", textTransform: "uppercase" }}>THIS STRUCTURE: $0</span>
                  </div>
                </div>
              )}
            </div>
          ); })()}


      {/* ================= OVERLAYS ON FOOTAGE ================= */}
      {/* B1: ONE MORE UNLOCK — a clean padlock clicks open, plate reveals */}
      {t < 3.3 && (() => {
        const inP = clamp01((t - 1.9) / 0.45);
        const open = clamp01((t - 2.35) / 0.35);        // shackle swings open
        const out = 1 - clamp01((t - 2.9) / 0.4);
        if (inP <= 0) return null;
        const pop = lerp(0.9, 1, clamp01((t - 1.9) / 0.5));
        return (
          <div style={{ position: "absolute", left: "50%", top: "80%", transform: `translate(-50%,-50%) scale(${pop})`, opacity: out }}>
            <div style={{ display: "flex", alignItems: "center", gap: u * 1.1 }}>
              {/* padlock in a raisin disc */}
              <div style={{ position: "relative", width: u * 4.6, height: u * 4.6, borderRadius: "50%", background: RAISIN, border: `${u * 0.14}px solid ${LIME}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: open > 0.5 ? `0 0 ${u * 1.6}px ${LIME}66` : "none" }}>
                <svg width={u * 2.8} height={u * 2.8} viewBox="0 0 36 36">
                  <g transform={`rotate(${open * 36} 25 15) translate(0 ${-open * 1.6})`}>
                    <path d="M11 18 v-5 a7 7 0 0 1 14 0 v5" fill="none" stroke={LIME} strokeWidth={2.8} strokeLinecap="round" />
                  </g>
                  <rect x={7} y={17} width={22} height={14} rx={3} fill={LIME} />
                  <circle cx={18} cy={22.5} r={1.9} fill={RAISIN} />
                  <rect x={17.1} y={22.5} width={1.8} height={4.4} rx={0.9} fill={RAISIN} />
                </svg>
              </div>
              {/* label plate wipes in */}
              <div style={{ clipPath: `inset(-10% ${(1 - inP) * 102 - 1}% -10% -1%)` }}>
                <div style={{ background: LIME, padding: `${u * 0.5}px ${u * 1.3}px`, borderRadius: u * 0.3 }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: RAISIN, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>ONE MORE UNLOCK</span>
                </div>
              </div>
            </div>
          </div>
        ); })()}

      {/* B11: links chip with bobbing arrow */}
      {t >= 39.6 && t < 43.9 && (() => { const on = clamp01((t - 40.9) / 0.35) * (1 - clamp01((t - 43.5) / 0.35));
        const bob = Math.abs(Math.sin((t - 40.9) * 4)) * clamp01(1 - (t - 40.9) / 1.6) * u * 0.5;
        return (
          <div style={{ position: "absolute", left: "50%", top: `calc(80% + ${bob}px)`, transform: "translate(-50%,-50%)", opacity: on }}>
            <div style={{ display: "flex", alignItems: "center", gap: u * 0.6, background: RAISIN, border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.6, padding: `${u * 0.7}px ${u * 1.6}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, color: LIME, whiteSpace: "nowrap" }}>
              <Img src={staticFile("logos/lucide-link-lime.svg")} style={{ width: u * 1.1, height: u * 1.1, flexShrink: 0 }} />
              LINKS IN DESCRIPTION
            </div>
          </div>
        ); })()}

      {/* B13: like + subscribe — the REAL subscribe click, composited as a framed inset */}
      {t >= 50.4 && (() => {
        const out = 1 - clamp01((t - 52.6) / 0.6);
        const inO = clamp01((t - 50.5) / 0.4);
        return (
          <div style={{ position: "absolute", left: "50%", top: "74%", transform: `translate(-50%,-50%) scale(${lerp(0.94, 1, inO)})`, opacity: out * inO }}>
            <div style={{ position: "relative", padding: u * 0.5, background: RAISIN, border: `${u * 0.08}px solid rgba(231,233,238,0.14)`, borderRadius: u * 0.95, boxShadow: `0 ${u * 0.7}px ${u * 2.4}px rgba(0,0,0,0.6)` }}>
              <div style={{ width: u * 46, height: u * (46 * 716 / 1284), borderRadius: u * 0.55, overflow: "hidden", background: RAISIN_DEEP }}>
                <Sequence from={Math.round(50.5 * FPS)} layout="none">
                  <OffthreadVideo src={staticFile("assets/subscribe-bug-21k.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </Sequence>
              </div>
            </div>
          </div>
        ); })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default Act4;
