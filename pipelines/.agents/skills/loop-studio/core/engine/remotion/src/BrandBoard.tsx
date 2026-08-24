/**
 * BrandBoard — the concept rebuilt ON-BRAND (BuildLoop System v1, LOCKED palette raisin+silver+lime,
 * no cream/navy). Same "drawn worksheet" digestibility, now from the real brand: silver graph-paper
 * page + faded draftsman grid, raisin ink line-drawings, the lime MARKER, hard lime-OFFSET cards,
 * a NUM BADGE, mono FIG eyebrow, Space Grotesk uppercase + Playfair italic counterpoint, sharp ink
 * edges. Concept: a business is a living stream a dead file can't hold.
 * Layout = two-column poster: stacked headline + file (left), counter + flowing event cards (right).
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { SANS, MONO, SERIF, RAISIN, SILVER, SILVER_SOFT, BODY, LIME, WHITE } from "./bb/brandfonts";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1); // brand ease

const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

const Draw: React.FC<{ d: string; at: number; dur: number; w: number; color?: string; len?: number }> = ({ d, at, dur, w, color = RAISIN, len = 2600 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.6, 0, 0.35, 1) });
  return <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />;
};

// hard lime-offset card (the brand's signature move)
const Offset: React.FC<{ children: React.ReactNode; u: number; radius?: number; off?: number; bg?: string; border?: string; pad?: string }> = ({ children, u, radius = 12, off = 7, bg = WHITE, border = RAISIN, pad }) => (
  <div style={{ position: "relative", display: "inline-block" }}>
    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: radius, transform: `translate(${off}px,${off}px)` }} />
    <div style={{ position: "relative", background: bg, border: `${u * 0.14}px solid ${border}`, borderRadius: radius, padding: pad }}>{children}</div>
  </div>
);

export const BrandBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;
  const fade = (a: number, b: number) => interpolate(frame, [f(a), f(b)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const open = interpolate(frame, [0, f(0.6)], [1, 0], { extrapolateRight: "clamp" });
  const markP = interpolate(frame, [f(1.4), f(2.0)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const tally = Math.floor(interpolate(t, [2, 9], [12480, 36980], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  // event cards flow up the right two-thirds, clear of the left headline column
  const NOTES = [
    { txt: "new order #4471", at: 2.5, x: 0.57, y: 0.32, money: true },
    { txt: "payout €3,900", at: 3.1, x: 0.82, y: 0.36, money: true },
    { txt: "DM · “still there?”", at: 3.7, x: 0.58, y: 0.47, money: false },
    { txt: "€1,240 paid", at: 4.3, x: 0.84, y: 0.55, money: true },
    { txt: "+3 subscribers", at: 5.0, x: 0.62, y: 0.66, money: false },
    { txt: "5★ review", at: 5.6, x: 0.86, y: 0.72, money: false },
  ];
  const freeze = fade(6.3, 7.1);

  return (
    <AbsoluteFill style={{ background: SILVER, fontFamily: SANS }}>
      {/* faded draftsman grid */}
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${RAISIN}0d 1px,transparent 1px),linear-gradient(90deg,${RAISIN}0d 1px,transparent 1px)`, backgroundSize: `${u * 3.2}px ${u * 3.2}px`, maskImage: "radial-gradient(ellipse 80% 76% at 50% 50%, #000 42%, transparent 94%)", WebkitMaskImage: "radial-gradient(ellipse 80% 76% at 50% 50%, #000 42%, transparent 94%)" }} />
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "multiply", opacity: 0.04 }} />

      {/* FIG eyebrow + num badge — top left */}
      <div style={{ position: "absolute", left: "5%", top: "7%", display: "flex", alignItems: "center", gap: u * 1.1 }}>
        <Offset u={u} radius={0} off={5} bg={RAISIN} border={RAISIN} pad={`${u * 0.5}px ${u * 1.1}px`}>
          <span style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 1.8, color: LIME }}>01</span>
        </Offset>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em", color: BODY }}>FIG. — YOUR BUSINESS</span>
      </div>

      {/* live REVENUE stat — its own clear top-right zone */}
      <div style={{ position: "absolute", right: "5%", top: "9%", textAlign: "right", opacity: fade(1.9, 2.5) }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.2em", color: BODY }}>REVENUE · TODAY</div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 5, color: RAISIN, letterSpacing: "-0.02em", lineHeight: 1 }}>€{tally.toLocaleString()}</div>
      </div>

      {/* HEADLINE — stacked, uppercase Space Grotesk + lime marker, Playfair counterpoint */}
      <div style={{ position: "absolute", left: "5%", top: "20%" }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.4, letterSpacing: "-0.03em", color: RAISIN, lineHeight: 0.94, textTransform: "uppercase", opacity: fade(0.3, 0.9) }}>YOUR BUSINESS</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.4, letterSpacing: "-0.03em", color: RAISIN, lineHeight: 0.94, textTransform: "uppercase", opacity: fade(0.6, 1.2), marginTop: u * 0.3 }}>
          <span style={{ position: "relative", display: "inline-block" }}>
            <span style={{ position: "absolute", left: -u * 0.5, right: -u * 0.5, top: "16%", bottom: "12%", background: LIME, transform: `scaleX(${markP}) rotate(-1.5deg)`, transformOrigin: "left center", zIndex: 0 }} />
            <span style={{ position: "relative", zIndex: 1 }}>NEVER STOPS.</span>
          </span>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.2, color: BODY, marginTop: u * 1.1, opacity: fade(1.6, 2.2) }}>it changes every second.</div>
      </div>

      {/* the STREAM — a lime line (the living money flow) drawn across the lower half */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <Draw d={`M ${u * 4} ${u * 44} C ${u * 30} ${u * 41}, ${u * 64} ${u * 49}, ${u * 98} ${u * 43}`} at={f(2.0)} dur={f(1.6)} w={u * 0.4} color={LIME} len={u * 100} />
      </svg>

      {/* the DEAD FILE — raisin ink line-drawing sitting on the stream (goes muted when it can't hold) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <g transform={`translate(${u * 7} ${u * 33})`} opacity={1 - freeze * 0.45}>
          <Draw d={`M 0 4 q 0 -4 4 -4 l ${u * 11} 0 l ${u * 4} ${u * 4} l 0 ${u * 15} q 0 4 -4 4 l ${-u * 15} 0 q -4 0 -4 -4 z`} at={f(2.2)} dur={f(1.0)} w={u * 0.4} color={freeze > 0.5 ? SILVER_SOFT : RAISIN} len={u * 62} />
          <Draw d={`M ${u * 15} 0 l 0 ${u * 4} l ${u * 4} 0`} at={f(2.6)} dur={f(0.3)} w={u * 0.4} color={freeze > 0.5 ? SILVER_SOFT : RAISIN} len={u * 10} />
          {[0, 1, 2, 3].map((i) => <Draw key={i} d={`M ${u * 2.5} ${u * (4.5 + i * 3)} l ${u * (i % 2 ? 8 : 11)} 0`} at={f(3.0 + i * 0.12)} dur={f(0.2)} w={u * 0.26} color={SILVER_SOFT} len={u * 12} />)}
        </g>
      </svg>
      <div style={{ position: "absolute", left: "7%", top: `${(33 - 3) / 56.25 * 100}%`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.06em", color: BODY, opacity: fade(3.2, 3.8) }}>business.md</div>

      {/* the file can't hold it — raisin bar w/ lime offset (no red; on-brand) */}
      {frame >= f(6.4) && (
        <div style={{ position: "absolute", left: "7%", top: `${52 / 56.25 * 100}%`, transform: `translateY(${(1 - fade(6.4, 6.9)) * u}px)`, opacity: fade(6.4, 6.9) }}>
          <Offset u={u} radius={0} off={u * 0.7} bg={RAISIN} border={RAISIN} pad={`${u * 0.7}px ${u * 1.4}px`}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.6, letterSpacing: "0.14em", color: LIME }}>✕ CAN’T HOLD IT</span>
          </Offset>
        </div>
      )}

      {/* flowing event NOTES — white lime-offset cards, mono eyebrow bullet */}
      {NOTES.map((n, i) => {
        const inP = interpolate(frame, [f(n.at), f(n.at + 0.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        if (inP <= 0) return null;
        const fl = Math.sin((frame / 44) + i) * u * 0.4;
        return (
          <div key={i} style={{ position: "absolute", left: `${n.x * 100}%`, top: `calc(${n.y * 100}% + ${fl}px)`, transform: `translate(-50%,-50%) translate(${(1 - inP) * u}px,${(1 - inP) * u}px)`, opacity: inP }}>
            <Offset u={u} radius={u * 0.8} off={u * 0.8} pad={`${u * 0.7}px ${u * 1.3}px`}>
              <span style={{ display: "flex", alignItems: "center", gap: u * 0.7, fontFamily: SANS, fontWeight: 600, fontSize: u * 1.75, color: RAISIN, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.85, height: u * 0.85, background: n.money ? LIME : "transparent", border: `${u * 0.14}px solid ${RAISIN}` }} />
                {n.txt}
              </span>
            </Offset>
          </div>
        );
      })}

      {/* Playfair counterpoint — bottom (no em dash; on-brand copy rule) */}
      {frame >= f(8.0) && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "6%", textAlign: "center", opacity: fade(8.0, 8.6) }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.5, color: RAISIN }}>a file holds one moment. a business is all of them.</span>
        </div>
      )}

      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 ${u * 12}px rgba(15,18,26,0.08)` }} />
      <AbsoluteFill style={{ background: SILVER, opacity: open, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default BrandBoard;
