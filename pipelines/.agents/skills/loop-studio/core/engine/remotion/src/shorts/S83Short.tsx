/**
 * S83Short — bespoke 9:16 short (1080x1920, 1300f @30fps ≈ 43.3s)
 *
 * CONCEPT — "I replaced my $2,000/mo editor with Claude." A fully-AI talking head
 * (Fish S2.1 voice + HeyGen Avatar V). Straight receipt-drop… until the KICKER:
 * everything you just watched — voice, face, edit — was AI. The reveal IS the point,
 * so the last beat glitches and resolves into a "100% AI" card.
 *
 * On-brand (brand.json): raisin base, ONE accent = Neo Lime. Lime is a PLATE colour →
 * active caption word sits on a lime plate with RAISIN ink (never lime text on light).
 * Captions: heavy white, dark outline + shadow, current word on the lime plate.
 * Every beat anchored to a real word start in s83_words.json.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig,
  staticFile, Easing, delayRender, continueRender,
} from "remotion";
import WORDS from "../s83_words.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const CLAMP = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const BEZ = Easing.bezier(0.45, 0, 0.18, 1);

/* brand tokens (mirror of core/brand/brand.json) */
const RAISIN = "#0F121A";
const RAISIN_DEEP = "#1E2434";
const LIME = "#CFFF05";
const TEXT = "#E7E9EE";
const SILVER = "#D2D8DA";
const BODY = "#9AA0AF";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

/* ---- fonts ---- */
const fh = delayRender("s83-fonts");
{
  let done = false;
  const finish = () => { if (!done) { done = true; continueRender(fh); } };
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@500;700&family=Playfair+Display:ital@1&display=block";
    document.head.appendChild(link);
    const ft: any = (document as any).fonts;
    (ft && ft.ready ? ft.ready : Promise.resolve()).then(finish).catch(finish);
    setTimeout(finish, 4000);
  } else finish();
}

const GRAIN_URI = (() => {
  const n = 90;
  let r = "";
  const rnd = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
  for (let i = 0; i < 200; i++) {
    const x = Math.abs(rnd(i)) * n, y = Math.abs(rnd(i + 7)) * n, o = 0.25 + Math.abs(rnd(i + 3)) * 0.4;
    r += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='0.7' fill='rgba(255,255,255,${o.toFixed(2)})'/>`;
  }
  return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${n}' height='${n}'>${r}</svg>`);
})();

type Word = [number, number, string];

/* karaoke caption chunks */
function chunk(words: Word[]): Word[][] {
  const groups: Word[][] = []; let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const endsClause = /[.?!,]$/.test(w[2]);
    const dur = w[1] - cur[0][0];
    if ((cur.length >= 3 && (endsClause || dur > 1.4)) || cur.length >= 5) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}
const Captions: React.FC<{ words: Word[]; hideAfter: number }> = ({ words, hideAfter }) => {
  const { width: W } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups = React.useMemo(() => chunk(words), [words]);
  if (frame >= hideAfter) return null;
  let gi = -1;
  for (let i = 0; i < groups.length; i++) {
    const start = groups[i][0][0];
    const end = i + 1 < groups.length ? groups[i + 1][0][0] : groups[i][groups[i].length - 1][1] + 0.5;
    if (t >= start - 0.08 && t < end) { gi = i; break; }
  }
  if (gi < 0) return null;
  const g = groups[gi];
  const pop = interpolate(t, [g[0][0] - 0.1, g[0][0] + 0.04], [0, 1], CLAMP);
  return (
    <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "13%", display: "flex", justifyContent: "center", opacity: pop }}>
      <div style={{ textAlign: "center", lineHeight: 1.28 }}>
        {g.map(([s, e, w], i) => {
          const active = t >= s - 0.02 && (i === g.length - 1 ? t < e + 0.2 : t < g[i + 1][0]);
          return (
            <span key={i} style={{
              fontFamily: SANS, fontWeight: 700, fontSize: W * 0.066, letterSpacing: "-0.015em",
              color: active ? RAISIN : "#fff",
              background: active ? LIME : "transparent",
              padding: active ? `${W * 0.004}px ${W * 0.016}px` : `${W * 0.004}px ${W * 0.004}px`,
              borderRadius: W * 0.016, margin: `0 ${W * 0.004}px`,
              boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
              textShadow: active ? "none" : "0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
              WebkitTextStroke: active ? "0" : "1.5px rgba(6,8,12,0.55)",
            }}>{w}</span>
          );
        })}
      </div>
    </div>
  );
};

/* a lime "capability" chip on the tools beat (raisin ink on lime plate) */
const Chip: React.FC<{ at: number; label: string; x: string; y: string; rot?: number }> = ({ at, label, x, y, rot = 0 }) => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const p = interpolate(frame, [f(at), f(at) + 8], [0, 1], { ...CLAMP, easing: BEZ });
  const out = interpolate(frame, [f(25.6), f(26.2)], [1, 0], CLAMP);
  if (frame < f(at)) return null;
  return (
    <div style={{
      position: "absolute", left: x, top: y, opacity: p * out,
      transform: `translate(-50%,-50%) rotate(${rot}deg) translateY(${(1 - p) * 14}px)`,
      background: LIME, color: RAISIN, fontFamily: MONO, fontWeight: 700, fontSize: W * 0.036,
      letterSpacing: "0.02em", padding: `${W * 0.012}px ${W * 0.028}px`, borderRadius: 999,
      boxShadow: "0 16px 40px -14px rgba(207,255,5,0.5)", whiteSpace: "nowrap",
    }}>{label}</div>
  );
};

export const S83Short: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const words = WORDS as Word[];

  /* avatar zoom punch-ins — gentle (the Vertical-Good look is already well-framed; big zooms hurt it) */
  const zoom = interpolate(
    frame,
    [f(0), f(1.0), f(2.2), f(32.2), f(34.7), f(37.2), f(43.0)],
    [1.015, 1.025, 1.0, 1.02, 1.0, 1.0, 1.035],
    { ...CLAMP, easing: Easing.inOut(Easing.quad) }
  );

  /* entrance + end fade */
  const entrance = interpolate(frame, [0, 8], [0, 1], CLAMP);

  /* glitch ramp on the reveal (starts on "everything you just watched") */
  const gStart = f(37.2), gPeak = f(41.2);
  const glitch = interpolate(frame, [gStart, gPeak], [0, 1], CLAMP);
  const jitter = glitch * (Math.sin(frame * 2.3) * 4 + Math.sin(frame * 5.7) * 2);

  /* reveal card in on "was AI" (42.0) */
  const cardAt = f(41.9);
  const cardP = interpolate(frame, [cardAt, cardAt + 10], [0, 1], { ...CLAMP, easing: BEZ });

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS, opacity: entrance }}>
      {/* AVATAR (full frame, muted; VO played separately for a clean single audio source) */}
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${jitter}px)`, transformOrigin: "50% 42%" }}>
        <OffthreadVideo
          src={staticFile("s83/avatar.mp4")}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: `contrast(1.05) saturate(1.06)` }}
        />
      </AbsoluteFill>
      <Audio src={staticFile("s83/vo.wav")} />

      {/* top vignette so chips + brand mark read over the studio */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, rgba(15,18,26,0.72) 0%, rgba(15,18,26,0) 26%, rgba(15,18,26,0) 62%, rgba(15,18,26,0.78) 100%)" }} />

      {/* brand eyebrow */}
      <div style={{ position: "absolute", top: "4.5%", left: 0, right: 0, textAlign: "center", opacity: interpolate(frame, [4, 16], [0, 1], CLAMP) }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.03, letterSpacing: "0.22em", color: LIME }}>BUILDLOOP</span>
      </div>

      {/* HOOK stat — $2,000/mo, struck through on "faster" */}
      {frame >= f(0.6) && frame < f(7.6) && (() => {
        const inP = interpolate(frame, [f(0.6), f(1.1)], [0, 1], { ...CLAMP, easing: BEZ });
        const out = interpolate(frame, [f(7.1), f(7.6)], [1, 0], CLAMP);
        const struck = frame >= f(6.58);
        return (
          <div style={{ position: "absolute", top: "17%", left: 0, right: 0, textAlign: "center", opacity: inP * out, transform: `translateY(${(1 - inP) * 18}px)` }}>
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: W * 0.02, background: RAISIN_DEEP, border: `2px solid ${LIME}`, borderRadius: W * 0.03, padding: `${W * 0.02}px ${W * 0.04}px`, boxShadow: "0 20px 50px -18px rgba(0,0,0,0.6)" }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.11, color: struck ? BODY : "#fff", letterSpacing: "-0.03em", textDecoration: struck ? "line-through" : "none", textDecorationColor: LIME }}>$2,000</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.032, color: BODY }}>/mo editor</span>
            </div>
          </div>
        );
      })()}

      {/* PROOF — capability chips on "the cut, the captions, the b-roll, the pacing" */}
      <Chip at={19.78} label="THE CUT" x="26%" y="20%" rot={-3} />
      <Chip at={20.54} label="CAPTIONS" x="70%" y="18%" rot={2} />
      <Chip at={21.46} label="B-ROLL" x="30%" y="27%" rot={2} />
      <Chip at={22.36} label="PACING" x="72%" y="26%" rot={-2} />

      {/* week → afternoon */}
      {frame >= f(24.4) && frame < f(26.0) && (() => {
        const inP = interpolate(frame, [f(24.4), f(24.8)], [0, 1], { ...CLAMP, easing: BEZ });
        const out = interpolate(frame, [f(25.5), f(26.0)], [1, 0], CLAMP);
        return (
          <div style={{ position: "absolute", top: "20%", left: 0, right: 0, textAlign: "center", opacity: inP * out }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.02, background: RAISIN_DEEP, border: `1.5px solid rgba(210,216,218,0.35)`, borderRadius: 999, padding: `${W * 0.014}px ${W * 0.03}px` }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.042, color: BODY, textDecoration: "line-through" }}>a week</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.04, color: LIME }}>→</span>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.05, color: "#fff" }}>an afternoon</span>
            </div>
          </div>
        );
      })()}

      {/* PAYOFF underline — "The editor was never the cost. The waiting was." */}
      {frame >= f(32.2) && frame < f(35.6) && (() => {
        const inP = interpolate(frame, [f(32.2), f(32.7)], [0, 1], { ...CLAMP, easing: BEZ });
        const out = interpolate(frame, [f(35.1), f(35.6)], [1, 0], CLAMP);
        const wl = interpolate(frame, [f(34.14), f(34.7)], [0, 1], { ...CLAMP, easing: BEZ });
        return (
          <div style={{ position: "absolute", top: "18.5%", left: "10%", right: "10%", textAlign: "center", opacity: inP * out }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: W * 0.058, color: SILVER, lineHeight: 1.3 }}>
              the editor was never the cost.
            </div>
            <div style={{ marginTop: W * 0.02, fontFamily: SANS, fontWeight: 700, fontSize: W * 0.07, color: "#fff", display: "inline-block" }}>
              the waiting was
              <div style={{ height: 5, background: LIME, borderRadius: 3, marginTop: 6, transformOrigin: "left", transform: `scaleX(${wl})` }} />
            </div>
          </div>
        );
      })()}

      {/* CAPTIONS (hidden once the reveal card takes over) */}
      <Captions words={words} hideAfter={cardAt} />

      {/* GLITCH scanlines ramping into the reveal */}
      {glitch > 0.01 && (
        <>
          <AbsoluteFill style={{ pointerEvents: "none", opacity: glitch * 0.5, mixBlendMode: "screen",
            background: "repeating-linear-gradient(0deg, rgba(207,255,5,0.10) 0px, rgba(207,255,5,0.10) 2px, transparent 2px, transparent 5px)",
            transform: `translateY(${(frame % 8)}px)` }} />
          <AbsoluteFill style={{ pointerEvents: "none", opacity: glitch * 0.35, mixBlendMode: "screen",
            background: `linear-gradient(90deg, rgba(255,0,80,0.0) 48%, rgba(255,0,80,0.5) 50%, rgba(0,200,255,0.0) 52%)`,
            transform: `translateX(${Math.sin(frame * 0.9) * 30}px)` }} />
        </>
      )}

      {/* REVEAL CARD — "100% AI" */}
      {frame >= cardAt && (
        <AbsoluteFill style={{ background: `rgba(15,18,26,${0.9 * cardP})`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: cardP }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.036, letterSpacing: "0.2em", color: BODY, transform: `translateY(${(1 - cardP) * 20}px)` }}>EVERYTHING YOU JUST WATCHED</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.2, color: LIME, letterSpacing: "-0.04em", lineHeight: 1, margin: `${W * 0.02}px 0`, transform: `scale(${0.9 + cardP * 0.1})`, textShadow: "0 24px 70px rgba(207,255,5,0.35)" }}>100% AI</div>
          <div style={{ display: "flex", gap: W * 0.018, marginTop: W * 0.01 }}>
            {["voice", "face", "edit"].map((t, i) => {
              const cp = interpolate(frame, [cardAt + 6 + i * 3, cardAt + 12 + i * 3], [0, 1], CLAMP);
              return <span key={t} style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.04, color: "#fff", background: RAISIN_DEEP, border: `1.5px solid ${LIME}`, borderRadius: 999, padding: `${W * 0.012}px ${W * 0.028}px`, opacity: cp }}>{t}</span>;
            })}
          </div>
          <div style={{ marginTop: W * 0.05, fontFamily: MONO, fontSize: W * 0.03, letterSpacing: "0.14em", color: BODY, opacity: interpolate(frame, [cardAt + 18, cardAt + 30], [0, 1], CLAMP) }}>Fish Audio voice · HeyGen avatar · Claude edit</div>
        </AbsoluteFill>
      )}

      {/* grain + edge vignette */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay", backgroundImage: `url("${GRAIN_URI}")`, backgroundSize: "150px", transform: `translate(${(frame % 3) * 3}px, ${(frame % 2) * -3}px)` }} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 62% at 50% 42%, transparent 58%, rgba(6,8,14,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};

export default S83Short;
