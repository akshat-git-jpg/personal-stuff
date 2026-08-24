/**
 * boards.tsx — the archetype boards for the Business Brain film, all in System v1.
 * Each board reads a `spec` object from the film manifest and animates from its own sequence frame 0.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  Page, InkLayer, Offset, NumBadge, MonoEyebrow, Headline, Counterpoint, Marker,
  useU, useFade, f, EASE, SANS, MONO, SERIF, RAISIN, SILVER_SOFT, BODY, LIME, WHITE,
} from "./Brand";
import { Ink } from "./Ink";

type Spec = Record<string, any>;

/* ------------------------------------------------------------------ figure caption */
const Caption: React.FC<{ label: string; sub?: string; u: number; delay: number; align?: "left" | "center" }> = ({ label, sub, u, delay, align = "center" }) => {
  const fade = useFade();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: u * 0.6, opacity: fade(delay, delay + 0.5) }}>
      <Offset u={u} radius={u * 0.7} off={u * 0.7} pad={`${u * 0.6}px ${u * 1.2}px`}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.4, letterSpacing: "0.12em", color: RAISIN, whiteSpace: "nowrap" }}>{label}</span>
      </Offset>
      {sub && <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.8, color: BODY, textAlign: align }}>{sub}</span>}
    </div>
  );
};

/* ------------------------------------------------------------------ 01 sectionOpen */
export const SectionOpen: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const fade = useFade();
  return (
    <Page>
      {/* big faint fig watermark */}
      <div style={{ position: "absolute", right: "3%", top: "2%", fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 34, color: RAISIN, opacity: fade(0.3, 1.2) * 0.05, lineHeight: 0.8 }}>{spec.fig}</div>
      <div style={{ position: "absolute", left: "6%", top: "16%", display: "flex", alignItems: "center", gap: u * 1.4 }}>
        <NumBadge n={`FIG.${spec.fig}`} u={u} delay={0.1} />
        <MonoEyebrow text={spec.eyebrow} u={u} delay={0.35} />
      </div>
      <div style={{ position: "absolute", left: "6%", top: "34%", width: "80%" }}>
        <Headline text={spec.headline} markerWord={spec.markerWord} u={u} size={7.4} delay={0.5} />
        {spec.sub && <div style={{ marginTop: u * 1.6 }}><Counterpoint text={spec.sub} u={u} size={2.6} delay={1.3} /></div>}
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------------ 02 statement */
export const Statement: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const size = spec.size === "xl" ? 8.2 : spec.size === "lg" ? 6.6 : 7;
  return (
    <Page>
      <div style={{ position: "absolute", left: "6%", top: spec.sub ? "30%" : "36%", width: "84%" }}>
        <Headline text={spec.headline} markerWord={spec.markerWord} u={u} size={size} delay={0.25} />
        {spec.sub && <div style={{ marginTop: u * 1.8 }}><Counterpoint text={spec.sub} u={u} size={2.6} delay={1.1} /></div>}
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------------ 03 stream (BrandBoard hero) */
export const Stream: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const frame = useCurrentFrame();
  const fade = useFade();
  const t = frame / 30;
  const events: string[] = spec.events || [];
  const tally = Math.floor(interpolate(t, [2, 9], [12480, 36980], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const freeze = spec.cantHold ? fade(6.4, 7.2) : 0;
  const pos = [
    { x: 0.62, y: 0.37 }, { x: 0.84, y: 0.34 }, { x: 0.58, y: 0.50 },
    { x: 0.84, y: 0.56 }, { x: 0.63, y: 0.68 }, { x: 0.86, y: 0.73 },
  ];
  return (
    <Page>
      <div style={{ position: "absolute", left: "5%", top: "20%" }}>
        <Headline text={spec.headline} markerWord={spec.markerWord} u={u} size={6.4} delay={0.2} />
        {spec.sub && <div style={{ marginTop: u * 1.1 }}><Counterpoint text={spec.sub} u={u} size={2.2} delay={1.4} /></div>}
      </div>
      {spec.showRevenue && (
        <div style={{ position: "absolute", right: "5%", top: "9%", textAlign: "right", opacity: fade(1.6, 2.2) }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.2em", color: BODY }}>REVENUE · TODAY</div>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 5, color: RAISIN, letterSpacing: "-0.02em", lineHeight: 1 }}>€{tally.toLocaleString()}</div>
        </div>
      )}
      {/* stream line + dead file */}
      <InkLayer>
        <g stroke={LIME} fill="none">
          <path d={`M 4 44 C 30 41, 64 49, 98 43`} strokeWidth={0.4} strokeLinecap="round"
            strokeDasharray={100} strokeDashoffset={100 * (1 - interpolate(frame, [f(2.0), f(3.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }))} />
        </g>
        <g opacity={1 - freeze * 0.5}>
          <Ink name={freeze > 0.5 ? "frozenFile" : "recipe"} x={7} y={30} w={16} at={2.2} accent={freeze > 0.5 ? SILVER_SOFT : LIME} color={freeze > 0.5 ? SILVER_SOFT : RAISIN} />
        </g>
      </InkLayer>
      <div style={{ position: "absolute", left: "8%", top: `${28 / 56.25 * 100}%`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.06em", color: BODY, opacity: fade(3.2, 3.8) }}>business.md</div>
      {spec.cantHold && frame >= f(6.5) && (
        <div style={{ position: "absolute", left: "7%", top: `${48 / 56.25 * 100}%`, transform: `translateY(${(1 - fade(6.5, 7.0)) * u}px)`, opacity: fade(6.5, 7.0) }}>
          <Offset u={u} radius={0} off={u * 0.7} bg={RAISIN} border={RAISIN} pad={`${u * 0.7}px ${u * 1.4}px`}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.6, letterSpacing: "0.14em", color: LIME }}>✕ CAN’T HOLD IT</span>
          </Offset>
        </div>
      )}
      {events.map((txt, i) => {
        const p = pos[i] || { x: 0.7, y: 0.4 };
        const at = 2.5 + i * 0.55;
        const inP = interpolate(frame, [f(at), f(at + 0.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        if (inP <= 0) return null;
        const money = /[€$0-9]/.test(txt);
        const fl = Math.sin(frame / 44 + i) * u * 0.4;
        return (
          <div key={i} style={{ position: "absolute", left: `${p.x * 100}%`, top: `calc(${p.y * 100}% + ${fl}px)`, transform: `translate(-50%,-50%) translate(${(1 - inP) * u}px,${(1 - inP) * u}px)`, opacity: inP }}>
            <Offset u={u} radius={u * 0.8} off={u * 0.8} pad={`${u * 0.7}px ${u * 1.3}px`}>
              <span style={{ display: "flex", alignItems: "center", gap: u * 0.7, fontFamily: SANS, fontWeight: 600, fontSize: u * 1.7, color: RAISIN, whiteSpace: "nowrap" }}>
                <span style={{ width: u * 0.8, height: u * 0.8, background: money ? LIME : "transparent", border: `${u * 0.14}px solid ${RAISIN}` }} />
                {txt}
              </span>
            </Offset>
          </div>
        );
      })}
    </Page>
  );
};

/* ------------------------------------------------------------------ 04 drawnConcept */
export const DrawnConcept: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const hasHead = !!spec.headline;
  const frozen = spec.drawing === "frozenFile";
  const accent = frozen ? SILVER_SOFT : LIME;
  const inkColor = frozen ? BODY : RAISIN;
  return (
    <Page>
      {hasHead ? (
        <>
          <div style={{ position: "absolute", left: "6%", top: "26%", width: "44%" }}>
            <Headline text={spec.headline} markerWord={spec.markerWord} u={u} size={5.6} delay={0.2} />
            {spec.sub && <div style={{ marginTop: u * 1.4 }}><Counterpoint text={spec.sub} u={u} size={2.1} delay={1.0} /></div>}
          </div>
          <InkLayer><Ink name={spec.drawing} x={60} y={13} w={30} at={0.5} accent={accent} color={inkColor} /></InkLayer>
          <div style={{ position: "absolute", left: "62%", top: `${40 / 56.25 * 100}%`, width: "26%", display: "flex", justifyContent: "center" }}>
            <Caption label={spec.label} u={u} delay={1.3} align="center" />
          </div>
        </>
      ) : (
        <>
          <InkLayer><Ink name={spec.drawing} x={35} y={9} w={30} at={0.4} accent={accent} color={inkColor} /></InkLayer>
          <div style={{ position: "absolute", left: 0, right: 0, top: `${40 / 56.25 * 100}%`, display: "flex", justifyContent: "center" }}>
            <Caption label={spec.label} sub={spec.sub} u={u} delay={1.1} align="center" />
          </div>
        </>
      )}
    </Page>
  );
};

/* ------------------------------------------------------------------ 05 compare */
const CompareCard: React.FC<{ side: Spec; u: number; delay: number; accentBad?: boolean }> = ({ side, u, delay }) => {
  const fade = useFade();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.2, opacity: fade(delay, delay + 0.5), transform: `translateY(${(1 - fade(delay, delay + 0.5)) * u}px)` }}>
      <Offset u={u} radius={u * 0.9} off={u * 0.9} pad={`${u * 1.6}px`}>
        <div style={{ width: u * 20, height: u * 15, position: "relative" }}>
          <svg width={u * 20} height={u * 15} viewBox="0 0 40 30" style={{ position: "absolute", inset: 0 }}>
            <Ink name={side.drawing} x={5} y={2} w={30} at={delay + 0.2} />
          </svg>
        </div>
      </Offset>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, letterSpacing: "-0.01em", color: RAISIN, textTransform: "uppercase" }}>{side.label}</span>
      {side.sub && <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.9, color: BODY, marginTop: -u * 0.6 }}>{side.sub}</span>}
    </div>
  );
};

export const Compare: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const fade = useFade();
  const conn = spec.connector === "→" ? "→" : "vs";
  return (
    <Page>
      {spec.headline && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "12%", textAlign: "center" }}>
          <Headline text={spec.headline} markerWord={spec.markerWord} u={u} size={4.6} delay={0.2} align="center" />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: spec.headline ? "34%" : "24%", display: "flex", alignItems: "center", justifyContent: "center", gap: u * 6 }}>
        <CompareCard side={spec.left} u={u} delay={0.5} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: fade(1.0, 1.5), fontFamily: conn === "vs" ? SERIF : SANS, fontStyle: conn === "vs" ? "italic" : "normal", fontWeight: 800, fontSize: u * (conn === "vs" ? 3.2 : 5), color: conn === "vs" ? BODY : LIME, alignSelf: "center", marginTop: u * 2 }}>{conn}</div>
        <CompareCard side={spec.right} u={u} delay={0.9} />
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------------ 06 stat */
export const Stat: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const fade = useFade();
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [f(0.3), f(0.9)], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <Page>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 1.2 }}>
        <div style={{ opacity: fade(0.2, 0.6) }}><MonoEyebrow text={spec.label} u={u} delay={0.2} /></div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 16, color: RAISIN, letterSpacing: "-0.03em", lineHeight: 0.9, transform: `scale(${pop})`, opacity: fade(0.3, 0.8) }}>
          <span style={{ position: "relative", display: "inline-block" }}>
            <span style={{ position: "absolute", left: -u * 0.8, right: -u * 0.8, top: "20%", bottom: "14%", background: LIME, transform: `scaleX(${interpolate(frame, [f(0.7), f(1.3)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE })})`, transformOrigin: "left center", zIndex: 0, opacity: 0.9 }} />
            <span style={{ position: "relative", zIndex: 1 }}>{spec.value}</span>
          </span>
        </div>
        {spec.sub && <Counterpoint text={spec.sub} u={u} size={2.6} delay={1.2} align="center" />}
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------------ 08 queryAnswer */
export const QueryAnswer: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const fade = useFade();
  const frame = useCurrentFrame();
  const answers: string[] = spec.answers || [];
  return (
    <Page>
      {spec.prompt && (
        <div style={{ position: "absolute", left: "8%", right: "8%", top: "16%", opacity: fade(0.2, 0.7) }}>
          <Offset u={u} radius={u * 0.8} off={u * 0.8} pad={`${u * 1.2}px ${u * 1.6}px`}>
            <div style={{ display: "flex", alignItems: "center", gap: u * 1 }}>
              <span style={{ width: u * 1.6, height: u * 1.6, flexShrink: 0 }}>
                <svg viewBox="0 0 40 40" width={u * 1.6} height={u * 1.6}><path d="M20 4 C22 16 24 18 36 20 C24 22 22 24 20 36 C18 24 16 22 4 20 C16 18 18 16 20 4 Z" fill={LIME} /></svg>
              </span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.7, color: RAISIN, letterSpacing: "0.01em" }}>{spec.prompt}</span>
            </div>
          </Offset>
        </div>
      )}
      <div style={{ position: "absolute", left: "10%", right: "10%", top: spec.prompt ? "38%" : "26%", display: "flex", flexDirection: "column", gap: u * 1.6 }}>
        {answers.map((a, i) => {
          const at = 0.7 + i * 0.7;
          const inP = interpolate(frame, [f(at), f(at + 0.45)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 1.3, opacity: inP, transform: `translateX(${(1 - inP) * u * 1.5}px)` }}>
              <span style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 2.4, color: LIME, width: u * 3 }}>✓</span>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 3, color: RAISIN, letterSpacing: "-0.02em" }}>{a}</span>
            </div>
          );
        })}
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------------ 09 closer */
export const Closer: React.FC<{ spec: Spec }> = ({ spec }) => {
  const u = useU();
  const fade = useFade();
  return (
    <Page>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 2 }}>
        <Headline text={spec.headline} markerWord={spec.markerWord} u={u} size={7.2} delay={0.2} align="center" />
        {spec.sub && <Counterpoint text={spec.sub} u={u} size={2.8} delay={1.0} align="center" />}
        {spec.cta && (
          <div style={{ marginTop: u * 1.5, opacity: fade(1.4, 2.0) }}>
            <Offset u={u} radius={u * 0.8} off={u * 0.8} pad={`${u * 0.9}px ${u * 1.8}px`}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.1em", color: RAISIN }}>{spec.cta}</span>
            </Offset>
          </div>
        )}
      </div>
    </Page>
  );
};
