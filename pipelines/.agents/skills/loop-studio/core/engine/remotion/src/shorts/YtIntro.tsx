/**
 * YtIntro v2 — WORLD-CANVAS register (9:16, 242f @30fps, 1080x1920)
 * Per Luuk: "I miss a sense of greatness... move me to a smaller section,
 * use the rest of the frame to show things at scale."
 *
 * Same concept — THE ABANDONED PROGRESS BAR — rebuilt as a world:
 *  · Full-frame silver canvas with a faded draftsman grid (parallaxed).
 *  · Speaker = rounded screen-space card: opens NEAR-FULLSCREEN (sliver of
 *    canvas at the edges), ONE glide up-small for the middle, slight return
 *    at the end. Name plate lives ON the card.
 *  · The `ai degree` bar is a HUGE world object — the camera travels along
 *    it as it fills and HALTS with the fill at 85% on "dropped out";
 *    the dead cursor blinks twice on a giant cell. `year 4 of 4` on "final".
 *  · Closer: the filled cells detach and fly down-right into a brick
 *    structure at world scale; ONE long camera ease over to watch it
 *    complete. Top brick pulses lime once (the single lime accent).
 *  · Three camera moves total: settle → travel/halt → ease to structure.
 * Anchors from public/intros/YT_intro_scene1/words.json ("Luke" → Luuk).
 */
import React from "react";
import {
  AbsoluteFill, OffthreadVideo, Sequence, Audio, interpolate, interpolateColors,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
  delayRender, continueRender,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

/* ---------- fonts (self-contained; pattern from motion/kit.tsx) ---------- */
const fontHandle = delayRender("fonts");
{
  let done = false;
  const finish = () => { if (!done) { done = true; continueRender(fontHandle); } };
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&family=JetBrains+Mono:wght@500;700&display=block";
    document.head.appendChild(link);
    const fo: any = (document as any).fonts;
    (fo && fo.ready ? fo.ready : Promise.resolve()).then(finish).catch(finish);
    setTimeout(finish, 4000);
  } else finish();
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const BEZ = Easing.bezier(0.45, 0, 0.18, 1);
const ramp = (frame: number, at: number, len = 10, ease = Easing.out(Easing.cubic)) =>
  frame <= at ? 0 : ease(clamp01((frame - at) / len));

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({
  src, at, volume = 0.25, rate = 1,
}) => (
  <Sequence from={at} durationInFrames={f(1.2)}>
    <Audio src={staticFile(src)} volume={volume} playbackRate={rate} />
  </Sequence>
);

/* ================= word anchors (frames) =================
   My 0 name 7 is 12 Luuk 16 | and 22 I 31 dropped 35 out 43 of 52 my 55
   AI 60 degree 74 my 76 final 85 year 97(-108) | I 115 just 120 really 127
   wanted 136 to 146 build 152 real 159 stuff 169 rather 181 than 193
   just 200 learning 206 about 218 them 227(-235)                        */

/* ================= WORLD geometry (units ≈ px at z=1 on 1080w) ================= */
const CELL = 120, PITCH = 156;                     // giant bar cells
const N_CELLS = 20, N_FILL = 17;                   // 17/20 = 85%
const BAR_X0 = 400, BAR_Y = 2000;                  // bar cell tops
const STACK_X0 = 2960, STACK_BASE = 3050;          // structure, below-right of the stop
const ROWS = [5, 5, 4, 3];
const ROW_OFF = [0, 0, PITCH / 2, PITCH];

const slot = (i: number) => {
  let r = 0, acc = 0;
  while (i >= acc + ROWS[r]) { acc += ROWS[r]; r++; }
  return { x: STACK_X0 + ROW_OFF[r] + (i - acc) * PITCH, y: STACK_BASE - r * PITCH };
};

const FLIGHT = 14;
const DEPARTS: number[] = (() => {
  const a = [118];
  for (let i = 1; i < N_FILL; i++) a.push(a[i - 1] + (6.2 - 3.6 * ((i - 1) / 15)));
  return a.map(Math.round);
})();
const LANDS = DEPARTS.map((d) => d + FLIGHT);      // last lands ~f202
const PULSE_AT = 206;                              // "learning"

/* ================= world camera — THREE moves ================= */
const CAM: [number, number, number, number][] = [
  [0,   950,  1560, 0.85],   // 1. open: settle behind the near-fullscreen card
  [22,  850,  1638, 0.90],   //    bar start framed as the card lifts
  [45,  2850, 1638, 0.98],   // 2. TRAVEL along the bar, decelerate → HALT on "dropped out"
  [112, 2880, 1650, 0.97],   //    hold on the dead cursor (micro-drift only)
  [200, 3300, 2150, 0.68],   // 3. one long ease over/down to watch the structure complete
  [241, 3320, 2170, 0.70],   //    final creep — never rests
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = BEZ((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}

/* ================= speaker card keyframes (screen fractions) ================= */
const CARD_KF: [number, number, number, number][] = [
  [0,   0.5, 0.500, 0.94],   // near-fullscreen — sliver of canvas at the edges
  [16,  0.5, 0.500, 0.94],   // hold through "Luuk"
  [40,  0.5, 0.270, 0.53],   // ONE glide out — the world reveals below
  [196, 0.5, 0.270, 0.53],
  [230, 0.5, 0.285, 0.58],   // slight return for the close
  [241, 0.5, 0.285, 0.58],
];
function cardPos(frame: number) {
  const ks = CARD_KF;
  if (frame <= ks[0][0]) { const [, x, y, w] = ks[0]; return { x, y, w }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, wa] = ks[i]; const [fb, xb, yb, wb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = BEZ((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
    }
  }
  const [, x, y, w] = ks[ks.length - 1]; return { x, y, w };
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

/* ================= the world: giant bar → structure ================= */
const BarWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const barIn = ramp(frame, 22, 10, BEZ);
  if (barIn <= 0) return null;

  const husk = 1 - ramp(frame, 150, 30);           // hollow cells + chrome fade in the restack
  const tag = ramp(frame, 85, 9) * husk;           // "final" f85
  const cursorOn = (frame >= 46 && frame < 53) || (frame >= 58 && frame < 65);
  const cursorDead = frame >= 65;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < N_CELLS; i++) {
    const bx = BAR_X0 + i * PITCH;
    if (i < N_FILL) {
      const fp = ramp(frame, 25 + i, 4);           // fill f25..f41 — stop lands on "dropped out"
      if (fp <= 0) continue;
      const dep = DEPARTS[i];
      const t = frame <= dep ? 0 : BEZ(clamp01((frame - dep) / FLIGHT));
      const s = slot(i);
      const x = bx + (s.x - bx) * t;
      const y = BAR_Y + (s.y - BAR_Y) * t - Math.sin(Math.PI * t) * 260;
      const isTop = i === N_FILL - 1;
      const pt = isTop ? clamp01((frame - PULSE_AT) / 18) : 1;
      const pulse = isTop && frame >= PULSE_AT ? Math.sin(Math.PI * pt) : 0;
      cells.push(
        <div key={`c${i}`} style={{
          position: "absolute", left: x, top: y, width: CELL, height: CELL,
          background: pulse > 0.04 ? LIME : RAISIN,
          opacity: 0.55 + 0.45 * fp,
          transform: `scale(${(0.75 + 0.25 * fp) * (1 + pulse * 0.14)})`,
          borderRadius: 12,
          boxShadow: pulse > 0.04
            ? `0 0 ${90 * pulse}px rgba(207,255,5,${0.7 * pulse}), 0 22px 44px -14px rgba(15,18,26,0.4)`
            : "0 22px 44px -14px rgba(15,18,26,0.35)",
        }} />
      );
    } else {
      const isCursor = i === N_FILL;
      const on = isCursor && cursorOn;
      cells.push(
        <div key={`c${i}`} style={{
          position: "absolute", left: bx, top: BAR_Y, width: CELL, height: CELL,
          background: on ? RAISIN : "transparent",
          border: `5px solid rgba(15,18,26,${isCursor && cursorDead ? 0.16 : 0.35})`,
          borderRadius: 12, boxSizing: "border-box",
          opacity: husk * barIn,
        }} />
      );
    }
  }

  return (
    <>
      {/* label at the bar's origin — read as it enters */}
      <div style={{
        position: "absolute", left: BAR_X0 + 8, top: BAR_Y - 128,
        fontFamily: MONO, fontWeight: 500, fontSize: 62, color: BODY,
        letterSpacing: "0.24em", whiteSpace: "nowrap", opacity: barIn * husk,
        display: "flex", alignItems: "center", gap: 22,
      }}>
        <span style={{ width: 20, height: 20, background: RAISIN, display: "inline-block", opacity: 0.8 }} />
        ai degree
      </div>
      {cells}
      {/* tag under the stop point — "final year" */}
      <div style={{
        position: "absolute", left: 2560, top: BAR_Y + CELL + 74,
        fontFamily: MONO, fontWeight: 500, fontSize: 54, color: BODY,
        letterSpacing: "0.2em", whiteSpace: "nowrap", opacity: tag,
        transform: `translateY(${(1 - tag) * 26}px)`,
      }}>year 4 of 4</div>
    </>
  );
};

/* ================= name plate — lives ON the card ================= */
const NamePlate: React.FC<{ cardW: number }> = ({ cardW }) => {
  const frame = useCurrentFrame();
  const LETTERS = ["l", "u", "u", "k"];
  const typedAt = [3, 7, 11, 15];
  const typed = typedAt.filter((t) => frame >= t).length;
  const blink = Math.floor(frame / 8) % 2 === 0;
  const underline = ramp(frame, 17, 12, BEZ);
  const FS = cardW * 0.072;
  return (
    <div style={{ position: "absolute", left: "6%", bottom: "5.5%" }}>
      <div style={{ display: "flex", alignItems: "center", height: FS * 1.1 }}>
        <span style={{
          fontFamily: MONO, fontWeight: 700, fontSize: FS, color: "#fff",
          letterSpacing: "0.04em", textShadow: "0 3px 20px rgba(0,0,0,0.7)",
        }}>{LETTERS.slice(0, typed).join("")}</span>
        <span style={{
          display: "inline-block", width: FS * 0.56, height: FS * 0.98,
          marginLeft: FS * 0.12, background: "#fff", opacity: blink ? 0.9 : 0.12,
        }} />
      </div>
      <div style={{
        marginTop: FS * 0.18, height: Math.max(2, FS * 0.05),
        width: underline * FS * 3.1, background: "rgba(255,255,255,0.85)",
      }} />
    </div>
  );
};

/* ================= karaoke captions (screen space) ================= */
type Wd = { t: string; at: number };
const LINES: { from: number; to: number; ws: Wd[] }[] = [
  { from: 0,   to: 16,  ws: [{ t: "MY", at: 0 }, { t: "NAME", at: 7 }, { t: "IS", at: 12 }] },
  { from: 16,  to: 22,  ws: [{ t: "LUUK", at: 16 }] },
  { from: 22,  to: 43,  ws: [{ t: "AND", at: 22 }, { t: "I", at: 31 }, { t: "DROPPED", at: 35 }] },
  { from: 43,  to: 60,  ws: [{ t: "OUT", at: 43 }, { t: "OF", at: 52 }, { t: "MY", at: 55 }] },
  { from: 60,  to: 76,  ws: [{ t: "AI", at: 60 }, { t: "DEGREE", at: 74 }] },
  { from: 76,  to: 108, ws: [{ t: "MY", at: 76 }, { t: "FINAL", at: 85 }, { t: "YEAR", at: 97 }] },
  { from: 115, to: 136, ws: [{ t: "I", at: 115 }, { t: "JUST", at: 120 }, { t: "REALLY", at: 127 }] },
  { from: 136, to: 159, ws: [{ t: "WANTED", at: 136 }, { t: "TO", at: 146 }, { t: "BUILD", at: 152 }] },
  { from: 159, to: 181, ws: [{ t: "REAL", at: 159 }, { t: "STUFF", at: 169 }] },
  { from: 181, to: 206, ws: [{ t: "RATHER", at: 181 }, { t: "THAN", at: 193 }, { t: "JUST", at: 200 }] },
  { from: 206, to: 236, ws: [{ t: "LEARNING", at: 206 }, { t: "ABOUT", at: 218 }, { t: "THEM", at: 227 }] },
];
const Captions: React.FC<{ H: number }> = ({ H }) => {
  const frame = useCurrentFrame();
  const line = LINES.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;
  const p = ramp(frame, line.from, 5);
  /* style crossfades as the card lifts: over-footage (white) → over-canvas (raisin) */
  const baseColor = interpolateColors(frame, [28, 46], ["#FFFFFF", RAISIN]);
  const shadowA = interpolate(frame, [28, 46], [0.85, 0.18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let cur = -1;
  line.ws.forEach((w, i) => { if (frame >= w.at) cur = i; });
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: H * 0.592,
      display: "flex", justifyContent: "center", alignItems: "baseline", gap: 20,
      opacity: p, transform: `translateY(${(1 - p) * 10}px)`,
    }}>
      {line.ws.map((w, i) => {
        const isCur = i === cur;
        return (
          <span key={i} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: 64, lineHeight: 1.15,
            letterSpacing: "0.01em",
            color: isCur ? RAISIN : baseColor,
            background: isCur ? LIME : "transparent",
            padding: isCur ? "0 14px" : "0", borderRadius: isCur ? 8 : 0,
            opacity: i <= cur ? 1 : 0.4,
            textShadow: isCur ? "none" : `0 4px 20px rgba(0,0,0,${shadowA})`,
            boxShadow: isCur ? "0 10px 26px -10px rgba(15,18,26,0.35)" : "none",
          }}>{w.t}</span>
        );
      })}
    </div>
  );
};

/* ================= composition ================= */
export const YtIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames: DUR } = useVideoConfig();
  const wu = W / 1080;

  const c0 = cam(frame);
  /* constant micro-drift — the camera never rests */
  const c = { x: c0.x + Math.sin(frame / 38) * 6, y: c0.y + Math.cos(frame / 47) * 5, z: c0.z };

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`,
    transformOrigin: "0 0",
  };

  const spk = cardPos(frame);
  const spkW = spk.w * W, spkH = spkW * 16 / 9;    // vertical 9:16 card
  const spkRadius = 12 * wu;

  /* hook treatment: defocus-to-focus + slow settle in the first 0.7s */
  const hookBlur = interpolate(frame, [0, f(0.7)], [9, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const hookScale = interpolate(frame, [0, f(2.0)], [1.06, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });

  const fade = ramp(frame, DUR - 8, 8, Easing.inOut(Easing.quad));

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      {/* parallaxed faded draftsman grid */}
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`,
        backgroundSize: `${76 * wu * c.z}px`,
        backgroundPosition: `${W / 2 - c.x * wu * c.z}px ${H / 2 - c.y * wu * c.z}px`,
        maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 0%, rgba(0,0,0,.35) 60%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 0%, rgba(0,0,0,.35) 60%, transparent 92%)",
      }} />

      {/* ============ THE WORLD ============ */}
      <div style={worldStyle}>
        <BarWorld />
      </div>

      {/* ============ SPEAKER CARD (screen space) ============ */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: spkRadius, overflow: "hidden",
        boxShadow: `0 ${W * 0.008}px ${W * 0.028}px rgba(15,18,26,0.30), 0 0 0 1px rgba(15,18,26,0.10)`,
      }}>
        <OffthreadVideo
          src={staticFile("intros/YT_intro_scene1/source.mp4")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${hookScale})`,
            filter: `contrast(1.05) saturate(1.05)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
          }}
        />
        <NamePlate cardW={spkW} />
      </div>

      <Captions H={H} />

      {/* ---- SFX (source audio on, no music) ---- */}
      <Sfx src="vedit/sfx/tap.wav" at={16} volume={0.28} />                {/* name underline */}
      <Sfx src="vedit/sfx/slide.wav" at={20} volume={0.22} />              {/* card lifts, bar enters */}
      <Sfx src="vedit/sfx/tick_soft.wav" at={28} volume={0.2} />           {/* fill ticking */}
      <Sfx src="vedit/sfx/tick_soft.wav" at={36} volume={0.2} />
      <Sfx src="vedit/sfx/soft.wav" at={45} volume={0.24} />               {/* the HALT */}
      <Sfx src="vedit/sfx/tick_soft.wav" at={85} volume={0.18} />          {/* year 4 of 4 */}
      {/* restack — per-brick soft ticks, accelerating */}
      {[0, 4, 8, 12, 15].map((i, k) => (
        <Sfx key={i} src="vedit/sfx/tick_soft.wav" at={LANDS[i]} volume={0.2} rate={1 + k * 0.06} />
      ))}
      <Sfx src="vedit/sfx/accent.wav" at={PULSE_AT} volume={0.3} />        {/* lime pulse */}

      {/* soft vignette + end fade (to white — canvas register) */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 45%, transparent 60%, rgba(15,18,26,0.09) 100%)" }} />
      <AbsoluteFill style={{ background: "#fff", opacity: fade, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default YtIntro;
