import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, StatValue, clamp, rev, lerp,
  LIME, STEEL, WHITE, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * runawayMeter — the story of a silently-climbing bill. A leaked key racks up
 * charges day after day: the counter accelerates €0 → total and a row of daily
 * bars stays flat-flat-flat then EXPLODES on the last day. Reads as "it was
 * going fine… until it wasn't." Portrait-native (vertical stack).
 */
export type RunawayMeterProps = {
  total: number;          // e.g. 2500
  currency?: string;      // "€"
  headline?: string;      // top mono line
  footer?: string;        // bottom caption
  days?: number;          // number of daily bars
  bg?: BgKey;
};

// cumulative fraction of the total spent by end of each day — exponential blowup
const CURVE = [0.006, 0.02, 0.05, 0.14, 0.33, 0.62, 1.0];

export const RunawayMeter: React.FC<RunawayMeterProps> = ({
  total, currency = "€", headline = "THE METER KEPT RUNNING",
  footer = "7 DAYS IN JAPAN · I NEVER CHECKED", days = 7, bg,
}) => {
  const frame = useCurrentFrame();
  const p = rev(frame, 10, 68);          // 0..1 over the beat
  const dp = p * days;                    // fractional "day" progress
  const di = Math.floor(dp);
  const frac = dp - di;
  const at = (i: number) => CURVE[clamp(i, 0, CURVE.length - 1)];
  const shownFrac = di <= 0 ? at(0) * frac : lerp(at(di - 1), at(di), frac);
  const shown = Math.round(total * clamp(shownFrac, 0, 1));

  const BARH = 290, BARW = 56, GAP = 24;

  return (
    <SingleObjectStage bg={bg ?? "grid-dark"} stable designW={760} designH={840}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 23, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: LIME }}>
          {headline}
        </div>
        <span style={{ position: "relative", display: "inline-block" }}>
          <span aria-hidden style={{ position: "absolute", inset: -60, background: `radial-gradient(closest-side, ${LIME}33, transparent 72%)`, filter: "blur(10px)" }} />
          <span style={{ position: "relative" }}><StatValue size={200} color={LIME}>{currency}{shown.toLocaleString("en-US")}</StatValue></span>
        </span>
        {/* daily bars — flat, flat, flat, then it explodes */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: GAP, height: BARH, marginTop: 26 }}>
          {CURVE.slice(0, days).map((c, i) => {
            const grow = clamp((dp - i) / 0.6, 0, 1);
            const h = Math.max(0, BARH * c * grow);
            const isLast = i === days - 1;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: BARW, height: BARH, display: "flex", alignItems: "flex-end" }}>
                  <div style={{
                    width: BARW, height: h, borderRadius: 3,
                    background: isLast ? LIME : STEEL,
                    boxShadow: isLast ? `0 0 22px ${LIME}77` : "none",
                    opacity: grow > 0 ? 1 : 0,
                  }} />
                </div>
                <div style={{ fontFamily: MONO, fontSize: 15, color: isLast ? LIME : SILVER_MID, fontWeight: 700 }}>D{i + 1}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 17, color: SILVER_MID, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
          {footer}
        </div>
      </div>
    </SingleObjectStage>
  );
};
