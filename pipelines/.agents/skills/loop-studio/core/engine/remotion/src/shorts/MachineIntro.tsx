/**
 * MachineIntro v2 — WORLD-CANVAS register (16:9, 4K, 352f @30fps).
 * Revised per Luuk: "I miss a sense of greatness. Everything is quite small,
 * nothing is full screen. Move me to a smaller section, use the rest of the
 * frame to show things at scale."
 *
 * CONCEPT (unchanged): THE EMPTY DEFINITION — a judgment console.
 * Now built as a world: a dark raisin canvas with a faint draftsman grid.
 * The speaker opens near-fullscreen (rounded card, sliver of canvas at the
 * edges), then glides to a corner while a BIG commit conveyor runs across
 * the world. On "how" the conveyor freezes mid-frame; the world camera then
 * pushes into the one thing nobody filled in — `better = ▮` — until the
 * empty input IS the frame, alone on the canvas with the blinking lime
 * cursor. The wrong definition types at full scale and gets stamped ✓.
 * The camera pulls back to the whole machine: conveyor resumed at 2x up top,
 * the wrong law mid-frame, and a huge quality sparkline collapsing into red
 * across the bottom — speaker small in the corner, watching. Fade to black
 * with the stream still running.
 *
 * Beats (anchored to intros/machine_scene1/words.json):
 *   f0–f61    HOOK    speaker near-fullscreen; glides to corner on "decide→what"
 *   f61–f107  STREAM  big conveyor of ✓-confident fix-commits crosses the world
 *   f107      STOP    freeze exactly on "how" (3.58s), one chip half-cut at edge
 *   f116–f171 PUSH    world camera dives into `better = ▮` — full-frame by "means?"
 *   f205–f221 WRONG   `more` types at full scale; ✓ stamp slams on "wrong"
 *   f244–f352 CLOSER  pull back wide: stream at 2x, giant sparkline down into red,
 *                     clock at "all day" (f325), fade to black f342–f352
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

// ---------- word anchors ----------
const A = {
  let_: f(0.82), what: f(2.04), fix: f(2.6),
  how: f(3.58), know: f(4.5), whatB: f(4.9), means: f(5.7), meansEnd: f(6.14),
  get: f(6.84), wrong: f(7.38),
  youve: f(8.12), machine: f(8.7),
  all: f(10.84),
};
const DUR = 352;

// ---------- world camera [frame, x, y, zoom] — one move per intention ----------
const CAM: [number, number, number, number][] = [
  [0, 2320, 980, 0.78],          // behind the near-fullscreen open: slow lateral creep
  [A.how, 2480, 980, 0.82],      // ...with the stream, until the freeze
  [116, 2480, 980, 0.82],        // hold the frozen frame a beat
  [f(5.7), 3450, 1765, 1.22],    // THE move: dive into the empty input — IS the frame by "means?"
  [A.get, 3450, 1765, 1.24],     // silence hold, micro-creep only
  [225, 3660, 1800, 1.02],       // opens slightly so the definition can grow + take its stamp
  [A.youve, 3660, 1800, 1.02],
  [f(9.9), 3120, 1520, 0.50],    // pull back: the whole machine at once
  [DUR, 3090, 1540, 0.475],      // final creep — it just keeps running
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = Easing.bezier(0.45, 0, 0.18, 1)((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}

const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

const GRID_URI = (() => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(233,236,237,0.07)' stroke-width='1'/></svg>`
    )
  );
})();

const GRAIN_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.55'/></svg>`
  );

// ---------- the conveyor (world units, 1920-space) ----------
const FIXES = [
  "retry logic", "cache layer", "query builder", "rate limiter",
  "null checks", "date parsing", "session store", "pagination",
  "index scan", "memory pool", "lazy imports", "error paths",
  "batch writes", "config drift", "dead code", "everything",
];
const CHIP_FONT = 64;
const CHIP_CHAR = CHIP_FONT * 0.615;
const CHIP_GAP = 140;
const STREAM_V = 16; // world units / frame, phase 1; 2x after resume
const streamOffset = (frame: number) =>
  STREAM_V * Math.min(frame, A.how) + 2 * STREAM_V * Math.max(0, frame - A.youve);

const chipLayout = (() => {
  let x = 1200;
  return FIXES.map((t) => {
    const text = `fix: ${t}`;
    const w = text.length * CHIP_CHAR + 150 + CHIP_CHAR * 2.0; // text + pad + ✓
    const c = { text, x, w };
    x += w + CHIP_GAP;
    return c;
  });
})();

const Conveyor: React.FC = () => {
  const frame = useCurrentFrame();
  const off = streamOffset(frame);
  const tagIn = useIn(A.let_ + 8, 14);
  return (
    <>
      {/* console label — the persistent mark of the environment */}
      <div style={{
        position: "absolute", left: 1350, top: 806, width: 1400, whiteSpace: "nowrap",
        fontFamily: MONO, fontSize: 30, fontWeight: 700, letterSpacing: "0.28em",
        color: SILVER, opacity: tagIn * 0.8, display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{ width: 14, height: 14, background: LIME, display: "inline-block", opacity: 0.9 }} />
        FIX QUEUE · AUTONOMOUS
      </div>
      {/* the track */}
      <div style={{ position: "absolute", left: -2000, top: 1096, width: 20000, borderTop: "3px dashed rgba(233,236,237,0.13)" }} />
      {/* the chips */}
      {chipLayout.map((c, i) => {
        const cx = c.x - off;
        if (cx > 12000 || cx < -c.w - 200) return null;
        return (
          <div key={i} style={{
            position: "absolute", left: cx, top: 920, whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: CHIP_CHAR * 0.9,
            padding: `24px 56px`,
            background: "#161C28", border: "2px solid rgba(255,255,255,0.16)",
            borderRadius: 18,
            boxShadow: "0 14px 40px -8px rgba(0,0,0,0.6)",
          }}>
            <span style={{ fontFamily: MONO, fontSize: CHIP_FONT, color: "#D9DFE2" }}>{c.text}</span>
            <span style={{ fontFamily: MONO, fontSize: CHIP_FONT, color: "#FFFFFF", fontWeight: 700 }}>✓</span>
          </div>
        );
      })}
    </>
  );
};

// ---------- the empty definition (world station — the full-frame takeover) ----------
const REVEAL = A.whatB; // input fades in as the camera arrives on the emptiness
const DefinitionStation: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = useIn(REVEAL, 24);
  const stampP = useIn(A.wrong, 10);
  if (frame < REVEAL) return null;
  const letters = frame < A.get ? 0 : Math.min(4, Math.floor((frame - A.get) / 4) + 1);
  const typed = "more".slice(0, letters);
  const blink = frame % 22 < 13 ? 1 : 0.06;
  const FONT = 210;
  return (
    <>
      <div style={{
        position: "absolute", left: 2740, top: 1650 + (1 - reveal) * 30, width: 3000, whiteSpace: "nowrap",
        display: "flex", alignItems: "center", opacity: reveal,
      }}>
        <span style={{ fontFamily: MONO, fontSize: FONT, fontWeight: 500, color: "#F2F4F5", whiteSpace: "pre" }}>
          {`better = ${typed}`}
        </span>
        {/* the only lime spend in the piece: the cursor waiting for a definition */}
        <div style={{
          width: FONT * 0.56, height: FONT * 1.06, marginLeft: FONT * 0.12,
          background: LIME, opacity: blink,
          boxShadow: "0 0 60px rgba(207,255,5,0.35)",
        }} />
      </div>
      {/* one quiet aside under the emptiness, gone before the typing */}
      {frame >= A.meansEnd && frame < A.get && (
        <div style={{
          position: "absolute", left: 2850, top: 2010, width: 1600, whiteSpace: "nowrap",
          fontFamily: SERIF, fontStyle: "italic", fontSize: 62, color: SILVER,
          opacity: interpolate(frame, [A.meansEnd, A.meansEnd + 12, A.get - 8, A.get], [0, 0.85, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>nobody filled this in.</div>
      )}
      {/* confident ✓ stamp lands on "wrong" — over the corner of the law */}
      {stampP > 0 && (
        <div style={{
          position: "absolute", left: 4250, top: 1870, width: 250, height: 250,
          border: "9px solid rgba(255,255,255,0.8)", borderRadius: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,18,26,0.55)",
          opacity: stampP, transform: `rotate(-7deg) scale(${1.3 - 0.3 * stampP})`,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 150, fontWeight: 700, color: "#fff" }}>✓</span>
        </div>
      )}
    </>
  );
};

// ---------- giant quality sparkline (world) ----------
const SPARK_AT = f(8.3);
const Spark: React.FC = () => {
  const frame = useCurrentFrame();
  const labelIn = useIn(SPARK_AT, 10);
  if (frame < SPARK_AT) return null;
  const N = 30;
  const x0 = 1300, x1 = 5000, y0 = 2060, y1 = 2460;
  const prog = interpolate(frame, [SPARK_AT, f(11.2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shown = Math.max(2, Math.ceil(prog * N));
  const pt = (i: number) => {
    const t = i / (N - 1);
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * Math.pow(t, 1.1) + Math.sin(i * 2.3) * 16 * t, t };
  };
  const mix = (t: number) => {
    const k = Math.max(0, Math.min(1, (t - 0.5) / 0.42));
    const a = [0xb5, 0xbf, 0xc2], b = [0xe0, 0x55, 0x3b];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
  };
  const head = pt(shown - 1);
  const value = Math.round(96 - 58 * head.t);
  return (
    <>
      <svg width={4200} height={800} style={{ position: "absolute", left: x0 - 100, top: y0 - 200, overflow: "visible" }}>
        {Array.from({ length: shown - 1 }, (_, i) => {
          const a = pt(i), b = pt(i + 1);
          return <line key={i} x1={a.x - x0 + 100} y1={a.y - y0 + 200} x2={b.x - x0 + 100} y2={b.y - y0 + 200}
            stroke={mix(b.t)} strokeWidth={20} strokeLinecap="round" opacity={0.95} />;
        })}
        <circle cx={head.x - x0 + 100} cy={head.y - y0 + 200} r={30} fill={mix(head.t)} />
      </svg>
      <div style={{
        position: "absolute", left: x0, top: y0 - 96, width: 800, whiteSpace: "nowrap",
        fontFamily: MONO, fontSize: 34, fontWeight: 700, letterSpacing: "0.28em", color: SILVER, opacity: labelIn * 0.9,
      }}>QUALITY</div>
      <div style={{
        position: "absolute", left: head.x + 44, top: head.y - 140, width: 400, whiteSpace: "nowrap",
        fontFamily: MONO, fontSize: 96, fontWeight: 700, color: mix(head.t), opacity: labelIn,
      }}>{value}</div>
    </>
  );
};

// ---------- tiny clock at "all day" (world) ----------
const Clock24: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useIn(A.all, 8);
  if (frame < A.all) return null;
  const ang = (frame - A.all) * 34;
  const R = 40;
  return (
    <div style={{
      position: "absolute", left: 3860, top: 590, whiteSpace: "nowrap",
      display: "flex", alignItems: "center", gap: 26,
      padding: "22px 42px", background: "#161C28",
      border: "2px solid rgba(255,255,255,0.16)", borderRadius: 18,
      opacity: p, transform: `translateY(${(1 - p) * 20}px)`,
    }}>
      <svg width={R * 2.3} height={R * 2.3} viewBox={`0 0 ${R * 2.3} ${R * 2.3}`}>
        <circle cx={R * 1.15} cy={R * 1.15} r={R} stroke="#D9DFE2" strokeWidth={5} fill="none" />
        <line x1={R * 1.15} y1={R * 1.15}
          x2={R * 1.15 + Math.sin((ang * Math.PI) / 180) * R * 0.72}
          y2={R * 1.15 - Math.cos((ang * Math.PI) / 180) * R * 0.72}
          stroke="#fff" strokeWidth={6} strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: MONO, fontSize: 54, fontWeight: 700, color: "#fff", letterSpacing: "0.12em" }}>24/7</span>
    </div>
  );
};

// ---------- comp ----------
export const MachineIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const c0 = cam(frame);
  // the camera never fully rests
  const c = { x: c0.x + Math.sin(frame / 38) * 4, y: c0.y + Math.cos(frame / 47) * 3, z: c0.z };

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`,
    transformOrigin: "0 0",
  };

  // speaker card: near-fullscreen open → top-right while the conveyor runs →
  // tucked corner for the takeover → slightly larger, watching, for the closer
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [0, 0.500, 0.500, 0.94],        // OPEN near-fullscreen, canvas peeking
      [A.let_, 0.500, 0.500, 0.94],
      [A.what, 0.745, 0.250, 0.335],  // glides top-right as the conveyor takes the stage
      [116, 0.745, 0.250, 0.335],
      [150, 0.862, 0.138, 0.148],     // tucks away — the emptiness gets the frame
      [A.youve, 0.862, 0.138, 0.148],
      [A.machine, 0.858, 0.124, 0.160], // regrows a touch: watching it happen
      [DUR, 0.858, 0.124, 0.160],
    ];
    for (let i = 0; i < kf.length - 1; i++) {
      const [fa, xa, ya, wa] = kf[i]; const [fb, xb, yb, wb] = kf[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = Easing.bezier(0.45, 0, 0.18, 1)((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
      }
    }
    const [, x, y, w] = kf[kf.length - 1]; return { x, y, w };
  })();
  const spkW = spk.w * W, spkH = spkW * 9 / 16;
  const spkRadius = W * 0.010; // rounded even near-fullscreen — locked preference

  // hook: defocus-to-focus + slow settle (crafted entrance)
  const hookBlur = interpolate(frame, [0, f(0.7)], [9, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const hookScale = interpolate(frame, [0, f(2.1)], [1.085, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });

  const toBlack = interpolate(frame, [342, DUR], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      {/* parallaxed faint draftsman grid */}
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`,
        backgroundSize: `${76 * wu * c.z}px`,
        backgroundPosition: `${W / 2 - c.x * wu * c.z}px ${H / 2 - c.y * wu * c.z}px`,
        maskImage: "radial-gradient(ellipse 80% 75% at 50% 45%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 45%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
      }} />

      {/* ================= THE WORLD ================= */}
      <div style={worldStyle}>
        <Spark />
        <Conveyor />
        <DefinitionStation />
        <Clock24 />
      </div>

      {/* ================= SPEAKER (screen space) ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: spkRadius, overflow: "hidden",
        boxShadow: `0 ${W * 0.008}px ${W * 0.028}px rgba(0,0,0,0.6), 0 0 0 ${Math.max(1, W * 0.0008)}px rgba(255,255,255,0.16)`,
      }}>
        <OffthreadVideo src={staticFile("intros/machine_scene1/source.mp4")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${hookScale})`,
            filter: `contrast(1.06) saturate(1.08) brightness(1.01)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
          }} />
      </div>

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 78% 70% at 50% 45%, transparent 58%, rgba(4,6,10,0.5) 100%)" }} />
      <AbsoluteFill
        style={{
          pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay",
          backgroundImage: `url("${GRAIN_URI}")`, backgroundSize: `${W * 0.125}px`,
          transform: `translate(${(frame % 3) * 3}px, ${(frame % 2) * -3}px)`,
        }}
      />
      <AbsoluteFill style={{ background: "#000", opacity: toBlack, pointerEvents: "none" }} />

      {/* SFX — quiet console cues; DEAD SILENCE from the freeze until the stamp */}
      <Sequence from={A.what} durationInFrames={f(1.4)}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(2.6)} durationInFrames={f(1.0)}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.22} /></Sequence>
      <Sequence from={f(3.2)} durationInFrames={f(1.0)}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.2} /></Sequence>
      <Sequence from={A.wrong + 2} durationInFrames={f(1.0)}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.3} /></Sequence>
      <Sequence from={A.youve} durationInFrames={f(1.4)}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(9.6)} durationInFrames={f(1.0)}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.18} /></Sequence>
      <Sequence from={f(10.6)} durationInFrames={f(1.0)}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.18} /></Sequence>
    </AbsoluteFill>
  );
};

export default MachineIntro;
