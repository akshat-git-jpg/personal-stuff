/**
 * sketches.tsx — the 26 marker drawings for ATTENTION.
 *
 * Each one ENACTS its clause (Law 1): mute the audio and hide the captions and the moving
 * strokes still say the idea. Nothing here is a label. Local time starts at 0 for every
 * sketch (they live inside a <Beat> Sequence), so `at=` values are seconds into the beat.
 */
import React from "react";
import { interpolate } from "remotion";
import { Ink, Blob, Num, useT, clamp01 } from "./ink";
import { WHITE, SILVER, SILVER_MID, LIME, MONO, EASE, EASE_OVER } from "../bb2/engine";

export const IG = "#E1306C", IG2 = "#F77737", LI = "#0A66C2", YT = "#FF0000";

/** Instagram: rounded square + lens + flash dot, drawn. Two-tone to read as the gradient. */
export const IgMark: React.FC<{ x: number; y: number; s?: number; at?: number; c?: string }> =
  ({ x, y, s = 1, at = 0, c = IG }) => (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <Ink d="M-21,-21 h42 a8,8 0 0 1 8,8 v26 a8,8 0 0 1 -8,8 h-42 a8,8 0 0 1 -8,-8 v-26 a8,8 0 0 1 8,-8 z" at={at} dur={0.5} w={3} color={c} />
      <Ink d="M0,-11 a11,11 0 1 1 -0.1,0" at={at + 0.3} dur={0.35} w={2.8} color={IG2} />
      <Blob cx={14} cy={-14} r={2.6} at={at + 0.55} color={IG2} />
    </g>
  );

/** LinkedIn: rounded square + the "in". */
export const LiMark: React.FC<{ x: number; y: number; s?: number; at?: number; c?: string }> =
  ({ x, y, s = 1, at = 0, c = LI }) => (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <Ink d="M-21,-21 h42 a7,7 0 0 1 7,7 v28 a7,7 0 0 1 -7,7 h-42 a7,7 0 0 1 -7,-7 v-28 a7,7 0 0 1 7,-7 z" at={at} dur={0.5} w={3} color={c} />
      <Ink d="M-12,-3 v16" at={at + 0.3} dur={0.16} w={3.4} color={c} />
      <Blob cx={-12} cy={-10} r={2.6} at={at + 0.36} color={c} />
      <Ink d="M-2,13 v-16" at={at + 0.44} dur={0.16} w={3.4} color={c} />
      <Ink d="M-2,2 a7,7 0 0 1 12,5 v6" at={at + 0.54} dur={0.28} w={3.4} color={c} />
    </g>
  );

/** YouTube: the rounded "tv" + play triangle. */
export const YtMark: React.FC<{ x: number; y: number; s?: number; at?: number; c?: string }> =
  ({ x, y, s = 1, at = 0, c = YT }) => (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <Ink d="M-24,-16 h48 a10,10 0 0 1 10,10 v12 a10,10 0 0 1 -10,10 h-48 a10,10 0 0 1 -10,-10 v-12 a10,10 0 0 1 10,-10 z" at={at} dur={0.5} w={3} color={c} />
      <Ink d="M-6,-8 v16 l14,-8 z" at={at + 0.32} dur={0.3} w={2.8} color={c} />
    </g>
  );

const ip = (t: number, a: number, b: number, from = 0, to = 1, e = EASE) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

/* ═══════════════════════════════════════════════════ 45.4  scientifically proven */
export const PaperStamped: React.FC = () => {
  const t = useT();
  const stamp = ip(t, 1.15, 1.35, 0, 1, EASE_OVER);
  return (
    <>
      <Ink d="M46,26 L152,29 L149,176 L43,173 Z" at={0} dur={0.5} />
      <Ink d="M62,58 L134,59" at={0.34} dur={0.22} w={1.7} color={SILVER_MID} />
      <Ink d="M62,76 L134,77" at={0.44} dur={0.22} w={1.7} color={SILVER_MID} />
      <Ink d="M62,94 L112,95" at={0.54} dur={0.18} w={1.7} color={SILVER_MID} />
      <g transform={`translate(97,132) rotate(${-8 + 8 * stamp}) scale(${0.4 + 0.6 * stamp}) translate(-97,-132)`} opacity={stamp}>
        <Ink d="M68,132 L90,155 L130,108" at={1.15} dur={0.28} w={4} color={LIME} />
      </g>
    </>
  );
};

/* ═══════════════════════════════════════════════════ 54.0  prompting → enter */
export const PromptEnter: React.FC = () => {
  const t = useT();
  const press = ip(t, 2.0, 2.14, 0, 1, EASE_OVER) * (1 - ip(t, 2.3, 2.5));
  return (
    <>
      <Ink d="M28,52 L172,55 L171,104 L27,101 Z" at={0} dur={0.5} />
      <Ink d="M44,68 L44,90" at={0.4} dur={0.14} w={2.6} />
      <Ink d="M50,88 L128,89" at={0.6} dur={0.55} w={2.6} color={SILVER} />
      <g transform={`translate(0,${press * 5})`}>
        <Ink d="M62,132 L142,134 L141,172 L61,170 Z" at={1.2} dur={0.4} color={press > 0.15 ? LIME : WHITE} />
        <Ink d="M124,145 L124,158 L86,157" at={1.45} dur={0.3} w={2} color={press > 0.15 ? LIME : SILVER} />
        <Ink d="M94,150 L86,157 L94,164" at={1.6} dur={0.2} w={2} color={press > 0.15 ? LIME : SILVER} />
      </g>
    </>
  );
};

/* ═══════════════════════════════════════════════════ 59.4  hand leaves the key → phone */
export const KeyToPhone: React.FC = () => {
  const t = useT();
  return (
    <>
      {/* the same ENTER key from the previous beat, still there */}
      <Ink d="M18,134 L84,136 L83,172 L17,170 Z" at={0} dur={0.35} color={SILVER_MID} w={1.9} />
      {/* attention swings off it */}
      <Ink d="M50,130 C48,74 84,50 118,58" at={0.5} dur={0.7} w={2.4} color={SILVER} />
      <Ink d="M110,50 L120,59 L109,67" at={1.1} dur={0.18} w={2.4} color={SILVER} />
      {/* and lands in a phone */}
      <Ink d="M118,64 L176,66 L173,180 L115,178 Z" at={1.25} dur={0.55} />
      <Ink d="M138,72 L156,73" at={1.7} dur={0.15} w={1.6} color={SILVER_MID} />
      <YtMark x={146} y={102} s={0.44} at={1.95} />
      <IgMark x={146} y={140} s={0.44} at={2.35} />
    </>
  );
};

/* ═══════════════════════════════════════════════════ 64.5  "I felt productive" */
export const HollowTick: React.FC = () => (
  <>
    <Ink d="M56,64 L146,67 L143,154 L53,151 Z" at={0} dur={0.5} />
    {/* the tick lands... and then quietly retracts. It was never really work. */}
    <Ink d="M72,110 L94,133 L130,82" at={0.55} dur={0.3} w={4} color={LIME} undraw={1.9} undrawDur={0.7} />
  </>
);

/* ═══════════════════════════════════════════════════ 75.7 / 82.9 / 430.3  the tally */
/** Shared device — grabs of the phone, one mark per grab. Returns at the end as YOUR count. */
export const Tally: React.FC<{ n: number; growAt?: number; growDur?: number; overflow?: boolean; color?: string }> =
  ({ n, growAt = 0.25, growDur = 3.4, overflow = false, color = WHITE }) => {
    const t = useT();
    const shown = Math.floor(ip(t, growAt, growAt + growDur, 0, n + 0.999));
    const marks = [];
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5), k = i % 5;
      const col = grp % 3, row = Math.floor(grp / 3);
      const x = 34 + col * 56 + k * 8.5;
      const y = 44 + row * 46;
      const on = i < shown;
      const at = growAt + (growDur * i) / Math.max(1, n);
      const late = overflow && i > n * 0.55;
      marks.push(
        k === 4
          ? <Ink key={i} d={`M${x - 36},${y + 30} L${x + 3},${y - 2}`} at={at} dur={0.14} w={2.6} color={late ? LIME : color} opacity={on ? 1 : 0} />
          : <Ink key={i} d={`M${x},${y} L${x - 3},${y + 30}`} at={at} dur={0.12} w={2.6} color={late ? LIME : color} opacity={on ? 1 : 0} />
      );
    }
    return <>{marks}</>;
  };

export const TallyGrow: React.FC = () => <Tally n={13} growAt={0.3} growDur={4.2} />;
export const TallyOverflow: React.FC = () => <Tally n={38} growAt={0.1} growDur={3.4} overflow />;
export const CounterTally: React.FC = () => <Tally n={11} growAt={0.6} growDur={4.4} color={LIME} />;

/* ═══════════════════════════════════════════════════ 111.6  the shrinking attention span */
/** ONE dial that evolves: sweeps to 47s, rewinds to 2:30 (a few years ago), then collapses back. */
export const Dial: React.FC = () => {
  const t = useT();
  //            draw   →  47s      hold   → 2:30 (the past)   hold   → collapse to 47s
  const secs =
    t < 1.0 ? 0 :
      t < 2.2 ? ip(t, 1.0, 2.2, 0, 47) :
        t < 5.4 ? 47 :
          t < 7.0 ? ip(t, 5.4, 7.0, 47, 150, EASE) :
            t < 9.4 ? 150 :
              ip(t, 9.4, 10.5, 150, 47, EASE);
  const ang = (secs / 150) * 300 - 150;          // full dial = 2:30
  const R = 62, cx = 100, cy = 96;
  const hx = cx + R * 0.78 * Math.sin((ang * Math.PI) / 180);
  const hy = cy - R * 0.78 * Math.cos((ang * Math.PI) / 180);
  const past = t >= 5.9 && t < 9.6;
  const label = secs >= 140 ? "2:30" : `0:${String(Math.round(secs)).padStart(2, "0")}`;
  return (
    <>
      <Ink d={`M${cx - R},${cy} A${R},${R} 0 1,1 ${cx - R},${cy + 0.1}`} at={0} dur={0.75} w={2.4} />
      <Ink d={`M${cx - 6},${cy - R - 12} L${cx + 6},${cy - R - 12}`} at={0.5} dur={0.15} w={3} />
      {[0, 60, 120, 180, 240, 300].map((a, i) => {
        const r = ((a - 150) * Math.PI) / 180;
        return <Ink key={i} d={`M${cx + R * 0.86 * Math.sin(r)},${cy - R * 0.86 * Math.cos(r)} L${cx + R * Math.sin(r)},${cy - R * Math.cos(r)}`}
          at={0.55 + i * 0.05} dur={0.1} w={1.6} color={SILVER_MID} />;
      })}
      {secs > 0.5 && (
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={past ? SILVER_MID : LIME} strokeWidth={3.2} strokeLinecap="round" />
      )}
      <Blob cx={cx} cy={cy} r={4} at={0.9} color={past ? SILVER_MID : LIME} />
      <Num x={cx} y={cy + R + 34} at={1.1} size={22} color={past ? SILVER_MID : WHITE}>{label}</Num>
    </>
  );
};

/* ═══════════════════════════════════════════════════ 128.0  spans down, algorithms up */
export const CrossCurves: React.FC = () => {
  const t = useT();
  const pd = clamp01(ip(t, 0.5, 4.4)), pu = clamp01(ip(t, 1.8, 5.8));
  const down = (q: number): [number, number] => [22 + q * 156, 40 + q * q * 116];
  const up = (q: number): [number, number] => [22 + q * 156, 156 - q * q * 116];
  const [dx, dy] = down(pd), [ux, uy] = up(pu);
  return (
    <>
      <Ink d="M22,40 Q108,52 178,156" at={0.5} dur={3.9} w={3} color={SILVER} />
      <Ink d="M22,156 Q108,144 178,40" at={1.8} dur={4.0} w={3.4} color={LIME} />
      {pd > 0.02 && <circle cx={dx} cy={dy} r={5} fill={SILVER} />}
      {pu > 0.02 && <circle cx={ux} cy={uy} r={5.4} fill={LIME} />}
    </>
  );
};

/* ═══════════════════════════════════════════════════ 149.4 / 425.9  the 24-hour day */
export const Day24: React.FC<{ eaten?: boolean }> = ({ eaten = true }) => {
  const t = useT();
  const drawn = Math.floor(ip(t, 0.2, 2.2, 0, 24.999));
  const bites = [3, 6, 7, 12, 14, 18, 19, 21];
  return (
    <>
      {Array.from({ length: 24 }).map((_, i) => {
        const x = 30 + (i % 6) * 29, y = 46 + Math.floor(i / 6) * 33;
        const bitten = eaten && bites.includes(i);
        const bt = 2.6 + bites.indexOf(i) * 0.24;
        return (
          <g key={i} opacity={i < drawn ? 1 : 0}>
            <Ink d={`M${x},${y} L${x + 22},${y + 1} L${x + 21},${y + 24} L${x - 1},${y + 23} Z`}
              at={0.2 + i * 0.08} dur={0.16} w={2} color={SILVER} />
            {bitten && <>
              <Ink d={`M${x + 1},${y + 2} L${x + 20},${y + 22}`} at={bt} dur={0.14} w={2.6} color={LIME} />
              <Ink d={`M${x + 20},${y + 2} L${x + 1},${y + 22}`} at={bt + 0.05} dur={0.14} w={2.6} color={LIME} />
            </>}
          </g>
        );
      })}
    </>
  );
};

/* ═══════════════════════════════════════════════════ 158.9  wired for quick dopamine */
export const LeverPellet: React.FC = () => {
  const t = useT();
  const pull = ip(t, 1.5, 1.68, 0, 1, EASE_OVER) * (1 - ip(t, 2.0, 2.25));
  const drop = clamp01(ip(t, 1.75, 2.35));
  return (
    <>
      <Ink d="M40,40 L164,43 L160,168 L36,165 Z" at={0} dur={0.6} />
      <g transform={`rotate(${pull * 26} 62 66)`}>
        <Ink d="M62,66 L62,112" at={0.6} dur={0.25} w={3} />
        <Blob cx={62} cy={116} r={7} at={0.85} color={pull > 0.2 ? LIME : SILVER} />
      </g>
      {/* the tray, and the pellet that drops the instant the lever moves */}
      <Ink d="M104,144 L152,145" at={0.9} dur={0.25} w={2.4} color={SILVER_MID} />
      {drop > 0.02 && <circle cx={128} cy={70 + drop * 68} r={6.5} fill={LIME} opacity={Math.min(1, drop * 3)} />}
    </>
  );
};

/* ═══════════════════════════════════════════════════ 166.5  deleted everything */
export const AppsStruck: React.FC = () => (
  <>
    <IgMark x={100} y={40}  s={0.92} at={0.25} />
    <LiMark x={100} y={104} s={0.92} at={1.55} />
    {/* "...and everything else I thought was distracting me" — the unnamed rest */}
    <Ink d="M79,147 h42 a7,7 0 0 1 7,7 v28 a7,7 0 0 1 -7,7 h-42 a7,7 0 0 1 -7,-7 v-28 a7,7 0 0 1 7,-7 z"
      at={3.0} dur={0.4} w={2.6} color={SILVER_MID} />
    <Blob cx={89} cy={168} r={3} at={3.3} color={SILVER_MID} />
    <Blob cx={100} cy={168} r={3} at={3.38} color={SILVER_MID} />
    <Blob cx={111} cy={168} r={3} at={3.46} color={SILVER_MID} />
    {/* struck out one at a time, on their own words */}
    <Ink d="M70,64  L130,14"  at={1.15} dur={0.2} w={4} color={LIME} />
    <Ink d="M70,128 L130,78"  at={2.45} dur={0.2} w={4} color={LIME} />
    <Ink d="M70,192 L130,142" at={3.9}  dur={0.2} w={4} color={LIME} />
  </>
);

/* ═══════════════════════════════════════════════════ 182.7  straight back to the browser */
export const BrowserTyped: React.FC = () => (
  <>
    <Ink d="M28,58 L172,61 L169,158 L25,155 Z" at={0} dur={0.55} />
    <Ink d="M28,82 L171,85" at={0.45} dur={0.35} w={1.8} color={SILVER_MID} />
    <Blob cx={42} cy={70} r={3.2} at={0.55} color={SILVER_MID} />
    <Blob cx={54} cy={70} r={3.2} at={0.62} color={SILVER_MID} />
    <Blob cx={66} cy={70} r={3.2} at={0.69} color={SILVER_MID} />
    {/* the URL types itself in, all by itself */}
    <Ink d="M46,120 L138,122" at={1.0} dur={1.0} w={3} color={SILVER} />
    <Ink d="M143,110 L143,132" at={2.0} dur={0.1} w={2.4} color={SILVER} />
    <IgMark x={100} y={118} s={0.62} at={2.35} />
  </>
);

/* ═══════════════════════════════════════════════════ 187.7  the addiction was like water */
export const WaterGate: React.FC = () => {
  const t = useT();
  const lvl = ip(t, 1.0, 2.8, 158, 74);
  const wave = (y: number) => `M26,${y} q11,-7 22,0 t22,0 t22,0`;   // a real waterline, not a rule
  return (
    <>
      {/* the wall you built, standing on the ground */}
      <Ink d="M96,34 L100,164" at={0} dur={0.5} w={7} />
      <Ink d="M22,166 L178,168" at={0.35} dur={0.4} w={2.4} color={SILVER_MID} />
      {/* water piles up behind it */}
      <Ink d={wave(lvl)} at={1.0} dur={0.5} w={2.6} color={SILVER} />
      <Ink d={wave(lvl + 20)} at={1.3} dur={0.5} w={2.2} color={SILVER_MID} />
      <Ink d={wave(lvl + 40)} at={1.55} dur={0.5} w={2} color={SILVER_MID} opacity={0.7} />
      {/* ...and simply goes around the side of it */}
      <Ink d="M62,150 C58,180 116,186 140,164 C158,146 156,120 152,98" at={3.0} dur={1.5} w={3.4} color={LIME} />
      <Ink d="M144,108 L152,94 L161,106" at={4.4} dur={0.2} w={3.2} color={LIME} />
    </>
  );
};

/* ═══════════════════════════════════════════════════ 195.1  the wiring in my head */
export const WiredHead: React.FC = () => (
  <>
    <Ink d="M64,166 L64,120 C50,110 46,88 56,68 C68,44 100,36 124,48 C150,60 156,92 142,114 L142,166" at={0} dur={1.1} w={2.6} />
    <Ink d="M74,104 C90,80 106,118 122,92 C132,76 140,96 132,108" at={1.2} dur={1.3} w={2.4} color={LIME} />
    <Ink d="M80,124 C96,104 110,136 128,118" at={2.1} dur={0.9} w={2} color={SILVER_MID} />
  </>
);

/* ═══════════════════════════════════════════════════ 207.9  the slot machine / endless scroll */
export const SlotLoop: React.FC = () => {
  const t = useT();
  const pull = ip(t, 1.3, 1.5, 0, 1, EASE_OVER) * (1 - ip(t, 1.9, 2.15));
  const spin = Math.max(0, t - 1.5);
  return (
    <>
      <Ink d="M34,44 L152,47 L149,158 L31,155 Z" at={0} dur={0.6} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Ink d={`M${48 + i * 34},68 L${74 + i * 34},69 L${73 + i * 34},122 L${47 + i * 34},121 Z`} at={0.45 + i * 0.12} dur={0.3} w={2} color={SILVER_MID} />
          {spin > 0 && <line x1={50 + i * 34} y1={70 + ((spin * 190 + i * 30) % 50)} x2={72 + i * 34} y2={70 + ((spin * 190 + i * 30) % 50)}
            stroke={i === 1 ? LIME : SILVER} strokeWidth={3} strokeLinecap="round" />}
        </g>
      ))}
      <g transform={`rotate(${pull * 30} 152 62)`}>
        <Ink d="M152,62 L152,104" at={0.9} dur={0.25} w={3} />
        <Blob cx={152} cy={108} r={7} at={1.1} color={pull > 0.2 ? LIME : SILVER} />
      </g>
      {/* the scroll that never ends */}
      <Ink d="M62,176 C62,190 118,190 118,176 C118,164 62,164 62,176" at={2.6} dur={1.1} w={2.4} color={LIME} />
      <Ink d="M112,170 L119,177 L111,182" at={3.6} dur={0.16} w={2.4} color={LIME} />
    </>
  );
};

/* ═══════════════════════════════════════════════════ 218.5  face-down, still on */
export const PhoneFaceDown: React.FC = () => {
  const t = useT();
  return (
    <>
      <Ink d="M34,146 L172,149" at={0} dur={0.4} w={2} color={SILVER_MID} />
      <Ink d="M60,116 L150,118 L158,146 L52,144 Z" at={0.3} dur={0.6} />
      {[0, 1, 2].map((i) => {
        const ph = ((t - 1.2 - i * 0.55) % 2.2) / 2.2;
        if (t < 1.2 + i * 0.55 || ph < 0) return null;
        const r = 18 + ph * 62;
        return <path key={i} d={`M${105 - r},116 A${r},${r * 0.62} 0 0,1 ${105 + r},116`}
          fill="none" stroke={LIME} strokeWidth={2.2} strokeDasharray="5 7" opacity={(1 - ph) * 0.75} />;
      })}
    </>
  );
};

/* ═══════════════════════════════════════════════════ 228.5  100% of your brain, minus a wedge */
export const BrainWedge: React.FC = () => {
  const t = useT();
  const R = 74, cx = 100, cy = 100;
  const deg = ip(t, 2.6, 4.4, 0, 62);          // the slice that is always on the phone
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const ex = cx + R * Math.cos(rad(deg)), ey = cy + R * Math.sin(rad(deg));
  return (
    <>
      <Ink d={`M${cx - R},${cy} A${R},${R} 0 1,1 ${cx - R},${cy + 0.1}`} at={0} dur={0.9} w={2.6} />
      {deg > 1 && (
        <path d={`M${cx},${cy} L${cx},${cy - R} A${R},${R} 0 0,1 ${ex},${ey} Z`}
          fill={LIME} opacity={0.55} stroke={LIME} strokeWidth={3} />
      )}
      {/* the wedge never comes back */}
      <Ink d="M100,178 L100,190" at={4.6} dur={0.2} w={2} color={SILVER_MID} opacity={0} />
    </>
  );
};

/* ═══════════════════════════════════════════════════ 245.6  boredom is flat — and then it lifts */
export const FlatThenRise: React.FC = () => (
  <>
    <Ink d="M26,132 L124,133" at={0.2} dur={2.6} w={3} color={SILVER} />
    <Ink d="M124,133 C144,132 154,96 172,54" at={3.2} dur={1.4} w={3.4} color={LIME} />
    <Blob cx={172} cy={54} r={5.5} at={4.5} color={LIME} />
  </>
);

/* ═══════════════════════════════════════════════════ 266.8  the spike, and the flat that follows */
export const SpikeThenFlat: React.FC = () => (
  <>
    <Ink d="M26,150 C40,150 46,58 58,50" at={0.3} dur={0.5} w={3.4} color={LIME} />
    <Ink d="M58,50 C70,58 74,158 88,160" at={0.85} dur={0.5} w={3.4} color={LIME} />
    <Ink d="M88,160 L176,161" at={1.5} dur={3.2} w={3} color={SILVER_MID} />
  </>
);

/* ═══════════════════════════════════════════════════ 323.4  everyone is addicted — so nobody competes */
export const CrowdShaded: React.FC = () => {
  const t = useT();
  const N = 30, clear = [11, 23];
  const filled = Math.floor(ip(t, 0.5, 3.8, 0, N + 0.999));
  const ring = clamp01(ip(t, 4.3, 4.9));
  return (
    <>
      {Array.from({ length: N }).map((_, i) => {
        const x = 34 + (i % 6) * 22, y = 52 + Math.floor(i / 6) * 30;
        const isClear = clear.includes(i);
        const on = i < filled;
        const body = `M${x - 8},${y + 17} C${x - 8},${y + 3} ${x + 8},${y + 3} ${x + 8},${y + 17}`;
        if (isClear) return (
          <g key={i}>
            <circle cx={x} cy={y - 2} r={6} fill="none" stroke={WHITE} strokeWidth={2.2} opacity={on ? 1 : 0} />
            <Ink d={body} at={0.5 + (3.3 * i) / N} dur={0.16} w={2.2} color={WHITE} />
            {ring > 0.01 && <circle cx={x} cy={y + 4} r={17 * ring} fill="none" stroke={LIME} strokeWidth={3} />}
          </g>
        );
        return (
          <g key={i} opacity={on ? 1 : 0}>
            <circle cx={x} cy={y - 2} r={6} fill={SILVER_MID} />
            <path d={`${body} Z`} fill={SILVER_MID} />
          </g>
        );
      })}
    </>
  );
};

/* ═══════════════════════════════════════════════════ 342.1  joy in the boring stuff */
export const ChoreSpark: React.FC = () => {
  const t = useT();
  const sc = ip(t, 2.2, 2.45, 0, 1, EASE_OVER);
  return (
    <>
      <Ink d="M50,120 A50,50 0 0,0 150,120" at={0} dur={0.7} w={2.6} />
      <Ink d="M62,120 A38,38 0 0,0 138,120" at={0.6} dur={0.5} w={1.8} color={SILVER_MID} />
      <Ink d="M40,120 L160,121" at={1.0} dur={0.35} w={2} color={SILVER_MID} />
      <g opacity={sc} transform={`translate(146,58) scale(${0.5 + 0.5 * sc}) translate(-146,-58)`}>
        <Ink d="M146,40 L146,76" at={2.2} dur={0.16} w={3} color={LIME} />
        <Ink d="M128,58 L164,58" at={2.26} dur={0.16} w={3} color={LIME} />
        <Ink d="M134,46 L158,70" at={2.32} dur={0.16} w={2.4} color={LIME} />
        <Ink d="M158,46 L134,70" at={2.38} dur={0.16} w={2.4} color={LIME} />
      </g>
    </>
  );
};

/* ═══════════════════════════════════════════════════ 372.1  I get the irony */
export const PlayMirror: React.FC = () => (
  <>
    <Ink d="M30,58 L170,61 L167,150 L27,147 Z" at={0} dur={0.55} />
    <Ink d="M84,84 L84,124 L120,104 Z" at={0.6} dur={0.5} w={2.8} />
    {/* ...which contains this video, which contains this video */}
    <Ink d="M74,92 L74,116 L96,104 Z" at={1.6} dur={0.4} w={2.2} color={SILVER_MID} />
    <Ink d="M69,97 L69,111 L82,104 Z" at={2.3} dur={0.35} w={2} color={LIME} />
  </>
);

/* ═══════════════════════════════════════════════════ the THROUGH-LINE — one line, six lives */
export type LineState = "PLANTED" | "BENT" | "SEVERED" | "CUT" | "REDRAWN" | "BRANCHED";

/**
 * THE ATTENTION LINE. One stroke leaving your head; whatever it lands on is what grows.
 * Six disjoint windows across the film — it returns and has changed, it is never wallpaper.
 */
export const AttentionLine: React.FC<{ state: LineState }> = ({ state }) => {
  const t = useT();
  const HEAD = { x: 30, y: 62 };
  const head = (
    <>
      <Ink d="M18,86 L18,66 C10,60 9,46 16,38 C26,26 46,26 55,38 C63,48 60,64 51,70 L51,86" at={0} dur={0.55} w={2.4} />
      <Blob cx={34} cy={48} r={3} at={0.5} color={SILVER_MID} />
    </>
  );

  if (state === "PLANTED") return (
    <>
      {head}
      <Ink d="M56,58 L172,58" at={0.75} dur={1.5} w={3.2} color={LIME} />
      <Ink d="M172,40 L172,76" at={2.3} dur={0.25} w={2.4} color={LIME} />
      <Blob cx={172} cy={58} r={5} at={2.5} color={LIME} />
    </>
  );

  if (state === "BENT") {
    const bend = ip(t, 1.4, 2.6);
    return (
      <>
        {head}
        <path d={`M56,58 C${100 + 10 * bend},58 ${128 - 8 * bend},${58 + 22 * bend} ${130},${58 + 66 * bend}`}
          fill="none" stroke={LIME} strokeWidth={3.2} strokeLinecap="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(ip(t, 0.7, 2.0))} />
        <Ink d="M104,116 L160,118 L157,190 L101,188 Z" at={2.4} dur={0.5} w={2.4} />
        {[0, 1, 2].map((i) => {
          const q = clamp01((t - 3.1 - i * 0.4) / 1.0);
          return q > 0 ? <circle key={i} cx={118 + i * 16} cy={128 + q * 46} r={3.6} fill={LIME} opacity={(1 - q) * 0.9} /> : null;
        })}
      </>
    );
  }

  if (state === "SEVERED") {
    const gap = ip(t, 1.6, 3.0, 0, 1);
    return (
      <>
        {head}
        <Ink d="M56,58 L104,58" at={0.6} dur={0.7} w={3.2} color={LIME} />
        {/* 23 minutes are simply gone out of the middle of it */}
        <Ink d={`M${104 + 54 * gap},58 L172,58`} at={1.5} dur={0.5} w={3.2} color={SILVER_MID} opacity={1 - gap * 0.45} />
        {gap > 0.25 && <>
          <Ink d="M104,42 L104,74" at={2.0} dur={0.15} w={2} color={SILVER_MID} />
          <Ink d="M158,42 L158,74" at={2.1} dur={0.15} w={2} color={SILVER_MID} />
          <Num x={131} y={98} at={2.4} size={19} color={WHITE}>23 MIN</Num>
        </>}
      </>
    );
  }

  if (state === "CUT") {
    const fall = clamp01(ip(t, 1.9, 3.2));
    return (
      <>
        {head}
        <Ink d="M56,58 L112,58" at={0.4} dur={0.5} w={3.2} color={LIME} />
        <Ink d="M112,30 L112,86" at={1.7} dur={0.14} w={3} color={WHITE} />
        <g transform={`translate(0,${fall * 92}) rotate(${fall * 24} 116 58)`} opacity={1 - fall * 0.75}>
          <Ink d="M116,58 L176,58" at={0.55} dur={0.5} w={3.2} color={SILVER_MID} />
        </g>
      </>
    );
  }

  if (state === "REDRAWN") return (
    <>
      {head}
      <Ink d="M56,58 L150,58" at={0.9} dur={2.2} w={3.4} color={LIME} />
      {[34, 24, 14].map((r, i) => (
        <circle key={i} cx={166} cy={58} r={r} fill="none" stroke={i === 2 ? LIME : SILVER_MID}
          strokeWidth={i === 2 ? 2.6 : 2} opacity={clamp01(ip(t, 1.1 + i * 0.3, 1.5 + i * 0.3))} />
      ))}
      <Blob cx={166} cy={58} r={6} at={3.4} color={LIME} />
    </>
  );

  // BRANCHED — money, body, family
  return (
    <>
      {head}
      <Ink d="M56,58 L104,58" at={0.5} dur={0.7} w={3.2} color={LIME} />
      <Ink d="M104,58 C130,58 136,36 160,30" at={1.3} dur={0.7} w={2.8} color={LIME} />
      <Ink d="M104,58 L160,58" at={1.6} dur={0.7} w={2.8} color={LIME} />
      <Ink d="M104,58 C130,58 136,82 160,88" at={1.9} dur={0.7} w={2.8} color={LIME} />
      {/* money */}
      <Ink d="M178,22 A10,10 0 1,0 178,38" at={2.5} dur={0.35} w={2.4} />
      <Ink d="M166,27 L179,27" at={2.7} dur={0.12} w={2} />
      <Ink d="M166,33 L179,33" at={2.76} dur={0.12} w={2} />
      {/* body */}
      <Ink d="M170,51 L170,65" at={2.90} dur={0.12} w={5} />
      <Ink d="M184,51 L184,65" at={2.96} dur={0.12} w={5} />
      <Ink d="M165,55 L165,61" at={3.02} dur={0.10} w={3} />
      <Ink d="M189,55 L189,61" at={3.06} dur={0.10} w={3} />
      <Ink d="M170,58 L184,58" at={3.10} dur={0.12} w={2.2} />
      {/* family */}
      <Ink d="M168,100 C168,90 178,90 178,100" at={3.2} dur={0.2} w={2.4} />
      <Ink d="M182,100 C182,92 190,92 190,100" at={3.3} dur={0.2} w={2.4} />
      <Blob cx={173} cy={82} r={4.2} at={3.2} color={SILVER} />
      <Blob cx={186} cy={85} r={3.4} at={3.3} color={SILVER} />
    </>
  );
};
