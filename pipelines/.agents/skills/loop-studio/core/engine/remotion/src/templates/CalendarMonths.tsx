import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  useTypeBase,
  useChoreographedExit,
  useLivingHold,
  ENTRANCE_EASE,
} from "./motion";

export type CalendarMonthsProps = {
  /** How many trailing months to show, ending on the current month. Default 9. */
  count?: number;
  /** Big hero line. Defaults to "{count} MONTHS". */
  title?: string;
  /** Supporting caption beneath the hero line. */
  caption?: string;
  /** Beat start (absolute sec) — accepted for API parity; choreography runs
   *  off the local Sequence frame. */
  startSec?: number;
};

const FONT = "Space Grotesk, system-ui, sans-serif";
const LIME = "#CFFF05";
const LIME_DEEP = "#AEDC00";

const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

type MonthInfo = {
  label: string;     // "SEP '25"
  days: number;      // days in month
  firstDow: number;  // 0=Sun … 6=Sat
};

/** Build the last `count` months ending on the current month. */
function trailingMonths(count: number): MonthInfo[] {
  const now = new Date();
  const out: MonthInfo[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    out.push({
      label: `${MONTH_ABBR[m]} '${String(y).slice(2)}`,
      days,
      firstDow,
    });
  }
  return out;
}

/**
 * CalendarMonths — a literal calendar visual of the last N months.
 *
 * The number "9 MONTHS" is a credibility claim ("I've been spending nine
 * months…"). Instead of a lone giant number on a card, this SHOWS the nine
 * months as nine real mini-calendars in a 3×3 grid. Each month's day-cells
 * fill with lime in sequence, left-to-right top-to-bottom, so the viewer
 * watches nine months of work accumulate. The grid of nine calendars *is* the
 * number — far more concrete than a digit.
 *
 * Choreography (local sec, 0 = beat start):
 *   0.00       hero line + caption fade-rise; all month frames present, dim
 *   0.30→      months fill lime one-by-one across ~75% of the beat
 *   per month  the day-cells wipe-fill quickly (≈0.4s) as that month activates
 *   last 0.5s  whole canvas dissolves forward
 */
export const CalendarMonths: React.FC<CalendarMonthsProps> = ({
  count = 9,
  title,
  caption,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const t = frame / fps;

  const N = Math.max(1, Math.min(12, count));
  const months = trailingMonths(N);
  const cols = N <= 4 ? N : Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);

  // Group life + exit.
  const EXIT_DUR = 0.5;
  const exit = useChoreographedExit(Math.max(0, durationInFrames / fps - EXIT_DUR), EXIT_DUR);
  const hold = useLivingHold(6, 1.01, -4);

  // Header entrance.
  const headIn = spring({
    frame, fps, durationInFrames: Math.round(0.5 * fps),
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });

  // Fill timeline: months activate sequentially across FILL_SPAN.
  const FILL_LEAD = 0.3;
  const FILL_SPAN = (durationInFrames / fps) * 0.72;
  const perMonth = FILL_SPAN / N;

  const heroText = title ?? `${N} MONTHS`;

  // Layout budget. Header strip on top, calendar grid fills the rest.
  const padX = width * 0.07;
  const headerH = height * 0.26;
  const gridTop = headerH;
  const gridH = height - headerH - height * 0.06;
  const gridW = width - padX * 2;
  const cellGap = width * 0.018;
  const calW = (gridW - cellGap * (cols - 1)) / cols;
  const calH = (gridH - cellGap * (rows - 1)) / rows;

  return (
    <AbsoluteFill>
      {/* Light SILVER brand stage (matches CommandDeck / LayerStack) — the blue
          month cards + lime fill read with strong contrast on it. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 130% at 50% 24%, #EEF1F2 0%, #D2D8DA 55%, #B7C0C3 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,18,26,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,18,26,0.05) 1px, transparent 1px)",
          backgroundSize: `${Math.round(width * 0.035)}px ${Math.round(width * 0.035)}px`,
          maskImage:
            "radial-gradient(ellipse 82% 80% at 50% 50%, #000 42%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 82% 80% at 50% 50%, #000 42%, transparent 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: exit.opacity,
          filter: exit.blur > 0.05 ? `blur(${exit.blur}px)` : undefined,
          transform: `translateY(${hold.ty + exit.ty}px) scale(${hold.scale * exit.scale})`,
        }}
      >
        {/* Header — hero count + caption */}
        <div
          style={{
            position: "absolute",
            top: height * 0.05,
            left: padX,
            width: gridW,
            opacity: headIn,
            transform: `translateY(${interpolate(headIn, [0, 1], [16, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: Math.round(typeBase * 0.11),
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              color: "#16203A",
            }}
          >
            {heroText}
          </div>
          {caption && (
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: Math.round(typeBase * 0.038),
                color: "#46506A",
                marginTop: height * 0.018,
              }}
            >
              {caption}
            </div>
          )}
        </div>

        {/* Calendar grid */}
        {months.map((mo, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = padX + col * (calW + cellGap);
          const y = gridTop + row * (calH + cellGap);

          const activeAt = FILL_LEAD + i * perMonth;
          const monthActive = t >= activeAt;
          // Month-card lift when it becomes active.
          const cardK = interpolate(t, [activeAt, activeAt + 0.35], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ENTRANCE_EASE,
          });

          // Day grid geometry inside the card.
          const labelH = calH * 0.26;
          const dayAreaTop = labelH;
          const dayAreaH = calH - labelH - calH * 0.06;
          const dayCols = 7;
          const totalCells = mo.firstDow + mo.days;
          const dayRows = Math.ceil(totalCells / dayCols);
          const dGap = calW * 0.035;
          const cellW = (calW * 0.88 - dGap * (dayCols - 1)) / dayCols;
          const cellH = Math.min(cellW, (dayAreaH - dGap * (dayRows - 1)) / dayRows);
          const dayAreaW = cellW * dayCols + dGap * (dayCols - 1);
          const dayLeft = (calW - dayAreaW) / 2;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: calW,
                height: calH,
                borderRadius: Math.round(calW * 0.06),
                // Always a BLUE card; activation turns the border lime + adds a
                // soft lime glow, while the day-cells fill lime inside it.
                background: "linear-gradient(180deg, #3C4B6E 0%, #2A3650 100%)",
                border: `1.5px solid ${monthActive ? LIME_DEEP : "rgba(255,255,255,0.12)"}`,
                boxShadow: monthActive
                  ? `0 0 ${calW * 0.06}px rgba(174,220,0,0.32), 0 ${calH * 0.02}px ${calH * 0.06}px rgba(20,27,38,0.28)`
                  : `0 ${calH * 0.02}px ${calH * 0.06}px rgba(20,27,38,0.22)`,
                overflow: "hidden",
                transform: `scale(${0.97 + 0.03 * cardK})`,
              }}
            >
              {/* Month label */}
              <div
                style={{
                  position: "absolute",
                  top: labelH * 0.18,
                  left: dayLeft,
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: Math.round(calH * 0.14),
                  letterSpacing: "0.04em",
                  color: monthActive ? LIME : "#C6D0E2",
                }}
              >
                {mo.label}
              </div>

              {/* Day cells */}
              {Array.from({ length: mo.days }).map((_, d) => {
                const cellIdx = mo.firstDow + d;
                const cc = cellIdx % dayCols;
                const cr = Math.floor(cellIdx / dayCols);
                const dx = dayLeft + cc * (cellW + dGap);
                const dy = dayAreaTop + cr * (cellH + dGap);
                // Each day fills shortly after the month activates, wiping
                // across the month over ~0.4s.
                const dayDelay = (d / Math.max(1, mo.days)) * 0.4;
                const fillK = interpolate(
                  t,
                  [activeAt + dayDelay, activeAt + dayDelay + 0.12],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                return (
                  <div
                    key={d}
                    style={{
                      position: "absolute",
                      left: dx,
                      top: dy,
                      width: cellW,
                      height: cellH,
                      borderRadius: Math.max(1, cellW * 0.22),
                      background: `rgba(207,255,5,${0.92 * fillK})`,
                      border: fillK < 0.5
                        ? `1px solid rgba(181,191,194,0.22)`
                        : `1px solid ${LIME_DEEP}`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
