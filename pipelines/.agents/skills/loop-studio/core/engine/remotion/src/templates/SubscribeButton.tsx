import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * SUBSCRIBE — an animated subscribe-CTA button.
 *
 * A cardless-friendly partial overlay (speaker stays visible). Choreography:
 *   0.0–0.35s  button pops in   — lime pill, raisin "SUBSCRIBE"
 *   0.35–1.05s cursor slides in from the lower-right toward the button
 *   1.05–1.25s CLICK            — button depresses, a lime spark ring bursts
 *   1.25s+     morph            — button → raisin fill + lime border,
 *                                 text "SUBSCRIBED", a bell appears + wiggles
 *   last 0.3s  fades out
 *
 * On-brand: neo-lime + raisin black, Space Grotesk. Not a takeover — sits in
 * the lower third so the speaker keeps the frame.
 */
export type SubscribeButtonProps = {
  /** Vertical anchor 0..1. Default 0.80 — lower third. */
  vertical?: number;
};

const BLOCK = "'Space Grotesk', system-ui, sans-serif";
const LIME = "#CFFF05";
const RAISIN = "#0F121A";

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({ vertical }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  const F = (s: number) => Math.round(s * fps);

  // ---- button pop-in ------------------------------------------------------
  const popIn = spring({
    frame, fps, durationInFrames: F(0.4),
    config: { damping: 14, stiffness: 150, mass: 0.7 },
  });

  // ---- click timing -------------------------------------------------------
  const clickF = F(1.1);
  const clicked = frame >= clickF;
  // depress dip around the click
  const depress = interpolate(
    frame, [clickF - 3, clickF, clickF + 5], [1, 0.92, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // morph subscribe -> subscribed (cross-fade)
  const morph = interpolate(frame, [clickF + 2, clickF + 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ---- cursor path: off lower-right -> button centre ----------------------
  const cursorProg = interpolate(frame, [F(0.35), clickF], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t), // smoothstep
  });

  // ---- bell wiggle after morph -------------------------------------------
  const bellWiggle = clicked
    ? Math.sin((frame - clickF) * 0.6) *
      interpolate(frame, [clickF + 8, clickF + 28], [10, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;

  // ---- exit ---------------------------------------------------------------
  const exitStart = durationInFrames - F(0.3);
  const exitP = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const groupOpacity = popIn * (1 - exitP);

  // ---- geometry -----------------------------------------------------------
  const btnH = Math.round(typeBase * 0.115);
  const fontSize = Math.round(typeBase * 0.045);
  const padX = Math.round(btnH * 0.62);
  const radius = btnH / 2;
  const topClamped = Math.max(0, Math.min(0.92, vertical ?? 0.80));
  const topPct = topClamped * 100;
  // CSS % padding resolves against WIDTH — on a landscape frame `${pct}%`
  // shoots the button off the bottom. Use height-relative px on landscape
  // (same fix as hook_title / WordPop, rule 4cc).
  const isLandscape = width > height;
  const topPx = topClamped * height;
  const shadow = "0 10px 36px rgba(0,0,0,0.55)";

  // spark ring on click
  const SPARKS = 9;
  const sparkAge = frame - clickF;
  const sparkActive = sparkAge >= 0 && sparkAge <= F(0.5);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: isLandscape ? topPx : `${topPct}%`,
      }}>
        <div style={{
          position: "relative",
          opacity: groupOpacity,
          transform: `scale(${interpolate(popIn, [0, 1], [0.6, 1]) * depress})`,
          transformOrigin: "center",
        }}>
          {/* spark ring */}
          {sparkActive && Array.from({ length: SPARKS }).map((_, i) => {
            const ang = (i / SPARKS) * Math.PI * 2;
            const k = interpolate(sparkAge, [0, F(0.5)], [0, 1],
              { extrapolateRight: "clamp" });
            const dist = k * btnH * 1.4;
            const d = Math.round(btnH * 0.13);
            return (
              <div key={i} style={{
                position: "absolute",
                left: "50%", top: "50%",
                width: d, height: d, borderRadius: d,
                backgroundColor: LIME,
                opacity: 1 - k,
                transform: `translate(-50%,-50%) translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`,
              }} />
            );
          })}

          {/* button — SUBSCRIBE state */}
          <div style={{
            position: "relative",
            height: btnH,
            display: "flex",
            alignItems: "center",
            gap: btnH * 0.22,
            padding: `0 ${padX}px`,
            borderRadius: radius,
            fontFamily: BLOCK,
            fontWeight: 800,
            fontSize,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            boxShadow: shadow,
            // cross-fade fill: lime -> raisin
            backgroundColor: morph > 0.5 ? RAISIN : LIME,
            border: `${Math.max(2, Math.round(typeBase*0.004))}px solid ${LIME}`,
            color: morph > 0.5 ? LIME : RAISIN,
          }}>
            {morph < 0.5 ? (
              <>
                <span style={{
                  width: 0, height: 0,
                  borderTop: `${fontSize*0.34}px solid transparent`,
                  borderBottom: `${fontSize*0.34}px solid transparent`,
                  borderLeft: `${fontSize*0.55}px solid ${RAISIN}`,
                }} />
                <span>SUBSCRIBE</span>
              </>
            ) : (
              <>
                <span style={{
                  display: "inline-block",
                  fontSize: fontSize * 1.05,
                  transform: `rotate(${bellWiggle}deg)`,
                  transformOrigin: "50% 15%",
                }}>🔔</span>
                <span>SUBSCRIBED</span>
              </>
            )}
          </div>

          {/* cursor */}
          {cursorProg > 0 && cursorProg < 1.0 + 0 && (
            <div style={{
              position: "absolute",
              left: interpolate(cursorProg, [0, 1], [width * 0.34, btnH * 0.1]),
              top: interpolate(cursorProg, [0, 1], [btnH * 2.2, btnH * 0.52]),
              opacity: clicked ? interpolate(frame, [clickF, clickF + F(0.4)], [1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1,
              transform: `scale(${frame >= clickF - 2 && frame <= clickF + 3 ? 0.82 : 1})`,
            }}>
              <svg width={typeBase * 0.07} height={typeBase * 0.07} viewBox="0 0 24 24">
                <path
                  d="M3 2 L3 20 L8 15 L11 22 L14 21 L11 14 L18 14 Z"
                  fill="#FFFFFF"
                  stroke={RAISIN}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
