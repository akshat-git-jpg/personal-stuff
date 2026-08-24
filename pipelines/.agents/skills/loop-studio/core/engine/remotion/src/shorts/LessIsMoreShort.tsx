/**
 * LessIsMoreShort — bespoke 9:16 short (1134f @ 30fps, 1080x1920).
 *
 * Concept: ONE checkout card that mutates. A single white checkout card lives
 * in the lower half for the whole runtime and the entire story happens TO it:
 *  1. Hook (0–5s)      — hairline outline traces the card on, fields settle in. Pristine.
 *  2. Bloat (8.3–15s)  — payment glyphs click on, tier columns squeeze in, geo row
 *                        appears. Card grows; camera tightens a notch per addition.
 *  3. Break (18.2–26s) — fields misalign by a few px, a tier column overlaps,
 *                        desaturation, thin red `payment failed` toast. Elegant, no explosion.
 *  4. Exhale (26.1–29s)— everything added slides back out in reverse; card contracts
 *                        to the pristine hook state; camera eases back.
 *  5. Spark (32.2s)    — tiny 5-point lime sparkline ticks up beside the price,
 *                        lime underline under €49. The single lime moment.
 *  6. Closer (36s)     — Playfair italic "less is more." settles below the card.
 *                        Footage dims, everything fades in the last 10 frames.
 *
 * Every event is anchored to word starts in shorts/less-is-more/words.json.
 * IP-clean: abstract card/bank/wallet/contactless line glyphs only, no brands.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, staticFile, Easing, continueRender, delayRender,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const INK = "#1C212B";
const GRAY = "#6A7280";
const HAIR = "#E4E7EC";
const RED = "#C5303A";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

/* ---------- fonts (self-contained; pattern from motion/kit.tsx) ---------- */
const fontHandle = delayRender("fonts");
{
  let done = false;
  const finish = () => { if (!done) { done = true; continueRender(fontHandle); } };
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&family=Playfair+Display:ital,wght@1,500;1,600&display=block";
    document.head.appendChild(link);
    const fo: any = (document as any).fonts;
    (fo && fo.ready ? fo.ready : Promise.resolve()).then(finish).catch(finish);
    setTimeout(finish, 4000);
  } else finish();
}

/* ---------- helpers ---------- */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const OUT = Easing.out(Easing.cubic);
const ramp = (frame: number, at: number, len = 10, ease = OUT) =>
  frame <= at ? 0 : ease(clamp01((frame - at) / len));
/** section presence: eases in at `inAt`, eases out at `outAt` */
const sec = (frame: number, inAt: number, outAt: number | null, inLen = 12, outLen = 12) =>
  ramp(frame, inAt, inLen) * (outAt == null ? 1 : 1 - ramp(frame, outAt, outLen));
const jolt = (frame: number, hit: number, amp = 2.5, dur = 5) => {
  const t = frame - hit;
  if (t < 0 || t > dur) return { jx: 0, jy: 0 };
  const d = 1 - t / dur;
  return { jx: Math.sin(t * 2.9) * amp * d, jy: Math.cos(t * 3.4) * amp * 0.7 * d };
};

/* ---------- timeline (frames; anchored to words.json starts) ---------- */
const T = {
  trace: f(0.68),      // "building" — hairline starts tracing
  fill: 96,            // ~"with" 3.26s — card face fades in
  product: f(3.76),    // "AI" — product row settles
  price: f(4.26),      // "now" — price settles
  button: f(4.66),     // "easy" — buy button settles
  glyphs: f(8.34),     // "payment" — 4 payment glyphs click on
  tiers: f(9.84),      // "tiers" — two tier columns squeeze in
  geo: f(11.1),        // "geo-pricings" — mono geo row
  glitch: f(18.18),    // "complexity" — misalignment ramps in
  toast: f(21.46),     // "started (to break)" — red toast slides in
  recover: f(26.1),    // "I (then just)" — glitch clears
  geoOut: f(26.88),    // "went (back)" — geo row leaves
  tiersOut: f(27.72),  // "one (simple checkout)" — tier columns leave
  glyphsOut: f(28.36), // "checkout" — glyph row leaves; pristine again
  spark: f(32.24),     // "went (up)" — sparkline draws
  under: f(32.72),     // "again" — lime underline + tick
  line: f(35.96),      // "less" — Playfair italic settles
  capsEnd: f(35.5),    // captions gone before the italic line
  dimStart: 1085, fadeStart: 1123, fadeEnd: 1133,
};

/* ---------- captions: karaoke groups (≤3 words) from words.json ---------- */
type G = { at: number; w: { t: string; s: number }[] };
const GROUPS: G[] = ([
  [["BUILDING", 0.68], ["SOFTWARE", 1.12]],
  [["WITH", 3.26], ["AI", 3.76]],
  [["IS", 4.04], ["NOW", 4.26]],
  [["SO", 4.4], ["EASY", 4.66]],
  [["THAT", 5.02], ["A", 5.5], ["FEW", 5.66]],
  [["MONTHS", 5.9], ["AGO", 6.16]],
  [["I", 6.52], ["STARTED", 6.64], ["ADDING", 7.0]],
  [["A", 7.42], ["LOT", 7.86], ["OF", 8.02]],
  [["DIFFERENT", 8.12], ["PAYMENT", 8.34], ["METHODS", 8.66]],
  [["DIFFERENT", 9.64], ["TIERS", 9.84]],
  [["DIFFERENT", 10.84], ["GEO-PRICINGS", 11.1]],
  [["BASED", 11.98], ["ON", 12.28]],
  [["WHICH", 13.44], ["COUNTRY", 13.62]],
  [["YOU", 14.04], ["WERE", 14.26], ["COMING", 14.4]],
  [["FROM", 14.72]],
  [["AND", 15.86], ["IT", 16.46], ["JUST", 16.76]],
  [["GAVE", 16.96], ["ME", 17.18]],
  [["SO", 17.36], ["MUCH", 17.62], ["MORE", 17.9]],
  [["COMPLEXITY", 18.18]],
  [["IN", 18.8], ["MY", 19.18], ["APP", 19.3]],
  [["THAT", 20.44], ["STUFF", 20.74]],
  [["JUST", 21.26], ["STARTED", 21.46]],
  [["TO", 21.74], ["BREAK", 21.92]],
  [["SO", 22.92], ["ADDING", 22.94], ["MORE", 23.38]],
  [["MADE", 23.8], ["IT", 24.52]],
  [["SO", 24.68], ["MUCH", 24.96], ["WORSE", 25.24]],
  [["I", 26.1], ["THEN", 26.4], ["JUST", 26.6]],
  [["WENT", 26.88], ["BACK", 27.12], ["TO", 27.44]],
  [["ONE", 27.72], ["SIMPLE", 28.02], ["CHECKOUT", 28.36]],
  [["ONE", 28.9], ["SIMPLE", 29.24], ["PRICE", 29.56]],
  [["AND", 29.96], ["MY", 30.82], ["SALES", 31.48]],
  [["ACTUALLY", 31.8]],
  [["WENT", 32.24], ["UP", 32.5], ["AGAIN", 32.72]],
  [["THAT", 33.02], ["MORE", 33.1], ["IS", 33.48]],
  [["NOT", 34.38], ["ALWAYS", 34.58], ["BETTER", 34.82]],
] as [string, number][][]).map((g) => ({
  at: f(g[0][1]),
  w: g.map(([t, s]) => ({ t, s: f(s) })),
}));

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= T.capsEnd) return null;
  let gi = -1;
  for (let i = 0; i < GROUPS.length; i++) if (frame >= GROUPS[i].at) gi = i;
  if (gi < 0) return null;
  const g = GROUPS[gi];
  const end = gi < GROUPS.length - 1 ? GROUPS[gi + 1].at : T.capsEnd;
  if (frame >= end) return null;
  const p = ramp(frame, g.at, 5);
  let cur = 0;
  for (let i = 0; i < g.w.length; i++) if (frame >= g.w[i].s) cur = i;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: 1920 * 0.52, textAlign: "center",
      opacity: p, transform: `translateY(${(1 - p) * 6}px)`, pointerEvents: "none",
    }}>
      <div style={{
        display: "inline-flex", gap: 22, fontFamily: SANS, fontWeight: 800,
        fontSize: 64, letterSpacing: "0.01em", lineHeight: 1, whiteSpace: "nowrap",
      }}>
        {g.w.map((w, i) => (
          <span key={i} style={{
            color: i === cur ? LIME : "#fff",
            textShadow: "0 4px 22px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.9)",
          }}>{w.t}</span>
        ))}
      </div>
    </div>
  );
};

/* ---------- IP-clean payment glyphs (abstract line icons) ---------- */
const Glyph: React.FC<{ kind: number }> = ({ kind }) => {
  const s = { stroke: INK, strokeWidth: 1.7, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={30} height={24} viewBox="0 0 24 20">
      {kind === 0 && (<>{/* card */}
        <rect x={2} y={3.5} width={20} height={13.5} rx={2.5} {...s} />
        <line x1={2} y1={8} x2={22} y2={8} {...s} />
      </>)}
      {kind === 1 && (<>{/* bank */}
        <path d="M3 7.5 L12 2.8 L21 7.5" {...s} />
        <line x1={6} y1={10} x2={6} y2={14.5} {...s} />
        <line x1={12} y1={10} x2={12} y2={14.5} {...s} />
        <line x1={18} y1={10} x2={18} y2={14.5} {...s} />
        <line x1={3.5} y1={17.2} x2={20.5} y2={17.2} {...s} />
      </>)}
      {kind === 2 && (<>{/* wallet */}
        <rect x={2.5} y={4.5} width={19} height={12.5} rx={3} {...s} />
        <path d="M21.5 9 h-5 a2 2 0 0 0 0 4 h5" {...s} />
      </>)}
      {kind === 3 && (<>{/* contactless */}
        <path d="M9 12.2 a4.2 4.2 0 0 1 6 0" {...s} />
        <path d="M6.4 9.4 a8 8 0 0 1 11.2 0" {...s} />
        <circle cx={12} cy={15.4} r={1.3} fill={INK} stroke="none" />
      </>)}
    </svg>
  );
};

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 0.3, rate = 1 }) => (
  <Sequence from={at} durationInFrames={f(1.6)}>
    <Audio src={staticFile(`vedit/sfx/${src}`)} volume={volume} playbackRate={rate} />
  </Sequence>
);

/* ---------- the card ---------- */
const CARD_X = 240, CARD_Y = 1155, CARD_W = 600, CARD_H0 = 286;

const CheckoutCard: React.FC = () => {
  const frame = useCurrentFrame();

  const cardIn = ramp(frame, T.fill, 14);
  const rise = (at: number) => ({
    opacity: ramp(frame, at, 10),
    transform: `translateY(${(1 - ramp(frame, at, 10)) * 10}px)`,
  });

  const glyphP = sec(frame, T.glyphs, T.glyphsOut);
  const tierP = sec(frame, T.tiers, T.tiersOut);
  const geoP = sec(frame, T.geo, T.geoOut);
  const toastP = sec(frame, T.toast, T.recover, 9, 12);

  // glitch amount: ramps at "complexity", clears at "I then"
  const m = ramp(frame, T.glitch, 18) * (1 - ramp(frame, T.recover, 22));
  const j1 = jolt(frame, T.glitch + 6), j2 = jolt(frame, f(19.9)), j3 = jolt(frame, T.toast), j4 = jolt(frame, f(23.4), 1.8);
  const jx = (j1.jx + j2.jx + j3.jx + j4.jx) * (m > 0.05 ? 1 : 0);
  const jy = (j1.jy + j2.jy + j3.jy + j4.jy) * (m > 0.05 ? 1 : 0);

  // beat 5
  const sparkP = ramp(frame, T.spark, 24, Easing.inOut(Easing.cubic));
  const underP = ramp(frame, T.under, 12);

  const priceSize = 64 - 20 * tierP;
  const tierW = 148 * tierP;

  const SPARK = "M4 40 L30 44 L56 28 L82 33 L112 10";
  const sparkLen = 150;

  return (
    <>
      {/* hairline trace (hook only) */}
      {frame >= T.trace && frame < T.fill + 24 && (
        <svg width={CARD_W + 4} height={CARD_H0 + 4}
          style={{ position: "absolute", left: CARD_X - 2, top: CARD_Y - 2, opacity: 1 - ramp(frame, T.fill + 4, 16) }}>
          <rect x={1.5} y={1.5} width={CARD_W} height={CARD_H0} rx={12}
            stroke="rgba(255,255,255,0.92)" strokeWidth={2.2} fill="none"
            pathLength={1} strokeDasharray={1}
            strokeDashoffset={1 - ramp(frame, T.trace, 62, Easing.inOut(Easing.cubic))} />
        </svg>
      )}

      <div style={{
        position: "absolute", left: CARD_X, top: CARD_Y, width: CARD_W,
        background: "#fff", borderRadius: 12, padding: "30px 34px", boxSizing: "border-box",
        boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.25)",
        opacity: cardIn,
        transform: `translate(${jx}px, ${jy}px)`,
        filter: `saturate(${1 - 0.3 * m}) contrast(${1 - 0.03 * m})`,
        fontFamily: SANS, color: INK,
      }}>
        {/* red toast — glitch beat */}
        <div style={{ height: 46 * toastP, marginBottom: 16 * toastP, overflow: "hidden", opacity: toastP }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, height: 46, padding: "0 16px",
            background: "#FBEBEC", border: "1px solid rgba(197,48,58,0.25)", borderLeft: `3px solid ${RED}`,
            borderRadius: 8, transform: `translateY(${(1 - toastP) * -12}px)`, boxSizing: "border-box",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: RED }} />
            <div style={{ fontFamily: MONO, fontSize: 20, color: RED }}>payment failed</div>
          </div>
        </div>

        {/* product row */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          ...rise(T.product), transform: `${rise(T.product).transform} translateX(${-3 * m}px)`,
        }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }}>BuildLoop Pro</div>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.18em", color: GRAY }}>CHECKOUT</div>
        </div>

        {/* price zone: €49, flanked by tier columns during the bloat */}
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 14 * tierP, marginTop: 22,
          ...rise(T.price), transform: `${rise(T.price).transform} translate(${2 * m}px, ${1.5 * m}px)`,
        }}>
          {/* basic */}
          <div style={{ width: tierW, opacity: tierP, overflow: "hidden" }}>
            <div style={{ width: 148, padding: "10px 14px", background: "#F3F4F6", borderRadius: 8, boxSizing: "border-box" }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.16em", color: GRAY }}>BASIC</div>
              <div style={{ fontSize: 38, fontWeight: 700, marginTop: 2 }}>€29</div>
            </div>
          </div>
          {/* the one price */}
          <div style={{ position: "relative" }}>
            <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.16em", color: GRAY, height: 20 * tierP, opacity: tierP, overflow: "hidden" }}>PRO</div>
            <div style={{ fontSize: priceSize, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.02 }}>€49</div>
            {/* lime underline — the single lime moment */}
            <div style={{
              height: 6, width: 118, marginTop: 4, background: LIME, borderRadius: 3,
              transform: `scaleX(${underP})`, transformOrigin: "left center",
              boxShadow: `0 0 12px rgba(207,255,5,${0.4 * underP})`,
            }} />
          </div>
          {/* sparkline (only lives after tiers are gone) */}
          {sparkP > 0 && (
            <svg width={120} height={54} viewBox="0 0 120 54" style={{ marginLeft: 20, marginBottom: 6 }}>
              <path d={SPARK} stroke={LIME} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={sparkLen} strokeDashoffset={sparkLen * (1 - sparkP)} />
              {sparkP > 0.97 && <circle cx={112} cy={10} r={6} fill={LIME} />}
            </svg>
          )}
          {/* max — the column that overlaps during the glitch */}
          <div style={{ width: tierW, opacity: tierP, overflow: "hidden" }}>
            <div style={{
              width: 148, padding: "10px 14px", background: "#F3F4F6", borderRadius: 8, boxSizing: "border-box",
              transform: `translate(${-16 * m}px, ${7 * m}px)`,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.16em", color: GRAY }}>MAX</div>
              <div style={{ fontSize: 38, fontWeight: 700, marginTop: 2 }}>€99</div>
            </div>
          </div>
        </div>

        {/* payment glyph row */}
        <div style={{ height: 62 * glyphP, marginTop: 20 * glyphP, overflow: "hidden", opacity: glyphP }}>
          <div style={{ display: "flex", gap: 14 }}>
            {[0, 1, 2, 3].map((k) => {
              const gp = ramp(frame, T.glyphs + k * 6, 8) * (1 - ramp(frame, T.glyphsOut, 12));
              return (
                <div key={k} style={{
                  width: 70, height: 50, border: `1.5px solid ${HAIR}`, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: gp, transform: `scale(${0.82 + 0.18 * gp})`,
                }}>
                  <Glyph kind={k} />
                </div>
              );
            })}
          </div>
        </div>

        {/* geo pricing row */}
        <div style={{
          height: 40 * geoP, marginTop: 16 * geoP, overflow: "hidden", opacity: geoP,
          transform: `translateX(${4 * m}px)`,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 19, color: GRAY, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            NL €49 &nbsp;·&nbsp; US $54 &nbsp;·&nbsp; IN ₹1.9k
          </div>
        </div>

        {/* buy button */}
        <div style={{
          marginTop: 24, height: 76, borderRadius: 10, background: RAISIN,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 24, fontWeight: 700, letterSpacing: "0.01em",
          ...rise(T.button),
          transform: `${rise(T.button).transform} translate(${-2.5 * m}px, ${1 * m}px)`,
        }}>
          Pay €49
        </div>
      </div>
    </>
  );
};

/* ---------- main ---------- */
export const LessIsMoreShort: React.FC = () => {
  const frame = useCurrentFrame();

  // camera: tightens a notch per addition, holds through the break, eases back on the exhale
  const camS = interpolate(frame,
    [T.glyphs - 6, T.glyphs + 18, T.tiers - 3, T.tiers + 21, T.geo - 3, T.geo + 23, T.recover, T.recover + 105],
    [1, 1.022, 1.022, 1.042, 1.042, 1.06, 1.06, 1],
    { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    + Math.sin(frame / 160) * 0.0015; // never fully rests
  const camY = Math.sin(frame / 95) * 4;
  const camX = Math.cos(frame / 130) * 3;

  // footage: film-open settle, then micro-drift
  const fScale = 1.05 - 0.035 * ramp(frame, 0, 85, OUT);

  // closer
  const lp = ramp(frame, T.line, 30, OUT);
  const dim = interpolate(frame, [T.dimStart, T.dimStart + 30], [0, 0.72], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(frame, [T.fadeStart, T.fadeEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      {/* camera group: footage + card + closer line */}
      <AbsoluteFill style={{ transform: `translate(${camX}px, ${camY}px) scale(${camS})`, transformOrigin: "50% 68%" }}>
        <Sequence from={0} durationInFrames={1130}>
          <AbsoluteFill style={{ transform: `scale(${fScale})` }}>
            <OffthreadVideo
              src={staticFile("shorts/less-is-more/source.mp4")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        </Sequence>

        {/* end dim — footage recedes, the card stays */}
        <AbsoluteFill style={{ background: RAISIN, opacity: dim, pointerEvents: "none" }} />

        <CheckoutCard />

        {/* closer — Playfair italic settles below the card */}
        {frame >= T.line && (
          <div style={{
            position: "absolute", left: 0, right: 0, top: 1530, textAlign: "center",
            fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 96, color: "#fff",
            opacity: lp, transform: `translateY(${(1 - lp) * 18}px) scale(${1.03 - 0.03 * lp})`,
            textShadow: "0 4px 30px rgba(0,0,0,0.7)",
          }}>
            less is more.
          </div>
        )}
      </AbsoluteFill>

      {/* captions — outside the camera so they never drift into the card */}
      <Captions />

      {/* final fade — last 10 frames */}
      <AbsoluteFill style={{ background: RAISIN, opacity: fade, pointerEvents: "none" }} />

      {/* SFX — fire on landings, sparse */}
      <Sfx src="soft.wav" at={T.fill + 12} volume={0.24} />
      <Sfx src="tick_soft.wav" at={T.glyphs + 4} volume={0.2} />
      <Sfx src="tick_soft.wav" at={T.glyphs + 10} volume={0.2} />
      <Sfx src="tick_soft.wav" at={T.glyphs + 16} volume={0.2} />
      <Sfx src="tick_soft.wav" at={T.glyphs + 22} volume={0.2} />
      <Sfx src="tick.wav" at={T.tiers + 4} volume={0.26} />
      <Sfx src="tick.wav" at={T.geo + 4} volume={0.26} />
      <Sfx src="tap.wav" at={T.toast} volume={0.3} rate={0.72} />
      <Sfx src="slide.wav" at={T.geoOut} volume={0.32} />
      <Sfx src="tick.wav" at={T.under} volume={0.34} />
    </AbsoluteFill>
  );
};

export default LessIsMoreShort;
