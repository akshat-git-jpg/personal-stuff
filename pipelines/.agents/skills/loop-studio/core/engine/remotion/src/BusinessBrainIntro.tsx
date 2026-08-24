/**
 * BusinessBrainIntro — moody, filmic cold-open for the "Business Brain" longform.
 * Direction (locked with Luuk): MOODY & FILMIC, faster. Side/profile shot (LUT-graded, letterboxed)
 * as hero; clean Kikkertweg-53 voice (sped 1.15×, lip-locked). Captions are CINEMATIC KEYWORD
 * fragments kinetic-typed into the left negative space (not full sentences). Claude's response
 * (thinking → rising revenue graph) builds as an OVERLAY on the footage WHILE he's still talking,
 * then a clean cut into the hook.
 */
import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const CLAY = "#D97757";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);

const END = 18.7;
const BARH = 0.1278;

// kinetic ICON fragments (sped intro time). Each is placed DIFFERENTLY — varied x/y/size/rot.
// No text captions: each thing Luuk lists appears as a recognizable brand/lucide ICON with an
// animated lime marker swipe under it. Premium editorial, not stacked.
type Kw = { key: string; icon: string; at: number; x: number; y: number; size: number; rot: number };
const KW: Kw[] = [
  { key: "revenue", icon: "brand-stripe.svg", at: 3.45, x: 5, y: 20, size: 5.0, rot: -3 },
  { key: "products", icon: "lucide-shopping-cart-silver.svg", at: 4.86, x: 21, y: 40, size: 4.4, rot: 2 },
  { key: "support", icon: "lucide-message-circle-silver.svg", at: 6.13, x: 4, y: 32, size: 4.6, rot: -1 },
  { key: "margins", icon: "lucide-percent-silver.svg", at: 7.51, x: 24, y: 20, size: 4.8, rot: 3 },
  { key: "competitors", icon: "lucide-users-silver.svg", at: 11.30, x: 6, y: 44, size: 5.0, rot: -2 },
];
// once the real Claude response is on screen, NO caption text overlaps it.
const CLAUDE_IN = 12.9;

const GRAIN_URI = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.55'/></svg>`
);

const Flash: React.FC<{ at: number; color?: string; peak?: number; up?: number; down?: number }> = ({ at, color = "#fff", peak = 0.5, up = 1, down = 5 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + up, at + up + down], [0, peak, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 0.4, rate = 1 }) => (
  <Sequence from={at} durationInFrames={f(1.6)}><Audio src={staticFile(src)} volume={volume} playbackRate={rate} /></Sequence>
);

export const BusinessBrainIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  const push = 1.05 + interpolate(frame, [0, f(END)], [0, 0.06], { extrapolateRight: "clamp", easing: Easing.linear });
  const dx = Math.sin(frame / 120) * 0.1, dy = Math.cos(frame / 150) * 0.08;
  const openFade = interpolate(frame, [0, f(0.7)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scrim = interpolate(frame, [f(2.6), f(3.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: SANS }}>
      {/* hero: LUT-graded side shot (muted) + clean sped VO */}
      <AbsoluteFill style={{ transform: `translate(${dx * u}px, ${dy * u}px) scale(${push})` }}>
        <OffthreadVideo src={staticFile("intros/businessbrain/side_lut_fast.mp4")} muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <Audio src={staticFile("intros/businessbrain/voice_clean_fast.wav")} />

      {/* left scrim for overlay legibility (cinematic) */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: scrim,
        background: "linear-gradient(90deg, rgba(5,7,12,0.72) 0%, rgba(5,7,12,0.34) 26%, transparent 48%)" }} />

      {/* ONE continuous Claude presence: "Hey Claude" mark → travels + listens → hands off to response */}
      <ClaudeThread u={u} W={W} H={H} />

      {/* Claude's real response builds as an overlay while he's still asking (no scattered icons) */}
      <ClaudeResponse u={u} W={W} H={H} />

      {/* lower-third captions of the spoken question, synced across the intro */}
      <Captions u={u} />

      {/* vignette + grain */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 74% at 52% 46%, transparent 48%, rgba(0,0,0,0.6) 100%)" }} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.055, mixBlendMode: "overlay",
        backgroundImage: `url("${GRAIN_URI}")`, backgroundSize: `${u * 12.5}px`,
        transform: `translate(${(frame % 3) * 3}px, ${(frame % 2) * -3}px)` }} />

      {/* 2.39:1 letterbox */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${BARH * 100}%`, background: "#000", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${BARH * 100}%`, background: "#000", pointerEvents: "none" }} />

      <RecTag u={u} />
      <AbsoluteFill style={{ background: "#000", opacity: openFade, pointerEvents: "none" }} />

      <Flash at={f(END) - 5} color={LIME} peak={0.26} up={2} down={5} />
      <Flash at={f(END) - 1} color="#ffffff" peak={0.9} up={1} down={4} />

      <Sfx src="higgs/sfx/whoosh.wav" at={f(CLAUDE_IN) - 3} volume={0.2} rate={0.95} />
    </AbsoluteFill>
  );
};

/* ---------------- kinetic ICONS — varied, premium, lime marker swipe under each icon --------- */
const KineticKeywords: React.FC<{ u: number; H: number }> = ({ u, H }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {KW.map((k, i) => {
        const at = f(k.at);
        const next = i < KW.length - 1 ? f(KW[i + 1].at) : f(END);
        // all icons must clear the screen before the real Claude response appears
        const outAt = Math.min(next, at + f(2.6), f(CLAUDE_IN - 0.25));
        if (frame < at - 8 || frame > outAt + 9) return null;
        // reveal: clip-wipe from left + rise, settle (same cinematic motion as before)
        const rev = interpolate(frame, [at, at + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        const outP = interpolate(frame, [outAt - 3, outAt + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const op = Math.min(interpolate(frame, [at - 2, at + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), outP);
        const iconPx = u * k.size * 1.7;
        return (
          <div key={i} style={{
            position: "absolute", left: `${k.x}%`, top: `${k.y}%`,
            opacity: op, transform: `translateY(${(1 - rev) * u * 1.4}px) rotate(${k.rot}deg)`, transformOrigin: "left top",
          }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              {/* soft dark seat so the icon reads cleanly over any part of the footage */}
              <div style={{
                position: "absolute", inset: `${-u * 1.6}px`, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(5,7,12,0.6) 0%, rgba(5,7,12,0.28) 46%, transparent 72%)",
              }} />
              {/* icon, wiped in from the left */}
              <div style={{ position: "relative", clipPath: `inset(0 ${(1 - rev) * 100}% 0 0)` }}>
                <Img src={staticFile(`logos/${k.icon}`)} style={{
                  width: iconPx, height: iconPx, display: "block",
                  filter: "drop-shadow(0 6px 26px rgba(0,0,0,0.85))",
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ---------------- REAL Claude session, in a clean, readable, prominent window ------------------
   The payoff: a real Claude Code session actually working on his business. Framed in a crisp
   dark window with a Claude title bar + a live "working" dot, rising in with a slow push so it
   reads as REAL and catchy — not a ghosted screen-blend. */
const ClaudeResponse: React.FC<{ u: number; W: number; H: number }> = ({ u, W, H }) => {
  const frame = useCurrentFrame();
  const inAt = f(CLAUDE_IN);
  if (frame < inAt - 4) return null;
  const op = interpolate(frame, [inAt, inAt + f(0.7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const rise = interpolate(frame, [inAt, inAt + f(1.0)], [u * 4.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const sc = interpolate(frame, [inAt, inAt + f(1.4)], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const zoom = 1.02 + interpolate(frame, [inAt, f(END)], [0, 0.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); // slow push-in
  const dot = Math.floor(frame / 12) % 2 === 0;
  return (
    <div style={{
      position: "absolute", left: "5.5%", top: `${BARH * 100 + 3.5}%`, width: "48%", height: "60%",
      opacity: op, transform: `translateY(${rise}px) scale(${sc})`, transformOrigin: "left center",
      borderRadius: u * 1.1, overflow: "hidden", background: "#0d0e13", pointerEvents: "none",
      border: "1px solid rgba(217,119,87,0.42)", display: "flex", flexDirection: "column",
      boxShadow: `0 ${u * 1.6}px ${u * 5}px rgba(0,0,0,0.72), 0 0 ${u * 2.6}px rgba(217,119,87,0.16)`,
    }}>
      {/* title bar — unmistakably CLAUDE, live */}
      <div style={{ flex: "0 0 auto", height: u * 3.4, display: "flex", alignItems: "center", gap: u * 0.9,
        padding: `0 ${u * 1.4}px`, background: "linear-gradient(180deg,#191a20,#141519)", borderBottom: "1px solid #26272e" }}>
        <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.9, height: u * 1.9 }} />
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.55, color: "#EAE4DE" }}>Claude</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: u * 0.55, fontFamily: MONO, fontSize: u * 1.05, color: "#8a92a0" }}>
          <span style={{ width: u * 0.5, height: u * 0.5, borderRadius: "50%", background: "#3ecf8e", opacity: dot ? 1 : 0.35, boxShadow: `0 0 ${u * 0.5}px #3ecf8e` }} />working
        </span>
      </div>
      {/* the REAL session — framed, full-opacity, readable, slow push-in on the chat */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <OffthreadVideo src={staticFile("intros/businessbrain/screen.mp4")} muted
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "6% 20%",
            transform: `scale(${zoom})`, transformOrigin: "12% 30%", filter: "brightness(1.06) contrast(1.03)" }} />
      </div>
    </div>
  );
};

/* ---------------- ONE continuous Claude presence ----------------------------------------------
   A SINGLE claude-white.svg mark is on screen the whole cold-open. While the caption reads
   "Hey Claude" it holds an UPPER seat; the moment the caption advances to the next sentence
   (~2.5s) the mark drops DOWN to a lower seat and a WHITE listening equalizer wakes up right
   under it — reading clearly as "Claude is listening" while the rest of the question is spoken.
   At the hand-off (~12.2s) mark + equalizer fade into the real ClaudeResponse screen (~12.9s).
   It is never drawn twice, never a hand-drawn spark, and there is NO on-screen "Hey Claude" text. */
const ClaudeThread: React.FC<{ u: number; W: number; H: number }> = ({ u, W, H }) => {
  const frame = useCurrentFrame();
  const markIn = f(0.85);
  const markFadeStart = f(12.0), markOut = f(12.9); // hands off into the real Claude response
  if (frame < markIn - 2 || frame > markOut) return null;

  const op = Math.min(
    interpolate(frame, [markIn, markIn + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }),
    interpolate(frame, [markFadeStart, markOut], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const rise = interpolate(frame, [markIn, markIn + 12], [u * 1.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const pulse = 1 + 0.05 * Math.sin(frame * 0.2);
  const spark = u * 5.4;

  // "listening" waveform wakes once he's past "Hey Claude" into the question (~3.2s)
  const lisIn = f(3.2), lisOutStart = f(11.8);
  const lisEnv = interpolate(frame, [lisIn, lisIn + 9, lisOutStart - 6, lisOutStart], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const listenLabel = interpolate(frame, [f(3.4), f(4.0)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // grouped, centered in the left negative space (subject is on the right); rises in, gently breathes
  return (
    <div style={{
      position: "absolute", left: "37%", top: "39%", transform: `translate(-50%,-50%) translateY(${rise}px)`,
      opacity: op, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.6,
    }}>
      {/* soft dark seat so the whole group reads over any footage */}
      <div style={{ position: "absolute", inset: `${-u * 3.4}px ${-u * 6}px`, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(5,7,12,0.66) 0%, rgba(5,7,12,0.26) 52%, transparent 76%)" }} />

      {/* orange Claude spark + "Claude" wordmark — unmistakably CLAUDE (real brand color) */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: u * 1.5 }}>
        <div style={{ position: "relative", width: spark, height: spark, transform: `scale(${pulse})` }}>
          <div style={{ position: "absolute", inset: "-42%", background: "radial-gradient(circle, rgba(217,119,87,0.5) 0%, transparent 62%)" }} />
          <Img src={staticFile("logos/claude.svg")} style={{ position: "relative", width: "100%", height: "100%",
            filter: `drop-shadow(0 0 ${u * 1.5}px rgba(217,119,87,0.65))` }} />
        </div>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 4.8, color: "#F5EFEA", letterSpacing: "-0.015em",
          textShadow: "0 4px 30px rgba(0,0,0,0.85)" }}>Claude</span>
      </div>

      {/* "listening" + white waveform */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: u * 1.1, opacity: lisEnv }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.28em", color: SILVER,
          textTransform: "uppercase", opacity: 0.72 * listenLabel }}>listening</span>
        <div style={{ display: "flex", alignItems: "center", gap: u * 0.32, height: u * 2.6 }}>
          {Array.from({ length: 16 }).map((_, i) => {
            const a = Math.abs(Math.sin(frame * 0.4 + i * 0.6));
            const b = Math.abs(Math.sin(frame * 0.17 + i * 1.1));
            const h = (0.16 + 0.84 * a * (0.5 + 0.5 * b)) * lisEnv;
            return <div key={i} style={{ width: u * 0.26, height: `${Math.max(3, h * u * 2.6)}px`, borderRadius: u * 0.2,
              background: "#FFFFFF", opacity: 0.4 + 0.5 * h, boxShadow: `0 0 ${u * 0.5}px rgba(255,255,255,0.5)` }} />;
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------------- lower-third captions of the spoken question ----------------------------------
   Silver text on a subtle dark plate, seated above the bottom letterbox, out of the way of the
   mark / icons / response. Revealed in synced chunks across the intro. */
// Lower-third caption of the spoken question — wording stays synced to the VO, but the KEY word
// of each line is punched up in lime + bold weight so it reads more kinetic. "Hey Claude" appears
// here, once, as the first line (it is the ONLY place the phrase lives on screen).
const CAP: { at: number; text: string; emph: string }[] = [
  { at: 0.85, text: "Hey Claude,", emph: "Claude" },
  { at: 2.2, text: "based on all my revenue,", emph: "revenue" },
  { at: 4.6, text: "all my products,", emph: "products" },
  { at: 5.9, text: "all my support messages", emph: "support" },
  { at: 7.2, text: "and margins,", emph: "margins" },
  { at: 8.6, text: "and your research", emph: "research" },
  { at: 10.9, text: "about competitors —", emph: "competitors" },
  { at: 12.6, text: "what should I focus on,", emph: "focus" },
  { at: 14.6, text: "and how do I 10x my revenue?", emph: "10x" },
];
// render one caption line, punching the key word in lime + bold
const capLine = (text: string, emph: string): React.ReactNode => {
  const i = text.indexOf(emph);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ color: LIME, fontWeight: 700 }}>{emph}</span>
      {text.slice(i + emph.length)}
    </>
  );
};
const Captions: React.FC<{ u: number }> = ({ u }) => {
  const frame = useCurrentFrame();
  const start = f(CAP[0].at), end = f(17.6);
  if (frame < start - 2 || frame > end + 6) return null;
  const bandOp = interpolate(frame, [start, start + 6, end, end + 6], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let idx = 0;
  for (let i = 0; i < CAP.length; i++) if (frame >= f(CAP[i].at)) idx = i;
  const cAt = f(CAP[idx].at);
  const txtOp = interpolate(frame, [cAt, cAt + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const txtRise = interpolate(frame, [cAt, cAt + 7], [u * 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: `${BARH * 100 + 3.5}%`,
      display: "flex", justifyContent: "center", opacity: bandOp, pointerEvents: "none",
    }}>
      <div style={{
        maxWidth: "74%", padding: `${u * 0.95}px ${u * 2.2}px`, borderRadius: u * 0.8,
        background: "rgba(9,12,18,0.68)", border: "1px solid rgba(181,191,194,0.16)",
        backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        boxShadow: "0 12px 44px rgba(0,0,0,0.55)",
      }}>
        <span style={{
          display: "inline-block", fontFamily: SANS, fontWeight: 600, fontSize: u * 2.95,
          letterSpacing: "0.004em", color: "#EEF0F3", whiteSpace: "nowrap", textAlign: "center",
          opacity: txtOp, transform: `translateY(${txtRise}px)`, textShadow: "0 2px 16px rgba(0,0,0,0.8)",
        }}>
          {capLine(CAP[idx].text, CAP[idx].emph)}
        </span>
      </div>
    </div>
  );
};

/* ---------------- filmic REC timecode ---------------- */
const RecTag: React.FC<{ u: number }> = ({ u }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [f(0.5), f(1.2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blink = Math.floor(frame / 15) % 2 === 0;
  const ss = Math.floor(frame / FPS), ff = frame % FPS;
  const tc = `00:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
  return (
    <div style={{ position: "absolute", right: u * 4, top: `${BARH * 100 + 3}%`, display: "flex", alignItems: "center", gap: u * 0.7, opacity: p * 0.8 }}>
      <div style={{ width: u * 0.6, height: u * 0.6, borderRadius: "50%", background: CLAY, opacity: blink ? 1 : 0.25, boxShadow: `0 0 ${u * 0.6}px ${CLAY}` }} />
      <div style={{ fontFamily: MONO, fontSize: u * 1.0, letterSpacing: "0.22em", color: SILVER }}>REC</div>
      <div style={{ fontFamily: MONO, fontSize: u * 1.0, letterSpacing: "0.14em", color: SILVER, opacity: 0.8, marginLeft: u * 0.4 }}>{tc}</div>
    </div>
  );
};

export default BusinessBrainIntro;
