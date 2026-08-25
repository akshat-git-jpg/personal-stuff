import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { clamp, lerp, LIME, STEEL, SILVER_MID, MONO } from "../kit";

export type NoiseGridProps = {
  eyebrow?: string;
  cols?: number;
  rows?: number;
};

// deterministic pseudo-random (no Math.random — must be frame-stable)
const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/* A DENSE flood of tiles = "so much noise" — fills the whole frame fast and
   bright, jitters like static, then DRAINS away to a sparse few lime tiles = the
   signal. Reinforces "ignore the noise, learn what matters". */
export const NoiseGrid: React.FC<NoiseGridProps> = ({ eyebrow = "so much noise", cols = 18, rows = 10 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const N = cols * rows;
  const floodEnd = durationInFrames * 0.26;   // fill the wall FAST so it dominates
  const collapseAt = durationInFrames * 0.62; // then drain to the signal
  // a few survivors (the signal) — fixed indices spread across the grid
  const survivors = new Set([Math.floor(N * 0.3), Math.floor(N * 0.52), Math.floor(N * 0.71)]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0E15" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile("brand/grid-dark.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, width: 1680 }}>
          {Array.from({ length: N }).map((_, i) => {
            const r = rnd(i);
            const appear = clamp(interpolate(frame, [r * floodEnd, r * floodEnd + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);
            const isSurvivor = survivors.has(i);
            // per-tile brightness gives the wall a chaotic "static" texture
            const bright = 0.35 + 0.65 * rnd(i + 99);
            // subtle per-tile flicker — sells "noise", harmless on tiles (not text)
            const flicker = 0.82 + 0.18 * Math.sin(frame * 0.5 + i * 1.7);
            // after collapse, non-survivors drain out
            const collapse = clamp(interpolate(frame, [collapseAt, collapseAt + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);
            const lit = isSurvivor && frame > collapseAt - 2;
            const noiseOp = (0.45 + 0.5 * bright) * flicker * collapse;
            const op = appear * (isSurvivor ? 1 : noiseOp);
            // noise tiles sit between deep steel and silver-mid for texture; survivors go lime
            const noiseCol = `rgb(${lerp(40, 120, bright)},${lerp(50, 135, bright)},${lerp(80, 165, bright)})`;
            const survScale = lit ? 1 + 0.12 * clamp(interpolate(frame, [collapseAt, collapseAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1) : 1;
            return (
              <div
                key={i}
                style={{
                  width: "100%",
                  paddingBottom: "70%",
                  borderRadius: 5,
                  background: lit ? LIME : noiseCol,
                  opacity: op,
                  transform: `scale(${(0.7 + 0.3 * appear) * survScale})`,
                  boxShadow: lit ? "0 0 26px rgba(207,255,5,0.55)" : "none",
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
