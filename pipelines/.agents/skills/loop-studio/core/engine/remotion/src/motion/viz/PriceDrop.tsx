import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, clamp, rev, impact, Flash,
  LIME, STEEL, WHITE, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * priceDrop — a "from" price falls away and a lime "to" price rises in, with a
 * down arrow. Concept: "$2,000/mo editor → $0."
 */
export type PriceDropProps = {
  eyebrow: string;
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  bg?: BgKey;
};

export const PriceDrop: React.FC<PriceDropProps> = ({ eyebrow, from, to, fromLabel, toLabel, bg }) => {
  const frame = useCurrentFrame();
  const drop = rev(frame, 34, 20);
  const rise = rev(frame, 46, 18);
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in" designW={560} designH={440}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {/* from */}
          <div style={{ textAlign: "center", opacity: 1 - drop * 0.85, transform: `translateY(${drop * 60}px) scale(${1 - drop * 0.12})` }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 116, color: SILVER_MID, letterSpacing: "-0.03em" }}>{from}</span>
              <div style={{ position: "absolute", left: -6, top: "52%", height: 7, width: `calc(${rev(frame, 20, 12) * 100}% + 12px)`, background: STEEL, transform: "translateY(-50%) rotate(-2deg)", borderRadius: 4 }} />
            </div>
            {fromLabel && <div style={{ fontFamily: MONO, fontSize: 20, color: SILVER_MID, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{fromLabel}</div>}
          </div>
          {/* arrow */}
          <div style={{ fontSize: 52, color: LIME, opacity: clamp(drop * 2, 0, 1), lineHeight: 1 }}>↓</div>
          {/* to */}
          <div style={{ textAlign: "center", opacity: rise, transform: `translateY(${(1 - rise) * 40}px) scale(${(0.9 + rise * 0.1) * impact(frame, 64, 0.14, 8)})` }}>
            <span style={{ position: "relative", display: "inline-block" }}>
              <span aria-hidden style={{ position: "absolute", inset: -70, background: `radial-gradient(closest-side, ${LIME}44, transparent 70%)`, filter: "blur(8px)", opacity: rise }} />
              <span style={{ position: "relative", fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 150, color: LIME, letterSpacing: "-0.03em" }}>{to}</span>
            </span>
            {toLabel && <div style={{ fontFamily: MONO, fontSize: 22, color: WHITE, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{toLabel}</div>}
          </div>
        </div>
      </SingleObjectStage>
      <Flash hit={64} len={12} peak={0.32} />
    </>
  );
};
