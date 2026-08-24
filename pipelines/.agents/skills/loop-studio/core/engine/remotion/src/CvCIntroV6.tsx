import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import {
  BORDER,
  BODY,
  DarkBg,
  LightBg,
  LIME,
  MONO,
  PANEL,
  PANEL_DEEP,
  PAPER,
  RAISIN,
  SANS,
  SILVER,
  SILVER_MID,
  SILVER_SOFT,
  clamp01,
  lerp,
  Marker,
} from "./bb2/scene";

const FPS = 25;
const CUT = "cvc/cut.mp4";

const ease = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

const pop = (t: number, at: number, dur = 0.34) =>
  interpolate(clamp01((t - at) / dur), [0, 1], [0.68, 1], {
    easing: Easing.out(Easing.back(1.5)),
  });

const Sfx: React.FC<{ n: string; at: number; v?: number; dur?: number; kit?: string }> = ({
  n,
  at,
  v = 0.16,
  dur = 1.2,
  kit = "loopstudio/sfx",
}) => (
  <Sequence from={Math.round(at * FPS)} durationInFrames={Math.max(1, Math.round(dur * FPS))} premountFor={FPS}>
    <Audio src={staticFile(`${kit}/${n}.wav`)} volume={v} />
  </Sequence>
);

const FilmHoles: React.FC<{ u: number; dark?: boolean }> = ({ u, dark = true }) => (
  <>
    {["top", "bottom"].map((edge) => (
      <div
        key={edge}
        style={{
          position: "absolute",
          left: u * 0.7,
          right: u * 0.7,
          [edge]: u * 0.34,
          height: u * 0.58,
          display: "flex",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: u * 0.42,
              height: u * 0.58,
              borderRadius: u * 0.08,
              background: dark ? RAISIN : PAPER,
              opacity: 0.86,
            }}
          />
        ))}
      </div>
    ))}
  </>
);

const CropCorners: React.FC<{ u: number; p: number; color: string }> = ({ u, p, color }) => {
  const inset = lerp(0.9, 2.2, p) * u;
  const s = u * 2.5;
  return (
    <div style={{ position: "absolute", inset, opacity: p, pointerEvents: "none" }}>
      {[
        ["left", "top"],
        ["right", "top"],
        ["left", "bottom"],
        ["right", "bottom"],
      ].map(([x, y]) => (
        <div
          key={`${x}${y}`}
          style={{
            position: "absolute",
            [x]: 0,
            [y]: 0,
            width: s,
            height: s,
            borderLeft: x === "left" ? `${u * 0.16}px solid ${color}` : undefined,
            borderRight: x === "right" ? `${u * 0.16}px solid ${color}` : undefined,
            borderTop: y === "top" ? `${u * 0.16}px solid ${color}` : undefined,
            borderBottom: y === "bottom" ? `${u * 0.16}px solid ${color}` : undefined,
          }}
        />
      ))}
    </div>
  );
};

const FilmContent: React.FC<{
  u: number;
  t: number;
  variant: "A" | "B" | "hero";
  pass: number;
  finalMode?: boolean;
}> = ({ u, t, variant, pass, finalMode = false }) => {
  const crop = pass >= 1 ? ease(t, 18.02, 18.16) : variant === "hero" ? ease(t, 2.62, 2.78) : 0;
  const story = pass >= 2 ? ease(t, 18.24, 18.4) : variant === "hero" ? ease(t, 2.84, 3.02) : 0;
  const polish = pass >= 3 ? ease(t, 18.46, 18.65) : variant === "hero" ? ease(t, 3.08, 3.32) : 0;
  const previewLife = variant !== "hero" && t >= 7.0 && t < 15.6 ? 1 : 0;
  const a = variant === "A";
  const grade = crop > 0.1 || finalMode || previewLife;
  const zoom = 1 + crop * (a ? 0.08 : 0.13) + (finalMode ? 0.025 : 0);
  const x = a ? lerp(50, 48, crop) : lerp(50, 53, crop);
  const subtitleOn = Math.max(story, previewLife * ease(t, 7.3, 7.7));
  const brollOn = Math.max(story, previewLife * ease(t, 8.7, 9.05));
  const sweep = ((t * (a ? 28 : 23)) % 140) - 20;
  const caption = a ? "AI CUT THE BORING PART" : "THE SAME FOOTAGE · NEW STORY";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: PANEL_DEEP }}>
      <OffthreadVideo
        src={staticFile(CUT)}
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${x}% 48%`,
          transform: `scale(${zoom})`,
          filter: grade
            ? a
              ? `contrast(${1.05 + polish * 0.08}) saturate(${0.98 + polish * 0.15}) brightness(0.95)`
              : `contrast(${1.09 + polish * 0.06}) saturate(${0.88 + polish * 0.16}) brightness(0.92)`
            : "saturate(0.58) contrast(0.9) brightness(0.88)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: crop,
          background: a
            ? "linear-gradient(120deg, rgba(207,255,5,0.05), transparent 42%, rgba(15,18,26,0.22))"
            : "linear-gradient(235deg, rgba(233,236,237,0.09), transparent 44%, rgba(15,18,26,0.28))",
          mixBlendMode: "screen",
        }}
      />
      <CropCorners u={u} p={crop} color={a ? LIME : SILVER} />

      {brollOn > 0.01 && (
        <div
          style={{
            position: "absolute",
            width: a ? "28%" : "31%",
            height: "31%",
            right: a ? "5%" : undefined,
            left: a ? undefined : "5%",
            top: "7%",
            transform: `translateY(${(1 - brollOn) * -18}px) scale(${0.9 + brollOn * 0.1}) rotate(${a ? -1.2 : 1.2}deg)`,
            opacity: brollOn,
            overflow: "hidden",
            border: `${u * 0.11}px solid ${a ? LIME : SILVER}`,
            boxShadow: `0 ${u * 0.45}px ${u * 1.2}px rgba(0,0,0,0.45)`,
          }}
        >
          <Img
            src={staticFile(a ? "cvc/thumb_broll.jpg" : "cvc/thumb_aroll.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.08) saturate(1.03)" }}
          />
        </div>
      )}

      {subtitleOn > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "10%",
            transform: `translate(-50%, ${(1 - subtitleOn) * 18}px)`,
            opacity: subtitleOn,
            maxWidth: "82%",
            padding: `${u * 0.38}px ${u * 0.75}px`,
            borderRadius: u * 0.24,
            background: "rgba(15,18,26,0.82)",
            color: SILVER,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: u * 1.2,
            letterSpacing: "0.035em",
            textAlign: "center",
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap",
          }}
        >
          {caption}
        </div>
      )}

      {polish > 0.01 && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${sweep}%`,
              width: "14%",
              transform: "skewX(-14deg)",
              background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)",
              opacity: polish,
              mixBlendMode: "screen",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxShadow: `inset 0 0 ${u * 3.6}px rgba(15,18,26,0.38)`,
              opacity: polish,
            }}
          />
        </>
      )}
    </div>
  );
};

const ProofFrame: React.FC<{
  u: number;
  t: number;
  variant: "A" | "B" | "hero";
  pass: number;
  width: number;
  opacity?: number;
  finalMode?: boolean;
}> = ({ u, t, variant, pass, width, opacity = 1, finalMode = false }) => {
  const height = width * 0.5625;
  const paper = finalMode ? PANEL : PAPER;
  return (
    <div
      style={{
        position: "relative",
        width: u * width,
        height: u * height,
        padding: u * 0.72,
        paddingBottom: u * 2.1,
        boxSizing: "border-box",
        borderRadius: u * 0.38,
        background: paper,
        border: `${u * 0.08}px solid ${finalMode ? BORDER : "rgba(15,18,26,0.16)"}`,
        boxShadow: finalMode
          ? `0 ${u * 1.5}px ${u * 4}px rgba(0,0,0,0.62), 0 0 ${u * 2.4}px rgba(207,255,5,0.08)`
          : `0 ${u * 1.15}px ${u * 3.2}px rgba(15,18,26,0.22)`,
        opacity,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: u * 0.2 }}>
        <FilmContent u={u} t={t} variant={variant} pass={pass} finalMode={finalMode} />
      </div>
      <FilmHoles u={u} dark={!finalMode} />
      <div
        style={{
          position: "absolute",
          left: u * 1.1,
          bottom: u * 0.66,
          fontFamily: MONO,
          fontSize: u * 0.82,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: finalMode ? SILVER_MID : BODY,
        }}
      >
        {variant === "hero" ? "MASTER · 00:24:14" : `OUTPUT ${variant} · FRAME ${String(Math.floor(t * FPS)).padStart(4, "0")}`}
      </div>
      <div
        style={{
          position: "absolute",
          right: u * 1.1,
          bottom: u * 0.6,
          width: u * 4.8,
          height: u * 0.2,
          background: finalMode ? BORDER : "rgba(15,18,26,0.16)",
        }}
      >
        <div style={{ width: `${35 + ((t * 19) % 65)}%`, height: "100%", background: LIME }} />
      </div>
    </div>
  );
};

const RawTake: React.FC<{
  u: number;
  t: number;
  src: string;
  x: number;
  y: number;
  rot: number;
  delay: number;
  rejectAt: number;
}> = ({ u, t, src, x, y, rot, delay, rejectAt }) => {
  const born = ease(t, delay, delay + 0.3);
  const reject = ease(t, rejectAt, rejectAt + 0.35);
  const scale = pop(t, delay, 0.34);
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y - reject * 65}%`,
        transform: `translate(-50%,-50%) rotate(${rot + reject * rot * 1.5}deg) scale(${scale})`,
        opacity: born * (1 - reject),
        width: u * 27,
        height: u * 18.2,
        padding: u * 0.55,
        paddingBottom: u * 2.1,
        background: PAPER,
        boxSizing: "border-box",
        boxShadow: `0 ${u * 1.1}px ${u * 2.8}px rgba(0,0,0,0.5)`,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", filter: "saturate(0.38) contrast(0.86) brightness(0.86)" }}>
        <OffthreadVideo
          src={staticFile(src)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 60%,rgba(15,18,26,0.42))" }} />
      </div>
      <div style={{ position: "absolute", left: u * 0.8, bottom: u * 0.68, display: "flex", alignItems: "center", gap: u * 0.45 }}>
        <span style={{ width: u * 0.52, height: u * 0.52, borderRadius: "50%", background: RAISIN }} />
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, letterSpacing: "0.11em", color: BODY }}>RAW TAKE</span>
      </div>
    </div>
  );
};

const RawContactSheet: React.FC<{ u: number; t: number }> = ({ u, t }) => {
  const out = 1 - ease(t, 2.46, 2.82);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <RawTake u={u} t={t} src="cvc/raw_take1.mp4" x={24} y={45} rot={-8} delay={0.05} rejectAt={1.92} />
      <RawTake u={u} t={t} src="cvc/raw_take2.mp4" x={50} y={42} rot={1.4} delay={0.18} rejectAt={2.03} />
      <RawTake u={u} t={t} src="cvc/raw_take3.mp4" x={76} y={46} rot={7} delay={0.31} rejectAt={2.14} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "11%",
          transform: "translateX(-50%)",
          width: "64%",
          display: "flex",
          gap: u * 0.5,
          opacity: ease(t, 0.45, 0.8) * (1 - ease(t, 1.85, 2.1)),
        }}
      >
        {[0.12, 0.3, 0.18, 0.46, 0.22, 0.62, 0.34, 0.52, 0.25, 0.41, 0.19, 0.58, 0.28, 0.48, 0.2].map((h, i) => (
          <div key={i} style={{ flex: 1, height: u * h * 3.2, alignSelf: "center", borderRadius: u * 0.07, background: i > 10 ? LIME : SILVER_MID, opacity: i > 10 ? 0.95 : 0.46 }} />
        ))}
      </div>
    </div>
  );
};

const ModelBadge: React.FC<{
  u: number;
  x: number;
  y: number;
  logo: string;
  name: string;
  opacity: number;
  clay?: boolean;
}> = ({ u, x, y, logo, name, opacity, clay = false }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%,-50%) scale(${0.82 + opacity * 0.18})`,
      opacity,
      display: "flex",
      alignItems: "center",
      gap: u * 0.7,
      padding: `${u * 0.58}px ${u * 1.05}px`,
      background: PAPER,
      borderRadius: u * 0.35,
      boxShadow: `0 ${u * 0.5}px ${u * 1.5}px rgba(15,18,26,0.18)`,
    }}
  >
    <Img src={staticFile(logo)} style={{ width: u * 2.6, height: u * 2.6, objectFit: "contain" }} />
    <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.1, letterSpacing: "0.1em", color: clay ? "#D97757" : RAISIN }}>{name}</span>
  </div>
);

const ProofTab: React.FC<{ u: number; x: number; y: number; label: string; opacity: number; finalMode?: boolean }> = ({
  u,
  x,
  y,
  label,
  opacity,
  finalMode = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%,-50%) rotate(${label === "A" ? -1.5 : 1.5}deg) scale(${0.75 + opacity * 0.25})`,
      opacity,
      width: u * 4.2,
      height: u * 4.2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: finalMode ? LIME : RAISIN,
      color: finalMode ? RAISIN : SILVER,
      fontFamily: SANS,
      fontWeight: 800,
      fontSize: u * 2.2,
      boxShadow: `0 ${u * 0.45}px ${u * 1.2}px rgba(0,0,0,0.34)`,
    }}
  >
    {label}
  </div>
);

const PromptNote: React.FC<{ u: number; t: number; x: number; opacity: number; scale?: number }> = ({ u, t, x, opacity, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: "69%",
      transform: `translate(-50%,-50%) rotate(${x < 50 ? -2 : x > 50 ? 2 : -0.7}deg) scale(${scale})`,
      opacity,
      width: u * 14,
      padding: `${u * 0.9}px ${u * 1.05}px`,
      background: PAPER,
      border: `${u * 0.09}px solid rgba(15,18,26,0.16)`,
      boxShadow: `0 ${u * 0.8}px ${u * 2.1}px rgba(15,18,26,0.25)`,
      fontFamily: MONO,
      color: RAISIN,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: u * 0.5, marginBottom: u * 0.55 }}>
      <span style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: LIME, border: `${u * 0.08}px solid ${RAISIN}` }} />
      <span style={{ fontWeight: 800, fontSize: u * 0.68, letterSpacing: "0.14em", color: BODY }}>SAME NOTE</span>
    </div>
    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 1.05, lineHeight: 1.12 }}>Make this intro impossible to ignore.</div>
    <div style={{ marginTop: u * 0.55, width: `${40 + ((t * 20) % 48)}%`, height: u * 0.12, background: LIME }} />
  </div>
);

const LivingProofs: React.FC<{ u: number; t: number }> = ({ u, t }) => {
  const born = ease(t, 2.35, 2.7);
  const split = ease(t, 4.08, 4.72);
  const arena = ease(t, 12.86, 13.75);
  const finalMode = ease(t, 19.2, 20.1);
  const disappear = 1 - ease(t, 24.35, 24.55);

  const sh1 = ease(t, 10.34, 10.82);
  const sh2 = ease(t, 10.82, 11.3);
  const arc = Math.sin(sh1 * Math.PI) * 8 - Math.sin(sh2 * Math.PI) * 8;

  let xA = lerp(50, 28.5, split);
  let xB = lerp(50, 71.5, split);
  xA = lerp(xA, 25.5, arena);
  xB = lerp(xB, 74.5, arena);
  xA = lerp(xA, 24.2, finalMode);
  xB = lerp(xB, 75.8, finalMode);
  xA += arc;
  xB -= arc;
  const yA = 46 - Math.abs(arc) * 0.22;
  const yB = 46 + Math.abs(arc) * 0.22;
  let width = lerp(57, 34, split);
  width = lerp(width, 41, arena);
  width = lerp(width, 46, finalMode);
  const rotA = lerp(-1.2, 0, arena) + arc * -0.08;
  const rotB = lerp(1.2, 0, arena) + arc * 0.08;

  const pass = t < 18.02 ? 0 : t < 18.24 ? 1 : t < 18.46 ? 2 : 3;
  const modelOn = split * (1 - ease(t, 8.04, 8.38));
  const proofOn = ease(t, 8.14, 8.48);
  const noteIn = ease(t, 16.32, 16.58) * (1 - ease(t, 17.78, 18.0));
  const noteFork = ease(t, 16.88, 17.3);
  const finalPush = ease(t, 22.75, 23.2);
  const scaleA = born * (1 + finalPush * 0.035);
  const scaleB = born * (1 + finalPush * 0.035);
  const heroOpacity = born * disappear;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: heroOpacity }}>
      <div
        style={{
          position: "absolute",
          left: `${xA}%`,
          top: `${yA}%`,
          transform: `translate(-50%,-50%) rotate(${rotA}deg) scale(${scaleA})`,
          zIndex: arc >= 0 ? 3 : 2,
        }}
      >
        <ProofFrame u={u} t={t} variant={split < 0.25 ? "hero" : "A"} pass={pass} width={width} finalMode={finalMode > 0.5} />
      </div>
      <div
        style={{
          position: "absolute",
          left: `${xB}%`,
          top: `${yB}%`,
          transform: `translate(-50%,-50%) rotate(${rotB}deg) scale(${scaleB})`,
          opacity: split,
          zIndex: arc >= 0 ? 2 : 3,
        }}
      >
        <ProofFrame u={u} t={t} variant="B" pass={pass} width={width} finalMode={finalMode > 0.5} />
      </div>

      {split > 0.02 && (
        <>
          <ModelBadge u={u} x={xA} y={24} logo="logos/claude.svg" name="FABLE 5" opacity={modelOn * ease(t, 4.45, 4.74)} clay />
          <ModelBadge u={u} x={xB} y={24} logo="logos/chatgpt.svg" name="SOL 5.6" opacity={modelOn * ease(t, 5.42, 5.68)} />
          <ProofTab u={u} x={xA - width * 0.43} y={29.5} label="A" opacity={proofOn} finalMode={finalMode > 0.5} />
          <ProofTab u={u} x={xB + width * 0.43} y={29.5} label="B" opacity={proofOn} finalMode={finalMode > 0.5} />
        </>
      )}

      {t >= 11.2 && t < 13.15 && (
        <div
          style={{
            position: "absolute",
            left: "13%",
            right: "13%",
            top: "78%",
            height: u * 0.28,
            borderRadius: u * 0.2,
            background: "rgba(15,18,26,0.14)",
            opacity: 1 - ease(t, 12.86, 13.15),
            overflow: "hidden",
          }}
        >
          <div style={{ height: "100%", width: `${ease(t, 11.28, 12.2) * 100}%`, background: LIME, boxShadow: `0 0 ${u * 0.8}px ${LIME}` }} />
        </div>
      )}

      {arena > 0.05 && t < 20.5 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            transform: "translate(-50%,-50%)",
            width: u * 0.12,
            height: `${arena * 52}%`,
            background: finalMode > 0.1 ? SILVER : "rgba(15,18,26,0.18)",
            opacity: 1 - ease(t, 20.2, 20.5),
          }}
        />
      )}

      {noteIn > 0.01 && (
        <>
          <PromptNote u={u} t={t} x={50} opacity={noteIn * (1 - noteFork)} scale={pop(t, 16.32)} />
          <PromptNote u={u} t={t} x={lerp(50, xA, noteFork)} opacity={noteIn * noteFork} />
          <PromptNote u={u} t={t} x={lerp(50, xB, noteFork)} opacity={noteIn * noteFork} />
        </>
      )}

      {pass > 0 && t < 19.2 && (
        <div style={{ position: "absolute", left: "50%", top: "82%", transform: "translate(-50%,-50%)", display: "flex", gap: u * 1.1 }}>
          {[1, 2, 3].map((n) => {
            const on = pass >= n ? 1 : 0;
            return (
              <div
                key={n}
                style={{
                  width: u * 8,
                  height: u * 2.4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: on ? RAISIN : "rgba(15,18,26,0.08)",
                  color: on ? SILVER : BODY,
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: u * 0.82,
                  letterSpacing: "0.1em",
                  transform: `scale(${on ? pop(t, n === 1 ? 18.02 : n === 2 ? 18.24 : 18.46, 0.18) : 0.9})`,
                }}
              >
                {n === 1 ? "CUT" : n === 2 ? "STORY" : "POLISH"}
              </div>
            );
          })}
        </div>
      )}

      {finalMode > 0.05 && (
        <>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              transform: "translateX(-50%)",
              width: u * 0.24,
              background: LIME,
              opacity: finalMode * (0.72 + 0.18 * Math.sin(t * 8)),
              boxShadow: `0 0 ${u * 2}px rgba(207,255,5,0.52)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "75%",
              transform: "translate(-50%,-50%)",
              opacity: ease(t, 21.28, 21.7),
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: u * 4.1,
              letterSpacing: "-0.04em",
              color: SILVER,
              whiteSpace: "nowrap",
              textShadow: "0 6px 24px rgba(0,0,0,0.62)",
            }}
          >
            WHICH CUT <Marker u={u} t={t} at={22.55}>WINS?</Marker>
          </div>
        </>
      )}
    </div>
  );
};

export const CvCIntroV6: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width } = useVideoConfig();
  const u = width / 100;
  const light = ease(t, 3.85, 4.35) * (1 - ease(t, 19.2, 20.0));
  const rawRoom = 1 - ease(t, 2.3, 2.75);
  const bloom = ease(t, 24.1, 24.42) * (1 - ease(t, 24.45, 24.56));

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden", fontFamily: SANS }}>
      <Audio src={staticFile("cvc/vo.wav")} />
      <DarkBg u={u} gridOpacity={0.18} />
      <LightBg u={u} opacity={light} />

      <div style={{ position: "absolute", inset: 0, opacity: rawRoom }}>
        <OffthreadVideo
          src={staticFile(CUT)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.45) contrast(0.86) brightness(0.48)" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 75% at 50% 48%, transparent 30%, rgba(15,18,26,0.76) 100%)" }} />
      </div>

      {t < 3.0 && <RawContactSheet u={u} t={t} />}
      <LivingProofs u={u} t={t} />

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 74% at 50% 48%, transparent 48%, rgba(0,0,0,0.34) 100%)",
          opacity: light > 0.5 ? 0.26 : 0.9,
        }}
      />

      {bloom > 0.01 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: bloom * 0.52,
            background: "radial-gradient(ellipse 58% 44% at 50% 50%, rgba(207,255,5,0.5) 0%, rgba(255,255,255,0.16) 34%, transparent 68%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      <Sfx n="riser" at={0.1} v={0.07} dur={3.4} />
      <Sfx n="whoosh" at={0.12} v={0.09} dur={0.9} />
      <Sfx n="whoosh" at={1.92} v={0.11} dur={0.9} />
      <Sfx n="click" at={2.62} v={0.18} dur={0.5} />
      <Sfx n="ping" at={3.36} v={0.1} dur={0.8} />
      <Sfx n="whoosh" at={4.08} v={0.13} dur={0.9} />
      <Sfx n="ping" at={4.74} v={0.11} dur={0.7} />
      <Sfx n="ping" at={5.68} v={0.11} dur={0.7} />
      <Sfx n="whoosh" at={8.14} v={0.11} dur={0.8} />
      <Sfx n="whoosh" at={10.34} v={0.09} dur={0.8} />
      <Sfx n="whoosh" at={10.82} v={0.09} dur={0.8} />
      <Sfx n="click" at={11.28} v={0.1} dur={0.5} />
      <Sfx n="whoosh" at={12.86} v={0.12} dur={0.9} />
      <Sfx n="click" at={14.72} v={0.14} dur={0.5} />
      <Sfx n="click" at={16.32} v={0.11} dur={0.5} />
      <Sfx n="whoosh" at={16.88} v={0.1} dur={0.8} />
      <Sfx n="click" at={18.02} v={0.12} dur={0.45} />
      <Sfx n="click" at={18.24} v={0.12} dur={0.45} />
      <Sfx n="click" at={18.46} v={0.12} dur={0.45} />
      <Sfx n="whoosh" at={19.2} v={0.14} dur={1.0} />
      <Sfx n="ping" at={20.5} v={0.12} dur={0.8} />
      <Sfx n="whoosh" at={22.75} v={0.12} dur={0.9} />
      <Sfx n="complete" at={23.64} v={0.1} dur={1.0} />
    </AbsoluteFill>
  );
};
