import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev,
  RAISIN_DEEP, STEEL, LIME, WHITE, SILVER_MID, SANS, MONO, R_SURFACE,
} from "../kit";
import { BgKey } from "../tokens";

export type LayerStackProps = {
  eyebrow: string;
  layers: { tag: string; name: string; sub: string }[]; // top to bottom, e.g. [{tag:"04",name:"INTERFACE",sub:"what you see"}, ...]
  bg?: BgKey; // default "grid-dark"
};

export const LayerStack: React.FC<LayerStackProps> = ({ eyebrow, layers, bg }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  // The stage owns the camera (orbit-up). Here we only add the per-layer rotateY
  // swing for life — the inner plane rotates around as the stack builds upward.
  const ry = interpolate(frame, [0, durationInFrames], [-34, -8], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="orbit-up">
        <div style={{ perspective: 1800 }}>
          <div
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(16deg) rotateY(${ry}deg)`,
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            {layers.map((l, i) => {
              // build bottom-up: the last layer (the base) springs in first
              const order = layers.length - 1 - i;
              const s = spring({ frame: frame - (10 + order * 14), fps, config: { damping: 16, stiffness: 140 } });
              return (
                <div
                  key={i}
                  style={{
                    width: 760,
                    transform: `translateZ(${interpolate(s, [0, 1], [-160, 0])}px) translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
                    opacity: clamp(s, 0, 1),
                    background: RAISIN_DEEP,
                    border: `1px solid ${STEEL}`,
                    borderLeft: `8px solid ${LIME}`,
                    borderRadius: R_SURFACE,
                    boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8)",
                    padding: "26px 36px",
                    display: "flex",
                    alignItems: "center",
                    gap: 28,
                  }}
                >
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 44, color: LIME }}>{l.tag}</span>
                  <div>
                    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, letterSpacing: "-0.02em", color: WHITE, textTransform: "uppercase" }}>
                      {l.name}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 18, color: SILVER_MID }}>{l.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};
