import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import {
  SingleObjectStage, Eyebrow, NumberBadge, clamp, rev,
  LIME, SILVER, SANS, R_INK,
} from "../kit";
import { BgKey } from "../tokens";

export type ProcessFlowProps = {
  eyebrow: string;
  steps: { n: string; label: string }[]; // 2-4 steps, e.g. [{n:"01",label:"CAPTURE"}, ...]
  bg?: BgKey; // default "grid-dark"
};

/* A horizontal numbered process — steps build left-to-right, connected by lime
   bars. A "framed" multi-element layout: gentle push-in keeps ALL steps visible
   (never zoom into one). */
export const ProcessFlow: React.FC<ProcessFlowProps> = ({ eyebrow, steps, bg = "grid-dark" }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <SingleObjectStage bg={bg} stable>
        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          {steps.map((s, i) => {
            const p = rev(frame, 12 + i * 22, 20);
            const connector = i < steps.length - 1 ? rev(frame, 12 + i * 22 + 14, 16) : 0;
            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 24,
                    opacity: clamp(p * 1.5, 0, 1),
                    transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`,
                  }}
                >
                  <NumberBadge n={s.n} size={140} p={p} />
                  <div
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: 36,
                      letterSpacing: "-0.02em",
                      textTransform: "uppercase",
                      color: SILVER,
                      textAlign: "center",
                      maxWidth: 280,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      width: 110,
                      height: 6,
                      background: LIME,
                      transformOrigin: "left center",
                      transform: `scaleX(${connector})`,
                      marginBottom: 60,
                      borderRadius: R_INK,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </SingleObjectStage>
    </>
  );
};
