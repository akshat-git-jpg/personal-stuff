// Spotlight overlay: dim the whole frame, leave a rounded-rectangle window
// where the highlighted UI element should show through. Glowing accent ring
// around the cutout for visual emphasis.
//
// Default: centered 900×560 cutout — editor moves and scales the overlay clip
// in the NLE to align with the actual UI element. Optional x/y/width/height
// props let you render a per-shot spotlight when the AI-driven shot list is built.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../design/theme";

export type SpotlightProps = {
  // Cutout rectangle (in 1920x1080 px). Defaults to a centered 900x560 window.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cornerRadius?: number;  // default 24
  dimOpacity?: number;    // default 0.78
};

export const Spotlight: React.FC<SpotlightProps> = ({
  x,
  y,
  width = 900,
  height = 560,
  cornerRadius = 24,
  dimOpacity = 0.78,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Default position: centered in 1920x1080.
  const FRAME_W = 1920;
  const FRAME_H = 1080;
  const finalX = x ?? (FRAME_W - width) / 2;
  const finalY = y ?? (FRAME_H - height) / 2;
  const cx = finalX + width / 2;
  const cy = finalY + height / 2;

  // Entry: dim fades in AND cutout scales from 0.7x → 1x ("spotlight illuminates")
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Exit: fade everything out in last 15f
  const exit = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 1, 1),
    },
  );

  const opacity = Math.min(enter, exit);
  const cutoutScale = 0.7 + enter * 0.3;     // 0.7 → 1.0 during entry
  const w = width * cutoutScale;
  const h = height * cutoutScale;
  const rx = cornerRadius;

  // Subtle glow pulse on the ring during hold
  const glow = (Math.sin(frame * 0.06) + 1) / 2;
  const ringGlow = 16 + glow * 10;

  const maskId = "spotlight-cutout-mask";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <mask id={maskId}>
            {/* white = visible dim, black = hole in the dim */}
            <rect x={0} y={0} width={FRAME_W} height={FRAME_H} fill="white" />
            <rect
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={rx}
              ry={rx}
              fill="black"
            />
          </mask>
        </defs>

        {/* Dim layer with the cutout hole punched in it */}
        <rect
          x={0}
          y={0}
          width={FRAME_W}
          height={FRAME_H}
          fill={`rgba(0, 0, 0, ${dimOpacity})`}
          mask={`url(#${maskId})`}
        />

        {/* Glowing accent ring around the cutout */}
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={rx}
          ry={rx}
          fill="none"
          stroke={colors.accentSolid}
          strokeWidth={2.5}
          style={{
            filter: `drop-shadow(0 0 ${ringGlow}px ${colors.accentGlow})`,
            opacity: 0.85,
          }}
        />
      </svg>
    </AbsoluteFill>
  );
};
