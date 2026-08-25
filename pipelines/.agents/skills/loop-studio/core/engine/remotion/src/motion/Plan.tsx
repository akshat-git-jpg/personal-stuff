import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { RAISIN, MONO, LIME, EASE, clamp } from "./kit";
import { LineChart } from "./viz/LineChart";
import { Comparison } from "./viz/Comparison";
import { Hero } from "./viz/Hero";
import { KpiStats } from "./viz/KpiStats";
import { BarChart } from "./viz/BarChart";
import { Network } from "./viz/Network";
import { LayerStack } from "./viz/LayerStack";
import { ProcessFlow } from "./viz/ProcessFlow";
import { KineticText } from "./viz/KineticText";
import { ScreenshotFlyIn } from "./viz/ScreenshotFlyIn";
import { ShortsFeed } from "./viz/ShortsFeed";
import { NoiseGrid } from "./viz/NoiseGrid";
import { DegreeCard } from "./viz/DegreeCard";
import { StepRoadmap } from "./viz/StepRoadmap";
import { BuilderSplit } from "./viz/BuilderSplit";
import { BuildVsLearnOverlay } from "./viz/BuildVsLearnOverlay";
import { Loop } from "./viz/Loop";
import { Heatmap } from "./viz/Heatmap";
import { StrikeList } from "./viz/StrikeList";
import { DualLine } from "./viz/DualLine";
import { SourceHeadline } from "./viz/SourceHeadline";
import { StrikeOverlay } from "./viz/StrikeOverlay";
import { StatBadge } from "./viz/StatBadge";
import { LowerThird } from "./viz/LowerThird";
import { WhileYouSleep } from "./viz/WhileYouSleep";
import { Collapse } from "./viz/Collapse";
import { BrainBuild } from "./viz/BrainBuild";
import { GrindClock } from "./viz/GrindClock";
import { Orchestra } from "./viz/Orchestra";
import { StreamsToOne } from "./viz/StreamsToOne";
import { PriceDrop } from "./viz/PriceDrop";
import { AutomationDead } from "./viz/AutomationDead";
import { AssemblyLine } from "./viz/AssemblyLine";
import { ScanResolve } from "./viz/ScanResolve";
import { WhackAMole } from "./viz/WhackAMole";
import { KeywordPop } from "./viz/KeywordPop";
import { CornerCounter } from "./viz/CornerCounter";
import { RunawayMeter } from "./viz/RunawayMeter";

/* The viz catalog registry. Keys are the names the director emits in a plan. */
export const REGISTRY: Record<string, React.FC<any>> = {
  hero: Hero,
  loop: Loop,
  heatmap: Heatmap,
  strikeList: StrikeList,
  dualLine: DualLine,
  sourceHeadline: SourceHeadline,
  strikeOverlay: StrikeOverlay,
  statBadge: StatBadge,
  lowerThird: LowerThird,
  whileYouSleep: WhileYouSleep,
  collapse: Collapse,
  brainBuild: BrainBuild,
  grindClock: GrindClock,
  orchestra: Orchestra,
  streamsToOne: StreamsToOne,
  priceDrop: PriceDrop,
  automationDead: AutomationDead,
  assemblyLine: AssemblyLine,
  scanResolve: ScanResolve,
  whackAMole: WhackAMole,
  keywordPop: KeywordPop,
  cornerCounter: CornerCounter,
  runawayMeter: RunawayMeter,
  network: Network,
  lineChart: LineChart,
  barChart: BarChart,
  kpiStats: KpiStats,
  layerStack: LayerStack,
  processFlow: ProcessFlow,
  kineticText: KineticText,
  screenshotFlyIn: ScreenshotFlyIn,
  shortsFeed: ShortsFeed,
  noiseGrid: NoiseGrid,
  degreeCard: DegreeCard,
  stepRoadmap: StepRoadmap,
  builderSplit: BuilderSplit,
  buildVsLearnOverlay: BuildVsLearnOverlay,
  comparison: Comparison,
};

export type Scene = { viz: string; props: any; durationInFrames: number; trans?: TransType };
export type PlanProps = { scenes: Scene[]; transparent?: boolean };

/* ============================================================================
   BOLD-KINETIC scene transitions (2026-07-01)
   Scenes OVERLAP by SEG frames so the outgoing scene and incoming scene coexist
   during the cut — that's what makes a push actually push and a wipe cover a
   real seam. Transition per boundary: push-through (kinetic default), lime-wipe
   (section breaks), blur-dissolve (tonal / light-scene changes).
============================================================================ */
const SEG = 13;                 // transition length == scene overlap
const W = 1920;
type TransType = "push" | "wipe" | "dissolve";

/* overlapped total: sum(dur) - (n-1)*SEG */
export const planDuration = (scenes: Scene[], overlapped = true) => {
  const sum = scenes.reduce((a, s) => a + (s.durationInFrames || 0), 0);
  return Math.max(1, overlapped ? sum - Math.max(0, scenes.length - 1) * SEG : sum);
};

/* the transition entering scene i (also the one leaving scene i-1). */
function boundaryTrans(scenes: Scene[], i: number): TransType {
  if (i <= 0) return "dissolve";
  const s = scenes[i], p = scenes[i - 1];
  if (s.trans) return s.trans;
  const lightSeam = s.props?.bg === "grid-light" || p.props?.bg === "grid-light";
  if (lightSeam) return "dissolve";        // tonal change reads best as a dissolve
  if (i % 5 === 0) return "wipe";           // lime section break every 5th cut
  return "push";                            // kinetic default
}

const eased = (local: number) =>
  interpolate(local, [0, SEG], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

type Mo = { opacity: number; tx: number; blur: number; scale: number };
const HOLD: Mo = { opacity: 1, tx: 0, blur: 0, scale: 1 };

function inMo(local: number, t: TransType): Mo {
  const p = eased(local);
  if (t === "push") return { opacity: clamp(p * 2.2, 0, 1), tx: (1 - p) * W * 0.55, blur: (1 - p) * 10, scale: 1 };
  if (t === "wipe") return { opacity: 1, tx: 0, blur: 0, scale: 1 }; // the lime block does the work
  return { opacity: p, tx: 0, blur: (1 - p) * 6, scale: 0.995 + p * 0.005 }; // dissolve
}
function outMo(local: number, t: TransType): Mo {
  const q = eased(local);
  if (t === "push") return { opacity: clamp((1 - q) * 2.2, 0, 1), tx: -q * W * 0.55, blur: q * 10, scale: 1 };
  if (t === "wipe") return { opacity: 1, tx: 0, blur: 0, scale: 1 };
  return { opacity: 1 - q, tx: 0, blur: q * 6, scale: 1 }; // dissolve
}

const SceneWrap: React.FC<{ dur: number; inT: TransType; outT: TransType; children: React.ReactNode }> = ({
  dur, inT, outT, children,
}) => {
  const frame = useCurrentFrame();
  const mo: Mo = frame < SEG ? inMo(frame, inT) : frame > dur - SEG ? outMo(frame - (dur - SEG), outT) : HOLD;
  return (
    <AbsoluteFill
      style={{
        opacity: mo.opacity,
        transform: `translateX(${mo.tx}px) scale(${mo.scale})`,
        filter: mo.blur > 0.15 ? `blur(${mo.blur}px)` : undefined,
        willChange: "transform, filter, opacity",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* a lime block that sweeps across the seam (skewed leading edge → dynamic). */
const WipeInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = clamp(frame / durationInFrames, 0, 1);
  const x = interpolate(p, [0, 0.5, 1], [-140, -18, 118], { easing: EASE });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -20, bottom: -20, left: `${x}%`, width: "140%", background: LIME, transform: "skewX(-9deg)", boxShadow: `0 0 80px ${LIME}` }} />
    </AbsoluteFill>
  );
};

const MissingViz: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill style={{ backgroundColor: RAISIN, justifyContent: "center", alignItems: "center" }}>
    <div style={{ fontFamily: MONO, color: LIME, fontSize: 28 }}>unknown viz: "{name}"</div>
  </AbsoluteFill>
);

export const Plan: React.FC<PlanProps> = ({ scenes, transparent }) => {
  // OVERLAYS (transparent, over footage): no scene-level push/wipe — each overlay
  // already carries its own cineReveal in/out. Keep them simple + non-overlapping.
  if (transparent) {
    let acc = 0;
    return (
      <AbsoluteFill>
        {scenes.map((s, i) => {
          const from = acc;
          acc += s.durationInFrames;
          const Comp = REGISTRY[s.viz];
          return (
            <Sequence key={i} from={from} durationInFrames={s.durationInFrames}>
              {Comp ? <Comp {...s.props} /> : <MissingViz name={s.viz} />}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );
  }

  // TAKEOVER REEL: overlapping sequences + kinetic transitions.
  const starts: number[] = [];
  let acc = 0;
  scenes.forEach((s, i) => { starts[i] = acc; acc += s.durationInFrames - SEG; });
  const wipes = scenes.map((_, i) => (i > 0 && boundaryTrans(scenes, i) === "wipe" ? starts[i] : -1)).filter((f) => f >= 0);

  return (
    <AbsoluteFill style={{ backgroundColor: RAISIN }}>
      {scenes.map((s, i) => {
        const Comp = REGISTRY[s.viz];
        const inT = boundaryTrans(scenes, i);
        const outT = i < scenes.length - 1 ? boundaryTrans(scenes, i + 1) : "dissolve";
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={s.durationInFrames}>
            <SceneWrap dur={s.durationInFrames} inT={inT} outT={outT}>
              {Comp ? <Comp {...s.props} /> : <MissingViz name={s.viz} />}
            </SceneWrap>
          </Sequence>
        );
      })}
      {wipes.map((f, k) => (
        <Sequence key={`w${k}`} from={f - SEG} durationInFrames={SEG * 2 + 1}>
          <WipeInner />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
