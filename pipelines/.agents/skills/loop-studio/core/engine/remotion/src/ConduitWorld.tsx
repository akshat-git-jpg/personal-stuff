/**
 * ConduitWorld — proof of THE CONDUIT world: one raisin-void hall you travel left→right along a
 * single glowing lime wire (your live event-stream). Opening stretch: THRESHOLD (wire ignites) →
 * RIDE THE WIRE downstream → THE STREAM ROOM (living events flow past a dead file that freezes).
 * World-camera [x,y,zoom] + parallax; the wire is the one persistent element; the REVENUE counter
 * top-left never resets. Film stock inherited from the intro / BusinessAlive.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig, staticFile, Easing } from "remotion";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const RAISIN = "#0C0F16";
const LIME = "#CFFF05";
const SILVER = "#AEB7BC";
const STEEL = "#5A6470";
const SANS = "'Space Grotesk','Helvetica Neue',sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";
const SERIF = "'Playfair Display',Georgia,serif";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const BARH = 0.11;

// world is ~6400 wide; wire runs at y=1080. camera coords [t, x, y, zoom]
const WIRE_Y = 1080;
const THRESH_X = 960;
const STREAM_X = 2500;
const CAM: [number, number, number, number][] = [
  [0, THRESH_X, WIRE_Y, 1.0],
  [1.8, THRESH_X, WIRE_Y, 1.05],
  [2.3, THRESH_X, WIRE_Y, 1.0],
  [6.6, STREAM_X, WIRE_Y, 1.0],
  [8.2, STREAM_X, WIRE_Y, 1.07],
  [14, STREAM_X, WIRE_Y, 1.09],
];
function cam(t: number) {
  const k = CAM;
  if (t <= k[0][0]) return { x: k[0][1], y: k[0][2], z: k[0][3] };
  for (let i = 0; i < k.length - 1; i++) {
    if (t >= k[i][0] && t <= k[i + 1][0]) {
      const p = EASE((t - k[i][0]) / (k[i + 1][0] - k[i][0]));
      return { x: k[i][1] + (k[i + 1][1] - k[i][1]) * p, y: k[i][2] + (k[i + 1][2] - k[i][2]) * p, z: k[i][3] + (k[i + 1][3] - k[i][3]) * p };
    }
  }
  const l = k[k.length - 1]; return { x: l[1], y: l[2], z: l[3] };
}

const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.5'/></svg>`);

const STREAM = [
  { t: "NEW ORDER #4471", lane: -300, depth: 0.95, spd: 90, off: 0.0, money: true },
  { t: "€1,240 paid", lane: 240, depth: 1.0, spd: 110, off: 0.3, money: true },
  { t: "DM · “still available?”", lane: -120, depth: 0.5, spd: 65, off: 0.55 },
  { t: "+3 subscribers", lane: 360, depth: 0.4, spd: 55, off: 0.8 },
  { t: "Payout €3,900", lane: 130, depth: 0.98, spd: 115, off: 0.15, money: true },
  { t: "5★ review", lane: -260, depth: 0.45, spd: 60, off: 0.42 },
  { t: "Support ticket", lane: 300, depth: 0.32, spd: 48, off: 0.68 },
  { t: "€680 paid", lane: -180, depth: 0.7, spd: 85, off: 0.9, money: true },
  { t: "New signup", lane: 200, depth: 0.85, spd: 95, off: 0.62 },
  { t: "Reply sent", lane: -60, depth: 0.5, spd: 70, off: 0.22 },
];

export const ConduitWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;
  const c = cam(t);
  const dx = Math.sin(frame / 38) * 5, dy = Math.cos(frame / 47) * 4;
  const camXpx = c.x, camYpx = c.y;
  const world = `translate(${W / 2 - camXpx * c.z + dx}px, ${H / 2 - camYpx * c.z + dy}px) scale(${c.z})`;
  const open = interpolate(frame, [0, f(0.7)], [1, 0], { extrapolateRight: "clamp" });

  // wire lights up to a little ahead of the camera
  const litX = c.x + W * 0.35;
  const rev = Math.floor(interpolate(t, [0, 14], [18420, 38650], { extrapolateRight: "clamp" }));
  // file freezes ~10.5s (after we settle in the stream room)
  const freeze = interpolate(t, [10.4, 11.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const streamAlive = interpolate(t, [4.5, 6.0], [0.15, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (1 - 0.3 * freeze);

  const WLEN = 6400;
  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      {/* far haze plane (parallax, subtle) */}
      <AbsoluteFill style={{ transform: `translate(${(W / 2 - camXpx * 0.25) * 0.0 + (W / 2 - camXpx * c.z) * 0.25}px,0) `, background: "radial-gradient(ellipse 60% 50% at 50% 46%, #16202f 0%, #090c12 72%)" }} />

      {/* THE WORLD */}
      <AbsoluteFill style={{ transform: world, transformOrigin: "0 0" }}>
        {/* depth grid */}
        <div style={{ position: "absolute", left: -200, top: 200, width: WLEN + 400, height: 1600, backgroundImage: `linear-gradient(rgba(174,183,188,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(174,183,188,0.05) 1px,transparent 1px)`, backgroundSize: `120px 120px`, maskImage: "linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent)", opacity: 0.6 }} />

        {/* THE WIRE — one lime path across the whole hall */}
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={WLEN} height={WIRE_Y * 2}>
          <defs><filter id="wg"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          {/* dim base wire */}
          <path d={`M0 ${WIRE_Y} C 1600 ${WIRE_Y - 40}, 3200 ${WIRE_Y + 50}, 6400 ${WIRE_Y - 20}`} stroke={STEEL} strokeWidth={3} fill="none" opacity={0.4} />
          {/* lit portion */}
          <path d={`M0 ${WIRE_Y} C 1600 ${WIRE_Y - 40}, 3200 ${WIRE_Y + 50}, 6400 ${WIRE_Y - 20}`} stroke={LIME} strokeWidth={5} fill="none" filter="url(#wg)"
            strokeDasharray={WLEN} strokeDashoffset={WLEN - Math.max(0, litX)} opacity={0.9} />
        </svg>

        {/* stream motes riding the wire near the stream room */}
        {STREAM.map((m, i) => {
          const flow = ((t * m.spd + m.off * 1400) % 1400) - 200; // travels downstream within region
          const wx = STREAM_X - 500 + flow;
          const wy = WIRE_Y + m.lane;
          const sc = 0.5 + m.depth * 0.9;
          const near = m.depth > 0.8;
          return (
            <div key={i} style={{ position: "absolute", left: wx, top: wy, transform: `translate(-50%,-50%) scale(${sc})`, filter: `blur(${(1 - m.depth) * 3}px)`, opacity: (0.2 + m.depth * 0.6) * streamAlive, display: "flex", alignItems: "center", gap: 8, background: near ? "rgba(20,26,38,0.82)" : "rgba(18,22,32,0.5)", border: `1px solid ${m.money ? "rgba(207,255,5,0.42)" : "rgba(174,183,188,0.18)"}`, borderRadius: 14, padding: "12px 22px", whiteSpace: "nowrap", boxShadow: near ? "0 14px 34px rgba(0,0,0,0.5)" : "none" }}>
              {m.money && <div style={{ width: 11, height: 11, borderRadius: "50%", background: LIME, boxShadow: `0 0 10px ${LIME}` }} />}
              <span style={{ fontFamily: MONO, fontSize: 26, color: m.money ? LIME : "#DCE2E4" }}>{m.t}</span>
            </div>
          );
        })}

        {/* THE DEAD FILE at the stream room center */}
        {t > 4.2 && (
          <div style={{ position: "absolute", left: STREAM_X, top: WIRE_Y, transform: "translate(-50%,-50%)", opacity: interpolate(t, [4.2, 5.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <div style={{ position: "relative", width: 300, height: 400 }}>
              <div style={{ position: "absolute", top: -46, left: 0, fontFamily: MONO, fontSize: 22, color: STEEL, letterSpacing: "0.1em" }}>business.md</div>
              <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: "linear-gradient(160deg,#1A2130,#0E131C)", border: `1px solid ${STEEL}`, boxShadow: "0 26px 70px rgba(0,0,0,0.6)", filter: `grayscale(${freeze * 0.6}) brightness(${1 - freeze * 0.15})`, overflow: "hidden" }}>
                {Array.from({ length: 9 }).map((_, i) => <div key={i} style={{ position: "absolute", left: 26, top: 30 + i * 40, width: i % 3 === 0 ? 150 : 240, height: 8, borderRadius: 4, background: STEEL, opacity: 0.4 }} />)}
              </div>
              {freeze > 0.02 && <div style={{ position: "absolute", inset: 0, borderRadius: 16, opacity: freeze, background: "linear-gradient(150deg, rgba(190,220,235,0.22), rgba(140,180,210,0.05) 60%)", mixBlendMode: "screen" }} />}
              {freeze > 0.5 && <div style={{ position: "absolute", top: 414, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 20, letterSpacing: "0.24em", color: "#9DC3D6", opacity: (freeze - 0.5) * 2 }}>FROZEN</div>}
            </div>
          </div>
        )}

        {/* THRESHOLD marker — a faint gate at the far left, where the wire enters */}
        <div style={{ position: "absolute", left: THRESH_X, top: WIRE_Y - 520, transform: "translate(-50%,0)", fontFamily: MONO, fontSize: 22, letterSpacing: "0.3em", color: STEEL, opacity: interpolate(t, [0.4, 1.2, 3.2, 4], [0, 0.7, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          ↳ FOLLOW THE STREAM
        </div>
      </AbsoluteFill>

      {/* persistent REVENUE counter (screen space) */}
      <div style={{ position: "absolute", left: u * 5, top: `${BARH * 100 + 4}%`, opacity: 0.92 }}>
        <div style={{ fontFamily: MONO, fontSize: u * 1.05, letterSpacing: "0.28em", color: STEEL, marginBottom: u * 0.5 }}>REVENUE · TODAY</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 3.2, color: LIME }}>€{rev.toLocaleString()}</div>
      </div>

      {/* one Playfair line when the file freezes */}
      {t > 11.4 && (() => {
        const p = interpolate(t, [11.4, 12.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        return <div style={{ position: "absolute", left: 0, right: 0, top: `${(1 - BARH) * 100 - 12}%`, textAlign: "center", opacity: p }}><span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 3.0, color: "#E7ECEE" }}>a business doesn’t fit in a file.</span></div>;
      })()}

      {/* film stock */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 76% at 50% 48%, transparent 46%, rgba(0,0,0,0.66) 100%)" }} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay", backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 12}px`, transform: `translate(${(frame % 3) * 3}px,${(frame % 2) * -3}px)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${BARH * 100}%`, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${BARH * 100}%`, background: "#000" }} />
      <AbsoluteFill style={{ background: "#000", opacity: open, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default ConduitWorld;
