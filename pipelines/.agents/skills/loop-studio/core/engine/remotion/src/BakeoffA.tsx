/**
 * BakeoffA — style proof "LIVING WORKSHEET WORLD" (light register, Motion Grammar v2).
 * One continuous 200-unit canvas; semantic camera (pull=context, push=stakes, travel=topic);
 * concepts ENACTED: cards ride a stream, dive into business.md, it bursts and freezes (replay spike),
 * photo-vs-movie shown as frozen vs looping; comment box typed live; new order lands unanswered.
 * Narration segment: 85.7–113.5s ("not a document → stream → can't hold → photo vs movie → comments → new order").
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  FPS, f, MOVE, SNAP, POP, EASE, EASE_OVER, EASE_LOOP,
  RAISIN, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE,
  SANS, MONO, SERIF, useCamera, useAmbient, Boil, Draw, Sfx, SfxLayer, CamKF,
} from "./bb2/engine";

const WORLD_W = 200; // world width in page units (two screens wide)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* ------------------------------------------------ stream path (unit coords) */
const PATH_PTS: [number, number][] = [[-12, 39], [22, 35], [52, 41], [82, 35], [112, 39]];
const P = (s: number): [number, number] => {
  const t = clamp01(s) * (PATH_PTS.length - 1);
  const i = Math.min(PATH_PTS.length - 2, Math.floor(t));
  const k = t - i;
  const sm = (1 - Math.cos(k * Math.PI)) / 2; // cosine smoothing
  return [PATH_PTS[i][0] + (PATH_PTS[i + 1][0] - PATH_PTS[i][0]) * sm, PATH_PTS[i][1] + (PATH_PTS[i + 1][1] - PATH_PTS[i][1]) * sm];
};
const pathD = () => {
  let d = `M ${PATH_PTS[0][0]} ${PATH_PTS[0][1]}`;
  for (let s = 0.02; s <= 1.001; s += 0.02) { const [x, y] = P(s); d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`; }
  return d;
};

/* ------------------------------------------------ card visual */
const Card: React.FC<{ x: number; y: number; u: number; label: string; money?: boolean; scale?: number; rot?: number; opacity?: number; grey?: boolean }> = ({ x, y, u, label, money, scale = 1, rot = 0, opacity = 1, grey }) => (
  <div style={{ position: "absolute", left: x * u, top: y * u, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`, opacity }}>
    <div style={{ position: "relative", display: "inline-block", filter: grey ? "grayscale(1) opacity(0.6)" : undefined }}>
      <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.45}px,${u * 0.45}px)` }} />
      <div style={{ position: "relative", background: WHITE, border: `${u * 0.11}px solid ${RAISIN}`, borderRadius: u * 0.5, padding: `${u * 0.42}px ${u * 0.85}px`, display: "flex", alignItems: "center", gap: u * 0.5 }}>
        <span style={{ width: u * 0.55, height: u * 0.55, background: money ? LIME : "transparent", border: `${u * 0.1}px solid ${RAISIN}`, flexShrink: 0 }} />
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.15, color: RAISIN, whiteSpace: "nowrap" }}>{label}</span>
      </div>
    </div>
  </div>
);

const LABELS = ["new order #4471", "payout €3,900", "DM: still there?", "+3 subscribers", "5★ review", "€1,240 paid", "refund request", "invoice sent"];

/* ------------------------------------------------ main */
export const BakeoffA: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  /* semantic camera */
  const CAM: CamKF[] = [
    { t: 0.0, x: 30, y: 29, z: 2.1 },
    { t: 2.1, x: 30, y: 29, z: 2.1 },
    { t: 3.2, x: 54, y: 33, z: 1.0 },   // pull back: context (the stream)
    { t: 5.5, x: 54, y: 33, z: 1.0 },
    { t: 6.3, x: 38, y: 32, z: 1.5 },   // push: stakes (cards dive at file)
    { t: 9.2, x: 38, y: 32, z: 1.5 },
    { t: 9.9, x: 33, y: 31, z: 1.85 },  // burst close-up
    { t: 10.7, x: 33, y: 31, z: 1.85 },
    { t: 12.0, x: 151, y: 27, z: 1.12 },// travel: new topic (photo vs movie)
    { t: 15.2, x: 151, y: 27, z: 1.12 },
    { t: 16.2, x: 151.5, y: 45.5, z: 1.75 },// push down: the aside (comments)
    { t: 21.4, x: 151.5, y: 45.5, z: 1.75 },
    { t: 22.5, x: 33, y: 31, z: 1.5 },  // whip back: callback (frozen file)
    { t: 25.5, x: 33, y: 31, z: 1.5 },
    { t: 27.8, x: 33, y: 32.5, z: 1.68 }, // slow push: tension hold
  ];
  const cam = useCamera(CAM);
  // burst camera shake
  const shakeT = t - 9.5;
  const shake = shakeT > 0 && shakeT < 0.55 ? Math.sin(shakeT * 62) * (1 - shakeT / 0.55) * u * 0.5 : 0;
  const amb = useAmbient();

  /* file freeze + squash */
  const FILE = { x: 31, y: 29.5 };
  const impacts = [6.4, 7.2, 8.0, 8.8];
  let squash = 0;
  for (const it of impacts) { const dt = t - it; if (dt > 0 && dt < 0.35) squash = Math.max(squash, Math.sin((1 - dt / 0.35) * Math.PI) * 0.1); }
  const burstP = clamp01((t - 9.5) / 0.5);
  const frozen = t > 9.5;

  /* stream cards */
  const TRAVERSE = 11;
  const riders: { born: number; label: string; money: boolean; dive?: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const born = 1.2 + i * 0.95;
    if (born > t) break;
    riders.push({ born, label: LABELS[i % LABELS.length], money: i % 3 !== 1, dive: undefined });
  }
  // 4 divers (indices by born time nearest impacts-0.6)
  const divers = impacts.map((it, k) => ({ start: it - 0.62, impact: it, label: LABELS[(k * 3 + 1) % LABELS.length], money: k % 2 === 0 }));

  /* burst debris */
  const DEBRIS = Array.from({ length: 8 }, (_, i) => ({ ang: (i / 8) * Math.PI * 2 + 0.4, spd: 16 + (i % 3) * 7, rot: (i % 2 ? 1 : -1) * (140 + i * 25) }));

  /* typing */
  const MSG = "am i missing something? roast me below";
  const typed = MSG.slice(0, Math.max(0, Math.floor((t - 16.6) * 14)));

  /* landing cards (end) — land clearly IN FRONT of the frozen file, above the stream */
  const landers = [
    { at: 22.3, x: 24.5, endY: 30.5, label: "new order €1,850", money: true },
    { at: 23.3, x: 38.5, endY: 32.5, label: "email from a client", money: false },
  ];

  /* sfx plan */
  const SFX_PLAN: Sfx[] = [
    { t: 0.05, name: "scratch_m.wav", vol: 0.35 },
    { t: 0.95, name: "thock_2.wav", vol: 0.6 }, { t: 0.95, name: "whoosh_s.wav", vol: 0.3 },
    { t: 2.15, name: "whoosh_m.wav", vol: 0.4 },
    { t: 2.7, name: "thock_0.wav", vol: 0.3 }, { t: 3.65, name: "thock_3.wav", vol: 0.26 }, { t: 4.6, name: "thock_1.wav", vol: 0.22 },
    { t: 5.55, name: "whoosh_s.wav", vol: 0.35 },
    { t: 6.4, name: "thock_4.wav", vol: 0.55 }, { t: 6.4, name: "tick.wav", vol: 0.4 },
    { t: 7.2, name: "thock_1.wav", vol: 0.58 }, { t: 7.2, name: "tick.wav", vol: 0.4 },
    { t: 8.0, name: "thock_3.wav", vol: 0.62 }, { t: 8.0, name: "tick.wav", vol: 0.4 },
    { t: 8.8, name: "thock_0.wav", vol: 0.65 }, { t: 8.8, name: "tick.wav", vol: 0.4 },
    { t: 8.15, name: "riser.wav", vol: 0.5 },
    { t: 9.5, name: "boom_sub.wav", vol: 0.85 }, { t: 9.52, name: "flare-hit.mp3", vol: 0.5 },
    { t: 9.85, name: "drone_low.wav", vol: 0.45 },
    { t: 10.75, name: "whoosh_l.wav", vol: 0.45 },
    { t: 12.1, name: "scratch_s.wav", vol: 0.35 }, { t: 12.8, name: "scratch_s.wav", vol: 0.35 },
    { t: 13.5, name: "thock_1.wav", vol: 0.5 }, { t: 14.15, name: "thock_3.wav", vol: 0.5 },
    { t: 14.45, name: "shimmer.wav", vol: 0.4 },
    { t: 15.25, name: "whoosh_m.wav", vol: 0.4 },
    { t: 16.3, name: "scratch_s.wav", vol: 0.3 },
    ...Array.from({ length: 9 }, (_, i) => ({ t: 16.65 + i * 0.28, name: "caption-tick.wav", vol: 0.18 })),
    { t: 21.45, name: "whoosh_l.wav", vol: 0.5 },
    { t: 22.55, name: "thock_4.wav", vol: 0.55 }, { t: 22.85, name: "thock_2.wav", vol: 0.3 },
    { t: 23.55, name: "thock_1.wav", vol: 0.5 }, { t: 23.85, name: "thock_0.wav", vol: 0.28 },
  ];

  const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

  return (
    <AbsoluteFill style={{ background: SILVER, overflow: "hidden" }}>
      {/* narration */}
      <Audio src={staticFile("intros/businessbrain/bakeoff_voice.m4a")} />
      <Audio src={staticFile("music/bg-brand-minimal-genA.mp3")} volume={0.14} />
      <SfxLayer plan={SFX_PLAN} />

      {/* WORLD */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W * u, height: 56.25 * u, transform: `${cam.transform} translate(${shake}px, ${shake * 0.6}px)`, transformOrigin: "0 0" }}>
        {/* page + grid */}
        <div style={{ position: "absolute", inset: 0, background: SILVER }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${RAISIN}0d 1px,transparent 1px),linear-gradient(90deg,${RAISIN}0d 1px,transparent 1px)`, backgroundSize: `${u * 3.2}px ${u * 3.2}px` }} />

        {/* ================= SVG ink layer ================= */}
        <svg width={WORLD_W * u} height={56.25 * u} viewBox={`0 0 ${WORLD_W} 56.25`} style={{ position: "absolute", inset: 0 }}>
          {/* stream */}
          <Boil id="stream" amp={0.9}>
            <path d={pathD()} stroke={LIME} strokeWidth={0.38} fill="none" strokeLinecap="round"
              strokeDasharray="2.2 1.4" strokeDashoffset={-t * 6} opacity={interpolate(t, [2.2, 3.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          </Boil>

          {/* business.md file (drawn, boiling, squash on impact, grey on freeze) */}
          <Boil id="file" amp={1.4}>
            <g transform={`translate(${FILE.x} ${FILE.y}) scale(${1 + squash * 0.5},${1 - squash}) scale(${1 + burstP * 0.06}) translate(-8 -9)`}
              opacity={1} >
              {(() => { const c = frozen ? SILVER_MID : RAISIN; const a = frozen ? SILVER_MID : LIME; return (
                <>
                  <Draw d="M 0 1.5 q 0 -1.5 1.5 -1.5 l 9 0 l 5.5 5.5 l 0 11 q 0 1.5 -1.5 1.5 l -13 0 q -1.5 0 -1.5 -1.5 z" at={0.05} dur={0.7} w={0.42} color={c} len={60} />
                  <Draw d="M 10.5 0 l 0 5.5 l 5.5 0" at={0.35} dur={0.3} w={0.42} color={c} len={12} />
                  <Draw d="M 2.6 8 l 8 0 M 2.6 10.8 l 10 0 M 2.6 13.6 l 7 0" at={0.55} dur={0.4} w={0.26} color={frozen ? SILVER_MID : SILVER_SOFT} len={26} />
                  {frozen && <path d="M 8 6 l -3.5 -3 M 8 6 l 4 -2 M 8 6 l -2 4.5 M 8 6 l 3.6 3.4" stroke={a} strokeWidth={0.3} fill="none" strokeLinecap="round" />}
                </>
              ); })()}
            </g>
          </Boil>

          {/* burst flash ring */}
          {burstP > 0 && burstP < 1 && (
            <circle cx={FILE.x} cy={FILE.y} r={burstP * 14} fill="none" stroke={LIME} strokeWidth={(1 - burstP) * 1.2} opacity={1 - burstP} />
          )}

          {/* ---------- photo vs movie zone (drawn frames) ---------- */}
          <Boil id="pv" amp={1.1}>
            <g opacity={interpolate(t, [11.4, 12.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
              {/* polaroid */}
              <Draw d="M 128 18 l 17 0 l 0 17 l -17 0 z" at={12.0} dur={0.6} w={0.42} len={70} />
              <Draw d="M 129.6 19.6 l 13.8 0 l 0 10.5 l -13.8 0 z" at={12.35} dur={0.5} w={0.3} color={SILVER_MID} len={50} />
              {/* screen */}
              <Draw d="M 157 17 l 20 0 l 0 14.5 l -20 0 z" at={12.7} dur={0.6} w={0.42} len={72} />
              <Draw d="M 165 31.5 l 4 0 M 163 33.3 l 8 0" at={13.15} dur={0.3} w={0.4} len={14} />
            </g>
          </Boil>

          {/* ---------- comment box zone ---------- */}
          <Boil id="cm" amp={1.1}>
            <g opacity={interpolate(t, [15.6, 16.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
              <Draw d="M 138 41 q 0 -1.2 1.2 -1.2 l 24 0 q 1.2 0 1.2 1.2 l 0 6.5 q 0 1.2 -1.2 1.2 l -20 0 l -2.6 2.6 l 0 -2.6 l -1.4 0 q -1.2 0 -1.2 -1.2 z" at={16.25} dur={0.7} w={0.4} len={80} />
              <circle cx={141.4} cy={44.2} r={1.15} fill="none" stroke={RAISIN} strokeWidth={0.32} />
              <path d="M 140.6 44.0 a 1.4 1.4 0 0 1 1.7 0 M 141.45 43.4 l 0 0.02" stroke={RAISIN} strokeWidth={0.28} fill="none" strokeLinecap="round" />
            </g>
          </Boil>
        </svg>

        {/* ================= HTML overlay layer ================= */}
        {/* STAMP: NOT A DOCUMENT. */}
        {t > 0.92 && (() => {
          const p = interpolate(frame, [f(0.92), f(0.92) + POP + 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
          return (
            <div style={{ position: "absolute", left: 30.5 * u, top: 21.5 * u, transform: `translate(-50%,-50%) rotate(-5deg) scale(${1.7 - 0.7 * p})`, opacity: p }}>
              <div style={{ background: RAISIN, padding: `${u * 0.5}px ${u * 1.0}px`, borderRadius: 2 }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5, color: LIME, letterSpacing: "0.04em" }}>NOT A DOCUMENT.</span>
              </div>
            </div>
          );
        })()}
        {/* file label */}
        <div style={{ position: "absolute", left: 25.5 * u, top: 18.4 * u, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.06em", color: BODY, opacity: interpolate(t, [0.7, 1.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>business.md</div>

        {/* headline at stream reveal */}
        {t > 2.5 && t < 10.7 && (
          <div style={{ position: "absolute", left: 44 * u, top: 20.5 * u, opacity: interpolate(t, [2.5, 3.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4, letterSpacing: "-0.03em", color: RAISIN, textTransform: "uppercase" }}>
              IT'S A{" "}
              <span style={{ position: "relative", display: "inline-block" }}>
                <span style={{ position: "absolute", left: -u * 0.3, right: -u * 0.3, top: "14%", bottom: "10%", background: LIME, transform: `scaleX(${interpolate(frame, [f(3.1), f(3.1) + SNAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE })}) rotate(-1.5deg)`, transformOrigin: "left center" }} />
                <span style={{ position: "relative" }}>STREAM.</span>
              </span>
            </span>
          </div>
        )}

        {/* riders on the stream */}
        {riders.map((r, i) => {
          const p = (t - r.born) / TRAVERSE;
          if (p <= 0 || p >= 1) return null;
          const [x, y] = P(p);
          if (x > 118) return null;
          return <Card key={`r${i}`} x={x} y={y + amb.bob(i * 0.37, 0.5)} u={u} label={r.label} money={r.money} scale={0.92} rot={amb.drift(i * 0.61, 2.5)} />;
        })}

        {/* divers */}
        {divers.map((d, i) => {
          if (t < d.start) return null;
          const dur = d.impact - d.start;
          const p = clamp01((t - d.start) / dur);
          const [sx, sy] = P(0.34);
          const ex = FILE.x, ey = FILE.y - 1.5;
          const mx = (sx + ex) / 2 + 3, my = Math.min(sy, ey) - 6;
          const bez = (a: number, b: number, c: number, q: number) => (1 - q) * (1 - q) * a + 2 * (1 - q) * q * b + q * q * c;
          const x = bez(sx, mx, ex, p), y = bez(sy, my, ey, p);
          const post = t - d.impact;
          if (post > 0.12) return null;
          return <Card key={`d${i}`} x={x} y={y} u={u} label={d.label} money={d.money} scale={1 - p * 0.45} rot={p * -14} />;
        })}

        {/* debris on burst */}
        {burstP > 0 && DEBRIS.map((dd, i) => {
          const dt = t - 9.5;
          if (dt > 1.4) return null;
          const x = FILE.x + Math.cos(dd.ang) * dd.spd * dt;
          const y = FILE.y + Math.sin(dd.ang) * dd.spd * dt * 0.7 + 26 * dt * dt;
          return <Card key={`b${i}`} x={x} y={y} u={u} label={LABELS[i % LABELS.length]} money={i % 2 === 0} scale={0.7} rot={dd.rot * dt} opacity={1 - dt / 1.4} />;
        })}

        {/* CAN'T HOLD IT badge after burst */}
        {frozen && t < 10.7 && (() => {
          const p = interpolate(frame, [f(9.9), f(9.9) + POP + 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
          return (
            <div style={{ position: "absolute", left: 31 * u, top: 40.5 * u, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * p})`, opacity: p }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ position: "absolute", inset: 0, background: LIME, transform: `translate(${u * 0.4}px,${u * 0.4}px)` }} />
                <div style={{ position: "relative", background: RAISIN, padding: `${u * 0.45}px ${u * 0.95}px` }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.12em", color: LIME }}>✕ CAN'T HOLD IT</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ---------- photo vs movie content ---------- */}
        {t > 12.2 && (
          <>
            {/* frozen minis in polaroid */}
            {[0, 1, 2].map((i) => (
              <Card key={`p${i}`} x={132 + (i % 2) * 5.5} y={22 + i * 3.1} u={u} label={["€90", "DM", "order"][i]} money={i !== 1} scale={0.78} grey opacity={interpolate(t, [12.6, 13.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
            ))}
            {/* moving minis in screen */}
            {[0, 1, 2].map((i) => {
              const lx = 159.5 + (((t * 4.2 + i * 6.5) % 15.5));
              if (lx > 174.4) return null;
              return <Card key={`m${i}`} x={lx} y={21 + (i % 2) * 5 + amb.bob(i, 0.35)} u={u} label={["€90", "DM", "order"][i]} money={i !== 1} scale={0.78} opacity={interpolate(t, [13.0, 13.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />;
            })}
            {/* labels */}
            {t > 13.5 && (
              <div style={{ position: "absolute", left: 136.5 * u, top: 37.5 * u, transform: "translate(-50%,-50%)", opacity: interpolate(t, [13.5, 13.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, color: RAISIN, textTransform: "uppercase" }}>A FILE = A PHOTO</span>
              </div>
            )}
            {t > 14.15 && (
              <div style={{ position: "absolute", left: 167 * u, top: 35 * u, transform: "translate(-50%,-50%)", opacity: interpolate(t, [14.15, 14.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, color: RAISIN, textTransform: "uppercase" }}>
                  A BUSINESS ={" "}
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <span style={{ position: "absolute", left: -u * 0.25, right: -u * 0.25, top: "12%", bottom: "8%", background: LIME, transform: `scaleX(${interpolate(frame, [f(14.45), f(14.45) + SNAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE })}) rotate(-1.5deg)`, transformOrigin: "left center" }} />
                    <span style={{ position: "relative" }}>A MOVIE</span>
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        {/* ---------- comment typing ---------- */}
        {t > 16.5 && (
          <div style={{ position: "absolute", left: 143.6 * u, top: 43.1 * u, width: 20 * u }}>
            <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.02, color: RAISIN }}>
              {typed}
              {Math.floor(t * 2.4) % 2 === 0 && t < 21 && <span style={{ display: "inline-block", width: u * 0.55, height: u * 1.2, background: LIME, verticalAlign: "-15%" }} />}
            </span>
          </div>
        )}

        {/* ---------- landing cards at the end ---------- */}
        {landers.map((L, i) => {
          if (t < L.at) return null;
          const dt = t - L.at;
          const drop = Math.min(1, dt / 0.5);
          const bounce = dt < 0.5 ? 0 : dt < 0.75 ? -Math.sin((dt - 0.5) / 0.25 * Math.PI) * 1.6 : dt < 0.95 ? -Math.sin((dt - 0.75) / 0.2 * Math.PI) * 0.5 : 0;
          const y = L.endY - 20 + drop * drop * 20 + bounce;
          return <Card key={`L${i}`} x={L.x} y={y + (dt > 1 ? amb.bob(i * 0.8, 0.3) : 0)} u={u} label={L.label} money={L.money} rot={i ? 3 : -4} scale={1.12} />;
        })}
      </div>

      {/* grain + vignette (screen space) */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "multiply", opacity: 0.045, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 14}px rgba(15,18,26,0.10)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default BakeoffA;
