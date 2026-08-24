/**
 * AttentionOverlay — the ONLY layer added to attention.mp4.
 *
 * Renders on a transparent background: captions in the lower third and hand-drawn marker
 * sketches in the flat dark wall at frame-left. The footage itself is never cut, never
 * covered, never zoomed. Composited over the untouched source with ffmpeg.
 *
 * Screenplay: projects/attention/design_attention.json
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Beat, Captions } from "./ink";
import {
  PaperStamped, PromptEnter, KeyToPhone, HollowTick, TallyGrow, TallyOverflow, Dial,
  CrossCurves, Day24, LeverPellet, AppsStruck, BrowserTyped, WaterGate, WiredHead, SlotLoop,
  PhoneFaceDown, BrainWedge, FlatThenRise, SpikeThenFlat, CrowdShaded, ChoreSpark, PlayMirror,
  CounterTally, AttentionLine,
} from "./sketches";
import cards from "./captions.json";

export const ATTENTION_DURATION = Math.round(417.367 * 30);

export const AttentionOverlay: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "transparent" }}>
    {/* ── the through-line: one stroke, six lives ─────────────────────────── */}
    <Beat id="tl1" t={36.06} dur={5.8}><AttentionLine state="PLANTED" /></Beat>
    <Beat id="tl2" t={108.56} dur={6.2}><AttentionLine state="BENT" /></Beat>
    <Beat id="tl3" t={159.46} dur={6.8}><AttentionLine state="SEVERED" /></Beat>
    <Beat id="tl4" t={270.34} dur={5.2}><AttentionLine state="CUT" /></Beat>
    <Beat id="tl5" t={281.64} dur={8.0}><AttentionLine state="REDRAWN" /></Beat>
    <Beat id="tl6" t={386.58} dur={6.0}><AttentionLine state="BRANCHED" /></Beat>

    {/* ── the sketches ───────────────────────────────────────────────────── */}
    <Beat id="s11" t={1.28} dur={6.8}><AppsStruck /></Beat>
    <Beat id="s12" t={15.98} dur={4.4}><BrowserTyped /></Beat>
    <Beat id="s13" t={20.94} dur={6.8}><WaterGate /></Beat>
    <Beat id="s01" t={63.12} dur={3.8}><PaperStamped /></Beat>
    <Beat id="s02" t={71.76} dur={4.4}><PromptEnter /></Beat>
    <Beat id="s03" t={76.96} dur={4.6}><KeyToPhone /></Beat>
    <Beat id="s04" t={82.3} dur={4.0}><HollowTick /></Beat>
    <Beat id="s05" t={93.3} dur={5.6}><TallyGrow /></Beat>
    <Beat id="s06" t={100.48} dur={4.6}><TallyOverflow /></Beat>
    <Beat id="s07" t={129.1} dur={12.4}><Dial /></Beat>
    <Beat id="s08" t={145.54} dur={12.4}><CrossCurves /></Beat>
    <Beat id="s09" t={166.94} dur={7.6}><Day24 /></Beat>
    <Beat id="s10" t={176.46} dur={3.4}><LeverPellet /></Beat>
    <Beat id="s14" t={181.14} dur={5.0}><WiredHead /></Beat>
    <Beat id="s15" t={193.94} dur={6.0}><SlotLoop /></Beat>
    <Beat id="s16" t={204.56} dur={5.4}><PhoneFaceDown /></Beat>
    <Beat id="s17" t={214.56} dur={7.2}><BrainWedge /></Beat>
    <Beat id="s18" t={232.38} dur={6.8}><FlatThenRise /></Beat>
    <Beat id="s19" t={252.84} dur={6.6}><SpikeThenFlat /></Beat>
    <Beat id="s20" t={300.36} dur={8.8}><CrowdShaded /></Beat>
    <Beat id="s21" t={313.96} dur={5.2}><ChoreSpark /></Beat>
    <Beat id="s22" t={344.08} dur={5.2}><PlayMirror /></Beat>
    <Beat id="s24" t={396.64} dur={6.4}><CounterTally /></Beat>

    {/* ── captions ───────────────────────────────────────────────────────── */}
    <Captions cards={cards as { s: number; e: number; lines: string[] }[]} />
  </AbsoluteFill>
);
