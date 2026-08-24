/**
 * BusinessBrainBody — the full 7-minute video in the DIGESTIBLE "5-Ways" language.
 * Data-driven: a timeline of SCREENS (one idea each) over the real narration, with a speaker inset
 * top-right and a section colour per act. Renders secondbrain_720.mp4's audio + speaker inset in sync.
 * Locked language: solid act-colour bg, huge negative space, simple line-icons + editorial type,
 * ONE lime accent, Playfair-italic sublines, red only for the "bad/frozen" things.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";
import { ACTS, Act, SANS, MONO, SERIF, LIME, RED, ink as inkC, sub as subC, lineC } from "./bb/palette";
import { Icon } from "./bb/Icons";
import { SCREENS, ACT_TITLES, Screen } from "./bb/screens";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const EASE = Easing.bezier(0.4, 0, 0.15, 1);
const SPK = "intros/businessbrain/secondbrain_720.mp4";

const hl = (text: string, key: string | undefined, dark: boolean) => {
  if (!key) return <>{text}</>;
  const parts = text.split(new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
  return <>{parts.map((p, i) => p.toLowerCase() === key.toLowerCase()
    ? (dark ? <span key={i} style={{ color: LIME }}>{p}</span>
      : <span key={i} style={{ background: LIME, color: "#141922", padding: "0 0.12em", borderRadius: "0.06em" }}>{p}</span>)
    : <span key={i}>{p}</span>)}</>;
};

export const BusinessBrainBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;

  // act background windows (contiguous by design)
  const actWin: Record<string, { s: number; e: number }> = {};
  for (const s of SCREENS) {
    const a = s.act;
    if (!actWin[a]) actWin[a] = { s: s.start, e: s.end };
    actWin[a].s = Math.min(actWin[a].s, s.start);
    actWin[a].e = Math.max(actWin[a].e, s.end);
  }
  const curScreen = [...SCREENS].reverse().find((s) => t >= s.start - 0.4);
  const curAct: Act = (curScreen?.act ?? "a1") as Act;
  const dark = ACTS[curAct].dark;
  const anyAroll = SCREENS.some((s) => s.type === "aroll" && t >= s.start && t < s.end);

  return (
    <AbsoluteFill style={{ background: "#0e1a2c", fontFamily: SANS }}>
      {/* act backgrounds, crossfading */}
      {(Object.keys(actWin) as Act[]).map((a) => {
        const w = actWin[a];
        const op = interpolate(t, [w.s - 0.5, w.s, w.e, w.e + 0.5], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (op <= 0) return null;
        return <AbsoluteFill key={a} style={{ background: ACTS[a].grad, opacity: op }} />;
      })}

      {/* graphic screens */}
      {SCREENS.map((s, i) => <ScreenLayer key={i} s={s} u={u} W={W} H={H} t={t} frame={frame} />)}

      {/* section eyebrow */}
      {!anyAroll && curScreen && (
        <div style={{ position: "absolute", left: u * 5, top: u * 6, display: "flex", alignItems: "center", gap: u * 0.8, opacity: 0.9 }}>
          <div style={{ width: u * 2.2, height: u * 0.28, background: LIME }} />
          <span style={{ fontFamily: MONO, fontSize: u * 1.1, letterSpacing: "0.3em", color: subC(dark) }}>{ACT_TITLES[curAct]}</span>
        </div>
      )}

      {/* speaker inset (persistent, hidden on full-frame a-roll) */}
      {!anyAroll && (
        <div style={{ position: "absolute", right: u * 4, top: u * 4.5, width: u * 24, aspectRatio: "16/9", borderRadius: u * 1.1, overflow: "hidden", border: `${u * 0.28}px solid ${LIME}`, boxShadow: `0 ${u}px ${u * 2.6}px rgba(0,0,0,0.5), 0 0 ${u * 1.3}px rgba(207,255,5,0.22)` }}>
          <OffthreadVideo src={staticFile(SPK)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      {/* full-frame a-roll */}
      {anyAroll && <AbsoluteFill><OffthreadVideo src={staticFile(SPK)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /></AbsoluteFill>}

      {/* narration */}
      <Audio src={staticFile(SPK)} />

      <AbsoluteFill style={{ pointerEvents: "none", background: dark ? "radial-gradient(ellipse 92% 88% at 44% 50%, transparent 55%, rgba(0,0,0,0.42) 100%)" : "radial-gradient(ellipse 92% 88% at 44% 50%, transparent 60%, rgba(20,25,34,0.14) 100%)" }} />
    </AbsoluteFill>
  );
};

const ScreenLayer: React.FC<{ s: Screen; u: number; W: number; H: number; t: number; frame: number }> = ({ s, u, W, H, t, frame }) => {
  if (t < s.start - 0.35 || t > s.end + 0.35) return null;
  const inP = interpolate(t, [s.start, s.start + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const outP = interpolate(t, [s.end - 0.3, s.end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = Math.min(inP, outP);
  if (op <= 0 || s.type === "aroll") return null;
  const dark = ACTS[s.act].dark;
  const INK = inkC(dark), SUB = subC(dark), LN = lineC(dark);
  const rise = (1 - inP) * u * 0.9;
  const cx = W * 0.35, cy = H * 0.5;

  const Label = (label?: string, subtext?: string, big = false) => (
    <>
      {label && <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * (big ? 3.0 : 2.7), letterSpacing: "0.01em", color: INK, marginTop: u * 1.3 }}>{label}</div>}
      {subtext && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.65, color: dark ? LIME : "#3a4a12", opacity: 0.92, marginTop: u * 0.5 }}>{subtext}</div>}
    </>
  );

  let body: React.ReactNode = null;
  if (s.type === "icon") {
    body = (
      <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) translateY(${rise}px)`, textAlign: "center" }}>
        <div style={{ height: u * 19, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon id={s.icon!} size={u * 14} line={LN} frame={frame} p={inP} accent={s.tone === "bad" ? RED : LIME} /></div>
        {Label(s.label, s.sub)}
      </div>
    );
  } else if (s.type === "statement") {
    body = (
      <div style={{ position: "absolute", left: u * 8, right: u * 30, top: cy, transform: `translateY(-50%) translateY(${rise}px)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * (s.big ? 5.2 : 4.0), lineHeight: 1.02, letterSpacing: "-0.02em", color: INK }}>{hl(s.head!, s.headHl, dark)}</div>
        {s.sub && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.2, color: SUB, marginTop: u * 1.4 }}>{s.sub}</div>}
      </div>
    );
  } else if (s.type === "compare") {
    const side = (o: any, isRight: boolean) => (
      <div style={{ textAlign: "center" }}>
        <div style={{ height: u * 13, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon id={o.icon} size={u * 10} line={o.tone === "bad" ? RED : LN} frame={frame} p={inP} accent={o.tone === "bad" ? RED : LIME} /></div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 2.3, color: o.tone === "bad" ? RED : INK, marginTop: u * 1.0 }}>{o.label}</div>
        {o.sub && <div style={{ fontFamily: MONO, fontSize: u * 1.15, letterSpacing: "0.1em", color: SUB, marginTop: u * 0.4 }}>{o.sub}</div>}
      </div>
    );
    body = (
      <div style={{ position: "absolute", left: 0, right: u * 8, top: cy, transform: `translateY(-50%) translateY(${rise}px)`, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 9 }}>
        {side(s.left, false)}
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 2.4, color: SUB }}>{s.connector ?? "→"}</div>
        {side(s.right, true)}
      </div>
    );
  } else if (s.type === "caption") {
    body = (
      <div style={{ position: "absolute", left: u * 8, right: u * 20, top: "58%", transform: `translateY(${rise}px)` }}>
        <div style={{ display: "inline-block", background: dark ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.55)", borderRadius: u * 1.1, padding: `${u * 1.2}px ${u * 2}px`, fontFamily: SANS, fontWeight: 600, fontSize: u * 2.9, color: INK, lineHeight: 1.25 }}>
          {hl(s.text!, s.hl, dark)}
        </div>
      </div>
    );
  } else if (s.type === "stat") {
    body = (
      <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) translateY(${rise}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 12, lineHeight: 0.9, letterSpacing: "-0.03em", color: INK }}>{hl(s.value!, s.value, dark)}</div>
        <div style={{ fontFamily: MONO, fontSize: u * 1.4, letterSpacing: "0.22em", color: SUB, marginTop: u * 0.8 }}>{s.label}</div>
        {s.sub && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.9, color: dark ? LIME : "#3a4a12", marginTop: u * 0.6 }}>{s.sub}</div>}
      </div>
    );
  } else if (s.type === "quote") {
    body = (
      <div style={{ position: "absolute", left: u * 8, right: u * 26, top: cy, transform: `translateY(-50%) translateY(${rise}px)` }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: u * 4.4, lineHeight: 1.1, color: INK }}>{hl(s.text!, s.hl, dark)}</div>
      </div>
    );
  } else if (s.type === "assemble") {
    const ids = ["database", "loop", "files", "dashboard", "spark"];
    const labels = ["DATABASE", "LOOPS", "FILES", "DASHBOARD", "MODEL"];
    const rowY = H * 0.46, gap = W * 0.155, x0 = W * 0.5 - gap * 2;
    const head = interpolate(t, [s.start + 1.0, s.start + 1.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
    body = (
      <>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {ids.slice(0, -1).map((_, i) => {
            const x1 = x0 + gap * i + u * 3.4, x2 = x0 + gap * (i + 1) - u * 3.4;
            const dp = interpolate(t, [s.start + 0.3 + i * 0.12, s.start + 0.6 + i * 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
            return <line key={i} x1={x1} y1={rowY} x2={x1 + (x2 - x1) * dp} y2={rowY} stroke={SUB} strokeWidth={u * 0.1} opacity={0.6} strokeLinecap="round" />;
          })}
        </svg>
        {ids.map((id, i) => {
          const ap = interpolate(t, [s.start + i * 0.12, s.start + 0.45 + i * 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return (
            <div key={id} style={{ position: "absolute", left: x0 + gap * i, top: rowY, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * ap})`, opacity: ap, textAlign: "center" }}>
              <div style={{ height: u * 7, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon id={id} size={u * 6} line={LN} frame={frame} p={ap} /></div>
              <div style={{ fontFamily: MONO, fontSize: u * 0.92, letterSpacing: "0.12em", color: SUB, marginTop: u * 0.8 }}>{labels[i]}</div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.68, textAlign: "center", opacity: head }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 3.6, letterSpacing: "-0.02em", color: INK }}>{hl(s.head ?? "This is a business brain.", s.headHl ?? "business brain.", dark)}</div>
        </div>
      </>
    );
  }

  return <AbsoluteFill style={{ opacity: op, pointerEvents: "none" }}>{body}</AbsoluteFill>;
};

export default BusinessBrainBody;
