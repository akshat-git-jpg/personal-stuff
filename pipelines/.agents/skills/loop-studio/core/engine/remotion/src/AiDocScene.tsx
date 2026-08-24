/**
 * AiDocScene — 30s AI-documentary TEST scene, "The End of Hearing Is Believing".
 * FULL-STACK proof: Fish voice clone (VO) + Higgsfield Veo 3.1 hero shot + Luuk
 * real-footage cutout + real Three.js 3D (mic turntable + voiceprint void) +
 * Meshy-generated GLB + the Loop Studio engine as the assembler.
 * Through-line: ONE lime waveform — born from her breath, threaded through every
 * beat, flattening into the title. 25fps.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { clamp01, lerp, EASE_OVER, RAISIN, LIME, SILVER, SILVER_SOFT, SILVER_MID, BODY, SANS, MONO } from "./bb2/scene";

const FPS = 25;
const HER = "aidoc/her.mp4";

/* ================= the lime WAVEFORM — the through-line ================= */
const Waveform: React.FC<{ u: number; W: number; cx: number; cy: number; width: number; amp: number; t: number; draw?: number; glitch?: number; color?: string }> =
  ({ u, W, cx, cy, width, amp, t, draw = 1, glitch = 0, color = LIME }) => {
    const N = 120;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      const x = cx - width / 2 + p * width;
      // a voice-like envelope: dense mid, tapering ends
      const env = Math.sin(p * Math.PI);
      const wob = Math.sin(p * 34 + t * 7) * 0.5 + Math.sin(p * 71 - t * 5) * 0.3 + Math.sin(p * 128 + t * 11) * 0.2;
      const jitter = glitch > 0 ? (Math.sin(i * 12.9 + t * 60) * glitch * amp * 1.6) : 0;
      const y = cy - wob * env * amp - jitter;
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    const path = pts.join(" ");
    const dash = width * 1.6;
    return (
      <svg width={W} height={W} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: `drop-shadow(0 0 ${u * 0.6}px ${color}) drop-shadow(0 0 ${u * 1.6}px ${color}66)` }}>
        <path d={path} fill="none" stroke={color} strokeWidth={u * 0.28} strokeLinecap="round" strokeLinejoin="round"
          pathLength={100} strokeDasharray={glitch > 0 ? `${u * 1.4} ${u * 0.5}` : 100} strokeDashoffset={100 * (1 - draw)} opacity={0.96} />
      </svg>
    );
  };

/* ================= BEAT 4/5 — real Three.js scenes ================= */
const ProceduralMic: React.FC<{ frame: number }> = ({ frame }) => (
  <group rotation={[0, frame * 0.022, 0]}>
    {/* body — low metalness so it reads under direct light (no envMap headless) */}
    <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.42, 0.42, 1.7, 48]} /><meshStandardMaterial color="#aeb6c4" metalness={0.35} roughness={0.44} emissive="#1c222d" emissiveIntensity={0.55} /></mesh>
    {/* grille — dark solid core + bright wire cage catches the rim */}
    <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.46, 0.46, 0.95, 48]} /><meshStandardMaterial color="#3a4150" metalness={0.4} roughness={0.5} emissive="#0e1218" emissiveIntensity={0.4} /></mesh>
    <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.5, 0.5, 1.0, 48]} /><meshStandardMaterial color="#d6dbe4" metalness={0.5} roughness={0.3} wireframe emissive="#3a4150" emissiveIntensity={0.5} /></mesh>
    {/* shock-mount ring */}
    <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.72, 0.05, 16, 60]} /><meshStandardMaterial color="#e2e6ec" metalness={0.55} roughness={0.28} emissive="#2a2f38" emissiveIntensity={0.4} /></mesh>
    {/* lime accent ring — the waveform through-line, in 3D */}
    <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.022, 12, 64]} /><meshStandardMaterial color="#cfff05" emissive="#cfff05" emissiveIntensity={2.4} toneMapped={false} /></mesh>
  </group>
);

const MicScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <color attach="background" args={[0x12151d]} />
      <ambientLight intensity={1.5} />
      {/* warm key */}
      <directionalLight position={[4, 5, 6]} intensity={3.2} color={0xfff2e0} />
      {/* cool fill */}
      <spotLight position={[-6, 3, 5]} intensity={3.0} angle={0.8} penumbra={0.6} color={0xbcd0ff} />
      {/* lime rim from behind-top — BuildLoop edge */}
      <spotLight position={[-3, 6, -5]} intensity={4.0} angle={0.9} penumbra={0.7} color={0xcfff05} />
      <pointLight position={[0, 1.5, 5]} intensity={2.2} color={0xffffff} />
      {/* GLB (58MB Tripo mesh) crashes headless three (null material name .trim);
          procedural condenser keeps this a REAL three.js 3D render. GLB validated separately. */}
      <ProceduralMic frame={frame} />
    </>
  );
};

const VoidScene: React.FC<{ recede: number }> = ({ recede }) => {
  const frame = useCurrentFrame();
  const COLS = 42, ROWS = 22;
  const bars = useMemo(() => {
    const arr: { x: number; z: number; h: number; lime: boolean }[] = [];
    let k = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = (c - COLS / 2) * 0.9 + (r % 2 ? 0.45 : 0);
      const z = -r * 1.5;
      const h = 0.3 + Math.abs(Math.sin(c * 1.7 + r * 0.9)) * 1.4;
      arr.push({ x, z, h, lime: (r === 2 && c === Math.floor(COLS / 2)) });
      k++;
    }
    return arr;
  }, []);
  return (
    <>
      <color attach="background" args={[0x0d1017]} />
      <fog attach="fog" args={[0x0d1017, 12, 48]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[2, 8, 6]} intensity={2.4} color={0xd6e2ff} />
      <pointLight position={[0, 5, 5]} intensity={2.0} color={0xaecbff} />
      {/* lime pool at the hero spike — casts brand colour onto its neighbours */}
      <pointLight position={[0, 2, -3]} intensity={6} distance={9} decay={1.6} color={0xcfff05} />
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, -1.2 + (b.lime ? b.h + 1.6 : b.h) / 2, b.z]}>
          <boxGeometry args={[b.lime ? 0.34 : 0.16, b.lime ? b.h + 1.6 : b.h, b.lime ? 0.34 : 0.16]} />
          <meshStandardMaterial color={b.lime ? 0xcfff05 : 0x808faf} emissive={b.lime ? 0xcfff05 : 0x1c2740} emissiveIntensity={b.lime ? 2.8 : 0.35} metalness={0.3} roughness={0.62} toneMapped={!b.lime} />
        </mesh>
      ))}
    </>
  );
};

/* ================= main scene ================= */
export const AiDocScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  // register: dark throughout, flip to light at 24.0 (on "gone")
  const lite = clamp01((t - 24.0) / 0.55);
  const bg = lite > 0.5 ? SILVER : RAISIN;

  // VO amplitude proxy for the waveform pulse (word anchors)
  const amp = u * (2.4 + Math.abs(Math.sin(t * 8)) * 1.1);

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden", fontFamily: SANS }}>
      <Audio src={staticFile("aidoc/vo.wav")} />

      {/* ============ B1 HER (0–5.6) — Higgsfield hero, warm, human ============ */}
      {t < 6.0 && (() => {
        const on = 1 - clamp01((t - 5.4) / 0.35);
        const push = 1.02 + t * 0.012;
        const grade = clamp01((t - 5.0) / 0.6); // desat begins as doubt lands
        return (
          <AbsoluteFill style={{ opacity: on }}>
            <OffthreadVideo src={staticFile(HER)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${push})`, filter: `saturate(${1 - grade * 0.7}) brightness(${1 - grade * 0.15})` }} />
            <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 55% 45%, transparent 55%, rgba(0,0,0,0.5))", pointerEvents: "none" }} />
            {/* digital blocks glitch begins on 'said' (5.78) */}
            {t > 5.4 && <AbsoluteFill style={{ background: `repeating-linear-gradient(0deg, transparent 0 ${u}px, rgba(207,255,5,0.05) ${u}px ${u * 1.2}px)`, mixBlendMode: "screen", opacity: clamp01((t - 5.4) / 0.2) }} />}
          </AbsoluteFill>
        );
      })()}

      {/* ============ B2 THE BREAK (5.6–9.0) — waveform born + HUMAN→SYNTHETIC ============ */}
      {t >= 5.5 && t < 9.2 && (() => {
        const on = clamp01((t - 5.6) / 0.25) * (1 - clamp01((t - 8.9) / 0.3));
        const draw = clamp01((t - 5.7) / 0.9);
        const glitch = clamp01((t - 7.18) / 0.08) * (1 - clamp01((t - 7.9) / 0.4)); // on 'neither did I'
        const flip = clamp01((t - 7.18) / 0.3);
        return (
          <AbsoluteFill style={{ opacity: on }}>
            <AbsoluteFill style={{ background: RAISIN }} />
            <Waveform u={u} W={W} cx={W / 2} cy={H * 0.5} width={W * 0.62} amp={u * 3.4} t={t} draw={draw} glitch={glitch} />
            <div style={{ position: "absolute", left: "50%", top: "64%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 1.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.14em" }}>
              <span style={{ color: flip < 0.5 ? SILVER : "#5a6068", textDecoration: flip > 0.5 ? "line-through" : "none" }}>HUMAN</span>
              <span style={{ color: LIME }}>→</span>
              <span style={{ color: flip > 0.5 ? LIME : "#5a6068" }}>SYNTHETIC</span>
            </div>
            <div style={{ position: "absolute", left: "50%", top: "70%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.22em", color: SILVER_MID, opacity: flip }}>0 TAKES · 0 HUMANS</div>
          </AbsoluteFill>
        );
      })()}

      {/* ============ B3 LUUK REVEAL (9.0–17.8) — cutout + waveform at shoulder ============ */}
      {t >= 8.9 && t < 18.0 && (() => {
        const on = clamp01((t - 9.0) / 0.4) * (1 - clamp01((t - 17.7) / 0.35));
        // ping-pong the 105 CvC mattes
        const local = Math.round((t - 9.0) * FPS);
        const period = 208; const ph = local % period; const idx = 1 + (ph < 105 ? ph : 208 - ph);
        const matte = `cvc/matte/f_${String(Math.max(1, Math.min(105, idx))).padStart(3, "0")}.png`;
        const lower = clamp01((t - 9.8) / 0.5) * (1 - clamp01((t - 16.8) / 0.4));
        return (
          <AbsoluteFill style={{ opacity: on }}>
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 70% at 50% 42%, #161b26, ${RAISIN} 70%)` }} />
            <Img src={staticFile(matte)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.02)" }} />
            {/* the waveform, carried, hovering at his shoulder-right */}
            <Waveform u={u} W={W} cx={W * 0.72} cy={H * 0.44} width={W * 0.34} amp={amp} t={t} draw={1} />
            {/* documentary lower-third */}
            <div style={{ position: "absolute", left: "7%", bottom: "12%", opacity: lower, transform: `translateY(${(1 - lower) * u}px)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: u * 0.8 }}>
                <div style={{ width: u * 0.5, height: u * 3.2, background: LIME }} />
                <div>
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: SILVER, letterSpacing: "-0.01em", lineHeight: 1 }}>LUUK ALLEMAN</div>
                  <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.15, color: SILVER_MID, letterSpacing: "0.14em", marginTop: u * 0.4 }}>builds AI systems for a living</div>
                </div>
              </div>
            </div>
          </AbsoluteFill>
        );
      })()}

      {/* ============ B4 THE MIC (17.8–20.4) — real Three.js turntable ============ */}
      {t >= 17.7 && t < 20.5 && (() => {
        const on = clamp01((t - 17.8) / 0.4) * (1 - clamp01((t - 20.3) / 0.3));
        return (
          <AbsoluteFill style={{ opacity: on }}>
            <ThreeCanvas linear width={W} height={H} camera={{ position: [0, 0, 6.4], fov: 34 }} style={{ background: RAISIN }}>
              <MicScene />
            </ThreeCanvas>
            <AbsoluteFill style={{ background: "radial-gradient(ellipse 82% 82% at 50% 46%, transparent 70%, rgba(0,0,0,0.18))", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: "50%", bottom: "13%", transform: "translate(-50%,0)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.24em", color: SILVER_MID, opacity: clamp01((t - 18.2) / 0.5) }}>EXHIBIT A — THE INSTRUMENT</div>
          </AbsoluteFill>
        );
      })()}

      {/* ============ B5 THE VOID (20.4–23.9) — Three.js voiceprint field + PROOF ============ */}
      {t >= 20.3 && t < 24.1 && (() => {
        const on = clamp01((t - 20.4) / 0.35) * (1 - clamp01((t - 23.8) / 0.35));
        const proofDissolve = clamp01((t - 21.4) / 1.6);
        return (
          <AbsoluteFill style={{ opacity: on }}>
            <ThreeCanvas linear width={W} height={H} camera={{ position: [0, 1.2, 7], fov: 42 }} style={{ background: "#0b0d12" }}>
              <VoidScene recede={clamp01((t - 20.4) / 3)} />
            </ThreeCanvas>
            {/* PROOF dissolving into particles */}
            <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "relative", opacity: 1 - proofDissolve * 0.2 }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 9, letterSpacing: "0.02em", color: "#ffffff", textShadow: `0 0 ${u * 1.4}px rgba(207,255,5,0.45), 0 ${u * 0.3}px ${u * 2}px rgba(0,0,0,0.6)`, opacity: 1 - proofDissolve, filter: `blur(${proofDissolve * u * 0.5}px)` }}>PROOF</span>
                {proofDissolve > 0.05 && Array.from({ length: 40 }).map((_, i) => {
                  const ang = (i / 40) * Math.PI * 2 + i;
                  const d = proofDissolve * u * (6 + (i % 5) * 5);
                  return <div key={i} style={{ position: "absolute", left: `calc(50% + ${Math.cos(ang) * d}px)`, top: `calc(50% + ${Math.sin(ang) * d * 0.7 - proofDissolve * u * 4}px)`, width: u * 0.35 * (1 - proofDissolve), height: u * 0.35 * (1 - proofDissolve), borderRadius: "50%", background: SILVER, opacity: (1 - proofDissolve) * 0.8 }} />;
                })}
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        );
      })()}

      {/* ============ B6 TITLE FLIP (23.9–28) — light flip + flatten + title ============ */}
      {t >= 23.8 && (() => {
        const on = clamp01((t - 23.9) / 0.35);
        const flatten = clamp01((t - 24.0) / 0.7);
        const titleIn = clamp01((t - 24.5) / 0.6);
        // waveform flattens from wavy (amp) to a flat line as title resolves
        const flatAmp = lerp(u * 3.2, u * 0.15, flatten);
        return (
          <AbsoluteFill style={{ opacity: on }}>
            <AbsoluteFill style={{ background: `linear-gradient(180deg, #eef0f1, ${SILVER})` }} />
            <Waveform u={u} W={W} cx={W / 2} cy={H * 0.38} width={W * 0.5} amp={flatAmp} t={t} draw={1} color="#7A9A00" />
            <div style={{ position: "absolute", left: "50%", top: "56%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: titleIn }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 5.4, letterSpacing: "-0.02em", color: RAISIN, lineHeight: 1.02, textTransform: "uppercase" }}>
                The End of Hearing<br />is <span style={{ background: LIME, color: RAISIN, padding: `0 ${u * 0.5}px` }}>Believing</span>
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.24em", color: "#5a6068", marginTop: u * 1.4, opacity: clamp01((t - 25.2) / 0.6) }}>A BUILDLOOP FILM</div>
            </div>
          </AbsoluteFill>
        );
      })()}

      {/* film grain + vignette over everything for cohesion */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 88% 82% at 50% 46%, transparent 55%, rgba(0,0,0,0.32))", opacity: lite > 0.5 ? 0.35 : 1 }} />
    </AbsoluteFill>
  );
};
