import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Tilt, rev,
  LIME, SILVER, SILVER_SOFT, BODY, MONO, SERIF,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * sourceHeadline — a newspaper / publication headline mockup, tilted in 3D, with
 * ONE phrase highlighted (lime, wipes in). The "receipt" device: cite a real
 * claim ("SaaS is dead", "killed the agency", a Boris quote) as authority.
 * Inspired by the newspaper reference; on System-v1 (cream paper, lime highlight).
 */
export type SourceHeadlineProps = {
  publication: string;
  date?: string;
  section?: string;
  headline: string;
  highlight?: string;   // a substring of `headline` to highlight
  dek?: string;
  byline?: string;
  bg?: BgKey;
};

const CREAM = "#F7F5EF";
const INK = "#17181C";
const W = 1380;

const Bars: React.FC<{ n: number; widths?: number[] }> = ({ n, widths }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} style={{ height: 9, borderRadius: 3, background: SILVER_SOFT, width: `${(widths && widths[i]) ?? (88 - (i % 3) * 9)}%` }} />
    ))}
  </div>
);

export const SourceHeadline: React.FC<SourceHeadlineProps> = ({
  publication, date = "", section = "ANALYSIS", headline, highlight, dek, byline, bg,
}) => {
  const frame = useCurrentFrame();
  const hi = rev(frame, 30, 12); // highlighter wipe

  let pre = headline, mark = "", post = "";
  if (highlight && headline.includes(highlight)) {
    const idx = headline.indexOf(highlight);
    pre = headline.slice(0, idx);
    mark = highlight;
    post = headline.slice(idx + highlight.length);
  }

  return (
    <SingleObjectStage bg={bg ?? "grid-light"} move="push-in">
      <Tilt ry={-6} rx={3}>
        <div style={{ width: W, background: CREAM, padding: "46px 56px 52px", boxShadow: "0 30px 80px -28px rgba(15,18,26,.45)", color: INK }}>
          {/* masthead */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", color: "#6b6b66", lineHeight: 1.5 }}>EST. 1865<br />SINCE 1865</div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 78, letterSpacing: "-0.01em" }}>{publication}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.06em", color: "#6b6b66", textAlign: "right", lineHeight: 1.5 }}>{date}</div>
          </div>
          <div style={{ height: 3, background: INK }} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 22px", borderBottom: `1px solid ${SILVER}`, fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em", color: "#4a4a46" }}>
            <span>{section}</span><span style={{ fontStyle: "italic", fontFamily: SERIF }}>Comment</span>
          </div>
          {/* headline */}
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 72, lineHeight: 1.05, letterSpacing: "-0.01em", textAlign: "center", padding: "30px 20px 18px" }}>
            {pre}
            {mark && (
              <span style={{ position: "relative", display: "inline-block", whiteSpace: "pre" }}>
                <span aria-hidden style={{ position: "absolute", left: -6, right: -6, top: "12%", bottom: "8%", background: LIME, transform: `scaleX(${hi})`, transformOrigin: "left", borderRadius: 3, zIndex: 0 }} />
                <span style={{ position: "relative", zIndex: 1 }}>{mark}</span>
              </span>
            )}
            {post}
          </div>
          {dek && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, textAlign: "center", color: "#3a3a36", marginBottom: 12 }}>{dek}</div>}
          {byline && <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textAlign: "center", color: "#6b6b66", marginBottom: 24 }}>{byline.toUpperCase()}</div>}
          <div style={{ height: 1, background: SILVER, marginBottom: 26 }} />
          {/* faux body columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40 }}>
            <Bars n={8} />
            <Bars n={8} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ height: 120, background: "#2a2b30", borderRadius: 2 }} />
              <Bars n={4} />
            </div>
          </div>
        </div>
      </Tilt>
    </SingleObjectStage>
  );
};
