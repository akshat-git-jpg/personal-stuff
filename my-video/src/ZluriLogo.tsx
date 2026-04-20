import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const ZluriLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    durationInFrames: 30,
    config: {
      damping: 200,
    },
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ transform: `scale(${scale})` }}>ZluriLogo</div>
    </AbsoluteFill>
  );
};
