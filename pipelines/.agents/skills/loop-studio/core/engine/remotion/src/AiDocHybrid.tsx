/**
 * AiDocHybrid — the FULL hybrid test beat: "The New Most Valuable Resource".
 * Proves the layered documentary pipeline in one ~23s cut:
 *   • Higgsfield b-roll (land / oil / servers / city)   — atmospheric real-world
 *   • Blender photoreal GOLD GLOBE (rendered on alpha)   — the 3D data-viz hero
 *   • Luuk real footage cutout, composited into a designed dark space — the host
 *   • Remotion 2D layer — ALL text, labels, data, grade  — the designed overlay
 * VO = Fish clone of Luuk (continuous narration). 25fps.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { clamp01, lerp, RAISIN, LIME, SILVER, SILVER_MID, SANS, MONO } from "./bb2/scene";

const FPS = 25;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Blender-exported pillar-tip screen positions (0-1) + $ values (test data)
const TIPS = [
  { n: "UNITED STATES", x: 0.20, y: 0.32, v: "$109B", big: true, o: [0, -66] },
  { n: "CHINA", x: 0.54, y: 0.30, v: "$71B", big: true, o: [96, -30] },
  { n: "EU", x: 0.82, y: 0.28, v: "$48B", big: true, o: [26, -60] },
  { n: "JAPAN", x: 0.37, y: 0.43, v: "$19B", o: [-96, -6] },
  { n: "UNITED KINGDOM", x: 0.74, y: 0.35, v: "$22B", o: [104, 2] },
  { n: "INDIA", x: 0.66, y: 0.57, v: "$16B", o: [86, 6] },
];

const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>`
  );

/* ---------- b-roll shot ---------- */
const Broll: React.FC<{ src: string; op: number; scale?: number; grade?: string }> = ({ src, op, scale = 1, grade = "" }) => (
  <AbsoluteFill style={{ opacity: op }}>
    <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})`, filter: grade }} />
  </AbsoluteFill>
);

/* ---------- resource stamp (LAND / OIL / DATA) ---------- */
const Stamp: React.FC<{ u: number; label: string; on: number }> = ({ u, label, on }) => {
  const y = lerp(u * 1.2, 0, on);
  return (
    <div style={{ position: "absolute", left: "50%", bottom: "16%", transform: `translate(-50%, ${y}px)`, opacity: on, display: "flex", alignItems: "center", gap: u * 0.9 }}>
      <div style={{ width: u * 0.55, height: u * 3.2, background: LIME }} />
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 5.4, letterSpacing: "0.16em", color: "#fff", textShadow: "0 2px 30px rgba(0,0,0,0.7)" }}>{label}</span>
    </div>
  );
};

export const AiDocHybrid: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  const bg = t >= 8.4 && t < 16.5 ? "#dfe4e2" : RAISIN; // light designed bg behind the globe, else dark
  const vig = t >= 8.4 && t < 16.5 ? 0.28 : 0.6;

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden", fontFamily: SANS }}>
      <Audio src={staticFile("aidoc2/vo.wav")} />

      {/* ============ RESOURCE MONTAGE (0–8.5): land → oil → servers ============ */}
      {t < 8.7 && (() => {
        const land = clamp01((t - 0) / 0.6) * (1 - clamp01((t - 6.2) / 0.4));
        const oil = clamp01((t - 6.2) / 0.3) * (1 - clamp01((t - 7.2) / 0.35));
        const data = clamp01((t - 7.2) / 0.3) * (1 - clamp01((t - 8.5) / 0.3));
        const grade = "saturate(1.05) contrast(1.05)";
        return (
          <AbsoluteFill>
            <Broll src="aidoc2/land.mp4" op={land} scale={1.05 + t * 0.004} grade={grade} />
            <Broll src="aidoc2/oil.mp4" op={oil} scale={1.04} grade={grade} />
            <Broll src="aidoc2/servers.mp4" op={data} scale={1.04} grade={grade} />
            {/* stamps */}
            {t >= 4.6 && t < 6.3 && <Stamp u={u} label="LAND" on={clamp01((t - 4.9) / 0.22) * (1 - clamp01((t - 6.0) / 0.3))} />}
            {t >= 6.2 && t < 7.3 && <Stamp u={u} label="OIL" on={clamp01((t - 6.25) / 0.18) * (1 - clamp01((t - 7.05) / 0.25))} />}
            {t >= 7.2 && t < 8.6 && <Stamp u={u} label="DATA" on={clamp01((t - 7.25) / 0.18) * (1 - clamp01((t - 8.3) / 0.3))} />}
            {/* opening kicker */}
            {t < 4.6 && (
              <div style={{ position: "absolute", left: "7%", top: "12%", opacity: clamp01((t - 0.4) / 0.8) * (1 - clamp01((t - 4.0) / 0.5)), fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.28em", color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>
                A BUILDLOOP FILM
              </div>
            )}
          </AbsoluteFill>
        );
      })()}

      {/* ============ GLOBE HERO (8.4–16.5): Blender gold globe + labels ============ */}
      {t >= 8.4 && t < 16.6 && (() => {
        const on = clamp01((t - 8.5) / 0.5) * (1 - clamp01((t - 16.3) / 0.3));
        const push = 1.0 + EASE(clamp01((t - 8.5) / 7)) * 0.06;
        return (
          <AbsoluteFill style={{ opacity: on }}>
            {/* soft radial studio bg behind globe */}
            <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 50% 42%, #eef1ef 0%, #d3d9d6 70%, #c3cac6 100%)" }} />
            <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 46%" }}>
              <Img src={staticFile("aidoc2/globe.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              {/* country labels pinned to Blender-exported tips (clear out as COMPUTE lands) */}
              {TIPS.map((tp, i) => {
                const climax = 1 - clamp01((t - 15.62) / 0.22);
                const rev = clamp01((t - (10.0 + i * 0.4)) / 0.45) * climax;
                const ax = tp.x * W + tp.o[0];
                const ay = tp.y * H + tp.o[1];
                const align = tp.o[0] < -10 ? "right" : tp.o[0] > 10 ? "left" : "center";
                const tx = align === "right" ? "translate(-100%, -50%)" : align === "left" ? "translate(0, -50%)" : "translate(-50%, -100%)";
                return (
                  <div key={i} style={{ position: "absolute", left: ax, top: ay, transform: `${tx} translateY(${(1 - rev) * u * 0.8}px)`, opacity: rev, textAlign: align as any, whiteSpace: "nowrap" }}>
                    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: (tp.big ? 3.0 : 2.1) * u, color: RAISIN, lineHeight: 1, letterSpacing: "-0.02em" }}>{tp.v}</div>
                    <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 0.98 * u, color: "#5a6068", letterSpacing: "0.12em", marginTop: u * 0.2 }}>{tp.n}</div>
                  </div>
                );
              })}
            </div>
            {/* top tag */}
            <div style={{ position: "absolute", left: "50%", top: "3.5%", transform: "translateX(-50%)", textAlign: "center", opacity: clamp01((t - 9.0) / 0.6) * (1 - clamp01((t - 15.62) / 0.22)) }}>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.3em", color: "#6b7178" }}>GLOBAL AI COMPUTE</div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, letterSpacing: "0.02em", color: RAISIN, marginTop: u * 0.35 }}>
                THE MOST VALUABLE RESOURCE · <span style={{ background: LIME, padding: `0 ${u * 0.4}px` }}>2025</span>
              </div>
            </div>
            {/* COMPUTE reveal on "it's compute" (15.86) */}
            {t >= 15.7 && (
              <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 11, letterSpacing: "0.01em", color: RAISIN, opacity: clamp01((t - 15.82) / 0.14), transform: `scale(${lerp(1.12, 1, clamp01((t - 15.82) / 0.22))})`, textShadow: "0 6px 40px rgba(0,0,0,0.18)" }}>
                  COMPUTE
                </span>
              </AbsoluteFill>
            )}
          </AbsoluteFill>
        );
      })()}

      {/* ============ HOST — Luuk composited into a designed dark space (16.5–21.2) ============ */}
      {t >= 16.4 && t < 21.4 && (() => {
        const on = clamp01((t - 16.5) / 0.45) * (1 - clamp01((t - 21.0) / 0.35));
        const local = Math.round((t - 16.5) * FPS);
        const period = 208; const ph = local % period; const idx = 1 + (ph < 105 ? ph : Math.max(0, 208 - ph));
        const matte = `cvc/matte/f_${String(Math.max(1, Math.min(105, idx))).padStart(3, "0")}.png`;
        const lower = clamp01((t - 17.1) / 0.5) * (1 - clamp01((t - 20.6) / 0.4));
        return (
          <AbsoluteFill style={{ opacity: on }}>
            {/* designed data-space bg */}
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 62% 45%, #1a2030 0%, ${RAISIN} 68%)` }} />
            <AbsoluteFill style={{ backgroundImage: `radial-gradient(rgba(233,236,237,0.10) 1.4px, transparent 1.4px)`, backgroundSize: `${u * 2.4}px ${u * 2.4}px`, opacity: 0.5, maskImage: "radial-gradient(ellipse 60% 60% at 35% 50%, black, transparent 75%)" as any }} />
            {/* faint lime data line */}
            <div style={{ position: "absolute", left: 0, top: "52%", width: "42%", height: 2, background: `linear-gradient(90deg, transparent, ${LIME})`, opacity: 0.5 }} />
            {/* Luuk — contact shadow + subtle lime rim via drop-shadow (follows alpha) */}
            <Img src={staticFile(matte)} style={{ position: "absolute", right: "-6%", bottom: 0, height: "108%", filter: "drop-shadow(0 12px 30px rgba(0,0,0,0.65)) drop-shadow(0 0 3px rgba(207,255,5,0.28))" }} />
            {/* lower third */}
            <div style={{ position: "absolute", left: "7%", bottom: "16%", opacity: lower, transform: `translateY(${(1 - lower) * u}px)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: u * 0.8 }}>
                <div style={{ width: u * 0.5, height: u * 3.4, background: LIME }} />
                <div>
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.8, color: SILVER, letterSpacing: "-0.01em", lineHeight: 1 }}>LUUK ALLEMAN</div>
                  <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.2, color: SILVER_MID, letterSpacing: "0.14em", marginTop: u * 0.4 }}>builds AI systems for a living</div>
                </div>
              </div>
            </div>
          </AbsoluteFill>
        );
      })()}

      {/* ============ RESOLVE title (21.0–23) ============ */}
      {t >= 21.0 && (() => {
        const on = clamp01((t - 21.1) / 0.5);
        return (
          <AbsoluteFill style={{ opacity: on, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.4, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", lineHeight: 1.02, textAlign: "center" }}>
              The <span style={{ background: LIME, color: RAISIN, padding: `0 ${u * 0.5}px` }}>Compute</span> Era
            </div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.26em", color: SILVER_MID, marginTop: u * 1.6, opacity: clamp01((t - 21.6) / 0.5) }}>A BUILDLOOP FILM</div>
          </AbsoluteFill>
        );
      })()}

      {/* film grain + vignette over everything */}
      <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 26}px`, opacity: 0.05, mixBlendMode: "overlay" }} />
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 90% 84% at 50% 46%, transparent 52%, rgba(0,0,0,${vig}))` }} />
    </AbsoluteFill>
  );
};
