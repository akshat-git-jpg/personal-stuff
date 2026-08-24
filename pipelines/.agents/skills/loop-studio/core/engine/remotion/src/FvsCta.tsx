/**
 * FvsCta — the MID (Loop Studio plug) + OUTRO for the Fable 5 vs Sol 5.6 video.
 * Designed treatment over the talking-head footage: every spoken clause becomes an
 * enacted, on-brand graphic (BuildLoop/Loop Studio look — raisin + lime + Space
 * Grotesk), synced to the SRT phrase timings. 30fps to match the footage.
 * Audio = the mastered _studio clips (staged at public/fvs/).
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { clamp01, EASE_OVER, RAISIN, LIME, SILVER_MID, SANS, MONO, WHITE, GRAIN_URL } from "./bb2/scene";

const FPS = 30;
const ic = (n: string) => staticFile(`logos/lucide-${n}.svg`);
const ap = (t: number, at: number, d = 0.4) => clamp01((t - at) / d);
const pop = (p: number) => interpolate(p, [0, 1], [0.72, 1], { easing: EASE_OVER });
const win = (t: number, a: number, b: number, fi = 0.35, fo = 0.35) => ap(t, a, fi) * (1 - clamp01((t - b) / fo));

/* ---------- footage + legibility grade ---------- */
const Head: React.FC<{ src: string }> = ({ src }) => (
  <>
    <OffthreadVideo src={staticFile(src)} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.05) saturate(1.05) brightness(0.9)" }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(9,11,17,0.5) 0%, transparent 20%, transparent 52%, rgba(9,11,17,0.82) 100%)", pointerEvents: "none" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 82% 74% at 50% 44%, transparent 55%, rgba(0,0,0,0.34))", pointerEvents: "none" }} />
  </>
);
const Grain: React.FC = () => <AbsoluteFill style={{ backgroundImage: `url(${GRAIN_URL})`, backgroundSize: "260px", opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none" }} />;

/* ---------- brand lockup: lime mark + LOOP STUDIO ---------- */
const BrandLockup: React.FC<{ u: number; t: number; at: number; end: number; big?: boolean; sub?: string }> = ({ u, t, at, end, big, sub }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const s = pop(ap(t, at, 0.45));
  const m = big ? 1.5 : 1;
  const pos: React.CSSProperties = big
    ? { left: "50%", top: "70%", transform: `translate(-50%,-50%) scale(${s})`, justifyContent: "center" }
    : { left: "7%", top: "13%", transform: `translateY(${(1 - ap(t, at, 0.5)) * u * 1.5}px) scale(${s})`, transformOrigin: "left center" };
  return (
    <div style={{ position: "absolute", opacity: o, display: "flex", alignItems: "center", gap: u * 1.2 * m, ...pos }}>
      <div style={{ width: u * 6.4 * m, height: u * 6.4 * m, borderRadius: u * 1.3 * m, background: LIME, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${u * 0.7}px ${u * 1.8}px rgba(0,0,0,0.45)` }}>
        <Img src={staticFile("brand/mark-white.svg")} style={{ width: "60%", height: "60%", filter: "brightness(0)" }} />
      </div>
      <div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4 * m, letterSpacing: "0.01em", color: WHITE, lineHeight: 1, textTransform: "uppercase" }}>Loop&nbsp;Studio</div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15 * m, letterSpacing: "0.22em", color: LIME, marginTop: u * 0.45 }}>{sub || "AI EDITS YOUR VIDEOS"}</div>
      </div>
    </div>
  );
};

/* ---------- lime stamp ---------- */
const Stamp: React.FC<{ u: number; t: number; at: number; end: number; x: number; y: number; text: string; rot?: number }> = ({ u, t, at, end, x, y, text, rot = -3 }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const s = interpolate(ap(t, at, 0.28), [0, 1], [1.4, 1], { easing: EASE_OVER });
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`, opacity: o }}>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3, letterSpacing: "0.01em", color: RAISIN, background: LIME, padding: `${u * 0.5}px ${u * 1.4}px`, borderRadius: u * 0.6, textTransform: "uppercase", boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.4)` }}>{text}</span>
    </div>
  );
};

/* ---------- icon chip (dark card, lime hard-offset) ---------- */
const Chip: React.FC<{ u: number; t: number; at: number; end: number; x: number; y: number; icon: string; label: string }> = ({ u, t, at, end, x, y, icon, label }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const s = pop(ap(t, at, 0.4));
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${s})`, opacity: o }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.8, transform: `translate(${u * 0.5}px,${u * 0.5}px)`, opacity: 0.9 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: u * 1.1, background: "#141a26", border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.8, padding: `${u}px ${u * 1.5}px` }}>
          <Img src={ic(icon)} style={{ width: u * 2.8, height: u * 2.8 }} />
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.1, color: WHITE, textTransform: "uppercase", lineHeight: 1 }}>{label}</span>
        </div>
      </div>
    </div>
  );
};

/* ---------- guarantee seal ---------- */
const Guarantee: React.FC<{ u: number; t: number; at: number; end: number }> = ({ u, t, at, end }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const s = pop(ap(t, at, 0.45)); const spin = (1 - ap(t, at, 0.6)) * -14;
  const D = u * 18;
  return (
    <div style={{ position: "absolute", left: "78%", top: "49%", transform: `translate(-50%,-50%) rotate(${spin}deg) scale(${s})`, opacity: o }}>
      <div style={{ width: D, height: D, borderRadius: "50%", background: "#141a26", border: `${u * 0.5}px solid ${LIME}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `0 ${u}px ${u * 3}px rgba(0,0,0,0.55)`, gap: u * 0.35 }}>
        <Img src={ic("clock-4-lime")} style={{ width: u * 3.8, height: u * 3.8 }} />
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.5, color: WHITE, lineHeight: 0.92, textAlign: "center" }}>24-HR<br />REFUND</div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: LIME, letterSpacing: "0.16em" }}>NO RISK</div>
      </div>
    </div>
  );
};

/* ---------- link-in-description pointer ---------- */
const LinkPointer: React.FC<{ u: number; t: number; at: number; end: number }> = ({ u, t, at, end }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const s = pop(ap(t, at, 0.35)); const bob = Math.sin((t - at) * 6) * u * 0.5;
  return (
    <div style={{ position: "absolute", left: "50%", top: "83%", transform: `translate(-50%,-50%) scale(${s})`, opacity: o, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: u, background: LIME, borderRadius: u * 0.7, padding: `${u * 0.8}px ${u * 1.6}px`, boxShadow: `0 ${u * 0.6}px ${u * 1.8}px rgba(0,0,0,0.4)` }}>
        <Img src={ic("link-dark")} style={{ width: u * 2.2, height: u * 2.2 }} />
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.1, color: RAISIN, textTransform: "uppercase" }}>Link in the description</span>
      </div>
      <div style={{ transform: `translateY(${bob}px)`, width: 0, height: 0, borderLeft: `${u * 1.1}px solid transparent`, borderRight: `${u * 1.1}px solid transparent`, borderTop: `${u * 1.4}px solid ${LIME}` }} />
    </div>
  );
};

/* ---------- Fable vs Sol callback ---------- */
const VersusMini: React.FC<{ u: number; t: number; at: number; end: number }> = ({ u, t, at, end }) => {
  const o = win(t, at, end, 0.3, 0.22); if (o <= 0.01) return null;
  const s = pop(ap(t, at, 0.3));
  const Cardy: React.FC<{ logo: string; name: string }> = ({ logo, name }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.6, background: "#fff", borderRadius: u, padding: `${u * 1.3}px ${u * 1.7}px`, boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.45)` }}>
      <Img src={staticFile(logo)} style={{ width: u * 4.2, height: u * 4.2, objectFit: "contain" }} />
      <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.4, color: RAISIN, letterSpacing: "0.06em" }}>{name}</span>
    </div>
  );
  return (
    <div style={{ position: "absolute", left: "50%", top: "76%", transform: `translate(-50%,-50%) scale(${s})`, opacity: o, display: "flex", alignItems: "center", gap: u * 2 }}>
      <Cardy logo="logos/claude.svg" name="FABLE 5" />
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: WHITE, background: RAISIN, padding: `${u * 0.3}px ${u}px`, borderRadius: u * 0.5 }}>VS</span>
      <Cardy logo="logos/chatgpt.svg" name="SOL 5.6" />
    </div>
  );
};

/* ---------- big title (outro) ---------- */
const BigTitle: React.FC<{ u: number; t: number; at: number; end: number; line1: string; mark?: string }> = ({ u, t, at, end, line1, mark }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const y = (1 - ap(t, at, 0.5)) * u * 2;
  return (
    <div style={{ position: "absolute", left: "50%", top: "79%", transform: `translate(-50%,-50%) translateY(${y}px)`, opacity: o, textAlign: "center" }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 4.6, color: WHITE, textTransform: "uppercase", lineHeight: 1, textShadow: "0 2px 18px rgba(0,0,0,0.65)" }}>
        {line1} {mark && <span style={{ background: LIME, color: RAISIN, padding: `0 ${u * 0.6}px`, borderRadius: u * 0.3 }}>{mark}</span>}
      </div>
    </div>
  );
};

/* ---------- like + subscribe (outro) ---------- */
const LikeSub: React.FC<{ u: number; t: number; at: number; end: number }> = ({ u, t, at, end }) => {
  const o = win(t, at, end); if (o <= 0.01) return null;
  const likeS = pop(ap(t, at, 0.3)); const subS = pop(ap(t, at + 0.3, 0.3));
  return (
    <div style={{ position: "absolute", left: "50%", top: "80%", transform: "translate(-50%,-50%)", opacity: o, display: "flex", gap: u * 2.4, alignItems: "center" }}>
      <div style={{ transform: `scale(${likeS})`, display: "flex", alignItems: "center", gap: u, background: "#141a26", border: `${u * 0.14}px solid ${LIME}`, borderRadius: u, padding: `${u * 1.1}px ${u * 2}px` }}>
        <Img src={ic("thumbs-up-lime")} style={{ width: u * 2.9, height: u * 2.9 }} />
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: WHITE, textTransform: "uppercase" }}>Like</span>
      </div>
      <div style={{ transform: `scale(${subS})`, display: "flex", alignItems: "center", gap: u, background: LIME, borderRadius: u, padding: `${u * 1.1}px ${u * 2.2}px`, boxShadow: `0 ${u * 0.7}px ${u * 2}px rgba(0,0,0,0.45)` }}>
        <div style={{ width: 0, height: 0, borderTop: `${u * 1.2}px solid transparent`, borderBottom: `${u * 1.2}px solid transparent`, borderLeft: `${u * 1.9}px solid ${RAISIN}`, marginRight: u * 0.3 }} />
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: RAISIN, textTransform: "uppercase" }}>Subscribe</span>
      </div>
    </div>
  );
};

/* ---------- next-video pointer (outro) ---------- */
const NextCard: React.FC<{ u: number; t: number; at: number; end: number }> = ({ u, t, at, end }) => {
  const o = win(t, at, end, 0.35, 0.2); if (o <= 0.01) return null;
  const s = pop(ap(t, at, 0.4)); const bob = Math.sin((t - at) * 5) * u * 0.6;
  return (
    <div style={{ position: "absolute", left: "50%", top: "79%", transform: `translate(-50%,-50%) scale(${s})`, opacity: o, display: "flex", alignItems: "center", gap: u * 1.5 }}>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.9, color: WHITE, textTransform: "uppercase", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>See you in the next one</span>
      <div style={{ transform: `translateX(${bob}px)`, width: 0, height: 0, borderTop: `${u * 1.3}px solid transparent`, borderBottom: `${u * 1.3}px solid transparent`, borderLeft: `${u * 2}px solid ${LIME}` }} />
    </div>
  );
};

/* ================= MID (Loop Studio plug) ================= */
export const FvsMid: React.FC = () => {
  const frame = useCurrentFrame(); const t = frame / FPS; const { width: W } = useVideoConfig(); const u = W / 100;
  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("fvs/mid.mp4")} />
      <Head src="fvs/mid.mp4" />
      {/* B1 0.0-2.7 "I've made Loop Studio public" */}
      <BrandLockup u={u} t={t} at={0.2} end={6.6} />
      <Stamp u={u} t={t} at={0.9} end={2.75} x={73} y={19} text="Now Public" rot={-3} />
      {/* B2 2.8-6.9 "if you create videos ... no risk" */}
      <Chip u={u} t={t} at={3.0} end={6.3} x={75} y={72} icon="users-lime" label="For video creators" />
      <Stamp u={u} t={t} at={6.0} end={7.0} x={26} y={24} text="No Risk" rot={3} />
      {/* B3 7.0-10.1 "refund within 24 hours" */}
      <Guarantee u={u} t={t} at={7.1} end={10.2} />
      {/* B4 10.1-12.5 "link in the description" */}
      <LinkPointer u={u} t={t} at={10.2} end={12.55} />
      {/* B5 12.5-14.2 "back to the comparison" */}
      <VersusMini u={u} t={t} at={12.6} end={14.2} />
      <Grain />
    </AbsoluteFill>
  );
};

/* ================= OUTRO ================= */
export const FvsOutro: React.FC = () => {
  const frame = useCurrentFrame(); const t = frame / FPS; const { width: W } = useVideoConfig(); const u = W / 100;
  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("fvs/outro.mp4")} />
      <Head src="fvs/outro.mp4" />
      {/* B1 0.0-2.25 "thanks for sticking around" */}
      <BigTitle u={u} t={t} at={0.2} end={2.35} line1="Thanks for" mark="watching" />
      {/* B2 2.28-4.52 "like and subscribe" */}
      <LikeSub u={u} t={t} at={2.4} end={4.6} />
      {/* B3 4.52-5.79 "check out Loop Studio" */}
      <BrandLockup u={u} t={t} at={4.6} end={5.95} big sub="AI EDITS YOUR VIDEOS" />
      {/* B4 5.79-7.24 "link in the description" */}
      <LinkPointer u={u} t={t} at={5.95} end={7.3} />
      {/* B5 7.28-9.3 "next video" */}
      <NextCard u={u} t={t} at={7.35} end={9.3} />
      <Grain />
    </AbsoluteFill>
  );
};
