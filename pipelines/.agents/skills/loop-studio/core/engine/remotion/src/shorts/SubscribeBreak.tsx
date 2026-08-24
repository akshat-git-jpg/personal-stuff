/**
 * SubscribeBreak — 10.2s mid-roll subscribe interstitial for videoedit4 (16:9, 4K).
 * Canvas world matching the video's register. Every beat literal:
 *   "like and subscribe"  → thumb fills on "like"; a cursor CLICKS the button on
 *                           "subscribe." → flips to lime SUBSCRIBED ✓, bell rings once
 *   "grow my channel"     → small subscriber sparkline ticks up
 *   "in the pipeline"     → a literal pipeline: queued video cards sliding in on a dashed track
 *   "go on with the video"→ world clears, speaker card returns near-fullscreen (clean cut point)
 * No captions, no music (sits inside the video's own bed). SFX only.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/* anchors (words.json) */
const T = {
  cardOut: 55,                 // after "quickly," (~1.8s later than word for a snappy but not rushed exit)
  rowIn: f(2.04),              // "make"
  likeAt: f(2.46),             // "like"
  subClickAt: f(2.92),         // "subscribe."
  bellAt: f(3.3),
  growAt: f(4.46),             // "grow"
  pipeIn: f(5.72),             // "way"
  pipeLand: f(7.88),           // "pipeline."
  clearAt: f(8.44),            // "So let's go on"
  cardBack: f(8.6),
};

const DUR = 305;

/* world camera (world units = 4K px) */
const CAM: [number, number, number, number][] = [
  [0, 1920, 1080, 1.0],
  [T.cardOut, 1920, 1080, 1.0],
  [T.cardOut + 30, 1850, 850, 1.35],    // focus the subscribe row (upper canvas, clear air)
  [f(4.3), 1855, 855, 1.36],
  [f(4.9), 2250, 1080, 1.25],           // ease toward the channel-growth station
  [f(5.6), 2255, 1085, 1.25],
  [f(6.3), 2150, 1500, 1.05],           // one ease down to the pipeline
  [f(8.3), 2158, 1506, 1.06],
  [f(9.2), 1920, 1080, 1.0],            // back home
  [DUR, 1922, 1081, 1.0],
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
  const s = 152;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(15,18,26,0.10)' stroke-width='2'/></svg>`
    )
  );
})();

const PIPE_CARDS = ["up next", "skill deep-dive", "full build", "behind the loop"];

export const SubscribeBreak: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();

  const c0 = cam(frame);
  const c = { x: c0.x + Math.sin(frame / 36) * 6, y: c0.y + Math.cos(frame / 45) * 4, z: c0.z };
  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * (c.z * W / 3840)}px, ${H / 2 - c.y * (c.z * W / 3840)}px) scale(${c.z * W / 3840})`,
    transformOrigin: "0 0",
  };
  const zEff = c.z * W / 3840;

  /* world fades out for the return */
  const worldOut = interpolate(frame, [T.clearAt, T.clearAt + 20], [1, 0], clamp);

  /* speaker card: fullscreen → lower-left → fullscreen */
  const spk = (() => {
    const kf: [number, number, number][] = [
      // [frame, x, w] with y derived; stored as [frame, packed] — use explicit tuples below
    ] as never;
    const kfs: [number, number, number, number][] = [
      [0, 0.5, 0.5, 0.94],
      [T.cardOut, 0.5, 0.5, 0.94],
      [T.cardOut + 30, 0.165, 0.79, 0.27],
      [f(8.4), 0.165, 0.79, 0.27],
      [f(9.35), 0.5, 0.5, 0.94],
      [DUR, 0.5, 0.5, 0.94],
    ];
    for (let i = 0; i < kfs.length - 1; i++) {
      const [fa, xa, ya, wa] = kfs[i]; const [fb, xb, yb, wb] = kfs[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = EASE((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
      }
    }
    const [, x, y, w] = kfs[kfs.length - 1]; return { x, y, w };
  })();
  const spkW = spk.w * W, spkH = spkW * 9 / 16;

  /* subscribe row states */
  const rowP = frame >= T.rowIn ? spring({ frame: frame - T.rowIn, fps: FPS, config: { damping: 14, stiffness: 170 }, durationInFrames: 16 }) : 0;
  const likeP = frame >= T.likeAt ? spring({ frame: frame - T.likeAt, fps: FPS, config: { damping: 11, stiffness: 210 }, durationInFrames: 14 }) : 0;
  const clicked = frame >= T.subClickAt + 6;
  const clickDip = frame >= T.subClickAt + 2 && frame < T.subClickAt + 8 ? 0.94 : 1;
  const bellK = frame >= T.bellAt ? spring({ frame: frame - T.bellAt, fps: FPS, config: { damping: 7, stiffness: 200 }, durationInFrames: 22 }) : 1;
  const bellRot = frame >= T.bellAt ? Math.sin((frame - T.bellAt) / 2.2) * 16 * (1 - bellK) : 0;
  /* cursor path: enters from lower right, clicks the button, drifts off */
  const curP = interpolate(frame, [T.rowIn + 4, T.subClickAt + 2], [0, 1], { ...clamp, easing: EASE });
  const curOut = interpolate(frame, [T.subClickAt + 12, T.subClickAt + 30], [0, 1], { ...clamp, easing: EASE });
  const curX = 2350 - curP * 310 + curOut * 260;
  const curY = 1450 - curP * 330 + curOut * 240;
  const curO = Math.min(curP * 3, 1) * (1 - curOut);

  const growP = frame >= T.growAt ? interpolate(frame, [T.growAt, T.growAt + 26], [0, 1], { ...clamp, easing: EASE }) : 0;

  const pipeP = frame >= T.pipeIn ? interpolate(frame, [T.pipeIn, T.pipeIn + 34], [0, 1], { ...clamp, easing: EASE }) : 0;
  const beltDrift = Math.max(0, frame - T.pipeIn) * 1.6;

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${152 * zEff}px`,
        backgroundPosition: `${W / 2 - c.x * zEff}px ${H / 2 - c.y * zEff}px`,
        maskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
      }} />

      {/* ================= WORLD ================= */}
      <div style={{ ...worldStyle, opacity: worldOut }}>

        {/* --- subscribe row --- */}
        {rowP > 0 && (
          <div style={{
            position: "absolute", left: 1250, top: 620,
            display: "flex", alignItems: "center", gap: 70,
            opacity: rowP, transform: `translateY(${(1 - rowP) * 40}px)`,
          }}>
            {/* like */}
            <div style={{
              display: "flex", alignItems: "center", gap: 28, padding: "34px 54px",
              background: "#FFFFFF", borderRadius: 24, border: `2px solid ${SILVER_SOFT}`,
              boxShadow: "0 8px 20px rgba(15,18,26,.10), 0 40px 80px -30px rgba(15,18,26,.25)",
              transform: `scale(${1 + 0.05 * (likeP > 0 ? Math.sin(Math.min(likeP, 1) * Math.PI) : 0)})`,
            }}>
              <svg width={64} height={64} viewBox="0 0 24 24">
                <path d="M2 10h4v11H2zM22 11c0-1.1-.9-2-2-2h-5.2l.9-4.4c.1-.5-.1-1-.5-1.4L14 2l-6 6.6c-.3.3-.5.8-.5 1.4v9c0 1.1.9 2 2 2h7.5c.8 0 1.5-.5 1.8-1.2l3-7c.1-.2.2-.5.2-.8v-1z"
                  fill={likeP > 0.3 ? RAISIN : "none"} stroke={RAISIN} strokeWidth={likeP > 0.3 ? 0 : 1.6} />
              </svg>
              <span style={{ fontFamily: MONO, fontSize: 44, fontWeight: 700, color: RAISIN }}>
                {likeP > 0.3 ? "1" : "0"}
              </span>
            </div>

            {/* subscribe button */}
            <div style={{
              padding: "38px 74px", borderRadius: 999,
              background: clicked ? LIME : RAISIN,
              color: clicked ? RAISIN : "#FFFFFF",
              fontFamily: SANS, fontWeight: 700, fontSize: 56, letterSpacing: "0.04em",
              boxShadow: clicked
                ? `0 12px 30px rgba(15,18,26,.18), 0 0 60px rgba(207,255,5,.35)`
                : "0 12px 30px rgba(15,18,26,.3)",
              transform: `scale(${clickDip})`, whiteSpace: "nowrap",
            }}>
              {clicked ? "SUBSCRIBED ✓" : "SUBSCRIBE"}
            </div>

            {/* bell */}
            <div style={{
              width: 128, height: 128, borderRadius: "50%", background: "#FFFFFF",
              border: `2px solid ${SILVER_SOFT}`, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 20px rgba(15,18,26,.10)",
              transform: `rotate(${bellRot}deg)`,
            }}>
              <svg width={62} height={62} viewBox="0 0 24 24" fill="none">
                <path d="M12 3c-3 0-5 2.2-5 5v4l-1.8 3.2c-.2.4.1.8.5.8h12.6c.4 0 .7-.4.5-.8L17 12V8c0-2.8-2-5-5-5z"
                  stroke={RAISIN} strokeWidth="1.7" fill={clicked ? LIME : "none"} />
                <path d="M10 18.5a2 2 0 0 0 4 0" stroke={RAISIN} strokeWidth="1.7" />
              </svg>
            </div>

          </div>
        )}

        {/* --- channel growth: its own station, lower-right of the row --- */}
        {growP > 0 && (
          <div style={{ position: "absolute", left: 2620, top: 1230, opacity: Math.min(growP * 2, 1) }}>
            <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.3em", color: BODY, marginBottom: 22 }}>■ THE CHANNEL</div>
            <div style={{
              padding: "36px 44px 28px", background: "#FFFFFF", borderRadius: 20,
              border: `2px solid ${SILVER_SOFT}`,
              boxShadow: "0 10px 24px rgba(15,18,26,.10), 0 44px 90px -34px rgba(15,18,26,.26)",
            }}>
              <svg width={430} height={190} viewBox="0 0 430 190">
                {(() => {
                  const pts: [number, number][] = [[16, 160], [104, 144], [192, 114], [280, 72], [396, 26]];
                  const n = Math.max(2, Math.ceil(growP * pts.length));
                  const d = `M ${pts.slice(0, n).map((p) => p.join(" ")).join(" L ")}`;
                  return (
                    <>
                      <path d={d} fill="none" stroke={RAISIN} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
                      {growP >= 1 && <circle cx={396} cy={26} r={11} fill={RAISIN} />}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* cursor */}
        {curO > 0 && (
          <svg width={70} height={80} viewBox="0 0 24 28" style={{ position: "absolute", left: curX, top: curY, opacity: curO, filter: "drop-shadow(0 6px 10px rgba(15,18,26,.35))" }}>
            <path d="M4 2 L4 20 L9 16 L12 24 L15.5 22.5 L12.5 15 L19 14.5 Z" fill={RAISIN} stroke="#FFFFFF" strokeWidth="1.4" />
          </svg>
        )}

        {/* --- THE PIPELINE --- */}
        {pipeP > 0 && (
          <div style={{ opacity: pipeP }}>
            {/* dashed track */}
            <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={10} height={10}>
              <line x1={600} y1={1900} x2={3950} y2={1900} stroke={RAISIN} strokeWidth={5}
                strokeDasharray="34 26" strokeDashoffset={-beltDrift} opacity={0.35} />
            </svg>
            <div style={{
              position: "absolute", left: 620, top: 1930, fontFamily: MONO, fontSize: 30,
              letterSpacing: "0.3em", color: BODY,
            }}>■ THE PIPELINE</div>

            {/* queued cards sliding along the track */}
            {PIPE_CARDS.map((label, i) => {
              const born = T.pipeIn + i * 8;
              if (frame < born) return null;
              const inP = interpolate(frame, [born, born + 18], [0, 1], { ...clamp, easing: EASE });
              const x = 3400 - i * 640 - Math.min(frame - born, 90) * 1.1 + (1 - inP) * 300;
              return (
                <div key={label} style={{
                  position: "absolute", left: x, top: 1560, width: 560, height: 315,
                  background: "#FFFFFF", borderRadius: 20, border: `2px solid ${SILVER_SOFT}`,
                  boxShadow: "0 10px 24px rgba(15,18,26,.12), 0 44px 90px -34px rgba(15,18,26,.3)",
                  opacity: inP, overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", inset: 0, background: i === 0 ? RAISIN : "rgba(15,18,26,0.05)" }} />
                  {/* play glyph */}
                  <svg width={74} height={74} viewBox="0 0 24 24" style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)" }}>
                    <path d="M8 5v14l11-7z" fill={i === 0 ? LIME : RAISIN} opacity={i === 0 ? 1 : 0.55} />
                  </svg>
                  <div style={{
                    position: "absolute", left: 30, bottom: 24, fontFamily: MONO, fontSize: 30,
                    letterSpacing: "0.12em", color: i === 0 ? "#FFFFFF" : BODY,
                  }}>{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= SPEAKER CARD ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 6px 22px rgba(15,18,26,0.30), 0 0 0 1px rgba(15,18,26,0.10)",
      }}>
        <OffthreadVideo src={staticFile("intros/videoedit4_subscribe/source.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.05) saturate(1.06)" }} />
      </div>

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 74% at 50% 46%, transparent 62%, rgba(15,18,26,0.09) 100%)" }} />

      {/* ---- SFX ---- */}
      <Sfx src="vedit/sfx/slide.wav" at={T.cardOut + 4} volume={0.22} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.likeAt} volume={0.26} />
      <Sfx src="vedit/sfx/tap.wav" at={T.subClickAt + 4} volume={0.34} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.bellAt} volume={0.22} />
      <Sfx src="vedit/sfx/slide.wav" at={T.pipeIn} volume={0.26} />
      <Sfx src="vedit/sfx/soft.wav" at={f(9.3)} volume={0.24} />
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.26 }) => (
  <Sequence from={at} durationInFrames={f(1.4)}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

export default SubscribeBreak;
