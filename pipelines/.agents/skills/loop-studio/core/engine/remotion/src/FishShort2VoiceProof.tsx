import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";

const FPS = 30;
const START = 8.45 * FPS;
const SETTLED = 8.82 * FPS;
const RELEASE = 11.82 * FPS;
const END = 12.2 * FPS;
const ES_AT = 8.65 * FPS;
const ZH_AT = 9.46 * FPS;
const MINE_AT = 10.28 * FPS;
const PURPLE = "#9B90E8";
const LAVENDER = "#ECEAFA";
const BG = "#08080C";
const SANS = "'Onest','Helvetica Neue',Arial,sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";
const clamp = {extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const};

const progress = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});

const Endpoint: React.FC<{x: number; label: string; sub: string; active: number}> = ({x, label, sub, active}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: 905,
      width: 146,
      height: 146,
      transform: `translate(-50%, -50%) scale(${0.94 + active * 0.06})`,
      borderRadius: 999,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: active > 0.18 ? LAVENDER : "rgba(255,255,255,.055)",
      color: active > 0.18 ? BG : "rgba(255,255,255,.55)",
      border: `2px solid ${active > 0.18 ? PURPLE : "rgba(255,255,255,.18)"}`,
      boxShadow: active > 0.18 ? `0 0 ${34 + active * 34}px ${PURPLE}66` : "none",
    }}
  >
    <div style={{fontFamily: SANS, fontSize: 43, lineHeight: 1, fontWeight: 850}}>{label}</div>
    <div style={{fontFamily: MONO, fontSize: 14, marginTop: 10, opacity: 0.72, letterSpacing: "0.05em"}}>{sub}</div>
  </div>
);

const SignalPath: React.FC<{frame: number; x1: number; x2: number; start: number; reverse?: boolean}> = ({
  frame,
  x1,
  x2,
  start,
  reverse = false,
}) => {
  const reveal = progress(frame, start, start + 16);
  return (
    <div style={{position: "absolute", left: x1, top: 894, width: x2 - x1, height: 24, opacity: reveal}}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 10,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${PURPLE}, transparent)`,
          boxShadow: `0 0 18px ${PURPLE}`,
        }}
      />
      {Array.from({length: 7}).map((_, i) => {
        const raw = ((frame - start) * 0.045 + i / 7) % 1;
        const p = reverse ? 1 - raw : raw;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p * 100}%`,
              top: 6 + Math.sin(frame * 0.22 + i) * 4,
              width: i % 3 === 0 ? 12 : 7,
              height: i % 3 === 0 ? 12 : 7,
              borderRadius: 99,
              background: i % 3 === 0 ? "white" : PURPLE,
              boxShadow: `0 0 18px ${PURPLE}`,
            }}
          />
        );
      })}
    </div>
  );
};

const VoiceCore: React.FC<{frame: number; mine: number}> = ({frame, mine}) => {
  const breathe = 1 + Math.sin(frame * 0.08) * 0.018;
  const lock = progress(frame, MINE_AT, MINE_AT + 10);
  return (
    <div
      style={{
        position: "absolute",
        left: 540,
        top: 905,
        width: 492,
        height: 492,
        transform: `translate(-50%, -50%) scale(${breathe + lock * 0.025})`,
      }}
    >
      {Array.from({length: 5}).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 18 + i * 31,
            borderRadius: "50%",
            border: `${i === 1 ? 3 : 1.5}px solid rgba(155,144,232,${0.2 + (4 - i) * 0.1})`,
            transform: `rotate(${(i % 2 ? -1 : 1) * (frame * (0.16 + i * 0.035) + i * 21)}deg)`,
            borderTopColor: i % 2 ? "transparent" : "white",
            borderBottomColor: i % 2 ? "white" : "transparent",
            boxShadow: i < 2 ? `0 0 30px ${PURPLE}44` : "none",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 118,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${mine > 0.5 ? LAVENDER : "#171424"} 0%, #100E19 66%, ${PURPLE}55 100%)`,
          border: `2px solid ${PURPLE}`,
          boxShadow: `inset 0 0 60px ${PURPLE}55, 0 0 ${45 + lock * 35}px ${PURPLE}66`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: mine > 0.5 ? BG : "white",
        }}
      >
        <div style={{display: "flex", height: 72, alignItems: "center", gap: 6}}>
          {Array.from({length: 17}).map((_, i) => {
            const h = 12 + Math.abs(Math.sin(i * 1.31 + frame * 0.24)) * (28 + Math.sin(i * 0.7) * 14);
            return <div key={i} style={{width: 5, height: h, borderRadius: 99, background: mine > 0.5 ? BG : i % 4 === 0 ? "white" : PURPLE}} />;
          })}
        </div>
        <div style={{fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", marginTop: 12, opacity: 0.7}}>
          {mine > 0.55 ? "IDENTITY LOCKED" : "VOICE DNA"}
        </div>
      </div>
    </div>
  );
};

export const FishShort2VoiceProof: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = progress(frame, START, SETTLED);
  const leave = interpolate(frame, [RELEASE, END], [1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const mode = Math.min(enter, leave);
  const es = progress(frame, ES_AT, ES_AT + 10);
  const zh = progress(frame, ZH_AT, ZH_AT + 10);
  const mine = interpolate(frame, [MINE_AT, MINE_AT + 9], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.4))});

  const videoW = interpolate(mode, [0, 1], [1080, 250]);
  const videoH = (videoW * 16) / 9;
  const videoX = interpolate(mode, [0, 1], [540, 895]);
  const videoY = interpolate(mode, [0, 1], [960, 342]);

  return (
    <AbsoluteFill style={{background: BG, fontFamily: SANS, overflow: "hidden"}}>
      <AbsoluteFill style={{opacity: mode, background: `radial-gradient(circle at 50% 48%, ${PURPLE}36 0%, ${PURPLE}12 31%, transparent 68%)`}} />
      <AbsoluteFill
        style={{
          opacity: mode * 0.28,
          backgroundImage: "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          transform: `translateY(${(frame % 54) * 0.18}px)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: videoX,
          top: videoY,
          width: videoW,
          height: videoH,
          transform: "translate(-50%, -50%)",
          borderRadius: interpolate(mode, [0, 1], [0, 24]),
          overflow: "hidden",
          border: `${interpolate(mode, [0, 1], [0, 3])}px solid ${PURPLE}`,
          boxShadow: mode > 0.01 ? `0 25px 70px -18px ${PURPLE}88` : "none",
          background: "#000",
          zIndex: 5,
        }}
      >
        <OffthreadVideo muted src={staticFile("fishshort/short2_natural_master.mp4")} style={{width: "100%", height: "100%", objectFit: "cover"}} />
        <AbsoluteFill style={{opacity: mode * 0.16, boxShadow: "inset 0 0 42px rgba(0,0,0,.55)"}} />
      </div>

      {mode > 0.01 && (
        <>
          <div
            style={{
              position: "absolute",
              left: 65,
              top: 72,
              opacity: mode,
              transform: `translateY(${(1 - mode) * -18}px)`,
            }}
          >
            <div style={{fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.17em", color: LAVENDER}}>VOICE PROOF</div>
            <div style={{fontSize: 54, fontWeight: 850, color: "white", marginTop: 8, letterSpacing: "-0.04em"}}>Same fingerprint.</div>
            <div style={{fontSize: 54, fontWeight: 850, color: PURPLE, letterSpacing: "-0.04em"}}>New language.</div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 770,
              top: 575,
              width: 250,
              textAlign: "center",
              fontFamily: MONO,
              fontSize: 13,
              letterSpacing: "0.13em",
              color: LAVENDER,
              opacity: mode,
            }}
          >
            ● LIVE SOURCE
          </div>

          <SignalPath frame={frame} x1={205} x2={410} start={ES_AT} />
          <SignalPath frame={frame} x1={670} x2={875} start={ZH_AT} />
          <Endpoint x={155} label="ES" sub="SPANISH" active={es} />
          <Endpoint x={925} label="中" sub="CHINESE" active={zh} />
          <VoiceCore frame={frame} mine={mine} />

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 1260,
              display: "flex",
              justifyContent: "center",
              opacity: mode * mine,
              transform: `translateY(${(1 - mine) * 24}px) scale(${0.91 + mine * 0.09})`,
            }}
          >
            <div style={{padding: "18px 34px", borderRadius: 999, background: LAVENDER, color: BG, boxShadow: `0 22px 70px -18px ${PURPLE}`}}>
              <span style={{fontSize: 42, fontWeight: 900}}>MY VOICE</span>
              <span style={{fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.12em", color: "#5D5594", marginLeft: 18}}>THE WHOLE TIME</span>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 95,
              right: 95,
              bottom: 126,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${PURPLE}88, transparent)`,
              opacity: mode,
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

export default FishShort2VoiceProof;
