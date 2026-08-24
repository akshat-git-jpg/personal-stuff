/**
 * Machine.tsx — the "Business Brain" progressive assembly (film climax).
 * ONE board spanning the machine narration (~78s). Reveals hub-and-spoke, one part per beat:
 * database CORE → LOOPS (left) → SKILL FILES (top) → DASHBOARD (right) → MODEL (bottom, last) → complete + named.
 * Kept deliberately airy and one-part-at-a-time so it never reads as the old "messy schematic".
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Page, InkLayer, Offset, useU, f, EASE, SANS, MONO, RAISIN, BODY, LIME, SILVER_SOFT, WHITE } from "./Brand";
import { Ink } from "./Ink";

export type MachineStages = { core: number; lists: number; loops: number; fill: number; skills: number; howwhat: number; dash: number; model: number; name: number };
const DEF: MachineStages = { core: 0, lists: 7.8, loops: 19.5, fill: 27.7, skills: 42.3, howwhat: 52.7, dash: 58, model: 65.3, name: 70.2 };

const rp = (frame: number, at: number, d = 0.8) => interpolate(frame, [f(at), f(at + d)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

// a lime connector line that draws from the core to a satellite
const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; at: number; on: number }> = ({ x1, y1, x2, y2, at, on }) => {
  const frame = useCurrentFrame();
  const len = Math.hypot(x2 - x1, y2 - y1);
  const p = rp(frame, at, 0.6);
  return <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={LIME} strokeWidth={0.34} strokeLinecap="round" fill="none" strokeDasharray={len} strokeDashoffset={len * (1 - p)} opacity={on * 0.9} />;
};

// mono tag with lime square, positioned by page %
const Tag: React.FC<{ text: string; sub?: string; xPct: number; yPct: number; u: number; on: number; align?: "left" | "center" | "right" }> = ({ text, sub, xPct, yPct, u, on, align = "center" }) => (
  <div style={{ position: "absolute", left: `${xPct}%`, top: `${yPct}%`, transform: `translate(-50%,-50%) translateY(${(1 - on) * u * 0.8}px)`, opacity: on, textAlign: align, whiteSpace: "nowrap" }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.6 }}>
      <span style={{ width: u * 0.72, height: u * 0.72, background: LIME }} />
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.12em", color: RAISIN }}>{text}</span>
    </span>
    {sub && <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 0.95, letterSpacing: "0.05em", color: BODY, marginTop: u * 0.3 }}>{sub}</div>}
  </div>
);

export const MachineBoard: React.FC<{ stages?: Partial<MachineStages> }> = ({ stages }) => {
  const u = useU();
  const frame = useCurrentFrame();
  const s = { ...DEF, ...(stages || {}) };
  const on = (at: number, d?: number) => rp(frame, at, d);

  // core recedes slightly once name lands so the headline reads
  const nameP = on(s.name, 1.0);

  return (
    <Page>
      {/* eyebrow */}
      <div style={{ position: "absolute", left: "6%", top: "7%", opacity: on(s.core - 0.2 < 0 ? 0 : s.core, 0.5) }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.7 }}>
          <span style={{ width: u * 0.8, height: u * 0.8, background: LIME }} />
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em", color: BODY }}>HOW IT’S BUILT</span>
        </span>
      </div>

      <InkLayer>
        {/* wires (under drawings) */}
        <Wire x1={43} y1={27} x2={20} y2={13} at={s.loops + 0.2} on={on(s.loops)} />
        <Wire x1={41} y1={29} x2={18} y2={29} at={s.loops + 0.3} on={on(s.loops)} />
        <Wire x1={43} y1={31} x2={20} y2={45} at={s.loops + 0.4} on={on(s.loops)} />
        <Wire x1={50} y1={20} x2={50} y2={12} at={s.skills + 0.3} on={on(s.skills)} />
        <Wire x1={58} y1={28} x2={72} y2={28} at={s.dash + 0.3} on={on(s.dash)} />
        <Wire x1={50} y1={36} x2={50} y2={43} at={s.model + 0.3} on={on(s.model)} />

        {/* CORE database */}
        <g opacity={1 - nameP * 0.0}><Ink name="database" x={42} y={19} w={16} at={s.core} accent={LIME} /></g>

        {/* LOOPS (left, three) */}
        <g opacity={on(s.loops)}>
          <Ink name="loop" x={9} y={8} w={9} at={s.loops} />
          <Ink name="loop" x={7} y={24} w={9} at={s.loops + 0.15} />
          <Ink name="loop" x={9} y={40} w={9} at={s.loops + 0.3} />
        </g>
        {/* SKILL FILES (top) */}
        <g opacity={on(s.skills)}><Ink name="stackFiles" x={44} y={1} w={12} at={s.skills} /></g>
        {/* DASHBOARD (right) */}
        <g opacity={on(s.dash)}><Ink name="dashboard" x={72} y={17} w={22} at={s.dash} /></g>
        {/* MODEL (bottom, small) */}
        <g opacity={on(s.model)}><Ink name="spark" x={46} y={41} w={8} at={s.model} accent={SILVER_SOFT} color={SILVER_SOFT} /></g>
      </InkLayer>

      {/* labels */}
      <Tag text="ONE DATABASE" sub="the core · lists it can count" xPct={50} yPct={68} u={u} on={on(s.core + 0.4)} />
      <Tag text="SMALL LOOPS" sub="fill it automatically" xPct={13} yPct={62} u={u} on={on(s.loops + 0.3)} />
      <Tag text="SKILL FILES" sub="the recipes, on top" xPct={72} yPct={9} u={u} on={on(s.skills + 0.3)} />
      <Tag text="ONE DASHBOARD" sub="the whole business, one screen" xPct={83} yPct={78} u={u} on={on(s.dash + 0.3)} />
      <Tag text="THE MODEL · LAST" sub="least important" xPct={62} yPct={80} u={u} on={on(s.model + 0.3)} />

      {/* HOW/WHAT annotation (the recipe reads from files, the facts from the base) */}
      {on(s.howwhat) > 0 && (
        <div style={{ position: "absolute", left: "62%", top: "42%", opacity: on(s.howwhat), transform: `translateY(${(1 - on(s.howwhat)) * u}px)`, display: "flex", flexDirection: "column", gap: u * 0.5 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, color: RAISIN, letterSpacing: "0.04em" }}>HOW ← files</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, color: RAISIN, letterSpacing: "0.04em" }}>WHAT ← base</span>
        </div>
      )}

      {/* FINALE: name reveal */}
      {nameP > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "5%", textAlign: "center", opacity: nameP, transform: `translateY(${(1 - nameP) * u}px)` }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 5.2, letterSpacing: "-0.03em", color: RAISIN, textTransform: "uppercase" }}>
            THIS IS A{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "absolute", left: -u * 0.5, right: -u * 0.5, top: "16%", bottom: "12%", background: LIME, transform: `scaleX(${rp(frame, s.name + 0.5, 0.6)}) rotate(-1.5deg)`, transformOrigin: "left center", zIndex: 0 }} />
              <span style={{ position: "relative", zIndex: 1 }}>BUSINESS BRAIN.</span>
            </span>
          </div>
        </div>
      )}
    </Page>
  );
};
