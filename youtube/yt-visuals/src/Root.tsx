import "./index.css";
import React from "react";
import { Composition, Series, AbsoluteFill } from "remotion";
import { z } from "zod";

import { TitleCard } from "./templates/TitleCard";
import { TitleCardA, TitleCardB, TitleCardC } from "./templates/TitleCardVariants";
import { TableOfContents } from "./templates/TableOfContents";
import { SectionDivider } from "./templates/SectionDivider";
import { SectionDividerB, SectionDividerC, SectionDividerD } from "./templates/SectionDividerVariants";
import { ComparisonTable } from "./templates/ComparisonTable";
import { ComparisonTableA, ComparisonTableB, ComparisonTableC } from "./templates/ComparisonTableVariants";
import { ComparisonSurvival, ComparisonBracket, ComparisonRadar, ComparisonTierList } from "./templates/ComparisonNewVariants";
import { PricingBars } from "./templates/PricingBars";
import { Verdict } from "./templates/Verdict";
import { VerdictTrophy, VerdictReportCard, VerdictBadges } from "./templates/VerdictVariants";
import { CtaDiscount } from "./templates/CtaDiscount";
import { SectionProgressBar } from "./overlays/SectionProgressBar";
import { LinkInDescription } from "./overlays/LinkInDescription";
import {
  LinkPill,
  LinkTicket,
  LinkBracket,
  LinkUnderline,
  LinkHighlightBar,
  LinkTag,
} from "./overlays/LinkInDescriptionVariants";
import { Spotlight } from "./overlays/Spotlight";

import {
  TitleSchema,
  TocSchema,
  SectionSchema,
  ComparisonSchema,
  PricingSchema,
  VerdictSchema,
  CtaSchema,
  PlanSchema,
  SectionProgressBarSchema,
  LinkInDescriptionSchema,
  SpotlightSchema,
  type Plan,
} from "./schema";
import { sceneDurations, video } from "./design/theme";

// Default props for individual compositions (used in Studio preview).
const titleDefaults: z.infer<typeof TitleSchema> = {
  title: "Best n8n Self-Hosting in 2026",
  platforms: [
    { name: "Hostinger", icon: "logos/hostinger.svg" },
    { name: "Railway", icon: "logos/railway.svg" },
    { name: "Render", icon: "logos/render.svg" },
    { name: "DigitalOcean", icon: "logos/digitalocean.svg" },
    { name: "Heroku", icon: "logos/heroku.svg" },
    { name: "Amazon AWS", icon: "logos/amazonaws.svg" },
    { name: "Google Cloud", icon: "logos/googlecloud.svg" },
    { name: "Oracle Cloud", icon: "logos/oracle.svg" },
    { name: "Fly.io", icon: "logos/flydotio.svg" },
    { name: "Hetzner", icon: "logos/hetzner.svg" },
    { name: "Netcup", icon: "logos/netcup.svg" },
    { name: "Contabo", icon: "logos/contabo.svg" },
    { name: "Coolify", icon: "logos/coolify.svg" },
    { name: "Raspberry Pi", icon: "logos/raspberrypi.svg" },
    { name: "Synology", icon: "logos/synology.svg" },
  ],
};

const tocDefaults: z.infer<typeof TocSchema> = {
  eyebrow: "In this video",
  items: [
    { label: "Eliminated — and why" },
    { label: "Situational picks" },
    { label: "Worth considering" },
    { label: "The four winners" },
  ],
};

const sectionDefaults: z.infer<typeof SectionSchema> = {
  number: "02",
  title: "The Winners",
};

const comparisonDefaults: z.infer<typeof ComparisonSchema> = {
  eyebrow: "The four winners",
  tools: ["Hostinger", "Railway", "DigitalOcean", "Coolify"],
  rows: [
    { feature: "One-click n8n template", values: ["✓", "✓", "✗", "✓"] },
    { feature: "Predictable monthly cost", values: ["$8.99", "$40–60", "$24", "$8.99"] },
    { feature: "No CLI required", values: ["✓", "✓", "✗", "✓"] },
    { feature: "Scales with your business", values: ["✓", "✓", "✓", "✓"] },
  ],
  winnerColumn: 0,
};

const pricingDefaults: z.infer<typeof PricingSchema> = {
  eyebrow: "Production cost / month",
  unit: "$",
  items: [
    { label: "Hostinger", value: 8.99, winner: true, note: "KVM 2 · 24-mo" },
    { label: "Render", value: 32, winner: false },
    { label: "Railway", value: 50, winner: false },
    { label: "Heroku", value: 70, winner: false },
  ],
};

const verdictDefaults: z.infer<typeof VerdictSchema> = {
  eyebrow: "Winner #1",
  winner: "Hostinger",
  reason: "Easiest setup, lowest cost, built for n8n. Right for most people.",
};

const ctaDefaults: z.infer<typeof CtaSchema> = {
  eyebrow: "Exclusive discount with code",
  code: "AGROLLOO",
  discount: "Save on Hostinger KVM 2",
  cta: "Link in description",
};

const sectionProgressDefaults: z.infer<typeof SectionProgressBarSchema> = {
  sectionNumber: 2,
  totalSections: 5,
  platformName: "Hostinger",
};

const linkInDescriptionDefaults: z.infer<typeof LinkInDescriptionSchema> = {
  message: "Link in description",
};

const spotlightDefaults: z.infer<typeof SpotlightSchema> = {
  // Defaults render a centered 900x560 cutout — editor moves/scales in NLE.
};

const dur = (sec: number) => Math.round(sec * video.fps);

// Preview reel: plays every scene back-to-back. Duration computed via calculateMetadata.
const PreviewSchema = z.object({ plan: PlanSchema });
type PreviewProps = z.infer<typeof PreviewSchema>;

const PreviewReel: React.FC<PreviewProps> = ({ plan }) => {
  return (
    <AbsoluteFill>
      <Series>
        {plan.scenes.map((scene, i) => {
          const sceneDur = (() => {
            switch (scene.type) {
              case "title": return dur(sceneDurations.title);
              case "toc": return dur(sceneDurations.toc);
              case "section": return dur(sceneDurations.sectionDivider);
              case "comparison": return dur(sceneDurations.comparisonTable);
              case "pricing": return dur(sceneDurations.pricingBars);
              case "verdict": return dur(sceneDurations.verdict);
              case "cta": return dur(sceneDurations.ctaDiscount);
            }
          })();
          return (
            <Series.Sequence key={i} durationInFrames={sceneDur}>
              {scene.type === "title" && <TitleCard {...scene.data} />}
              {scene.type === "toc" && <TableOfContents {...scene.data} />}
              {scene.type === "section" && <SectionDivider {...scene.data} />}
              {scene.type === "comparison" && <ComparisonTable {...scene.data} />}
              {scene.type === "pricing" && <PricingBars {...scene.data} />}
              {scene.type === "verdict" && <Verdict {...scene.data} />}
              {scene.type === "cta" && <CtaDiscount {...scene.data} />}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

const previewDefaultPlan: Plan = {
  slug: "n8n-hosting",
  title: "Best n8n Self-Hosting in 2026",
  scenes: [
    { type: "title", data: titleDefaults },
    { type: "toc", data: tocDefaults },
    { type: "section", data: sectionDefaults },
    { type: "comparison", data: comparisonDefaults },
    { type: "pricing", data: pricingDefaults },
    { type: "verdict", data: verdictDefaults },
    { type: "cta", data: ctaDefaults },
  ],
};

const previewTotalDuration = previewDefaultPlan.scenes.reduce((acc, scene) => {
  switch (scene.type) {
    case "title": return acc + dur(sceneDurations.title);
    case "toc": return acc + dur(sceneDurations.toc);
    case "section": return acc + dur(sceneDurations.sectionDivider);
    case "comparison": return acc + dur(sceneDurations.comparisonTable);
    case "pricing": return acc + dur(sceneDurations.pricingBars);
    case "verdict": return acc + dur(sceneDurations.verdict);
    case "cta": return acc + dur(sceneDurations.ctaDiscount);
  }
}, 0);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Title"
        component={TitleCard}
        schema={TitleSchema}
        defaultProps={titleDefaults}
        durationInFrames={dur(sceneDurations.title)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="TitleA"
        component={TitleCardA}
        schema={TitleSchema}
        defaultProps={titleDefaults}
        durationInFrames={dur(sceneDurations.title)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="TitleB"
        component={TitleCardB}
        schema={TitleSchema}
        defaultProps={titleDefaults}
        durationInFrames={dur(sceneDurations.title)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="TitleC"
        component={TitleCardC}
        schema={TitleSchema}
        defaultProps={titleDefaults}
        durationInFrames={dur(sceneDurations.title)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Toc"
        component={TableOfContents}
        schema={TocSchema}
        defaultProps={tocDefaults}
        durationInFrames={dur(sceneDurations.toc)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Section"
        component={SectionDivider}
        schema={SectionSchema}
        defaultProps={sectionDefaults}
        durationInFrames={dur(sceneDurations.sectionDivider)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="SectionB"
        component={SectionDividerB}
        schema={SectionSchema}
        defaultProps={sectionDefaults}
        durationInFrames={dur(5)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="SectionC"
        component={SectionDividerC}
        schema={SectionSchema}
        defaultProps={sectionDefaults}
        durationInFrames={dur(5)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="SectionD"
        component={SectionDividerD}
        schema={SectionSchema}
        defaultProps={sectionDefaults}
        durationInFrames={dur(5)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Comparison"
        component={ComparisonTable}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonA"
        component={ComparisonTableA}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonB"
        component={ComparisonTableB}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonC"
        component={ComparisonTableC}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonSurvival"
        component={ComparisonSurvival}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonBracket"
        component={ComparisonBracket}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonRadar"
        component={ComparisonRadar}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="ComparisonTierList"
        component={ComparisonTierList}
        schema={ComparisonSchema}
        defaultProps={comparisonDefaults}
        durationInFrames={dur(sceneDurations.comparisonTable)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Pricing"
        component={PricingBars}
        schema={PricingSchema}
        defaultProps={pricingDefaults}
        durationInFrames={dur(sceneDurations.pricingBars)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Verdict"
        component={Verdict}
        schema={VerdictSchema}
        defaultProps={verdictDefaults}
        durationInFrames={dur(sceneDurations.verdict)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="VerdictTrophy"
        component={VerdictTrophy}
        schema={VerdictSchema}
        defaultProps={verdictDefaults}
        durationInFrames={dur(7)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="VerdictReportCard"
        component={VerdictReportCard}
        schema={VerdictSchema}
        defaultProps={verdictDefaults}
        durationInFrames={dur(7)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="VerdictBadges"
        component={VerdictBadges}
        schema={VerdictSchema}
        defaultProps={verdictDefaults}
        durationInFrames={dur(8)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Cta"
        component={CtaDiscount}
        schema={CtaSchema}
        defaultProps={ctaDefaults}
        durationInFrames={dur(sceneDurations.ctaDiscount)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="Preview"
        component={PreviewReel}
        schema={PreviewSchema}
        defaultProps={{ plan: previewDefaultPlan }}
        durationInFrames={previewTotalDuration}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />

      {/* Overlays — render to ProRes 4444 .mov for alpha. */}
      <Composition
        id="OverlaySectionProgressBar"
        component={SectionProgressBar}
        schema={SectionProgressBarSchema}
        defaultProps={sectionProgressDefaults}
        durationInFrames={dur(10)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />
      <Composition
        id="OverlayLinkInDescription"
        component={LinkInDescription}
        schema={LinkInDescriptionSchema}
        defaultProps={linkInDescriptionDefaults}
        durationInFrames={dur(4)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />

      <Composition
        id="OverlaySpotlight"
        component={Spotlight}
        schema={SpotlightSchema}
        defaultProps={spotlightDefaults}
        durationInFrames={dur(5)}
        fps={video.fps}
        width={video.width}
        height={video.height}
      />

      {/* Static option variants for "link in description" — pick one, then animate. */}
      {[
        { id: "OverlayLinkPill",         component: LinkPill },
        { id: "OverlayLinkTicket",       component: LinkTicket },
        { id: "OverlayLinkBracket",      component: LinkBracket },
        { id: "OverlayLinkUnderline",    component: LinkUnderline },
        { id: "OverlayLinkHighlightBar", component: LinkHighlightBar },
        { id: "OverlayLinkTag",          component: LinkTag },
      ].map(({ id, component }) => (
        <Composition
          key={id}
          id={id}
          component={component}
          durationInFrames={dur(3)}
          fps={video.fps}
          width={video.width}
          height={video.height}
        />
      ))}
    </>
  );
};
