import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type ComparisonGridColumn = {
  /** Column header label, e.g. "Manual" / "Routine" / "Static script". */
  label: string;
  /** Mark this column as the "winner" — gets lime header background. */
  winner?: boolean;
  /** When the column header pops in (sec, relative). */
  appear_sec?: number;
};

export type ComparisonCellValue = boolean | string;

export type ComparisonGridRow = {
  /** Row label (the feature/dimension being compared). */
  feature: string;
  /** One value per column in the same order as `columns`. Booleans render as
   *  ✓ (true, lime) / ✗ (false, raisin); strings render verbatim. */
  values: ComparisonCellValue[];
  /** When the row reveals (sec, relative). */
  appear_sec?: number;
};

export type ComparisonGridProps = {
  /** Optional title at top. */
  title?: string;
  /** 2–4 columns. */
  columns: ComparisonGridColumn[];
  /** 2–6 feature rows. */
  rows: ComparisonGridRow[];
};

const MAX_COLS = 4;
const MAX_ROWS = 6;

/**
 * Multi-column feature comparison grid. Goes beyond `vs_split` (which only
 * handles 2 sides) — use when the speaker compares 3 or 4 options on the
 * same set of features.
 *
 *   |               | Manual | Static script | Routine ⭐ |
 *   |---------------|--------|---------------|-----------|
 *   | Repeats?      |   ✓    |       ✓        |     ✓      |
 *   | Adapts?       |   ✗    |       ✗        |     ✓      |
 *   | Maintenance   | high   |    medium      |    low     |
 *
 * Reveal sequence:
 *   1. Headers fade in left-to-right
 *   2. Each row fades in from top to bottom at its `appear_sec`
 *   3. Winner column has a lime header that subtly pulses
 *
 * Hard rules:
 *  - Cells use tabular layout (CSS grid) so columns line up perfectly
 *  - Boolean cells render ✓ (lime, on light circle) or ✗ (raisin, on grey)
 *  - String cells truncate to 2 lines max
 *  - Single neo-lime accent: only the winner column header + ✓ icons use lime
 */
export const ComparisonGrid: React.FC<ComparisonGridProps> = ({ title, columns, rows }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const cols = columns.slice(0, MAX_COLS);
  const rs = rows.slice(0, MAX_ROWS);
  const nCols = cols.length;
  const nRows = rs.length;

  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * 0.06);
  const padY = Math.round(height * (title ? 0.20 : 0.10));
  const padBottom = Math.round(height * 0.10);
  const tableW = width - padX * 2;
  const tableH = height - padY - padBottom;

  // Column widths: feature column gets ~28%, rest split equally
  const featureColW = Math.round(tableW * 0.30);
  const dataColW = Math.round((tableW - featureColW) / Math.max(1, nCols));

  // Row heights: header gets a fixed ratio, rest split equally
  const headerH = Math.min(Math.round(typeBase * 0.110), Math.round(tableH * 0.18));
  const rowH = Math.floor((tableH - headerH) / Math.max(1, nRows));

  const titleSize = Math.round(typeBase * 0.046);
  const headerSize = Math.round(typeBase * 0.030);
  const featureSize = Math.round(typeBase * 0.026);
  const cellSize = Math.round(typeBase * 0.030);
  const checkChip = Math.round(typeBase * 0.038);

  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.55;
  const headerStaggerEnd = totalSec * 0.20;

  const titleEnter = spring({ frame, fps, durationInFrames: 14, config: { damping: 18, stiffness: 130, mass: 0.65 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <LightGridBg />

      {title && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: titleBarHeight,
          backgroundColor: "#0F121A",
          borderBottom: "3px solid #CFFF05",
          paddingLeft: Math.round(width * 0.05),
          paddingRight: Math.round(width * 0.05),
          display: "flex",
          alignItems: "center",
          fontFamily,
          fontWeight: 700,
          fontSize: titleSize,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#FFFFFF",
          opacity: titleEnter,
          transform: `translateY(${interpolate(titleEnter, [0, 1], [-12, 0])}px)`,
          boxShadow: `0 ${Math.round(typeBase * 0.012)}px ${Math.round(typeBase * 0.026)}px rgba(15,18,26,0.20)`,
        }}>
          <span style={{ color: "#CFFF05", marginRight: Math.round(typeBase * 0.018) }}>━</span>
          {title}
        </div>
      )}

      <div style={{
        position: "absolute",
        left: padX,
        top: padY,
        width: tableW,
        height: tableH,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        border: "2px solid #0F121A",
        borderRadius: Math.round(typeBase * 0.014),
        overflow: "hidden",
        boxShadow: `0 ${Math.round(typeBase * 0.010)}px ${Math.round(typeBase * 0.026)}px rgba(15,18,26,0.10)`,
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${featureColW}px repeat(${nCols}, ${dataColW}px)`,
          height: headerH,
          flexShrink: 0,
          borderBottom: "2px solid #0F121A",
        }}>
          {/* Empty top-left corner */}
          <div style={{
            backgroundColor: "#E9ECED",
            borderRight: "1px solid rgba(15,18,26,0.10)",
          }} />
          {cols.map((col, ci) => {
            const colFrame = typeof col.appear_sec === "number"
              ? Math.round(col.appear_sec * fps)
              : Math.round(((headerStaggerEnd / Math.max(1, nCols)) * ci) * fps);
            const en = spring({
              frame: frame - colFrame,
              fps,
              durationInFrames: Math.round(fps * 0.40),
              config: { damping: 16, stiffness: 130, mass: 0.65 },
            });
            return (
              <div key={ci} style={{
                backgroundColor: col.winner ? "#CFFF05" : "#0F121A",
                color: col.winner ? "#0F121A" : "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily,
                fontWeight: 700,
                fontSize: headerSize,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderRight: ci < nCols - 1 ? "1px solid rgba(255,255,255,0.10)" : "none",
                opacity: en,
                transform: `translateY(${interpolate(en, [0, 1], [-10, 0])}px)`,
                padding: `0 ${Math.round(typeBase * 0.010)}px`,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {col.label}
              </div>
            );
          })}
        </div>

        {/* Data rows */}
        {rs.map((row, ri) => {
          const rowFrame = typeof row.appear_sec === "number"
            ? Math.round(row.appear_sec * fps)
            : Math.round((headerStaggerEnd + (span - headerStaggerEnd) * (ri / Math.max(1, nRows))) * fps);
          const en = spring({
            frame: frame - rowFrame,
            fps,
            durationInFrames: Math.round(fps * 0.45),
            config: { damping: 16, stiffness: 130, mass: 0.65 },
          });
          const visible = frame >= rowFrame;
          return (
            <div key={ri} style={{
              // Pre-allocate row slot so previously-revealed rows don't
              // shift when later rows reveal.
              display: "grid",
              visibility: visible ? "visible" : "hidden",
              gridTemplateColumns: `${featureColW}px repeat(${nCols}, ${dataColW}px)`,
              height: rowH,
              borderBottom: ri < nRows - 1 ? "1px solid rgba(15,18,26,0.10)" : "none",
              opacity: en,
              transform: `translateX(${interpolate(en, [0, 1], [-16, 0])}px)`,
            }}>
              {/* Feature label cell */}
              <div style={{
                display: "flex",
                alignItems: "center",
                paddingLeft: Math.round(typeBase * 0.018),
                paddingRight: Math.round(typeBase * 0.014),
                fontFamily,
                fontWeight: 700,
                fontSize: featureSize,
                color: "#0F121A",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                backgroundColor: "#F5F7F8",
                borderRight: "1px solid rgba(15,18,26,0.10)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {row.feature}
              </div>
              {/* Cell values */}
              {cols.map((col, ci) => {
                const v = row.values[ci];
                const isBool = typeof v === "boolean";
                return (
                  <div key={ci} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: `0 ${Math.round(typeBase * 0.010)}px`,
                    fontFamily,
                    fontWeight: 700,
                    fontSize: cellSize,
                    color: "#0F121A",
                    borderRight: ci < nCols - 1 ? "1px solid rgba(15,18,26,0.06)" : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: isBool ? "nowrap" : "normal",
                    textAlign: "center",
                    lineHeight: 1.20,
                  }}>
                    {isBool ? (
                      <div style={{
                        width: checkChip,
                        height: checkChip,
                        borderRadius: "50%",
                        backgroundColor: v ? "#CFFF05" : "#E9ECED",
                        color: v ? "#0F121A" : "#5A6275",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: Math.round(checkChip * 0.55),
                      }}>
                        {v ? "✓" : "✗"}
                      </div>
                    ) : (
                      <span style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        wordBreak: "normal",
                        overflowWrap: "break-word",
                        hyphens: "manual",
                      }}>
                        {v as string}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
