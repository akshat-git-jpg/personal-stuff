import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { clamp, lerp, MONO, LIME } from "../kit";
import { BgKey } from "../tokens";

export type ScreenshotFlyInProps = {
  images: string[];   // staticFile paths, 1-3 real screenshots
  eyebrow?: string;
  bg?: BgKey;         // default "grid-light"
  cardW?: number;     // card width px (default 820)
};

const EZ = Easing.out(Easing.cubic);
// scattered fly-in layout — alternate sides, settle overlapping + tilted (frame-11 look)
const LAYOUT = [
  { from: { x: -1100, y: 520, r: -22 }, to: { x: -210, y: -36, r: -7 } },
  { from: { x: 1200, y: -560, r: 24 }, to: { x: 230, y: 70, r: 7 } },
  { from: { x: 0, y: 1100, r: 8 }, to: { x: 20, y: 200, r: -3 } },
];
const posAt = (f: number, L: { from: any; to: any }, start: number, dur: number) => {
  const p = interpolate(f, [start, start + dur], [0, 1], { easing: EZ, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { x: lerp(L.from.x, L.to.x, p), y: lerp(L.from.y, L.to.y, p), r: lerp(L.from.r, L.to.r, p) };
};

export const ScreenshotFlyIn: React.FC<ScreenshotFlyInProps> = ({ images, eyebrow, bg = "grid-light", cardW = 820 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#E9ECED" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile(`brand/${bg}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {images.slice(0, 3).map((src, i) => {
          const L = LAYOUT[i] || LAYOUT[0];
          const start = 5 + i * 9;
          const cur = posAt(frame, L, start, 18);
          const prev = posAt(frame - 1, L, start, 18);
          const blur = clamp(Math.hypot(cur.x - prev.x, cur.y - prev.y) * 0.55, 0, 26);
          const op = clamp(interpolate(frame, [start, start + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                transform: `translate(${cur.x}px, ${cur.y}px) rotate(${cur.r}deg)`,
                filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                opacity: op,
                zIndex: i,
              }}
            >
              <div style={{ width: cardW, borderRadius: 16, overflow: "hidden", boxShadow: "0 44px 90px -22px rgba(15,18,26,0.55)", border: "3px solid #FFFFFF" }}>
                <Img src={staticFile(src)} style={{ width: cardW, display: "block" }} />
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
