import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * COMMAND DECK — an "AI operating system" control panel that BOOTS UP a whole
 * business department-by-department. Built as the video HOOK: literally shows
 * "Claude can run your entire business" as a single sleek OS window where each
 * department tile powers on in sequence (booting… → ✓ ACTIVE), driven by the
 * voice.
 *
 * Deliberately a DIFFERENT visual language from NetworkSpread (the closer):
 *   - NetworkSpread = light bg, radial hub radiating spokes to customers.
 *   - CommandDeck   = dark OS panel, a GRID of departments toggling on.
 * Two structurally different pictures so the intro never feels repetitive.
 *
 * Contrast: near-black panel + white labels + lime active states = very high
 * contrast (no blue-on-blue). The "software UI" look is intentional/premium,
 * mirroring DashboardCard / ClaudeCodeTerminal.
 */
export type DeckTile = {
  label: string;
  glyph?: string;
  /** Absolute spoken time (source-video seconds) when this tile powers on. */
  appear_sec: number;
};

export type CommandDeckProps = {
  /** Header headline (e.g. "RUNS YOUR ENTIRE BUSINESS"). */
  title?: string;
  /** Left brand chip in the title bar. Default "CLAUDE". */
  brand?: string;
  tiles: DeckTile[];
  /** Beat start (source seconds) so appear_sec can be made relative. */
  startSec?: number;
};

const LIME = "#CFFF05";
const LIME_DEEP = "#AEDC00";
const RAISIN = "#0F121A";
const PANEL_TOP = "#171C28";
const PANEL_BOT = "#0C0F16";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

export const CommandDeck: React.FC<CommandDeckProps> = ({
  title,
  brand = "CLAUDE",
  tiles,
  startSec = 0,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  if (!tiles || tiles.length === 0) return null;

  const tSec = frame / fps;

  // ── Panel geometry ──────────────────────────────────────────────────────
  const panelW = Math.round(width * 0.82);
  const panelH = Math.round(height * 0.74);
  const left = Math.round((width - panelW) / 2);
  const top = Math.round((height - panelH) / 2);

  // ── Panel entrance ─────────────────────────────────────────────────────
  const panelSpring = spring({
    frame: frame - 1,
    fps,
    durationInFrames: Math.round(0.5 * fps),
    config: { damping: 15, stiffness: 180, mass: 0.7 },
  });
  const panelOp = interpolate(panelSpring, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const panelScale = interpolate(panelSpring, [0, 1], [0.92, 1], { extrapolateRight: "clamp" });

  // group exit
  const exitStart = durationInFrames - 7;
  const groupOp = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // ── Title bar metrics ───────────────────────────────────────────────────
  const titleBarH = Math.round(panelH * 0.135);
  const dotR = Math.round(titleBarH * 0.10);
  const brandSize = Math.round(typeBase * 0.030);
  const headlineSize = Math.round(typeBase * 0.024);
  const livePulse = 0.5 + 0.5 * Math.abs(Math.sin(tSec * Math.PI * 1.6));

  // ── Tile grid (3 cols feels like a real ops board on 16:9) ──────────────
  const cols = tiles.length <= 4 ? 2 : 3;
  const rows = Math.ceil(tiles.length / cols);
  const gridPad = Math.round(panelW * 0.035);
  const gridTop = top + titleBarH + Math.round(panelH * 0.045);
  const gridGapX = Math.round(panelW * 0.025);
  const gridGapY = Math.round(panelH * 0.04);
  const gridAreaH = panelH - titleBarH - Math.round(panelH * 0.045) * 2;
  const tileW = (panelW - gridPad * 2 - gridGapX * (cols - 1)) / cols;
  const tileH = (gridAreaH - gridGapY * (rows - 1)) / rows;

  const labelSize = Math.round(typeBase * 0.026);
  const glyphSize = Math.round(typeBase * 0.044);
  const statusSize = Math.round(typeBase * 0.0165);

  return (
    <AbsoluteFill style={{ opacity: groupOp }}>
      {/* Light SILVER brand stage (not blue) — a clean greyish backdrop so the
          near-black OS window reads as a dark device floating on a bright,
          on-brand surface. Uses the Silver palette: #E9ECED → #D2D8DA → #B5BFC2. */}
      <AbsoluteFill style={{ background: `radial-gradient(130% 130% at 50% 28%, #EEF1F2 0%, #D2D8DA 55%, #B7C0C3 100%)` }} />
      {/* faint engineering grid — dark raisin lines now (legible on the light stage) */}
      <AbsoluteFill style={{
        backgroundImage:
          "linear-gradient(rgba(15,18,26,0.06) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(15,18,26,0.06) 1px, transparent 1px)",
        backgroundSize: `${Math.round(width * 0.05)}px ${Math.round(width * 0.05)}px`,
        WebkitMaskImage: "radial-gradient(130% 95% at 50% 45%, #000 30%, transparent 85%)",
        maskImage: "radial-gradient(130% 95% at 50% 45%, #000 30%, transparent 85%)",
      }} />

      {/* The OS panel */}
      <div style={{
        position: "absolute",
        left, top, width: panelW, height: panelH,
        borderRadius: Math.round(width * 0.016),
        background: `linear-gradient(180deg, ${PANEL_TOP} 0%, ${PANEL_BOT} 100%)`,
        border: "1px solid rgba(207,255,5,0.18)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.6), 0 0 80px rgba(207,255,5,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
        opacity: panelOp,
        transform: `scale(${panelScale})`,
        transformOrigin: "center",
        overflow: "hidden",
      }}>
        {/* Title bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: titleBarH,
          padding: `0 ${Math.round(panelW * 0.03)}px`,
          background: "rgba(255,255,255,0.035)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: Math.round(panelW * 0.018),
        }}>
          {/* traffic lights */}
          <div style={{ display: "flex", gap: dotR * 0.9 }}>
            <div style={{ width: dotR, height: dotR, borderRadius: "50%", background: "#FF5F57" }} />
            <div style={{ width: dotR, height: dotR, borderRadius: "50%", background: "#FEBC2E" }} />
            <div style={{ width: dotR, height: dotR, borderRadius: "50%", background: "#28C840" }} />
          </div>
          {/* brand chip */}
          <div style={{
            marginLeft: Math.round(panelW * 0.01),
            display: "flex", alignItems: "center", gap: dotR * 0.8,
          }}>
            <div style={{
              width: dotR * 1.5, height: dotR * 1.5, borderRadius: dotR * 0.4,
              background: `radial-gradient(circle at 35% 30%, ${LIME} 0%, ${LIME_DEEP} 100%)`,
              boxShadow: `0 0 ${dotR * 1.6}px rgba(207,255,5,0.6)`,
            }} />
            <div style={{
              fontFamily: BLOCK, fontWeight: 800, fontSize: brandSize,
              color: "#FFFFFF", letterSpacing: "0.06em",
            }}>{brand}</div>
          </div>
          {/* headline */}
          {title && (
            <div style={{
              flex: 1,
              fontFamily: BLOCK, fontWeight: 700, fontSize: headlineSize,
              color: "rgba(255,255,255,0.62)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              textAlign: "right",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{title}</div>
          )}
          {/* live pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: dotR * 0.6,
            color: LIME, fontFamily: MONO, fontWeight: 700, fontSize: statusSize * 1.1,
            marginLeft: Math.round(panelW * 0.01),
          }}>
            <div style={{
              width: dotR * 0.9, height: dotR * 0.9, borderRadius: "50%", background: LIME,
              boxShadow: `0 0 ${dotR * 1.4}px rgba(207,255,5,${livePulse})`, opacity: livePulse,
            }} />
            LIVE
          </div>
        </div>

        {/* Department tiles */}
        {tiles.map((t, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const tl = gridPad + c * (tileW + gridGapX);
          const tt = (gridTop - top) + r * (tileH + gridGapY);

          const appearF = Math.max(0, Math.round((t.appear_sec - startSec) * fps));
          const rel = frame - appearF;
          const pop = spring({
            frame: rel, fps,
            durationInFrames: Math.round(0.4 * fps),
            config: { damping: 14, stiffness: 210, mass: 0.6 },
          });
          const visible = frame >= appearF - Math.round(0.25 * fps);
          if (!visible) return null;

          // boot → active flip ~0.45s after the tile lands
          const activeRaw = rel / fps - 0.42;
          const isActive = activeRaw >= 0;
          const activeP = interpolate(activeRaw, [0, 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          const enterScale = interpolate(pop, [0, 1], [0.78, 1], { extrapolateRight: "clamp" });
          const enterOp = interpolate(pop, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
          const enterTy = interpolate(pop, [0, 1], [tileH * 0.12, 0], { extrapolateRight: "clamp" });

          // active visuals
          const accent = activeP;
          const borderCol = `rgba(207,255,5,${0.12 + 0.55 * accent})`;
          const glowBreath = isActive
            ? 0.18 + 0.12 * Math.abs(Math.sin((rel / fps) * Math.PI * 1.2))
            : 0;
          const dotColor = isActive ? LIME : "rgba(255,255,255,0.28)";
          const dotGlow = isActive ? `0 0 ${tileH * 0.08}px rgba(207,255,5,0.8)` : "none";

          // a quick scan sweep across the tile at the moment it activates
          const sweepP = interpolate(activeRaw, [0, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const showSweep = activeRaw >= 0 && activeRaw <= 0.4;

          return (
            <div key={i} style={{
              position: "absolute",
              left: tl, top: tt, width: tileW, height: tileH,
              borderRadius: Math.round(width * 0.012),
              background: isActive
                ? `linear-gradient(180deg, rgba(207,255,5,0.08) 0%, rgba(207,255,5,0.02) 100%)`
                : "rgba(255,255,255,0.025)",
              border: `1.5px solid ${borderCol}`,
              boxShadow: isActive
                ? `0 8px 26px rgba(0,0,0,0.4), 0 0 ${tileH * 0.5}px rgba(207,255,5,${glowBreath})`
                : "0 6px 18px rgba(0,0,0,0.32)",
              opacity: enterOp,
              transform: `translateY(${enterTy}px) scale(${enterScale})`,
              transformOrigin: "center",
              overflow: "hidden",
              display: "flex", flexDirection: "column",
              padding: Math.round(tileH * 0.12),
              boxSizing: "border-box",
            }}>
              {/* status dot top-right */}
              <div style={{
                position: "absolute", top: tileH * 0.12, right: tileW * 0.07,
                width: Math.round(tileH * 0.07), height: Math.round(tileH * 0.07),
                borderRadius: "50%", background: dotColor, boxShadow: dotGlow,
              }} />

              {/* glyph */}
              <div style={{
                fontSize: glyphSize, lineHeight: 1,
                filter: isActive ? "none" : "grayscale(0.6) opacity(0.6)",
              }}>{t.glyph ?? "▣"}</div>

              {/* label */}
              <div style={{
                marginTop: "auto",
                fontFamily: BLOCK, fontWeight: 800, fontSize: labelSize,
                color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                letterSpacing: "0.01em", lineHeight: 1.05,
              }}>{t.label}</div>

              {/* status line: booting… → ✓ ACTIVE */}
              <div style={{
                marginTop: Math.round(tileH * 0.05),
                fontFamily: MONO, fontWeight: 700, fontSize: statusSize,
                letterSpacing: "0.08em",
                color: isActive ? LIME : "rgba(255,255,255,0.35)",
              }}>
                {isActive ? "● ACTIVE" : "booting…"}
              </div>

              {/* activation scan sweep */}
              {showSweep && (
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `${interpolate(sweepP, [0, 1], [-30, 130])}%`,
                  width: "26%",
                  background: "linear-gradient(90deg, transparent, rgba(207,255,5,0.28), transparent)",
                  transform: "skewX(-12deg)",
                }} />
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
