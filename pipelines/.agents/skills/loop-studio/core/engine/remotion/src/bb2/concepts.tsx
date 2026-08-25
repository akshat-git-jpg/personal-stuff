/**
 * concepts.tsx — enacted concept illustrations for Act 1 (Motion Grammar v2, legibility rules).
 * Each DOES its idea and reads in <1s: folder of md files, the database that holds what the file
 * couldn't, numbers moving, big stats, crossed-out fixes, frozen-vs-alive.
 */
import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import {
  clamp01, EASE_OVER, useAmbient,
  RAISIN, RAISIN_DEEP, STEEL, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  PANEL_DEEP, PANEL, PANEL_RAISED, PANEL_HI, CARD, BORDER, PAPER, PAPER_HI, PAPER_MID, OLIVE,
} from "./scene";

/* small markdown-file chip: icon + filename */
export const FileChip: React.FC<{ u: number; name: string; on: number; accent?: boolean }> = ({ u, name, on, accent }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.5, opacity: on, transform: `translateY(${(1 - on) * u}px) scale(${0.85 + 0.15 * on})` }}>
    <svg width={u * 5.4} height={u * 6.6} viewBox="0 0 27 33">
      <path d="M2 2 h16 l7 7 v22 h-23 z" fill={PANEL_DEEP} stroke={accent ? LIME : SILVER} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M18 2 v7 h7" fill="none" stroke={accent ? LIME : SILVER} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M6 15 h15 M6 19 h15 M6 23 h10" stroke={SILVER_MID} strokeWidth={0.9} />
    </svg>
    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: accent ? LIME : SILVER_SOFT, whiteSpace: "nowrap" }}>{name}</span>
  </div>
);

/* ---- shared window chrome: instantly reads as a real app window ---- */
export const Win: React.FC<{ u: number; w: number; title: string; children: React.ReactNode; accent?: boolean; light?: boolean }> = ({ u, w, title, children, accent, light }) => (
  <div style={{ position: "relative", width: u * w }}>
    {accent && <div style={{ position: "absolute", inset: 0, background: light ? RAISIN : LIME, borderRadius: u * 0.9, transform: `translate(${u * 0.7}px,${u * 0.7}px)`, opacity: light ? 0.9 : 0.85 }} />}
    <div style={{ position: "relative", background: light ? WHITE : PANEL_DEEP, border: `${u * 0.12}px solid ${accent ? (light ? RAISIN : LIME) : light ? RAISIN : CARD}`, borderRadius: u * 0.9, overflow: "hidden", boxShadow: light ? `0 ${u * 1.0}px ${u * 2.6}px rgba(15,18,26,0.18)` : `0 ${u * 1.4}px ${u * 3.4}px rgba(0,0,0,0.6)` }}>
      <div style={{ height: u * 2.6, background: light ? PAPER_HI : PANEL, borderBottom: `${u * 0.09}px solid ${light ? PAPER_MID : PANEL_HI}`, display: "flex", alignItems: "center", gap: u * 0.55, padding: `0 ${u * 1.1}px` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.72, height: u * 0.72, borderRadius: "50%", background: i === 2 && accent ? (light ? RAISIN : LIME) : light ? SILVER_SOFT : BORDER }} />)}
        {title.trimEnd().endsWith("/") ? <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 1.5, height: u * 1.5, marginLeft: u * 0.5 }} />
          : title.includes(".md") ? <Img src={staticFile(light ? "logos/markdown-dark.svg" : "logos/markdown-silver.svg")} style={{ width: u * 1.5, height: u * 0.93, marginLeft: u * 0.5 }} /> : null}
        <span style={{ marginLeft: title.trimEnd().endsWith("/") || title.includes(".md") ? u * 0.2 : u * 0.7, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.04em", color: light ? BODY : SILVER_SOFT, whiteSpace: "nowrap" }}>{title}</span>
      </div>
      {children}
    </div>
  </div>
);

/* BEAT 6 — a folder of markdown files: a REAL file-browser window, then a REAL dashboard window */
export const FolderOfFiles: React.FC<{ u: number; t: number; t0: number; headlineOutAt?: number; light?: boolean }> = ({ u, t, t0, headlineOutAt, light }) => {
  const on = (at: number, d = 0.45) => clamp01((t - t0 - at) / d);
  const headOut = headlineOutAt ? 1 - clamp01((t - headlineOutAt) / 0.4) : 1;
  const rows = [
    { icon: "md", name: "me.md", meta: "who you are", at: 1.0 },
    { icon: "md", name: "business.md", meta: "what you sell", at: 2.4 },
    { icon: "md", name: "priorities.md", meta: "this quarter", at: 4.4 },
    { icon: "dir", name: "skills/", meta: "12 recipes", at: 6.6 },
  ];
  const dash = on(9.0, 0.5);
  const chartDraw = clamp01((t - t0 - 9.5) / 0.9);
  const barVals = [0.45, 0.7, 0.55, 0.85, 0.65];
  const acc = light ? OLIVE : LIME; // lime reads on dark; olive-ink substitute on the white worksheet
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: "50%", top: "14%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.2, color: light ? RAISIN : SILVER, textTransform: "uppercase", opacity: on(0.1) * headOut }}>A FOLDER OF TEXT FILES</div>

      {/* file-browser window */}
      <div style={{ position: "absolute", left: "33%", top: "55%", transform: `translate(-50%,-50%) translateY(${(1 - on(0.3)) * u * 1.5}px)`, opacity: on(0.3) }}>
        <Win u={u} w={40} title="my-second-brain/" light={light}>
          <div style={{ padding: `${u * 0.6}px 0` }}>
            {rows.map((r, i) => {
              const o = on(r.at);
              return (
                <div key={i} style={{ height: u * 4.4, display: "flex", alignItems: "center", gap: u * 1.1, padding: `0 ${u * 1.4}px`, borderBottom: i < rows.length - 1 ? `${u * 0.07}px solid ${PANEL_RAISED}` : "none", opacity: o, transform: `translateX(${(1 - o) * u * 1.2}px)` }}>
                  {r.icon === "md" ? (
                    <Img src={staticFile(light ? "logos/markdown-dark.svg" : "logos/markdown-silver.svg")} style={{ width: u * 2.5, height: u * 1.55, flexShrink: 0 }} />
                  ) : (
                    <Img src={staticFile("logos/folder-macos.png")} style={{ width: u * 2.6, height: u * 2.6, flexShrink: 0 }} />
                  )}
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.45, color: light ? RAISIN : SILVER, flex: 1 }}>{r.name}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.05, color: light ? BODY : SILVER_MID }}>{r.meta}</span>
                </div>
              );
            })}
          </div>
        </Win>
      </div>

      {/* dashboard window — unmistakably a dashboard: stat tiles + line chart + bars */}
      <div style={{ position: "absolute", left: "72%", top: "58%", transform: `translate(-50%,-50%) translateY(${(1 - dash) * u * 2}px)`, opacity: dash }}>
        <Win u={u} w={30} title="dashboard" accent light={light}>
          <div style={{ padding: u * 1.2, display: "flex", flexDirection: "column", gap: u * 1.0 }}>
            <div style={{ display: "flex", gap: u * 1.0 }}>
              {[{ v: "€18,940", l: "REVENUE", lime: true }, { v: "27", l: "LEADS", lime: false }].map((s, i) => (
                <div key={i} style={{ flex: 1, background: light ? PAPER : PANEL, borderRadius: u * 0.5, padding: `${u * 0.7}px ${u * 0.9}px` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.4 }}>
                    <Img src={staticFile(s.lime ? (light ? "logos/lucide-banknote-dark.svg" : "logos/lucide-banknote-lime.svg") : "logos/lucide-users-dim.svg")} style={{ width: u * 1.0, height: u * 1.0 }} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.8, letterSpacing: "0.12em", color: light ? BODY : SILVER_MID }}>{s.l}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.7, color: s.lime ? (light ? OLIVE : LIME) : (light ? RAISIN : SILVER), fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: light ? PAPER : PANEL, borderRadius: u * 0.5, padding: u * 0.8 }}>
              <svg width={u * 25} height={u * 5.6} viewBox="0 0 100 22">
                <path d="M2 19 L18 15 L34 16.5 L50 10 L66 11.5 L82 5 L98 2.5" fill="none" stroke={acc} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={120} strokeDashoffset={120 * (1 - chartDraw)} />
                <circle cx={98} cy={2.5} r={2} fill={acc} opacity={chartDraw} />
              </svg>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: u * 0.55, height: u * 3.4, padding: `0 ${u * 0.3}px` }}>
              {barVals.map((h, i) => {
                const bo = clamp01((t - t0 - 9.8 - i * 0.12) / 0.4);
                return <div key={i} style={{ flex: 1, height: `${h * 100 * bo}%`, background: i === 3 ? acc : CARD, borderRadius: `${u * 0.2}px ${u * 0.2}px 0 0` }} />;
              })}
            </div>
          </div>
        </Win>
      </div>
    </div>
  );
};

/* BEAT 16 — the DATABASE: a queue of event cards visibly flies IN, and each arrival becomes a row.
   Label + counter live BELOW the cylinder with hard clearance (no text on graphics, ever). */
export const DatabaseHolds: React.FC<{ u: number; t: number; t0: number; W: number; H: number }> = ({ u, t, t0, W, H }) => {
  const lt = t - t0;
  const draw = clamp01(lt / 0.7);
  const feeders = ["new order #4471", "payout €3,900", "DM: still there?", "5★ review", "€1,240 paid"];
  const FLY = 0.85; // flight duration
  const starts = feeders.map((_, i) => 1.3 + i * 1.1);
  const arrivals = starts.map((s) => s + FLY);
  const rows = arrivals.filter((a) => lt >= a).length;
  const baseRows = 4808;
  const cx = 63, cy = 46; // cylinder center %
  const S = u * 0.95;     // cylinder scale
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: "50%", top: "13%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.4, color: SILVER, textTransform: "uppercase", opacity: draw }}>
        DATABASES EXIST FOR THIS
      </div>
      {/* waiting queue (left) — the events that need a home */}
      {feeders.map((label, i) => {
        const p = clamp01((lt - starts[i]) / FLY);
        const settled = clamp01((lt - 0.5 - i * 0.12) / 0.4); // queue pop-in
        if (settled <= 0 || p >= 1) return null;
        // queue slot → arc to the cylinder mouth
        const qx = 17, qy = 30 + i * 8.5;
        const ex = cx, ey = cy - 13 * S / (H / 100) * 1.0; // mouth
        const mx = (qx + ex) / 2, my = Math.min(qy, ey) - 10;
        const bz = (a: number, b: number, c: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;
        const x = p > 0 ? bz(qx, mx, ex) : qx;
        const y = p > 0 ? bz(qy, my, ey) : qy;
        return (
          <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${(0.9 + 0.1 * settled) * (1 - p * 0.45)})`, opacity: settled * (1 - clamp01((p - 0.8) / 0.2)) }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.4}px,${u * 0.4}px)`, opacity: 0.9 }} />
              <div style={{ position: "relative", background: RAISIN_DEEP, border: `${u * 0.11}px solid ${LIME}`, borderRadius: u * 0.5, padding: `${u * 0.5}px ${u * 1.0}px`, fontFamily: SANS, fontWeight: 600, fontSize: u * 1.3, color: SILVER, whiteSpace: "nowrap" }}>{label}</div>
            </div>
          </div>
        );
      })}
      {/* the cylinder */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${cx / 100 * W} ${cy / 100 * H}) scale(${S})`}>
          <g fill="none" stroke={LIME} strokeWidth={0.5} strokeLinecap="round">
            <path d="M-11 -13 a11 4 0 1 0 22 0 a11 4 0 1 0 -22 0" strokeDasharray={90} strokeDashoffset={90 * (1 - draw)} />
            <path d="M-11 -13 L-11 13" strokeDasharray={26} strokeDashoffset={26 * (1 - draw)} />
            <path d="M11 -13 L11 13" strokeDasharray={26} strokeDashoffset={26 * (1 - draw)} />
            <path d="M-11 13 a11 4 0 0 0 22 0" strokeDasharray={40} strokeDashoffset={40 * (1 - draw)} />
          </g>
          {/* rows stack bottom-up, one per arrival; flash on land */}
          {Array.from({ length: rows }).map((_, i) => {
            const age = lt - arrivals[i];
            const flash = 1 - clamp01(age / 0.35);
            return <rect key={i} x={-8.5} y={9.5 - i * 2.9} width={17} height={1.9} rx={0.5} fill={LIME} opacity={0.16 + flash * 0.5} />;
          })}
        </g>
      </svg>
      {/* label + tabular counter BELOW the cylinder (hard clearance from the bottom rim) */}
      <div style={{ position: "absolute", left: `${cx}%`, top: "83.5%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: draw }}>
        <div style={{ display: "flex", alignItems: "center", gap: u * 0.55, justifyContent: "center" }}>
          <Img src={staticFile("logos/supabase.svg")} style={{ width: u * 1.35, height: u * 1.35 }} />
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.14em", color: SILVER }}>DATABASE</span>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 2.1, color: SILVER, fontVariantNumeric: "tabular-nums" }}>{(baseRows + rows).toLocaleString("en-US")} rows</div>
      </div>
    </div>
  );
};

/* BEAT 10 — numbers moving: four fixed stat tiles, tabular digits, static drawn-once sparklines.
   NO layout shift: tiles are absolute + fixed width; digits are mono tabular; sparkline path is
   constant (dash-revealed once) — the old version derived the path from the live value = flicker. */
export const NumbersMove: React.FC<{ u: number; t: number; t0: number }> = ({ u, t, t0 }) => {
  const lt = t - t0;
  const metrics = [
    { label: "REVENUE", icon: "lucide-banknote-lime.svg", fmt: (v: number) => `€${Math.floor(v).toLocaleString("en-US")}`, from: 11200, to: 18940, at: 0.3, x: 15.5, spark: "M2 14 L15 11.5 L28 12.5 L41 8 L54 6.5 L67 3.5", lime: true },
    { label: "INQUIRIES", icon: "lucide-message-circle-dim.svg", fmt: (v: number) => `+${Math.floor(v)}`, from: 3, to: 27, at: 1.3, x: 38.5, spark: "M2 14 L15 12 L28 9.5 L41 10.5 L54 6 L67 4", lime: false },
    { label: "CONVERSATIONS", icon: "lucide-users-dim.svg", fmt: (v: number) => `${Math.floor(v)}`, from: 8, to: 64, at: 2.3, x: 61.5, spark: "M2 13 L15 12.5 L28 10 L41 7.5 L54 8 L67 3", lime: false },
    { label: "CONTENT OUT", icon: "lucide-trending-up-dim.svg", fmt: (v: number) => `${Math.floor(v)}`, from: 1, to: 9, at: 3.3, x: 84.5, spark: "M2 14 L15 13 L28 11 L41 9.5 L54 5.5 L67 4.5", lime: false },
  ];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {metrics.map((m, i) => {
        const on = clamp01((lt - m.at) / 0.5);
        if (on <= 0) return null;
        const v = interpolate(lt, [m.at + 0.3, m.at + 6.5], [m.from, m.to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const sparkDraw = clamp01((lt - m.at - 0.4) / 1.0);
        return (
          <div key={i} style={{ position: "absolute", left: `${m.x}%`, top: "52%", width: u * 20, transform: `translate(-50%,-50%) translateY(${(1 - on) * u * 1.5}px)`, opacity: on }}>
            <div style={{ background: PANEL_DEEP, border: `${u * 0.11}px solid ${m.lime ? LIME : CARD}`, borderRadius: u * 0.8, padding: `${u * 1.2}px ${u * 1.4}px`, boxShadow: `0 ${u * 1}px ${u * 2.6}px rgba(0,0,0,0.55)`, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: u * 0.5 }}>
                <Img src={staticFile(`logos/${m.icon}`)} style={{ width: u * 1.25, height: u * 1.25 }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.16em", color: SILVER_MID, whiteSpace: "nowrap" }}>{m.label}</span>
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 2.9, color: m.lime ? LIME : SILVER, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                <span style={{ color: LIME, marginRight: u * 0.35 }}>↑</span>{m.fmt(v)}
              </div>
              <svg width={u * 14} height={u * 3.4} viewBox="0 0 69 17">
                <path d={m.spark} fill="none" stroke={m.lime ? LIME : SILVER_MID} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={80} strokeDashoffset={80 * (1 - sparkDraw)} opacity={0.9} />
                <circle cx={67} cy={parseFloat(m.spark.split("L").pop()!.trim().split(" ")[1])} r={1.9} fill={LIME} opacity={sparkDraw} />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* big stat word (FOREVER?, 1 WEEKEND) — UPRIGHT Space Grotesk on a real lime plate.
   The plate is a padded box CONTAINING its raisin text; both reveal together via one clip-path,
   so glyphs can never overflow the plate and there is never dark-on-dark ghost text. */
export const StatBig: React.FC<{ u: number; t: number; t0: number; value: string; label?: string; labelParts?: { text: string; at: number }[]; sub?: string; valueAt?: number; subAt?: number }> = ({ u, t, t0, value, label, labelParts, sub, valueAt = 0.5, subAt }) => {
  const lt = t - t0;
  const reveal = clamp01((lt - valueAt) / 0.5);
  const pop = interpolate(clamp01((lt - valueAt) / 0.6), [0, 1], [0.94, 1], { easing: EASE_OVER });
  const fs = value.length > 8 ? 7.2 : value.length > 6 ? 9 : 11.5;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 2.2 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: u * 0.9, opacity: labelParts ? 1 : clamp01(lt / 0.4) }}>
        <span style={{ width: u * 0.85, height: u * 0.85, background: LIME, opacity: labelParts ? clamp01((lt - labelParts[0].at) / 0.3) : 1 }} />
        {labelParts
          ? labelParts.map((p, i) => <span key={i} style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.18em", color: SILVER_MID, opacity: clamp01((lt - p.at) / 0.35), marginRight: u * 0.5 }}>{p.text}</span>)
          : <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.18em", color: SILVER_MID }}>{label}</span>}
      </div>
      <div style={{ transform: `scale(${pop})`, clipPath: `inset(-6% ${(1 - reveal) * 102 - 1}% -6% -1%)` }}>
        <div style={{ background: LIME, padding: `${u * 0.7}px ${u * 1.8}px`, borderRadius: u * 0.3, transform: "rotate(-1.2deg)" }}>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * fs, color: RAISIN, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap", textTransform: "uppercase", display: "block" }}>{value}</span>
        </div>
      </div>
      {sub && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.3, color: SILVER_SOFT, opacity: clamp01((lt - (subAt ?? valueAt + 1.0)) / 0.5) }}>{sub}</div>}
    </div>
  );
};
