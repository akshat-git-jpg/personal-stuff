import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export const TestAnim: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "white",
      }}
    >
      <div
        style={{
          width: 200,
          height: 200,
          backgroundColor: "#2563EB",
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
};
