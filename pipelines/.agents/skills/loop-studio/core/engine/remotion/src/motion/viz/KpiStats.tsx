import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  SingleObjectStage, Tilt, Eyebrow, Offset, StatValue, clamp, rev,
  WHITE, SILVER_SOFT, LIME, RAISIN, BODY, MONO, R_SURFACE,
} from "../kit";
import { SHADOW_CARD } from "../tokens";
import { BgKey } from "../tokens";

export type KpiStatsProps = {
  eyebrow: string;
  stats: { value: number; prefix?: string; suffix?: string; label: string }[]; // 2-4
  bg?: BgKey; // default "grid-dark"
};

export const KpiStats: React.FC<KpiStatsProps> = ({ eyebrow, stats, bg }) => {
  const frame = useCurrentFrame();
  const ry = -5; // CONSTANT tilt — animated tilt jitters text. Fixed angle = stable.

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} stable>
        <Tilt ry={ry} rx={4}>
          <Offset color={LIME} dx={14} dy={14} radius={R_SURFACE} p={rev(frame, 6, 22)}>
            <div
              style={{
                background: WHITE,
                border: `1px solid ${SILVER_SOFT}`,
                borderRadius: R_SURFACE,
                boxShadow: SHADOW_CARD,
                padding: "56px 70px",
                display: "flex",
                gap: 80,
              }}
            >
              {stats.map((stat, i) => {
                const cp = rev(frame, 14 + i * 12, 54);
                const shown = Math.round(stat.value * cp);
                return (
                  <div
                    key={i}
                    style={{
                      opacity: clamp(cp * 1.5, 0, 1),
                      transform: `translateY(${interpolate(cp, [0, 1], [24, 0])}px)`,
                    }}
                  >
                    {/* Reserve the FINAL value's width with a hidden sizer so the
                        card never reflows as the counter ticks up. The live value
                        is absolutely positioned over the sizer. */}
                    <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
                      <span style={{ visibility: "hidden" }}>
                        <StatValue size={88} color={RAISIN}>
                          {stat.prefix ?? ""}{stat.value.toLocaleString("en-US")}{stat.suffix ?? ""}
                        </StatValue>
                      </span>
                      <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>
                        <StatValue size={88} color={RAISIN}>
                          {stat.prefix ?? ""}{shown.toLocaleString("en-US")}{stat.suffix ?? ""}
                        </StatValue>
                      </span>
                    </span>
                    <div style={{ fontFamily: MONO, fontSize: 22, color: BODY, marginTop: 10 }}>{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </Offset>
        </Tilt>
      </SingleObjectStage>
    </>
  );
};
