import { AbsoluteFill, useVideoConfig } from "remotion";

/**
 * Reusable on-brand backgrounds. Both share the subtle grid pattern from the
 * long-form videos. The light variant is for light-content templates (title
 * cards, timelines, comparisons). The dark variant is for highlight callouts
 * and AI-image hosts.
 */

// Cloudy mask — the grid should NOT read as a uniform pattern. Layered soft
// radial blobs let the grid be crisp in patches and degrade / fade out
// elsewhere, so it feels like a texture drifting under the content rather
// than graph paper. Multiple comma-separated mask images union together.
const CLOUD_MASK = [
  "radial-gradient(ellipse 52% 38% at 22% 18%, #000 0%, rgba(0,0,0,0.35) 45%, transparent 78%)",
  "radial-gradient(ellipse 48% 34% at 80% 40%, #000 0%, rgba(0,0,0,0.4) 42%, transparent 76%)",
  "radial-gradient(ellipse 58% 42% at 38% 72%, #000 0%, rgba(0,0,0,0.3) 48%, transparent 80%)",
  "radial-gradient(ellipse 40% 30% at 88% 88%, #000 0%, transparent 72%)",
].join(", ");

const Grid: React.FC<{ stroke: string; alpha: number; cellPx?: number; strokeWidth?: number }> = ({
  stroke,
  alpha,
  cellPx,
  strokeWidth,
}) => {
  const { width, height } = useVideoConfig();
  // ~12 cells across — large enough to read, small enough to feel like a grid
  const cell = cellPx ?? Math.round(width / 12);
  const sw = strokeWidth ?? Math.max(2, Math.round(width / 600));
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute",
        inset: 0,
        opacity: alpha,
        pointerEvents: "none",
        // cloudy degrade — grid fades in/out across the frame, not uniform
        maskImage: CLOUD_MASK,
        WebkitMaskImage: CLOUD_MASK,
      }}
    >
      <defs>
        <pattern id="grid" width={cell} height={cell} patternUnits="userSpaceOnUse">
          <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke={stroke} strokeWidth={sw} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
};

// 2026-05-27 — was a literal silver/white gradient that read as "PowerPoint
// template" on every template that used it (MetricReveal, TitleCard,
// VerticalTimeline, ProgressSteps, StatGrid, OrgDiagram, ComparisonGrid,
// KeywordChips, top half of VsSplit). Renamed-in-spirit to "Mid Raisin" —
// still a DARK on-brand surface, just slightly lifted from DarkGridBg
// (#0F121A→#1E2434) so VsSplit's two halves still register as a contrast
// pair (mid raisin top / blue raisin bottom). Lime grid replaces the
// dark-on-light grid that was reading as graph paper.
export const LightGridBg: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(180deg, #1E2434 0%, #2A334A 100%)",
    }}
  >
    <Grid stroke="#CFFF05" alpha={0.10} />
  </AbsoluteFill>
);

export const DarkGridBg: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(180deg, #0F121A 0%, #1E2434 100%)",
    }}
  >
    <Grid stroke="#CFFF05" alpha={0.14} />
  </AbsoluteFill>
);

/**
 * Blue/raisin variant — uses the secondary brand colors (#1E2434, #343E5B).
 * Pairs with LightGridBg for VS-split contrast: light = stale "old way",
 * blue = the recommended "new way."
 */
export const BlueGridBg: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(180deg, #1E2434 0%, #343E5B 100%)",
    }}
  >
    <Grid stroke="#CFFF05" alpha={0.16} />
  </AbsoluteFill>
);
