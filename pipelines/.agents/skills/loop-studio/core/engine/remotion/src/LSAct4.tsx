/**
 * LSAct4 — Loop Studio flagship act 4 (0–87.37s). The OFFER act.
 * Not only shorts → faster/cheaper/better → zoom OUT (bigger than the bill) → video is the
 * biggest ever → editing costs a fortune → THE BOTTLENECK REMOVED (replay spike) → attention
 * is scarce → whoever ships gets all of it → a 2-year head start → LOOP STUDIO name reveal →
 * yours exactly (brand.json) → the whole package ships (this_video.mp4 · LIVE) → nothing,
 * compared → Claude installs it → 3 steps, 5 minutes → outro + the hero card's final loop.
 * Footage plays from 0 (same take → lip sync). Voice only; SFX + music mixed in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Marker, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";
import { Win } from "./bb2/concepts";

const FPS = 30;
const fmtD = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* headline helper — GLOBAL TEXT RULE: every headline renders BOTTOM-MIDDLE at one exact
   placement (match all scenes). Legacy top/left/center/size props are accepted but ignored.
   SANS 800 uppercase, u*2.9, one lime Marker word, SILVER (dark) / RAISIN (light). */
const H1: React.FC<{ u: number; t: number; children: React.ReactNode; top?: string; left?: string; center?: boolean; size?: number; in0: number; out?: number; color?: string }> = ({ u, t, children, in0, out, color = SILVER }) => (
  <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.9, letterSpacing: "-0.02em", color, textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.7)", opacity: clamp01((t - in0) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

/* dark-register mono chip */
const ChipD: React.FC<{ x: number; y: number; u: number; text: React.ReactNode; lime?: boolean; grey?: boolean; o?: number; sc?: number; rot?: number }> = ({ x, y, u, text, lime, grey, o = 1, sc = 1, rot = 0 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`, opacity: o }}>
    <div style={{ background: grey ? "#1a1f2b" : RAISIN_DEEP, border: `${u * 0.1}px solid ${grey ? "#3a4256" : lime ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: grey ? SILVER_MID : lime ? LIME : SILVER, whiteSpace: "nowrap" }}>{text}</div>
  </div>
);

/* light-register chip: white card + raisin ink; plate = lime plate w/ raisin ink */
const ChipL: React.FC<{ x: number; y: number; u: number; text: React.ReactNode; plate?: boolean; grey?: boolean; o?: number; sc?: number; rot?: number; size?: number }> = ({ x, y, u, text, plate, grey, o = 1, sc = 1, rot = 0, size = 1.15 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`, opacity: o }}>
    <div style={{ background: plate ? LIME : WHITE, border: `${u * 0.11}px solid ${plate ? RAISIN : grey ? "#b5bfc2" : RAISIN}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, boxShadow: plate ? `${u * 0.35}px ${u * 0.35}px 0 rgba(15,18,26,0.9)` : `0 ${u * 0.4}px ${u * 1.2}px rgba(15,18,26,0.14)`, fontFamily: MONO, fontWeight: 700, fontSize: u * size, letterSpacing: "0.06em", color: grey ? BODY : RAISIN, whiteSpace: "nowrap" }}>{text}</div>
  </div>
);

/* the hero clip-card species: small polished 16:9 player, lime-edged when hero, 4 earned ticks */
const MiniCard: React.FC<{ u: number; hero?: boolean; s?: number; o?: number; glow?: number }> = ({ u, hero, s = 1, o = 1, glow = 0 }) => (
  <div style={{ transform: `scale(${s})`, opacity: o }}>
    <div style={{ position: "relative", width: u * 7, height: u * 4.4, background: "#12151d", border: `${u * 0.13}px solid ${hero ? LIME : SILVER_MID}`, borderRadius: u * 0.45, boxShadow: `0 ${u * 0.5}px ${u * 1.3}px rgba(0,0,0,0.55)${glow > 0.02 ? `, 0 0 ${u * (1 + glow * 1.6)}px ${LIME}${Math.round(40 + glow * 120).toString(16)}` : ""}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 0, height: 0, borderTop: `${u * 0.55}px solid transparent`, borderBottom: `${u * 0.55}px solid transparent`, borderLeft: `${u * 0.85}px solid ${hero ? LIME : SILVER_MID}`, marginLeft: u * 0.2 }} />
      {hero && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: u * 0.3, display: "flex", justifyContent: "center", gap: u * 0.45 }}>
          {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: u * 0.5, height: u * 0.5, borderRadius: "50%", background: LIME }} />)}
        </div>
      )}
    </div>
  </div>
);

/* business storefront silhouette — high contrast silver on dark */
const Shop: React.FC<{ u: number; dim?: number }> = ({ u, dim = 0 }) => (
  <svg width={u * 4.4} height={u * 3.9} viewBox="0 0 40 36" style={{ opacity: 1 - dim * 0.55, filter: `saturate(${1 - dim})` }}>
    <rect x={7} y={13} width={26} height={20} fill={dim > 0.5 ? "#4a5268" : SILVER_SOFT} />
    <path d="M4 13 L8 4 h24 l4 9 z" fill={dim > 0.5 ? "#5a6478" : SILVER} />
    <path d="M4 13 h32" stroke={RAISIN} strokeWidth={1.2} />
    <rect x={17} y={21} width={7} height={12} fill={RAISIN} />
    <rect x={10} y={17} width={5} height={5} fill={RAISIN} opacity={0.8} />
    <rect x={26} y={17} width={5} height={5} fill={RAISIN} opacity={0.8} />
  </svg>
);

/* empty dashed player-slot: the video this business doesn't have yet */
const Slot: React.FC<{ u: number; dim?: number; pulse?: number }> = ({ u, dim = 0, pulse = 0 }) => (
  <div style={{ transform: `scale(${1 + pulse * 0.1})`, width: u * 6.2, height: u * 3.8, border: `${u * 0.13}px dashed ${dim > 0.5 ? "#3a4256" : SILVER_MID}`, borderRadius: u * 0.45, display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - dim * 0.45, boxShadow: pulse > 0.03 ? `0 0 ${u * 1.4}px ${SILVER_MID}66` : "none" }}>
    <div style={{ width: 0, height: 0, borderTop: `${u * 0.45}px solid transparent`, borderBottom: `${u * 0.45}px solid transparent`, borderLeft: `${u * 0.7}px solid ${dim > 0.5 ? "#3a4256" : "#6a7288"}`, marginLeft: u * 0.15 }} />
  </div>
);

/* ---- real platform marks, brand-correct colours (SHORTS moment + the attention beat) ---- */
const TT_PATH = "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

const YouTubeMark: React.FC<{ u: number; size?: number }> = ({ u, size = 4.4 }) => (
  <svg width={u * size} height={u * size * 0.7} viewBox="0 0 48 34" style={{ filter: `drop-shadow(0 ${u * 0.3}px ${u * 0.9}px rgba(0,0,0,0.5))` }}>
    <rect x="0.5" y="0.5" width="47" height="33" rx="8.5" fill="#FF0000" />
    <path d="M19.5 9.5 L34 17 L19.5 24.5 Z" fill="#fff" />
  </svg>
);

const InstagramMark: React.FC<{ u: number; size?: number }> = ({ u, size = 4.4 }) => (
  <svg width={u * size} height={u * size} viewBox="0 0 48 48" style={{ filter: `drop-shadow(0 ${u * 0.3}px ${u * 0.9}px rgba(0,0,0,0.5))` }}>
    <defs>
      <radialGradient id="igg" cx="0.3" cy="1.05" r="1.25">
        <stop offset="0" stopColor="#FEDA75" />
        <stop offset="0.25" stopColor="#FA7E1E" />
        <stop offset="0.5" stopColor="#D62976" />
        <stop offset="0.75" stopColor="#962FBF" />
        <stop offset="1" stopColor="#4F5BD5" />
      </radialGradient>
    </defs>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#igg)" />
    <rect x="10.5" y="10.5" width="27" height="27" rx="8.5" fill="none" stroke="#fff" strokeWidth="3.1" />
    <circle cx="24" cy="24" r="7" fill="none" stroke="#fff" strokeWidth="3.1" />
    <circle cx="34.4" cy="13.6" r="2.5" fill="#fff" />
  </svg>
);

const TikTokMark: React.FC<{ u: number; size?: number }> = ({ u, size = 4.4 }) => (
  <svg width={u * size} height={u * size} viewBox="0 0 24 24" style={{ filter: `drop-shadow(0 ${u * 0.3}px ${u * 0.9}px rgba(0,0,0,0.55))` }}>
    <path d={TT_PATH} fill="#25F4EE" transform="translate(-0.9 0.7)" />
    <path d={TT_PATH} fill="#FE2C55" transform="translate(0.9 -0.5)" />
    <path d={TT_PATH} fill="#fff" />
  </svg>
);

/* the real YouTube Shorts mark: rounded-rect reel body + two diagonal nubs + white play triangle */
const ShortsLogo: React.FC<{ u: number; size?: number; rot?: number }> = ({ u, size = 9, rot = 0 }) => {
  const s = u * size;
  return (
    <svg width={s * 0.64} height={s} viewBox="0 0 64 100" fill="none" style={{ transform: `rotate(${rot}deg)`, filter: `drop-shadow(0 ${u * 0.5}px ${u * 1.3}px rgba(224,0,43,0.45))` }}>
      <defs>
        <linearGradient id="shg" x1="8" y1="8" x2="56" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF0037" /><stop offset="1" stopColor="#E4002B" />
        </linearGradient>
      </defs>
      <rect x="37" y="5" width="21" height="27" rx="10.5" fill="url(#shg)" transform="rotate(30 47.5 18.5)" />
      <rect x="6" y="68" width="21" height="27" rx="10.5" fill="url(#shg)" transform="rotate(30 16.5 81.5)" />
      <rect x="13" y="12" width="38" height="76" rx="18" fill="url(#shg)" />
      <path d="M26 33 L51 50 L26 67 Z" fill="#fff" />
    </svg>
  );
};

const TICKS = ["CUT ✓", "CODE ✓", "SOUND ✓", "TASTE ✓"];

export const LSAct4: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  /* Panel law: the panel moves ONLY in the short gap AT a beat boundary, holds still within. */
  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // arrive full
    { t: 0.3, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 1.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },  // beat 1: panel right (light)
    { t: 8.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 8.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },        // beats 2–4: hidden
    { t: 21.9, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 22.6, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beat 5: panel right
    { t: 25.9, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 26.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 6: hidden (replay spike)
    { t: 32.5, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 33.1, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 7: FULL
    { t: 36.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 37.2, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 8: hidden
    { t: 41.7, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 42.4, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 9: FULL
    { t: 45.9, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 46.6, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beats 10–11: panel right
    { t: 57.5, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 58.2, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 12: hidden (face moves INTO the player)
    { t: 63.1, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 63.8, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 13: FULL
    { t: 69.8, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 70.5, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 }, // beats 14–15: panel right
    { t: 80.7, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 81.4, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beat 16: FULL to the end
    { t: 87.4, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);
  /* LIGHT register: beats 1–2 (the worksheet carried out of Act 3), then beats 11–15 (the build/offer) */
  const liteWins: [number, number][] = [[-1, 13.35], [51.0, 80.9]];
  const lite = Math.max(...liteWins.map(([a, b]) => clamp01((t - a) / 0.5) * (1 - clamp01((t - b) / 0.5))), 0);
  const ink = lite > 0.5 ? RAISIN : SILVER;
  const inkSoft = lite > 0.5 ? BODY : SILVER_SOFT;

  /* beat 6 replay-spike shake on the break (32.25) */
  const shake = t > 32.25 && t < 32.75 ? Math.sin((t - 32.25) * 58) * (1 - (t - 32.25) / 0.5) * u * 0.55 : 0;
  /* beat 5 thud sag (23.85) */
  const sagT = t - 23.85;
  const sag = sagT > 0 && sagT < 0.45 ? Math.sin((1 - sagT / 0.45) * Math.PI) * u * 0.7 : 0;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("footage/ls_th4_voice.m4a")} />
      <DarkBg u={u} gridOpacity={sk.fr} />
      <LightBg u={u} opacity={lite} />

      {/* ============ GRAPHICS WORLD ============ */}
      <div style={{ position: "absolute", inset: 0, opacity: graphicsOn, transform: `translate(${shake}px,${shake * 0.5}px)` }}>

        {/* BEATS 1+2 — the LightWorld: the hero clip-card arrives, STRETCHES to 11:00, earns its
            verdict chips — then the WHOLE scene shrinks to a tile on "zoom out" (13.33). */}
        {t < 14.3 && (() => {
          const shrink = EASE(clamp01((t - 13.33) / 0.6));
          const wSc = lerp(1, 0.1, shrink);
          const wOn = 1 - clamp01((shrink - 0.8) / 0.2);
          const gl = EASE(clamp01((t - 0.3) / 0.7));           // glide in from off-left
          const en = EASE(clamp01((t - 8.4) / 0.6));           // enlarge to hero (beat 2)
          const stp = EASE(clamp01((t - 5.69) / 0.5));         // the STRETCH on "11"
          const secs = interpolate(t, [5.69, 6.19], [47, 660], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const cx = lerp(lerp(-16, 30, gl), 47, en);
          const cy = lerp(46, 40, en);
          const cs = lerp(1, 1.3, en);
          const bodyW = lerp(u * 11.5, u * 30, stp);
          const CHIPS = [
            { txt: "FASTER ✓", at: 9.41, x: 34 },
            { txt: "CHEAPER ✓", at: 10.03, x: 47 },
            { txt: "BETTER ✓", at: 11.05, x: 60, plate: true },
          ];
          const strike = clamp01((t - 11.89) / 0.3);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: wOn, transform: `scale(${wSc})`, transformOrigin: "46% 47%" }}>
              <H1 u={u} t={t} in0={1.63} out={8.4} top="20%" left="30%" center size={3.4} color={RAISIN}>NOT ONLY <Marker u={u} t={t} at={2.59} base={RAISIN}>SHORTS</Marker></H1>
              {/* the real YouTube Shorts mark POPS on "shorts" (2.59), floats, then hands off to the 11-min stretch */}
              {(() => {
                const sp = clamp01((t - 2.59) / 0.32);
                const so = sp * (1 - clamp01((t - 5.62) / 0.4));
                if (so <= 0) return null;
                const bob = Math.sin((t - 2.59) * 2.3) * 1.0;
                const wob = Math.sin((t - 2.59) * 1.7) * 3.2;
                return (
                  <div style={{ position: "absolute", left: "16%", top: `${20.5 + bob}%`, transform: `translate(-50%,-50%) scale(${0.55 + 0.45 * EASE_OVER(sp)})`, opacity: so }}>
                    <ShortsLogo u={u} size={11} rot={wob} />
                  </div>
                );
              })()}
              {/* the traveling hero clip-card — Act 3's polished final cut */}
              <div style={{ position: "absolute", left: `${cx}%`, top: `${cy}%`, transform: `translate(-50%,-50%) scale(${cs})` }}>
                <div style={{ position: "relative", width: bodyW, borderRadius: u * 0.7, overflow: "hidden", border: `${u * 0.14}px solid ${RAISIN}`, boxShadow: `0 ${u * 1.0}px ${u * 2.8}px rgba(15,18,26,0.28)`, background: "#12151d" }}>
                  <div style={{ height: u * 2.5, background: "#181c28", borderBottom: `${u * 0.08}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.5, padding: `0 ${u * 0.9}px` }}>
                    {[0, 1, 2].map((j) => <span key={j} style={{ width: u * 0.6, height: u * 0.6, borderRadius: "50%", background: "#3a4256", flexShrink: 0 }} />)}
                    <span style={{ marginLeft: u * 0.3, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.92, color: SILVER_SOFT, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{bodyW > u * 16 ? `final cut · ${fmtD(secs)}` : fmtD(secs)}</span>
                  </div>
                  <div style={{ height: lerp(u * 12, u * 11, stp), display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <div style={{ width: 0, height: 0, borderTop: `${u * 1.2}px solid transparent`, borderBottom: `${u * 1.2}px solid transparent`, borderLeft: `${u * 1.9}px solid ${SILVER}`, marginLeft: u * 0.4 }} />
                  </div>
                  {/* the long timeline strip appears WITH the stretch */}
                  <div style={{ height: u * 2.6, background: "#0f121a", borderTop: `${u * 0.08}px solid #232939`, opacity: stp, position: "relative", padding: `0 ${u * 1.0}px`, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1, height: u * 0.7, background: "#232939", borderRadius: u * 0.35 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", background: `${LIME}22`, borderRadius: u * 0.35 }} />
                      {Array.from({ length: 11 }).map((_, i) => <span key={i} style={{ position: "absolute", left: `${4 + i * 9.2}%`, top: "-32%", width: u * 0.07, height: "164%", background: "#39415a" }} />)}
                      {/* the four station ticks RE-STAMP along the long timeline (6.61→) */}
                      {TICKS.map((tk, i) => {
                        const so = clamp01((t - (6.61 + i * 0.22)) / 0.22);
                        if (so <= 0) return null;
                        return (
                          <div key={i} style={{ position: "absolute", left: `${11 + i * 24}%`, top: "50%", transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * so})`, opacity: so }}>
                            <span style={{ display: "inline-block", background: RAISIN_DEEP, border: `${u * 0.08}px solid ${LIME}`, borderRadius: u * 0.3, padding: `${u * 0.16}px ${u * 0.5}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.78, color: LIME, whiteSpace: "nowrap" }}>{tk}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* the earned station ticks — neat mono row beneath, raisin ink on the light page */}
                <div style={{ marginTop: u * 0.8, display: "flex", justifyContent: "center", gap: u * 0.8 }}>
                  {TICKS.map((tk, i) => {
                    const ro = clamp01((t - 0.9 - i * 0.14) / 0.3) * (1 - clamp01((t - (6.61 + i * 0.22)) / 0.22));
                    return <span key={i} style={{ opacity: ro, background: WHITE, border: `${u * 0.1}px solid ${RAISIN}`, borderRadius: u * 0.35, padding: `${u * 0.25}px ${u * 0.7}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: RAISIN, whiteSpace: "nowrap" }}>{tk}</span>;
                  })}
                </div>
              </div>
              {/* BEAT 2 — verdict chips punch in on their words; the human editor gets struck */}
              {t >= 9.0 && CHIPS.map((c, i) => {
                const o = clamp01((t - c.at) / 0.25);
                if (o <= 0) return null;
                return <ChipL key={i} x={c.x} y={73} u={u} text={c.txt} plate={c.plate} o={o} sc={0.85 + 0.15 * EASE_OVER(o)} size={1.5} />;
              })}
              {t >= 11.2 && (
                <div style={{ position: "absolute", left: "77.5%", top: "73%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 11.3) / 0.3) }}>
                  <div style={{ position: "relative", background: WHITE, border: `${u * 0.11}px solid #b5bfc2`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, color: BODY, whiteSpace: "nowrap" }}>
                    A HUMAN EDITOR
                    <div style={{ position: "absolute", left: u * 0.5, right: u * 0.5, top: "50%", height: u * 0.3, background: RAISIN, borderRadius: u * 0.15, transform: `translateY(-50%) scaleX(${strike}) rotate(-2deg)`, transformOrigin: "left center" }} />
                  </div>
                </div>
              )}
              {/* ...currently out for coffee (12.1) — the machine already shipped */}
              {t >= 12.02 && (() => {
                const co = clamp01((t - 12.09) / 0.32);
                const rise = Math.sin(t * 3.4) * 1.1;
                return (
                  <div style={{ position: "absolute", left: "89.5%", top: "65.5%", transform: `translate(-50%,-50%) rotate(7deg) scale(${0.65 + 0.35 * EASE_OVER(co)})`, opacity: co }}>
                    <svg width={u * 3.7} height={u * 3.7} viewBox="0 0 32 32" fill="none">
                      <path d={`M12 ${7 + rise} q -1.7 -2.2 0 -4.4 q 1.7 -2.2 0 -4.4`} stroke={BODY} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
                      <path d={`M18 ${7 - rise} q -1.7 -2.2 0 -4.4 q 1.7 -2.2 0 -4.4`} stroke={BODY} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
                      <path d="M6 13 h16 v6 a5 5 0 0 1 -5 5 h-6 a5 5 0 0 1 -5 -5 z" fill={WHITE} stroke={RAISIN} strokeWidth="1.9" strokeLinejoin="round" />
                      <path d="M22 14.5 h3 a3 3 0 0 1 0 6 h-2" fill="none" stroke={RAISIN} strokeWidth="1.9" strokeLinecap="round" />
                      <path d="M6.5 26.5 h15" stroke={RAISIN} strokeWidth="1.9" strokeLinecap="round" />
                    </svg>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* BEATS 3+4 — the proof tile in the void, then the all-time curve towering over it.
            MiniProof tile: the whole beats-1-2 scene kept alive in miniature. */}
        {t >= 13.6 && t < 22.6 && (() => {
          const on = clamp01((t - 13.7) / 0.35) * (1 - clamp01((t - 22.0) / 0.4));
          const mv = EASE(clamp01((t - 16.81) / 0.8)); // glide far-left as beat 4 opens
          const tx = lerp(46, 12, mv), ty = lerp(48, 70, mv), ts = lerp(1, 0.8, mv);
          const billOn = clamp01((t - 16.53) / 0.35);
          const bx = lerp(57, 12, mv), by = lerp(48, 61, mv), bs = lerp(1, 0.75, mv);
          const bStrike = clamp01((t - 16.8) / 0.3);
          return (
            <div style={{ opacity: on }}>
              {/* the tiny bright tile — the whole light scene, miniature */}
              <div style={{ position: "absolute", left: `${tx}%`, top: `${ty}%`, transform: `translate(-50%,-50%) scale(${ts})` }}>
                <div style={{ width: u * 8.5, background: WHITE, borderRadius: u * 0.5, padding: u * 0.55, boxShadow: `0 0 ${u * 2.2}px ${LIME}55, 0 ${u * 0.6}px ${u * 1.6}px rgba(0,0,0,0.5)`, border: `${u * 0.08}px solid ${SILVER_MID}` }}>
                  <div style={{ height: u * 3.4, background: "#12151d", borderRadius: u * 0.3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 0, height: 0, borderTop: `${u * 0.42}px solid transparent`, borderBottom: `${u * 0.42}px solid transparent`, borderLeft: `${u * 0.66}px solid ${SILVER}` }} />
                  </div>
                  <div style={{ marginTop: u * 0.45, display: "flex", gap: u * 0.35 }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ flex: 1, height: u * 0.85, borderRadius: u * 0.2, background: i === 2 ? LIME : "#c8cdd2", border: i === 2 ? `${u * 0.06}px solid ${RAISIN}` : "none" }} />)}
                  </div>
                </div>
              </div>
              {/* the intro's editor bill, recalled small and struck (16.53) */}
              {billOn > 0 && (
                <div style={{ position: "absolute", left: `${bx}%`, top: `${by}%`, transform: `translate(-50%,-50%) scale(${bs * (0.85 + 0.15 * EASE_OVER(billOn))})`, opacity: billOn }}>
                  <div style={{ position: "relative", background: "#1a1f2b", border: `${u * 0.1}px solid #3a4256`, borderRadius: u * 0.5, padding: `${u * 0.45}px ${u * 0.95}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, color: SILVER_MID, whiteSpace: "nowrap" }}>
                    $2,000/MO
                    <div style={{ position: "absolute", left: u * 0.45, right: u * 0.45, top: "50%", height: u * 0.26, background: SILVER, borderRadius: u * 0.13, transform: `translateY(-50%) scaleX(${bStrike}) rotate(-2.5deg)`, transformOrigin: "left center" }} />
                  </div>
                </div>
              )}
              {/* beat 3 headline */}
              <H1 u={u} t={t} in0={14.35} out={17.2} top="18%" center><Marker u={u} t={t} at={14.69}>BIGGER</Marker> THAN THE BILL</H1>
            </div>
          );
        })()}

        {/* BEAT 4 — video's share of internet traffic climbs to its all-time high, then five
            businesses with EMPTY player slots (16.81–21.83). REAL data (Cisco VNI Complete Forecast
            2017–2022): video = 82% of all IP traffic by 2022, up from 75% in 2017. The curve is that
            share over time and LANDS on the labeled 82% ceiling at the year 2022 — no invented data. */}
        {t >= 16.9 && t < 22.6 && (() => {
          const on = clamp01((t - 17.0) / 0.35) * (1 - clamp01((t - 22.0) / 0.4));
          const drawP = clamp01((t - 17.55) / 1.76);
          const dotP = clamp01((t - 19.31) / 0.3);
          const dotPulse = t > 19.31 ? Math.max(0, Math.sin((t - 19.31) * 9) * (1 - clamp01((t - 19.31) / 1.1))) : 0;
          const slotPulse = t > 21.59 ? Math.max(0, Math.sin(((t - 21.59) / 0.42) * Math.PI)) * (t < 22.01 ? 1 : 0) : 0;
          /* y-axis: baseline (80% screen) = 0% share, +0.64%-screen per point → 82% lands at 27.52%.
             x-axis: 2017 (p=0) → 2022 (p=1). Value climbs 75 → 82 (the two Cisco data points). */
          const yOf = (v: number) => (80 - v * 0.64) / 100 * H;
          const xOf = (p: number) => (6 + 84 * p) / 100 * W;
          const pts: string[] = [];
          for (let p = 0; p <= 1.0001; p += 0.02) pts.push(`${xOf(p)},${yOf(75 + 7 * Math.pow(p, 1.35))}`);
          const endX = xOf(1), y82 = yOf(82);
          const axisO = clamp01((t - 18.2) / 0.5);
          const XS = [20, 35, 50, 65, 80];
          return (
            <div style={{ opacity: on }}>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {/* the 82% ceiling the curve lands on */}
                <line x1={xOf(0)} y1={y82} x2={endX} y2={y82} stroke={`${LIME}66`} strokeWidth={u * 0.08} strokeDasharray={`${u * 0.8} ${u * 0.55}`} opacity={axisO} />
                <g style={{ clipPath: `inset(0 ${(1 - drawP) * 94}% 0 0)` }}>
                  <polygon points={`${pts.join(" ")} ${endX},${0.8 * H} ${xOf(0)},${0.8 * H}`} fill={`${LIME}14`} />
                  <polyline points={pts.join(" ")} fill="none" stroke={LIME} strokeWidth={u * 0.32} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${u * 0.7}px ${LIME}88)` }} />
                </g>
                <line x1={0.04 * W} y1={0.8 * H} x2={0.96 * W} y2={0.8 * H} stroke="#2f3752" strokeWidth={u * 0.1} />
                {dotP > 0 && <circle cx={endX} cy={y82} r={u * (0.55 + dotPulse * 0.35)} fill={LIME} style={{ filter: `drop-shadow(0 0 ${u * (0.8 + dotPulse * 1.4)}px ${LIME})` }} />}
              </svg>
              {/* axis labels: the 82% ceiling + the time span 2017 → 2022 (edges only, clear of businesses) */}
              <div style={{ position: "absolute", left: "92%", top: `${80 - 82 * 0.64}%`, transform: "translate(0,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.04em", color: LIME, whiteSpace: "nowrap", opacity: axisO }}>82%</div>
              <div style={{ position: "absolute", left: "6%", top: "81.5%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, letterSpacing: "0.06em", color: BODY, opacity: axisO }}>2017</div>
              <div style={{ position: "absolute", left: "90%", top: "81.5%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, letterSpacing: "0.06em", color: BODY, opacity: axisO }}>2022</div>
              <H1 u={u} t={t} in0={17.5} top="13%" left="6%" size={3.0}>THE <Marker u={u} t={t} at={18.11}>BIGGEST</Marker> IT'S EVER BEEN</H1>
              {/* five businesses pop along the baseline (20.55); empty slots above their heads. Shops sit
                  just under the baseline (79%) — CLEAR of the bottom-middle headline band (≈85%+).
                  NB: Shop/Slot are positioned directly (no transformed wrapper) so their top% resolves
                  against the full-frame graphics layer — a transformed zero-height wrapper collapses % to 0. */}
              {XS.map((x, i) => {
                const o = clamp01((t - (20.55 + i * 0.09)) / 0.3);
                if (o <= 0) return null;
                const pop = (1 - EASE_OVER(o)) * u * 1.4;
                return (
                  <React.Fragment key={i}>
                    <div style={{ position: "absolute", left: `${x}%`, top: "79%", opacity: o, transform: `translate(-50%,calc(-50% + ${pop}px))` }}><Shop u={u} /></div>
                    <div style={{ position: "absolute", left: `${x}%`, top: "70%", opacity: o, transform: `translate(-50%,calc(-50% + ${pop}px))` }}><Slot u={u} pulse={slotPulse} /></div>
                  </React.Fragment>
                );
              })}
              {/* stats callout at the peak (19.31) — real figure + real source */}
              {(() => {
                const so = clamp01((t - 19.31) / 0.4) * (1 - clamp01((t - 22.0) / 0.4));
                if (so <= 0) return null;
                return (
                  <div style={{ position: "absolute", left: "75%", top: "43%", transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * EASE_OVER(clamp01((t - 19.31) / 0.4))})`, opacity: so }}>
                    <div style={{ background: "rgba(18,21,29,0.9)", border: `${u * 0.1}px solid #2f3752`, borderRadius: u * 0.75, padding: `${u * 0.95}px ${u * 1.4}px`, boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.5)`, textAlign: "center" }}>
                      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, color: SILVER, letterSpacing: "-0.02em", lineHeight: 1 }}>82%</div>
                      <div style={{ marginTop: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.04em", color: SILVER_SOFT, whiteSpace: "nowrap" }}>of all internet traffic is video</div>
                      <div style={{ marginTop: u * 0.5, fontFamily: MONO, fontWeight: 600, fontSize: u * 0.72, letterSpacing: "0.09em", color: BODY, whiteSpace: "nowrap" }}>CISCO VNI FORECAST · BY 2022</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* BEAT 5 — the two blockers WEDGE between the businesses and their slots (21.83–26.11) */}
        {t >= 21.9 && t < 26.6 && (() => {
          const on = clamp01((t - 22.2) / 0.4) * (1 - clamp01((t - 26.15) / 0.35));
          const YS = [30, 41, 52, 63, 74];
          const tagIn = clamp01((t - 23.85) / 0.4);
          const swing = tagIn > 0 && tagIn < 1 ? Math.sin((1 - tagIn) * Math.PI * 2.5) * (1 - tagIn) * 22 : (t > 23.85 ? Math.sin((t - 24.25) * 4) * 2.2 * Math.max(0, 1 - (t - 24.25) / 1.6) : 0);
          const clkIn = clamp01((t - 25.37) / 0.35);
          const weeks = Math.min(3, 1 + Math.floor(Math.max(0, t - 25.37) * 3.2));
          return (
            <div style={{ opacity: on }}>
              <H1 u={u} t={t} in0={22.5} top="13%" left="6%" size={3.0}>A FORTUNE. <Marker u={u} t={t} at={25.37}>FOREVER.</Marker></H1>
              <div style={{ position: "absolute", inset: 0, transform: `translateY(${sag}px)` }}>
                {YS.map((y, i) => (
                  <div key={i}>
                    <div style={{ position: "absolute", left: "12%", top: `${y}%`, transform: "translate(-50%,-50%)" }}><Shop u={u} /></div>
                    <div style={{ position: "absolute", left: "44%", top: `${y}%`, transform: "translate(-50%,-50%)" }}><Slot u={u} /></div>
                    <div style={{ position: "absolute", left: "18.5%", top: `${y}%`, width: u * 4.5, height: u * 0.1, background: "#2f3752", transform: "translateY(-50%)" }} />
                    <div style={{ position: "absolute", left: "36%", top: `${y}%`, width: u * 4.5, height: u * 0.1, background: "#2f3752", transform: "translateY(-50%)" }} />
                  </div>
                ))}
              </div>
              {/* the price-tag swings in on its pinned string and THUDS (23.85) */}
              {tagIn > 0 && (
                <div style={{ position: "absolute", left: "28%", top: "21%", height: `${lerp(6, 21, EASE(tagIn))}%`, transform: `rotate(${swing}deg)`, transformOrigin: "top center" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, width: u * 0.6, height: u * 0.6, borderRadius: "50%", background: SILVER_MID, transform: "translate(-50%,-50%)" }} />
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: u * 2.2, width: u * 0.12, background: SILVER_MID, transform: "translateX(-50%)" }} />
                  <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 0.5, background: "#1a1f2b", border: `${u * 0.12}px solid #3a4256`, borderRadius: u * 0.5, padding: `${u * 0.55}px ${u * 1.05}px` }}>
                      <span style={{ width: u * 0.6, height: u * 0.6, borderRadius: "50%", border: `${u * 0.14}px solid ${SILVER_MID}`, flexShrink: 0 }} />
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, color: SILVER, whiteSpace: "nowrap" }}>$2,000+/MO</span>
                    </div>
                  </div>
                </div>
              )}
              {/* the clock lands beside it (25.37), hand spinning, counter ticking */}
              {clkIn > 0 && (
                <div style={{ position: "absolute", left: "28%", top: "58%", transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * EASE_OVER(clkIn)})`, opacity: clkIn }}>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, background: "#1a1f2b", border: `${u * 0.12}px solid #3a4256`, borderRadius: u * 0.5, padding: `${u * 0.55}px ${u * 1.05}px` }}>
                    <svg width={u * 1.9} height={u * 1.9} viewBox="0 0 20 20">
                      <circle cx={10} cy={10} r={8.4} fill="none" stroke={SILVER_MID} strokeWidth={1.6} />
                      <line x1={10} y1={10} x2={10 + 5.6 * Math.sin((t - 25.37) * 13)} y2={10 - 5.6 * Math.cos((t - 25.37) * 13)} stroke={SILVER} strokeWidth={1.7} strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, color: SILVER, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{weeks} WEEK{weeks > 1 ? "S" : ""}…</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 6a — the lights go off: slots grey out one by one on "never do it" (26.11–30.9) */}
        {t >= 26.5 && t < 31.1 && (() => {
          const on = clamp01((t - 26.7) / 0.4) * (1 - clamp01((t - 30.65) / 0.35));
          const XS = [16, 32, 48, 64, 80];
          const GREY = [29.29, 29.41, 29.53, 29.65, 29.77];
          return (
            <div style={{ opacity: on }}>
              {XS.map((x, i) => {
                const g = clamp01((t - GREY[i]) / 0.16);
                return (
                  <div key={i}>
                    <div style={{ position: "absolute", left: `${x}%`, top: "62%", transform: "translate(-50%,-50%)" }}><Shop u={u} dim={g * 0.7} /></div>
                    <div style={{ position: "absolute", left: `${x}%`, top: "44%", transform: "translate(-50%,-50%)" }}><Slot u={u} dim={g} /></div>
                  </div>
                );
              })}
              {/* the blockers idle beneath — they ARE the reason */}
              <ChipD x={41} y={80} u={u} text="$2,000+/MO" grey sc={0.85} o={clamp01((t - 27.0) / 0.4)} />
              <ChipD x={57} y={80} u={u} text="3 WEEKS…" grey sc={0.85} o={clamp01((t - 27.2) / 0.4)} />
            </div>
          );
        })()}

        {/* BEAT 6b — THE FUNNEL: choked neck, cards jam, then the neck SHATTERS open (30.7–33.4) */}
        {t >= 30.7 && t < 33.6 && (() => {
          const on = clamp01((t - 30.75) / 0.3) * (1 - clamp01((t - 33.15) / 0.35));
          const draw = clamp01((t - 30.8) / 0.5);
          const stamp = clamp01((t - 31.05) / 0.3);
          const brk = clamp01((t - 32.25) / 0.35);
          const wallRot = EASE_OVER(brk) * 38;
          const JX = [51.5, 45, 38.5, 32, 25.5]; // hero first at the neck
          const frag = (t - 32.25);
          return (
            <div style={{ opacity: on }}>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {/* funnel body walls */}
                <path d={`M ${0.06 * W} ${0.26 * H} L ${0.56 * W} ${0.47 * H}`} stroke={SILVER_MID} strokeWidth={u * 0.24} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
                <path d={`M ${0.06 * W} ${0.78 * H} L ${0.56 * W} ${0.57 * H}`} stroke={SILVER_MID} strokeWidth={u * 0.24} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
                {/* the neck walls — they SNAP OUTWARD on "removed" */}
                <g transform={`rotate(${-wallRot} ${0.56 * W} ${0.47 * H})`}>
                  <path d={`M ${0.56 * W} ${0.47 * H} L ${0.66 * W} ${0.47 * H}`} stroke={brk > 0 ? LIME : SILVER} strokeWidth={u * 0.3} strokeLinecap="round" opacity={draw} />
                </g>
                <g transform={`rotate(${wallRot} ${0.56 * W} ${0.57 * H})`}>
                  <path d={`M ${0.56 * W} ${0.57 * H} L ${0.66 * W} ${0.57 * H}`} stroke={brk > 0 ? LIME : SILVER} strokeWidth={u * 0.3} strokeLinecap="round" opacity={draw} />
                </g>
                {/* break fragments */}
                {brk > 0 && frag < 0.8 && Array.from({ length: 6 }).map((_, i) => {
                  const a = (i / 6) * Math.PI * 2 + 0.4;
                  const d = frag * (14 + (i % 3) * 6);
                  return <rect key={i} x={0.61 * W + Math.cos(a) * d * u - u * 0.5} y={0.52 * H + Math.sin(a) * d * u * 0.8 - u * 0.14} width={u * 1.0} height={u * 0.28} rx={u * 0.1} fill={i % 2 ? LIME : SILVER} opacity={(1 - frag / 0.8) * 0.9} transform={`rotate(${frag * (i % 2 ? 260 : -200)} ${0.61 * W + Math.cos(a) * d * u} ${0.52 * H + Math.sin(a) * d * u * 0.8})`} />;
                })}
                {/* the hero's lime trail once it's through */}
                {brk > 0.15 && (() => { const hx = 51.5 + Math.max(0, t - 32.29) * 95; return <line x1={(hx - 10) / 100 * W} y1={0.52 * H} x2={(hx - 3.6) / 100 * W} y2={0.52 * H} stroke={LIME} strokeWidth={u * 0.5} strokeLinecap="round" opacity={0.75 * (1 - clamp01((hx - 100) / 20))} style={{ filter: `blur(${u * 0.12}px)` }} />; })()}
              </svg>
              {/* businesses waiting in the mouth */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ position: "absolute", left: `${10 + (i % 2) * 7}%`, top: `${33 + i * 9.5}%`, transform: "translate(-50%,-50%) scale(0.78)", opacity: draw }}><Shop u={u} /></div>
              ))}
              {/* the jam: grey cards nose-to-tail, hero (lime, four ticks) at the front */}
              {JX.map((jx, i) => {
                const jit = brk > 0 ? 0 : Math.sin(t * 9 + i * 1.7) * 0.3;
                const burstX = brk > 0 ? Math.max(0, t - (32.25 + i * 0.055)) * 95 : 0;
                const x = jx + jit + burstX;
                if (x > 118) return null;
                return (
                  <div key={i} style={{ position: "absolute", left: `${x}%`, top: "52%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 30.95 - i * 0.08) / 0.25) }}>
                    <MiniCard u={u} hero={i === 0} s={0.92} glow={i === 0 ? brk : 0} />
                  </div>
                );
              })}
              {/* the choke plug: the two blockers sit IN the neck until the break flings them */}
              {brk < 1 && (
                <>
                  <ChipD x={61 + brk * 16} y={49 - brk * 22} u={u} text="$2,000+/MO" grey sc={0.72 * (1 - brk * 0.4)} rot={brk * 40 - 6} o={draw * (1 - brk)} />
                  <ChipD x={61 + brk * 19} y={57 + brk * 20} u={u} text="3 WEEKS…" grey sc={0.72 * (1 - brk * 0.4)} rot={brk * -34 + 4} o={draw * (1 - brk)} />
                </>
              )}
              {/* EDITING stamps the neck (31.05) */}
              <ChipD x={61} y={38.5} u={u} text="EDITING" o={stamp * (1 - brk)} sc={0.85 + 0.15 * EASE_OVER(stamp)} rot={-4} />
              <H1 u={u} t={t} in0={31.35} top="13%" center>BOTTLENECK, <Marker u={u} t={t} at={32.25}>REMOVED</Marker></H1>
            </div>
          );
        })()}

        {/* BEAT 8 — the scarce sliver DRAINS into the stream of shipping cards (36.43–41.83) */}
        {t >= 36.6 && t < 42.5 && (() => {
          /* NOTE 2 — let the "attention gets all of it" visual LINGER: slower drain + longer
             hold before it clears (beat timing untouched; bounded by the graphics-world fade). */
          const on = clamp01((t - 36.75) / 0.35) * (1 - clamp01((t - 42.15) / 0.3));
          const drain = clamp01((t - 40.93) / 0.95);
          const cards: { born: number }[] = [];
          for (let k = 0; k < 9; k++) { const born = 37.0 + k * 0.55; if (born > t || born > 41.5) break; cards.push({ born }); }
          const glowOn = clamp01((t - 41.1) / 0.5);
          return (
            <div style={{ opacity: on }}>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <line x1={0} y1={0.58 * H} x2={W} y2={0.58 * H} stroke="#2f3752" strokeWidth={u * 0.14} strokeDasharray={`${u * 1.6} ${u * 1.1}`} />
                {/* attention particles: the sliver breaks and streams INTO the cards (40.93) */}
                {drain > 0 && Array.from({ length: 14 }).map((_, i) => {
                  const born = 40.93 + i * 0.045;
                  const p = clamp01((t - born) / 0.55);
                  if (p <= 0 || p >= 1) return null;
                  const sx = 0.76 * W, sy = 0.22 * H;
                  const txp = (10 + i * 6.2) / 100 * W, typ = 0.575 * H;
                  const mx = (sx + txp) / 2 + u * 3, my = 0.36 * H + i * u * 0.3;
                  const bz = (a: number, b: number, c: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;
                  return <circle key={i} cx={bz(sx, mx, txp)} cy={bz(sy, my, typ)} r={u * 0.26} fill={LIME} opacity={1 - clamp01((p - 0.82) / 0.18)} style={{ filter: `drop-shadow(0 0 ${u * 0.5}px ${LIME})` }} />;
                })}
              </svg>
              {/* NOTE 1 — attention lives on the PLATFORMS: real YouTube / Instagram / TikTok marks
                  on a dark raisin plate (lime accent only, no yellow block). The pool shrinks + fades
                  as it drains into the shipping cards. Same treatment as beat 7. */}
              {drain < 1 && (
                <div style={{ position: "absolute", left: "76%", top: "22%", transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * (1 - drain)})`, opacity: 1 - clamp01((drain - 0.5) / 0.5) }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.75, background: "rgba(18,21,29,0.92)", border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.8, padding: `${u * 1.0}px ${u * 1.5}px`, boxShadow: `0 0 ${u * 1.8}px ${LIME}55, 0 ${u * 0.6}px ${u * 1.6}px rgba(0,0,0,0.5)` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 1.0 }}>
                      {(["yt", "ig", "tt"] as const).map((m, i) => {
                        const rot = Math.sin((t + i * 1.3) * 1.1) * 5;
                        const bob = Math.cos((t + i * 0.9) * 0.95) * u * 0.28;
                        return (
                          <div key={i} style={{ transform: `translateY(${bob}px) rotate(${rot}deg)` }}>
                            {m === "yt" ? <YouTubeMark u={u} size={2.7} /> : m === "ig" ? <InstagramMark u={u} size={2.5} /> : <TikTokMark u={u} size={2.5} />}
                          </div>
                        );
                      })}
                    </div>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.9, color: LIME, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>ATTENTION</span>
                  </div>
                </div>
              )}
              {/* the shipping rail fires polished cards rightward */}
              {cards.map((c, k) => {
                const x = -8 + (t - c.born) * 36;
                if (x > 112) return null;
                return (
                  <div key={k} style={{ position: "absolute", left: `${x}%`, top: `${58 + amb.bob(k * 0.7, 0.4)}%`, transform: "translate(-50%,-50%)" }}>
                    <MiniCard u={u} hero s={0.88} glow={glowOn} />
                  </div>
                );
              })}
              {/* rail tags land on their words */}
              <ChipD x={30} y={66.5} u={u} text="FAST" o={clamp01((t - 38.81) / 0.25)} sc={0.9 + 0.1 * EASE_OVER(clamp01((t - 38.81) / 0.35))} />
              <ChipD x={46} y={66.5} u={u} text="CHEAP" o={clamp01((t - 39.51) / 0.25)} sc={0.9 + 0.1 * EASE_OVER(clamp01((t - 39.51) / 0.35))} />
              <H1 u={u} t={t} in0={40.9} top="14%" left="6%">GETS <Marker u={u} t={t} at={41.19}>ALL</Marker> OF IT</H1>
            </div>
          );
        })()}

        {/* BEAT 10 — THE NAME REVEAL: LOOP STUDIO inside the drawn lime loop, hero riding it,
            gate swinging open (45.93–50.97) */}
        {t >= 46.2 && t < 51.7 && (() => {
          const on = clamp01((t - 46.4) / 0.35) * (1 - clamp01((t - 51.05) / 0.45));
          const RCx = 0.30 * W, RCy = 0.47 * H, rr = u * 13.5;
          const pt = (deg: number) => ({ x: RCx + rr * Math.sin(deg * Math.PI / 180), y: RCy - rr * Math.cos(deg * Math.PI / 180) });
          const arc = (d1: number, d2: number) => { const a = pt(d1), b = pt(d2); return `M ${a.x} ${a.y} A ${rr} ${rr} 0 ${d2 - d1 > 180 ? 1 : 0} 1 ${b.x} ${b.y}`; };
          const th = 360 * EASE(clamp01((t - 47.23) / 1.05));
          const pA = clamp01(th / 150), pG = clamp01((th - 150) / 60), pB = clamp01((th - 210) / 150);
          const gOpen = EASE_OVER(clamp01((t - 50.11) / 0.6)) * 55;
          const hinge = pt(150);
          const stamp = clamp01((t - 47.23) / 0.3);
          const hp = pt(th);
          return (
            <div style={{ opacity: on }}>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={arc(0, 150)} stroke={LIME} strokeWidth={u * 0.34} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - pA)} style={{ filter: `drop-shadow(0 0 ${u * 0.6}px ${LIME}88)` }} />
                <path d={arc(210, 359.5)} stroke={LIME} strokeWidth={u * 0.34} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - pB)} style={{ filter: `drop-shadow(0 0 ${u * 0.6}px ${LIME}88)` }} />
                {/* the gate-arc: swings outward (down, away from the ring) on "opening it up" (50.11) */}
                <g transform={`rotate(${-gOpen} ${hinge.x} ${hinge.y})`}>
                  <path d={arc(150, 210)} stroke={LIME} strokeWidth={u * 0.34} fill="none" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - pG)} />
                </g>
                {/* arrowhead leading the draw */}
                {th > 4 && th < 358 && (
                  <g transform={`translate(${hp.x} ${hp.y}) rotate(${th + 90})`}>
                    <path d={`M 0 ${-u * 0.9} L ${u * 1.5} 0 L 0 ${u * 0.9} Z`} fill={LIME} />
                  </g>
                )}
              </svg>
              {/* wordmark stamps with the Marker on LOOP (47.23) */}
              <div style={{ position: "absolute", left: "30%", top: "47%", transform: `translate(-50%,-50%) scale(${1.12 - 0.12 * EASE(stamp)})`, opacity: stamp, textAlign: "center" }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, letterSpacing: "-0.02em", color: SILVER, lineHeight: 1.08 }}><Marker u={u} t={t} at={47.23}>LOOP</Marker></div>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, letterSpacing: "-0.02em", color: SILVER, lineHeight: 1.08 }}>STUDIO</div>
              </div>
              {/* the hero card rides the arrowhead, orbits once, settles at the top of the ring */}
              <div style={{ position: "absolute", left: hp.x, top: hp.y, transform: "translate(-50%,-50%)", opacity: clamp01((t - 47.23) / 0.2) }}>
                <MiniCard u={u} hero s={0.8} />
              </div>
            </div>
          );
        })()}

        {/* BEAT 11 — brand.json retypes itself to YOUR BRAND; the open loop parks upper-left
            (50.97–57.61). Everything COLLAPSES into the folder from 58.25 (beat 12). */}
        {t >= 51.1 && t < 59.4 && (() => {
          const on = clamp01((t - 51.25) / 0.4);
          const cp = EASE(clamp01((t - 58.25) / 0.6)); // the collapse into loop-studio/
          const fold = { x: 28, y: 46 };
          const el = (bx: number, by: number) => ({ left: `${lerp(bx, fold.x, cp)}%`, top: `${lerp(by, fold.y, cp)}%`, opacity: on * (1 - clamp01((cp - 0.72) / 0.28)) });
          const OWNER_A = "BuildLoop", OWNER_B = "YOUR BRAND";
          let owner = OWNER_A;
          if (t >= 54.39) {
            const del = Math.floor((t - 54.39) * 24);
            owner = del < OWNER_A.length ? OWNER_A.slice(0, OWNER_A.length - del) : OWNER_B.slice(0, Math.max(0, Math.floor((t - 54.39 - OWNER_A.length / 24) * 17)));
          }
          const caret = Math.floor(t * 2.6) % 2 === 0;
          const cur = t >= 52.49;
          const flip = clamp01((t - 54.39) / 0.35);
          const mini = (d1: number, d2: number) => { const a = { x: 50 + 40 * Math.sin(d1 * Math.PI / 180), y: 50 - 40 * Math.cos(d1 * Math.PI / 180) }, b = { x: 50 + 40 * Math.sin(d2 * Math.PI / 180), y: 50 - 40 * Math.cos(d2 * Math.PI / 180) }; return `M ${a.x} ${a.y} A 40 40 0 ${d2 - d1 > 180 ? 1 : 0} 1 ${b.x} ${b.y}`; };
          return (
            <div>
              <H1 u={u} t={t} in0={53.6} out={57.6} top="15%" left="31%" center size={3.0} color={RAISIN}><Marker u={u} t={t} at={53.95} base={RAISIN}>YOURS</Marker>, EXACTLY</H1>
              {/* the parked open loop — raisin ink on the worksheet, still open at the bottom */}
              <div style={{ position: "absolute", ...el(13, 20), transform: `translate(-50%,-50%) scale(${(1.15 - 0.15 * on) * (1 - 0.92 * cp)})` }}>
                <svg width={u * 9.5} height={u * 9.5} viewBox="0 0 100 100">
                  <path d={mini(210, 359.5)} stroke={RAISIN} strokeWidth={4.5} fill="none" strokeLinecap="round" />
                  <path d={mini(0, 150)} stroke={RAISIN} strokeWidth={4.5} fill="none" strokeLinecap="round" />
                </svg>
                <div style={{ textAlign: "center", marginTop: u * 0.2, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, letterSpacing: "0.1em", color: BODY }}>LOOP STUDIO</div>
              </div>
              {/* brand.json — the swap enacted as editing one file */}
              <div style={{ position: "absolute", ...el(31, 48), transform: `translate(-50%,-50%) scale(${1 - 0.94 * cp})` }}>
                <Win u={u} w={26} title="brand.json" light accent>
                  <div style={{ padding: `${u * 1.0}px ${u * 1.3}px`, display: "flex", flexDirection: "column", gap: u * 0.75, fontFamily: MONO, fontWeight: 600, fontSize: u * 1.2, color: RAISIN }}>
                    <div style={{ whiteSpace: "nowrap" }}>
                      <span style={{ color: BODY }}>owner: </span>"{owner}"
                      {cur && caret && <span style={{ display: "inline-block", width: u * 0.42, height: u * 1.4, background: RAISIN, verticalAlign: "-12%", marginLeft: u * 0.12 }} />}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 0.55, whiteSpace: "nowrap" }}>
                      <span style={{ color: BODY }}>accent: </span>
                      {flip < 0.5 ? (
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: u * 2.0, height: u * 1.7, background: RAISIN, borderRadius: u * 0.28, transform: `scale(${1 - flip * 1.6})` }}>
                          <span style={{ width: u * 1.15, height: u * 0.95, background: LIME, borderRadius: u * 0.14 }} />
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.4, transform: `scale(${Math.min(1, (flip - 0.5) * 2 + 0.4)})` }}>
                          <span style={{ width: u * 2.0, height: u * 1.7, border: `${u * 0.12}px dashed ${BODY}`, borderRadius: u * 0.28 }} />
                          <span style={{ fontSize: u * 0.95, color: BODY }}>yours</span>
                        </span>
                      )}
                    </div>
                    <div style={{ whiteSpace: "nowrap" }}><span style={{ color: BODY }}>font: </span>"Space Grotesk"</div>
                    <div style={{ whiteSpace: "nowrap" }}><span style={{ color: BODY }}>voice: </span>"…"</div>
                  </div>
                </Win>
              </div>
              {/* landing chips */}
              <div style={{ position: "absolute", ...el(23, 68), transform: `translate(-50%,-50%) scale(${1 - 0.94 * cp})` }}>
                {clamp01((t - 55.97) / 0.25) > 0 && <ChipL x={50} y={50} u={u} text="FOR YOU ✓" o={clamp01((t - 55.97) / 0.25)} sc={0.85 + 0.15 * EASE_OVER(clamp01((t - 55.97) / 0.35))} size={1.3} />}
              </div>
              <div style={{ position: "absolute", ...el(40, 68), transform: `translate(-50%,-50%) scale(${1 - 0.94 * cp})` }}>
                {clamp01((t - 56.89) / 0.25) > 0 && <ChipL x={50} y={50} u={u} text="FOR CLIENTS ✓" o={clamp01((t - 56.89) / 0.25)} sc={0.85 + 0.15 * EASE_OVER(clamp01((t - 56.89) / 0.35))} size={1.3} />}
              </div>
              {/* the hero card sits at the top of the parked loop until it hops off at 58.25 */}
              {t < 58.25 && (
                <div style={{ position: "absolute", left: "13%", top: "12.6%", transform: "translate(-50%,-50%)", opacity: on }}>
                  <MiniCard u={u} hero s={0.62} />
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 12 — THE LOOP CLOSE: the loop-studio/ folder + this_video.mp4 goes LIVE (57.61–63.25) */}
        {t >= 57.9 && t < 63.7 && (() => {
          const on = 1 - clamp01((t - 63.15) / 0.35);
          const fo = EASE_OVER(clamp01((t - 58.5) / 0.45));
          const lift = EASE(clamp01((t - 62.65) / 0.4));
          const fly = EASE(clamp01((t - 61.29) / 0.3));
          const solid = clamp01((t - 61.55) / 0.3);
          const push = 1 + 0.05 * clamp01((t - 61.6) / 1.6);
          const px = lerp(108, 66, fly);
          const tc = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;
          const pub = clamp01((t - 62.65) / 0.3);
          return (
            <div style={{ opacity: on }}>
              <H1 u={u} t={t} in0={58.25} top="14%" left="32%" center size={3.0} color={RAISIN}>THE WHOLE <Marker u={u} t={t} at={58.25} base={RAISIN}>PACKAGE</Marker></H1>
              {/* the folder card everything packed into */}
              {fo > 0 && (
                <div style={{ position: "absolute", left: "28%", top: `${46 - lift * 2.2}%`, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * fo})`, opacity: Math.min(1, fo * 1.4) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 1.0, background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 0.8, padding: `${u * 1.1}px ${u * 1.7}px`, boxShadow: `0 ${u * 0.8}px ${u * 2.2}px rgba(15,18,26,0.2)` }}>
                    <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 4.2, height: u * 4.2 }} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.9, color: RAISIN }}>loop-studio/</span>
                  </div>
                  {/* ↑ PUBLISHED (62.65) */}
                  {pub > 0 && (
                    <div style={{ position: "absolute", left: "50%", top: -u * 2.6, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * EASE_OVER(pub)})`, opacity: pub, display: "flex", alignItems: "center", gap: u * 0.5 }}>
                      <span style={{ background: RAISIN, borderRadius: u * 0.4, padding: `${u * 0.35}px ${u * 0.9}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.1em", color: SILVER }}>↑ PUBLISHED</span>
                    </div>
                  )}
                </div>
              )}
              {/* the promise card finally FILLED: this_video.mp4 · ● LIVE, playing the actual take */}
              {fly > 0 && (
                <div style={{ position: "absolute", left: `${px}%`, top: "48%", transform: `translate(-50%,-50%) scale(${push})` }}>
                  <div style={{ position: "relative", width: u * 27, borderRadius: u * 0.9, overflow: "hidden", border: solid > 0.5 ? `${u * 0.14}px solid ${RAISIN}` : `${u * 0.16}px dashed ${BODY}`, background: "#12151d", boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(15,18,26,0.35)` }}>
                    <div style={{ height: u * 2.7, background: "#181c28", borderBottom: `${u * 0.09}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.55, padding: `0 ${u * 1.1}px` }}>
                      {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: "#3a4256" }} />)}
                      <span style={{ marginLeft: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: SILVER_SOFT, whiteSpace: "nowrap" }}>this_video.mp4 ·</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.35, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: LIME }}>
                        <span style={{ width: u * 0.6, height: u * 0.6, borderRadius: "50%", background: LIME, opacity: 0.5 + 0.5 * Math.abs(Math.sin(t * 3)) }} />LIVE
                      </span>
                    </div>
                    <div style={{ position: "relative", width: "100%", height: u * 14.5, background: "#0d1017" }}>
                      {solid > 0.05 && <OffthreadVideo src={staticFile("footage/ls_th4.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", opacity: solid }} />}
                      <div style={{ position: "absolute", right: u * 0.8, bottom: u * 0.6, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: SILVER, background: "rgba(13,16,23,0.72)", borderRadius: u * 0.3, padding: `${u * 0.15}px ${u * 0.5}px`, fontVariantNumeric: "tabular-nums", opacity: solid }}>{tc}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 14 — a real Claude window installs the studio by itself (69.95–75.59) */}
        {t >= 70.1 && t < 75.9 && (() => {
          const on = clamp01((t - 70.25) / 0.35) * (1 - clamp01((t - 75.55) / 0.3));
          const LINE = "$ install loop-studio…";
          const typed = LINE.slice(0, Math.max(0, Math.floor((t - 70.49) * 26)));
          const bar = clamp01((t - 70.6) / 0.95);
          const inst = clamp01((t - 71.73) / 0.3);
          const abIn = EASE(clamp01((t - 75.01) / 0.4));
          const caret = Math.floor(t * 2.6) % 2 === 0;
          return (
            <div style={{ opacity: on }}>
              <H1 u={u} t={t} in0={70.3} top="14%" left="30%" center size={3.0} color={RAISIN}>CLAUDE <Marker u={u} t={t} at={70.49} base={RAISIN}>INSTALLS</Marker> IT</H1>
              <div style={{ position: "absolute", left: "30%", top: "44%", transform: "translate(-50%,-50%)", width: u * 30 }}>
                <div style={{ position: "relative", background: "#12151d", border: `${u * 0.12}px solid #2a3145`, borderRadius: u * 0.9, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(15,18,26,0.35)` }}>
                  <div style={{ height: u * 2.9, background: "#181c28", borderBottom: `${u * 0.09}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.6, padding: `0 ${u * 1.2}px` }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: "#3a4256" }} />)}
                    <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.7, height: u * 1.7, marginLeft: u * 0.4 }} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: SILVER_SOFT }}>claude · install</span>
                  </div>
                  <div style={{ padding: `${u * 1.1}px ${u * 1.3}px`, display: "flex", flexDirection: "column", gap: u * 0.85 }}>
                    <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.25, color: SILVER, whiteSpace: "nowrap", minHeight: u * 1.7 }}>
                      {typed}{typed.length < LINE.length && caret && <span style={{ display: "inline-block", width: u * 0.42, height: u * 1.4, background: LIME, verticalAlign: "-12%", marginLeft: u * 0.1 }} />}
                    </div>
                    <div style={{ height: u * 0.75, background: "#181d2a", borderRadius: u * 0.38, overflow: "hidden", border: `${u * 0.06}px solid #2a3145` }}>
                      <div style={{ width: `${bar * 100}%`, height: "100%", background: LIME }} />
                    </div>
                    <div style={{ display: "flex", gap: u * 0.7 }}>
                      {["CUT", "CODE", "SOUND", "TASTE"].map((s, i) => {
                        const o = clamp01((t - (70.93 + i * 0.16)) / 0.18);
                        return (
                          <span key={i} style={{ opacity: 0.25 + 0.75 * o, display: "inline-flex", alignItems: "center", gap: u * 0.4, background: "#181d2a", border: `${u * 0.08}px solid ${o > 0.5 ? LIME : "#2a3145"}`, borderRadius: u * 0.4, padding: `${u * 0.3}px ${u * 0.7}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: SILVER_SOFT, whiteSpace: "nowrap" }}>
                            {s}<span style={{ color: o > 0.5 ? LIME : "#3a4256" }}>✓</span>
                          </span>
                        );
                      })}
                    </div>
                    {inst > 0 && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <span style={{ transform: `scale(${0.8 + 0.2 * EASE_OVER(inst)})`, opacity: inst, background: RAISIN, border: `${u * 0.11}px solid ${LIME}`, borderRadius: u * 0.4, padding: `${u * 0.35}px ${u * 0.9}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.06em", color: LIME }}>✓ installed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* the empty address bar — the destination arrives next beat (75.01) */}
              {abIn > 0 && (
                <div style={{ position: "absolute", left: "30%", top: "71%", transform: `translate(-50%,-50%) translateY(${(1 - abIn) * u * 1.6}px)`, opacity: abIn }}>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, width: u * 24, background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 2, padding: `${u * 0.6}px ${u * 1.2}px`, boxShadow: `0 ${u * 0.5}px ${u * 1.4}px rgba(15,18,26,0.16)` }}>
                    <span style={{ width: u * 1.1, height: u * 1.1, borderRadius: "50%", border: `${u * 0.14}px solid ${BODY}`, flexShrink: 0 }} />
                    {caret && <span style={{ display: "inline-block", width: u * 0.4, height: u * 1.4, background: RAISIN }} />}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 15 — the three-step recipe rail, then 5 MINUTES (75.59–80.87) */}
        {t >= 75.55 && t < 81.2 && (() => {
          const on = clamp01((t - 75.59) / 0.3) * (1 - clamp01((t - 80.85) / 0.3));
          const arrowP = clamp01((t - 76.29) / 0.7);
          const soften = clamp01((t - 80.23) / 0.3);
          const plateP = clamp01((t - 80.23) / 0.35);
          const steps: { txt: React.ReactNode; at: number; y: number }[] = [
            { txt: "1 · LINK IN DESCRIPTION", at: 75.67, y: 26 },
            { txt: "2 · COPY MY PROMPT", at: 77.53, y: 42 },
            { txt: <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.55 }}>3 · PASTE IN<Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.5, height: u * 1.5 }} />CLAUDE</span>, at: 78.77, y: 58 },
          ];
          const arrCol = soften > 0.5 ? "#9aa2a8" : RAISIN;
          return (
            <div style={{ opacity: on }}>
              {steps.map((s, i) => {
                const o = clamp01((t - s.at) / 0.28);
                if (o <= 0) return null;
                return <ChipL key={i} x={30} y={s.y} u={u} text={s.txt} o={o} sc={0.88 + 0.12 * EASE_OVER(o)} size={1.45} />;
              })}
              {/* prompt snippet attached to step 2 */}
              {clamp01((t - 77.75) / 0.3) > 0 && (
                <div style={{ position: "absolute", left: "33%", top: "49.5%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 77.75) / 0.3) }}>
                  <div style={{ background: "#12151d", border: `${u * 0.1}px solid #2a3145`, borderRadius: u * 0.45, padding: `${u * 0.4}px ${u * 0.9}px`, fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, color: SILVER_SOFT, whiteSpace: "nowrap" }}>&gt; set up loop studio…</div>
                </div>
              )}
              {/* clean down-arrow: the link is BELOW the video, in the description */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <path d={`M ${0.205 * W} ${0.295 * H} Q ${0.135 * W} ${0.30 * H} ${0.135 * W} ${0.37 * H} L ${0.135 * W} ${0.80 * H}`} stroke={arrCol} strokeWidth={u * 0.34} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - EASE(arrowP))} />
                {arrowP > 0.88 && <path d={`M ${0.135 * W - u * 1.1} ${0.785 * H} L ${0.135 * W} ${0.825 * H} L ${0.135 * W + u * 1.1} ${0.785 * H}`} stroke={arrCol} strokeWidth={u * 0.34} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={clamp01((arrowP - 0.88) / 0.12)} />}
              </svg>
              {arrowP > 0.6 && (
                <div style={{ position: "absolute", left: "13.5%", top: "87.5%", transform: "translate(-50%,-50%)", opacity: clamp01((arrowP - 0.6) / 0.3) }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.08em", color: arrCol, whiteSpace: "nowrap" }}>BELOW THE VIDEO</span>
                </div>
              )}
              {/* the closer: 5 MINUTES on the lime plate (answers beat 5's 3 WEEKS…) */}
              {plateP > 0 && (
                <div style={{ position: "absolute", left: "33%", top: "80%", transform: "translate(-50%,-50%)", clipPath: `inset(-8% ${(1 - EASE(plateP)) * 102 - 1}% -8% -1%)` }}>
                  <div style={{ background: LIME, padding: `${u * 0.65}px ${u * 1.7}px`, borderRadius: u * 0.3, transform: "rotate(-1.2deg)", boxShadow: `${u * 0.45}px ${u * 0.45}px 0 rgba(15,18,26,0.9)` }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.8, color: RAISIN, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>5 MINUTES</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ============ SCRIM (full-footage readability) ============ */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.55) 0%, transparent 26%, transparent 60%, rgba(8,10,14,0.72) 100%)`, opacity: full, pointerEvents: "none" }} />

      {/* ============ FOOTAGE ============ */}
      <FootageLayer sk={sk} u={u} src="footage/ls_th4.mp4" />

      {/* ============ OVERLAYS ON FOOTAGE ============ */}

      {/* BEAT 7 — attention lives on the platforms: real YouTube / Instagram / TikTok marks drift
          over the dark face (no yellow plate; brand colours carry it) (32.85–37.1) */}
      {t >= 32.85 && t < 37.1 && (() => {
        const on = 1 - clamp01((t - 36.43) / 0.45);
        const LOGOS: { M: "yt" | "ig" | "tt"; x: number; y: number; sz: number; ph: number; amp: number; at: number }[] = [
          { M: "yt", x: 12.5, y: 21, sz: 5.2, ph: 0.0, amp: 1.5, at: 32.97 },
          { M: "ig", x: 87, y: 27, sz: 5.4, ph: 1.3, amp: 1.9, at: 33.22 },
          { M: "tt", x: 19, y: 71, sz: 4.7, ph: 2.1, amp: 1.7, at: 33.46 },
          { M: "yt", x: 85, y: 69, sz: 4.3, ph: 3.2, amp: 1.4, at: 33.70 },
          { M: "ig", x: 9, y: 47, sz: 4.1, ph: 4.1, amp: 2.1, at: 33.10 },
          { M: "tt", x: 90.5, y: 47, sz: 4.5, ph: 5.3, amp: 1.7, at: 33.34 },
        ];
        return (
          <div style={{ opacity: on }}>
            {LOGOS.map((g, i) => {
              const io = clamp01((t - g.at) / 0.4);
              const dx = Math.sin((t + g.ph) * 0.9) * g.amp;
              const dy = Math.cos((t + g.ph) * 0.75) * g.amp * 1.15;
              const rot = Math.sin((t + g.ph) * 0.6) * 6;
              return (
                <div key={i} style={{ position: "absolute", left: `${g.x + dx}%`, top: `${g.y + dy}%`, transform: `translate(-50%,-50%) scale(${0.65 + 0.35 * EASE_OVER(io)}) rotate(${rot}deg)`, opacity: io }}>
                  {g.M === "yt" ? <YouTubeMark u={u} size={g.sz} /> : g.M === "ig" ? <InstagramMark u={u} size={g.sz} /> : <TikTokMark u={u} size={g.sz} />}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* BEAT 9 — "not a tool" struck; the 2-YEAR HEAD START plate (41.83–45.93) */}
      {t >= 43.4 && t < 46.5 && (() => {
        const o = 1 - clamp01((t - 46.0) / 0.4);
        const chipO = clamp01((t - 43.61) / 0.25);
        const strike = clamp01((t - 43.95) / 0.25);
        return (
          <div style={{ opacity: o }}>
            <div style={{ position: "absolute", left: "13%", top: "79%", transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * EASE_OVER(chipO)})`, opacity: chipO }}>
              <div style={{ position: "relative", background: "rgba(18,21,29,0.92)", border: `${u * 0.11}px solid #3a4256`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.1}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.4, color: SILVER_SOFT, whiteSpace: "nowrap" }}>
                A TOOL
                <div style={{ position: "absolute", left: u * 0.5, right: u * 0.5, top: "50%", height: u * 0.28, background: SILVER, borderRadius: u * 0.14, transform: `translateY(-50%) scaleX(${strike}) rotate(-2.5deg)`, transformOrigin: "left center" }} />
              </div>
            </div>
            {/* NOTE 3 — a premium CALENDAR flips ~2 years forward (Jul 2026 → Jul 2028): months
                page past, the year odometer ticks 2026 → 2028, then a lime "+2 YEARS" badge lands.
                Replaces the old flat "2-YEAR HEAD START" plate. Lower-right, clear of the head. */}
            {(() => {
              const start = 45.0, dur = 0.72;
              const calP = clamp01((t - start) / dur);
              if (calP <= 0) return null;
              const appear = EASE_OVER(clamp01((t - start) / 0.32));
              const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
              const advF = EASE(calP) * 24;                     // 24 months forward = 2 years
              const adv = Math.min(24, Math.floor(advF));
              const frac = advF - Math.floor(advF);
              const absM = 6 + adv;                             // start on Jul (index 6)
              const month = MONTHS[absM % 12];
              const year = 2026 + Math.floor(absM / 12);
              const flipping = calP < 1;
              const peel = flipping ? Math.sin(frac * Math.PI) : 0;   // month sheet lifts on each tick
              const land = clamp01((t - (start + dur)) / 0.3);
              const badge = EASE_OVER(land);
              return (
                <div style={{ position: "absolute", left: "66%", top: "70%", transform: `translate(-50%,-50%) scale(${0.86 + 0.14 * appear})`, opacity: appear }}>
                  {/* faint stacked pages behind — the many pages flipping forward */}
                  {[3, 2, 1].map((k) => (
                    <div key={k} style={{ position: "absolute", left: k * u * 0.42, top: k * u * 0.42, right: -k * u * 0.42, bottom: -k * u * 0.42, background: "#e7eaec", borderRadius: u * 0.8, border: `${u * 0.08}px solid ${SILVER_MID}`, opacity: 0.55 - k * 0.12 }} />
                  ))}
                  <div style={{ position: "relative", width: u * 14, background: WHITE, borderRadius: u * 0.8, overflow: "hidden", border: `${u * 0.12}px solid ${RAISIN}`, boxShadow: `0 ${u * 1.0}px ${u * 2.6}px rgba(0,0,0,0.55)` }}>
                    {/* binding rings */}
                    <div style={{ position: "absolute", top: -u * 0.55, left: 0, right: 0, display: "flex", justifyContent: "center", gap: u * 2.6, zIndex: 2 }}>
                      {[0, 1].map((i) => <span key={i} style={{ width: u * 0.5, height: u * 1.1, borderRadius: u * 0.25, background: SILVER_MID, border: `${u * 0.06}px solid ${RAISIN}` }} />)}
                    </div>
                    {/* month header — the sheet lifts/settles on every flip */}
                    <div style={{ position: "relative", height: u * 3.6, background: RAISIN, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.0, letterSpacing: "0.04em", color: WHITE, transform: `translateY(${-peel * u * 1.1}px)`, opacity: 1 - peel * 0.55 }}>{month}</span>
                    </div>
                    {/* big year odometer */}
                    <div style={{ padding: `${u * 0.85}px 0 ${u * 0.35}px`, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 4.2, letterSpacing: "-0.02em", color: RAISIN, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{year}</div>
                    {/* day grid (3 rows) — the landed day lights lime */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: u * 0.32, padding: `${u * 0.25}px ${u * 1.0}px ${u * 1.05}px` }}>
                      {Array.from({ length: 21 }).map((_, i) => <span key={i} style={{ height: u * 0.6, borderRadius: u * 0.15, background: !flipping && i === 13 ? LIME : "#dfe3e5" }} />)}
                    </div>
                  </div>
                  {/* the "+2 YEARS" badge pops on landing */}
                  {badge > 0.01 && (
                    <div style={{ position: "absolute", right: -u * 1.4, top: -u * 1.4, transform: `translate(50%,-50%) scale(${0.6 + 0.4 * badge}) rotate(-7deg)`, opacity: Math.min(1, badge * 1.5) }}>
                      <div style={{ background: LIME, borderRadius: u * 0.5, padding: `${u * 0.42}px ${u * 0.95}px`, boxShadow: `${u * 0.3}px ${u * 0.3}px 0 rgba(15,18,26,0.9)`, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.6, color: RAISIN, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>+2 YEARS</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* BEAT 13 — the founding offer: $97, first 100 people. A small price, premium presentation
          (the offer card is the focal point; NOTHING COMPARED to what you ship) (63.25–69.95) */}
      {t >= 63.5 && t < 70.2 && (() => {
        const o = clamp01((t - 63.6) / 0.4) * (1 - clamp01((t - 69.75) / 0.35));
        const cardP = EASE(clamp01((t - 64.45) / 0.55));   // card reveals on "price tag"
        const priceP = clamp01((t - 64.85) / 0.4);
        const headP = clamp01((t - 66.21) / 0.4);          // NOTHING, COMPARED
        const pillP = clamp01((t - 67.0) / 0.4);
        const valP = clamp01((t - 68.27) / 0.45);          // value glow on "achieve"
        const glow = 0.4 + 0.6 * Math.abs(Math.sin((t - 65) * 1.5));
        return (
          <>
            {/* GLOBAL RULE — the beat headline moves to BOTTOM-MIDDLE (over footage, silver) */}
            <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.9, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.7)", opacity: o * headP }}>
              <Marker u={u} t={t} at={66.21}>NOTHING</Marker>, COMPARED
            </div>
            {/* the premium offer card */}
            <div style={{ position: "absolute", left: "4.5%", top: "51%", transform: "translateY(-50%)", opacity: o }}>
            <div style={{ position: "relative", width: u * 30, transformOrigin: "left center", transform: `scale(${0.92 + 0.08 * cardP})`, opacity: cardP, clipPath: `inset(0 ${(1 - cardP) * 100}% 0 0 round ${u * 1.1}px)` }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 1.1, transform: `translate(${u * 0.55}px,${u * 0.55}px)`, opacity: 0.9 }} />
              <div style={{ position: "relative", background: "#12151d", border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 1.1, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.55), 0 0 ${u * (0.4 + valP * 2.4)}px rgba(207,255,5,${0.12 + valP * 0.4})` }}>
                <div style={{ padding: `${u * 1.4}px ${u * 1.6}px 0`, display: "flex", alignItems: "baseline", gap: u * 0.7 }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.6, color: WHITE, letterSpacing: "-0.03em", lineHeight: 1.05, opacity: priceP, transform: `translateY(${(1 - EASE_OVER(priceP)) * u * 0.8}px)`, display: "inline-block" }}>$97</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, color: SILVER_MID, opacity: priceP, whiteSpace: "nowrap" }}>one-time</span>
                </div>
                <div style={{ height: u * 0.09, background: "#2a3145", margin: `${u * 0.95}px ${u * 1.6}px` }} />
                <div style={{ padding: `0 ${u * 1.6}px ${u * 1.35}px` }}>
                  <span style={{ display: "inline-flex", alignItems: "center", background: LIME, borderRadius: u * 2, padding: `${u * 0.48}px ${u * 1.15}px`, transformOrigin: "left center", transform: `scale(${0.8 + 0.2 * EASE_OVER(pillP)})`, opacity: pillP, boxShadow: `0 0 ${u * (0.5 + glow * 1.3)}px rgba(207,255,5,0.45)` }}>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.06em", color: RAISIN, whiteSpace: "nowrap" }}>FIRST 100 PEOPLE</span>
                  </span>
                </div>
              </div>
            </div>
            </div>
          </>
        );
      })()}

      {/* BEAT 16 — outro: like + subscribe, the upcoming rail, dark register back (80.87–87.37) */}
      {t >= 81.5 && (() => {
        const clShrink = 1 - 0.1 * EASE(clamp01((t - 83.77) / 0.5));
        const thO = clamp01((t - 82.07) / 0.25);
        const subO = clamp01((t - 82.63) / 0.25);
        const tick = clamp01((t - 82.9) / 0.25);
        const railIn = EASE(clamp01((t - 83.77) / 0.6));
        const lit = clamp01((t - 86.73) / 0.3);
        return (
          <div>
            {/* subscribe cluster lower-left */}
            <div style={{ position: "absolute", left: "6%", top: "74%", transform: `scale(${clShrink})`, transformOrigin: "0% 50%", display: "flex", alignItems: "center", gap: u * 1.4 }}>
              <div style={{ opacity: thO, transform: `translateY(${(1 - EASE_OVER(thO)) * u * 1.4}px)` }}>
                <Img src={staticFile("logos/lucide-thumbs-up-silver.svg")} style={{ width: u * 3.2, height: u * 3.2, filter: `drop-shadow(0 ${u * 0.3}px ${u * 0.8}px rgba(0,0,0,0.7))` }} />
              </div>
              <div style={{ opacity: subO, transform: `scale(${0.85 + 0.15 * EASE_OVER(subO)})`, display: "flex", alignItems: "center", gap: u * 0.7, background: "rgba(15,18,26,0.82)", border: `${u * 0.13}px solid ${SILVER}`, borderRadius: u * 2, padding: `${u * 0.7}px ${u * 1.5}px` }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, letterSpacing: "0.04em", color: SILVER }}>SUBSCRIBE</span>
                {tick > 0 && (
                  <span style={{ width: u * 1.9, height: u * 1.9, borderRadius: "50%", background: LIME, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.5 + 0.5 * EASE_OVER(tick)})`, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.15, color: RAISIN }}>✓</span>
                )}
              </div>
            </div>
            {/* the upcoming-videos rail lower-right; the first lights on "next" (86.73) */}
            {railIn > 0 && (
              <div style={{ position: "absolute", right: `${lerp(-16, 5, railIn)}%`, top: "74%", display: "flex", gap: u * 1.6, opacity: railIn }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ position: "relative", width: u * 8.5, height: u * 5.3, background: "rgba(18,21,29,0.85)", border: `${u * 0.13}px ${i === 0 && lit > 0.4 ? "solid" : "dashed"} ${i === 0 && lit > 0.4 ? SILVER : "#4a5268"}`, borderRadius: u * 0.5, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: i === 0 && lit > 0.4 ? `0 0 ${u * 1.6}px ${SILVER}44` : "none" }}>
                    <div style={{ width: 0, height: 0, borderTop: `${u * 0.55}px solid transparent`, borderBottom: `${u * 0.55}px solid transparent`, borderLeft: `${u * 0.85}px solid ${i === 0 && lit > 0.4 ? SILVER : "#4a5268"}`, marginLeft: u * 0.15 }} />
                    {i === 0 && lit > 0 && <span style={{ position: "absolute", left: 0, right: 0, bottom: u * 0.35, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.78, color: SILVER, opacity: lit }}>next video</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* THE HERO CARD's last leg: hops off the loop (58.25), docks bottom-center, idles through
          beats 13–15, and takes its final loop-arrow bow on "Bye." (87.11) */}
      {t >= 58.25 && (() => {
        const hp = EASE(clamp01((t - 58.25) / 0.8));
        const bz = (a: number, b: number, c: number) => (1 - hp) * (1 - hp) * a + 2 * (1 - hp) * hp * b + hp * hp * c;
        const hx = bz(13, 28, 50), hy = bz(12.6, 14, 76);  // idle raised 88→76 to clear the bottom-middle headline band
        const ringP = clamp01((t - 87.05) / 0.26);
        const bye = 1 - clamp01((t - 87.15) / 0.2);
        const ringR = u * 3.4;
        return (
          <div style={{ opacity: bye }}>
            <div style={{ position: "absolute", left: `${hx}%`, top: `${hy + (hp >= 1 ? amb.bob(0.3, 0.25) : 0)}%`, transform: "translate(-50%,-50%)" }}>
              <MiniCard u={u} hero s={lerp(0.62, 0.7, hp)} glow={ringP * 0.8} />
            </div>
            {ringP > 0 && (
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <circle cx={0.5 * W} cy={0.76 * H + amb.bob(0.3, 0.25) / 100 * H} r={ringR} fill="none" stroke={LIME} strokeWidth={u * 0.28} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - EASE(ringP))} transform={`rotate(-90 ${0.5 * W} ${0.76 * H})`} style={{ filter: `drop-shadow(0 0 ${u * 0.7}px ${LIME}aa)` }} />
              </svg>
            )}
          </div>
        );
      })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default LSAct4;
