/**
 * LSAct3 — Loop Studio flagship, act 3: "SOUND + TASTE" (0–86.6s, 2598 frames @30fps).
 * Sound station (bloom/flatline → skipped → revived, music bed + SFX magnet-snap) →
 * presentation-vs-motion-design → the station rail ticks 5 capabilities → "actually good?" →
 * TASTE → feedback gate/detour → the review room → notes on frames → notes become taste.md
 * rules → the rule blocks the repeat mistake → a machine with taste; clip exits to Act 4.
 * Built beat-by-beat from projects/loopstudio-main/specs/design_lsact3.json (the contract).
 * Footage ls_th3.mp4 muted via FootageLayer; voice ls_th3_voice.m4a. Everything renders in
 * ONE overlay world AFTER the footage layer (full-face beats carry docked residue on top).
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Marker, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";

const FPS = 30;
const OLIVE = "#7a9a00"; // accent substitute on the light worksheet (lime never on white)

/* deterministic 0..1 noise */
const nz = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

/* headline — LOCKED bottom-middle placement, register-aware color, one lime Marker word.
   Identical coordinates on every beat so scenes match; sits below the footage head. */
const H1: React.FC<{ t: number; u: number; in0: number; out?: number; size?: number; color: string; children: React.ReactNode }> = ({ t, u, in0, out, size = 2.9, color, children }) => (
  <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color, textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.7)", opacity: clamp01((t - in0) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
);

/* the traveling clip-card: filmstrip-edged video card (the object crossing all four acts) */
const ClipCard: React.FC<{ x: number; y: number; u: number; sc?: number; rot?: number; o?: number; light?: boolean; rough?: boolean; offset?: boolean; wave?: number; tick?: number; t?: number }> = ({ x, y, u, sc = 1, rot = 0, o = 1, light, rough, offset = true, wave = 0, tick = 0, t = 0 }) => {
  const bord = rough ? SILVER_MID : light ? RAISIN : SILVER;
  const W = u * 13, H = u * 8.4;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`, opacity: o }}>
      <div style={{ position: "relative", width: W, height: H }}>
        {offset && !rough && <div style={{ position: "absolute", inset: 0, background: light ? RAISIN : LIME, borderRadius: u * 0.7, transform: `translate(${u * 0.5}px,${u * 0.5}px)`, opacity: light ? 0.85 : 0.9 }} />}
        <div style={{ position: "absolute", inset: 0, background: "#12151d", border: `${u * 0.14}px solid ${bord}`, borderRadius: u * 0.7, overflow: "hidden", boxShadow: `0 ${u * 0.7}px ${u * 1.8}px rgba(0,0,0,${light ? 0.25 : 0.55})` }}>
          {/* sprocket strips top + bottom = film */}
          {[0, 1].map((r) => (
            <div key={r} style={{ position: "absolute", left: 0, right: 0, [r ? "bottom" : "top"]: 0, height: u * 1.15, background: "#0b0e14", display: "flex", alignItems: "center", justifyContent: "space-around", padding: `0 ${u * 0.5}px` }}>
              {Array.from({ length: 6 }).map((_, i) => <span key={i} style={{ width: u * 0.7, height: u * 0.55, borderRadius: u * 0.12, background: "#2e3648" }} />)}
            </div>
          ))}
          {/* thumbnail: play glyph + content bars */}
          <div style={{ position: "absolute", left: 0, right: 0, top: u * 1.15, bottom: u * 1.15, background: "#161b26", display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.8 }}>
            <div style={{ width: u * 2.5, height: u * 2.5, borderRadius: "50%", border: `${u * 0.12}px solid ${rough ? SILVER_MID : SILVER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 0, height: 0, borderTop: `${u * 0.6}px solid transparent`, borderBottom: `${u * 0.6}px solid transparent`, borderLeft: `${u * 0.95}px solid ${rough ? SILVER_MID : SILVER}`, marginLeft: u * 0.25 }} />
            </div>
            {[0.55, 0.85, 0.65].map((h, i) => <span key={i} style={{ width: u * 0.9, height: u * 3.4 * h, borderRadius: u * 0.15, background: rough ? "#39415a" : "#4a5268" }} />)}
          </div>
          {/* living waveform badge (beat 14 polish) — inside the dark card, lime reads */}
          {wave > 0 && (
            <div style={{ position: "absolute", left: u * 1.0, bottom: u * 1.5, display: "flex", alignItems: "flex-end", gap: u * 0.22, height: u * 1.3, opacity: wave }}>
              {Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ width: u * 0.34, height: u * 1.3 * (0.35 + 0.65 * Math.abs(Math.sin(t * 5 + i * 0.9))), background: LIME, borderRadius: u * 0.1 }} />)}
            </div>
          )}
        </div>
        {/* taste tick (beat 14 polish) */}
        {tick > 0 && (
          <div style={{ position: "absolute", right: -u * 0.9, top: -u * 0.9, width: u * 2.0, height: u * 2.0, borderRadius: "50%", background: LIME, color: RAISIN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.15, transform: `scale(${0.5 + 0.5 * tick})`, opacity: tick, boxShadow: `0 ${u * 0.3}px ${u * 0.9}px rgba(0,0,0,0.5)` }}>✓</div>
        )}
      </div>
    </div>
  );
};

/* small SFX diamond */
const Diamond: React.FC<{ x: number; y: number; u: number; c: string; sc?: number; o?: number; flash?: number }> = ({ x, y, u, c, sc = 1, o = 1, flash = 0 }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(45deg) scale(${sc})`, opacity: o }}>
    <div style={{ width: u * 1.15, height: u * 1.15, background: c, borderRadius: u * 0.18, boxShadow: flash > 0 ? `0 0 ${u * (0.6 + flash * 1.6)}px ${c}` : "none" }} />
  </div>
);

/* review-room note card (light card, raisin mono, pin stem) */
const NoteCard: React.FC<{ u: number; text: string; o?: number; sc?: number; stem?: number }> = ({ u, text, o = 1, sc = 1, stem = 0 }) => (
  <div style={{ transform: `scale(${sc})`, opacity: o, display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div style={{ background: WHITE, border: `${u * 0.09}px solid #b5bfc2`, borderRadius: u * 0.4, padding: `${u * 0.32}px ${u * 0.7}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.88, color: RAISIN, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.4}px ${u * 1.1}px rgba(0,0,0,0.45)` }}>{text}</div>
    {stem > 0 && <div style={{ width: u * 0.12, height: u * stem, background: "#b5bfc2" }} />}
  </div>
);

export const LSAct3: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  /* footage choreography — moves only in the short gaps AT beat boundaries, still inside beats */
  const SKF: SK[] = [
    { t: 0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },      // beats 1–3: panel right, static
    { t: 17.71, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 18.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },          // beat 4: hidden
    { t: 24.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 25.5, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },    // beat 5: panel right
    { t: 34.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 34.55, x: 50, y: 50, s: 1, dim: 0, fr: 0 },         // beats 6–7: FULL (the challenge + TASTE)
    { t: 43.55, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 44.3, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },    // beat 8: panel right
    { t: 54.97, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },   // beat 9 shares the spot (no move)
    { t: 55.7, x: 50, y: 50, s: 1, dim: 1, fr: 1 },          // beat 10: hidden (review room hero)
    { t: 65.0, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 65.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // beat 11: FULL (pride tease)
    { t: 68.27, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 69.0, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },    // beat 12: panel right
    { t: 75.43, x: 74, y: 52, s: 0.92, dim: 0.05, fr: 1 },
    { t: 76.1, x: 50, y: 50, s: 1, dim: 1, fr: 1 },          // beat 13: hidden
    { t: 80.1, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 80.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // beat 14: FULL (landing line)
    { t: 86.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);

  /* LIGHT register windows: beat 3 turn (7.89) → beat 6 turn-back (34.25); beat 9 'built' (52.97) → beat 14 (80.35) */
  const liteWins: [number, number][] = [[7.89, 34.25], [52.97, 80.35]];
  const lite = Math.max(...liteWins.map(([a, b]) => clamp01((t - a) / 0.5) * (1 - clamp01((t - b) / 0.5))), 0);
  const isLite = lite > 0.5;
  const ink = isLite ? RAISIN : SILVER;
  const inkSoft = isLite ? BODY : SILVER_SOFT;
  const acc = isLite ? OLIVE : LIME;

  /* ================== SOUND STATION (beats 1–3, one continuous scene) ================== */
  const SoundStation = () => {
    const on = clamp01((t - 0.1) / 0.4) * (1 - clamp01((t - 17.5) / 0.5));
    if (on <= 0) return null;
    // clip-card slides in from the LEFT edge (arriving from Act 2), docks at x30
    const arrive = interpolate(t, [0.2, 1.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
    const cardX = lerp(-12, 30, arrive);
    // waveform phases
    const baseDraw = clamp01((t - 0.93) / 0.45);        // baseline draws on 'half'
    const bloom1 = clamp01((t - 2.47) / 0.4);           // blooms on 'expensive'
    const collapse = clamp01((t - 4.35) / 0.3);         // flatlines on 'cheap'
    const strike = clamp01((t - 5.85) / 1.5);           // strike draws on 'first thing' → 'skips'
    const struck = clamp01((t - 7.41) / 0.25);          // row dims + chip stamps on 'skips'
    const revive = clamp01((t - 11.59) / 0.45);         // un-skipped on 'taken care of'
    const bloom2 = clamp01((t - 11.75) / 0.55);         // bars lift back (olive, light register)
    const rowDim = 1 - struck * 0.75 * (1 - revive);
    const strikeW = strike * (1 - clamp01((t - 11.59) / 0.5)); // erases right-to-left on revive
    const recoil = struck > 0 && struck < 1 ? Math.sin(struck * Math.PI) * u * 0.5 : 0;
    // beat 3 tooling
    const stripOn = clamp01((t - 12.3) / 0.45);
    const musicOn = clamp01((t - 13.91) / 0.55);
    const CUTS = [0.22, 0.5, 0.78];
    const stripX0 = 18, stripW = 24; // strip x 18→42
    const diamondsOn = [15.85, 16.05, 16.25].map((a) => clamp01((t - a) / 0.3));
    const snaps = [16.99, 17.07, 17.15].map((a) => clamp01((t - a) / 0.22));
    const loose = [{ x: 24.6, y: 56.6, r: 10 }, { x: 31.6, y: 58.2, r: -14 }, { x: 37.8, y: 56.9, r: 6 }];
    const N = 26;
    return (
      <div style={{ position: "absolute", inset: 0, opacity: on }}>
        {/* headlines swap through the three beats in one slot */}
        <H1 t={t} u={u} in0={0.93} out={4.75} color={ink}>SOUND IS <Marker u={u} t={t} at={0.93} base={ink}>HALF</Marker></H1>
        <H1 t={t} u={u} in0={5.3} out={8.1} color={ink}>EVERYONE <Marker u={u} t={t} at={7.41} base={ink}>SKIPS</Marker> IT</H1>
        <H1 t={t} u={u} in0={10.9} out={17.4} color={ink}>TAKEN <Marker u={u} t={t} at={11.59} base={ink}>CARE</Marker> OF</H1>
        {/* LOOP STUDIO wordmark chip + skill chips (beat 3) */}
        {t >= 8.4 && (() => { const wm = clamp01((t - 8.57) / 0.3); const pop = 0.8 + 0.2 * clamp01((t - 8.57) / 0.4);
          return (
            <div style={{ position: "absolute", left: "6%", top: "21%", opacity: wm * (1 - clamp01((t - 17.3) / 0.4)) }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: u * 0.6, background: RAISIN, borderRadius: u * 0.45, padding: `${u * 0.5}px ${u * 1.05}px`, transform: `scale(${pop})`, transformOrigin: "left center", boxShadow: `${u * 0.35}px ${u * 0.35}px 0 rgba(15,18,26,0.25)` }}>
                <span style={{ width: u * 0.7, height: u * 0.7, background: SILVER, borderRadius: "50%" }} />
                <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.2, letterSpacing: "0.16em", color: SILVER }}>LOOP STUDIO</span>
              </div>
              <div style={{ marginTop: u * 0.7, display: "flex", gap: u * 0.6 }}>
                {["score.md", "sfx.md"].map((s, i) => { const so = clamp01((t - 9.83 - i * 0.18) / 0.3);
                  return (
                    <div key={s} style={{ display: "inline-flex", alignItems: "center", gap: u * 0.45, background: WHITE, border: `${u * 0.09}px solid ${RAISIN}`, borderRadius: u * 0.4, padding: `${u * 0.32}px ${u * 0.75}px`, opacity: so, transform: `translateY(${(1 - so) * u * 0.8}px)` }}>
                      <Img src={staticFile("logos/markdown-dark.svg")} style={{ width: u * 1.25, height: u * 0.78 }} />
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: RAISIN }}>{s}</span>
                    </div>
                  ); })}
              </div>
            </div>
          ); })()}
        {/* the traveling clip-card, docked center-left */}
        <ClipCard x={cardX} y={33} u={u} light={isLite} o={1} rot={lerp(-3, 0, arrive)} />
        {/* waveform row (persists all three beats) */}
        <div style={{ position: "absolute", left: "16%", top: "44%", width: u * 28, height: u * 5.6, opacity: rowDim, transform: `translateX(${-recoil}px)` }}>
          {/* center baseline */}
          <div style={{ position: "absolute", left: 0, top: "50%", width: "100%", height: u * 0.16, background: collapse > 0.5 && revive < 0.5 ? "#8a93a8" : isLite ? "#9aa3a8" : SILVER_MID, transform: `translateY(-50%) scaleX(${baseDraw})`, transformOrigin: "left center", borderRadius: u * 0.08 }} />
          {/* bars: bloom rich → collapse dead → revive (olive on the worksheet) */}
          {Array.from({ length: N }).map((_, i) => {
            const env = 0.4 + 0.6 * Math.sin((Math.PI * i) / (N - 1));
            const live = 0.62 + 0.38 * Math.sin(t * 5.2 + i * 0.93);
            const h1 = bloom1 * (1 - collapse);
            const h2 = bloom2 * revive;
            const hgt = u * 5.1 * env * (0.55 + 0.45 * nz(i)) * live * Math.max(h1, h2);
            if (hgt < 0.5) return null;
            const col = h2 > 0 ? (isLite ? OLIVE : LIME) : LIME;
            return <div key={i} style={{ position: "absolute", left: `${(i / (N - 1)) * 96 + 2}%`, top: "50%", width: u * 0.55, height: hgt, background: col, borderRadius: u * 0.2, transform: "translate(-50%,-50%)" }} />;
          })}
          {/* the strike (drawn beat 2, erased beat 3) — bold + angled so it clearly CROSSES the dead line */}
          <div style={{ position: "absolute", left: "1%", top: "50%", width: "98%", height: u * 0.52, background: SILVER_SOFT, borderRadius: u * 0.26, transform: `translateY(-50%) rotate(-2.2deg) scaleX(${strikeW})`, transformOrigin: "left center", boxShadow: `0 0 ${u * 0.7}px rgba(0,0,0,0.55)` }} />
        </div>
        {/* the SKIP gesture — a big skip-forward glyph sweeps across the dead row on 'skips', enacting what everyone does */}
        {struck > 0 && revive < 1 && (
          <div style={{ position: "absolute", left: `${lerp(30, 38.5, struck)}%`, top: "47%", transform: `translate(-50%,-50%) scale(${(0.7 + 0.5 * struck) * (1 - revive * 0.4)})`, opacity: struck * (1 - revive) * 0.92 }}>
            <svg width={u * 7} height={u * 5} viewBox="0 0 30 22">
              <path d="M2 3 L13.5 11 L2 19 Z" fill="#8a93a8" />
              <path d="M14 3 L25.5 11 L14 19 Z" fill="#8a93a8" />
              <rect x="26.5" y="3" width="2.6" height="16" rx="0.6" fill="#8a93a8" />
            </svg>
          </div>
        )}
        {/* ✕ skipped chip — stamps big at the row's right end, pops off on revive */}
        {struck > 0 && revive < 1 && (
          <div style={{ position: "absolute", left: "51%", top: "48.5%", transform: `translate(-50%,-50%) scale(${(0.7 + 0.5 * struck) * (1 + revive * 0.5)}) translateY(${-revive * u * 3}px)`, opacity: struck * (1 - revive) }}>
            <div style={{ background: isLite ? "#e3e7e9" : "#1a1f2b", border: `${u * 0.12}px solid #8a93a8`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.15}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.45, color: "#8a93a8", whiteSpace: "nowrap", boxShadow: `0 ${u * 0.4}px ${u * 1.1}px rgba(0,0,0,0.4)` }}>✕ skipped</div>
          </div>
        )}
        {/* timeline strip with cut markers (beat 3, inherits the CUT station's marks) */}
        {stripOn > 0 && (
          <div style={{ position: "absolute", left: `${stripX0}%`, top: "62%", width: u * stripW, height: u * 2.1, opacity: stripOn }}>
            <div style={{ position: "absolute", inset: 0, background: isLite ? WHITE : "#12151d", border: `${u * 0.11}px solid ${ink}`, borderRadius: u * 0.35, transform: `scaleX(${stripOn})`, transformOrigin: "left center", overflow: "hidden" }}>
              {[0.14, 0.36, 0.6, 0.86].map((p, i) => <div key={i} style={{ position: "absolute", left: `${p * 100}%`, top: "22%", width: "9%", height: "56%", background: isLite ? "#d9dee1" : "#2a3145", borderRadius: u * 0.15 }} />)}
            </div>
            {CUTS.map((c, i) => { const co = clamp01((t - 12.6 - i * 0.14) / 0.25);
              return <div key={i} style={{ position: "absolute", left: `${c * 100}%`, top: -u * 0.5, width: u * 0.22, height: u * 3.1, background: ink, opacity: co * 0.9, transform: "translateX(-50%)" }} />; })}
          </div>
        )}
        {/* music bed band slides UNDER the timeline on 'music' */}
        {musicOn > 0 && (
          <div style={{ position: "absolute", left: `${stripX0}%`, top: "70%", width: u * stripW, opacity: clamp01(musicOn * 1.6) }}>
            <div style={{ display: "flex", alignItems: "center", gap: u * 0.6, transform: `translateX(${(1 - musicOn) * -u * 8}px)` }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 1.5, color: acc, lineHeight: 1 }}>♪</span>
              <div style={{ position: "relative", flex: 1, height: u * 1.7, background: isLite ? `${OLIVE}26` : `${LIME}22`, border: `${u * 0.1}px solid ${acc}`, borderRadius: u * 0.85, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: `0 ${u * 0.5}px`, display: "flex", alignItems: "center", gap: u * 0.4 }}>
                  {Array.from({ length: 18 }).map((_, i) => <span key={i} style={{ flex: 1, height: u * 0.8 * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.2 + i * 0.7))), background: acc, opacity: 0.75, borderRadius: u * 0.1 }} />)}
                </div>
              </div>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, letterSpacing: "0.1em", color: inkSoft }}>MUSIC</span>
            </div>
          </div>
        )}
        {/* SFX diamonds: pop loose, then MAGNET-SNAP onto the cut markers on 'when.' */}
        {diamondsOn.map((dOn, i) => {
          if (dOn <= 0) return null;
          const sn = snaps[i];
          const tx = stripX0 + CUTS[i] * stripW; // % — cut marker position
          const x = lerp(loose[i].x, tx, sn);
          const y = lerp(loose[i].y, 60.4, sn);
          const flash = sn > 0 && sn < 1 ? Math.sin(sn * Math.PI) : sn === 1 && t < 17.6 ? Math.max(0, 1 - (t - 17.15) * 3) : 0;
          return (
            <React.Fragment key={i}>
              <Diamond x={x} y={y} u={u} c={acc} sc={(0.6 + 0.4 * dOn) * (1 + flash * 0.25)} o={dOn} flash={flash} />
              {sn > 0.9 && flash > 0.15 && <div style={{ position: "absolute", left: `${tx}%`, top: "60.4%", width: u * (1.8 + flash * 1.4), height: u * (1.8 + flash * 1.4), borderRadius: "50%", border: `${u * 0.12}px solid ${acc}`, transform: "translate(-50%,-50%)", opacity: flash * 0.7 }} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  /* ================== BEAT 4 — presentation vs motion design (hidden, one clean panel) ================== */
  const Comparison = () => {
    if (t < 18.1 || t > 26.3) return null;
    const on = clamp01((t - 18.3) / 0.45) * (1 - clamp01((t - 25.43) / 0.5));
    const divider = clamp01((t - 18.65) / 0.5);
    const leftOn = clamp01((t - 20.61) / 0.5);
    const rightOn = clamp01((t - 22.93) / 0.4);
    const titleWipe = clamp01((t - 23.05) / 0.45);
    const chartDraw = clamp01((t - 23.3) / 0.7);
    const cardPop = clamp01((t - 23.7) / 0.35);
    const pulses = [24.29, 24.55, 24.81];
    const bump = pulses.reduce((m, p) => Math.max(m, Math.exp(-Math.pow((t - p) / 0.09, 2))), 0);
    const sfxOn = clamp01((t - 24.29) / 0.3);
    return (
      <div style={{ position: "absolute", inset: 0, opacity: on }}>
        <H1 t={t} u={u} in0={18.65} out={25.5} color={ink}>THE WHOLE <Marker u={u} t={t} at={18.65} base={ink}>DIFFERENCE</Marker></H1>
        {/* ONE comparison panel */}
        <div style={{ position: "absolute", left: "50%", top: "55%", transform: "translate(-50%,-50%)", width: u * 58, height: u * 25, background: WHITE, border: `${u * 0.14}px solid ${RAISIN}`, borderRadius: u * 1.0, boxShadow: `0 ${u * 1.0}px ${u * 2.8}px rgba(15,18,26,0.16)` }}>
          {/* divider */}
          <div style={{ position: "absolute", left: "50%", top: "6%", bottom: "6%", width: u * 0.12, background: "#c8cdd2", transform: `scaleY(${divider})`, transformOrigin: "center top" }} />
          {/* LEFT — the dead slide: assembles once, never moves again */}
          <div style={{ position: "absolute", left: "6%", top: "10%", width: "38%", opacity: leftOn, transform: `translateY(${(1 - leftOn) * u * 1}px)` }}>
            <div style={{ border: `${u * 0.1}px solid #b5bfc2`, borderRadius: u * 0.6, overflow: "hidden", filter: "saturate(0)" }}>
              <div style={{ height: u * 2.6, background: "#d9dee1", display: "flex", alignItems: "center", paddingLeft: u * 0.9 }}>
                <div style={{ width: "55%", height: u * 0.85, background: "#8a9096", borderRadius: u * 0.2 }} />
              </div>
              <div style={{ padding: `${u * 1.0}px ${u * 0.9}px`, display: "flex", flexDirection: "column", gap: u * 0.75, background: "#eef0f1" }}>
                {[0.85, 0.7, 0.78].map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 0.5 }}>
                    <span style={{ width: u * 0.5, height: u * 0.5, borderRadius: "50%", background: "#9aa3a8", flexShrink: 0 }} />
                    <div style={{ width: `${w * 100}%`, height: u * 0.6, background: "#b5bfc2", borderRadius: u * 0.2 }} />
                  </div>
                ))}
              </div>
            </div>
            {/* the flat dead line beneath it */}
            <div style={{ marginTop: u * 1.2, height: u * 0.18, background: "#b5bfc2", borderRadius: u * 0.1, width: "86%", marginLeft: "7%" }} />
            <div style={{ marginTop: u * 1.0, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.16em", color: "#8a9096" }}>presentation</div>
          </div>
          {/* RIGHT — the same content ALIVE */}
          <div style={{ position: "absolute", right: "6%", top: "10%", width: "38%", opacity: rightOn }}>
            <div style={{ border: `${u * 0.11}px solid ${RAISIN}`, borderRadius: u * 0.6, overflow: "hidden", background: WHITE, transform: `translateY(${Math.sin(t * 3.1) * u * 0.06}px)` }}>
              <div style={{ height: u * 2.6, background: "#f3f5f6", borderBottom: `${u * 0.08}px solid #d5d9dd`, display: "flex", alignItems: "center", paddingLeft: u * 0.9, position: "relative" }}>
                <div style={{ width: "55%", height: u * 0.85, background: RAISIN, borderRadius: u * 0.2, clipPath: `inset(0 ${(1 - titleWipe) * 100}% 0 0)` }} />
                {sfxOn > 0 && <Diamond x={0} y={0} u={u * 0.9} c={OLIVE} sc={1 + bump * 0.5} o={sfxOn} flash={bump} />}
              </div>
              <div style={{ padding: `${u * 0.8}px ${u * 0.9}px`, display: "flex", gap: u * 0.8, alignItems: "stretch" }}>
                {/* small chart drawing itself */}
                <div style={{ flex: 1.4, background: "#f3f5f6", borderRadius: u * 0.4, padding: u * 0.5, position: "relative" }}>
                  <svg width="100%" height={u * 4.2} viewBox="0 0 60 20" preserveAspectRatio="none">
                    <path d="M2 17 L14 13 L26 14.5 L38 8 L50 9 L58 3" fill="none" stroke={OLIVE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={80} strokeDashoffset={80 * (1 - chartDraw)} />
                    <circle cx={58} cy={3} r={2.1} fill={OLIVE} opacity={chartDraw * (0.7 + bump * 0.3)} />
                  </svg>
                  {sfxOn > 0 && <div style={{ position: "absolute", right: u * 0.3, top: u * 0.3 }}><Diamond x={0} y={0} u={u * 0.9} c={OLIVE} sc={1 + bump * 0.5} o={sfxOn} flash={bump} /></div>}
                </div>
                {/* card popping with overshoot */}
                <div style={{ flex: 1, background: WHITE, border: `${u * 0.09}px solid ${RAISIN}`, borderRadius: u * 0.4, padding: u * 0.5, transform: `scale(${0.7 + 0.3 * interpolate(cardPop, [0, 1], [0, 1], { easing: EASE_OVER })}) rotate(${(1 - cardPop) * 4}deg)`, opacity: cardPop, position: "relative", display: "flex", flexDirection: "column", gap: u * 0.4, justifyContent: "center" }}>
                  <div style={{ width: "70%", height: u * 0.55, background: RAISIN, borderRadius: u * 0.15 }} />
                  <div style={{ width: "50%", height: u * 0.55, background: "#b5bfc2", borderRadius: u * 0.15 }} />
                  {sfxOn > 0 && <div style={{ position: "absolute", right: -u * 0.4, top: -u * 0.4 }}><Diamond x={0} y={0} u={u * 0.9} c={OLIVE} sc={1 + bump * 0.5} o={sfxOn} flash={bump} /></div>}
                </div>
              </div>
            </div>
            {/* the waveform beneath — bumps in sync with every pulse */}
            <div style={{ marginTop: u * 0.9, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.3, height: u * 1.9 }}>
              {Array.from({ length: 16 }).map((_, i) => {
                const env = 0.35 + 0.65 * Math.sin((Math.PI * i) / 15);
                const h = u * (0.35 + 1.5 * env * (0.25 + 0.75 * bump) * (0.6 + 0.4 * nz(i + 40)));
                return <span key={i} style={{ width: u * 0.5, height: h, background: OLIVE, borderRadius: u * 0.15, opacity: rightOn }} />;
              })}
            </div>
            <div style={{ marginTop: u * 0.6, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.16em", color: RAISIN }}>motion design</div>
          </div>
        </div>
      </div>
    );
  };

  /* ================== BEATS 5–7 — Claude assembles the pieces (fly-in → docks → doubts) ================== */
  const Rail = () => {
    if (t < 25.6 || t > 45.2) return null;
    const on = clamp01((t - 25.85) / 0.4) * (1 - clamp01((t - 44.3) / 0.55));
    const pos = skf([
      { t: 25.43, x: 27, y: 52, s: 1, dim: 0, fr: 0 },
      { t: 34.25, x: 27, y: 52, s: 1, dim: 0, fr: 0 },
      { t: 34.85, x: 16.5, y: 85.5, s: 0.46, dim: 0, fr: 0 },
      { t: 46, x: 16.5, y: 85.5, s: 0.46, dim: 0, fr: 0 },
    ], frame);
    const CHIPS = ["TRANSCRIBE", "PLAN", "VISUALS", "SFX", "MUSIC"];
    const TICKS = [28.69, 29.89, 31.63, 32.63, 33.79];
    const flipAt = (i: number) => clamp01((t - 36.55 - i * 0.15) / 0.18); // ✓ → ? cascade
    const railInk = isLite ? RAISIN : SILVER;
    // Iron-Man assembly: a Claude core pulls five capability pieces in, one per spoken point, snapping them into a ring
    const cx = 23, cy = 6.6, Rx = 15.5, Ry = 5.2;           // local u
    const ANG = [90, 162, 234, 306, 18];                     // pentagon (deg)
    const slot = (i: number) => { const a = ANG[i] * Math.PI / 180; return { x: cx + Rx * Math.cos(a), y: cy - Ry * Math.sin(a) }; };
    const coreOn = clamp01((t - 25.95) / 0.45);
    const assembled = clamp01((t - TICKS[4] - 0.1) / 0.5); // all five locked → the "one"
    const lastSnap = TICKS.reduce((m, tk) => Math.max(m, t >= tk && t < tk + 0.4 ? Math.sin(clamp01((t - tk) / 0.4) * Math.PI) : 0), 0);
    // precompute each piece's live position so the tractor-beam and the piece stay attached
    const P = CHIPS.map((c, i) => {
      const snap = clamp01((t - TICKS[i]) / 0.4);
      const e = interpolate(snap, [0, 1], [0, 1], { easing: EASE_OVER });
      const s = slot(i);
      const sx = cx + (s.x - cx) * 2.35, sy = cy + (s.y - cy) * 2.35; // scattered start, further out along the radial
      return { c, i, snap, e, px: lerp(sx, s.x, e), py: lerp(sy, s.y, e), flash: snap > 0 && snap < 1 ? Math.sin(snap * Math.PI) : 0, flip: flipAt(i) };
    });
    return (
      <div style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%,-50%) scale(${pos.s})`, width: u * 46, height: u * 14, opacity: on }}>
        {/* tractor-beams: Claude core pulls each piece in, then keeps it wired to the assembled whole */}
        <svg width={u * 46} height={u * 14} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {P.map((p) => p.snap <= 0.12 ? null : (
            <line key={p.c} x1={u * cx} y1={u * cy} x2={u * p.px} y2={u * p.py} stroke={acc} strokeWidth={u * 0.14} strokeLinecap="round" strokeDasharray={`${u * 0.9} ${u * 0.6}`} strokeDashoffset={-t * u * 4} opacity={(0.35 + 0.25 * assembled) * p.snap * (1 - p.flip * 0.7)} />
          ))}
        </svg>
        {/* ghost slots waiting to be filled */}
        {CHIPS.map((c, i) => { const s = slot(i); const snap = clamp01((t - TICKS[i]) / 0.4);
          return <div key={"g" + c} style={{ position: "absolute", left: u * s.x, top: u * s.y, transform: "translate(-50%,-50%)", width: u * 9.4, height: u * 3.0, borderRadius: u * 0.45, border: `${u * 0.09}px dashed ${isLite ? "#c3c9cd" : "#2a3145"}`, opacity: (1 - snap) * 0.55 * coreOn }} />; })}
        {/* the five capability pieces fly in and lock into the ring, one per spoken point */}
        {P.map((p) => {
          if (p.snap <= 0) return null;
          const lit = p.flip < 0.5;
          const rot = (1 - p.e) * [-19, 15, -13, 16, -15][p.i];
          const tickPop = clamp01((t - TICKS[p.i] - 0.12) / 0.25);
          return (
            <div key={p.c} style={{ position: "absolute", left: u * p.px, top: u * p.py, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${0.9 + 0.1 * p.e})`, opacity: p.snap }}>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: u * 0.5, background: isLite ? WHITE : "#12151d", border: `${u * 0.11}px solid ${lit ? railInk : isLite ? "#b5bfc2" : "#2a3145"}`, borderRadius: u * 0.5, padding: `${u * 0.36}px ${u * 0.72}px`, whiteSpace: "nowrap", boxShadow: p.flash > 0.02 ? `0 0 ${u * (0.5 + p.flash * 1.8)}px ${acc}` : `0 ${u * 0.3}px ${u * 0.9}px rgba(0,0,0,${isLite ? 0.14 : 0.4})` }}>
                <span style={{ width: u * 0.72, height: u * 0.72, borderRadius: "50%", background: lit ? acc : "#8a9096" }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.06em", color: lit ? railInk : isLite ? "#8a9096" : SILVER_MID }}>{p.c}</span>
                {tickPop > 0 && (
                  <div style={{ position: "absolute", right: -u * 0.85, top: -u * 0.85, transform: `scale(${0.5 + 0.5 * interpolate(tickPop, [0, 1], [0, 1], { easing: EASE_OVER })}) rotateX(${p.flip * 180}deg)`, opacity: tickPop }}>
                    {lit
                      ? <div style={{ width: u * 1.5, height: u * 1.5, borderRadius: "50%", background: acc, color: isLite ? WHITE : RAISIN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 0.95 }}>✓</div>
                      : <div style={{ width: u * 1.5, height: u * 1.5, borderRadius: "50%", background: "#2a3145", border: `${u * 0.08}px solid #4a5268`, color: "#8a93a8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.0, transform: "rotateX(180deg)" }}>?</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* the Claude core doing the assembling */}
        <div style={{ position: "absolute", left: u * cx, top: u * cy, transform: `translate(-50%,-50%) scale(${0.55 + 0.45 * interpolate(coreOn, [0, 1], [0, 1], { easing: EASE_OVER })})`, opacity: coreOn }}>
          {/* halo grows as the video assembles, flares on each snap */}
          <div style={{ position: "absolute", left: "50%", top: "50%", width: u * (6.6 + assembled * 2.2 + lastSnap * 1.6), height: u * (6.6 + assembled * 2.2 + lastSnap * 1.6), transform: "translate(-50%,-50%)", borderRadius: "50%", border: `${u * 0.12}px solid ${acc}`, opacity: 0.2 + 0.35 * assembled + 0.3 * lastSnap }} />
          <div style={{ position: "relative", width: u * 5.4, height: u * 5.4, borderRadius: u * 1.2, background: RAISIN, border: `${u * 0.12}px solid ${acc}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${u * 0.6}px ${u * 1.8}px rgba(0,0,0,0.4)` }}>
            <Img src={staticFile("logos/claude.svg")} style={{ width: u * 3.5, height: u * 3.5 }} />
          </div>
        </div>
      </div>
    );
  };

  /* ================== TASTE plate (beat 7 stamp → beats 8–9 tag) ================== */
  const TastePlate = () => {
    if (t < 42.5 || t > 55.8) return null;
    const reveal = clamp01((t - 42.67) / 0.35);
    const pop = interpolate(clamp01((t - 42.67) / 0.45), [0, 1], [0.85, 1], { easing: EASE_OVER });
    const pos = skf([
      { t: 42.67, x: 50, y: 72, s: 1, dim: 0, fr: 0 },
      { t: 43.55, x: 50, y: 72, s: 1, dim: 0, fr: 0 },
      { t: 44.25, x: 10.5, y: 10, s: 0.36, dim: 0, fr: 0 },
      { t: 56, x: 10.5, y: 10, s: 0.36, dim: 0, fr: 0 },
    ], frame);
    const out = 1 - clamp01((t - 55.1) / 0.5);
    return (
      <div style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%,-50%) scale(${pos.s * pop})`, clipPath: `inset(-8% ${(1 - reveal) * 102 - 1}% -8% -1%)`, opacity: out }}>
        <div style={{ background: LIME, padding: `${u * 0.7}px ${u * 2.0}px`, borderRadius: u * 0.35, transform: "rotate(-1.2deg)", boxShadow: `0 ${u * 0.8}px ${u * 2.2}px rgba(0,0,0,0.5)` }}>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 5.2, color: RAISIN, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap" }}>TASTE</span>
        </div>
      </div>
    );
  };

  /* ================== BEAT 8 — the feedback gate + detour (panel, dark) ================== */
  const FeedbackGate = () => {
    if (t < 44.6 || t > 52.8) return null;
    const on = clamp01((t - 44.9) / 0.4) * (1 - clamp01((t - 52.19) / 0.45));
    const LANE_Y = 46, BEND_X = 37, BTN_X = 47, GATE_X = 43.2;
    const eject = clamp01((t - 45.57) / 0.35);
    const gate = clamp01((t - 47.09) / 0.14);
    const bend = clamp01((t - 48.89) / 0.4);
    const downCam = clamp01((t - 49.3) / 1.3); // the finished video's fall — drives both the card and the camera
    // card journey: eject (45.57) → race right (→47.0) → recoil (47.09) → detour down (48.89→50.6)
    let cx = 10, cy = LANE_Y, rot = -5;
    if (t >= 45.57) {
      const race = clamp01((t - 45.57) / 1.45);
      cx = lerp(11, 41.3, interpolate(race, [0, 1], [0, 1], { easing: EASE }));
      rot = -5 + race * 3 + Math.sin(race * 14) * (1 - race) * 3; // tumble
    }
    if (t >= 47.09) {
      const rec = clamp01((t - 47.09) / 0.35);
      cx = lerp(41.3, 38.5, interpolate(rec, [0, 1], [0, 1], { easing: EASE_OVER }));
      rot = -2 + Math.sin(rec * Math.PI) * -4;
    }
    if (t >= 48.89) {
      const slide = clamp01((t - 48.89) / 0.5);
      cx = lerp(38.5, BEND_X, slide);
      cy = lerp(LANE_Y, 118, interpolate(downCam, [0, 1], [0, 1], { easing: EASE }));
      rot = -2 + downCam * 6;
    }
    const laneDraw = clamp01((t - 45.2) / 0.5);
    const downDraw = clamp01((t - 48.89) / 0.45);
    // camera tracks DOWN with the finished video as it detours off-screen (parallax follow)
    const camY = -interpolate(downCam, [0, 1], [0, 1], { easing: EASE }) * H * 0.14;
    return (
      <div style={{ position: "absolute", inset: 0, opacity: on }}>
        {/* near plane — headline + human counterpoint drift only slightly (parallax depth) */}
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${camY * 0.3}px)` }}>
          <H1 t={t} u={u} in0={45.0} out={52.3} color={SILVER}>GIVE IT <Marker u={u} t={t} at={48.89}>FEEDBACK</Marker></H1>
          <div style={{ position: "absolute", left: "7%", top: "84%", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.2, color: SILVER_SOFT, opacity: clamp01((t - 51.43) / 0.45), whiteSpace: "nowrap" }}>like a real editor.</div>
        </div>
        {/* tracked world — the camera follows the falling card downward */}
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${camY}px)` }}>
          {/* AI chip (the ejector) */}
          <div style={{ position: "absolute", left: "9%", top: `${LANE_Y}%`, transform: `translate(-50%,-50%) scale(${1 + (eject > 0 && eject < 1 ? Math.sin(eject * Math.PI) * 0.08 : 0)})` }}>
            <div style={{ background: "#12151d", border: `${u * 0.12}px solid ${SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.7}px ${u * 1.2}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.5, letterSpacing: "0.1em", color: SILVER }}>AI</div>
          </div>
          {/* dashed lane → upload button; bends down on 'feedback' */}
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <path d={`M ${W * 0.125} ${H * LANE_Y / 100} L ${W * (0.125 + 0.31 * laneDraw)} ${H * LANE_Y / 100}`} stroke="#4a5268" strokeWidth={u * 0.16} strokeDasharray={`${u * 1.1} ${u * 0.8}`} fill="none" />
            {downDraw > 0 && <path d={`M ${W * BEND_X / 100} ${H * LANE_Y / 100} L ${W * BEND_X / 100} ${H * (LANE_Y + 54 * downDraw) / 100}`} stroke={LIME} strokeWidth={u * 0.2} strokeDasharray={`${u * 1.1} ${u * 0.8}`} fill="none" opacity={0.9} />}
          </svg>
          {/* lime detour arrow at the bend */}
          {bend > 0 && (
            <div style={{ position: "absolute", left: `${BEND_X}%`, top: `${LANE_Y + 5}%`, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * interpolate(bend, [0, 1], [0, 1], { easing: EASE_OVER })})`, opacity: bend }}>
              <svg width={u * 3.4} height={u * 3.8} viewBox="0 0 20 23">
                <path d="M10 1 L10 15 M4 10.5 L10 17 L16 10.5" fill="none" stroke={LIME} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          {/* upload button at the lane's end — the real destination: post to YouTube */}
          <div style={{ position: "absolute", left: `${BTN_X}%`, top: `${LANE_Y}%`, transform: "translate(-50%,-50%)", opacity: clamp01((t - 45.4) / 0.4) }}>
            <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, background: "#12151d", border: `${u * 0.12}px solid ${SILVER_MID}`, borderRadius: u * 2, padding: `${u * 0.55}px ${u * 1.35}px`, filter: gate > 0.5 ? "saturate(0.4) brightness(0.75)" : "none" }}>
              <Img src={staticFile("logos/youtube.svg")} style={{ width: u * 2.6, height: u * 1.85 }} />
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.08em", color: gate > 0.5 ? "#6a7288" : SILVER }}>POST</span>
            </div>
          </div>
          {/* the gate: two barrier bars snap shut in front of the button */}
          {t >= 47.0 && (() => { const g = interpolate(gate, [0, 1], [0, 1], { easing: EASE });
            return (
              <div style={{ position: "absolute", left: `${GATE_X}%`, top: `${LANE_Y}%`, transform: "translate(-50%,-50%)" }}>
                <div style={{ position: "absolute", left: -u * 0.35, top: -u * 5.2 + (1 - g) * -u * 2.5, width: u * 0.7, height: u * 5.0, background: SILVER_MID, borderRadius: u * 0.25, boxShadow: `0 0 ${u * 0.8}px rgba(0,0,0,0.6)` }} />
                <div style={{ position: "absolute", left: -u * 0.35, top: u * 0.2 + (1 - g) * u * 2.5, width: u * 0.7, height: u * 5.0, background: SILVER_MID, borderRadius: u * 0.25, boxShadow: `0 0 ${u * 0.8}px rgba(0,0,0,0.6)` }} />
                {gate > 0.9 && t < 47.6 && <div style={{ position: "absolute", left: -u * 1.6, top: -u * 1.6, width: u * 3.2, height: u * 3.2, borderRadius: "50%", border: `${u * 0.14}px solid ${SILVER}`, opacity: Math.max(0, 1 - (t - 47.23) * 3.2) }} />}
              </div>
            ); })()}
          {/* the rough AI-output card on its journey — camera stays with it as it falls */}
          {t >= 45.57 && cy < 116 && <ClipCard x={cx} y={cy} u={u} sc={0.6} rot={rot} rough offset={false} />}
        </div>
      </div>
    );
  };

  /* ================== BEATS 9–12 — the review room (flip in → hero → dock → notes fly) ================== */
  const NOTES = [
    { pct: 0.22, at: 60.63, text: "a different clip", row: 0 },
    { pct: 0.41, at: 61.79, text: "better pacing", row: 1 },
    { pct: 0.63, at: 63.09, text: "different SFX", row: 0 },
    { pct: 0.82, at: 64.35, text: "different visuals", row: 1 },
  ];
  const LIFTS = NOTES.map((_, i) => 69.6 + i * 1.35); // flight starts (land ≈ start+1.4)
  const LANDS = [71.05, 72.63, 73.65, 74.79];

  const ReviewRoom = () => {
    if (t < 53.5 || t > 76.2) return null;
    const born = clamp01((t - 53.63) / 0.45);
    const flip = interpolate(born, [0, 1], [88, 0], { easing: EASE_OVER });
    const out = 1 - clamp01((t - 75.43) / 0.5);
    const pos = skf([
      { t: 53.63, x: 28, y: 55, s: 1, dim: 0, fr: 0 },
      { t: 54.97, x: 28, y: 55, s: 1, dim: 0, fr: 0 },
      { t: 55.72, x: 50, y: 50, s: 1.6, dim: 0, fr: 0 },
      { t: 65.1, x: 50, y: 50, s: 1.6, dim: 0, fr: 0 },
      { t: 65.75, x: 16, y: 78, s: 0.62, dim: 0, fr: 0 },
      { t: 77, x: 16, y: 78, s: 0.62, dim: 0, fr: 0 },
    ], frame);
    const load = clamp01((t - 54.4) / 0.4);      // clip drops in, viewport fills
    const drop = clamp01((t - 54.4) / 0.35);
    // playhead: scrub pass, then hops to each note
    let ph = 0.04;
    const scrub = clamp01((t - 55.89) / 0.94);
    if (scrub > 0) ph = lerp(0.04, 0.94, scrub);
    for (const n of NOTES) { const hp = clamp01((t - n.at + 0.22) / 0.22); if (hp > 0) ph = lerp(ph, n.pct, interpolate(hp, [0, 1], [0, 1], { easing: EASE })); }
    const flicker = scrub > 0 && scrub < 1;
    const seed = Math.floor(t * 11);
    const sprinkleN = 13;
    const noteCount = NOTES.filter((n) => t >= n.at).length;
    const CUTS = [0.22, 0.5, 0.78];
    const IW = 34; // base window width in u
    const stripW = 26, stripX = 0.9;
    // real frames pulled from this very video — the review room reviews actual footage
    const STILLS = ["stills/frame1.jpg", "stills/frame2.jpg", "stills/frame3.jpg", "stills/frame4.jpg", "stills/frame5.jpg", "stills/frame6.jpg", "stills/frame7.jpg", "stills/frame8.jpg"];
    const vpIdx = flicker ? Math.floor(nz(seed) * STILLS.length) % STILLS.length : Math.min(STILLS.length - 1, Math.floor(ph * STILLS.length));
    return (
      <div style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%,-50%) scale(${pos.s}) rotateY(${flip}deg)`, width: u * IW, opacity: born * out, perspective: 800 }}>
        <div style={{ background: "#12151d", border: `${u * 0.13}px solid #2a3145`, borderRadius: u * 0.9, overflow: "hidden", boxShadow: `0 ${u * 1.4}px ${u * 3.4}px rgba(0,0,0,0.55)` }}>
          {/* dark player chrome */}
          <div style={{ height: u * 2.6, background: "#181c28", borderBottom: `${u * 0.09}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.55, padding: `0 ${u * 1.0}px` }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: "#3a4256" }} />)}
            <span style={{ marginLeft: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.04em", color: SILVER_SOFT }}>review-room</span>
            {noteCount > 0 && <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.9, color: LIME }}>NOTES: {noteCount}</span>}
          </div>
          <div style={{ display: "flex", gap: u * 0.7, padding: u * 0.9 }}>
            <div style={{ width: u * stripW }}>
              {/* viewport */}
              <div style={{ position: "relative", width: "100%", height: u * 13.6, background: "#0d1017", borderRadius: u * 0.5, overflow: "hidden" }}>
                {load < 1 && <div style={{ position: "absolute", inset: u * 1.2, border: `${u * 0.1}px dashed #2e3648`, borderRadius: u * 0.4, opacity: 1 - load }} />}
                {load > 0 && (
                  <>
                    {/* an actual frame of this video, loaded in the player */}
                    <Img src={staticFile(STILLS[vpIdx])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: load }} />
                    {/* monitor grade so it reads like footage on a screen */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,8,12,0.30) 0%, transparent 24%, transparent 64%, rgba(6,8,12,0.52) 100%)", opacity: load }} />
                    {/* transport control, bottom-left */}
                    <div style={{ position: "absolute", left: u * 0.7, bottom: u * 0.7, width: u * 2.0, height: u * 2.0, borderRadius: "50%", background: "rgba(10,13,20,0.5)", border: `${u * 0.08}px solid rgba(255,255,255,0.5)`, display: "flex", alignItems: "center", justifyContent: "center", opacity: load }}>
                      <div style={{ width: 0, height: 0, borderTop: `${u * 0.42}px solid transparent`, borderBottom: `${u * 0.42}px solid transparent`, borderLeft: `${u * 0.66}px solid rgba(255,255,255,0.85)`, marginLeft: u * 0.18 }} />
                    </div>
                  </>
                )}
                {flicker && <div style={{ position: "absolute", inset: 0, background: WHITE, opacity: nz(seed) * 0.06, mixBlendMode: "overlay" }} />}
                {/* note cards hang over the viewport, anchored to their pins */}
                {NOTES.map((n, i) => {
                  const o = clamp01((t - n.at) / 0.3);
                  const lifted = clamp01((t - LIFTS[i]) / 0.25);
                  if (o <= 0 || lifted >= 1) return null;
                  return (
                    <div key={i} style={{ position: "absolute", left: `${n.pct * 100}%`, bottom: n.row === 0 ? u * 0.6 : u * 4.2, transform: "translateX(-50%)", opacity: o * (1 - lifted) }}>
                      <NoteCard u={u} text={n.text} sc={0.75 + 0.25 * interpolate(o, [0, 1], [0, 1], { easing: EASE_OVER })} stem={n.row === 0 ? 0.7 : 0} />
                    </div>
                  );
                })}
                {/* first demo note at the playhead on 'note' — hangs left of the pin so it never clips the window edge */}
                {t >= 58.47 && t < 60.63 && (
                  <div style={{ position: "absolute", left: "87%", bottom: u * 0.7, transform: "translateX(-50%)", opacity: clamp01((t - 58.47) / 0.3) }}>
                    <NoteCard u={u} text="✎ note" />
                  </div>
                )}
              </div>
              {/* filmstrip scrubber */}
              <div style={{ position: "relative", marginTop: u * 0.55, height: u * 2.5, background: "#0d1017", borderRadius: u * 0.35, overflow: "visible" }}>
                <div style={{ position: "absolute", inset: u * 0.25, display: "flex", gap: u * 0.22 }}>
                  {Array.from({ length: 12 }).map((_, i) => { const o = clamp01((t - 54.45 - i * 0.07) / 0.2);
                    return (
                      <div key={i} style={{ flex: 1, background: "#1c2233", borderRadius: u * 0.15, opacity: o, overflow: "hidden", position: "relative" }}>
                        <Img src={staticFile(STILLS[i % STILLS.length])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ); })}
                </div>
                {/* inherited cut markers */}
                {CUTS.map((c, i) => <div key={i} style={{ position: "absolute", left: `${c * 100}%`, top: -u * 0.25, width: u * 0.14, height: u * 3.0, background: SILVER, opacity: 0.55 * load, transform: "translateX(-50%)" }} />)}
                {/* sprinkle of faint pins on 'every single frame' */}
                {Array.from({ length: sprinkleN }).map((_, i) => { const o = clamp01((t - 59.37 - i * 0.026) / 0.18);
                  return <span key={i} style={{ position: "absolute", left: `${4 + (i / (sprinkleN - 1)) * 92}%`, top: -u * 0.65, width: u * 0.4, height: u * 0.4, borderRadius: "50%", background: LIME, opacity: o * 0.3, transform: "translateX(-50%)" }} />; })}
                {/* real pins */}
                {NOTES.map((n, i) => { const o = clamp01((t - n.at) / 0.2);
                  return <span key={i} style={{ position: "absolute", left: `${n.pct * 100}%`, top: -u * 0.75, width: u * 0.62, height: u * 0.62, borderRadius: "50%", background: LIME, opacity: o, transform: `translateX(-50%) scale(${0.5 + 0.5 * interpolate(o, [0, 1], [0, 1], { easing: EASE_OVER })})`, boxShadow: `0 0 ${u * 0.5}px ${LIME}88` }} />; })}
                {t >= 58.47 && t < 60.63 && <span style={{ position: "absolute", left: "94%", top: -u * 0.75, width: u * 0.62, height: u * 0.62, borderRadius: "50%", background: LIME, opacity: clamp01((t - 58.47) / 0.2), transform: "translateX(-50%)" }} />}
                {/* playhead */}
                <div style={{ position: "absolute", left: `${ph * 100}%`, top: -u * 0.45, width: u * 0.2, height: u * 3.4, background: SILVER, transform: "translateX(-50%)", opacity: load, borderRadius: u * 0.1 }}>
                  <div style={{ position: "absolute", left: "50%", top: -u * 0.5, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: `${u * 0.5}px solid transparent`, borderRight: `${u * 0.5}px solid transparent`, borderTop: `${u * 0.6}px solid ${SILVER}` }} />
                </div>
              </div>
            </div>
            {/* notes rail on the right edge */}
            <div style={{ flex: 1, border: `${u * 0.09}px dashed #2e3648`, borderRadius: u * 0.4, padding: u * 0.5, display: "flex", flexDirection: "column", gap: u * 0.45 }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.72, letterSpacing: "0.14em", color: "#5a6478" }}>NOTES</span>
              {NOTES.map((n, i) => { const o = clamp01((t - n.at - 0.15) / 0.25);
                return <div key={i} style={{ height: u * 1.0, borderRadius: u * 0.2, background: "#1c2233", border: `${u * 0.06}px solid #2e3648`, opacity: o }} />; })}
            </div>
          </div>
          {/* the detoured card dropping in (beat 9) */}
          {t >= 54.15 && t < 54.85 && (
            <div style={{ position: "absolute", left: "42%", top: `${lerp(-28, 26, interpolate(drop, [0, 1], [0, 1], { easing: EASE }))}%`, transform: "translate(-50%,-50%)" }}>
              <ClipCard x={0} y={0} u={u} sc={0.55} rot={lerp(-8, 0, drop)} rough offset={false} />
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ================== BEAT 12 — taste.md: notes become rules (panel, light) ================== */
  const RULES_OLD = ["- open b-roll on the action", "- no lime text on white", "- one clip per spoken point"];
  const RULES_NEW = ["- use a different clip", "- tighten the pacing", "- vary the sound effects", "- refresh the visuals"];

  const TasteFile = () => {
    if (t < 68.2 || t > 80.9) return null;
    const on = clamp01((t - 68.35) / 0.45) * (1 - clamp01((t - 80.35) / 0.45));
    const pos = skf([
      { t: 68.27, x: 30, y: 42, s: 1, dim: 0, fr: 0 },
      { t: 75.43, x: 30, y: 42, s: 1, dim: 0, fr: 0 },
      { t: 76.05, x: 20, y: 42, s: 1, dim: 0, fr: 0 },
      { t: 81, x: 20, y: 42, s: 1, dim: 0, fr: 0 },
    ], frame);
    const landed = LANDS.filter((l) => t >= l).length;
    const savePulse = t >= 75.15 ? Math.max(0, 1 - (t - 75.15) * 2.2) : 0;
    const commit = t >= LANDS[3] ? Math.max(0, 1 - (t - LANDS[3]) * 1.7) : 0; // final note lands → the memory commits
    const elev = savePulse + commit;
    const learnPulse = t >= 76.03 && t < 76.6 ? Math.sin(clamp01((t - 76.03) / 0.55) * Math.PI) : 0;
    const glow = clamp01((t - 76.03) / 0.3) * (1 - clamp01((t - 77.0) / 0.55)); // brief glow on 'learns'
    return (
      <div style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%,-50%) scale(${1 + learnPulse * 0.03 + commit * 0.05})`, width: u * 33, opacity: on }}>
        <div style={{ position: "relative", background: WHITE, border: `${u * (0.12 + elev * 0.06)}px solid ${elev > 0.02 ? OLIVE : RAISIN}`, borderRadius: u * 0.9, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3.4}px rgba(15,18,26,0.24), 0 0 ${u * (0.4 + elev * 4.5)}px rgba(122,154,0,${0.1 + elev * 0.4})` }}>
          <div style={{ height: u * 2.6, background: savePulse > 0 ? `rgba(122,154,0,${0.15 + savePulse * 0.5})` : "#f3f5f6", borderBottom: `${u * 0.09}px solid #d5d9dd`, display: "flex", alignItems: "center", gap: u * 0.55, padding: `0 ${u * 1.0}px` }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: "#c3c9cd" }} />)}
            <Img src={staticFile("logos/markdown-dark.svg")} style={{ width: u * 1.5, height: u * 0.93, marginLeft: u * 0.4 }} />
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: BODY }}>taste.md</span>
            {t >= 75.15 && <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: u * 0.35, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.15, letterSpacing: "0.04em", color: OLIVE, opacity: clamp01((t - 75.15) / 0.2), transform: `scale(${1 + savePulse * 0.25})` }}>✓ saved</span>}
          </div>
          <div style={{ padding: `${u * 0.9}px ${u * 1.2}px`, display: "flex", flexDirection: "column", gap: u * 0.62 }}>
            {RULES_OLD.map((r, i) => <span key={i} style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, color: BODY, whiteSpace: "nowrap" }}>{r}</span>)}
            {RULES_NEW.map((r, i) => {
              const o = clamp01((t - LANDS[i]) / 0.3);
              if (o <= 0) return <span key={i} style={{ fontFamily: MONO, fontSize: u * 1.0, color: "transparent", whiteSpace: "nowrap" }}>{r}</span>;
              return (
                <span key={i} style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: RAISIN, whiteSpace: "nowrap", background: `rgba(122,154,0,${(1 - clamp01((t - LANDS[i]) / 0.8)) * 0.3 + glow * 0.28})`, borderRadius: u * 0.2, transform: `translateX(${(1 - o) * u * 0.8}px)`, opacity: o, padding: `0 ${u * 0.3}px`, marginLeft: -u * 0.3 }}>{r}</span>
              );
            })}
          </div>
        </div>
        {/* RULES counter tile */}
        <div style={{ marginTop: u * 0.8, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: u * 0.7, background: WHITE, border: `${u * 0.11}px solid ${RAISIN}`, borderRadius: u * 0.5, padding: `${u * 0.45}px ${u * 1.1}px` }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.16em", color: BODY }}>RULES</span>
            <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.6, color: RAISIN, fontVariantNumeric: "tabular-nums" }}>{132 + landed}</span>
          </div>
        </div>
      </div>
    );
  };

  /* flying notes: lift off the docked review window, arc into taste.md */
  const FlyingNotes = () => {
    if (t < 69.4 || t > 75.3) return null;
    return (
      <>
        {NOTES.map((n, i) => {
          const p0 = LIFTS[i], p1 = LANDS[i];
          const p = clamp01((t - p0) / (p1 - p0));
          if (p <= 0 || p >= 1) return null;
          const e = interpolate(p, [0, 1], [0, 1], { easing: EASE });
          const sx = 16 + (n.pct - 0.5) * 15, sy = 76 + (n.row === 0 ? 4 : 1);
          const ex = 30, ey = 43 + i * 4.1;
          const mx = (sx + ex) / 2 - 5, my = Math.min(sy, ey) - 16;
          const bz = (a: number, b: number, c: number) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * b + e * e * c;
          return (
            <div key={i} style={{ position: "absolute", left: `${bz(sx, mx, ex)}%`, top: `${bz(sy, my, ey)}%`, transform: "translate(-50%,-50%)" }}>
              <NoteCard u={u} text={n.text} sc={1 - e * 0.5} o={1 - clamp01((p - 0.85) / 0.15)} />
            </div>
          );
        })}
      </>
    );
  };

  /* ================== BEAT 13 — the rule blocks the repeat mistake (hidden, light) ================== */
  const NeverTwice = () => {
    if (t < 76.0 || t > 80.8) return null;
    const on = clamp01((t - 76.2) / 0.4) * (1 - clamp01((t - 80.35) / 0.4));
    const SLOTS = [53.2, 60.7, 68.2, 75.7]; // slot centers; last = EMPTY
    const stripOn = clamp01((t - 76.1) / 0.5);
    // grey mistake clip: slides in on 'never', bounces on 'mistake'
    const approach = clamp01((t - 77.93) / 1.15);
    const bounce = clamp01((t - 79.13) / 0.32);
    let gx = lerp(93, 80.8, interpolate(approach, [0, 1], [0, 1], { easing: EASE }));
    if (bounce > 0) gx = lerp(80.8, 87.5, interpolate(bounce, [0, 1], [0, 1], { easing: EASE_OVER }));
    const gRot = bounce > 0 ? Math.sin(bounce * Math.PI) * -7 : 0;
    const xStamp = clamp01((t - 79.28) / 0.2);
    // the rule fires: streak from taste.md → barrier in front of the slot
    const streak = clamp01((t - 79.13) / 0.2);
    const barrier = clamp01((t - 79.28) / 0.15);
    // clean clip clicks in on 'twice'
    const click = clamp01((t - 79.51) / 0.26);
    const tick = clamp01((t - 79.72) / 0.25);
    const greyGone = clamp01((t - 79.8) / 0.4);
    return (
      <div style={{ position: "absolute", inset: 0, opacity: on }}>
        <H1 t={t} u={u} in0={76.4} color={ink}>NEVER <Marker u={u} t={t} at={79.51} base={ink}>TWICE</Marker></H1>
        {/* fresh mini-timeline, one empty slot */}
        <div style={{ position: "absolute", left: "49.5%", top: "45%", width: u * 30, height: u * 4.2, opacity: stripOn }}>
          <div style={{ position: "absolute", inset: 0, background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 0.5, transform: `scaleX(${stripOn})`, transformOrigin: "left center" }} />
          {SLOTS.map((s, i) => {
            const isEmpty = i === 3;
            const lx = ((s - 49.5) / 30) * 100; // local %
            if (!isEmpty) return (
              <div key={i} style={{ position: "absolute", left: `${lx}%`, top: "14%", width: "20%", height: "72%", transform: "translateX(-50%)", background: "#d9dee1", borderRadius: u * 0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.25, opacity: stripOn }}>
                {[0.5, 0.8, 0.6].map((h, j) => <span key={j} style={{ width: u * 0.35, height: `${h * 55}%`, background: "#8a9096", borderRadius: u * 0.1 }} />)}
              </div>
            );
            return (
              <div key={i} style={{ position: "absolute", left: `${lx}%`, top: "14%", width: "20%", height: "72%", transform: "translateX(-50%)" }}>
                <div style={{ position: "absolute", inset: 0, border: `${u * 0.12}px dashed #8a9096`, borderRadius: u * 0.3, opacity: 1 - click }} />
                {/* the clean alternative clicks flush */}
                {click > 0 && (
                  <div style={{ position: "absolute", inset: 0, background: "#eef1e2", border: `${u * 0.13}px solid ${OLIVE}`, borderRadius: u * 0.3, transform: `translateY(${(1 - interpolate(click, [0, 1], [0, 1], { easing: EASE_OVER })) * -u * 5}px) scaleY(${1 - (click > 0.8 && click < 1 ? Math.sin((click - 0.8) * 5 * Math.PI) * 0.06 : 0)})`, opacity: click, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.25 }}>
                    {[0.5, 0.8, 0.6].map((h, j) => <span key={j} style={{ width: u * 0.35, height: `${h * 55}%`, background: OLIVE, borderRadius: u * 0.1 }} />)}
                  </div>
                )}
                {tick > 0 && <div style={{ position: "absolute", left: "50%", top: -u * 1.7, transform: `translateX(-50%) scale(${0.5 + 0.5 * interpolate(tick, [0, 1], [0, 1], { easing: EASE_OVER })})`, width: u * 1.7, height: u * 1.7, borderRadius: "50%", background: OLIVE, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.0, opacity: tick }}>✓</div>}
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, top: u * 4.9, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.14em", color: BODY, opacity: stripOn }}>THE NEXT VIDEO</div>
        </div>
        {/* the rule streak + barrier */}
        {streak > 0 && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <path d={`M ${W * 0.34} ${H * 0.44} L ${W * (0.34 + 0.445 * streak)} ${H * (0.44 + 0.035 * streak)}`} stroke={OLIVE} strokeWidth={u * 0.3} strokeLinecap="round" fill="none" opacity={(1 - clamp01((t - 79.8) / 0.5)) * 0.9} strokeDasharray={`${u * 1.6} ${u * 0.9}`} />
          </svg>
        )}
        {barrier > 0 && <div style={{ position: "absolute", left: "78.9%", top: "45%", width: u * 0.55, height: u * 5.6 * interpolate(barrier, [0, 1], [0.2, 1], { easing: EASE_OVER }), background: OLIVE, borderRadius: u * 0.25, transform: "translate(-50%,-50%)", boxShadow: `0 0 ${u * 1.0}px rgba(122,154,0,0.55)` }} />}
        {/* the grey mistake clip (the rejected frame species) */}
        {t >= 77.93 && greyGone < 1 && (
          <div style={{ position: "absolute", left: `${gx}%`, top: "45%", transform: `translate(-50%,-50%) rotate(${gRot}deg)`, opacity: 1 - greyGone }}>
            <div style={{ position: "relative", width: u * 6.2, height: u * 3.2, background: "#c3c9cd", border: `${u * 0.12}px solid #8a9096`, borderRadius: u * 0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 0.25, filter: "saturate(0)" }}>
              {[0.5, 0.75, 0.55].map((h, j) => <span key={j} style={{ width: u * 0.35, height: `${h * 60}%`, background: "#8a9096", borderRadius: u * 0.1 }} />)}
              {xStamp > 0 && (
                <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${1.4 - 0.4 * xStamp})`, width: u * 2.0, height: u * 2.0, borderRadius: "50%", background: "#5a6068", color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * 1.2, opacity: xStamp }}>✕</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ================== BEAT 14 — a machine with taste (full face, dark) ================== */
  const Closer = () => {
    if (t < 80.35) return null;
    const settle = clamp01((t - 80.6) / 0.5);
    const badgeOn = clamp01((t - 80.6) / 0.4);
    const chipOn = clamp01((t - 85.11) / 0.3);
    const tick = clamp01((t - 81.35) / 0.3);
    const waveOn = clamp01((t - 80.9) / 0.4);
    const glide = clamp01((t - 85.59) / 0.95);
    const cardX = lerp(38, 116, interpolate(glide, [0, 1], [0, 1], { easing: EASE }));
    const cardY = 82 - (1 - interpolate(settle, [0, 1], [0, 1], { easing: EASE_OVER })) * 6;
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {/* no top-left headline — the polished clip-card gliding out + the taste.md badge carry the closer */}
        {/* taste.md docked badge (the studio's permanent memory stays behind) */}
        <div style={{ position: "absolute", left: "11%", top: "87%", transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * interpolate(badgeOn, [0, 1], [0, 1], { easing: EASE_OVER })})`, opacity: badgeOn }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: u * 0.6, background: "rgba(18,21,29,0.92)", border: `${u * 0.11}px solid ${SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px` }}>
            <Img src={staticFile("logos/markdown-silver.svg")} style={{ width: u * 1.5, height: u * 0.93 }} />
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: SILVER }}>taste.md</span>
            <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.05, color: LIME, fontVariantNumeric: "tabular-nums" }}>136</span>
          </div>
        </div>
        {/* TRAINED ON: OURS — the differentiator */}
        {chipOn > 0 && (
          <div style={{ position: "absolute", left: "24.5%", top: "87%", transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * interpolate(chipOn, [0, 1], [0, 1], { easing: EASE_OVER })})`, opacity: chipOn }}>
            <div style={{ background: RAISIN, border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.08em", color: LIME, whiteSpace: "nowrap" }}>TRAINED ON: OURS</div>
          </div>
        )}
        {/* the polished traveling clip-card — waveform badge + taste tick — glides out to Act 4 */}
        {settle > 0 && cardX < 112 && (
          <ClipCard x={cardX} y={cardY} u={u} sc={0.82} o={settle} wave={waveOn} tick={tick} t={t} rot={glide * 2} />
        )}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("footage/ls_th3_voice.m4a")} />
      <DarkBg u={u} gridOpacity={sk.fr} />
      <LightBg u={u} opacity={lite} />

      {/* ============ FOOTAGE ============ */}
      <FootageLayer sk={sk} u={u} src="footage/ls_th3.mp4" />

      {/* scrim for full-footage readability (after footage so it darkens it under the overlays) */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.5) 0%, transparent 26%, transparent 62%, rgba(8,10,14,0.7) 100%)`, opacity: full, pointerEvents: "none" }} />

      {/* ============ GRAPHICS WORLD (after footage: overlays legal on full-face beats) ============ */}
      <SoundStation />
      <Comparison />
      {/* beat 5 headline */}
      {t >= 25.9 && t < 34.6 && <H1 t={t} u={u} in0={26.2} out={34.0} color={ink}>WE DO A <Marker u={u} t={t} at={26.69} base={ink}>LOT</Marker></H1>}
      <Rail />
      {/* beat 6 headline (over full footage) */}
      {t >= 36.3 && t < 39.2 && <H1 t={t} u={u} in0={36.55} out={38.6} color={SILVER}>ACTUALLY <Marker u={u} t={t} at={37.19}>GOOD?</Marker></H1>}
      {/* beat 7 — no headline; the full face + docked '?' rail carry it into the TASTE plate reveal */}
      <TastePlate />
      <FeedbackGate />
      {/* beat 9 headline */}
      {t >= 53.2 && t < 55.6 && <H1 t={t} u={u} in0={53.63} out={55.1} color={ink}>THE <Marker u={u} t={t} at={53.63} base={ink}>REVIEW</Marker> ROOM</H1>}
      {/* beat 10 headline + counter */}
      {t >= 55.9 && t < 65.6 && (
        <>
          <H1 t={t} u={u} in0={58.2} out={65.0} color={ink}>A NOTE ON EVERY <Marker u={u} t={t} at={59.69} base={ink}>FRAME</Marker></H1>
          {(() => { const n = NOTES.filter((x) => t >= x.at).length; if (n === 0) return null;
            return (
              <div style={{ position: "absolute", right: "5%", top: "7%", opacity: clamp01((t - 60.63) / 0.3) * (1 - clamp01((t - 65.0) / 0.4)) }}>
                <div style={{ background: WHITE, border: `${u * 0.11}px solid ${RAISIN}`, borderRadius: u * 0.45, padding: `${u * 0.4}px ${u * 0.9}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.15, color: RAISIN, fontVariantNumeric: "tabular-nums" }}>NOTES: {n}</div>
              </div>
            ); })()}
        </>
      )}
      <ReviewRoom />
      {/* beat 11 headline (over full footage) */}
      {t >= 65.6 && t < 68.9 && <H1 t={t} u={u} in0={66.2} out={68.3} color={SILVER}>MOST <Marker u={u} t={t} at={67.33}>PROUD</Marker> OF</H1>}
      {/* beat 12 — headline + mono eyebrow removed per the text rule; taste.md is the hero and carries the beat. */}
      <TasteFile />
      <FlyingNotes />
      <NeverTwice />
      <Closer />

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default LSAct3;
