/**
 * adkit — shared building blocks for the MKB ad campaign (ad1..ad6 share this look).
 * Captions engine + the identical CTA plate + a couple of hook helpers. Import into each Ad comp.
 */
import React from "react";
import { Img, staticFile } from "remotion";
import { clamp01, lerp, EASE, EASE_OVER, RAISIN, RAISIN_DEEP, SILVER, SILVER_MID, PANEL, BORDER, LIME, WHITE, OLIVE, SANS, MONO } from "./scene";

export type WordT = { w: string; s: number; e: number; idx: number };
export const withIdx = (raw: { w: string; s: number; e: number }[]): WordT[] => raw.map((w, idx) => ({ ...w, idx }));

export function chunkWords(words: WordT[]): WordT[][] {
  const groups: WordT[][] = [];
  let cur: WordT[] = [];
  for (const w of words) {
    cur.push(w);
    const endsClause = /[.?!,]$/.test(w.w);
    const dur = w.e - cur[0].s;
    if ((cur.length >= 3 && (endsClause || dur > 1.5)) || cur.length >= 5) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/* running phrase-level karaoke captions — white on dark / raisin on light, one lime marker word per phrase */
export const AdCaptions: React.FC<{ groups: WordT[][]; markers: Set<string>; t: number; u: number; light: boolean; hidden?: boolean }> = ({ groups, markers, t, u, light, hidden }) => {
  if (hidden) return null;
  let gi = -1;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const start = g[0].s;
    const end = i + 1 < groups.length ? groups[i + 1][0].s : g[g.length - 1].e + 0.6;
    if (t >= start - 0.05 && t < end) { gi = i; break; }
  }
  if (gi < 0) return null;
  const g = groups[gi];
  const pop = clamp01((t - (g[0].s - 0.08)) / 0.16);
  const ink = light ? RAISIN : WHITE;
  const markerInk = light ? OLIVE : LIME;
  return (
    <div style={{ position: "absolute", left: "7%", right: "7%", top: "74%", transform: "translateY(-50%)", display: "flex", justifyContent: "center", opacity: pop, pointerEvents: "none" }}>
      <div style={{ maxWidth: "100%", textAlign: "center" }}>
        {g.map((w) => (
          <span key={w.idx} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: u * 4.6, lineHeight: 1.14, letterSpacing: "-0.02em",
            color: markers.has(w.w) ? markerInk : ink,
            textShadow: light ? "0 2px 3px rgba(255,255,255,0.9)" : "0 3px 4px rgba(0,0,0,0.9), 0 2px 22px rgba(0,0,0,0.85)",
            margin: `0 ${u * 0.42}px`, textTransform: "uppercase", display: "inline-block",
          }}>{w.w}</span>
        ))}
      </div>
    </div>
  );
};

/* frame-0 lime flash for the hook (≤2 frames) */
export const HookFlash: React.FC<{ t: number; at?: number }> = ({ t, at = 0.04 }) => {
  const flash = Math.max(0, 0.4 * (1 - Math.abs(t - at) / 0.04));
  return flash > 0 ? <div style={{ position: "absolute", inset: 0, background: LIME, opacity: flash }} /> : null;
};

/* raisin side-scrim so hero text on one side stays legible over the footage */
export const SideScrim: React.FC<{ side?: "left" | "right" }> = ({ side = "left" }) => (
  <div style={{ position: "absolute", inset: 0, background: side === "left"
    ? `linear-gradient(90deg, ${RAISIN}e6 0%, ${RAISIN}90 36%, transparent 64%)`
    : `linear-gradient(270deg, ${RAISIN}e6 0%, ${RAISIN}90 36%, transparent 64%)` }} />
);

/* the identical campaign CTA plate — pass t0 = when the scrim starts fading in */
export const CtaPlate: React.FC<{ u: number; W: number; H: number; t: number; t0: number }> = ({ u, W, H, t, t0 }) => {
  if (t < t0 - 0.1) return null;
  const scrimOn = clamp01((t - t0) / 0.6);
  const brandOn = clamp01((t - (t0 + 0.2)) / 0.4);
  const plateOn = EASE_OVER(clamp01((t - (t0 + 0.6)) / 0.5));
  const curP = clamp01((t - (t0 + 1.4)) / 0.85);
  const clickAt = t0 + 2.5;
  const click = Math.max(0, 1 - Math.abs(t - clickAt) / 0.22);
  const ripple = clamp01((t - clickAt) / 0.5);
  const arrowT = t - (t0 + 3.4);
  const arrowOn = clamp01(arrowT / 0.3);
  const arrowBob = arrowOn > 0 ? Math.sin(Math.max(0, arrowT) * 3.4) * u * 0.7 : 0;
  const pulse = 0.10 + Math.sin(t * 2) * 0.05;
  const curX = lerp(70, 50, EASE(curP)), curY = lerp(76, 55, EASE(curP));
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 92% 82% at 50% 45%, rgba(11,13,18,0.72) 0%, rgba(11,13,18,0.9) 100%)`, opacity: scrimOn }} />
      <div style={{ position: "absolute", left: "50%", top: "14.5%", transform: "translate(-50%,-50%)", opacity: brandOn, fontFamily: SANS, fontWeight: 700, fontSize: u * 3.4, color: WHITE, letterSpacing: "-0.01em" }}>everyman.ai</div>
      {plateOn > 0 && <div style={{ position: "absolute", left: "50%", top: "55%", width: u * 62, height: u * 48, transform: "translate(-50%,-50%)", borderRadius: "50%", background: `radial-gradient(ellipse, ${LIME}${Math.round(pulse * 255).toString(16).padStart(2, "0")} 0%, transparent 66%)` }} />}
      {plateOn > 0 && (
        <div style={{ position: "absolute", left: "50%", top: "55%", width: "90%", transform: `translate(-50%,-50%) scale(${(0.85 + 0.15 * plateOn) * (1 - click * 0.03)})`, opacity: plateOn }}>
          <div style={{ position: "relative", background: LIME, borderRadius: u * 2.0, padding: `${u * 2.2}px ${u * 2.2}px`, boxShadow: `0 ${u * 1.4}px ${u * 3.6}px rgba(0,0,0,0.55)`, textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.55, letterSpacing: "0.14em", color: RAISIN, opacity: 0.72, marginBottom: u * 0.7 }}>GRATIS &middot; 15 MIN</div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.3, color: RAISIN, lineHeight: 1.13 }}>Plan een<br />kennismakingsgesprek</div>
            {ripple > 0 && ripple < 1 && <div style={{ position: "absolute", left: "50%", top: "50%", width: u * ripple * 44, height: u * ripple * 44, transform: "translate(-50%,-50%)", borderRadius: "50%", border: `${u * 0.35}px solid ${WHITE}`, opacity: (1 - ripple) * 0.6 }} />}
          </div>
        </div>
      )}
      {curP > 0 && t < clickAt + 1.1 && (
        <div style={{ position: "absolute", left: `${curX}%`, top: `${curY - click * 1.0}%`, transform: `translate(-30%,-20%) scale(${1 - click * 0.16})`, filter: `drop-shadow(0 ${u * 0.35}px ${u * 0.7}px rgba(0,0,0,0.7))`, zIndex: 5 }}>
          <svg width={u * 5.2} height={u * 5.2} viewBox="0 0 24 24" fill={WHITE} stroke={RAISIN} strokeWidth={1.1} strokeLinejoin="round"><path d="M4 2 L4 18 L8.5 13.5 L11 19.5 L13.5 18.5 L11 12.5 L17 12.5 Z" /></svg>
        </div>
      )}
      {arrowOn > 0 && (
        <div style={{ position: "absolute", left: "50%", top: `${80 + arrowBob / (H / 100)}%`, transform: "translate(-50%,-50%)", opacity: arrowOn, textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, color: LIME, letterSpacing: "0.08em", marginBottom: u * 0.5 }}>DE LINK STAAT HIERONDER</div>
          <svg width={u * 5.5} height={u * 5.5} viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto", display: "block" }}><path d="M6 9l6 6 6-6" /></svg>
        </div>
      )}
    </>
  );
};

/* the campaign Claude hub (dark disc + lime ring + coral mark) */
export const ClaudeHub: React.FC<{ u: number; d?: number; s?: number; o?: number }> = ({ u, d = 10, s = 1, o = 1 }) => (
  <div style={{ transform: `scale(${s})`, opacity: o }}>
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: -u * 1.3, borderRadius: "50%", background: `radial-gradient(circle, ${LIME}38 0%, transparent 72%)` }} />
      <div style={{ position: "relative", width: u * d, height: u * d, borderRadius: "50%", background: "#1a1f14", border: `${u * 0.2}px solid ${LIME}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${u * 0.9}px ${u * 2.3}px rgba(0,0,0,0.6)` }}>
        <Img src={staticFile("logos/claude.svg")} style={{ width: u * d * 0.56, height: u * d * 0.56 }} />
      </div>
    </div>
  </div>
);

/* solid worker-figure pictogram (silver=generic, lime=operator) */
export const Glyph: React.FC<{ w: number; color: string; glow?: boolean }> = ({ w, color, glow }) => (
  <div style={{ position: "relative", filter: glow ? `drop-shadow(0 0 ${w * 0.2}px ${color}cc)` : `drop-shadow(0 ${w * 0.05}px ${w * 0.09}px rgba(0,0,0,0.55))` }}>
    <svg width={w} height={w * 1.15} viewBox="0 0 40 46"><circle cx={20} cy={11} r={8.9} fill={color} /><path d="M2 46 C2 27 9 18 20 18 C31 18 38 27 38 46 Z" fill={color} /></svg>
  </div>
);

/* a connector line that DRAWS on via pathLength (coords in %) */
export const Connector: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; u: number; W: number; H: number; color?: string }> = ({ x1, y1, x2, y2, p, u, W, H, color = LIME }) => {
  if (p <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <line x1={(x1 / 100) * W} y1={(y1 / 100) * H} x2={(x2 / 100) * W} y2={(y2 / 100) * H} stroke={color} strokeWidth={u * 0.16} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={0.9} style={{ filter: `drop-shadow(0 0 ${u * 0.4}px ${color}aa)` }} />
    </svg>
  );
};

/* a wired system node (logo + label) */
export const SysNode: React.FC<{ u: number; x: number; y: number; icon: string; label: string; on: number }> = ({ u, x, y, icon, label, on }) => {
  if (on <= 0) return null;
  const s = 0.55 + 0.45 * EASE_OVER(on);
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${s})`, opacity: clamp01(on * 1.6), display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.7 }}>
      <div style={{ position: "relative", width: u * 7.6, height: u * 7.6, borderRadius: "50%", background: `linear-gradient(158deg, ${PANEL} 0%, ${RAISIN_DEEP} 100%)`, border: `${u * 0.18}px solid ${LIME}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${u * 0.7}px ${u * 1.9}px rgba(0,0,0,0.6)` }}>
        <Img src={staticFile(`logos/${icon}`)} style={{ width: u * 4.0, height: u * 4.0 }} />
      </div>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.55, letterSpacing: "0.04em", color: WHITE, textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}>{label}</span>
    </div>
  );
};

/* rounded lime-bordered app-tile with an icon + label */
export const IconBadge: React.FC<{ u: number; x: number; y: number; icon?: string; node?: React.ReactNode; label: string; on: number; size?: number }> = ({ u, x, y, icon, node, label, on, size = 10.4 }) => {
  if (on <= 0) return null;
  const eo = EASE_OVER(on);
  const s = 0.5 + 0.5 * eo;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${s})`, opacity: clamp01(on * 1.6), display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.8 }}>
      <div style={{ position: "relative", width: u * size, height: u * size, borderRadius: u * size * 0.25, background: `linear-gradient(158deg, ${PANEL} 0%, ${RAISIN_DEEP} 100%)`, border: `${u * 0.2}px solid ${LIME}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${u * 0.9}px ${u * 2.4}px rgba(0,0,0,0.6)` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: u * size * 0.25, background: `radial-gradient(circle at 50% 28%, ${LIME}22 0%, transparent 62%)` }} />
        {node ? node : <Img src={staticFile(`logos/${icon}`)} style={{ width: u * size * 0.5, height: u * size * 0.5 }} />}
      </div>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.75, letterSpacing: "0.05em", color: WHITE, whiteSpace: "nowrap", textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}>{label}</span>
    </div>
  );
};

/* 6-week bar filling 1→6 (light or dark register) */
export const WeekBar: React.FC<{ u: number; x: number; y: number; p: number; light?: boolean }> = ({ u, x, y, p, light }) => {
  const filled = p * 6;
  const ink = light ? RAISIN : WHITE;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", textAlign: "center" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.7, letterSpacing: "0.2em", color: light ? RAISIN : SILVER, opacity: 0.7, marginBottom: u * 1.4 }}>IN {Math.min(6, Math.ceil(filled))} / 6 WEKEN</div>
      <div style={{ display: "flex", gap: u * 1.0, justifyContent: "center" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const on = clamp01(filled - i);
          return <div key={i} style={{ width: u * 7, height: u * 2.4, borderRadius: u * 0.6, background: on > 0.05 ? LIME : (light ? "#0f121a18" : "#ffffff18"), border: `${u * 0.12}px solid ${on > 0.05 ? LIME : (light ? "#0f121a30" : "#ffffff30")}`, transform: `scaleY(${0.7 + 0.3 * on})` }} />;
        })}
      </div>
      <span style={{ display: "none" }}>{ink}</span>
    </div>
  );
};
