/**
 * OutroCredits — 8s outro for videoedit4 (16:9, 4K). Dark canvas register.
 * Concept: FILM END CREDITS where the whole crew is claude — the video's thesis
 * as a credit roll. Plus:
 *   "links in the description" → a links chip with a straight down arrow
 *   "like and subscribe"       → the rolling credit line `and you · subscribe`
 *                                takes the single lime moment
 *   "my next video"            → a dashed end-screen slot (space for the real
 *                                YouTube end-screen element) slides in
 * Ends on a stable frame (no fade) so the end screen can live on top.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER = "#B5BFC2";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const T = {
  cardOut: 34,               // early — outro moves fast
  creditsIn: 44,
  linksAt: f(2.56),          // "make sure to check the links"
  subLineAt: f(5.08),        // "like" — the you·subscribe credit lights up
  slotAt: f(5.92),           // "and then we'll see each other"
};
const DUR = 241;

const CREDITS: { role: string; name: string; you?: boolean }[] = [
  { role: "directed by", name: "luuk" },
  { role: "filmed by", name: "luuk" },
  { role: "edited by", name: "claude" },
  { role: "a-roll cut", name: "claude" },
  { role: "b-roll", name: "claude" },
  { role: "captions", name: "claude" },
  { role: "sound design", name: "claude" },
  { role: "color", name: "claude" },
  { role: "music", name: "claude" },
  { role: "rendered by", name: "claude" },
  { role: "and you", name: "subscribe", you: true },
];

const GRID_URI = (() => {
  const s = 152;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(233,236,237,0.07)' stroke-width='2'/></svg>`
    )
  );
})();

export const OutroCredits: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  const drift = 1 + (frame / DUR) * 0.05; // slow push the whole runtime

  /* speaker card: fullscreen → mid-left, stays */
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [0, 0.5, 0.5, 0.94],
      [T.cardOut, 0.5, 0.5, 0.94],
      [T.cardOut + 28, 0.26, 0.46, 0.40],
      [DUR, 0.26, 0.46, 0.40],
    ];
    for (let i = 0; i < kf.length - 1; i++) {
      const [fa, xa, ya, wa] = kf[i]; const [fb, xb, yb, wb] = kf[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = EASE((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
      }
    }
    const [, x, y, w] = kf[kf.length - 1]; return { x, y, w };
  })();
  const spkW = spk.w * W, spkH = spkW * 9 / 16;
  const hookBlur = interpolate(frame, [0, 14], [8, 0], { ...clamp, easing: Easing.out(Easing.quad) });

  /* credits roll */
  const credIn = interpolate(frame, [T.creditsIn, T.creditsIn + 20], [0, 1], { ...clamp, easing: EASE });
  const scroll = interpolate(frame, [T.creditsIn, DUR], [H * 0.34, -H * 0.30], clamp);
  const credDim = interpolate(frame, [T.slotAt, T.slotAt + 18], [1, 0.45], clamp); // recede when the slot arrives
  const LINE_H = u * 3.4;

  const linksP = frame >= T.linksAt ? interpolate(frame, [T.linksAt, T.linksAt + 16], [0, 1], { ...clamp, easing: EASE }) : 0;
  const slotP = frame >= T.slotAt ? interpolate(frame, [T.slotAt, T.slotAt + 22], [0, 1], { ...clamp, easing: EASE }) : 0;
  const subLit = frame >= T.subLineAt;

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${152 * drift}px`,
        backgroundPosition: `${-frame * 0.15}px ${-frame * 0.1}px`,
        maskImage: "radial-gradient(ellipse 85% 72% at 50% 46%, #000 0%, rgba(0,0,0,.4) 62%, transparent 95%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 72% at 50% 46%, #000 0%, rgba(0,0,0,.4) 62%, transparent 95%)",
      }} />

      {/* ================= CREDITS ROLL (right column) ================= */}
      <div style={{
        position: "absolute", left: W * 0.52, width: W * 0.40, top: 0, bottom: 0,
        opacity: credIn * credDim, overflow: "hidden",
        maskImage: "linear-gradient(transparent 4%, #000 22%, #000 78%, transparent 96%)",
        WebkitMaskImage: "linear-gradient(transparent 4%, #000 22%, #000 78%, transparent 96%)",
        transform: `scale(${drift})`, transformOrigin: "50% 50%",
      }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: scroll }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.9, color: SILVER, marginBottom: LINE_H * 0.9, textAlign: "center" }}>
            a buildloop video
          </div>
          {CREDITS.map((cr, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: `0 ${u * 4}px`, marginBottom: LINE_H * 0.62,
            }}>
              <span style={{ fontFamily: MONO, fontSize: u * 1.35, letterSpacing: "0.22em", color: "rgba(181,191,194,0.55)" }}>
                {cr.role.toUpperCase()}
              </span>
              {cr.you ? (
                <span style={{
                  fontFamily: MONO, fontSize: u * 1.6, fontWeight: 700, letterSpacing: "0.1em",
                  color: RAISIN, background: subLit ? LIME : "rgba(233,236,237,0.5)",
                  padding: `${u * 0.25}px ${u * 0.8}px`, borderRadius: 8,
                  boxShadow: subLit ? `0 0 ${u * 2.4}px rgba(207,255,5,0.35)` : "none",
                }}>{cr.name}</span>
              ) : (
                <span style={{
                  fontFamily: MONO, fontSize: u * 1.6, fontWeight: 700, letterSpacing: "0.1em",
                  color: cr.name === "claude" ? "#FFFFFF" : SILVER,
                }}>{cr.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ================= LINKS CHIP ================= */}
      {linksP > 0 && (
        <div style={{
          position: "absolute", left: W * 0.26, top: H * 0.80,
          transform: `translateX(-50%) translateY(${(1 - linksP) * 30}px)`, opacity: linksP,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: u * 1.1,
            padding: `${u * 0.8}px ${u * 1.6}px`, borderRadius: 14,
            background: "rgba(233,236,237,0.07)", border: "1.5px solid rgba(233,236,237,0.22)",
          }}>
            <span style={{ fontFamily: MONO, fontSize: u * 1.3, letterSpacing: "0.16em", color: SILVER_BG }}>
              links · in the description
            </span>
            <svg width={u * 1.3} height={u * 1.7} viewBox="0 0 20 26">
              <line x1="10" y1="2" x2="10" y2="18" stroke={SILVER_BG} strokeWidth="2.6" strokeLinecap="round" />
              <path d="M 4 13 L 10 20 L 16 13" fill="none" stroke={SILVER_BG} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      {/* ================= NEXT VIDEO end-screen slot ================= */}
      {slotP > 0 && (
        <div style={{
          position: "absolute", left: W * 0.585, top: H * 0.30,
          width: W * 0.31, height: W * 0.31 * 9 / 16,
          transform: `translateY(${(1 - slotP) * 40}px)`, opacity: slotP,
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 18,
            border: "3px dashed rgba(233,236,237,0.4)",
            background: "rgba(233,236,237,0.04)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 1,
          }}>
            <svg width={u * 3} height={u * 3} viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" fill="rgba(233,236,237,0.55)" />
            </svg>
            <span style={{ fontFamily: MONO, fontSize: u * 1.25, letterSpacing: "0.3em", color: "rgba(233,236,237,0.6)" }}>
              NEXT VIDEO
            </span>
          </div>
        </div>
      )}

      {/* ================= SPEAKER CARD ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 6px 26px rgba(0,0,0,0.55), 0 0 0 1px rgba(233,236,237,0.13)",
      }}>
        <OffthreadVideo src={staticFile("intros/videoedit4_outro/source.mp4")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: `contrast(1.05) saturate(1.06)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
          }} />
      </div>

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 74% at 50% 46%, transparent 60%, rgba(0,0,0,0.28) 100%)" }} />

      {/* ---- SFX ---- */}
      <Sfx src="vedit/sfx/slide.wav" at={T.cardOut + 2} volume={0.22} />
      <Sfx src="vedit/sfx/soft.wav" at={T.creditsIn + 6} volume={0.24} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.linksAt} volume={0.24} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.subLineAt + 4} volume={0.28} />
      <Sfx src="vedit/sfx/slide.wav" at={T.slotAt} volume={0.24} />
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.26 }) => (
  <Sequence from={at} durationInFrames={f(1.4)}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

export default OutroCredits;
