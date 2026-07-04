// Four motion variants for the Comparison slot — each takes a different
// data shape, so each component hardcodes its n8n-hosting mockup data.
// Once a variant is picked, we'll extract the data shape into the schema.

import React from "react";
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ApplePro, SlideFrame } from "../design/primitives";
import { colors, spacing } from "../design/theme";
import { fontFamily } from "../design/font";
import type { ComparisonData } from "../schema";

// =============================================================================
// B. Survival of the Fittest
//    15 platforms in a grid. Three criteria, each eliminates some. Last 4 glow.
// =============================================================================

type SurvivalPlatform = { name: string; icon: string; eliminatedAtRound?: number };

const SURVIVAL_PLATFORMS: SurvivalPlatform[] = [
  { name: "Hostinger", icon: "logos/hostinger.svg" },
  { name: "Railway", icon: "logos/railway.svg" },
  { name: "DigitalOcean", icon: "logos/digitalocean.svg" },
  { name: "Coolify", icon: "logos/coolify.svg" },
  { name: "Hetzner", icon: "logos/hetzner.svg", eliminatedAtRound: 2 },
  { name: "Netcup", icon: "logos/netcup.svg", eliminatedAtRound: 2 },
  { name: "Raspberry Pi", icon: "logos/raspberrypi.svg", eliminatedAtRound: 2 },
  { name: "Synology", icon: "logos/synology.svg", eliminatedAtRound: 2 },
  { name: "Heroku", icon: "logos/heroku.svg", eliminatedAtRound: 1 },
  { name: "Amazon AWS", icon: "logos/amazonaws.svg", eliminatedAtRound: 1 },
  { name: "Google Cloud", icon: "logos/googlecloud.svg", eliminatedAtRound: 1 },
  { name: "Oracle Cloud", icon: "logos/oracle.svg", eliminatedAtRound: 1 },
  { name: "Fly.io", icon: "logos/flydotio.svg", eliminatedAtRound: 1 },
  { name: "Contabo", icon: "logos/contabo.svg", eliminatedAtRound: 1 },
  { name: "Render", icon: "logos/render.svg", eliminatedAtRound: 1 },
];

const SURVIVAL_ROUNDS = [
  { at: 40, fail: "Unreliable or hidden costs", round: 1 },
  { at: 130, fail: "Too technical for most users", round: 2 },
  { at: 220, fail: "", round: 3 }, // final reveal
];

export const ComparisonSurvival: React.FC<ComparisonData> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Determine current round
  let currentRound = 0;
  for (const r of SURVIVAL_ROUNDS) if (frame >= r.at) currentRound = r.round;

  // Current criterion text — appears with the round
  const activeCriterion = [...SURVIVAL_ROUNDS].reverse().find((r) => frame >= r.at);

  // Winner glow
  const winnerGlow = currentRound >= 3 ? 0.6 + Math.sin(t * 1.2) * 0.3 : 0;

  return (
    <ApplePro>
      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: spacing.itemGap,
            width: "100%",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            15 platforms · 4 survive
          </div>

          {/* Grid of platforms */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 18,
              marginTop: 14,
            }}
          >
            {SURVIVAL_PLATFORMS.map((p, i) => {
              const eliminated =
                p.eliminatedAtRound !== undefined && currentRound >= p.eliminatedAtRound;
              const inGroup = SURVIVAL_PLATFORMS.filter(
                (x) => x.eliminatedAtRound === p.eliminatedAtRound,
              );
              const idxInGroup = inGroup.indexOf(p);
              const elimRound = SURVIVAL_ROUNDS.find((r) => r.round === p.eliminatedAtRound);
              const elimDelay = elimRound ? elimRound.at + idxInGroup * 4 : 0;
              const elimProgress = elimRound
                ? interpolate(frame - elimDelay, [0, 18], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.45, 0, 0.55, 1),
                  })
                : 0;
              const entryDelay = i * 2;
              const entryProgress = interpolate(frame - entryDelay, [0, 24], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              });
              const isWinner = !p.eliminatedAtRound;
              const winnerShine = isWinner && currentRound >= 3 ? winnerGlow : 0;
              return (
                <div
                  key={i}
                  style={{
                    background: eliminated ? "rgba(255,255,255,0.04)" : "#ffffff",
                    border: eliminated
                      ? "1px solid rgba(255,255,255,0.08)"
                      : `1px solid ${isWinner && currentRound >= 3 ? colors.accentSolid : "rgba(255,255,255,0.18)"}`,
                    borderRadius: 14,
                    padding: 18,
                    height: 96,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: eliminated
                      ? interpolate(elimProgress, [0, 1], [1, 0.25])
                      : entryProgress,
                    transform: `scale(${
                      eliminated ? interpolate(elimProgress, [0, 1], [1, 0.94]) : 1
                    })`,
                    boxShadow:
                      isWinner && currentRound >= 3
                        ? `0 0 ${24 + winnerShine * 30}px rgba(167,139,250,${0.3 + winnerShine * 0.3})`
                        : "none",
                    position: "relative",
                  }}
                >
                  <Img
                    src={staticFile(p.icon)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      filter: eliminated ? "grayscale(1)" : "none",
                    }}
                  />
                  {eliminated && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ef4444",
                        fontSize: 64,
                        fontWeight: 800,
                        opacity: interpolate(elimProgress, [0, 1], [0, 0.9]),
                        transform: `rotate(-8deg) scale(${interpolate(elimProgress, [0, 1], [1.4, 1])})`,
                        textShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      }}
                    >
                      ✗
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active criterion banner */}
          {activeCriterion && activeCriterion.fail && (
            <div
              style={{
                marginTop: 24,
                padding: "16px 22px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 14,
                opacity: interpolate(
                  frame - activeCriterion.at,
                  [0, 14],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                ),
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: "#ef4444",
                  textTransform: "uppercase",
                }}
              >
                Round {activeCriterion.round} · ELIMINATED
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.textPrimary }}>
                {activeCriterion.fail}
              </div>
            </div>
          )}

          {currentRound >= 3 && (
            <div
              style={{
                marginTop: 18,
                fontSize: 28,
                fontWeight: 700,
                color: colors.accentSolid,
                letterSpacing: -0.5,
                opacity: interpolate(frame - SURVIVAL_ROUNDS[2].at, [0, 22], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              The 4 worth using →
            </div>
          )}
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// E. Tournament Bracket
//    4 tools → 2 winners → 1 champion. Lines draw, boxes light up, crown lands.
// =============================================================================

const BRACKET_MATCHES = [
  // Round 1
  { round: 1, a: "Hostinger", aIcon: "logos/hostinger.svg", b: "Coolify", bIcon: "logos/coolify.svg", winner: "a", at: 30 },
  { round: 1, a: "Railway", aIcon: "logos/railway.svg", b: "DigitalOcean", bIcon: "logos/digitalocean.svg", winner: "a", at: 70 },
  // Final
  { round: 2, a: "Hostinger", aIcon: "logos/hostinger.svg", b: "Railway", bIcon: "logos/railway.svg", winner: "a", at: 130 },
];

const BracketBox: React.FC<{
  name: string;
  icon: string;
  isWinner: boolean;
  isResolved: boolean;
  opacity: number;
  width?: number;
  isChampion?: boolean;
}> = ({ name, icon, isWinner, isResolved, opacity, width = 220, isChampion = false }) => {
  return (
    <div
      style={{
        width,
        background: isChampion
          ? "linear-gradient(135deg, #facc15 0%, #d97706 100%)"
          : isResolved && isWinner
            ? "rgba(167,139,250,0.10)"
            : isResolved
              ? "rgba(255,255,255,0.03)"
              : "rgba(255,255,255,0.06)",
        border: isChampion
          ? "1px solid rgba(250,204,21,0.6)"
          : isResolved && isWinner
            ? `1px solid ${colors.accentSolid}`
            : "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity,
        boxShadow: isChampion
          ? "0 0 40px rgba(250,204,21,0.5), 0 0 24px rgba(250,204,21,0.3)"
          : isResolved && isWinner
            ? `0 0 24px rgba(167,139,250,0.35)`
            : "none",
        transform: isResolved && !isWinner ? "scale(0.96)" : "scale(1)",
        filter: isResolved && !isWinner ? "grayscale(0.6)" : "none",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: "#ffffff",
          borderRadius: 8,
          padding: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Img src={staticFile(icon)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: isWinner || isChampion ? 700 : 500,
          color: isChampion ? "#0a0805" : isResolved && !isWinner ? colors.textTertiary : colors.textPrimary,
          letterSpacing: -0.3,
          textDecoration: isResolved && !isWinner ? "line-through" : "none",
        }}
      >
        {name}
      </div>
    </div>
  );
};

export const ComparisonBracket: React.FC<ComparisonData> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Match resolution helper
  const isMatchResolved = (m: (typeof BRACKET_MATCHES)[number]) => frame >= m.at + 16;
  const matchProgress = (m: (typeof BRACKET_MATCHES)[number]) =>
    interpolate(frame - m.at, [0, 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Champion appears after final resolves
  const finalMatch = BRACKET_MATCHES[2];
  const championAppear = interpolate(frame - (finalMatch.at + 22), [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const crownPulse = championAppear > 0 ? 0.7 + Math.sin(t * 1.5) * 0.3 : 0;

  return (
    <ApplePro>
      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: spacing.blockGap,
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Final 4 · bracket
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 56, marginTop: 14 }}>
            {/* Round 1 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <BracketBox
                name={BRACKET_MATCHES[0].a}
                icon={BRACKET_MATCHES[0].aIcon}
                isWinner={BRACKET_MATCHES[0].winner === "a"}
                isResolved={isMatchResolved(BRACKET_MATCHES[0])}
                opacity={interpolate(frame, [4, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
              />
              <BracketBox
                name={BRACKET_MATCHES[0].b}
                icon={BRACKET_MATCHES[0].bIcon}
                isWinner={BRACKET_MATCHES[0].winner === "b"}
                isResolved={isMatchResolved(BRACKET_MATCHES[0])}
                opacity={interpolate(frame, [8, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
              />
              <BracketBox
                name={BRACKET_MATCHES[1].a}
                icon={BRACKET_MATCHES[1].aIcon}
                isWinner={BRACKET_MATCHES[1].winner === "a"}
                isResolved={isMatchResolved(BRACKET_MATCHES[1])}
                opacity={interpolate(frame, [12, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
              />
              <BracketBox
                name={BRACKET_MATCHES[1].b}
                icon={BRACKET_MATCHES[1].bIcon}
                isWinner={BRACKET_MATCHES[1].winner === "b"}
                isResolved={isMatchResolved(BRACKET_MATCHES[1])}
                opacity={interpolate(frame, [16, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
              />
            </div>

            {/* Connector lines from R1 to R2 */}
            <svg width="56" height="380" style={{ overflow: "visible" }}>
              {/* Top match */}
              <path
                d={`M0,40 L${28 * matchProgress(BRACKET_MATCHES[0])},40 L${28 * matchProgress(BRACKET_MATCHES[0])},${80}`}
                stroke={isMatchResolved(BRACKET_MATCHES[0]) ? colors.accentSolid : "rgba(255,255,255,0.2)"}
                strokeWidth="2"
                fill="none"
                style={{
                  filter: isMatchResolved(BRACKET_MATCHES[0])
                    ? `drop-shadow(0 0 6px ${colors.accentSolid})`
                    : "none",
                }}
              />
              <path
                d={`M0,128 L${28 * matchProgress(BRACKET_MATCHES[0])},128 L${28 * matchProgress(BRACKET_MATCHES[0])},80`}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d={`M${28 * matchProgress(BRACKET_MATCHES[0])},80 L56,80`}
                stroke={isMatchResolved(BRACKET_MATCHES[0]) ? colors.accentSolid : "rgba(255,255,255,0.2)"}
                strokeWidth="2"
                fill="none"
              />
              {/* Bottom match */}
              <path
                d={`M0,250 L${28 * matchProgress(BRACKET_MATCHES[1])},250 L${28 * matchProgress(BRACKET_MATCHES[1])},290`}
                stroke={isMatchResolved(BRACKET_MATCHES[1]) ? colors.accentSolid : "rgba(255,255,255,0.2)"}
                strokeWidth="2"
                fill="none"
                style={{
                  filter: isMatchResolved(BRACKET_MATCHES[1])
                    ? `drop-shadow(0 0 6px ${colors.accentSolid})`
                    : "none",
                }}
              />
              <path
                d={`M0,338 L${28 * matchProgress(BRACKET_MATCHES[1])},338 L${28 * matchProgress(BRACKET_MATCHES[1])},290`}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d={`M${28 * matchProgress(BRACKET_MATCHES[1])},290 L56,290`}
                stroke={isMatchResolved(BRACKET_MATCHES[1]) ? colors.accentSolid : "rgba(255,255,255,0.2)"}
                strokeWidth="2"
                fill="none"
              />
            </svg>

            {/* Round 2 (Final) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 170 }}>
              <BracketBox
                name={BRACKET_MATCHES[2].a}
                icon={BRACKET_MATCHES[2].aIcon}
                isWinner={BRACKET_MATCHES[2].winner === "a"}
                isResolved={isMatchResolved(BRACKET_MATCHES[2])}
                opacity={isMatchResolved(BRACKET_MATCHES[0]) ? 1 : 0}
              />
              <BracketBox
                name={BRACKET_MATCHES[2].b}
                icon={BRACKET_MATCHES[2].bIcon}
                isWinner={BRACKET_MATCHES[2].winner === "b"}
                isResolved={isMatchResolved(BRACKET_MATCHES[2])}
                opacity={isMatchResolved(BRACKET_MATCHES[1]) ? 1 : 0}
              />
            </div>

            {/* Connector to champion */}
            <svg width="56" height="380" style={{ overflow: "visible" }}>
              <path
                d={`M0,80 L${28 * matchProgress(BRACKET_MATCHES[2])},80 L${28 * matchProgress(BRACKET_MATCHES[2])},190`}
                stroke={isMatchResolved(BRACKET_MATCHES[2]) ? "#facc15" : "rgba(255,255,255,0.2)"}
                strokeWidth="2.5"
                fill="none"
                style={{
                  filter: isMatchResolved(BRACKET_MATCHES[2])
                    ? `drop-shadow(0 0 8px #facc15)`
                    : "none",
                }}
              />
              <path
                d={`M0,290 L${28 * matchProgress(BRACKET_MATCHES[2])},290 L${28 * matchProgress(BRACKET_MATCHES[2])},190`}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d={`M${28 * matchProgress(BRACKET_MATCHES[2])},190 L56,190`}
                stroke={isMatchResolved(BRACKET_MATCHES[2]) ? "#facc15" : "rgba(255,255,255,0.2)"}
                strokeWidth="2.5"
                fill="none"
              />
            </svg>

            {/* Champion */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                opacity: championAppear,
                transform: `scale(${interpolate(championAppear, [0, 1], [0.85, 1])})`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 6,
                  color: "#facc15",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  textShadow: `0 0 ${10 * crownPulse}px #facc15`,
                }}
              >
                🏆 Champion
              </div>
              <BracketBox
                name={finalMatch.winner === "a" ? finalMatch.a : finalMatch.b}
                icon={finalMatch.winner === "a" ? finalMatch.aIcon : finalMatch.bIcon}
                isWinner={true}
                isResolved={true}
                opacity={1}
                width={260}
                isChampion={true}
              />
            </div>
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// F. Radar / Spider Chart
//    Each tool gets a multi-axis shape on a radar. Shapes draw axis-by-axis.
// =============================================================================

const RADAR_AXES = ["Setup", "Price", "Performance", "Support", "Scale", "Ease"];

const RADAR_TOOLS = [
  { name: "Hostinger", color: "#fb923c", scores: [10, 9, 9, 10, 8, 10] },
  { name: "Railway", color: "#fde047", scores: [10, 5, 8, 7, 9, 9] },
  { name: "DigitalOcean", color: "#facc15", scores: [6, 8, 9, 8, 9, 5] },
  { name: "Coolify", color: "#f472b6", scores: [7, 9, 8, 6, 7, 8] },
];

const radarPoint = (
  index: number,
  total: number,
  scoreNorm: number,
  cx: number,
  cy: number,
  rMax: number,
) => {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const r = rMax * scoreNorm;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
};

export const ComparisonRadar: React.FC<ComparisonData> = () => {
  const frame = useCurrentFrame();

  const SIZE = 560;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_MAX = SIZE / 2 - 60;
  const TOTAL_AXES = RADAR_AXES.length;

  // Each tool draws sequentially
  const toolDrawDelay = 28;
  const toolDrawDuration = 32;

  return (
    <ApplePro>
      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: spacing.itemGap,
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Strengths · side by side
          </div>

          <div style={{ display: "flex", gap: 56, alignItems: "center", marginTop: 10 }}>
            <svg width={SIZE} height={SIZE} style={{ overflow: "visible" }}>
              {/* Radial grid */}
              {[1, 0.75, 0.5, 0.25].map((scale, gi) => {
                const points = RADAR_AXES.map((_, i) =>
                  radarPoint(i, TOTAL_AXES, scale, CX, CY, R_MAX),
                );
                const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
                return (
                  <path
                    key={gi}
                    d={d}
                    fill="none"
                    stroke={`rgba(255,255,255,${0.08 - gi * 0.015})`}
                    strokeWidth="1"
                  />
                );
              })}

              {/* Axis lines */}
              {RADAR_AXES.map((_, i) => {
                const p = radarPoint(i, TOTAL_AXES, 1, CX, CY, R_MAX);
                return (
                  <line
                    key={i}
                    x1={CX}
                    y1={CY}
                    x2={p.x}
                    y2={p.y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Tool shapes — each draws sequentially */}
              {RADAR_TOOLS.map((tool, ti) => {
                const startFrame = 16 + ti * toolDrawDelay;
                const drawProgress = interpolate(
                  frame - startFrame,
                  [0, toolDrawDuration],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                );
                const pts = tool.scores.map((s, i) =>
                  radarPoint(i, TOTAL_AXES, (s / 10) * drawProgress, CX, CY, R_MAX),
                );
                const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
                const isWinner = ti === 0;
                return (
                  <g key={ti}>
                    <path
                      d={d}
                      fill={tool.color}
                      fillOpacity={isWinner ? 0.25 : 0.10}
                      stroke={tool.color}
                      strokeWidth={isWinner ? 2.5 : 1.5}
                      style={{
                        filter: isWinner ? `drop-shadow(0 0 14px ${tool.color})` : "none",
                      }}
                    />
                    {/* Vertices as dots */}
                    {pts.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={isWinner ? 4 : 2.5}
                        fill={tool.color}
                        opacity={drawProgress}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Axis labels */}
              {RADAR_AXES.map((label, i) => {
                const p = radarPoint(i, TOTAL_AXES, 1.14, CX, CY, R_MAX);
                return (
                  <text
                    key={i}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={20}
                    fontWeight={600}
                    fill="rgba(255,255,255,0.65)"
                    style={{ fontFamily: "Inter" }}
                  >
                    {label}
                  </text>
                );
              })}
            </svg>

            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {RADAR_TOOLS.map((tool, ti) => {
                const startFrame = 16 + ti * toolDrawDelay;
                const labelOpacity = interpolate(frame - startFrame, [0, 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const isWinner = ti === 0;
                return (
                  <div
                    key={ti}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      opacity: labelOpacity,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: tool.color,
                        boxShadow: isWinner ? `0 0 12px ${tool.color}` : "none",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: isWinner ? 700 : 500,
                        color: isWinner ? tool.color : colors.textSecondary,
                        letterSpacing: -0.3,
                      }}
                    >
                      {tool.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// G. Tier List (S / A / B / C / F)
//    Platforms slide into their tier rows. S glows gold, F dimmed.
// =============================================================================

const TIERS = [
  {
    label: "S",
    color: "#facc15",
    bg: "rgba(250,204,21,0.16)",
    tools: [{ name: "Hostinger", icon: "logos/hostinger.svg" }],
  },
  {
    label: "A",
    color: "#fb923c",
    bg: "rgba(167,139,250,0.16)",
    tools: [
      { name: "Railway", icon: "logos/railway.svg" },
      { name: "DigitalOcean", icon: "logos/digitalocean.svg" },
      { name: "Coolify", icon: "logos/coolify.svg" },
    ],
  },
  {
    label: "B",
    color: "#fde047",
    bg: "rgba(125,211,252,0.12)",
    tools: [
      { name: "Hetzner", icon: "logos/hetzner.svg" },
      { name: "Netcup", icon: "logos/netcup.svg" },
    ],
  },
  {
    label: "C",
    color: "rgba(255,255,255,0.5)",
    bg: "rgba(255,255,255,0.05)",
    tools: [
      { name: "Raspberry Pi", icon: "logos/raspberrypi.svg" },
      { name: "Synology", icon: "logos/synology.svg" },
      { name: "Amazon AWS", icon: "logos/amazonaws.svg" },
    ],
  },
  {
    label: "F",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    tools: [
      { name: "Render", icon: "logos/render.svg" },
      { name: "Heroku", icon: "logos/heroku.svg" },
      { name: "Contabo", icon: "logos/contabo.svg" },
      { name: "Oracle Cloud", icon: "logos/oracle.svg" },
      { name: "Google Cloud", icon: "logos/googlecloud.svg" },
      { name: "Fly.io", icon: "logos/flydotio.svg" },
    ],
  },
];

export const ComparisonTierList: React.FC<ComparisonData> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  void fps;

  const sGlow = 0.7 + Math.sin(t * 1.2) * 0.3;

  return (
    <ApplePro>
      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              marginBottom: 10,
            }}
          >
            n8n hosting · tier list
          </div>

          {TIERS.map((tier, tIndex) => {
            const tierDelay = 18 + tIndex * 22;
            const rowSpring = spring({
              frame: frame - tierDelay,
              fps,
              config: { damping: 13, stiffness: 110, mass: 0.6 },
            });
            const rowOpacity = interpolate(rowSpring, [0, 0.3, 1], [0, 0.5, 1]);
            const rowX = interpolate(rowSpring, [0, 1], [-30, 0]);
            const isS = tier.label === "S";
            return (
              <div
                key={tIndex}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "12px 18px",
                  background: tier.bg,
                  borderLeft: `4px solid ${tier.color}`,
                  borderRadius: 10,
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                  boxShadow: isS ? `0 0 ${24 * sGlow}px rgba(250,204,21,${0.25 * sGlow})` : "none",
                }}
              >
                <div
                  style={{
                    width: 56,
                    textAlign: "center",
                    fontSize: 56,
                    fontWeight: 900,
                    color: tier.color,
                    letterSpacing: -2,
                    textShadow: isS ? `0 0 ${16 * sGlow}px ${tier.color}` : "none",
                    flexShrink: 0,
                  }}
                >
                  {tier.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {tier.tools.map((tool, ti) => {
                    const chipDelay = tierDelay + 6 + ti * 4;
                    const chipOpacity = interpolate(frame - chipDelay, [0, 16], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    });
                    return (
                      <div
                        key={ti}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: "#ffffff",
                          padding: "8px 14px",
                          borderRadius: 10,
                          opacity: chipOpacity,
                          transform: `translateY(${interpolate(chipOpacity, [0, 1], [10, 0])}px)`,
                          boxShadow: isS
                            ? `0 4px 18px rgba(250,204,21,${0.4 * sGlow})`
                            : "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                      >
                        <div style={{ width: 28, height: 28, display: "flex", alignItems: "center" }}>
                          <Img
                            src={staticFile(tool.icon)}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#0a0805",
                            letterSpacing: -0.3,
                          }}
                        >
                          {tool.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SlideFrame>
    </ApplePro>
  );
};
