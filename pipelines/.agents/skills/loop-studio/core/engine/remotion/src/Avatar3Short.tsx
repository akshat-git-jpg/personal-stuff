/**
 * Avatar3Short — 9:16 BuildLoop-branded short built on the HeyGen "avatar-3" head.
 * Full-frame talking head + word-timed karaoke captions (lime marker on "unlimited")
 * + an enacted terminal beat on "command line". Brand palette/fonts from bb/brandfonts.
 * Duration LOCKED to the head clip (7.063s @30fps = 212 frames).
 */
import React from "react";
import {
  AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, Easing, staticFile, spring, useVideoConfig,
} from "remotion";
import { SANS, MONO, RAISIN, SILVER, SILVER_MID, BODY, LIME } from "./bb/brandfonts";
import WORDS from "./avatar3_words.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

type Word = [number, number, string];
const W = WORDS as Word[];

// Phrase grouping (start sec, end sec, word indices) — one caption block per phrase.
const PHRASES: { a: number; b: number; idx: number[] }[] = [
  { a: 0.0, b: 1.6, idx: [0, 1, 2, 3, 4, 5] },        // Hey, this is a quick test
  { a: 1.6, b: 3.4, idx: [6, 7, 8, 9, 10] },          // of our unlimited avatar pipeline,
  { a: 3.5, b: 5.05, idx: [11, 12, 13] },             // generated and downloaded
  { a: 5.05, b: 7.06, idx: [14, 15, 16, 17, 18] },    // straight from the command line.
];

const ease1 = (frame: number, at: number, d = 10) =>
  interpolate(frame, [at, at + d], [0, 1], { ...clamp, easing: EASE });
const window1 = (frame: number, at: number, out: number, d = 8) =>
  Math.min(ease1(frame, at, d), interpolate(frame, [out - d, out], [1, 0], clamp));

/* ---- top brand eyebrow ---- */
const Eyebrow: React.FC = () => {
  const frame = useCurrentFrame();
  const o = ease1(frame, f(0.15), 14);
  const y = interpolate(o, [0, 1], [-18, 0]);
  return (
    <div style={{
      position: "absolute", top: 96, left: 0, right: 0, display: "flex", justifyContent: "center",
      gap: 14, alignItems: "center", opacity: o, transform: `translateY(${y}px)`,
    }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: LIME, boxShadow: `0 0 18px ${LIME}` }} />
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.34em", color: SILVER }}>
        LOOP&nbsp;STUDIO
      </span>
      <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, letterSpacing: "0.34em", color: BODY }}>
        / AVATAR
      </span>
    </div>
  );
};

/* ---- "UNLIMITED" chip that pops on the spoken word ---- */
const UnlimitedChip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const on = window1(frame, f(1.94), f(3.5), 8);
  if (on <= 0) return null;
  const s = spring({ frame: frame - f(1.94), fps, config: { damping: 12, stiffness: 180 } });
  const sc = interpolate(Math.min(s, 1), [0, 1], [0.7, 1]);
  return (
    <div style={{
      position: "absolute", top: 176, left: 0, right: 0, display: "flex", justifyContent: "center",
      opacity: on, transform: `scale(${sc})`,
    }}>
      <span style={{
        fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: "0.14em", color: RAISIN,
        background: LIME, padding: "10px 22px", borderRadius: 0, boxShadow: `0 12px 34px -10px ${LIME}88`,
      }}>
        UNLIMITED
      </span>
    </div>
  );
};

/* ---- enacted terminal card on "command line" ---- */
const TerminalCard: React.FC = () => {
  const frame = useCurrentFrame();
  const inAt = f(5.5);
  const on = ease1(frame, inAt, 12);
  if (on <= 0) return null;
  const y = interpolate(on, [0, 1], [40, 0]);
  const cmd = "$ loop avatar --generate --download";
  const typed = Math.floor(interpolate(frame, [f(5.7), f(6.7)], [0, cmd.length], clamp));
  const caret = Math.floor((frame / 8)) % 2 === 0;
  return (
    <div style={{
      position: "absolute", top: 250, left: 70, right: 70, opacity: on, transform: `translateY(${y}px)`,
    }}>
      <div style={{
        background: "rgba(12,14,20,0.92)", border: `1px solid ${SILVER_MID}33`, borderRadius: 14,
        boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${SILVER_MID}22` }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: "#FF5F57" }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: "#FEBC2E" }} />
          <span style={{ width: 12, height: 12, borderRadius: 6, background: "#28C840" }} />
          <span style={{ fontFamily: MONO, fontSize: 20, color: BODY, marginLeft: 12, letterSpacing: "0.12em" }}>zsh</span>
        </div>
        <div style={{ padding: "22px 22px 26px", fontFamily: MONO, fontSize: 30, color: SILVER, lineHeight: 1.5 }}>
          <span style={{ color: LIME }}>{cmd.slice(0, typed)}</span>
          {typed < cmd.length && caret && <span style={{ color: LIME }}>▋</span>}
        </div>
      </div>
    </div>
  );
};

/* ---- word-timed karaoke caption (active phrase, current word lime) ---- */
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const p = PHRASES.find((ph) => t >= ph.a - 0.12 && t < ph.b + 0.18);
  if (!p) return null;
  const o = window1(frame, f(p.a - 0.05), f(p.b + 0.12), 6);
  return (
    <div style={{
      position: "absolute", left: 70, right: 70, top: 1180, display: "flex", flexWrap: "wrap",
      justifyContent: "center", gap: "10px 16px", opacity: o,
    }}>
      {p.idx.map((wi) => {
        const [ws, we, tok] = W[wi];
        const spoken = t >= ws;
        const active = t >= ws && t < we + 0.08;
        const isMarker = tok.toLowerCase().replace(/[^a-z]/g, "") === "unlimited";
        const color = isMarker && spoken ? RAISIN : active ? LIME : spoken ? SILVER : SILVER_MID + "77";
        const bg = isMarker && spoken ? LIME : "transparent";
        return (
          <span key={wi} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: 60, lineHeight: 1.06, color,
            background: bg, padding: isMarker ? "2px 14px" : 0,
            letterSpacing: "-0.01em", transition: "none",
            textShadow: bg === "transparent" ? "0 3px 10px rgba(0,0,0,0.55)" : "none",
          }}>
            {tok}
          </span>
        );
      })}
    </div>
  );
};

export const Avatar3Short: React.FC = () => {
  const frame = useCurrentFrame();
  const inO = interpolate(frame, [0, 8], [0, 1], clamp);
  const outO = interpolate(frame, [f(6.7), f(7.05)], [1, 0.0], clamp);
  return (
    <AbsoluteFill style={{ background: RAISIN }}>
      {/* full-frame head (720x1280 → 1080x1920 fill) */}
      <AbsoluteFill style={{ opacity: inO * outO }}>
        <OffthreadVideo
          src={staticFile("projects/avatar3/head.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {/* legibility scrims top + bottom */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(12,14,20,0.72) 0%, rgba(12,14,20,0) 22%, rgba(12,14,20,0) 58%, rgba(12,14,20,0.82) 100%)" }} />
      <Eyebrow />
      <UnlimitedChip />
      <TerminalCard />
      <Captions />
      {/* end tag */}
      <div style={{
        position: "absolute", bottom: 96, left: 0, right: 0, textAlign: "center",
        fontFamily: MONO, fontWeight: 500, fontSize: 24, letterSpacing: "0.3em", color: SILVER_MID,
        opacity: interpolate(frame, [f(5.6), f(6.2)], [0, 1], clamp),
      }}>
        BUILD-LOOP.AI
      </div>
    </AbsoluteFill>
  );
};
