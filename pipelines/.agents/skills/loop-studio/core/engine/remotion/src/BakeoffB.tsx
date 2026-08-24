/**
 * BakeoffB — style proof "TWO-REGISTER WORLD" (Motion Grammar v2).
 * Registers carry MEANING: the DARK register (raisin void, lime light, parallax) is the LIVING business;
 * the LIGHT register (worksheet page) is the FILE — flat, frozen, paper. The thesis is enacted by the
 * world itself: living chips ride a glowing stream, slam into a giant white page and DIE into flat grey
 * text lines; the camera pushes THROUGH the page into the paper world (photo vs movie, comments);
 * at the end the page tears open — reality still streams behind it — and a fresh order chip lands, unabsorbed.
 * Same narration segment 85.7–113.5s. Same brand system, both registers.
 */
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  FPS, f, MOVE, SNAP, POP, EASE, EASE_OVER,
  RAISIN, RAISIN_DEEP, STEEL, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE,
  SANS, MONO, SERIF, useAmbient,
} from "./bb2/engine";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const CHIP_LABELS = ["new order #4471", "payout €3,900", "DM: still there?", "+3 subscribers", "5★ review", "€1,240 paid", "refund request", "invoice sent"];

/* glowing chip (dark register) */
const Chip: React.FC<{ x: number; y: number; u: number; label: string; money?: boolean; scale?: number; opacity?: number; rot?: number }> = ({ x, y, u, label, money, scale = 1, opacity = 1, rot = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`, opacity }}>
    <div style={{ position: "relative", background: RAISIN_DEEP, border: `${u * 0.09}px solid ${money ? LIME : STEEL}`, borderRadius: u * 0.5, padding: `${u * 0.42}px ${u * 0.9}px`, boxShadow: money ? `0 0 ${u * 1.6}px ${LIME}44` : `0 0 ${u * 1.2}px rgba(52,62,91,0.5)`, display: "flex", alignItems: "center", gap: u * 0.5 }}>
      <span style={{ width: u * 0.5, height: u * 0.5, background: money ? LIME : STEEL, borderRadius: 1, flexShrink: 0 }} />
      <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.1, color: SILVER, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  </div>
);

/* light mini card (paper register) */
const MiniCard: React.FC<{ x: number; y: number; u: number; label: string; money?: boolean; scale?: number; grey?: boolean; opacity?: number }> = ({ x, y, u, label, money, scale = 1, grey, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${scale})`, opacity, filter: grey ? "grayscale(1) opacity(0.65)" : undefined }}>
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.4, transform: `translate(${u * 0.35}px,${u * 0.35}px)` }} />
      <div style={{ position: "relative", background: WHITE, border: `${u * 0.1}px solid ${RAISIN}`, borderRadius: u * 0.4, padding: `${u * 0.35}px ${u * 0.7}px` }}>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.0, color: RAISIN, whiteSpace: "nowrap" }}>{money ? "▪ " : "▫ "}{label}</span>
      </div>
    </div>
  </div>
);

export const BakeoffB: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  /* ---------------- phase map ----------------
     0.0–5.5   DARK: stream of chips flying toward viewer (parallax), "NOT A DOCUMENT / IT'S A STREAM"
     5.5–10.7  DARK: the white PAGE rises ahead; chips slam in, become dead grey lines; overflow bounces; page full → "CAN'T HOLD IT"
     10.7–15.2 TRANSITION: camera pushes THROUGH the page → LIGHT paper world; photo vs movie drawn
     15.2–21.4 LIGHT: comment box typed
     21.5–27.8 LIGHT→TEAR: page tears open, dark stream visible behind, a fresh chip flies out and lands; hold tension
  */

  /* dark→light crossfade driven by the push-through */
  const pushP = clamp01((t - 10.7) / 1.3); // 0 dark … 1 light
  const inLight = pushP >= 1;

  /* ------- dark register: chip stream (z-flight parallax) ------- */
  const chips = Array.from({ length: 26 }, (_, i) => {
    const born = i * 0.55 - 2.5;
    const speed = 0.24 + (i % 3) * 0.035;
    let zp = (t - born) * speed; // 0 far → 1 at camera
    const lane = i % 5;
    return { i, born, zp, lane, label: CHIP_LABELS[i % CHIP_LABELS.length], money: i % 3 !== 1 };
  });

  /* page (dark register object) — rises at 5.0, fills screen by push-through */
  const pageRise = clamp01((t - 5.0) / 0.9);
  const pageScale = 0.62 + pushP * 1.5; // grows as we push through
  const pageW = 46 * u * pageScale, pageH = 30 * u * pageScale;
  const pageX = W * 0.52, pageY = H * 0.47 - (1 - pageRise) * H * 0.5;

  /* chips that die into the page: impacts at fixed times */
  const impacts = [6.3, 7.05, 7.8, 8.55, 9.3];
  let pageShake = 0;
  for (const it of impacts) { const dt = t - it; if (dt > 0 && dt < 0.3) pageShake = Math.max(pageShake, Math.sin((1 - dt / 0.3) * Math.PI) * u * 0.5); }
  const deadLines = impacts.filter((it) => t > it).length;
  const fullAt = 9.3;
  const overflow = [9.55, 9.85];

  /* typing */
  const MSG = "am i missing something? roast me below";
  const typed = MSG.slice(0, Math.max(0, Math.floor((t - 16.6) * 14)));

  /* tear at the end */
  const tearP = clamp01((t - 21.8) / 1.1);
  const freshAt = 23.4;

  /* SFX are assembled in post — see scripts flow in motion_grammar_v2.md */

  const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

  /* ------- paper world content (revealed after push-through) ------- */
  const paper = (
    <AbsoluteFill style={{ background: SILVER, opacity: pushP }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${RAISIN}0d 1px,transparent 1px),linear-gradient(90deg,${RAISIN}0d 1px,transparent 1px)`, backgroundSize: `${u * 3.2}px ${u * 3.2}px` }} />
      {/* paper-world camera: zoom-settle on landing, then a gentle push toward the comment zone at 15.3 */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.25 - 0.25 * clamp01((t - 11.3) / 0.9)}) translateY(${-clamp01((t - 15.3) / 0.9) * 5}%) scale(${1 + clamp01((t - 15.3) / 0.9) * 0.14})`, transformOrigin: "50% 62%" }}>
        {/* photo vs movie */}
        {t > 12.2 && (
          <>
            <svg width={W} height={H} viewBox="0 0 100 56.25" style={{ position: "absolute", inset: 0 }}>
              <g opacity={clamp01((t - 12.2) / 0.5)}>
                <path d="M 14 14 l 26 0 l 0 24 l -26 0 z" stroke={RAISIN} strokeWidth={0.45} fill="none"
                  strokeDasharray={110} strokeDashoffset={110 * (1 - clamp01((t - 12.3) / 0.7))} />
                <path d="M 16.5 16.5 l 21 0 l 0 16 l -21 0 z" stroke={SILVER_MID} strokeWidth={0.3} fill="none"
                  strokeDasharray={80} strokeDashoffset={80 * (1 - clamp01((t - 12.7) / 0.6))} />
                <path d="M 60 13 l 28 0 l 0 20.5 l -28 0 z" stroke={RAISIN} strokeWidth={0.45} fill="none"
                  strokeDasharray={100} strokeDashoffset={100 * (1 - clamp01((t - 12.9) / 0.7))} />
                <path d="M 71 34.5 l 6 0 M 68.5 36.6 l 11 0" stroke={RAISIN} strokeWidth={0.42} fill="none" strokeLinecap="round"
                  strokeDasharray={20} strokeDashoffset={20 * (1 - clamp01((t - 13.3) / 0.4))} />
              </g>
            </svg>
            {/* frozen minis in photo */}
            {[0, 1, 2].map((i) => (
              <MiniCard key={`p${i}`} x={(21 + (i % 2) * 9) * u} y={(20 + i * 4.6) * u} u={u} label={["€90 paid", "DM", "order"][i]} money={i !== 1} grey opacity={clamp01((t - 13.0) / 0.4)} />
            ))}
            {/* moving minis in screen */}
            {[0, 1, 2].map((i) => {
              const lx = 62.5 + (((t * 5 + i * 8.6) % 23));
              if (lx > 85.5) return null;
              return <MiniCard key={`m${i}`} x={lx * u} y={(18.5 + (i % 2) * 6 + amb.bob(i, 0.4)) * u} u={u} label={["€90 paid", "DM", "order"][i]} money={i !== 1} opacity={clamp01((t - 13.2) / 0.4)} />;
            })}
            {t > 13.4 && (
              <div style={{ position: "absolute", left: 27 * u, top: 41.5 * u, transform: "translate(-50%,-50%)", opacity: clamp01((t - 13.4) / 0.3) }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.1, color: RAISIN, textTransform: "uppercase" }}>A FILE = A PHOTO</span>
              </div>
            )}
            {t > 14.1 && (
              <div style={{ position: "absolute", left: 74 * u, top: 38 * u, transform: "translate(-50%,-50%)", opacity: clamp01((t - 14.1) / 0.3) }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.1, color: RAISIN, textTransform: "uppercase" }}>
                  A BUSINESS ={" "}
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <span style={{ position: "absolute", left: -u * 0.3, right: -u * 0.3, top: "12%", bottom: "8%", background: LIME, transform: `scaleX(${clamp01((t - 14.4) / 0.4)}) rotate(-1.5deg)`, transformOrigin: "left center" }} />
                    <span style={{ position: "relative" }}>A MOVIE</span>
                  </span>
                </span>
              </div>
            )}
          </>
        )}
        {/* comment bubble — NO REFLOW: renders at its FINAL fixed size, text types into it.
            Fades out fully BEFORE the tear opens (nothing readable straddles a seam). */}
        {t > 15.8 && t < 21.8 && (() => {
          const on = clamp01((t - 15.9) / 0.5) * (1 - clamp01((t - 21.2) / 0.5));
          return (
            <div style={{ position: "absolute", left: "50%", top: `${46 / 56.25 * 100}%`, transform: `translate(-50%,-50%)`, opacity: on }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.8, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} />
                <div style={{ position: "relative", background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 0.8, padding: `${u * 0.9}px ${u * 1.4}px`, display: "flex", alignItems: "center", gap: u * 0.9, width: u * 36 }}>
                  <div style={{ width: u * 2.2, height: u * 2.2, borderRadius: "50%", border: `${u * 0.12}px solid ${RAISIN}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.1, color: RAISIN }}>?</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.35, color: RAISIN, whiteSpace: "nowrap" }}>
                    {typed}
                    {Math.floor(t * 2.4) % 2 === 0 && t < 21 && <span style={{ display: "inline-block", width: u * 0.6, height: u * 1.4, background: LIME, verticalAlign: "-15%" }} />}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      {/* VOICE ONLY — music + SFX are mixed in post (motion_grammar_v2: mix in post, not in-comp) */}
      <Audio src={staticFile("intros/businessbrain/bakeoff_voice.m4a")} />

      {/* ================= DARK REGISTER ================= */}
      {pushP < 1 && (
        <AbsoluteFill style={{ opacity: 1 - pushP }}>
          {/* void depth glow */}
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 52% 45%, ${RAISIN_DEEP} 0%, ${RAISIN} 70%)` }} />
          {/* the stream: a glowing lime wire in perspective */}
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="wire" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={LIME} stopOpacity="0" />
                <stop offset="0.35" stopColor={LIME} stopOpacity="0.9" />
                <stop offset="1" stopColor={LIME} stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <path d={`M ${-W * 0.05} ${H * 0.78} C ${W * 0.3} ${H * 0.72}, ${W * 0.42} ${H * 0.58}, ${W * 0.52} ${H * 0.47} S ${W * 0.85} ${H * 0.28}, ${W * 1.06} ${H * 0.18}`}
              stroke="url(#wire)" strokeWidth={u * 0.35} fill="none" strokeLinecap="round"
              strokeDasharray={`${u * 2.4} ${u * 1.4}`} strokeDashoffset={-t * u * 7}
              style={{ filter: `drop-shadow(0 0 ${u * 0.8}px ${LIME}aa)` }} />
          </svg>

          {/* chips flying in depth along the wire — THROUGH the frame and off the top-right;
              once the page is up they die at its surface (become dead lines) */}
          {chips.map((c) => {
            if (c.zp <= 0 || c.zp > 1.55) return null;
            const zp = c.zp;
            // path follows the wire: lower-left far → mid → exits top-right
            const px = W * (0.08 + 0.64 * zp) + (c.lane - 2) * u * (6 - 3.8 * Math.min(1, zp));
            const py = H * (0.8 - 0.42 * zp) + (c.lane % 2 ? 1 : -1) * u * (2.5 - 1.5 * Math.min(1, zp)) + amb.bob(c.i * 0.5, 0.4) * u;
            const sc = 0.35 + Math.min(1.15, zp) * 0.85;
            // page surface: cull chips as they reach it once risen
            if (pageRise > 0.5 && px > pageX - pageW * 0.42) return null;
            return <Chip key={c.i} x={px} y={py} u={u} label={c.label} money={c.money} scale={sc} opacity={Math.min(1, zp * 3)} rot={(c.lane - 2) * 2} />;
          })}

          {/* headline (dark register type = silver + lime marker) — NO REFLOW: each line owns a fixed position */}
          {t > 0.9 && t < 5.4 && (
            <div style={{ position: "absolute", left: "50%", top: "12%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 0.9) / 0.4) }}>
              NOT A DOCUMENT.
            </div>
          )}
          {t > 2.3 && t < 5.4 && (
            <div style={{ position: "absolute", left: "50%", top: "19.5%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 2.3) / 0.4) }}>
              IT'S A{" "}
              <span style={{ position: "relative", display: "inline-block" }}>
                <span style={{ position: "absolute", left: -u * 0.3, right: -u * 0.3, top: "14%", bottom: "10%", background: LIME, transform: `scaleX(${clamp01((t - 3.4) / 0.45)}) rotate(-1.5deg)`, transformOrigin: "left center" }} />
                <span style={{ position: "relative", zIndex: 1 }}>
                  <span style={{ color: clamp01((t - 3.4) / 0.45) > 0.4 ? RAISIN : SILVER }}>STREAM.</span>
                </span>
              </span>
            </div>
          )}

          {/* THE PAGE — business.md rising like a wall */}
          {pageRise > 0 && (
            <div style={{ position: "absolute", left: pageX + pageShake, top: pageY, transform: `translate(-50%,-50%)` }}>
              <div style={{ width: pageW, height: pageH, background: SILVER, borderRadius: u * 0.4, boxShadow: `0 0 ${u * 3}px rgba(233,236,237,0.25)`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${RAISIN}0a 1px,transparent 1px)`, backgroundSize: `${u * 1.6 * pageScale}px ${u * 1.6 * pageScale}px` }} />
                <div style={{ position: "absolute", left: "8%", top: "6%", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05 * pageScale, letterSpacing: "0.08em", color: BODY }}>business.md</div>
                {/* dead lines: each impact writes one flat grey line */}
                {Array.from({ length: deadLines }, (_, i) => (
                  <div key={i} style={{ position: "absolute", left: "8%", top: `${20 + i * 13}%`, width: `${52 + (i % 3) * 14}%`, height: u * 0.5 * pageScale, background: SILVER_MID, borderRadius: 2 }} />
                ))}
                {/* full stamp */}
                {t > fullAt && (
                  <div style={{ position: "absolute", left: "50%", top: "55%", transform: `translate(-50%,-50%) rotate(-6deg) scale(${0.7 + 0.3 * clamp01((t - fullAt) / 0.25)})`, opacity: clamp01((t - fullAt) / 0.25) }}>
                    <div style={{ background: RAISIN, padding: `${u * 0.4 * pageScale}px ${u * 0.9 * pageScale}px` }}>
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1 * pageScale, letterSpacing: "0.12em", color: LIME }}>✕ CAN'T HOLD IT</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* overflow chips bouncing off the full page */}
          {overflow.map((ot, i) => {
            const dt = t - ot;
            if (dt < 0 || dt > 1.2) return null;
            const x = pageX - pageW * 0.45 - dt * u * (10 + i * 4);
            const y = pageY + (dt * u * 6) + dt * dt * u * 26 - u * 4;
            return <Chip key={`o${i}`} x={x} y={y} u={u} label={CHIP_LABELS[(i + 3) % 8]} money scale={0.9} rot={-dt * 160} opacity={1 - dt / 1.2} />;
          })}
        </AbsoluteFill>
      )}

      {/* ================= LIGHT REGISTER (through the page) ================= */}
      {pushP > 0 && tearP === 0 && paper}

      {/* ================= THE PART (end): the worksheet parts like paper, reality behind ================= */}
      {tearP > 0 && (
        <>
          {/* the living dark world behind the parted page */}
          <AbsoluteFill>
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${RAISIN_DEEP} 0%, ${RAISIN} 75%)` }} />
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              <path d={`M ${W * 0.42} ${H * 0.9} C ${W * 0.46} ${H * 0.62}, ${W * 0.54} ${H * 0.42}, ${W * 0.5} ${H * 0.05}`}
                stroke={LIME} strokeWidth={u * 0.3} fill="none" strokeLinecap="round"
                strokeDasharray={`${u * 2.2} ${u * 1.3}`} strokeDashoffset={-t * u * 7}
                style={{ filter: `drop-shadow(0 0 ${u * 0.7}px ${LIME}aa)` }} />
            </svg>
            {[0, 1, 2].map((i) => {
              const p = ((t * 0.16 + i * 0.33) % 1);
              return <Chip key={i} x={W * (0.455 + Math.sin(p * 3) * 0.03)} y={H * (0.85 - p * 0.75)} u={u} label={CHIP_LABELS[(i * 2) % 8]} money={i !== 1} scale={0.5 + p * 0.25} opacity={Math.min(1, p * 4) * 0.95} rot={(i - 1) * 4} />;
            })}
          </AbsoluteFill>
          {/* left + right halves of the worksheet sliding apart (torn edges) */}
          {[0, 1].map((side) => (
            <AbsoluteFill key={side} style={{ clipPath: side === 0 ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)", transform: `translateX(${(side === 0 ? -1 : 1) * tearP * 16}%)` }}>
              {paper}
              {/* torn inner edge */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={side === 0
                  ? `M ${W * 0.5} 0 l ${-u * 0.7} ${H * 0.12} l ${u * 0.5} ${H * 0.11} l ${-u * 0.8} ${H * 0.13} l ${u * 0.6} ${H * 0.12} l ${-u * 0.5} ${H * 0.13} l ${u * 0.7} ${H * 0.13} l ${-u * 0.4} ${H * 0.26}`
                  : `M ${W * 0.5} 0 l ${u * 0.6} ${H * 0.13} l ${-u * 0.5} ${H * 0.12} l ${u * 0.8} ${H * 0.12} l ${-u * 0.6} ${H * 0.13} l ${u * 0.5} ${H * 0.12} l ${-u * 0.7} ${H * 0.14} l ${u * 0.5} ${H * 0.24}`}
                  stroke={SILVER_MID} strokeWidth={u * 0.25} fill="none" opacity={0.9} />
              </svg>
            </AbsoluteFill>
          ))}
          {/* fresh chip flies up out of the gap and lands on the left half */}
          {t > freshAt && (() => {
            const dt = t - freshAt;
            const p = clamp01(dt / 0.6);
            const ease = 1 - (1 - p) * (1 - p) * (1 - p);
            const x = W * 0.485 - ease * W * 0.22;
            const y = H * 0.55 - Math.sin(ease * Math.PI) * H * 0.28 + ease * H * 0.08;
            return <Chip x={x} y={y + (dt > 1 ? amb.bob(0.3, 0.35) * u : 0)} u={u} label="new order €1,850" money scale={1.1 + (1 - p) * 0.25} rot={(1 - p) * -16} />;
          })()}
          {/* quiet closing lines — INSIDE the dark gap so they read fully (seam rule) */}
          {t > 25.4 && (
            <div style={{ position: "absolute", left: "50%", top: "76%", transform: "translate(-50%,-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.75, color: SILVER, opacity: clamp01((t - 25.4) / 0.5), textShadow: `0 0 ${u * 1.2}px rgba(15,18,26,0.9)` }}>the business keeps moving.</div>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.75, color: SILVER, opacity: clamp01((t - 26.2) / 0.5), marginTop: u * 0.5, textShadow: `0 0 ${u * 1.2}px rgba(15,18,26,0.9)` }}>the file doesn't.</div>
            </div>
          )}
        </>
      )}

      {/* flash at push-through */}
      {pushP > 0 && pushP < 0.35 && <AbsoluteFill style={{ background: WHITE, opacity: (0.35 - pushP) * 1.4, pointerEvents: "none" }} />}

      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.35)`, pointerEvents: "none", opacity: 1 - pushP * 0.7 }} />
    </AbsoluteFill>
  );
};

export default BakeoffB;
