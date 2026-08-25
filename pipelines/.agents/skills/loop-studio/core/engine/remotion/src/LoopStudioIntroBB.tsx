/**
 * LoopStudioIntroBB — the masterclass intro in the Business Brain visual language.
 * Built from bb2/design_loopstudio.json. TWO registers (DarkBg tension / LightBg solution,
 * crossfade on the turn), ONE lime accent with the two-layer Marker wipe on one word per beat,
 * ENACTED concepts (real app windows, a struck timeline, a price stat, a crazy curve), and the
 * talking head composited INTO the world via FootageLayer (full → panel → hidden).
 * Voice from loopstudio/vo.m4a; SFX/music in post. Imports the CANONICAL bb2 system.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import {
  clamp01, lerp, EASE, EASE_OVER,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF,
  SK, skf, FootageLayer, Marker, DarkBg, LightBg,
} from "./bb2/scene";
import { Win } from "./bb2/concepts";

const FPS = 30;
const SRC = "loopstudio/cut.mp4";

/* ---------- ink-aware headline with Marker ---------- */
// Headlines render BOTTOM-MIDDLE by default (feedback v4). `top` moves it to the upper band for
// beats where the bottom is occupied (e.g. the TV-room couch) so it never overlaps an item (feedback v5).
const HL: React.FC<{ u: number; t: number; at: number; out?: number; ink: string; y?: string; x?: string; size?: number; center?: boolean; top?: boolean; children: React.ReactNode }> =
  ({ u, t, at, out, ink, size = 2.9, top, children }) => (
    <div style={{ position: "absolute", left: "50%", top: top ? "11%" : "88%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.02em", color: ink, textTransform: "uppercase", textShadow: "0 2px 18px rgba(0,0,0,0.7)", opacity: clamp01((t - at) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1) }}>{children}</div>
  );

const Eyebrow: React.FC<{ u: number; t: number; at: number; ink: string; x?: string; y?: string; children: React.ReactNode }> =
  ({ u, t, at, ink, x = "6%", y = "8.5%", children }) => (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: u * 0.6, opacity: clamp01((t - at) / 0.35), fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em", color: ink === RAISIN ? BODY : SILVER_MID }}>
      <span style={{ width: u * 0.75, height: u * 0.75, background: LIME }} />{children}
    </div>
  );

/* ---------- a real app window: player frame body ---------- */
const PlayerBody: React.FC<{ u: number; live?: boolean; final?: boolean; tc: string }> = ({ u, live, final, tc }) => (
  <div style={{ position: "relative", height: u * 15, background: `linear-gradient(135deg, ${RAISIN}, #1a2030 62%, #232b40)`, overflow: "hidden" }}>
    <div style={{ position: "absolute", left: "50%", top: "48%", transform: "translate(-50%,-50%)", width: u * 5.4, height: u * 5.4, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: `${u * 0.18}px solid rgba(255,255,255,0.55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 0, height: 0, borderLeft: `${u * 1.7}px solid #fff`, borderTop: `${u * 1.0}px solid transparent`, borderBottom: `${u * 1.0}px solid transparent`, marginLeft: u * 0.5 }} />
    </div>
    <div style={{ position: "absolute", left: u * 1.2, bottom: u * 1.0, right: u * 1.2, display: "flex", alignItems: "center", gap: u * 0.8 }}>
      <div style={{ flex: 1, height: u * 0.5, borderRadius: u * 0.3, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
        <div style={{ width: final ? "100%" : "16%", height: "100%", background: LIME }} />
      </div>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, color: final ? LIME : "#fff" }}>{tc}</span>
    </div>
    {live && (
      <div style={{ position: "absolute", left: u * 1.2, top: u * 1.0, display: "flex", alignItems: "center", gap: u * 0.5, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.12em", color: "#fff" }}>
        <span style={{ width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: LIME }} /> LIVE
      </div>
    )}
  </div>
);

/* ---------- the FINAL CUT: the PUBLISHED, polished result — kept CLEAN (feedback v10:
   "too messy, too many texts"). Just the graded real clip + a play affordance + a clean
   progress bar, and ONE payoff line below: ✓ PUBLISHED · views. No captions/lower-third/
   b-roll/window clutter. ---------- */
const FinalCutFrame: React.FC<{ u: number; t: number; light: boolean }> = ({ u, t, light }) => {
  const views = Math.round(lerp(0, 48213, clamp01((t - 13.5) / 1.2)));
  const viewStr = views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const pub = clamp01((t - 13.75) / 0.35);
  const VW = u * 40, VH = VW * 9 / 16;
  return (
    <div style={{ position: "relative" }}>
      {/* the finished video (16:9), cinematic grade — the real clip */}
      <div style={{ position: "relative", width: VW, height: VH, borderRadius: u * 0.5, overflow: "hidden", boxShadow: `0 ${u * 1.2}px ${u * 3.4}px rgba(0,0,0,0.55)` }}>
        <OffthreadVideo src={staticFile("loopstudio/cut.mp4")} startFrom={330} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.08) saturate(1.12) brightness(1.03)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(20,60,90,0.14), transparent 48%, rgba(70,45,10,0.14))", mixBlendMode: "soft-light" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 82% 78% at 50% 44%, transparent 58%, rgba(0,0,0,0.38) 100%)" }} />
        {/* a clean play affordance */}
        <div style={{ position: "absolute", left: "50%", top: "45%", transform: "translate(-50%,-50%)", width: u * 5.6, height: u * 5.6, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: `${u * 0.18}px solid rgba(255,255,255,0.78)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderLeft: `${u * 1.8}px solid #fff`, borderTop: `${u * 1.05}px solid transparent`, borderBottom: `${u * 1.05}px solid transparent`, marginLeft: u * 0.55 }} />
        </div>
        {/* a clean progress bar — no ticks, no text */}
        <div style={{ position: "absolute", left: u * 0.9, right: u * 0.9, bottom: u * 0.9, height: u * 0.4, borderRadius: u * 0.2, background: "rgba(255,255,255,0.26)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "72%", background: LIME, borderRadius: u * 0.2 }} />
          <div style={{ position: "absolute", left: "72%", top: "50%", transform: "translate(-50%,-50%)", width: u * 0.9, height: u * 0.9, borderRadius: "50%", background: "#fff", boxShadow: `0 0 ${u * 0.4}px rgba(0,0,0,0.4)` }} />
        </div>
      </div>
      {/* ONE payoff line — the finished piece is out in the world */}
      <div style={{ marginTop: u * 1.2, display: "flex", alignItems: "center", gap: u * 1.0, opacity: pub }}>
        <div style={{ display: "flex", alignItems: "center", gap: u * 0.5, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, color: RAISIN, background: LIME, padding: `${u * 0.32}px ${u * 1.1}px`, borderRadius: u * 0.4 }}>
          <svg width={u * 1.6} height={u * 1.6} viewBox="0 0 24 24" fill="none" stroke={RAISIN} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          PUBLISHED
        </div>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.55, color: light ? "#4a5058" : SILVER }}>{viewStr} views</span>
      </div>
    </div>
  );
};

export const LoopStudioIntroBB: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  /* ---- head framing: full (hook) → panel (turn/scope/mech) → hidden (note) → hidden (cost)
          → panel (tease) → hidden (crazy/button) ---- */
  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 1.5, x: 50, y: 45, s: 0.92, dim: 0.05, fr: 1 },    // HOOK: pull back to a hero card — the rig assembles around him
    { t: 6.2, x: 50, y: 45, s: 0.92, dim: 0.05, fr: 1 },
    { t: 7.1, x: 50, y: 50, s: 1, dim: 1, fr: 1 },          // TURN: head hidden — the TV scene is the focus
    { t: 10.4, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 11.0, x: 73, y: 52, s: 0.94, dim: 0.06, fr: 1 },   // SCOPE: head returns to panel
    { t: 14.3, x: 73, y: 52, s: 0.94, dim: 0.06, fr: 1 },
    { t: 15.0, x: 50, y: 50, s: 1, dim: 1, fr: 1 },         // MECH: head hidden — the editor scene
    { t: 27.7, x: 50, y: 50, s: 1, dim: 1, fr: 1 },         // COST hidden
    { t: 28.4, x: 73, y: 52, s: 0.94, dim: 0.06, fr: 1 },   // TEASE: face returns briefly
    { t: 29.4, x: 73, y: 52, s: 0.94, dim: 0.06, fr: 1 },
    { t: 30.0, x: 50, y: 50, s: 1, dim: 1, fr: 1 },         // hide face — the opportunity reveal owns the frame (feedback v4)
    { t: 33.1, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
    { t: 33.7, x: 50, y: 50, s: 1, dim: 1, fr: 1 },         // CRAZY + BUTTON hidden
    { t: 37.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
  ];
  const sk = skf(SKF, frame);
  const graphicsOn = clamp01((sk.fr - 0.2) * 1.5);

  /* ---- register: DARK through the moody TV-room turn, LIGHT for the cut + mechanism ---- */
  const liteWins: [number, number][] = [[10.5, 22.2]];
  const lite = Math.max(...liteWins.map(([a, b]) => clamp01((t - a) / 0.5) * (1 - clamp01((t - b) / 0.5))), 0);
  const ink = lite > 0.5 ? RAISIN : SILVER;

  // soft lime bloom as the closing plate lands — replaces the harsh white flash (feedback v2)
  const bloom = interpolate(frame, [FPS * 36.15, FPS * 36.55, FPS * 37.5], [0, 0.5, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden", fontFamily: SANS }}>
      <Audio src={staticFile("loopstudio/vo.m4a")} />
      <DarkBg u={u} gridOpacity={Math.max(sk.fr, lite < 0.5 ? 0.5 : 0)} />
      <LightBg u={u} opacity={lite} />

      {/* HOOK assembly — the editing rig orbits BEHIND the head (back half of each ring) */}
      {t < 7.2 && <HookAssembly layer="back" t={t} u={u} W={W} H={H} />}

      {/* ================= THE HEAD, composited into the world (behind the graphics) ========= */}
      <FootageLayer sk={sk} u={u} src={SRC} />

      {/* HOOK assembly — the pieces that are IN FRONT of the head this frame */}
      {t < 7.2 && <HookAssembly layer="front" t={t} u={u} W={W} H={H} />}

      {/* ================= GRAPHICS WORLD ================= */}
      <div style={{ position: "absolute", inset: 0, opacity: Math.max(graphicsOn, t < 6.6 ? 1 : 0) }}>

        {/* B1 HOOK (0–5.06): the doubt headline over the assembling rig, Marker on CAN'T EDIT */}
        {t < 6.6 && (() => {
          const out = 1 - clamp01((t - 5.6) / 0.5);
          return (
            <div style={{ opacity: out }}>
              {/* eyebrow: the agent doing the work */}
              <div style={{ position: "absolute", left: "50%", top: "82%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 0.7, opacity: clamp01((t - 0.8) / 0.4) * (1 - clamp01((t - 5.2) / 0.4)) }}>
                <Img src={staticFile("logos/claude.svg")} style={{ width: u * 1.8, height: u * 1.8 }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em", color: SILVER_MID }}>claude code · assembling…</span>
              </div>
              {/* the doubt headline */}
              <div style={{ position: "absolute", left: "50%", top: "90%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 1.6) / 0.4), textShadow: "0 4px 30px rgba(0,0,0,0.85)" }}>
                THINK AI <Marker u={u} t={t} at={3.6} base={SILVER}>CAN&apos;T EDIT</Marker> THIS?
              </div>
            </div>
          );
        })()}

        {/* B2 TURN (5.36–10.36): the intro playing in a moody 3D living room, someone watching it. */}
        {t >= 6.4 && t < 10.7 && (() => {
          const on = clamp01((t - 6.6) / 0.5) * (1 - clamp01((t - 10.4) / 0.3));
          return (
            <div style={{ opacity: on }}>
              <TvRoom u={u} t={t} W={W} H={H} />
              <HL u={u} t={t} at={7.0} ink={RAISIN} size={3.0} top>BUILT <Marker u={u} t={t} at={7.0} base={RAISIN}>IN FRONT</Marker> OF YOU</HL>
              <div style={{ position: "absolute", left: "50%", top: "17.5%", transform: "translate(-50%,-50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.1, color: "#6a5f4c", opacity: clamp01((t - 8.3) / 0.5), whiteSpace: "nowrap", textShadow: "0 1px 10px rgba(255,255,255,0.5)" }}>
                the one you&apos;re watching right now.
              </div>
            </div>
          );
        })()}

        {/* B3 SCOPE (10.46–14.38): the CUT, enacted — 12 raw takes; Claude's playhead sweeps,
            retakes DROP away, keepers SNAP together into the final cut. */}
        {t >= 10.7 && t < 14.9 && (() => {
          const on = clamp01((t - 10.9) / 0.35) * (1 - clamp01((t - 14.5) / 0.3));
          const KEEP = [1, 3, 6, 8, 11];
          const isKeep = (i: number) => KEEP.includes(i);
          const dropAt = (i: number) => 11.5 + i * 0.10;
          const packT = clamp01((t - 12.95) / 0.4);
          const resolve = clamp01((t - 13.35) / 0.6);   // packed keepers → final player
          const cx = W * 0.30, baseY = H * 0.57, pitch = u * 3.9, bw = u * 3.3, bh = u * 4.4;
          const inkC = lite > 0.5 ? RAISIN : SILVER;
          const phX = interpolate(t, [11.35, 12.9], [cx + (-6.0) * pitch, cx + (6.0) * pitch], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={11.0} ink={ink} size={3.0} y="14%">RAW → FULLY <Marker u={u} t={t} at={13.6} base={ink}>EDITED</Marker></HL>
              <div style={{ position: "absolute", left: cx, top: baseY - u * 4.0, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.14em", color: lite > 0.5 ? BODY : SILVER_MID, transform: "translate(-50%,-50%)", whiteSpace: "nowrap", opacity: (1 - resolve) }}>raw-take.mp4 · 4:18 · 12 takes</div>
              {/* the 12 takes */}
              {!(resolve > 0.98) && Array.from({ length: 12 }).map((_, i) => {
                const keep = isKeep(i);
                const homeX = cx + (i - 5.5) * pitch;
                const appear = clamp01((t - 11.0 - i * 0.03) / 0.3);
                if (keep) {
                  const ko = KEEP.indexOf(i);
                  const packX = cx + (ko - 2) * pitch;
                  const x = lerp(homeX, packX, packT);
                  const lit = clamp01((t - dropAt(i)) / 0.2);
                  return (
                    <div key={i} style={{ position: "absolute", left: x, top: baseY, width: bw, height: bh, transform: `translate(-50%,-50%)`, opacity: appear * (1 - resolve), borderRadius: u * 0.4, overflow: "hidden", background: "linear-gradient(135deg,#0f121a,#1a2030 60%,#26304a)", border: `${u * 0.14}px solid ${lit > 0.5 ? LIME : (lite > 0.5 ? "#c3c9cd" : "#2b3242")}`, boxShadow: lit > 0.5 ? `0 0 ${u * 1.2}px ${LIME}88` : "none" }}>
                      <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", width: 0, height: 0, borderLeft: `${u * 0.8}px solid rgba(255,255,255,0.8)`, borderTop: `${u * 0.5}px solid transparent`, borderBottom: `${u * 0.5}px solid transparent` }} />
                      {lit > 0.4 && <span style={{ position: "absolute", right: u * 0.3, bottom: u * 0.15, fontFamily: MONO, fontWeight: 800, fontSize: u * 1.1, color: LIME }}>✓</span>}
                    </div>
                  );
                }
                const fall = clamp01((t - dropAt(i)) / 0.5);
                if (fall >= 1) return null;
                return (
                  <div key={i} style={{ position: "absolute", left: homeX, top: baseY + fall * fall * u * 20, width: bw, height: bh, transform: `translate(-50%,-50%) rotate(${fall * 14}deg)`, opacity: appear * (1 - fall), borderRadius: u * 0.4, background: lite > 0.5 ? "#e2e6e8" : "#161b26", border: `${u * 0.12}px solid ${lite > 0.5 ? "#c3c9cd" : "#2b3242"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 1.3, color: "#7a828e" }}>✕</span>
                  </div>
                );
              })}
              {/* Claude's playhead sweeping the strip */}
              {t < 13.0 && <div style={{ position: "absolute", left: phX, top: baseY, width: u * 0.16, height: bh * 1.5, transform: "translate(-50%,-50%)", background: LIME, boxShadow: `0 0 ${u * 1.0}px ${LIME}`, opacity: clamp01((t - 11.3) / 0.2) }} />}
              {/* the final cut — what a FULLY EDITED video actually looks like (feedback v2) */}
              <div style={{ position: "absolute", left: cx, top: baseY, transform: `translate(-50%,-50%) scale(${lerp(0.9, 1, resolve)})`, opacity: resolve }}>
                <Win u={u} w={42} title="final cut" accent light={lite > 0.5}>
                  <FinalCutFrame u={u} t={t} light={lite > 0.5} />
                </Win>
              </div>
            </div>
          );
        })()}

        {/* B4 MECH (14.68–21.84): the intimidating EDITOR is dismissed — you just TALK.
            A dense NLE fills the frame ("never open an editor / touch a timeline"), gets a lime
            ✕ and is shoved off; a mic + voice waveform ("just talk") resolves into a Claude note
            that re-renders. Wall-of-buttons → one spoken note. */}
        {t >= 14.9 && t < 22.3 && (() => {
          const on = clamp01((t - 15.1) / 0.4) * (1 - clamp01((t - 22.0) / 0.3));
          const edIn = interpolate(clamp01((t - 15.3) / 0.5), [0, 1], [0.9, 1], { easing: EASE_OVER });
          const dismiss = clamp01((t - 19.4) / 0.55);            // shove off AFTER the timeline clause lands
          const edVis = clamp01((t - 15.3) / 0.4) * (1 - dismiss);
          // cadence: the editor REACTS to each spoken clause instead of sitting static (feedback v2)
          const noStamp = clamp01((t - 16.92) / 0.26) * (1 - 0.35 * clamp01((t - 17.6) / 0.6)) * (1 - clamp01((t - 19.3) / 0.35)); // "open an editor"
          const flinch = Math.sin(clamp01((t - 16.92) / 0.55) * Math.PI) * (1 - clamp01((t - 18.0) / 0.3));                        // recoil nudge
          const tlHi = clamp01((t - 18.5) / 0.22) * (1 - clamp01((t - 19.35) / 0.3));    // "touch a timeline" highlight
          const tlX = clamp01((t - 18.64) / 0.24) * (1 - clamp01((t - 19.35) / 0.3));    // lime ✕ struck across the timeline
          const talk = clamp01((t - 19.9) / 0.5);
          const note = "› tighten the intro. add b-roll on the raw take. make it look good, bro.";
          const typed = clamp01((t - 20.55) / 1.05);
          const shown = note.slice(0, Math.round(note.length * typed));
          const noteIn = clamp01((t - 20.35) / 0.5);
          const talkVis = talk * (1 - clamp01((t - 20.5) / 0.4));
          const done = clamp01((t - 21.75) / 0.3);
          const cur = Math.floor(t * 2) % 2 === 0;
          const CLIP = ["#3c4f70", "#46506a", "#5a4a63"];
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={19.2} ink={ink} size={3.0} y="13%">NO TIMELINE — JUST <Marker u={u} t={t} at={21.5} base={ink}>NOTES</Marker></HL>

              {/* the dense editor — everything you'd have to touch */}
              {edVis > 0.01 && (
                <div style={{ position: "absolute", left: "50%", top: "56%", transform: `translate(-50%,-50%) translateX(${-dismiss * u * 42 + flinch * u * 1.8}px) scale(${edIn * (1 - dismiss * 0.14)}) rotate(${dismiss * -3 + flinch * 0.9}deg)`, opacity: edVis, filter: `grayscale(${dismiss})` }}>
                  <div style={{ width: u * 62, borderRadius: u * 0.9, overflow: "hidden", background: "#0f131b", border: `${u * 0.12}px solid #2a3145`, boxShadow: `0 ${u * 1.6}px ${u * 4}px rgba(0,0,0,0.55)` }}>
                    {/* title + menu */}
                    <div style={{ height: u * 2.6, background: "#171c28", display: "flex", alignItems: "center", gap: u * 0.5, padding: `0 ${u * 1.1}px`, borderBottom: `${u * 0.09}px solid #232a3a` }}>
                      {[0, 1, 2].map((i) => <span key={i} style={{ width: u * 0.62, height: u * 0.62, borderRadius: "50%", background: "#3a4256" }} />)}
                      <span style={{ marginLeft: u * 0.8, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.92, color: SILVER_MID }}>video-editor</span>
                      <div style={{ marginLeft: u * 1.4, display: "flex", gap: u * 1.2 }}>{["File", "Edit", "Clip", "Sequence", "Effects"].map((m) => <span key={m} style={{ fontFamily: SANS, fontSize: u * 0.82, color: "#5a6478" }}>{m}</span>)}</div>
                    </div>
                    {/* upper row: tools · monitor · effects */}
                    <div style={{ display: "flex", height: u * 17 }}>
                      <div style={{ width: u * 3.4, background: "#12161f", display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.7, padding: `${u * 0.8}px 0`, borderRight: `${u * 0.09}px solid #232a3a` }}>
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ width: u * 1.7, height: u * 1.7, borderRadius: u * 0.3, background: "#1e2534", border: `${u * 0.07}px solid #2c3547` }} />)}
                      </div>
                      <div style={{ flex: 1, padding: u * 0.9 }}>
                        <div style={{ width: "100%", height: "100%", borderRadius: u * 0.4, background: "linear-gradient(135deg,#0b0e14,#1a2030 60%,#243049)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 0, height: 0, borderLeft: `${u * 1.4}px solid rgba(255,255,255,0.6)`, borderTop: `${u * 0.85}px solid transparent`, borderBottom: `${u * 0.85}px solid transparent` }} />
                        </div>
                      </div>
                      <div style={{ width: u * 15, background: "#12161f", padding: u * 0.9, borderLeft: `${u * 0.09}px solid #232a3a` }}>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.78, letterSpacing: "0.14em", color: "#5a6478", marginBottom: u * 0.8 }}>EFFECT CONTROLS</div>
                        {["Scale", "Position", "Opacity", "Speed", "Lumetri"].map((s, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: u * 0.6, marginBottom: u * 0.7 }}>
                            <span style={{ fontFamily: SANS, fontSize: u * 0.82, color: "#6b7488", width: u * 4.4 }}>{s}</span>
                            <div style={{ flex: 1, height: u * 0.4, borderRadius: u * 0.2, background: "#242c3c", position: "relative" }}><div style={{ position: "absolute", left: `${25 + i * 12}%`, top: "50%", transform: "translate(-50%,-50%)", width: u * 0.8, height: u * 0.8, borderRadius: "50%", background: "#4a5568" }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* transport */}
                    <div style={{ height: u * 2.4, background: "#171c28", display: "flex", alignItems: "center", justifyContent: "center", gap: u * 1.2, borderTop: `${u * 0.09}px solid #232a3a` }}>
                      {["⏮", "◀", "⏸", "▶", "⏭"].map((g, i) => <span key={i} style={{ fontFamily: SANS, fontSize: u * 1.0, color: "#6b7488" }}>{g}</span>)}
                      <span style={{ fontFamily: MONO, fontSize: u * 0.9, color: SILVER_MID, marginLeft: u * 1.4 }}>00:00:12:04</span>
                    </div>
                    {/* timeline */}
                    <div style={{ background: "#0c1017", padding: `${u * 0.6}px ${u * 0.8}px`, position: "relative" }}>
                      <div style={{ display: "flex", gap: u * 0.3, marginBottom: u * 0.5, paddingLeft: u * 3.4 }}>
                        {Array.from({ length: 30 }).map((_, i) => <div key={i} style={{ flex: 1, height: u * 0.5, borderLeft: `${u * 0.06}px solid ${i % 5 === 0 ? "#3a4256" : "#20273400"}` }} />)}
                      </div>
                      {["V2", "V1", "A1", "A2"].map((tr, r) => (
                        <div key={tr} style={{ display: "flex", alignItems: "center", gap: u * 0.4, marginBottom: u * 0.4 }}>
                          <span style={{ fontFamily: MONO, fontSize: u * 0.72, color: "#5a6478", width: u * 3.0 }}>{tr}</span>
                          <div style={{ flex: 1, display: "flex", gap: u * 0.35, height: u * 1.7 }}>
                            {[[0, 3], [3.4, 2], [5.8, 4]].map(([off, w], ci) => <div key={ci} style={{ flex: w as number, borderRadius: u * 0.2, background: r < 2 ? CLIP[(r + ci) % 3] : "#2a3446", opacity: 0.9, marginLeft: off === 0 ? 0 : 0 }} />)}
                          </div>
                        </div>
                      ))}
                      {/* lime playhead */}
                      <div style={{ position: "absolute", left: "46%", top: u * 0.4, bottom: u * 0.4, width: u * 0.14, background: LIME, opacity: 0.9 }} />
                      {/* "never touch a timeline" — the whole timeline lights up + a lime ✕ */}
                      {tlHi > 0.01 && <div style={{ position: "absolute", inset: u * 0.3, borderRadius: u * 0.3, background: `${LIME}18`, border: `${u * 0.16}px solid ${LIME}`, opacity: tlHi, pointerEvents: "none" }} />}
                      {tlX > 0.01 && <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${0.7 + tlX * 0.3})`, opacity: tlX, fontFamily: SANS, fontWeight: 800, fontSize: u * 5.5, color: LIME, textShadow: `0 0 ${u * 1.4}px ${LIME}` }}>✕</div>}
                    </div>
                  </div>
                  {/* "never open an editor" — a lime no-entry stamps over the whole app */}
                  {noStamp > 0.01 && (
                    <div style={{ position: "absolute", left: "50%", top: "44%", transform: `translate(-50%,-50%) scale(${0.7 + noStamp * 0.3}) rotate(-8deg)`, opacity: noStamp }}>
                      <div style={{ position: "relative", width: u * 12, height: u * 12, borderRadius: "50%", border: `${u * 0.85}px solid ${LIME}`, boxShadow: `0 0 ${u * 1.8}px ${LIME}aa` }}>
                        <div style={{ position: "absolute", left: "50%", top: "50%", width: u * 12, height: u * 0.85, background: LIME, transform: "translate(-50%,-50%) rotate(-45deg)", boxShadow: `0 0 ${u * 1.2}px ${LIME}aa` }} />
                      </div>
                      <div style={{ position: "absolute", left: "50%", top: "112%", transform: "translate(-50%,0)", fontFamily: MONO, fontWeight: 800, fontSize: u * 1.55, letterSpacing: "0.16em", color: LIME, whiteSpace: "nowrap", textShadow: `0 2px ${u}px rgba(0,0,0,0.7)` }}>NEVER OPEN IT</div>
                    </div>
                  )}
                </div>
              )}

              {/* "just talk" — mic + a live voice waveform */}
              {talkVis > 0.01 && (
                <div style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)", opacity: talkVis, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 1.0 }}>
                    <svg width={u * 3.4} height={u * 3.4} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                    <div style={{ display: "flex", alignItems: "center", gap: u * 0.4, height: u * 5 }}>
                      {Array.from({ length: 22 }).map((_, i) => { const h = 0.2 + 0.8 * Math.abs(Math.sin(t * 5 + i * 0.7)) * Math.abs(Math.sin(t * 2 + i)); return <div key={i} style={{ width: u * 0.34, height: `${Math.max(6, h * u * 5)}px`, borderRadius: u * 0.2, background: i % 4 === 0 ? LIME : (lite > 0.5 ? "#8a93a3" : SILVER_MID) }} />; })}
                    </div>
                  </div>
                  <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.4, color: lite > 0.5 ? BODY : SILVER_SOFT }}>just talk.</div>
                </div>
              )}

              {/* the note it turns into */}
              {noteIn > 0.01 && (
                <div style={{ position: "absolute", left: "50%", top: "55%", transform: `translate(-50%,-50%) translateY(${(1 - noteIn) * u * 2}px)`, opacity: noteIn }}>
                  <Win u={u} w={48} title="claude · loop-studio" accent>
                    <div style={{ padding: `${u * 1.4}px ${u * 1.6}px` }}>
                      <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.7, color: "#fff", lineHeight: 1.4, minHeight: u * 2.4 }}>
                        {shown}<span style={{ opacity: cur ? 1 : 0, color: LIME }}>▋</span>
                      </div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, color: LIME, marginTop: u * 1.0, opacity: done }}>✓ done — re-rendered.</div>
                    </div>
                  </Win>
                </div>
              )}
            </div>
          );
        })()}

        {/* B5 COST (22.3–27.7): a TOWER of cash climbs to $2,000/mo → struck → collapses to $0
            (feedback v2: a cinematic pile of bills, numbers kept) */}
        {t >= 22.3 && t < 27.7 && (() => {
          const on = clamp01((t - 22.5) / 0.4) * (1 - clamp01((t - 27.4) / 0.3));
          const build = clamp01((t - 22.8) / 1.7);              // the stack rises on "two grand a month"
          const count = Math.round(lerp(0, 2000, build) / 20) * 20;
          const countStr = "$" + count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          const strike = clamp01((t - 24.85) / 0.35);           // lime slash on "but now I pay nothing"
          const dim = clamp01((t - 25.0) / 0.5);                 // the old cost greys out
          const zero = clamp01((t - 25.35) / 0.45);             // the $0 side pops in
          const sub = clamp01((t - 26.2) / 0.5);
          const N = 12, bw = u * 8.4, bh = u * 1.15, bgap = u * 0.22;
          // SIDE-BY-SIDE COMPARISON: old way (heavy cash stack, $2,000/mo) vs Loop Studio ($0) — feedback v4
          return (
            <div style={{ opacity: on }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: u * 6 }}>
                {/* LEFT — the old way: a heavy stack of cash, $2,000/mo, struck + dimmed */}
                <div style={{ position: "relative", width: u * 26, height: u * 34, opacity: lerp(1, 0.42, dim), filter: `grayscale(${dim})` }}>
                  <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: u * 12 }}>
                    {Array.from({ length: N }).map((_, i) => {
                      const app = clamp01(build * N - i);
                      if (app <= 0) return null;
                      const lean = Math.sin(i * 1.7) * u * 0.45;
                      return (
                        <div key={i} style={{ position: "absolute", left: `calc(50% + ${lean}px)`, bottom: i * (bh + bgap), width: bw, height: bh, transform: `translateX(-50%) scale(${lerp(0.6, 1, app)})`, opacity: app }}>
                          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: u * 0.18, background: "linear-gradient(180deg,#d2ccae,#b2ab89)", boxShadow: `0 ${u * 0.15}px ${u * 0.4}px rgba(0,0,0,0.5)`, overflow: "hidden" }}>
                            {Array.from({ length: 4 }).map((_, k) => <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${16 + k * 22}%`, height: u * 0.07, background: "#8f8867", opacity: 0.5 }} />)}
                            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: u * 1.6, transform: "translateX(-50%)", background: LIME, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 0.7, color: RAISIN }}>$</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* the amount + strike */}
                  <div style={{ position: "absolute", left: "50%", bottom: u * 15.5, transform: "translate(-50%,0)", whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 5.4, letterSpacing: "-0.03em", color: SILVER }}>{countStr}<span style={{ fontSize: u * 2.2, color: SILVER_MID }}> /mo</span></span>
                    <span style={{ position: "absolute", left: "-4%", top: "48%", height: u * 0.42, width: `${strike * 108}%`, background: LIME, borderRadius: u * 0.2, transform: "rotate(-3deg)", boxShadow: `0 0 ${u}px ${LIME}` }} />
                  </div>
                </div>
                {/* vs */}
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.2, color: SILVER_MID, opacity: zero }}>vs</div>
                {/* RIGHT — Loop Studio: $0, light + lime */}
                <div style={{ position: "relative", width: u * 26, height: u * 34, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 1.4, opacity: zero, transform: `scale(${lerp(0.82, 1, zero)})` }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 11, letterSpacing: "-0.03em", color: RAISIN, background: LIME, padding: `${u * 0.3}px ${u * 2.0}px`, borderRadius: u * 0.5, transform: "rotate(-1.4deg)", boxShadow: `0 ${u * 0.6}px ${u * 2}px ${LIME}55` }}>$0</span>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.0, letterSpacing: "-0.02em", color: SILVER_MID }}>/mo</span>
                </div>
              </div>
              {/* sub */}
              <div style={{ position: "absolute", left: "50%", top: "88%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: u * 1.0, opacity: sub, whiteSpace: "nowrap" }}>
                <Img src={staticFile("logos/claude.svg")} style={{ width: u * 2.6, height: u * 2.6 }} />
                <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.4, color: SILVER_SOFT }}>only my Claude subscription.</span>
              </div>
            </div>
          );
        })()}

        {/* B6 TEASE (27.7–33.5): the $2k is the BORING part — tease the REAL opportunity, locked.
            (feedback v2: no confusing "↑ least interesting"; a retention teaser that MEANS something) */}
        {t >= 27.7 && t < 33.5 && (() => {
          const on = clamp01((t - 27.9) / 0.4) * (1 - clamp01((t - 33.2) / 0.3));
          const settle = clamp01((t - 28.1) / 0.8);            // $2k shrinks to a small dim chip
          const reveal = clamp01((t - 29.7) / 0.7);            // the locked opportunity slides in
          const lockPulse = 0.72 + 0.28 * Math.sin(t * 3.2);
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={31.0} ink={ink} size={2.9} y="12%">THAT&apos;S THE <Marker u={u} t={t} at={31.3} base={ink}>BORING</Marker> PART</HL>
              {/* the $2k, shrunk to a small dim "what I save" chip */}
              <div style={{ position: "absolute", left: `${lerp(44, 19, settle)}%`, top: `${lerp(50, 70, settle)}%`, transform: `translate(-50%,-50%) scale(${lerp(1.0, 0.5, settle)})` }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.6, opacity: lerp(1, 0.5, settle) }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.6, letterSpacing: "-0.03em", color: SILVER_MID }}>$2,000<span style={{ fontSize: u * 2.8 }}> /mo</span></span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.18em", color: SILVER_MID, opacity: settle }}>WHAT I SAVE</span>
                </div>
              </div>
              {/* the LOCKED opportunity — a much bigger number, redacted, revealed by the end */}
              <div style={{ position: "absolute", left: "66%", top: "52%", transform: `translate(-50%,-50%) scale(${lerp(0.86, 1, reveal)})`, opacity: reveal }}>
                <div style={{ position: "relative", width: u * 45, borderRadius: u * 0.8, padding: `${u * 2.3}px ${u * 2.6}px`, background: "linear-gradient(160deg,#141a28,#0c0f18)", border: `${u * 0.18}px solid ${LIME}`, boxShadow: `0 0 ${u * 2.6 * lockPulse}px ${LIME}66, 0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.6)` }}>
                  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, letterSpacing: "0.2em", color: LIME, marginBottom: u * 1.1 }}>THE REAL OPPORTUNITY</div>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.55, marginBottom: u * 1.3 }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.2, color: SILVER }}>$</span>
                    {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ width: u * 3.3, height: u * 5.2, borderRadius: u * 0.3, background: "repeating-linear-gradient(135deg,#2a3245 0 6px,#1b2130 6px 12px)", filter: "blur(1px)" }} />)}
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.0, color: SILVER_MID, marginLeft: u * 0.4 }}>/mo?</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: u * 0.8 }}>
                    <svg width={u * 2.3} height={u * 2.3} viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth={2}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.0, color: "#fff" }}>revealed by the end</span>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.4, color: LIME }}>→</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* B7 CRAZY (33.42–35.84): lime hockey-stick curve shoots up */}
        {t >= 33.5 && t < 36.1 && (() => {
          const on = clamp01((t - 33.6) / 0.3) * (1 - clamp01((t - 35.9) / 0.2));
          const draw = clamp01((t - 34.0) / 1.0);
          return (
            <div style={{ opacity: on }}>
              <HL u={u} t={t} at={34.0} ink={SILVER} size={3.2} y="18%" center>THE ECONOMICS ARE <Marker u={u} t={t} at={35.4} base={SILVER}>CRAZY</Marker></HL>
              <svg width={u * 62} height={u * 34} style={{ position: "absolute", left: "50%", top: "58%", transform: "translate(-50%,-50%)", overflow: "visible" }}>
                <line x1={u * 2} y1={u * 30} x2={u * 2} y2={u * 2} stroke={SILVER_MID} strokeWidth={u * 0.28} opacity={0.5} />
                <line x1={u * 2} y1={u * 30} x2={u * 60} y2={u * 30} stroke={SILVER_MID} strokeWidth={u * 0.28} opacity={0.5} />
                <path d={`M ${u * 2} ${u * 29} C ${u * 18} ${u * 28}, ${u * 34} ${u * 26}, ${u * 44} ${u * 19} C ${u * 54} ${u * 12}, ${u * 58} ${u * 4}, ${u * 60} ${u * 1}`}
                  fill="none" stroke={LIME} strokeWidth={u * 0.9} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
                <circle cx={u * 60} cy={u * 1} r={u * 1.1} fill={LIME} opacity={draw > 0.9 ? 1 : 0} />
              </svg>
            </div>
          );
        })()}

        {/* B8 BUTTON (35.84–37.18): LET'S DIVE IN plate */}
        {t >= 36.0 && (() => {
          const on = clamp01((t - 36.1) / 0.3);
          const pop = interpolate(clamp01((t - 36.3) / 0.5), [0, 1], [0.72, 1], { easing: EASE_OVER });
          return (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: on }}>
              <div style={{ transform: `scale(${pop}) rotate(-1.4deg)` }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 8.5, color: RAISIN, background: LIME, padding: `${u * 0.6}px ${u * 2.2}px`, borderRadius: u * 0.5, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>LET&apos;S DIVE IN →</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* vignette */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 74% at 50% 46%, transparent 52%, rgba(0,0,0,0.34) 100%)", opacity: lite > 0.5 ? 0.4 : 1 }} />

      {/* soft lime bloom behind the closing plate — clean, no white strobe (feedback v2) */}
      {bloom > 0.01 && <AbsoluteFill style={{ pointerEvents: "none", opacity: bloom, background: `radial-gradient(ellipse 64% 50% at 50% 50%, ${LIME}cc 0%, ${LIME}22 36%, transparent 64%)`, mixBlendMode: "screen" }} />}

      {/* ================= SOUND DESIGN (SFX ~40% quieter per feedback; music bed in post) ===== */}
      <Sfx n="riser" at={0.3} v={0.10} dur={5.4} />
      {/* assembly snaps — one soft click per piece placed */}
      {[1.6, 2.0, 2.4, 2.9, 3.3, 3.7, 4.1, 4.5].map((at, i) => <Sfx key={i} n="click" at={at} v={0.2} dur={0.7} />)}
      <Sfx n="whoosh" at={1.35} v={0.18} dur={1.2} />
      {/* (removed the 5.35 "complete" chime — it didn't make sense) */}
      <Sfx n="whoosh" at={7.1} v={0.2} dur={1.2} />           {/* resolves into the TV */}
      <Sfx n="ping" at={13.6} v={0.2} dur={1.0} />            {/* EDITED */}
      <Sfx n="whoosh" at={19.1} v={0.22} dur={1.0} />         {/* editor dismissed */}
      <Sfx n="complete" at={21.3} v={0.24} dur={1.4} />       {/* note done */}
      <Sfx n="whoosh" at={22.4} v={0.16} dur={1.2} />         {/* crossfade to dark */}
      <Sfx n="complete" at={25.4} v={0.26} dur={1.4} />       {/* $0 */}
      <Sfx n="ping" at={31.2} v={0.18} dur={1.0} />           {/* LEAST */}
      <Sfx n="riser" at={33.5} v={0.14} dur={2.4} />          {/* the crazy climb */}
      <Sfx n="whoosh" at={36.5} v={0.22} dur={1.0} />         {/* dive in */}
      <Sfx n="complete" at={36.85} v={0.28} dur={1.6} />
    </AbsoluteFill>
  );
};

/* ---------- SFX cue ---------- */
const Sfx: React.FC<{ n: string; at: number; v?: number; dur?: number }> = ({ n, at, v = 0.4, dur = 1.5 }) => (
  <Sequence from={Math.round(at * FPS)} durationInFrames={Math.round(dur * FPS)}>
    <Audio src={staticFile(`loopstudio/sfx/${n}.wav`)} volume={v} />
  </Sequence>
);

/* ================================================================================
   TV ROOM — a BRIGHT, warm, daylit living room (feedback: lighter room for contrast with
   the dark hook). Sunlit window + plant, light-wood floor + rug, the TV on a wood console,
   a cream sofa in the foreground with a person watching. Airy, premium, inviting.
   ================================================================================ */
const TvRoom: React.FC<{ u: number; t: number; W: number; H: number }> = ({ u, t, W, H }) => {
  const cx = W * 0.5;
  const hy = H * 0.605;                          // floor seam
  const tvIn = interpolate(clamp01((t - 6.7) / 0.7), [0, 1], [0.9, 1], { easing: EASE_OVER });
  const SCR_W = u * 30, SCR_H = SCR_W * 9 / 16, BEZ = u * 0.5;
  const tvCy = H * 0.375;
  const appear = clamp01((t - 6.9) / 0.5);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* bright warm back wall */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#f6f3ec 0%,#efe9dc 50%,#e4dccb 100%)" }} />
      {/* room geometry: side walls (deeper warm), light-wood floor, soft rug */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <polygon points={`0,0 ${W * 0.17},0 ${W * 0.11},${hy} 0,${H}`} fill="#e0d6c2" opacity={0.95} />
        <polygon points={`${W},0 ${W * 0.83},0 ${W * 0.89},${hy} ${W},${H}`} fill="#d9cfb8" opacity={0.95} />
        <line x1={0} y1={hy} x2={W} y2={hy} stroke="#c8bca2" strokeWidth={u * 0.14} opacity={0.7} />
        {/* light-wood floor */}
        <rect x={0} y={hy} width={W} height={H - hy} fill="#d7c19b" />
        <rect x={0} y={hy} width={W} height={H - hy} fill="url(#floorShade)" />
        <defs><linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9b085" stopOpacity="0.0" /><stop offset="1" stopColor="#a8895f" stopOpacity="0.5" /></linearGradient></defs>
        {/* plank seams (perspective) */}
        {[0.16, 0.34, 0.5, 0.66, 0.84].map((p, i) => <line key={i} x1={cx + (p - 0.5) * W * 0.7} y1={hy} x2={cx + (p - 0.5) * W * 2.4} y2={H} stroke="#b99d72" strokeWidth={u * 0.08} opacity={0.4} />)}
        {/* soft cream rug */}
        <polygon points={`${cx - u * 13},${hy + u * 0.6} ${cx + u * 13},${hy + u * 0.6} ${cx + u * 28},${H} ${cx - u * 28},${H}`} fill="#efe7d6" opacity={0.9} />
      </svg>

      {/* sunlit WINDOW on the left back wall — the room's daylight */}
      <div style={{ position: "absolute", left: "8%", top: "9%", width: u * 22, height: u * 27, opacity: appear }}>
        <div style={{ position: "absolute", inset: `-${u * 3}px`, background: "radial-gradient(ellipse at 40% 40%, #fffdf4cc 0%, #fff6dd55 34%, transparent 66%)" }} />
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: u * 0.6, background: "linear-gradient(150deg,#ffffff,#f3ecd9 62%,#e9ddc2)", boxShadow: `inset 0 0 0 ${u * 0.55}px #cdbf9f, 0 ${u * 0.8}px ${u * 2}px rgba(120,100,60,0.14)` }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: u * 0.32, transform: "translateX(-50%)", background: "#cdbf9f" }} />
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: u * 0.32, transform: "translateY(-50%)", background: "#cdbf9f" }} />
          {/* plant leaves in front of the window */}
          <svg viewBox="0 0 40 64" width={u * 9} height={u * 15} style={{ position: "absolute", left: -u * 1.5, bottom: -u * 1, overflow: "visible" }}>
            {[0, 20, -20, 38, -38].map((r, i) => <path key={i} d="M20 62 C 20 42, 20 24, 20 6" fill="none" stroke="#5b7d4a" strokeWidth={4.5} strokeLinecap="round" transform={`rotate(${r} 20 62)`} opacity={0.92} />)}
            <path d="M12 64 h16 l-2 -11 h-12 z" fill="#c98f5e" />
          </svg>
        </div>
      </div>

      {/* soft warm daylight wash into the room */}
      <div style={{ position: "absolute", left: "34%", top: "28%", width: u * 60, height: u * 44, transform: "translate(-50%,-50%)", background: "radial-gradient(ellipse, #fff4d81f 0%, transparent 62%)" }} />

      {/* a warm floor lamp on the right for cozy fill */}
      <div style={{ position: "absolute", left: "82%", top: hy, opacity: appear }}>
        <div style={{ position: "absolute", left: u * 0.9, top: -u * 9, width: u * 13, height: u * 13, transform: "translate(-50%,-50%)", background: "radial-gradient(circle, #ffcf8f2e 0%, transparent 62%)" }} />
        <div style={{ position: "absolute", left: 0, top: -u * 11.6, width: u * 4.0, height: u * 2.8, transform: "translateX(-50%)", background: "linear-gradient(180deg,#fbe3ab,#efc887)", boxShadow: `0 0 ${u * 2.4}px #ffcf8f66`, clipPath: "polygon(20% 0,80% 0,100% 100%,0 100%)", borderRadius: `${u * 0.4}px ${u * 0.4}px 0 0` }} />
        <div style={{ position: "absolute", left: -u * 0.1, top: -u * 8.8, width: u * 0.22, height: u * 7.2, background: "#b7a888" }} />
      </div>

      {/* the TV on a light-wood console */}
      <div style={{ position: "absolute", left: cx, top: tvCy, transform: `translate(-50%,-50%) scale(${tvIn})`, opacity: appear }}>
        <div style={{ position: "relative", padding: BEZ, background: "#1a1c22", borderRadius: u * 0.7, boxShadow: `0 0 ${u * 2.4}px ${LIME}44, 0 ${u * 1.6}px ${u * 3.4}px rgba(90,74,44,0.32), 0 0 0 ${u * 0.1}px #2a2c34` }}>
          <div style={{ position: "relative", width: SCR_W, height: SCR_H, borderRadius: u * 0.3, overflow: "hidden", background: "#000" }}>
            <OffthreadVideo src={staticFile(SRC)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(1.05) contrast(1.06) saturate(1.06)" }} />
            <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${u * 2}px rgba(0,0,0,0.4)` }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent 20%)" }} />
            <div style={{ position: "absolute", left: u * 0.8, top: u * 0.7, display: "flex", alignItems: "center", gap: u * 0.4, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, letterSpacing: "0.1em", color: "#fff" }}>
              <span style={{ width: u * 0.55, height: u * 0.55, borderRadius: "50%", background: LIME, boxShadow: `0 0 ${u * 0.5}px ${LIME}` }} /> LIVE
            </div>
          </div>
        </div>
        {/* light-wood media console */}
        <div style={{ position: "absolute", left: "50%", top: `calc(100% + ${u * 1.1}px)`, transform: "translateX(-50%)", width: SCR_W * 1.36, height: u * 3.0, background: "linear-gradient(180deg,#c9ab7e,#a8895f)", borderRadius: u * 0.5, boxShadow: `0 ${u * 1.0}px ${u * 2.2}px rgba(90,74,44,0.3)` }}>
          <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translateX(-50%)", width: "82%", height: u * 0.1, background: "#8f7350", opacity: 0.5 }} />
          <div style={{ position: "absolute", left: "13%", bottom: -u * 0.8, width: u * 0.55, height: u * 0.9, background: "#8f7350" }} />
          <div style={{ position: "absolute", right: "13%", bottom: -u * 0.8, width: u * 0.55, height: u * 0.9, background: "#8f7350" }} />
        </div>
      </div>

      {/* the CREAM couch + person, foreground */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: u * 22, opacity: clamp01((t - 7.0) / 0.5) }}>
        <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: u * 66, height: u * 11, borderRadius: `${u * 2}px ${u * 2}px 0 0`, background: "linear-gradient(180deg,#efe6d4,#ddd0b8)" }} />
        <div style={{ position: "absolute", left: "50%", bottom: u * 5, transform: "translateX(-50%)", display: "flex", gap: u * 0.5 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: u * 18, height: u * 9.5, borderRadius: `${u * 2.8}px ${u * 2.8}px ${u * 0.6}px ${u * 0.6}px`, background: "linear-gradient(180deg,#f3ecdc,#e2d7c1)", boxShadow: `inset 0 ${u * 0.8}px 0 #fffaf0` }} />)}
        </div>
        <div style={{ position: "absolute", left: `calc(50% - ${u * 31}px)`, bottom: 0, transform: "translateX(-50%)", width: u * 7, height: u * 12.5, borderRadius: `${u * 3}px ${u * 1.4}px ${u * 0.6}px ${u * 3}px`, background: "linear-gradient(180deg,#ece2ce,#d6c9af)", boxShadow: `inset ${u * 0.5}px ${u * 0.4}px 0 #fffaf0` }} />
        <div style={{ position: "absolute", left: `calc(50% + ${u * 31}px)`, bottom: 0, transform: "translateX(-50%)", width: u * 7, height: u * 12.5, borderRadius: `${u * 1.4}px ${u * 3}px ${u * 3}px ${u * 0.6}px`, background: "linear-gradient(180deg,#ece2ce,#d6c9af)", boxShadow: `inset -${u * 0.5}px ${u * 0.4}px 0 #fffaf0` }} />
        {/* the person, sitting, head + shoulders — warm silhouette, daylight rim */}
        <div style={{ position: "absolute", left: "50%", bottom: u * 10.5, transform: "translateX(-50%)" }}>
          <div style={{ width: u * 16.5, height: u * 8.5, borderRadius: `${u * 8}px ${u * 8}px 0 0`, background: "linear-gradient(180deg,#4a4236,#332d24)", boxShadow: `inset 0 ${u * 0.6}px 0 #fff2d055, 0 -${u * 0.3}px ${u * 1.6}px rgba(0,0,0,0.2)` }} />
          <div style={{ position: "absolute", left: "50%", top: -u * 4.8, transform: "translateX(-50%)", width: u * 6.2, height: u * 6.6, borderRadius: "50%", background: "linear-gradient(180deg,#4a4236,#332d24)", boxShadow: `inset ${u * 0.5}px ${u * 0.7}px 0 #fff2d055` }} />
        </div>
      </div>

      {/* soft light vignette (warm, not dark) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 86% 84% at 50% 44%, transparent 56%, rgba(120,100,64,0.14) 100%)" }} />
    </div>
  );
};

/* ================================================================================
   HOOK ASSEMBLY — Claude Code builds the editing rig around the head like an Iron Man
   suit. Editing pieces (clips, waveform, captions, grade, fx) fly in on tilted orbital
   rings and SNAP into place; the rig rotates so pieces pass behind & in front of him.
   Rendered TWICE: layer="back" (pieces whose depth is behind the head) before the
   FootageLayer, layer="front" (pieces in front) after it.
   ================================================================================ */
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
type Piece = { kind: string; rx: number; a: number; at: number; tc?: string };
const PIECES: Piece[] = [
  { kind: "clip", rx: 0.345, a: -55, at: 1.6, tc: "00:03" },
  { kind: "clip", rx: 0.345, a: 22, at: 2.0, tc: "01:12" },
  { kind: "wave", rx: 0.275, a: 152, at: 2.4 },
  { kind: "cap", rx: 0.275, a: 214, at: 2.9 },
  { kind: "grade", rx: 0.215, a: -118, at: 3.3 },
  { kind: "fx", rx: 0.215, a: 96, at: 3.7 },
  { kind: "clip", rx: 0.345, a: 138, at: 4.1, tc: "02:40" },
  { kind: "music", rx: 0.275, a: -28, at: 4.5 },
];
const ROT_START = 1.4;
const rot = (t: number) => (Math.max(0, t - ROT_START)) * 11; // deg/s, begins on the pull-back

const PieceView: React.FC<{ p: Piece; u: number; sc: number; placing: number }> = ({ p, u, sc, placing }) => {
  const lit = placing > 0.02;
  const glow = lit ? `drop-shadow(0 0 ${u * 2.0 * placing}px ${LIME}) drop-shadow(0 ${u * 0.6}px ${u * 1.4}px rgba(0,0,0,0.5))` : `drop-shadow(0 ${u * 0.7}px ${u * 1.6}px rgba(0,0,0,0.55))`;
  // a premium glass edit-module
  const panel = (child: React.ReactNode, w: number, h: number, label: string, accent?: boolean) => (
    <div style={{ transform: `scale(${sc})`, filter: glow }}>
      <div style={{ position: "relative", width: u * w, height: u * h, borderRadius: u * 0.8, background: "linear-gradient(157deg,#1d2434 0%,#141a27 55%,#0d1119 100%)", border: `${u * 0.1}px solid ${lit ? LIME : accent ? `${LIME}7a` : "#333c4e"}`, boxShadow: `inset 0 ${u * 0.14}px 0 rgba(255,255,255,0.10), 0 ${u * 1.0}px ${u * 2.4}px rgba(0,0,0,0.5)`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "46%", background: "linear-gradient(180deg, rgba(255,255,255,0.11), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: u * 1.5, display: "flex", alignItems: "center", justifyContent: "center", padding: `${u * 0.5}px ${u * 0.7}px` }}>{child}</div>
        <div style={{ position: "absolute", left: u * 0.7, bottom: u * 0.5, display: "flex", alignItems: "center", gap: u * 0.35, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.62, letterSpacing: "0.16em", color: lit ? LIME : SILVER_MID }}>
          <span style={{ width: u * 0.34, height: u * 0.34, borderRadius: "50%", background: lit ? LIME : "#4a5468" }} />{label}
        </div>
        {lit && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 36%, ${LIME}22, transparent 68%)`, pointerEvents: "none" }} />}
      </div>
    </div>
  );
  if (p.kind === "clip")  // TIMELINE — a mini multitrack
    return panel(
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: u * 0.28 }}>
        {[["#3f9c6a", "#c98a5a"], [LIME, "#3c5f8f"], ["#5a4a7a", "#3f9c6a"]].map((cs, r) => (
          <div key={r} style={{ display: "flex", gap: u * 0.24, height: u * 0.7 }}>
            {[[3, cs[0]], [2, "#20283a"], [4, cs[1]]].map(([fw, c], i) => <div key={i} style={{ flex: fw as number, borderRadius: u * 0.14, background: c as string, opacity: 0.92 }} />)}
          </div>
        ))}
        <div style={{ position: "absolute", left: "42%", top: u * 0.2, bottom: u * 1.4, width: u * 0.12, background: LIME, boxShadow: `0 0 ${u * 0.5}px ${LIME}` }} />
      </div>, 9.4, 6.0, "TIMELINE");
  if (p.kind === "wave")  // AUDIO
    return panel(
      <div style={{ display: "flex", alignItems: "center", gap: u * 0.22, height: u * 3.0 }}>
        {Array.from({ length: 17 }).map((_, i) => { const h = 0.5 + 2.5 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.6)); return <div key={i} style={{ width: u * 0.24, height: `${Math.max(6, h * u)}px`, background: i % 3 === 0 ? LIME : "#7c869a", borderRadius: u * 0.1 }} />; })}
      </div>, 9.2, 5.2, "AUDIO", true);
  if (p.kind === "cap")  // CAPTIONS — a real burned caption
    return panel(
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.35, textTransform: "uppercase", letterSpacing: "-0.01em", textAlign: "center", lineHeight: 1.15 }}>
        <span style={{ color: "#fff" }}>you {"can’t "}</span><span style={{ color: RAISIN, background: LIME, padding: `0 ${u * 0.25}px`, borderRadius: u * 0.14 }}>tell</span>
      </div>, 9.0, 5.0, "CAPTIONS", true);
  if (p.kind === "grade")  // COLOR — grade wheels
    return panel(
      <div style={{ display: "flex", gap: u * 0.7 }}>
        {["#2f8f88", "#d79a63", LIME].map((c, i) => (
          <div key={i} style={{ width: u * 2.1, height: u * 2.1, borderRadius: "50%", background: `radial-gradient(circle at 38% 34%, ${c}, #0d1119 78%)`, border: `${u * 0.09}px solid #3a4358`, position: "relative" }}>
            <div style={{ position: "absolute", left: "58%", top: "40%", width: u * 0.44, height: u * 0.44, borderRadius: "50%", background: "#fff" }} />
          </div>
        ))}
      </div>, 8.6, 5.2, "COLOR");
  if (p.kind === "fx")  // MOTION — a node graph
    return panel(
      <svg width={u * 5.6} height={u * 3.6} viewBox="0 0 56 36">
        <line x1={10} y1={26} x2={28} y2={10} stroke="#4a5468" strokeWidth={1.6} /><line x1={28} y1={10} x2={46} y2={24} stroke={LIME} strokeWidth={1.8} />
        {[[10, 26, "#7c869a"], [28, 10, LIME], [46, 24, "#7c869a"]].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={4.4} fill={c as string} />)}
      </svg>, 8.0, 5.2, "MOTION");
  // music — MUSIC
  return panel(
    <div style={{ display: "flex", alignItems: "flex-end", gap: u * 0.3, height: u * 2.8 }}>
      {[1.4, 2.6, 1.9, 2.9, 1.2].map((h, i) => <div key={i} style={{ width: u * 0.5, height: u * h, borderRadius: u * 0.12, background: i % 2 ? LIME : "#7c869a" }} />)}
    </div>, 8.0, 5.0, "MUSIC", true);
};

const PARTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // floating dust motes (index-seeded, deterministic)
const HookAssembly: React.FC<{ layer: "back" | "front"; t: number; u: number; W: number; H: number }> = ({ layer, t, u, W, H }) => {
  const cx = W * 0.5, cy = H * 0.45;
  const tilt = 0.34;
  const globalOut = 1 - clamp01((t - 6.4) / 0.6);  // the whole rig collapses in on the turn
  const collapse = clamp01((t - 6.4) / 0.7);
  const shrink = 1 - collapse * 0.85;
  const assembled = clamp01((t - 1.0) / 4.2);       // 0..1 as the suit builds up

  // where a piece sits in world space at time t (for tendrils)
  const posOf = (p: Piece) => {
    const ang = (p.a + rot(t)) * Math.PI / 180;
    const arr = clamp01((t - p.at) / 0.5);
    const flyR = lerp(2.15, 1, easeOutCubic(arr)) * (1 - collapse * 0.9);
    return { x: cx + p.rx * W * flyR * Math.cos(ang), y: cy + p.rx * W * tilt * flyR * Math.sin(ang), placed: t >= p.at - 0.05 };
  };

  // BACK layer: central glow + rings + energy tendrils + particles (all behind the head)
  const backFx = layer === "back" && (
    <div style={{ position: "absolute", inset: 0, opacity: globalOut }}>
      {/* the assembling core glow behind him */}
      <div style={{ position: "absolute", left: cx, top: cy, transform: "translate(-50%,-50%)", width: u * 66, height: u * 48, background: `radial-gradient(ellipse, ${LIME}1e 0%, ${LIME}0b 30%, transparent 60%)`, opacity: 0.35 + 0.65 * assembled }} />
      {/* floating dust motes */}
      {PARTS.map((i) => {
        const sd = Math.sin(i * 12.9) * 0.5 + 0.5, sd2 = Math.sin(i * 5.3) * 0.5 + 0.5;
        const px = (0.12 + sd * 0.76) * W, py = (0.16 + sd2 * 0.62) * H + Math.sin(t * 0.7 + i) * u * 1.2;
        const r = (0.06 + sd * 0.12) * u;
        return <div key={i} style={{ position: "absolute", left: px, top: py, width: r * 2, height: r * 2, borderRadius: "50%", background: LIME, opacity: (0.12 + 0.28 * sd2) * clamp01((t - 0.4) / 0.8) }} />;
      })}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* rings — crisp glowing timeline rulers */}
        {[0.345, 0.275, 0.215].map((r, i) => {
          const draw = clamp01((t - (0.5 + i * 0.25)) / 0.7);
          const rxp = r * W * shrink, ryp = r * W * tilt * shrink;
          const rotDeg = rot(t) * (i % 2 === 0 ? 1 : -0.7);
          const N = i === 0 ? 60 : i === 1 ? 40 : 30;
          const nDraw = Math.round(N * draw);
          const clipSegs = i === 1 ? [[10, 16], [26, 30], [34, 39]] : [];
          const pulseK = ((t * 0.18 * (i + 1)) % 1);   // a bright pulse travelling the ring
          const pa = pulseK * Math.PI * 2;
          return (
            <g key={i} transform={`translate(${cx} ${cy}) rotate(${rotDeg})`} opacity={draw}>
              <ellipse cx={0} cy={0} rx={rxp} ry={ryp} fill="none" stroke={i === 1 ? "#46506a" : "#2c3446"} strokeWidth={u * 0.1} opacity={0.9} />
              {Array.from({ length: nDraw }).map((_, k) => {
                const a = (k / N) * Math.PI * 2, major = k % 5 === 0, tl = (major ? 0.95 : 0.48) * u;
                const x1 = rxp * Math.cos(a), y1 = ryp * Math.sin(a);
                const nx = Math.cos(a), ny = Math.sin(a) * tilt, nl = Math.hypot(nx, ny) || 1;
                return <line key={k} x1={x1} y1={y1} x2={x1 + (nx / nl) * tl} y2={y1 + (ny / nl) * tl} stroke={i === 1 ? LIME : "#5a6478"} strokeWidth={major ? u * 0.12 : u * 0.07} opacity={i === 1 ? 0.85 : 0.62} />;
              })}
              {clipSegs.map(([s, e], ci) => {
                const pts = [];
                for (let k = s; k <= e; k++) { const a = (k / N) * Math.PI * 2; pts.push(`${rxp * Math.cos(a)},${ryp * Math.sin(a)}`); }
                return <polyline key={ci} points={pts.join(" ")} fill="none" stroke={LIME} strokeWidth={u * 0.5} strokeLinecap="round" opacity={0.9 * draw} style={{ filter: `drop-shadow(0 0 ${u * 0.4}px ${LIME}aa)` }} />;
              })}
              {/* travelling energy pulse */}
              {draw > 0.9 && <circle cx={rxp * Math.cos(pa)} cy={ryp * Math.sin(pa)} r={u * 0.34} fill={LIME} style={{ filter: `drop-shadow(0 0 ${u * 0.9}px ${LIME})` }} />}
            </g>
          );
        })}
        {/* energy tendrils wiring each locked module back to the core */}
        {PIECES.map((p, i) => {
          const pos = posOf(p); if (!pos.placed) return null;
          const near = 1 - clamp01(Math.abs(t - p.at) / 0.5);
          const born = clamp01((t - p.at + 0.15) / 0.3);
          return <line key={"td" + i} x1={cx} y1={cy} x2={pos.x} y2={pos.y} stroke={LIME} strokeWidth={u * (0.05 + 0.16 * near)} opacity={(0.12 + 0.5 * near) * born * (0.5 + 0.5 * assembled)} style={near > 0.15 ? { filter: `drop-shadow(0 0 ${u * 0.5}px ${LIME})` } : undefined} />;
        })}
      </svg>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {backFx}
      {PIECES.map((p, i) => {
        const ang = (p.a + rot(t)) * Math.PI / 180;
        const depth = Math.sin(ang);                 // -1 back .. +1 front
        const inLayer = layer === "front" ? depth >= -0.02 : depth < -0.02;
        if (!inLayer) return null;
        const arr = clamp01((t - p.at) / 0.5);
        if (t < p.at - 0.5) return null;
        const flyR = lerp(2.15, 1, easeOutCubic(arr)) * (1 - collapse * 0.9);
        const rxp = p.rx * W * flyR, ryp = p.rx * W * tilt * flyR;
        const x = cx + rxp * Math.cos(ang), y = cy + ryp * Math.sin(ang);
        const depthScale = 0.62 + 0.42 * (depth + 1) / 2;
        const pop = interpolate(clamp01((t - p.at) / 0.5), [0, 1], [0.5, 1], { easing: EASE_OVER });
        const sc = depthScale * (0.68 + 0.32 * pop);
        const op = clamp01((t - p.at + 0.35) / 0.4) * (0.5 + 0.5 * (depth + 1) / 2) * globalOut;
        const placing = 1 - clamp01(Math.abs(t - p.at) / 0.35);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", opacity: op }}>
            <PieceView p={p} u={u} sc={sc} placing={placing} />
            {/* snap: a bright expanding pulse ring + a quick flash */}
            {placing > 0.03 && <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${1 + (1 - placing) * 1.8})`, width: u * 11, height: u * 11, borderRadius: "50%", border: `${u * 0.24}px solid ${LIME}`, opacity: placing * 0.85, filter: `drop-shadow(0 0 ${u * 0.8}px ${LIME})` }} />}
            {placing > 0.5 && <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: u * 7, height: u * 7, borderRadius: "50%", background: `radial-gradient(circle, ${LIME}${Math.round((placing - 0.5) * 2 * 90).toString(16).padStart(2, "0")}, transparent 70%)` }} />}
          </div>
        );
      })}
      {/* the agent cursor — a claude mark that jumps to the piece being placed */}
      {(() => {
        if (layer !== "front") return null;
        const cur = PIECES.reduce((best, p) => (Math.abs(t - p.at) < Math.abs(t - best.at) ? p : best), PIECES[0]);
        if (t < 1.2 || t > 5.2) return null;
        const ang = (cur.a + rot(t)) * Math.PI / 180;
        const rxp = cur.rx * W, ryp = cur.rx * W * tilt;
        const x = cx + rxp * Math.cos(ang), y = cy + ryp * Math.sin(ang);
        const near = 1 - clamp01(Math.abs(t - cur.at) / 0.4);
        return (
          <div style={{ position: "absolute", left: x + u * 2.4, top: y - u * 2.4, transform: "translate(-50%,-50%)", opacity: 0.9 }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", inset: `${-u * 1.4}px`, borderRadius: "50%", background: `radial-gradient(circle, ${LIME}55 0%, transparent 66%)`, opacity: 0.5 + 0.5 * near }} />
              <Img src={staticFile("logos/claude.svg")} style={{ width: u * 2.9, height: u * 2.9, filter: `drop-shadow(0 0 ${u * 1.0}px rgba(217,119,87,0.85))` }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LoopStudioIntroBB;
