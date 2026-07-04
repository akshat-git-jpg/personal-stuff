import { z } from "zod";

// Per-template data shapes — these define what goes in plan.json for each cutaway.

export const TitleSchema = z.object({
  category: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  // Platforms get a logo + vs row on the title card. icon is a path relative to
  // public/ (e.g., "logos/hostinger.svg"). If icon is missing or fails to load,
  // the name renders in a styled text pill instead.
  platforms: z
    .array(
      z.object({
        name: z.string(),
        icon: z.string().optional(),
      }),
    )
    .optional(),
});

export const TocSchema = z.object({
  eyebrow: z.string().default("In this video"),
  items: z.array(z.object({ label: z.string() })).min(2).max(8),
});

export const SectionSchema = z.object({
  number: z.string(),
  title: z.string(),
});

// Comparison cell can be a checkmark, a cross, or an explicit value string.
export const ComparisonSchema = z.object({
  eyebrow: z.string().default("Side by side"),
  tools: z.array(z.string()).min(2).max(5),
  rows: z.array(
    z.object({
      feature: z.string(),
      values: z.array(z.string()), // "✓", "✗", or an actual value like "$8.99"
    }),
  ),
  winnerColumn: z.number().int().nonnegative().optional(),
});

export const PricingSchema = z.object({
  eyebrow: z.string().default("Production cost / month"),
  unit: z.string().default("$"),
  items: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        note: z.string().optional(),
        winner: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(6),
});

export const VerdictSchema = z.object({
  eyebrow: z.string().default("My pick"),
  winner: z.string(),
  reason: z.string().optional(),
});

export const CtaSchema = z.object({
  eyebrow: z.string().default("Use code"),
  code: z.string(),
  discount: z.string().optional(),
  cta: z.string().default("Link in description"),
});

// =============================================================================
// Overlays — rendered on top of screen recordings (transparent BG, ProRes 4444).
// =============================================================================

export const SectionProgressBarSchema = z.object({
  sectionNumber: z.number().int().min(1).max(99),
  totalSections: z.number().int().min(1).max(99),
  platformName: z.string().min(1),
});

export const LinkInDescriptionSchema = z.object({
  message: z.string().optional(),
});

export const SpotlightSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  cornerRadius: z.number().optional(),
  dimOpacity: z.number().optional(),
});

// The plan.json envelope: identifies the video and lists every scene in order.
export const SceneSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), data: TitleSchema }),
  z.object({ type: z.literal("toc"), data: TocSchema }),
  z.object({ type: z.literal("section"), data: SectionSchema }),
  z.object({ type: z.literal("comparison"), data: ComparisonSchema }),
  z.object({ type: z.literal("pricing"), data: PricingSchema }),
  z.object({ type: z.literal("verdict"), data: VerdictSchema }),
  z.object({ type: z.literal("cta"), data: CtaSchema }),
]);

export const PlanSchema = z.object({
  slug: z.string(),
  title: z.string(),
  scenes: z.array(SceneSchema),
});

export type Plan = z.infer<typeof PlanSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type TitleData = z.infer<typeof TitleSchema>;
export type TocData = z.infer<typeof TocSchema>;
export type SectionData = z.infer<typeof SectionSchema>;
export type ComparisonData = z.infer<typeof ComparisonSchema>;
export type PricingData = z.infer<typeof PricingSchema>;
export type VerdictData = z.infer<typeof VerdictSchema>;
export type CtaData = z.infer<typeof CtaSchema>;
