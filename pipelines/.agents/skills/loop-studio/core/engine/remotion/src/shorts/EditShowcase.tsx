/**
 * EditShowcase — 38s montage of the four edited pieces, as an edit of its own.
 * Canvas world: the four videos pinned as framed players on the draftsman grid.
 * The camera glides card to card; ONE plays at a time (its own audio low under
 * the underscore), the others hold on strong poster frames, dimmed.
 *
 *  f0–75     wide: all four visible, eyebrow types `four edits · one skill`
 *  f75–300   AI EMPLOYEE (16:9) — US map flood + pull-back (clip 1.0s→8.5s)
 *  f300–525  MACHINE (16:9) — freeze, better = ▮ full-frame, red sparkline (3.2s→10.7s)
 *  f525–750  WAVE (9:16) — $400M reveal + dive to the stack (0.5s→8.0s)
 *  f750–967  YT INTRO (9:16) — name, bar stops at 85%, restack (0.3s→7.5s)
 *  f967–1140 wide again: all four, "all edited by claude." — fade.
 */
import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

type Card = {
  id: string; label: string;
  cx: number; cy: number; w: number; h: number;   // world
  segStart: number; segEnd: number;               // active window (comp frames)
  clipFrom: number;                               // source start (frames)
};
const CARDS: Card[] = [
  { id: "aie", label: "ai employee · intro", cx: 900, cy: 500, w: 1280, h: 720, segStart: 80, segEnd: 500, clipFrom: 15 },
  { id: "machine", label: "what better means · intro", cx: 2700, cy: 800, w: 1280, h: 720, segStart: 500, segEnd: 840, clipFrom: 6 },
  { id: "wave", label: "$400M · short", cx: 1300, cy: 1800, w: 506, h: 900, segStart: 840, segEnd: 1206, clipFrom: 9 },
  { id: "yt", label: "the dropout · short", cx: 2500, cy: 1900, w: 506, h: 900, segStart: 1206, segEnd: 1440, clipFrom: 3 },
];

const CAM: [number, number, number, number][] = [
  [0, 1750, 1200, 0.44],
  [75, 1765, 1208, 0.455],
  [108, 900, 500, 1.16],      // → aie (plays almost in full)
  [495, 910, 505, 1.17],
  [530, 2700, 800, 1.16],     // → machine
  [835, 2710, 806, 1.17],
  [870, 1300, 1800, 1.12],    // → wave
  [1200, 1306, 1806, 1.13],
  [1232, 2500, 1900, 1.12],   // → yt
  [1435, 2506, 1906, 1.13],
  [1495, 1750, 1200, 0.46],   // ← wide
  [1620, 1758, 1206, 0.465],
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = EASE((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}

const GRID_URI = (() => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(15,18,26,0.10)' stroke-width='1'/></svg>`
    )
  );
})();

const EYEBROW = "four edits · one skill";

export const EditShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();

  const c0 = cam(frame);
  const c = { x: c0.x + Math.sin(frame / 40) * 4, y: c0.y + Math.cos(frame / 49) * 3, z: c0.z };
  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * c.z}px, ${H / 2 - c.y * c.z}px) scale(${c.z})`,
    transformOrigin: "0 0",
  };

  const endFade = interpolate(frame, [1596, 1620], [1, 0], clamp);
  const typedN = Math.floor(interpolate(frame, [10, 62], [0, EYEBROW.length], clamp));
  const eyebrowOut = interpolate(frame, [75, 94], [1, 0], clamp);
  const closerP = interpolate(frame, [1512, 1534], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${76 * c.z}px`,
        backgroundPosition: `${W / 2 - c.x * c.z}px ${H / 2 - c.y * c.z}px`,
        maskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
      }} />

      {/* ================= WORLD: the four players ================= */}
      <div style={{ ...worldStyle, opacity: endFade }}>
        {CARDS.map((card) => {
          const active = frame >= card.segStart && frame < card.segEnd;
          const activeP =
            interpolate(frame, [card.segStart, card.segStart + 16], [0, 1], clamp) *
            interpolate(frame, [card.segEnd - 10, card.segEnd + 6], [1, 0], clamp);
          const dim = active ? 1 : 0.42 + 0.1 * activeP;
          const labelP = interpolate(frame, [card.segStart + 18, card.segStart + 32], [0, 1], clamp) *
            interpolate(frame, [card.segEnd - 14, card.segEnd], [1, 0], clamp);
          return (
            <div key={card.id}>
              {/* frame + media */}
              <div style={{
                position: "absolute", left: card.cx - card.w / 2, top: card.cy - card.h / 2,
                width: card.w, height: card.h, borderRadius: 16, overflow: "hidden",
                boxShadow: active
                  ? "0 10px 30px rgba(15,18,26,.28), 0 60px 110px -30px rgba(15,18,26,.38)"
                  : "0 4px 14px rgba(15,18,26,.14), 0 30px 60px -26px rgba(15,18,26,.24)",
                outline: `${active ? 2.5 : 1}px solid ${active ? `rgba(207,255,5,${0.85 * activeP})` : "rgba(15,18,26,0.12)"}`,
                outlineOffset: active ? 5 : 0,
                filter: active ? "none" : "saturate(0.85)",
                opacity: 1,
              }}>
                {/* poster (always mounted underneath) */}
                <Img src={staticFile(`showcase/${card.id}_poster.png`)}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                {/* live video only while active */}
                {active && (
                  <Sequence from={card.segStart} durationInFrames={card.segEnd - card.segStart} layout="none">
                    <OffthreadVideo
                      src={staticFile(`showcase/${card.id}.mp4`)}
                      startFrom={card.clipFrom}
                      volume={(f2) => 0.32 * interpolate(f2, [0, 8, card.segEnd - card.segStart - 12, card.segEnd - card.segStart - 2], [0, 1, 1, 0], clamp)}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </Sequence>
                )}
                {/* dim veil when inactive */}
                <div style={{ position: "absolute", inset: 0, background: SILVER_BG, opacity: 1 - dim, transition: "none", pointerEvents: "none", mixBlendMode: "multiply" }} />
              </div>
              {/* label chip under the active card */}
              <div style={{
                position: "absolute", left: card.cx, top: card.cy + card.h / 2 + 34,
                transform: `translateX(-50%) translateY(${(1 - labelP) * 10}px)`, opacity: labelP,
                whiteSpace: "nowrap",
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 26, letterSpacing: "0.18em", color: RAISIN,
                  background: "#FFFFFF", border: `1px solid ${SILVER_SOFT}`, borderRadius: 8,
                  padding: "10px 22px", boxShadow: "0 8px 22px -10px rgba(15,18,26,.25)",
                }}>{card.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= SCREEN SPACE ================= */}
      {/* opening eyebrow, types on */}
      {frame < 96 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: H * 0.085, textAlign: "center",
          fontFamily: MONO, fontSize: 30, letterSpacing: "0.34em", color: BODY, opacity: eyebrowOut,
        }}>
          <span style={{ background: "rgba(233,236,237,0.85)", padding: "10px 18px", borderRadius: 6 }}>
            {EYEBROW.slice(0, typedN)}
            <span style={{ display: "inline-block", width: 12, height: 26, background: LIME, marginLeft: 6, verticalAlign: "-3px", opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0.2 }} />
          </span>
        </div>
      )}

      {/* closer line */}
      {closerP > 0 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: H * 0.855, textAlign: "center",
          opacity: closerP * endFade, transform: `translateY(${(1 - closerP) * 12}px)`,
        }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 54, color: RAISIN }}>
            all edited by{" "}
            <span style={{ position: "relative", whiteSpace: "nowrap" }}>
              <span style={{ position: "absolute", left: -6, right: -6, top: "54%", bottom: -2, background: LIME, zIndex: 0, transform: "skewX(-4deg)" }} />
              <span style={{ position: "relative", zIndex: 1 }}>claude.</span>
            </span>
          </span>
        </div>
      )}

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 74% at 50% 46%, transparent 60%, rgba(15,18,26,0.10) 100%)" }} />

      {frame >= 1596 && <AbsoluteFill style={{ background: SILVER_BG, opacity: 1 - endFade }} />}

      {/* ---- landing ticks (music muxed post-render) ---- */}
      {[108, 530, 870, 1232].map((at) => (
        <Sequence key={at} from={at} durationInFrames={42}>
          <Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.22} />
        </Sequence>
      ))}
      <Sequence from={1512} durationInFrames={42}>
        <Audio src={staticFile("vedit/sfx/soft.wav")} volume={0.26} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default EditShowcase;
