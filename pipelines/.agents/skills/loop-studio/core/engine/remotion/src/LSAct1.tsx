/**
 * LSAct1 — Loop Studio flagship, Act 1: "THE DARE" (0–108.43s, 3253f @30fps).
 * Naked cold open → this_video.mp4 born → raw vs edited rail → talk-not-timeline →
 * $2,000 crumbles to $0 → the hook demoted → tiny "AI editing" toys → THE WHOLE JOB arc →
 * editing quietly kills creators → the breath → THE MAP (six tiles) → taught the system →
 * made by the machine → five identical takes → the system cuts → cuts in the
 * silences → never mid-word → the clip steps toward Act 2.
 * Footage plays from 0 (same take → lip sync). Voice only; SFX + music mixed in post.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, LIME, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Marker, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";

const FPS = 30;

/* headline helper. bottom=true → the LOCKED bottom-middle placement shared by every beat:
   centered at (50%, 88%), SANS 800 uppercase, u*2.9, SILVER on dark / RAISIN on light,
   with a legibility shadow. The one lime Marker word rides inside the children. */
const H1: React.FC<{ u: number; t: number; children: React.ReactNode; top?: string; left?: string; center?: boolean; size?: number; in0: number; out?: number; color?: string; bottom?: boolean }> = ({ u, t, children, top = "14%", left = "6%", center, size = 3.3, in0, out, color = SILVER, bottom }) => {
  const opacity = clamp01((t - in0) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1);
  if (bottom) return (
    <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", textAlign: "center", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 2.9, letterSpacing: "-0.02em", color, textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.7)", opacity }}>{children}</div>
  );
  return (
    <div style={{ position: "absolute", left: center ? "50%" : left, top, transform: center ? "translate(-50%,-50%)" : "none", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color, textTransform: "uppercase", textAlign: center ? "center" : "left", opacity }}>{children}</div>
  );
};

/* (mono eyebrow/kicker labels removed — headlines now live bottom-middle only) */

/* position keyframer for traveling objects: [t, x%, y%, scale] */
const kfp = (t: number, ks: number[][]) => {
  let a = ks[0];
  for (let i = 1; i < ks.length; i++) {
    const b = ks[i];
    if (t <= b[0]) {
      const p = EASE_OVER(clamp01((t - a[0]) / Math.max(0.0001, b[0] - a[0])));
      return { x: lerp(a[1], b[1], p), y: lerp(a[2], b[2], p), s: lerp(a[3], b[3], p) };
    }
    a = b;
  }
  return { x: a[1], y: a[2], s: a[3] };
};

/* THE traveling object: dirty filmstrip card (raw_take_01.mov). cut=true → one stage cleaner. */
const DirtyCard: React.FC<{ u: number; sc?: number; o?: number; cut?: boolean; rot?: number }> = ({ u, sc = 1, o = 1, cut, rot = -2 }) => (
  <div style={{ transform: `rotate(${rot}deg) scale(${sc})`, opacity: o }}>
    <div style={{ width: u * 15, background: "#161a24", border: `${u * 0.12}px solid ${cut ? SILVER : SILVER_MID}`, borderRadius: u * 0.5, overflow: "hidden", boxShadow: `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.55)`, filter: cut ? "none" : "grayscale(0.35) brightness(0.92)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: `${u * 0.3}px ${u * 0.55}px 0` }}>
        {Array.from({ length: 8 }).map((_, i) => <span key={i} style={{ width: u * 0.7, height: u * 0.45, background: "#2a3145", borderRadius: u * 0.12 }} />)}
      </div>
      <div style={{ display: "flex", gap: u * 0.35, padding: `${u * 0.4}px ${u * 0.55}px` }}>
        {(cut ? [0.75, 0.5] : [0.55, 0.55, 0.55, 0.55]).map((h, i) => (
          <div key={i} style={{ flex: 1, height: u * 4.0, background: "#0d1017", border: `${u * 0.07}px solid #2a3145`, borderRadius: u * 0.2, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: u * 0.28, padding: `0 ${u * 0.35}px ${u * 0.35}px` }}>
            {[0.5, h, 0.38].map((b, j) => <span key={j} style={{ width: u * 0.6, height: `${b * 100}%`, background: cut ? LIME : "#4a5268", opacity: cut ? 0.85 : 1 }} />)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: `0 ${u * 0.55}px` }}>
        {Array.from({ length: 8 }).map((_, i) => <span key={i} style={{ width: u * 0.7, height: u * 0.45, background: "#2a3145", borderRadius: u * 0.12 }} />)}
      </div>
      <div style={{ padding: `${u * 0.4}px ${u * 0.65}px ${u * 0.5}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, color: SILVER_MID, whiteSpace: "nowrap" }}>
        raw_take_01.mov · {cut ? <><span style={{ textDecoration: "line-through", opacity: 0.55 }}>47:12</span> <span style={{ color: LIME }}>-&gt; 08:41</span></> : "47:12"}
      </div>
    </div>
  </div>
);

/* the destination object: this_video.mp4 — dashed wireframe (beat 1) or crisp lime-edged (beat 2+) */
const CleanCard: React.FC<{ u: number; sc?: number; o?: number; dashed?: boolean }> = ({ u, sc = 1, o = 1, dashed }) => (
  <div style={{ transform: `scale(${sc})`, opacity: o }}>
    <div style={{ width: u * 15, borderRadius: u * 0.5, border: dashed ? `${u * 0.15}px dashed ${SILVER}` : `${u * 0.12}px solid ${LIME}`, background: dashed ? "rgba(13,16,23,0.4)" : "#12151d", boxShadow: dashed ? "none" : `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.5)` }}>
      <div style={{ height: u * 5.6, margin: u * 0.6, borderRadius: u * 0.3, border: `${u * 0.1}px dashed ${dashed ? "#7a8296" : "#3a4256"}` }} />
      <div style={{ padding: `0 ${u * 0.7}px ${u * 0.55}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.98, color: SILVER, whiteSpace: "nowrap" }}>this_video.mp4</div>
    </div>
  </div>
);

/* pipeline step: a numbered milestone on the whole-job journey (beat 7) */
const Step: React.FC<{ u: number; x: number; y: number; n: number; label: string; at: number; t: number; scale?: number }> = ({ u, x, y, n, label, at, t, scale = 1 }) => {
  const o = clamp01((t - at) / 0.3);
  const pop = 0.6 + 0.4 * EASE_OVER(clamp01((t - at) / 0.42));
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${pop * scale})`, opacity: o }}>
      <div style={{ display: "flex", alignItems: "center", gap: u * 0.55, background: "#12151d", border: `${u * 0.12}px solid ${LIME}`, borderRadius: u * 0.55, padding: `${u * 0.38}px ${u * 0.9}px ${u * 0.38}px ${u * 0.42}px`, boxShadow: `0 ${u * 0.5}px ${u * 1.4}px rgba(0,0,0,0.5), 0 0 ${u * 0.9}px ${LIME}55`, whiteSpace: "nowrap" }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u * 1.5, height: u * 1.5, borderRadius: "50%", background: RAISIN_DEEP, border: `${u * 0.1}px solid ${LIME}`, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, color: LIME, flexShrink: 0 }}>{n}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.15, letterSpacing: "0.02em", color: SILVER, textTransform: "uppercase" }}>{label}</span>
      </div>
    </div>
  );
};

export const LSAct1: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  /* Panel choreography law: position changes ONLY in the short gap AT a beat boundary. */
  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },          // beat 1: FULL naked
    { t: 10.74, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 11.35, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beats 2–3: panel right
    { t: 22.52, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 22.82, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // beats 4–5: FULL (money confession)
    { t: 38.24, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 38.95, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beat 6: panel
    { t: 43.72, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 44.45, x: 50, y: 50, s: 1, dim: 1, fr: 1 },       // beat 7: hidden (graphics climax)
    { t: 51.8, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 52.45, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beat 8: panel
    { t: 62.22, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 62.5, x: 50, y: 50, s: 1, dim: 0, fr: 0 },        // beat 9: FULL, zero graphics
    { t: 65.04, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 65.7, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },  // beat 10: panel (grid removed → presenter fills the space, matches beats 11–12)
    { t: 73.72, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 74.35, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 }, // beats 11–14: panel, STATIC
    { t: 97.94, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
    { t: 98.5, x: 50, y: 50, s: 1, dim: 1, fr: 1 },        // beat 15: hidden (hero wave)
    { t: 103.94, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 104.55, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },// beat 16: panel
    { t: 108.43, x: 74, y: 52, s: 0.92, dim: 0.06, fr: 1 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);
  /* LIGHT register window: THE MAP chapter (beats 10–12) */
  const lite = clamp01((t - 65.15) / 0.5) * (1 - clamp01((t - 87.2) / 0.5));

  /* through-line card keyframes */
  const rawKF = [[12.44, -14, 46, 1], [12.8, 16, 46, 1], [15.3, 16, 46, 1], [15.95, 12, 91, 0.42], [44.9, 12, 91, 0.42], [45.6, 18, 50, 0.95], [52.0, 18, 50, 0.95], [52.7, 12, 42, 0.6]];

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("footage/ls_th1_voice.m4a")} />
      <DarkBg u={u} gridOpacity={sk.fr} />
      <LightBg u={u} opacity={lite} />

      {/* ============ GRAPHICS WORLD ============ */}
      <div style={{ position: "absolute", inset: 0, opacity: graphicsOn }}>

        {/* THROUGH-LINE (12.2–62.2): the dirty raw card + clean placeholder + rail. Full-size in
            beat 2, shrinks to the bottom strip at 15.3, hides with the world during full beats,
            re-lights in beat 6, the raw card rises at 44.9 (beat 7) and compacts with the arc (beat 8). */}
        {t >= 12.2 && t < 62.22 && (() => {
          const raw = kfp(t, rawKF);
          /* rail: between cards full-size, then the strip spine. It vanishes at 44.9 when the raw
             card rises out of the bottom strip — so it never sits under the bottom-middle headline. */
          const mor = EASE(clamp01((t - 15.3) / 0.65));
          const railDraw = EASE(clamp01((t - 14.4) / 0.6));
          const r1x = lerp(21.5, 15.2, mor), r2x = lerp(34.5, 40.8, mor), ry = lerp(46, 91, mor);
          const railO = railDraw * (t < 44.9 ? 1 : 0);
          /* lime pulse from the note chip (beat 3) into the raw card */
          const pp = clamp01((t - 21.74) / 0.5);
          const flash = clamp01((t - 22.1) / 0.15) * (1 - clamp01((t - 22.6) / 0.4));
          return (
            <>
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <line x1={W * r1x / 100} y1={H * ry / 100} x2={W * (r1x + (r2x - r1x) * railDraw) / 100} y2={H * ry / 100} stroke={SILVER_MID} strokeWidth={u * 0.16} strokeDasharray={`${u * 0.9} ${u * 0.7}`} opacity={railO} />
                {pp > 0 && pp < 1 && (() => { const px = lerp(26, 13, pp), py = lerp(47, 88, pp * pp); return <circle cx={W * px / 100} cy={H * py / 100} r={u * 0.45} fill={LIME} style={{ filter: `drop-shadow(0 0 ${u * 0.6}px ${LIME})` }} />; })()}
              </svg>
              <div style={{ position: "absolute", left: `${raw.x}%`, top: `${raw.y}%`, transform: "translate(-50%,-50%)", filter: flash > 0 ? `drop-shadow(0 0 ${u * 1.2 * flash}px ${LIME})` : "none" }}>
                <DirtyCard u={u} sc={raw.s} />
              </div>
            </>
          );
        })()}

        {/* BEAT 3 — never open an editor (15.02–22.52): editor window struck twice, drops dead;
            a spoken note chip replaces it and fires at the raw clip. */}
        {t >= 15.4 && t < 22.52 && (() => {
          const won = clamp01((t - 16.62) / 0.35);
          const x1 = clamp01((t - 17.58) / 0.3);
          const x2 = clamp01((t - 19.28) / 0.3);
          const drop = EASE(clamp01((t - 19.62) / 0.6));
          const NOTE = "“make the intro punchier”";
          const typed = NOTE.slice(0, Math.max(0, Math.floor((t - 20.6) * 24)));
          const noteOn = clamp01((t - 20.6) / 0.25);
          const out = 1 - clamp01((t - 22.15) / 0.35);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: out }}>
              <H1 u={u} t={t} in0={20.55} top="14%">I JUST <Marker u={u} t={t} at={20.7}>TALK</Marker></H1>
              {/* generic editor window */}
              {won > 0 && drop < 1 && (
                <div style={{ position: "absolute", left: "26%", top: `${38 + drop * 65}%`, transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * EASE_OVER(won)}) rotate(${drop * 7}deg)`, opacity: won * (1 - clamp01((drop - 0.55) / 0.4)) }}>
                  <div style={{ width: u * 19, background: "#12151d", border: `${u * 0.11}px solid #2a3145`, borderRadius: u * 0.8, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.6)` }}>
                    <div style={{ position: "relative", height: u * 2.5, background: "#181c28", borderBottom: `${u * 0.08}px solid #232939`, display: "flex", alignItems: "center", gap: u * 0.5, padding: `0 ${u * 1}px` }}>
                      {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.65, height: u * 0.65, borderRadius: "50%", background: "#3a4256" }} />)}
                      <span style={{ marginLeft: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: SILVER_SOFT }}>editor</span>
                      {/* first strike: across the title bar */}
                      <div style={{ position: "absolute", left: u * 0.8, right: u * 0.8, top: "50%", height: u * 0.3, background: "#8a93a8", borderRadius: u * 0.15, transform: `translateY(-50%) scaleX(${x1}) rotate(-1.4deg)`, transformOrigin: "left center" }} />
                    </div>
                    {/* timeline: two track rows */}
                    <div style={{ position: "relative", padding: `${u * 0.9}px ${u * 1}px`, display: "flex", flexDirection: "column", gap: u * 0.6 }}>
                      {[["28%", "20%", "34%"], ["40%", "14%", "26%"]].map((row, r) => (
                        <div key={r} style={{ display: "flex", gap: u * 0.4, height: u * 1.8 }}>
                          {row.map((w, i) => <div key={i} style={{ width: w, background: SILVER_MID, opacity: 0.85, borderRadius: u * 0.22 }} />)}
                        </div>
                      ))}
                      {/* second strike: across the tracks */}
                      <div style={{ position: "absolute", left: u * 0.8, right: u * 0.8, top: "50%", height: u * 0.32, background: "#8a93a8", borderRadius: u * 0.16, transform: `translateY(-50%) scaleX(${x2}) rotate(1.6deg)`, transformOrigin: "left center" }} />
                    </div>
                  </div>
                </div>
              )}
              {/* the replacement: one spoken note */}
              {noteOn > 0 && (
                <div style={{ position: "absolute", left: "26%", top: "42%", transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * EASE_OVER(noteOn)})`, opacity: noteOn }}>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.45}px,${u * 0.45}px)`, opacity: 0.85 }} />
                    <div style={{ position: "relative", background: RAISIN_DEEP, border: `${u * 0.11}px solid ${LIME}`, borderRadius: u * 0.5, padding: `${u * 0.7}px ${u * 1.3}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, color: SILVER, whiteSpace: "nowrap" }}>
                      {typed}{Math.floor(t * 2.4) % 2 === 0 && typed.length < NOTE.length && <span style={{ display: "inline-block", width: u * 0.4, height: u * 1.6, background: LIME, verticalAlign: "-12%", marginLeft: u * 0.15 }} />}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEAT 6 — what they mean by "AI edits" (38.24–43.72): two deliberately tiny grey toys.
            They sweep off-left at 44.9 when the real job arrives. */}
        {t >= 38.6 && t < 45.5 && (() => {
          const on = clamp01((t - 38.9) / 0.4);
          const sweep = EASE(clamp01((t - 44.9) / 0.45));
          const sl = EASE(clamp01((t - 41.76) / 0.55));   // slider drags
          const snip = clamp01((t - 42.78) / 0.3);        // gap closes
          const aside = clamp01((t - 43.3) / 0.4);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on * (1 - sweep) }}>
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${-sweep * u * 46}px)` }}>
                {/* toy 1: a filter slider — lime so it pops (feedback v6) */}
                <div style={{ position: "absolute", left: "17%", top: "42%", transform: "translate(-50%,-50%)", opacity: 1 }}>
                  <div style={{ width: u * 9, height: u * 0.5, background: "#2a3145", borderRadius: u * 0.25, position: "relative", marginBottom: u * 0.9 }}>
                    <div style={{ position: "absolute", left: "8%", top: "50%", transform: "translateY(-50%)", height: "100%", width: `${8 + sl * 70}%`, background: LIME, borderRadius: u * 0.25, opacity: 0.85 }} />
                    <div style={{ position: "absolute", left: `${8 + sl * 70}%`, top: "50%", transform: "translate(-50%,-50%)", width: u * 1.15, height: u * 1.15, borderRadius: "50%", background: LIME, border: `${u * 0.12}px solid ${LIME}`, boxShadow: `0 0 ${u * 0.8}px ${LIME}` }} />
                  </div>
                  <div style={{ width: u * 9, height: u * 5.6, background: "#12151d", border: `${u * 0.16}px solid ${LIME}`, borderRadius: u * 0.4, overflow: "hidden", boxShadow: `0 0 ${u * 1.0}px ${LIME}55`, filter: `sepia(${sl * 0.55}) saturate(${1 + sl * 0.25})` }}>
                    <svg width={u * 9} height={u * 5.6} viewBox="0 0 90 56">
                      <circle cx={70} cy={14} r={6} fill="#4a5268" />
                      <path d="M0 56 L26 28 L44 44 L62 24 L90 50 L90 56 z" fill="#39415a" />
                    </svg>
                  </div>
                </div>
                {/* toy 2: one snip on a flat waveform — lime bars (feedback v6) */}
                <div style={{ position: "absolute", left: "36%", top: "42%", transform: "translate(-50%,-50%)", opacity: 1 }}>
                  <svg width={u * 11} height={u * 4} viewBox="0 0 110 40">
                    {Array.from({ length: 12 }).map((_, i) => { const hgt = 8 + (i % 3) * 3; return <rect key={i} x={i * 6.4} y={20 - hgt / 2} width={3.6} height={hgt} rx={1} fill={LIME} opacity={0.92} />; })}
                    <g transform={`translate(${-snip * 14} 0)`}>
                      {Array.from({ length: 5 }).map((_, i) => { const hgt = 8 + ((i + 1) % 3) * 3; return <rect key={i} x={91 + i * 6.4} y={20 - hgt / 2} width={3.6} height={hgt} rx={1} fill={LIME} opacity={0.92} />; })}
                    </g>
                    {snip < 0.5 && <line x1={84} y1={6} x2={84} y2={34} stroke={LIME} strokeWidth={2} strokeDasharray="3 2.4" opacity={clamp01((t - 42.5) / 0.2)} />}
                  </svg>
                </div>
                {/* the typographic dismissal */}
                <div style={{ position: "absolute", left: "26%", top: "58%", transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.3, color: SILVER, opacity: aside }}>that&rsquo;s it.</div>
              </div>
            </div>
          );
        })()}

        {/* BEATS 7+8 — THE WHOLE JOB mountain (43.72–62.22). Beat 7: arc of plates from the raw
            card to an UPLOAD node. Beat 8: the arc desaturates, compacts left, and looms over a
            dimming creator while a stranger's clip dies at its foot. */}
        {t >= 44.4 && t < 62.22 && (() => {
          const cmp = EASE(clamp01((t - 52.0) / 0.7));       // beat-8 compaction
          const mx = (x: number) => lerp(x, 12 + (x - 16) * 0.48, cmp);
          const my = (y: number) => lerp(y, 40 + (y - 46) * 0.55, cmp);
          /* the whole job as an ordered, ascending PIPELINE — everything a full edit needs */
          const STAGE: [string, number, number, number][] = [
            ["RESEARCH", 29, 47, 46.08], ["CUTS", 40, 41, 47.06], ["GRAPHICS", 51, 35, 47.76],
            ["SOUND", 62, 29, 48.76], ["CAPTIONS", 71, 24, 49.6], ["MUSIC", 80, 20, 49.95],
          ];
          const UPX = 89, UPY = 15;
          const nodeOn = EASE(clamp01((t - 50.88) / 0.5));
          const railP = EASE(clamp01((t - 45.6) / 5.0));     // the journey draws across the whole beat
          const stepScale = lerp(1, 0.72, cmp);
          const desat = cmp * 0.78;
          const arcF = `grayscale(${desat}) brightness(${1 - desat * 0.33})`;
          const silOn = clamp01((t - 54.54) / 0.5);
          const silDim = 1 - 0.5 * clamp01((t - 55.08) / 0.5);
          const hrs = Math.floor(12 * clamp01((t - 57.28) / 0.7));
          const eur = Math.floor(2000 * clamp01((t - 58.1) / 0.7));
          /* stranger's clip: climbs toward the summit, halts, greys, drops into the graveyard */
          const sp = EASE(clamp01((t - 60.46) / 0.95));
          const dp = EASE(clamp01((t - 61.42) / 0.55));
          const scx = lerp(lerp(30, 44, sp), 46, dp), scy = lerp(lerp(60, 44, sp), 72, dp);
          const out = 1 - clamp01((t - 61.95) / 0.3);
          const RAILPTS: number[][] = [[22, 50], ...STAGE.map((s) => [s[1], s[2]]), [UPX, UPY]];
          return (
            <div style={{ position: "absolute", inset: 0, opacity: out }}>
              <H1 u={u} t={t} in0={53.46} out={61.8} bottom>QUIETLY <Marker u={u} t={t} at={55.08}>KILLS</Marker> CREATORS</H1>
              {/* the ascending rail: card → stages → upload summit */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <defs><clipPath id="ls7rail"><rect x={0} y={0} width={W * railP} height={H} /></clipPath></defs>
                <polyline clipPath="url(#ls7rail)" points={RAILPTS.map(([x, y]) => `${mx(x) / 100 * W},${my(y) / 100 * H}`).join(" ")} fill="none" stroke={SILVER_MID} strokeWidth={u * 0.14} strokeDasharray={`${u * 0.9} ${u * 0.7}`} opacity={0.5 * (1 - desat * 0.5)} />
                {/* UPLOAD summit: circle + up arrow */}
                {nodeOn > 0 && (
                  <g transform={`translate(${mx(UPX) / 100 * W} ${my(UPY) / 100 * H}) scale(${stepScale})`} opacity={nodeOn} filter={cmp > 0 ? `grayscale(${desat})` : undefined}>
                    <circle r={u * 2.3} fill="#12151d" stroke={SILVER} strokeWidth={u * 0.16} strokeDasharray={u * 15} strokeDashoffset={u * 15 * (1 - nodeOn)} />
                    <path d={`M0 ${u * 0.95} L0 ${-u * 0.95} M${-u * 0.72} ${-u * 0.12} L0 ${-u} L${u * 0.72} ${-u * 0.12}`} stroke={SILVER} strokeWidth={u * 0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={nodeOn} />
                  </g>
                )}
              </svg>
              {nodeOn > 0 && <div style={{ position: "absolute", left: `${mx(UPX)}%`, top: `${my(UPY) + 5.6 * stepScale}%`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95 * lerp(1, 0.8, cmp), letterSpacing: "0.14em", color: SILVER_MID, opacity: nodeOn * (1 - desat * 0.4) }}>UPLOAD</div>}
              {/* the ordered stage steps */}
              <div style={{ position: "absolute", inset: 0, filter: arcF }}>
                {STAGE.map(([lab, x, y, at], i) => <Step key={lab} u={u} x={mx(x)} y={my(y)} n={i + 1} label={lab} at={at} t={t} scale={stepScale} />)}
              </div>
              {/* beat 8: the creator crushed under the pipeline — larger + central so 'creators' lands */}
              {silOn > 0 && (
                <div style={{ position: "absolute", left: "26%", top: "70%", transform: "translate(-50%,-50%) scale(1.55)", opacity: silOn * silDim }}>
                  <svg width={u * 11} height={u * 8.5} viewBox="0 0 55 42">
                    <circle cx={19} cy={9} r={5.2} fill={SILVER_SOFT} />
                    <path d="M10 26 q1.5 -10 9 -10 q7.5 0 9 10 z" fill={SILVER_SOFT} />
                    <rect x={5} y={26} width={45} height={2.4} rx={1.2} fill={SILVER_SOFT} />
                    <path d="M33 26 l7.5 -6 l1.8 1.6 l-7.5 6 z" fill={SILVER_SOFT} />
                    <rect x={8} y={28.4} width={3.4} height={12} fill={SILVER_SOFT} opacity={0.6} />
                    <rect x={43} y={28.4} width={3.4} height={12} fill={SILVER_SOFT} opacity={0.6} />
                  </svg>
                </div>
              )}
              {/* the cost counters — to the right of the creator */}
              {t >= 57.28 && <div style={{ position: "absolute", left: "44%", top: "62%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 800, fontSize: u * 1.7, color: SILVER_MID, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{hrs} HRS</div>}
              {t >= 58.1 && <div style={{ position: "absolute", left: "44%", top: "69%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 800, fontSize: u * 1.7, color: SILVER_MID, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>${eur.toLocaleString("en-US")}</div>}
              {/* the graveyard of unposted footage */}
              {t >= 60.4 && (() => {
                const gOn = clamp01((t - 60.5) / 0.5);
                const grey = clamp01((t - 61.42) / 0.4);
                const deadStyle = (rot: number): React.CSSProperties => ({ background: "#1a1f2b", border: `${u * 0.09}px solid #3a4256`, borderRadius: u * 0.35, padding: `${u * 0.32}px ${u * 0.8}px`, fontFamily: MONO, fontWeight: 600, fontSize: u * 0.9, color: "#5a6478", whiteSpace: "nowrap", transform: `rotate(${rot}deg)` });
                return (
                  <>
                    <div style={{ position: "absolute", left: "49%", top: "73.5%", transform: "translate(-50%,-50%)", opacity: gOn * 0.6 }}><div style={deadStyle(-7)}>vlog_04.mp4</div></div>
                    <div style={{ position: "absolute", left: "54%", top: "75.5%", transform: "translate(-50%,-50%)", opacity: gOn * 0.6 }}><div style={deadStyle(5)}>launch.mov</div></div>
                    {/* the dying clip */}
                    <div style={{ position: "absolute", left: `${scx}%`, top: `${scy}%`, transform: `translate(-50%,-50%) rotate(${dp * -9}deg)`, opacity: clamp01((t - 60.46) / 0.3), filter: `grayscale(${grey}) brightness(${1 - grey * 0.3})` }}>
                      <div style={{ background: "#232938", border: `${u * 0.1}px solid #4a5268`, borderRadius: u * 0.4, padding: `${u * 0.42}px ${u * 1.0}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: SILVER_MID, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.5}px ${u * 1.4}px rgba(0,0,0,0.5)` }}>my_video.mp4</div>
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })()}

        {/* BEATS 10–12 (65.04–87.4, LIGHT register): the six-tile MAP grid, its selection box and the
            LOOP STUDIO x/6 chip were removed per review ("remove that whole grid from every scene").
            Only the bottom-middle headlines remain, captioning the VO over the light worksheet. */}
        {t >= 65.2 && t < 87.7 && (() => {
          const on = clamp01((t - 65.5) / 0.5) * (1 - clamp01((t - 87.18) / 0.4));
          const SIX = [{ n: 1, l: "PLANNING", ic: "plan" }, { n: 2, l: "CONTRAST", ic: "contrast" }, { n: 3, l: "CUTS", ic: "cuts" }, { n: 4, l: "MUSIC", ic: "music" }, { n: 5, l: "MOTION", ic: "motion" }, { n: 6, l: "SOUND", ic: "sound" }];
          const cols = 3, tw = u * 13.8, th = u * 10.2, gx = u * 1.3, gy = u * 1.3;
          const gridW = cols * tw + (cols - 1) * gx, gridH = 2 * th + gy;
          const cx = W * 0.32, cy = H * 0.44;
          const ico = (k: string, on2: boolean) => {
            const st = on2 ? RAISIN : "#3a4152", sw = 2.1;
            const p = { fill: "none" as const, stroke: st, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
            if (k === "plan") return <svg width={u * 4.6} height={u * 3.4} viewBox="0 0 46 34">{[6, 18, 30].map((y, i) => <g key={i}><rect x={2} y={y - 5} width={8} height={8} rx={1.6} {...p} />{i < 2 && <path d={`M4 ${y - 1} L6 ${y + 1} L9 ${y - 3}`} {...p} />}<line x1={15} y1={y - 1} x2={44} y2={y - 1} {...p} /></g>)}</svg>;
            if (k === "contrast") return <svg width={u * 3.6} height={u * 3.6} viewBox="0 0 36 36"><rect x={3} y={3} width={30} height={30} rx={4} {...p} /><path d="M33 3 L33 33 L3 33 Z" fill={st} /></svg>;
            if (k === "cuts") return <svg width={u * 5} height={u * 3.4} viewBox="0 0 50 34"><rect x={2} y={5} width={18} height={24} rx={2.5} {...p} /><rect x={30} y={5} width={18} height={24} rx={2.5} {...p} /><line x1={25} y1={1} x2={25} y2={33} stroke={LIME} strokeWidth={2.4} strokeDasharray="3 2.6" /></svg>;
            if (k === "music") return <svg width={u * 4.2} height={u * 3.6} viewBox="0 0 42 36">{[8, 18, 28].map((x, i) => { const h = [22, 32, 16][i]; return <rect key={i} x={x} y={34 - h} width={7} height={h} rx={2} fill={st} />; })}</svg>;
            if (k === "motion") return <svg width={u * 4.6} height={u * 3.2} viewBox="0 0 46 32"><path d="M22 4 L8 16 L22 28 M8 16 H42" {...p} /><line x1={2} y1={9} x2={9} y2={9} {...p} opacity={0.5} /><line x1={2} y1={23} x2={9} y2={23} {...p} opacity={0.5} /></svg>;
            return <svg width={u * 5} height={u * 3.4} viewBox="0 0 50 34"><path d="M2 17 Q7 17 9 17 T14 5 T20 29 T26 9 T32 25 T38 13 T44 19 Q47 17 48 17" {...p} /></svg>;
          };
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {/* the SIX THINGS, restored with their concept icons (feedback v7) — the craft the machine learned */}
              <div style={{ position: "absolute", left: cx - gridW / 2, top: cy - gridH / 2, width: gridW, height: gridH }}>
                {SIX.map((s, i) => {
                  const col = i % cols, row = Math.floor(i / cols);
                  const app = clamp01((t - (66.5 + i * 0.12)) / 0.4);
                  const chk = clamp01((t - (78.9 + i * 0.42)) / 0.35);
                  if (app <= 0) return null;
                  return (
                    <div key={i} style={{ position: "absolute", left: col * (tw + gx), top: row * (th + gy), width: tw, height: th, transform: `scale(${lerp(0.85, 1, app)})`, opacity: app }}>
                      <div style={{ position: "relative", width: "100%", height: "100%", background: "#fff", borderRadius: u * 0.7, border: `${u * 0.14}px solid ${chk > 0.5 ? LIME : "#d7dbe0"}`, boxShadow: `0 ${u * 0.6}px ${u * 1.8}px rgba(20,18,26,0.14)`, display: "flex", flexDirection: "column", padding: `${u * 0.8}px ${u * 0.9}px` }}>
                        {/* number + checkmark row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u * 1.8, height: u * 1.8, borderRadius: "50%", background: RAISIN, fontFamily: MONO, fontWeight: 800, fontSize: u * 0.95, color: LIME }}>{s.n}</span>
                          <div style={{ width: u * 1.9, height: u * 1.9, borderRadius: "50%", background: chk > 0.05 ? LIME : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${chk})` }}>
                            <svg width={u * 1.15} height={u * 1.15} viewBox="0 0 24 24" fill="none" stroke={RAISIN} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          </div>
                        </div>
                        {/* concept icon */}
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{ico(s.ic, chk > 0.5)}</div>
                        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.45, letterSpacing: "0.02em", color: RAISIN, textTransform: "uppercase" }}>{s.l}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <H1 u={u} t={t} in0={66.2} out={73.8} bottom color={RAISIN}>ONLY <Marker u={u} t={t} at={66.32} base={RAISIN}>SIX</Marker> THINGS</H1>
              <H1 u={u} t={t} in0={78.7} out={81.9} bottom color={RAISIN}><Marker u={u} t={t} at={78.88} base={RAISIN}>TAUGHT</Marker> IT ALL SIX</H1>
              <H1 u={u} t={t} in0={84.5} out={87.1} bottom color={RAISIN}>MADE BY THE <Marker u={u} t={t} at={84.8} base={RAISIN}>MACHINE</Marker></H1>
            </div>
          );
        })()}

        {/* BEATS 13+14 — the five identical takes (87.18–98.3): the raw card unrolls its waveform,
            the playhead crawls, tallies stamp, then four lime blades strike and the LAST take survives. */}
        {t >= 87.18 && t < 98.45 && (() => {
          const on = clamp01((t - 87.4) / 0.4) * (1 - clamp01((t - 98.05) / 0.35));
          const cardIn = EASE_OVER(clamp01((t - 88.84) / 0.5));
          const unroll = EASE(clamp01((t - 89.42) / 1.15));
          const HX = [21.5, 26.9, 32.3, 37.7, 43.1];       // hump centers (%)
          const GX = [24.2, 29.6, 35.0, 40.4];             // silence gaps (%)
          const BAR_OFF = [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8];
          const BAR_H = [0.28, 0.52, 0.82, 1, 0.84, 0.54, 0.3];
          const phX = t < 94.72 ? interpolate(t, [90.78, 94.72], [20.2, 30.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 30.2;
          const phOn = clamp01((t - 90.78) / 0.25) * (1 - clamp01((t - 94.72) / 0.45));
          const counterOn = EASE_OVER(clamp01((t - 92.98) / 0.3)) * (1 - clamp01((t - 97.3) / 0.3));
          const closeP = EASE(clamp01((t - 97.55) / 0.55));
          const lastX = lerp(HX[4], 26.5, closeP);
          const stripEnd = lerp(47.5, 30.5, closeP);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <H1 u={u} t={t} in0={96.25} out={98.0} bottom>THE SYSTEM <Marker u={u} t={t} at={96.68}>CUTS</Marker></H1>
              {/* the raw card, docked */}
              <div style={{ position: "absolute", left: `${lerp(-12, 13, cardIn)}%`, top: "42%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 88.84) / 0.3) }}>
                <DirtyCard u={u} sc={0.8} />
              </div>
              {/* the unrolled waveform */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                <defs><clipPath id="ls13roll"><rect x={W * 0.18} y={0} width={W * (stripEnd - 18) / 100 * unroll} height={H} /></clipPath></defs>
                <g clipPath="url(#ls13roll)">
                  <line x1={W * 0.18} y1={H * 0.42} x2={W * stripEnd / 100} y2={H * 0.42} stroke="#3a4256" strokeWidth={u * 0.12} />
                  {HX.map((hx, i) => {
                    const isLast = i === 4;
                    const dp = isLast ? 0 : EASE(clamp01((t - 97.3 - i * 0.05) / 0.45));
                    const cx = isLast ? lastX : hx;
                    const tal = clamp01((t - 92.28 - i * 0.13) / 0.2);
                    if (dp >= 1) return null;
                    return (
                      <g key={i} transform={`translate(0 ${dp * H * 0.11})`} opacity={1 - dp}>
                        {BAR_OFF.map((off, b) => (
                          <rect key={b} x={W * (cx + off) / 100 - u * 0.32} y={H * 0.42 - BAR_H[b] * u * 2.5} width={u * 0.64} height={BAR_H[b] * u * 5} rx={u * 0.15} fill={SILVER_MID} opacity={tal > 0 && tal < 1 ? 1 : 0.85} />
                        ))}
                        {/* tally stroke */}
                        {tal > 0 && <line x1={W * (cx - 1.1) / 100} y1={H * 0.42 + u * 1.6} x2={W * (cx - 1.1 + 2.2 * tal) / 100} y2={H * 0.42 - u * 2.4 * tal + u * 1.6 - u * 1.6 * tal} stroke="#8a93a8" strokeWidth={u * 0.3} strokeLinecap="round" />}
                      </g>
                    );
                  })}
                  {/* silver playhead — never red */}
                  {phOn > 0 && <line x1={W * phX / 100} y1={H * 0.42 - u * 3.6 * phOn} x2={W * phX / 100} y2={H * 0.42 + u * 3.6 * phOn} stroke={SILVER} strokeWidth={u * 0.18} opacity={phOn} />}
                  {/* four lime blades into the four gaps (beat 14) */}
                  {GX.map((gx, i) => {
                    const cp = EASE(clamp01((t - 96.68 - i * 0.06) / 0.22));
                    const fade = 1 - clamp01((t - 97.55) / 0.35);
                    if (cp <= 0) return null;
                    return <line key={`c${i}`} x1={W * gx / 100} y1={H * 0.42 - u * 3.4 * cp} x2={W * gx / 100} y2={H * 0.42 - u * 3.4 * cp + u * 6.8 * cp} stroke={LIME} strokeWidth={u * 0.24} opacity={cp * fade} style={{ filter: `drop-shadow(0 0 ${u * 0.5}px ${LIME}aa)` }} />;
                  })}
                </g>
              </svg>
              {/* the horror, counted */}
              {counterOn > 0 && (
                <div style={{ position: "absolute", left: "32.5%", top: "53%", transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * counterOn})`, opacity: counterOn }}>
                  <div style={{ background: "#1a1f2b", border: `${u * 0.1}px solid #3a4256`, borderRadius: u * 0.4, padding: `${u * 0.45}px ${u * 1.1}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.08em", color: SILVER_MID, whiteSpace: "nowrap" }}>SAME LINE ×5</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* BEATS 15+16 — inside the mechanism (97.94–108.43): the surviving wave at hero scale,
            word chips snap on, silences light lime, a rogue blade is refused, the wave is scanned,
            then everything re-rolls into the card — CUT ✓ — and the clip steps toward Act 2. */}
        {t >= 97.94 && (() => {
          const on = clamp01((t - 98.1) / 0.4);
          const wp = kfp(t, [[98.1, 50, 46, 0.55], [98.9, 50, 46, 1], [103.94, 50, 46, 1.06], [104.65, 30, 44, 0.62], [108.0, 30, 44, 0.62], [108.32, 13, 46, 0.12]]);
          const wOut = 1 - clamp01((t - 108.05) / 0.3);
          const WW = u * 56, HH = u * 18;
          const CHIPS = ["be", "honest,", "you", "clicked"];
          const BAR_OFF = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4];
          const BAR_H = [0.3, 0.55, 0.85, 1, 0.86, 0.56, 0.32];
          /* the wave is FOUR separate word-segments; cutting the silences slides them into ONE
             continuous wave (jp); a legal cut later SPLITS it open at a word boundary (splitP). */
          const jp = EASE(clamp01((t - 103.0) / 0.95));
          const SPREAD = [0.13, 0.37, 0.61, 0.85];
          const JOINED = [0.37, 0.457, 0.545, 0.632];
          const SPLIT_AT = 1;
          const splitP = EASE_OVER(clamp01((t - 106.04) / 0.5));
          const splitGap = u * 4.0;
          const hc = SPREAD.map((s, i) => lerp(s, JOINED[i], jp) * WW + (i > SPLIT_AT ? splitGap * splitP : 0));
          const valOn = clamp01((t - 102.5) / 0.35);
          /* rogue blade (beat 16): drifts to the MIDDLE of a word, is refused, snaps to the boundary it splits */
          const rIn = clamp01((t - 104.6) / 0.3);
          const rDrift = EASE(clamp01((t - 104.6) / 1.35));
          const rRef = EASE_OVER(clamp01((t - 106.04) / 0.3));
          const midWord = JOINED[SPLIT_AT] * WW;
          const rX = lerp(lerp(midWord + u * 5, midWord, rDrift), (hc[SPLIT_AT] + hc[SPLIT_AT + 1]) / 2, rRef);
          const rY = lerp(-HH * 0.35, 0, rDrift);
          const rLime = clamp01((t - 106.25) / 0.15);
          /* scanning bracket sweeps the joined wave */
          const scanP = EASE(clamp01((t - 107.08) / 0.85));
          const scanX = lerp(hc[0] - u * 4, hc[3] + u * 4, scanP);
          const scanOn = clamp01((t - 107.08) / 0.15) * (1 - clamp01((t - 107.98) / 0.2));
          /* the card: parked at the edge in beat 15, target of the re-roll in beat 16 */
          const ck = kfp(t, [[98.2, 10, 80, 0.5], [104.0, 10, 80, 0.5], [104.7, 12, 45, 0.78], [108.25, 12, 45, 0.78], [108.43, 16.5, 45, 0.78]]);
          const cardO = t < 104.0 ? 0.45 : clamp01(0.45 + (t - 104.0) / 0.5);
          const cut = t >= 108.0;
          const stampP = EASE_OVER(clamp01((t - 108.0) / 0.25));
          const railStep = EASE(clamp01((t - 108.1) / 0.3));
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              <H1 u={u} t={t} in0={102.15} out={104.25} bottom>CUTS IN THE <Marker u={u} t={t} at={102.5}>SILENCES</Marker></H1>
              <H1 u={u} t={t} in0={105.6} bottom><Marker u={u} t={t} at={106.04}>NEVER</Marker> MID-WORD</H1>
              {/* the step-right rail toward Act 2 */}
              {railStep > 0 && (
                <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                  <line x1={W * 0.19} y1={H * 0.45} x2={W * (0.19 + 0.14 * railStep)} y2={H * 0.45} stroke={SILVER_MID} strokeWidth={u * 0.16} strokeDasharray={`${u * 0.9} ${u * 0.7}`} opacity={0.8} />
                </svg>
              )}
              {/* the raw card */}
              <div style={{ position: "absolute", left: `${ck.x}%`, top: `${ck.y}%`, transform: "translate(-50%,-50%)", opacity: cardO }}>
                <div style={{ position: "relative" }}>
                  <DirtyCard u={u} sc={ck.s} cut={cut} rot={cut ? -0.5 : -2} />
                  {stampP > 0 && (
                    <div style={{ position: "absolute", right: -u * 0.9, top: -u * 0.9, transform: `scale(${stampP}) rotate(6deg)` }}>
                      <div style={{ background: LIME, borderRadius: u * 0.35, padding: `${u * 0.3}px ${u * 0.7}px`, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.05, color: RAISIN, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.4}px ${u * 1.2}px rgba(0,0,0,0.5)` }}>CUT ✓</div>
                    </div>
                  )}
                </div>
              </div>
              {/* the wave, hero → left → re-rolled */}
              <div style={{ position: "absolute", left: `${wp.x}%`, top: `${wp.y}%`, transform: `translate(-50%,-50%) scale(${wp.s})`, width: WW, height: HH, opacity: wOut }}>
                {/* silence gaps between the word-segments — lit as the only legal cut zones, removed as the wave joins */}
                {[0, 1, 2].map((i) => {
                  const a = hc[i], b = hc[i + 1];
                  const vw = (b - a) - u * 4.8;
                  const vShow = valOn * (1 - jp);
                  if (vShow <= 0.001 || vw <= u * 0.4) return null;
                  return <div key={`v${i}`} style={{ position: "absolute", left: (a + b) / 2 - vw / 2 - u * 0.5, top: HH * 0.16, width: vw + u, height: HH * 0.8, background: `${LIME}26`, border: `${u * 0.08}px solid ${LIME}55`, borderRadius: u * 0.5, opacity: vShow }} />;
                })}
                <svg width={WW} height={HH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                  <line x1={hc[0] - u * 3.2} y1={HH * 0.62} x2={hc[3] + u * 3.2} y2={HH * 0.62} stroke="#3a4256" strokeWidth={u * 0.12} />
                  {hc.map((cx, i) => (
                    <g key={i}>
                      {BAR_OFF.map((off, b) => {
                        const glow = scanOn > 0 ? Math.max(0, 1 - Math.abs(cx + off * u - scanX) / (u * 7)) : 0;
                        return <rect key={b} x={cx + off * u - u * 0.36} y={HH * 0.62 - BAR_H[b] * u * 3.4} width={u * 0.72} height={BAR_H[b] * u * 6.8} rx={u * 0.16} fill={glow > 0.4 ? SILVER : SILVER_MID} opacity={0.85 + glow * 0.15} />;
                      })}
                    </g>
                  ))}
                  {/* dashed cut-markers snap into the silence gaps as they close */}
                  {[0, 1, 2].map((i) => {
                    const vx = (hc[i] + hc[i + 1]) / 2;
                    const mOn = clamp01((t - 103.0 - i * 0.06) / 0.22) * (1 - clamp01((jp - 0.55) / 0.45));
                    if (mOn <= 0) return null;
                    return <line key={`m${i}`} x1={vx} y1={HH * 0.2} x2={vx} y2={HH * (0.2 + 0.72 * mOn)} stroke={LIME} strokeWidth={u * 0.2} strokeDasharray={`${u * 0.55} ${u * 0.45}`} opacity={mOn} />;
                  })}
                  {/* the legal SPLIT: the joined wave parts cleanly at a word boundary (beat 16) */}
                  {splitP > 0.001 && (
                    <line x1={(hc[SPLIT_AT] + hc[SPLIT_AT + 1]) / 2} y1={HH * 0.12} x2={(hc[SPLIT_AT] + hc[SPLIT_AT + 1]) / 2} y2={HH * 0.92} stroke={LIME} strokeWidth={u * 0.16} opacity={splitP * 0.55} />
                  )}
                  {/* the rogue blade: aims mid-word (grey, refused), snaps to the boundary it splits (lime, legal) */}
                  {rIn > 0 && (
                    <line x1={rX} y1={rY + HH * 0.16} x2={rX} y2={rY + HH * 0.94} stroke={rLime > 0.5 ? LIME : SILVER_MID} strokeWidth={u * 0.2} strokeDasharray={`${u * 0.55} ${u * 0.45}`} opacity={rIn} style={rLime > 0.5 ? { filter: `drop-shadow(0 0 ${u * 0.5}px ${LIME}aa)` } : undefined} />
                  )}
                  {/* scanning bracket — the machine reading */}
                  {scanOn > 0 && (
                    <g opacity={scanOn}>
                      <line x1={scanX - u * 1.6} y1={HH * 0.1} x2={scanX - u * 1.6} y2={HH * 0.95} stroke={SILVER} strokeWidth={u * 0.14} />
                      <line x1={scanX + u * 1.6} y1={HH * 0.1} x2={scanX + u * 1.6} y2={HH * 0.95} stroke={SILVER} strokeWidth={u * 0.14} />
                      <line x1={scanX - u * 1.6} y1={HH * 0.1} x2={scanX - u * 0.7} y2={HH * 0.1} stroke={SILVER} strokeWidth={u * 0.14} />
                      <line x1={scanX + u * 0.7} y1={HH * 0.95} x2={scanX + u * 1.6} y2={HH * 0.95} stroke={SILVER} strokeWidth={u * 0.14} />
                    </g>
                  )}
                </svg>
                {/* word chips — THIS video's own opening line; they ride together, then fade as the wave joins */}
                {CHIPS.map((c, i) => {
                  const at = 98.4 + i * 0.38;
                  const cp = EASE_OVER(clamp01((t - at) / 0.35));
                  const fade = 1 - clamp01((t - 102.8) / 0.9);
                  if (cp <= 0 || fade <= 0) return null;
                  return (
                    <div key={c} style={{ position: "absolute", left: hc[i], top: lerp(-u * 3, HH * 0.02, cp), transform: "translate(-50%,0)", opacity: Math.min(1, cp * 1.5) * fade }}>
                      <div style={{ background: RAISIN_DEEP, border: `${u * 0.09}px solid #3f4760`, borderRadius: u * 0.35, padding: `${u * 0.28}px ${u * 0.75}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, color: SILVER, whiteSpace: "nowrap" }}>{c}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ============ SCRIM (full-footage readability) ============ */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.5) 0%, transparent 26%, transparent 60%, rgba(8,10,14,0.7) 100%)`, opacity: full, pointerEvents: "none" }} />

      {/* ============ FOOTAGE ============ */}
      {(() => {
        const push = 1 + 0.045 * EASE(clamp01((t - 37.52) / 0.7)) * (1 - clamp01((t - 38.24) / 0.5));
        const lift = 1 + 0.13 * clamp01((t - 64.48) / 0.5) * (1 - clamp01((t - 65.5) / 0.6));
        return (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 42%", filter: lift > 1.001 ? `brightness(${lift})` : "none" }}>
            <FootageLayer sk={sk} u={u} src="footage/ls_th1.mp4" />
          </div>
        );
      })()}

      {/* ============ OVERLAYS ON FOOTAGE ============ */}
      {/* BEAT 1 — the naked dare (0–10.74, FULL): 3.7s of nothing, then the viewport becomes a
          capture region — four corner brackets + 'this_video.mp4' — which condenses into one
          dashed wireframe clip-card that settles bottom-center. */}
      {t >= 3.7 && t < 13.95 && (() => {
        const br = EASE(clamp01((t - 3.76) / 0.5));
        const tagOn = clamp01((t - 4.78) / 0.35);
        const cnd = EASE(clamp01((t - 7.22) / 0.8));
        const settle = EASE_OVER(clamp01((t - 10.06) / 0.45));
        const out = 1 - clamp01((t - 13.62) / 0.28);
        const cardW = u * 15, cardH = u * 8.2;
        const ccx = W * 0.5, ccy = H * (lerp(83.5, 86, settle) / 100);
        /* bracket geometry: viewport corners → card corners */
        const CORN = [
          { x0: W * 0.035, y0: H * 0.06, ex: ccx - cardW / 2, ey: ccy - cardH / 2, bx: "borderLeft", by: "borderTop", ox: 0, oy: 0 },
          { x0: W * 0.965, y0: H * 0.06, ex: ccx + cardW / 2, ey: ccy - cardH / 2, bx: "borderRight", by: "borderTop", ox: -1, oy: 0 },
          { x0: W * 0.035, y0: H * 0.94, ex: ccx - cardW / 2, ey: ccy + cardH / 2, bx: "borderLeft", by: "borderBottom", ox: 0, oy: -1 },
          { x0: W * 0.965, y0: H * 0.94, ex: ccx + cardW / 2, ey: ccy + cardH / 2, bx: "borderRight", by: "borderBottom", ox: -1, oy: -1 },
        ];
        const bSize = lerp(u * 5.2, u * 2.0, cnd);
        const brO = br * (1 - clamp01((cnd - 0.82) / 0.18));
        const cardO = clamp01((cnd - 0.72) / 0.28) * out;
        const tagY = lerp(H * 0.905, ccy + cardH / 2 + u * 1.1, cnd);
        return (
          <>
            {brO > 0 && CORN.map((c, i) => {
              const x = lerp(c.x0, c.ex, cnd), y = lerp(c.y0, c.ey, cnd);
              const slide = (1 - br) * u * 1.6 * (c.ox === 0 ? -1 : 1);
              return <div key={i} style={{ position: "absolute", left: x + slide + c.ox * bSize, top: y + c.oy * bSize, width: bSize, height: bSize, [c.bx]: `${u * 0.3}px solid ${SILVER}`, [c.by]: `${u * 0.3}px solid ${SILVER}`, opacity: brO * out, filter: `drop-shadow(0 ${u * 0.15}px ${u * 0.6}px rgba(0,0,0,0.6))` } as React.CSSProperties} />;
            })}
            {/* the file tag → card footer */}
            {tagOn > 0 && cardO < 0.6 && (
              <div style={{ position: "absolute", left: "50%", top: tagY, transform: "translate(-50%,-50%)", opacity: tagOn * (1 - clamp01((cnd - 0.6) / 0.3)) * out }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, letterSpacing: "0.05em", color: SILVER, textShadow: `0 ${u * 0.15}px ${u * 0.9}px rgba(0,0,0,0.8)` }}>this_video.mp4</span>
              </div>
            )}
            {/* the dashed clip-card — it does not exist yet */}
            {cardO > 0 && (
              <div style={{ position: "absolute", left: ccx, top: ccy, transform: `translate(-50%,-50%) translateY(${(1 - settle) * -u * 0.6}px)`, opacity: cardO }}>
                <CleanCard u={u} dashed />
              </div>
            )}
          </>
        );
      })()}

      {/* BEATS 4+5 — the money confession (22.52–38.24, FULL): $2,000 crumbles to $0 + the real
          Claude chip, then the whole hook is docked, demoted to 40%, and wiped down on 'dive in'. */}
      {t >= 23.2 && t < 38.55 && (() => {
        const stamp1 = EASE_OVER(clamp01((t - 23.76) / 0.3));
        const crumbOn = t >= 25.72;
        const greyOut = 1 - clamp01((t - 26.35) / 0.25);
        const zero = EASE_OVER(clamp01((t - 26.15) / 0.3));
        const chip = EASE_OVER(clamp01((t - 27.1) / 0.4));
        const dock = EASE(clamp01((t - 28.4) / 0.55));
        const tagOn = clamp01((t - 28.94) / 0.35);
        const dim = 1 - 0.6 * clamp01((t - 33.14) / 0.5);
        const pulse = t > 36.14 && t < 36.72 ? Math.sin((t - 36.14) / 0.58 * Math.PI) * 0.07 : 0;
        const exitP = EASE(clamp01((t - 37.52) / 0.55));
        const gx = lerp(21, 15, dock), gy = lerp(76, 87.5, dock), gs = lerp(1, 0.72, dock);
        const DIGITS = "2,000".split("");
        return (
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${exitP * H * 0.3}px)`, opacity: 1 - exitP }}>
            <H1 u={u} t={t} in0={31.55} top="13%" size={3.1}>THE <Marker u={u} t={t} at={31.8}>LEAST</Marker> INTERESTING PART</H1>
            <div style={{ position: "absolute", left: `${gx}%`, top: `${gy}%`, transform: `translate(-50%,-50%) scale(${gs * (1 + pulse)})`, opacity: dim, display: "flex", alignItems: "center", gap: u * 1.0 }}>
              {/* plate slot: grey invoice → lime $0 */}
              <div style={{ position: "relative", width: lerp(u * 20.5, u * 7.6, zero), height: u * 3.6, transition: "none" }}>
                {stamp1 > 0 && greyOut > 0 && (
                  <div style={{ position: "absolute", left: 0, top: "50%", transform: `translateY(-50%) scale(${1.35 - 0.35 * stamp1})`, transformOrigin: "left center", opacity: stamp1 * greyOut }}>
                    <div style={{ background: "#1a1f2b", border: `${u * 0.11}px solid #3a4256`, borderRadius: u * 0.45, padding: `${u * 0.55}px ${u * 1.2}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.55, letterSpacing: "0.04em", color: SILVER_MID, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.6}px ${u * 1.6}px rgba(0,0,0,0.55)` }}>
                      EDITOR · $
                      {DIGITS.map((d, i) => {
                        const cp = crumbOn ? clamp01((t - 25.72 - i * 0.05) / 0.42) : 0;
                        return <span key={i} style={{ display: "inline-block", transform: `translateY(${cp * cp * u * 6.5}px) rotate(${cp * (i % 2 ? 30 : -24)}deg)`, opacity: 1 - cp }}>{d}</span>;
                      })}
                      /MO
                    </div>
                  </div>
                )}
                {zero > 0 && (
                  <div style={{ position: "absolute", left: 0, top: "50%", transform: `translateY(-50%) scale(${1.4 - 0.4 * zero})`, transformOrigin: "left center", opacity: zero }}>
                    <div style={{ background: LIME, borderRadius: u * 0.45, padding: `${u * 0.55}px ${u * 1.4}px`, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.7, color: RAISIN, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.6}px ${u * 1.6}px rgba(0,0,0,0.5)` }}>$0</div>
                  </div>
                )}
              </div>
              {/* the real Claude chip — the product is being named */}
              {chip > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: u * 0.7, background: "rgba(18,21,29,0.94)", border: `${u * 0.1}px solid #2a3145`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.1}px`, opacity: Math.min(1, chip * 1.4), transform: `translateY(${(1 - chip) * u * 1.4}px)`, boxShadow: `0 ${u * 0.6}px ${u * 1.6}px rgba(0,0,0,0.55)` }}>
                  <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.9, height: u * 1.9, flexShrink: 0 }} />
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 1.35, color: SILVER, whiteSpace: "nowrap" }}>Claude subscription</span>
                </div>
              )}
              {/* the forward promise */}
              {tagOn > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: u * 0.5, opacity: tagOn }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.1em", color: SILVER, border: `${u * 0.09}px dashed ${SILVER_MID}`, borderRadius: u * 0.4, padding: `${u * 0.35}px ${u * 0.8}px`, background: "rgba(13,16,23,0.6)", whiteSpace: "nowrap" }}>-&gt; END</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default LSAct1;
