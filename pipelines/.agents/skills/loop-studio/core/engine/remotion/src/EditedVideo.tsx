import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
} from "remotion";
import { TitleCard } from "./templates/TitleCard";
import { VerticalTimeline, type VerticalTimelineItem } from "./templates/VerticalTimeline";
import { HorizontalTimeline, type HorizontalTimelineStep } from "./templates/HorizontalTimeline";
import { Callout } from "./templates/Callout";
import { KineticStatement, type KineticWord } from "./templates/KineticStatement";
import {
  ConceptBuild,
  type ConceptElement,
  type ConceptConnector,
} from "./templates/ConceptBuild";
import { StatPunch } from "./templates/StatPunch";
import { QuotePull } from "./templates/QuotePull";
import { VsSplit } from "./templates/VsSplit";
import { KeywordChips, type KeywordChip } from "./templates/KeywordChips";
import { ProgressSteps, type ProgressStep } from "./templates/ProgressSteps";
import { ChapterBar } from "./templates/ChapterBar";
import { AIImageOnGrid } from "./templates/AIImageOnGrid";
import { MetricReveal } from "./templates/MetricReveal";
import { NotificationToast } from "./templates/NotificationToast";
import { ChatMessage, type ChatMessageItem } from "./templates/ChatMessage";
import { StatGrid, type StatGridItem } from "./templates/StatGrid";
import { FlowDiagram, type FlowDiagramNode } from "./templates/FlowDiagram";
import { NetworkSpread, type SpreadNode } from "./templates/NetworkSpread";
import { CommandDeck, type DeckTile } from "./templates/CommandDeck";
import { CalendarMonths } from "./templates/CalendarMonths";
import { LayerStack, type StackLayer } from "./templates/LayerStack";
import { BulletedList, type BulletedListItem } from "./templates/BulletedList";
import { WordPop, type WordPopItem } from "./templates/WordPop";
import { HookTitle } from "./templates/HookTitle";
import { CinematicHook } from "./templates/CinematicHook";
import { SubscribeButton } from "./templates/SubscribeButton";
import { ImageCard } from "./templates/ImageCard";
import { ColorGrade, GRADE_FILTER } from "./templates/ColorGrade";
import { HeadlineCard } from "./templates/HeadlineCard";
import { BarOverlay, type BarOverlayItem } from "./templates/BarOverlay";
import { BulletBurst, type BulletBurstItem } from "./templates/BulletBurst";
import { PortraitBurst, type PortraitBurstItem } from "./templates/PortraitBurst";
import { ToolLogoBurst, type ToolLogoItem } from "./templates/ToolLogoBurst";
import { BrollPicker, type BrollPickerItem } from "./templates/BrollPicker";
import { PasswordType } from "./templates/PasswordType";
import { AgentAvatarBurst, type AgentAvatarItem } from "./templates/AgentAvatarBurst";
import { OrgDiagram, type OrgDiagramNode } from "./templates/OrgDiagram";
import { ClaudeCodeTerminal, type ClaudeCodeLine } from "./templates/ClaudeCodeTerminal";
import { InlineChart } from "./templates/InlineChart";
// Cinematic motion engine (the new high-quality, content-driven viz layer).
import { REGISTRY as MOTION_REGISTRY } from "./motion/Plan";
import { Fade as MotionFade } from "./motion/kit";
import { RatioDots } from "./templates/RatioDots";
import { DashboardCard, type DashboardStat } from "./templates/DashboardCard";
import { ComparisonGrid, type ComparisonGridColumn, type ComparisonGridRow } from "./templates/ComparisonGrid";
import { BarChart, type BarChartItem } from "./templates/BarChart";
import { NetworkDiagram, type NetworkNode, type NetworkEdge } from "./templates/NetworkDiagram";
import { AnnotatedScreenshot, type AnnotationHighlight } from "./templates/AnnotatedScreenshot";
import { CinematicTitle } from "./templates/CinematicTitle";
import { TickerFeed, type TickerItem } from "./templates/TickerFeed";
import { SplitReveal } from "./templates/SplitReveal";
import { LowerThird } from "./templates/LowerThird";
import { CornerStat } from "./templates/CornerStat";
import { SidePanel, type SidePanelItem } from "./templates/SidePanel";
import { Captions, type CaptionLine } from "./templates/Captions";
import { DarkGridBg } from "./templates/Backgrounds";

const resolveSrc = (s: string): string => /^https?:\/\//i.test(s) ? s : staticFile(s);

export type BRoll = {
  start_sec: number;
  end_sec: number;
  /** REQUIRED on every entry: one-line justification for why this visual appears at this beat. */
  reason?: string;
  /** For static/icon/video: file path. Not used for "list". */
  image_path?: string;
  /**
   *  Existing legacy kinds:
   *  "static"            full-screen image takeover (default)
   *  "video"             pre-animated mp4 (Seedance) — plays through full-screen
   *  "icon"              small floating card overlay; default anchor is true-center
   *  "list"              programmatic numbered list (no image needed)
   *
   *  Template-library kinds (see knowledge/template_library.md):
   *  "title_card"        big number + bold uppercase title — section openers
   *  "vertical_timeline" 3–5 sequential steps with heading + description
   *  "callout"           single statement with one phrase highlighted
   *  "stat_punch"        one huge number anchored center, supporting caption
   *  "quote_pull"        typewriter quote on dark grid, with attribution
   *  "vs_split"          stacked top/bottom contrast (light grid vs blue grid)
   *  "keyword_chips"     pill-shaped tags as speaker name-drops
   *  "progress_steps"    numbered chain that fills with lime as speaker advances
   *  "chapter_bar"       bottom-third chapter marker, holds 6–10s
   *  "ai_image_on_grid"  AI image generated WITH brand bg as init image, full-bleed
   */
  kind?:
    | "static"
    | "video"
    | "icon"
    | "list"
    | "title_card"
    | "vertical_timeline"
    | "horizontal_timeline"
    | "callout"
    | "stat_punch"
    | "quote_pull"
    | "vs_split"
    | "keyword_chips"
    | "progress_steps"
    | "chapter_bar"
    | "ai_image_on_grid"
    | "metric_reveal"
    | "notification_toast"
    | "chat_message"
    | "stat_grid"
    | "flow_diagram"
    | "bulleted_list"
    | "comparison_grid"
    | "bar_chart"
    | "network_diagram"
    | "annotated_screenshot"
    | "cinematic_title"
    | "ticker_feed"
    | "split_reveal"
    | "lower_third"
    | "corner_stat"
    | "side_panel"
    | "word_pop"
    | "hook_title"
    | "subscribe"
    | "image_card"
    | "headline_card"
    | "bar_overlay"
    | "bullet_burst"
    | "portrait_burst"
    | "tool_logo_burst"
    | "broll_picker"
    | "password_type"
    | "agent_avatar_burst"
    | "org_diagram"
    | "claude_code_terminal"
    | "inline_chart"
    | "ratio_dots"
    | "dashboard_card"
    | "kinetic_statement"
    | "concept_build"
    | "network_spread"
    | "command_deck"
    | "calendar_months"
    | "layer_stack";
  /** For icon kind: where to anchor it. Default "center" (true vertical+horizontal center). */
  anchor?: "center" | "top-left" | "top-right" | "top-center" | "bottom-left" | "bottom-right";
  /** For icon kind: scale factor relative to frame width (0.0–1.0). Default 0.65 for center, 0.55 for corners. */
  size?: number;
  /** For icon kind: when true, skip the white rounded-card wrapper and render
   *  ONLY the image (with rounded corners + soft drop shadow). Use for assets
   *  that already have their own background/branding (logos, screenshots,
   *  marks). Speaker stays visible around the icon. */
  bare?: boolean;
  /** For icon kind: image aspect ratio (width/height). Defaults to 1 (square).
   *  Set this for wide logos / banners — e.g. 2.0 for a 2:1 logo so the box
   *  doesn't letterbox the image with empty space. */
  aspect?: number;
  /** For "list" kind: optional title above the list. */
  title?: string;
  /** For "list" kind: array of bullet items; rendered as numbered rows.
   *  Each item can be either a plain string (auto-staggered, fast reveal — only
   *  appropriate when the speaker says all items in tight succession), or an
   *  object with explicit timing so each row appears EXACTLY when the speaker
   *  starts saying it. Use the object form whenever the items are spaced more
   *  than ~1.5s apart so the list doesn't spoil upcoming points. `appear_sec`
   *  is absolute (in source-video time), not relative to the list's start.
   */
  items?: Array<string | { text: string; appear_sec?: number }>;
  /** For static/icon: how to fit the image to the frame.
   *  "contain" (default) = letterbox so whole image is visible; raisin black backdrop fills empty space.
   *  "cover"             = crop edges to fill the frame. Only use when the image was authored
   *                        edge-to-edge at the source's aspect ratio.
   */
  fit?: "contain" | "cover";
  /** For `static` only: render the image at this fraction of the frame, centered,
   *  with the on-brand DARK grid backdrop (gradient + lime grid lines) visible
   *  around it. Disables Ken Burns breathing — image stays at the chosen
   *  scale. Use for screenshots that lose information when full-bleed +
   *  zoomed (every dashboard, terminal, doc). 0 (default) = full bleed.
   *  Recommended values: 0.10–0.18 (image takes 64–80% of frame). */
  inset?: number;
  /** Provenance tag: "real-screenshot" | "stock" | "generated". For audit/observability. */
  source?: "real-screenshot" | "stock" | "generated";
  prompt?: string;

  // ─── Template-library specific props ───────────────────────────────────
  /** title_card: big lime number ("5", "01"), title text, optional subtitle. */
  number?: string;
  subtitle?: string;
  /** vertical_timeline AND horizontal_timeline: items with heading + description.
   *  Both templates accept the same shape — `appear_sec` is read by both. */
  steps?: VerticalTimelineItem[] | HorizontalTimelineStep[];
  /** callout: prefix + highlight (lime block) + optional suffix. */
  callout_prefix?: string;
  callout_highlight?: string;
  callout_suffix?: string;
  /** kinetic_statement: per-word VO-synced reveal. Each word carries its
   *  absolute spoken time (`appear_sec` from words.json) and an optional
   *  `emphasis` flag for the lime key words. */
  words?: KineticWord[];
  /** concept_build: free-form VO-synced explainer canvas — labeled elements at
   *  arbitrary positions + connectors between them, each revealed on its spoken
   *  beat. Use for structure/composition/metaphor builds. */
  elements?: ConceptElement[];
  connectors?: ConceptConnector[];
  /** network_spread: a glowing lime hub (`center_label`) radiating edges to a
   *  ring of `spokes` dots, with $ tokens flowing inward (sell-to-many /
   *  network-effect metaphor). */
  center_label?: string;
  center_glyph?: string;
  spokes?: SpreadNode[];
  flow?: "in" | "out" | "none";
  flow_glyph?: string;
  /** command_deck: an "AI OS" control panel that boots up a business
   *  department-by-department (the HOOK visual). Each tile carries a label,
   *  glyph, and absolute appear_sec. `brand` sets the title-bar chip. */
  tiles?: DeckTile[];
  brand?: string;
  /** calendar_months: a 3×3 grid of real mini-calendars for the last `count`
   *  months, filling lime in sequence. Uses `title` (hero, default "N MONTHS")
   *  and `caption`. */
  count?: number;
  /** layer_stack: an "under the hood" architecture stack — slabs that build
   *  bottom→top as each layer is named (`title` is the section header). */
  layers?: StackLayer[];
  /** Overlay mode (text kinds only — currently kinetic_statement, callout):
   *  render the text ON TOP of the talking-head video instead of as a
   *  full-screen takeover. The grid background is dropped, the type anchors to
   *  the lower third (below the face), and the beat is excluded from the
   *  coverage underlay so the speaker stays visible. Use for pure-text beats
   *  that don't need a heavy visual; leave structural visuals as takeovers. */
  overlay?: boolean;
  /** Card mode for `kind:"video"` beats (editorial b-roll look, 2026-06-11).
   *  The clip plays inside a rounded-corner card centered on a black field
   *  (16:9 footage breathes in the vertical frame instead of being cropped),
   *  with `caption` rendered over it in an elegant Playfair serif. A takeover
   *  (karaoke captions are auto-blacked-out for video beats), so the serif
   *  caption carries the spoken words. Pair with `vertical` to nudge the
   *  caption height (default 0.42). Reference: lifestyle-creator b-roll style. */
  card?: boolean;
  /** stat_punch: hero value + caption + optional pre-label.
   *  ALSO reused as the serif caption text for `card` video beats — supports
   *  "\n" line breaks; keep it lowercase + 1–2 short words per line. */
  value?: string;
  caption?: string;
  pre_label?: string;
  /** quote_pull: text + optional attribution + optional typewriter cadence. */
  quote_text?: string;
  attribution?: string;
  chars_per_second?: number;
  /** vs_split: top/bottom labels + items, winner side. */
  top_label?: string;
  top_items?: string[];
  bottom_label?: string;
  bottom_items?: string[];
  winner?: "top" | "bottom";
  /** keyword_chips: chips array (text + appear_sec + active). */
  chips?: KeywordChip[];
  /** progress_steps: steps array (label + appear_sec + active_sec). */
  progress?: ProgressStep[];
  /** chapter_bar: chapter number + title. */
  chapter_number?: string;
  chapter_title?: string;

  /** metric_reveal: pre-label + prefix + target + suffix + caption. */
  target?: number;
  decimals?: number;
  duration_sec?: number;

  /** notification_toast: app + title + body + time. */
  app_name?: string;
  app_icon?: string;
  body?: string;
  time?: string;

  /** chat_message: array of speech bubbles. */
  messages?: ChatMessageItem[];

  /** stat_grid: array of mini-stats (label + value). */
  stats?: StatGridItem[];

  /** flow_diagram: array of nodes connected with arrows. */
  nodes?: FlowDiagramNode[];

  /** bulleted_list: array of items with ✓/✗/• glyphs. */
  bullets?: BulletedListItem[];
  /** word_pop / hook_title: vertical anchor 0..1 (0 = top, 1 = bottom). */
  vertical?: number;
  /** hook_title: horizontal layout — "center", "left", or "flank". */
  align?: "center" | "left" | "flank";
  /** hook_title flank mode: text blocks flanking the speaker's face. */
  left_text?: string;
  right_text?: string;
  /** headline_card: the headline (supports \n + one {lime} span) + optional dek. */
  headline?: string;
  dek?: string;

  /** comparison_grid: column headers + feature rows. */
  columns?: ComparisonGridColumn[];
  rows?: ComparisonGridRow[];

  /** bar_chart: bars + optional max + optional orientation. */
  bars?: BarChartItem[];
  max?: number;
  orientation?: "horizontal" | "vertical";

  /** network_diagram: nodes + edges. */
  network_nodes?: NetworkNode[];
  network_edges?: NetworkEdge[];

  /** annotated_screenshot: highlight rectangles + zoom. */
  highlights?: AnnotationHighlight[];
  zoom_to_highlights?: boolean;

  /** cinematic_title: chapter / title / subtitle / kicker. */
  chapter?: string;
  kicker?: string;

  /** ticker_feed: items array. */
  ticker_items?: TickerItem[];

  /** split_reveal: before / after image paths + labels + timing. */
  before_image?: string;
  after_image?: string;
  before_label?: string;
  after_label?: string;
  wipe_start_sec?: number;
  wipe_duration_sec?: number;

  /** lower_third / side_panel / corner_stat: partial-overlay variants */
  side_items?: SidePanelItem[];

  /** word_pop / hook_title: when true, the speaker cutout (alpha matte) is
   *  painted on top of this beat so the text sits visually BEHIND the
   *  speaker — the premium "text-behind-subject" look. Requires a
   *  speakerCutoutSrc to be present; no-op without it. */
  behind_subject?: boolean;
};

export type ZoomMoment = {
  start_sec: number;
  end_sec: number;
  scale: number;
};

export type EditedVideoProps = {
  videoSrc: string;
  /** Optional job-relative path to the speaker cutout PNG sequence
   *  (frame_NNNNN.png, RGBA, background transparent) produced by
   *  scripts/segment_speaker.py. When present, beats flagged `behind_subject`
   *  get the matching frame painted on top so text sits behind the speaker.
   *  Omit / empty = text renders on top as normal. */
  speakerCutoutDir?: string;
  broll: BRoll[];
  zoom: ZoomMoment[];
  /** Optional per-frame follow-cam track (from build_followcam.py). When
   *  present it REPLACES the zoom punch-ins: the speaker layer pans + zooms
   *  every frame to drift with the speaker's movement. One entry per frame. */
  followCam?: Array<{ scale: number; tx: number; ty: number }>;
  /** YouTube-intro caption track. Empty array = no captions. The legacy
   *  shorts pipeline assumes captions are already burned into the source
   *  and passes []. Intro mode populates this with phrase-level lines. */
  captions?: CaptionLine[];
  styles: {
    kenBurnsIntensity: number;
    zoomEaseFrames: number;
  };
};

/**
 * Smooth ease-in-ease-out zoom timeline. Picks the highest-active scale.
 * Uses Easing.bezier(0.4, 0, 0.2, 1) — Material Design "standard" curve.
 */
const useGlobalZoom = (
  zoom: ZoomMoment[],
  fps: number,
  easeFrames: number,
): number => {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const easeT = easeFrames / fps;
  const ease = Easing.bezier(0.4, 0, 0.2, 1);
  let scale = 1;
  for (const m of zoom) {
    if (t < m.start_sec - easeT || t > m.end_sec + easeT) continue;
    let eff = 1;
    if (t < m.start_sec) {
      const k = ease((t - (m.start_sec - easeT)) / easeT);
      eff = 1 + (m.scale - 1) * k;
    } else if (t > m.end_sec) {
      const k = ease(1 - (t - m.end_sec) / easeT);
      eff = 1 + (m.scale - 1) * k;
    } else {
      eff = m.scale;
    }
    scale = Math.max(scale, eff);
  }
  return scale;
};

/** Full-screen static-image takeover, programmatic motion.
 *  Critical invariant: the raisin-black backdrop NEVER fades or transforms.
 *  Only the image foreground animates. Otherwise, when two takeovers play
 *  back-to-back, the entrance slide + exit fade of the wrapper expose the
 *  speaker through the gap.
 *
 *  When `broll.inset` is set (>0), we render in "card mode": the image sits
 *  at (1 - 2*inset) of the frame, centered, on the on-brand DARK grid
 *  backdrop. Ken Burns breathing is disabled in this mode so dashboard
 *  edges don't get cropped on the way through. */
const StaticOverlay: React.FC<{ broll: BRoll; intensity: number }> = ({ broll, intensity }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const durFrames = Math.max(1, Math.round((broll.end_sec - broll.start_sec) * fps));
  const entranceFrames = Math.min(18, Math.round(durFrames * 0.25));
  const entranceProgress = spring({
    frame,
    fps,
    durationInFrames: entranceFrames,
    config: { damping: 14, stiffness: 110, mass: 0.7 },
  });
  const slideY = interpolate(entranceProgress, [0, 1], [120, 0]);
  const scaleIn = interpolate(entranceProgress, [0, 1], [0.92, 1]);
  const inset = Math.max(0, Math.min(0.40, broll.inset ?? 0));
  const isCardMode = inset > 0;
  // Breathing is disabled in card mode so the screenshot doesn't crop edges.
  const breathing = isCardMode
    ? 1
    : interpolate(frame, [0, durFrames], [1, intensity], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
  const exitStart = durFrames - 8;
  const fgOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, durFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // In card mode the image lives inside an inset rectangle, centered.
  const cardInsetPx = {
    left: Math.round(width * inset),
    top: Math.round(height * inset),
    right: Math.round(width * inset),
    bottom: Math.round(height * inset),
  };
  const cardW = width - cardInsetPx.left - cardInsetPx.right;
  const cardH = height - cardInsetPx.top - cardInsetPx.bottom;
  const radius = Math.round(Math.min(width, height) * 0.014);

  return (
    <AbsoluteFill>
      {/* Stable backdrop — always full-frame, fully opaque. Never fades.
          Card mode swaps to the on-brand DARK grid; full-bleed mode keeps
          plain raisin so non-card screenshots still letterbox cleanly. */}
      {isCardMode ? <DarkGridBg /> : <AbsoluteFill style={{ backgroundColor: "#0F121A" }} />}

      {/* Animating image foreground. */}
      <AbsoluteFill style={{
        opacity: fgOpacity,
        transform: `translateY(${slideY}px) scale(${scaleIn * breathing})`,
        transformOrigin: "center",
      }}>
        {isCardMode ? (
          <Img
            src={resolveSrc(broll.image_path ?? "")}
            style={{
              position: "absolute",
              left: cardInsetPx.left,
              top: cardInsetPx.top,
              width: cardW,
              height: cardH,
              borderRadius: radius,
              objectFit: broll.fit ?? "contain",
              // Soft drop-shadow lifts the image off the grid without
              // creating a visible "frame" around it. No background fill,
              // no border — just the image floating on the brand grid.
              filter: `drop-shadow(0 ${Math.round(height * 0.014)}px ${Math.round(height * 0.034)}px rgba(0,0,0,0.45))`,
            }}
          />
        ) : (
          <Img
            src={resolveSrc(broll.image_path ?? "")}
            style={{
              width: "100%", height: "100%",
              // Default "contain" so the whole image is always visible. Override
              // per-beat with `fit: "cover"` only for edge-to-edge authored assets.
              objectFit: broll.fit ?? "contain",
            }}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Elegant editorial serif for the `card` b-roll caption (2026-06-11). Playfair
// Display matches the lifestyle-creator reference; Georgia/serif fall back if
// the webfont hasn't fetched by the first frames (reads close enough at pace).
const SERIF_CAPTION_STACK =
  "'Playfair Display', 'Baskerville', 'Georgia', 'Times New Roman', serif";
let __serifCaptionFontInjected = false;
const ensureSerifCaptionFontLoaded = () => {
  if (typeof document === "undefined" || __serifCaptionFontInjected) return;
  __serifCaptionFontInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&display=block";
  document.head.appendChild(link);
};

// Neo-lime brand accent for the one highlighted word in a card caption.
const NEO_LIME = "#CFFF05";
// Render caption text with `{...}` spans drawn in neo-lime (the brand-accent
// word), everything else white — same brace convention as WordPop's script
// spans, so a fragment like "be {sick}" pops just the payoff word.
function renderSerifSpans(text: string): React.ReactNode {
  return text.split(/(\{[^}]*\})/g).map((p, i) =>
    p.startsWith("{") && p.endsWith("}") ? (
      <span key={i} style={{ color: NEO_LIME }}>{p.slice(1, -1)}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

/** Full-screen video overlay (Seedance) — plays as-is with crossfade. Audio is muted
 *  so any sound the AI model generated doesn't leak into the speaker's mix.
 *  Same invariant as StaticOverlay: backdrop is stable, only the video fades. */
const VideoOverlay: React.FC<{ broll: BRoll }> = ({ broll }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const durFrames = Math.max(1, Math.round((broll.end_sec - broll.start_sec) * fps));
  const fadeFrames = 6;
  const fgOpacity = interpolate(
    frame, [0, fadeFrames, durFrames - fadeFrames, durFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // OVERLAY CARD MODE (overlay: true) — the clip plays inside a floating phone-card
  // anchored to one side, the speaker stays fully visible. Muted + dimmed so it reads
  // as an ambient "exhibit", never a takeover. Default = right side, portrait card.
  // Locked 2026-06-01: "videos should be overlay, not full screen — cleaner."
  if (broll.overlay) {
    // WIDE (landscape) CARD mode (wide: true) — a 16:9 screen-share / desktop
    // clip parked on ONE SIDE as a picture-in-picture, the speaker stays fully
    // visible beside it. For showing a screen recording next to the talking
    // head (2026-06-21: "show the screen share on the right while still showing
    // my face"). Distinct from the portrait phone-card below.
    if ((broll as { wide?: boolean }).wide) {
      const sizeFrac = broll.size ?? 0.40;             // card WIDTH as fraction of frame width
      const cW = Math.round(width * sizeFrac);
      // Card matches the SOURCE clip's aspect so a screen-recording fills it
      // edge-to-edge with no letterbox / black band (default 16:9). Pass
      // `aspect` = source width/height (e.g. a 3024x1890 app capture → 1.6).
      const aspectRatio = (broll as { aspect?: number }).aspect ?? 16 / 9;
      const cH = Math.round(cW / aspectRatio);
      const margin = Math.round(width * 0.035);
      const anchorRight = (broll.anchor ?? "right").includes("right");
      const cLeft = anchorRight ? width - cW - margin : margin;
      const vy = (broll as { overlay_y?: number }).overlay_y;
      const cTop =
        typeof vy === "number" ? Math.round(height * vy) : Math.round((height - cH) / 2);
      const radius = Math.round(Math.min(width, height) * 0.018);
      const slideIn = interpolate(frame, [0, fadeFrames + 4], [anchorRight ? 70 : -70, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {/* very light scrim — the FACE is the co-star here, NOT dimmed
              background, so keep it barely touched. */}
          <AbsoluteFill
            style={{ backgroundColor: "rgba(15,18,26,0.12)", opacity: fgOpacity }}
          />
          <div
            style={{
              position: "absolute",
              left: cLeft,
              top: cTop,
              width: cW,
              height: cH,
              opacity: fgOpacity,
              transform: `translateX(${slideIn}px)`,
              borderRadius: radius,
              overflow: "hidden",
              border: "2px solid rgba(207,255,5,0.45)",
              boxShadow: "0 26px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
              background: "#0F121A",
            }}
          >
            <OffthreadVideo
              src={resolveSrc(broll.image_path ?? "")}
              volume={0}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </AbsoluteFill>
      );
    }
    // FULL-FRAME ALPHA mode (fullframe: true) — the clip is a transparent (alpha)
    // overlay that fills the frame; its opaque pixels composite OVER the speaker,
    // its transparent pixels show the speaker through. No backdrop, no scrim, no
    // card. Used for animated lower-third strips (e.g. the build-up icon row).
    if ((broll as { fullframe?: boolean }).fullframe) {
      return (
        <AbsoluteFill style={{ pointerEvents: "none", opacity: fgOpacity }}>
          <OffthreadVideo
            src={resolveSrc(broll.image_path ?? "")}
            volume={0}
            transparent
            style={{ width: "100%", height: "100%", objectFit: "fill" }}
          />
        </AbsoluteFill>
      );
    }
    const sizeFrac = broll.size ?? 0.50;            // card height as fraction of frame height
    const cardH = Math.round(height * sizeFrac * 2.0); // portrait-ish; clamp below
    const cH = Math.min(cardH, Math.round(height * 0.96));
    const cW = Math.round(cH * 9 / 16);              // 9:16 phone
    const margin = Math.round(width * 0.04);
    const anchorRight = (broll.anchor ?? "top-right").includes("right") || broll.anchor === undefined;
    const left = anchorRight ? width - cW - margin : margin;
    const top = Math.round((height - cH) / 2);
    const radius = Math.round(Math.min(width, height) * 0.022);
    // entrance: fade + gentle slide-in from the anchored edge
    const slideIn = interpolate(frame, [0, fadeFrames + 4], [anchorRight ? 60 : -60, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {/* Subtle full-frame scrim — dims the SPEAKER a touch so the spotlight
            shifts to the short card, without hiding the speaker. Fades with the
            card. "A bit darker, not too much." Locked 2026-06-01. */}
        <AbsoluteFill style={{ backgroundColor: "rgba(15,18,26,0.30)", opacity: fgOpacity }} />
        <div style={{
          position: "absolute", left, top, width: cW, height: cH,
          opacity: fgOpacity, transform: `translateX(${slideIn}px)`,
          borderRadius: radius, overflow: "hidden",
          border: "2px solid rgba(207,255,5,0.45)",
          boxShadow: "0 26px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
          background: "#0F121A",
        }}>
          <OffthreadVideo
            src={resolveSrc(broll.image_path ?? "")}
            volume={0}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.92) saturate(1.0)" }}
          />
          {/* very light raisin floor so the card sits tonally without hiding detail */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,18,26,0.03) 0%, rgba(15,18,26,0.12) 100%)" }} />
        </div>
      </AbsoluteFill>
    );
  }

  // CARD MODE (card: true) — editorial b-roll look (2026-06-11). The clip plays
  // inside a rounded 16:9 card centered on a black field, with `caption` set in
  // an elegant Playfair serif over it. Video beats are takeovers, so the karaoke
  // captions are already blacked out here — the serif caption carries the words.
  if (broll.card) {
    ensureSerifCaptionFontLoaded();
    // "negative" caption mode (Design B): the footage card sits as a horizontal
    // inset up top and the kinetic captions live in the big black field BELOW it
    // (full-frame coords, larger type) instead of clamped over the footage.
    const cardFree =
      (broll as { caption_space?: string }).caption_space === "negative";
    const cardW = Math.round(width * (cardFree ? 0.86 : 0.88));
    const cardH = Math.round((cardW * 9) / 16); // 16:9 footage, no crop
    const left = Math.round((width - cardW) / 2);
    const top = cardFree
      ? Math.round(height * ((broll as { card_top?: number }).card_top ?? 0.1))
      : Math.round((height - cardH) / 2);
    const radius = Math.round(Math.min(width, height) * 0.03);
    // Calm entrance: soft fade (shared fgOpacity) + tiny rise & scale settle.
    const settle = interpolate(frame, [0, fadeFrames + 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const riseY = interpolate(settle, [0, 1], [26, 0]);
    const scaleIn = interpolate(settle, [0, 1], [0.965, 1]);
    // Caption fades in a hair after the card, holds, fades before the cut.
    // Keyframes are derived from durFrames and kept strictly increasing so very
    // short montage beats (<0.85s) don't break interpolate's monotonic input.
    const capIn = Math.min(8, Math.max(1, Math.round(durFrames * 0.3)));
    const capOut = Math.max(capIn + 1, durFrames - Math.min(7, Math.round(durFrames * 0.3)));
    const capOpacity = interpolate(
      frame,
      [0, capIn, capOut, durFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    // Per-clip caption placement (card-relative fractions) so the text lands
    // in each shot's negative space instead of always dead-center. caption_x /
    // caption_y are 0..1 within the CARD; caption_align controls text alignment.
    const cap = broll as {
      caption_x?: number;
      caption_y?: number;
      caption_align?: "left" | "center" | "right";
    };
    const capAlign = cap.caption_align ?? "center";
    const capXFrac = Math.max(0, Math.min(1, cap.caption_x ?? 0.5));
    const capYFrac = Math.max(0, Math.min(1, cap.caption_y ?? 0.26));
    const boxW = Math.round(cardW * 0.72);
    const capCenterX = left + capXFrac * cardW;
    const boxLeft = Math.max(
      left + 6,
      Math.min(Math.round(capCenterX - boxW / 2), left + cardW - boxW - 6),
    );
    const boxTop = Math.round(top + capYFrac * cardH);
    // Slow drift over the beat's life so the type breathes (never static).
    const drift = interpolate(frame, [0, durFrames], [9, -9], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <AbsoluteFill
          style={{
            opacity: fgOpacity,
            transform: `translateY(${riseY}px) scale(${scaleIn})`,
            transformOrigin: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left,
              top,
              width: cardW,
              height: cardH,
              borderRadius: radius,
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            }}
          >
            <OffthreadVideo
              src={resolveSrc(broll.image_path ?? "")}
              volume={0}
              style={{ width: "100%", height: "100%", objectFit: broll.fit ?? "cover" }}
            />
          </div>
        </AbsoluteFill>
        {/* KINETIC mode: caption_segments are timed fragments that pop in at
            scattered positions (each lands as the word is spoken), one word per
            fragment optionally in neo-lime via {braces}. Falls back to the
            single static caption when no segments are authored. */}
        {(() => {
          const segs = (broll as {
            caption_segments?: Array<{
              text: string;
              appear_sec?: number;
              x?: number;
              y?: number;
              align?: "left" | "center" | "right";
            }>;
          }).caption_segments;
          if (segs && segs.length) {
            const exit = interpolate(frame, [durFrames - 7, durFrames], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const segFont = Math.round(width * (cardFree ? 0.086 : 0.068));
            // Inside-card captions sit OVER footage, so they need a heavy dark
            // halo to stay legible on bright shots; negative-space text is on
            // pure black and needs only a soft shadow.
            const segShadow = cardFree
              ? "0 1px 2px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.75), 0 0 30px rgba(0,0,0,0.55)"
              : "0 2px 5px rgba(0,0,0,1), 0 0 14px rgba(0,0,0,0.98), 0 0 34px rgba(0,0,0,0.92), 0 0 64px rgba(0,0,0,0.7)";
            // Geometry: "negative" mode places fragments anywhere in the FULL
            // frame (the black field around the card); default mode clips them
            // to the card rect so they never spill past the footage edges.
            const contLeft = cardFree ? 0 : left;
            const contTop = cardFree ? 0 : top;
            const contW = cardFree ? width : cardW;
            const contH = cardFree ? height : cardH;
            const margX = Math.round(contW * (cardFree ? 0.07 : 0.06));
            const margY = Math.round(contH * (cardFree ? 0.04 : 0.09));
            const innerL = margX;
            const innerR = contW - margX;
            return (
              <AbsoluteFill style={{ pointerEvents: "none" }}>
                {/* Default: clipped to the card rect. Negative mode: full-frame,
                    unclipped — captions breathe in the black space below the card. */}
                <div
                  style={{
                    position: "absolute",
                    left: contLeft,
                    top: contTop,
                    width: contW,
                    height: contH,
                    overflow: cardFree ? "visible" : "hidden",
                  }}
                >
                  {segs.map((sg, i) => {
                    const appF = Math.max(
                      0,
                      Math.round(((sg.appear_sec ?? broll.start_sec) - broll.start_sec) * fps),
                    );
                    const inP = interpolate(frame, [appF, appF + 6], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    });
                    const op = inP * exit;
                    if (op <= 0.001) return null;
                    const sx = Math.max(0, Math.min(1, sg.x ?? 0.5));
                    const sy = Math.max(0, Math.min(1, sg.y ?? 0.5));
                    const al = sg.align ?? "left";
                    const segRise = interpolate(inP, [0, 1], [16, 0]);
                    const segScale = interpolate(inP, [0, 1], [0.96, 1]);
                    // Card-relative anchor, clamped into the inner area; maxWidth
                    // is the room from the anchor to the far margin so the text
                    // wraps within the card and never crosses its edge.
                    const ax = Math.max(innerL, Math.min(sx * contW, innerR));
                    const ay = Math.max(
                      margY,
                      Math.min(sy * contH, contH - margY - segFont * (cardFree ? 2.4 : 1.4)),
                    );
                    const maxW =
                      al === "left"
                        ? innerR - ax
                        : al === "right"
                          ? ax - innerL
                          : Math.min(ax - innerL, innerR - ax) * 2;
                    const tX = al === "right" ? "-100%" : al === "center" ? "-50%" : "0%";
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: ax,
                          top: ay,
                          maxWidth: cardFree
                            ? Math.max(Math.round(contW * 0.22), Math.round(maxW))
                            : "none",
                          display: "inline-block",
                          opacity: op,
                          transform: `translate(${tX}, ${segRise}px) scale(${segScale})`,
                          transformOrigin:
                            al === "center" ? "center top" : al === "right" ? "right top" : "left top",
                          textAlign: al,
                          fontFamily: SERIF_CAPTION_STACK,
                          fontWeight: cardFree ? 600 : 500,
                          fontSize: segFont,
                          lineHeight: 1.12,
                          letterSpacing: "0.005em",
                          color: "#fff",
                          // Inside-card fragments are short single lines — never
                          // wrap (a wrapped word collides with the next stacked
                          // fragment); negative-space text may wrap on the black.
                          whiteSpace: cardFree ? "pre-line" : "nowrap",
                          textShadow: segShadow,
                        }}
                      >
                        {renderSerifSpans(sg.text)}
                      </div>
                    );
                  })}
                </div>
              </AbsoluteFill>
            );
          }
          if (!broll.caption) return null;
          return (
            <AbsoluteFill style={{ pointerEvents: "none", opacity: capOpacity }}>
              <div
                style={{
                  position: "absolute",
                  left: boxLeft - Math.round(boxW * 0.08),
                  top: boxTop - Math.round(height * 0.02),
                  width: boxW + Math.round(boxW * 0.16),
                  height: Math.round(width * 0.072) * 2.8,
                  transform: `translateY(${drift}px)`,
                  background:
                    "radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0.0) 75%)",
                  filter: "blur(6px)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: boxLeft,
                  top: boxTop,
                  width: boxW,
                  transform: `translateY(${drift}px)`,
                  textAlign: capAlign,
                  fontFamily: SERIF_CAPTION_STACK,
                  fontWeight: 500,
                  fontSize: Math.round(width * 0.072),
                  lineHeight: 1.12,
                  letterSpacing: "0.005em",
                  color: "#fff",
                  whiteSpace: "pre-line",
                  textShadow:
                    "0 1px 2px rgba(0,0,0,0.7), 0 2px 14px rgba(0,0,0,0.6), 0 0 34px rgba(0,0,0,0.4)",
                }}
              >
                {renderSerifSpans(broll.caption)}
              </div>
            </AbsoluteFill>
          );
        })()}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#0F121A" }} />
      <AbsoluteFill style={{ opacity: fgOpacity }}>
        <OffthreadVideo
          src={resolveSrc(broll.image_path ?? "")}
          volume={0}
          style={{ width: "100%", height: "100%", objectFit: broll.fit ?? "contain" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Subtle hook-intro layer: a brief white flash bloom in the first ~0.4s, plus a
 * gentle 1.04 -> 1.0 scale (handled in the wrapper, not here). Designed to grab
 * attention in the first second without being obnoxious.
 */
const HookIntro: React.FC<{ duration: number }> = ({ duration }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  if (t > duration) return null;
  // Two-phase flash: rises fast (0 -> 0.16), holds briefly, decays smooth (0.16 -> 0.42).
  // Toned down 2026-05-09 — previous peak (0.32) read as too aggressive on 16:9 intros
  // where the speaker's face fills more of the frame.
  const flashOpacity = interpolate(t, [0, 0.16, 0.28, 0.42], [0, 0.16, 0.08, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // Lime tint on the bloom rather than pure white — on-brand
  return (
    <AbsoluteFill style={{
      pointerEvents: "none",
      backgroundColor: "#CFFF05",
      opacity: flashOpacity,
      mixBlendMode: "screen",
    }} />
  );
};

/**
 * Hook punch-in: a fast 1.0 → 1.06 → 1.0 scale curve over `durationSec`.
 * The speaker zooms IN, peaks at ~25% through the hook, then settles.
 * Combined with the lime flash on top, this is "yellow flare + zoom in" — the
 * cold-open's attention grab. Going below 1.0 would expose black bars around
 * the speaker layer, so we stay ≥ 1.0 throughout.
 */
/**
 * Cinematic hook move — the cold open is NOT a static talking head.
 * The frame opens punched-IN (1.16×) and eases OUT to 1.0 over the hook
 * duration with a deep ease-out: fast release, long settle. One clean
 * directional move — a "settle into the shot", the way a film opens — NOT
 * a pulse or a bounce. Pairs with the whoosh+boom+flare audio stack.
 */
const useHookScale = (durationSec: number): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  if (t >= durationSec) return 1;
  // expo-style ease-out — most of the move happens early, then a slow settle
  const k = t / durationSec;
  const eased = 1 - Math.pow(1 - k, 3);
  const start = 1.12;
  return start - (start - 1) * eased;
};

/**
 * Floating icon card overlay — guaranteed high contrast on any background.
 * Renders the icon INSIDE a white rounded card with soft shadow (matches the
 * reference style where icons sit on white cards). Slides in via spring.
 */
const IconOverlay: React.FC<{ broll: BRoll }> = ({ broll }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const durFrames = Math.max(1, Math.round((broll.end_sec - broll.start_sec) * fps));

  const entranceFrames = Math.min(14, Math.round(durFrames * 0.22));
  // Exit is SHORT, LINEAR and uniform across every icon beat, reaching true-0
  // exactly at durFrames. A soft spring exit has a slow opacity tail, and the
  // brightest card in a shared-end row (e.g. the glowing MUSIC waveform) stays
  // visible through that tail — so it reads as "leaving later" even though the
  // beats end on the same frame. A crisp linear fade makes a row of cards that
  // share an end_sec leave together. Owner feedback 2026-06-05: "the third
  // (music) leaves the screen later than the rest — exit them together."
  const exitFrames = Math.min(9, durFrames);
  const exitStart = durFrames - exitFrames;

  const inProgress = spring({
    frame, fps, durationInFrames: entranceFrames,
    config: { damping: 16, stiffness: 130, mass: 0.65 },
  });
  const outProgress = frame > exitStart
    ? interpolate(frame, [exitStart, durFrames], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;

  const anchor = broll.anchor ?? "center";
  const defaultSize = anchor === "center" ? 0.7 : 0.55;
  const sizeFrac = broll.size ?? defaultSize;
  const aspect = broll.aspect ?? 1;
  const w = width * sizeFrac;
  const h = w / aspect;
  const margin = width * 0.04;
  const radius = width * 0.025;
  // Inner padding keyed to the SHORT axis. For a square icon min(w,h)===w so this
  // is identical to the old w*0.10; for a wide wordmark (e.g. aspect 4.63) the card
  // height is tiny, and keying padding to w would crush the logo to a sliver. Short-
  // axis keeps a snug, balanced margin around the logo at any aspect ratio.
  const padding = Math.min(w, h) * 0.12;

  let left = 0, top = 0;
  let slideOriginX = 0, slideOriginY = 0;
  switch (anchor) {
    case "center":
      // True vertical+horizontal center. Biased ~6% above frame center to leave the
      // bottom-12% caption zone clear. Comes in from below for an upward reveal.
      left = (width - w) / 2;
      top = (height - h) / 2 - height * 0.06;
      slideOriginX = 0;
      slideOriginY = h * 0.4;
      break;
    case "top-left":
      left = margin; top = margin; slideOriginX = -w - margin * 2; slideOriginY = 0; break;
    case "top-right":
      left = width - w - margin; top = margin; slideOriginX = w + margin * 2; slideOriginY = 0; break;
    case "top-center":
      left = (width - w) / 2; top = margin; slideOriginX = 0; slideOriginY = -h - margin * 2; break;
    case "bottom-left":
      left = margin; top = height * 0.55; slideOriginX = -w - margin * 2; slideOriginY = 0; break;
    case "bottom-right":
      left = width - w - margin; top = height * 0.55; slideOriginX = w + margin * 2; slideOriginY = 0; break;
  }

  // Explicit normalized position override (x,y in 0..1 = card CENTER). Lets you
  // place several icons in a deliberate row/grid (e.g. a lower-third strip).
  // Comes in with a gentle upward rise.
  const px = (broll as { x?: number }).x;
  const py = (broll as { y?: number }).y;
  if (px !== undefined || py !== undefined) {
    if (px !== undefined) left = Math.round(px * width - w / 2);
    if (py !== undefined) top = Math.round(py * height - h / 2);
    slideOriginX = 0; slideOriginY = h * 0.28;
  }

  const tx = interpolate(inProgress, [0, 1], [slideOriginX, 0]) +
             interpolate(outProgress, [0, 1], [0, slideOriginX]);
  const ty = interpolate(inProgress, [0, 1], [slideOriginY, 0]) +
             interpolate(outProgress, [0, 1], [0, slideOriginY]);
  const scale = interpolate(inProgress, [0, 1], [0.7, 1]);
  const opacity = Math.min(inProgress, 1 - outProgress);

  if (broll.bare) {
    // Bare mode: just the image with rounded corners + drop-shadow. No card
    // wrapper, no white background — for assets that already have their own
    // visual identity (logos, branded screenshots).
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Img
          src={resolveSrc(broll.image_path ?? "")}
          style={{
            position: "absolute",
            left, top, width: w, height: h,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            opacity,
            objectFit: "contain",
            borderRadius: radius,
            filter: `drop-shadow(0 ${w * 0.025}px ${w * 0.06}px rgba(0,0,0,0.40)) drop-shadow(0 ${w * 0.005}px ${w * 0.012}px rgba(0,0,0,0.25))`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left, top, width: w, height: h,
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        opacity,
        backgroundColor: "#FFFFFF",
        borderRadius: radius,
        boxShadow: `0 ${w * 0.04}px ${w * 0.10}px rgba(0,0,0,0.25), 0 ${w * 0.01}px ${w * 0.02}px rgba(0,0,0,0.15)`,
        padding,
        boxSizing: "border-box",
      }}>
        <Img src={resolveSrc(broll.image_path ?? "")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Programmatic numbered-list overlay. Used when the speaker enumerates points
 * ("three things…", "first… second… third…"). Items animate in one-by-one with a
 * staggered spring; existing items stay anchored. Brand-styled card on raisin
 * black with neo-lime accent numbers.
 */
const ListOverlay: React.FC<{ broll: BRoll }> = ({ broll }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const rawItems = broll.items ?? [];
  // Normalize: each item becomes { text, appear_sec } where appear_sec is
  // absolute source-video time. Plain-string items get auto-staggered so the
  // legacy form keeps working.
  const listStart = broll.start_sec;
  const listEnd = broll.end_sec;
  const listDur = listEnd - listStart;
  const allStrings = rawItems.every((it) => typeof it === "string");
  const items = rawItems.map((it, idx) => {
    if (typeof it === "string") {
      // Auto-stagger across first 60% of the list duration.
      const span = listDur * 0.6;
      const offset = (span / Math.max(1, rawItems.length)) * idx;
      return { text: it, appear_sec: listStart + offset };
    }
    return {
      text: it.text,
      appear_sec: typeof it.appear_sec === "number" ? it.appear_sec : listStart,
    };
  });
  const title = broll.title;
  const durFrames = Math.max(1, Math.round(listDur * fps));

  // Card geometry — center of frame, biased ~5% upward off the caption zone
  const cardW = width * 0.62;
  const margin = width * 0.04;
  const left = (width - cardW) / 2;
  const radius = width * 0.025;

  const exitFrames = 10;
  const exitStart = durFrames - exitFrames;

  const cardOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, durFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleProgress = spring({
    frame, fps, durationInFrames: 12, config: { damping: 16, stiffness: 130, mass: 0.65 },
  });

  const typeBase = Math.min(width, height);
  const titleSize = Math.round(typeBase * 0.034);
  const itemSize = Math.round(typeBase * 0.030);
  const numberSize = Math.round(typeBase * 0.038);
  const rowGap = Math.round(width * 0.018);
  const padX = width * 0.045;
  const padY = width * 0.038;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: cardOpacity }}>
      <div style={{
        position: "absolute",
        left,
        top: height * 0.18,
        width: cardW,
        backgroundColor: "rgba(15, 18, 26, 0.96)",
        border: "2px solid #CFFF05",
        borderRadius: radius,
        boxShadow: `0 ${margin * 0.5}px ${margin * 1.4}px rgba(0,0,0,0.5)`,
        padding: `${padY}px ${padX}px`,
        boxSizing: "border-box",
        fontFamily: "Space Grotesk, system-ui, sans-serif",
        color: "#FFFFFF",
      }}>
        {title && (
          <div style={{
            fontSize: titleSize,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#CFFF05",
            marginBottom: rowGap * 1.5,
            transform: `translateY(${interpolate(titleProgress, [0, 1], [12, 0])}px)`,
            opacity: titleProgress,
          }}>
            {title}
          </div>
        )}
        {items.map((item, idx) => {
          // Each item appears at its own absolute timestamp. We compute the
          // offset relative to the list's start frame (Sequence already shifts
          // `frame=0` to the list's start_sec), so itemStart = (appear_sec -
          // list start) * fps.
          const itemStart = Math.max(0, Math.round((item.appear_sec - listStart) * fps));
          const p = spring({
            frame: frame - itemStart,
            fps,
            durationInFrames: 14,
            config: { damping: 17, stiffness: 130, mass: 0.7 },
          });
          const ty = interpolate(p, [0, 1], [16, 0]);
          // Hide the whole row until its appear_sec — both visually (opacity)
          // Slot pre-allocated so earlier rows don't shift when later rows
          // reveal — list keeps a stable layout from frame 0.
          const visible = frame >= itemStart;
          return (
            <div key={idx} style={{
              display: "flex",
              visibility: visible ? "visible" : "hidden",
              alignItems: "baseline",
              gap: rowGap,
              marginBottom: idx < items.length - 1 ? rowGap : 0,
              opacity: p,
              transform: `translateY(${ty}px)`,
            }}>
              <span style={{
                fontSize: numberSize,
                fontWeight: 700,
                color: "#CFFF05",
                minWidth: numberSize * 1.4,
                fontVariantNumeric: "tabular-nums",
              }}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span style={{
                fontSize: itemSize,
                fontWeight: 600,
                lineHeight: 1.25,
                color: "#FFFFFF",
              }}>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Kinds that take over the full frame and thus must never expose the speaker
 * during their entrance/exit animations or in head-to-head transitions.
 *
 * Excluded on purpose: "icon", "list", "chapter_bar" — these are partial
 * overlays designed to sit ON TOP OF the speaker, not replace them.
 */
const TAKEOVER_KINDS = new Set<string>([
  "static",
  "video",
  "ai_image_on_grid",
  "title_card",
  "vertical_timeline",
  "horizontal_timeline",
  "callout",
  "stat_punch",
  "quote_pull",
  "vs_split",
  "keyword_chips",
  "progress_steps",
  "metric_reveal",
  "chat_message",
  "stat_grid",
  "flow_diagram",
  "bulleted_list",
  "comparison_grid",
  "bar_chart",
  "network_diagram",
  "annotated_screenshot",
  "cinematic_title",
  "ticker_feed",
  "split_reveal",
  "kinetic_statement",
  "concept_build",
  "network_spread",
  "command_deck",
  "calendar_months",
  "layer_stack",
  "broll_picker",
  // notification_toast is partial overlay — speaker stays visible. NOT a takeover.
]);

/**
 * Compute "coverage runs": consecutive takeover beats whose gap is small
 * enough that the eye reads them as one continuous visual run. Each run gets
 * a single underlay (solid raisin black) that paints from `run.start - LEAD`
 * to `run.end + TAIL`, guaranteeing the speaker is never visible between
 * adjacent visuals — even while individual templates do their entrance fades.
 */
const COVERAGE_MERGE_GAP_SEC = 0.6; // gaps ≤ this are bridged by the underlay
const COVERAGE_LEAD_SEC = 0.10;     // start underlay this much before first beat
const COVERAGE_TAIL_SEC = 0.10;     // hold underlay this much after last beat

function computeCoverageRuns(broll: BRoll[]): Array<{ start: number; end: number }> {
  const takeovers = broll
    // Overlay beats render ON TOP of the speaker (no grid background), so they
    // must NOT get a coverage underlay — that would black out the talking head.
    .filter((b) => TAKEOVER_KINDS.has(b.kind ?? "static") && !b.overlay)
    .slice()
    .sort((a, b) => a.start_sec - b.start_sec);
  const runs: Array<{ start: number; end: number }> = [];
  for (const b of takeovers) {
    const last = runs[runs.length - 1];
    if (last && b.start_sec - last.end <= COVERAGE_MERGE_GAP_SEC) {
      last.end = Math.max(last.end, b.end_sec);
    } else {
      runs.push({ start: b.start_sec, end: b.end_sec });
    }
  }
  return runs;
}

export const EditedVideo: React.FC<EditedVideoProps> = ({
  videoSrc,
  speakerCutoutDir,
  broll,
  zoom,
  followCam,
  captions,
  styles,
}) => {
  const { fps } = useVideoConfig();
  const editFrame = useCurrentFrame();
  const globalScale = useGlobalZoom(zoom, fps, styles.zoomEaseFrames);
  const hookDuration = 2.5;
  const hookScale = useHookScale(hookDuration);
  const finalScale = globalScale * hookScale;

  // Speaker-layer transform. Follow-cam mode (when a followCam track is
  // provided) REPLACES the zoom punch-ins with a per-frame pan + zoom that
  // drifts with the speaker. Otherwise: the classic zoom punch scale.
  // The cutout layer reuses this exact string so it stays pixel-registered.
  const fcFrame = followCam && followCam.length
    ? followCam[Math.min(Math.max(0, editFrame), followCam.length - 1)]
    : null;
  // In follow-cam mode the per-frame track supplies the base pan + zoom, and
  // the emphasis zoom-punches (globalScale, from zoom_plan.json) are LAYERED ON
  // TOP — so the camera both drifts with the speaker AND punches in on the
  // loaded moments. The translate is in % of the (unscaled) element box, so
  // multiplying scale doesn't amplify the pan — it just zooms further in.
  const speakerTransform = fcFrame
    ? `translate(${fcFrame.tx}%, ${fcFrame.ty}%) scale(${fcFrame.scale * hookScale * globalScale})`
    : `scale(${finalScale})`;

  const coverageRuns = computeCoverageRuns(broll);

  // Captions and on-screen beats are MUTUALLY EXCLUSIVE — one or the other.
  // When ANY beat is active (a takeover, an image_card, a word_pop, a
  // hook_title, the subscribe button…) its own text/visual is representative
  // enough; a caption on top would just be noise. So captions show ONLY in
  // the pure-speaker gaps where nothing else is on screen.
  //
  // CAPTION_LEAD_PAD / CAPTION_TAIL_PAD extend the blackout window OUTWARD a
  // little past each beat. Without the lead-pad, the caption chunk that ends
  // ~100ms before a beat starts can SHOW the exact word the beat is about to
  // highlight — e.g. scene-8 caption "flow, real" at 21.9s, immediately
  // followed by word_pop "real pain / zero solution" at 22.0s — the viewer
  // reads "real" twice. The pad silences the trailing caption (or leading
  // caption after a beat) so the same word never appears in two layers
  // back-to-back. Codified May 22 2026.
  // CAPTION_FRIENDLY_KINDS — beats during which captions ALSO render.
  // Codified May 23 2026: "when we have the bar chart visual ... we are
  // still allowed to have the captions. For people watching the short
  // without their volume on, they need the captions. Only when we have
  // our special captions or a full-screen component or animation should
  // we not show captions." These kinds are partial/ambient overlays whose
  // text content (if any) is small enough not to compete with captions
  // at the bottom: bar bars are mid-frame, portraits/logos are scattered
  // in clear zones, the subscribe button is a discrete UI element, etc.
  // Captions remain at the very bottom (rule 4am) where they don't
  // collide with these visuals.
  const CAPTION_FRIENDLY_KINDS = new Set([
    "bar_overlay",
    "portrait_burst",
    "tool_logo_burst",
    "agent_avatar_burst",
    "ratio_dots",
    "image_card",
    "icon",
    "static",
  ]);

  // SMART caption suppression (May 23 2026):
  // - Inside a beat's literal time range: drop unless the beat is in
  //   CAPTION_FRIENDLY_KINDS (which lets captions through during partial
  //   visual overlays).
  // - Inside the 0.8s lead/tail pad zones: drop ONLY when the caption's
  //   meaningful words (stopwords filtered) overlap with the beat's text.
  // Pure-timing pads killed legitimate next-sentence captions (scene-18:
  // "The reason you" dropped by tail-pad of a wp about "the conversation",
  // even though the words don't overlap). The semantic check keeps echoes
  // suppressed while letting unrelated captions through.
  const CAPTION_LEAD_PAD = 0.8;
  const CAPTION_TAIL_PAD = 0.8;
  const STOPWORDS = new Set([
    "the","a","an","of","to","for","in","on","at","is","was","are","were",
    "be","been","being","and","or","but","i","you","we","they","he","she",
    "it","my","your","our","their","this","that","these","those","what",
    "which","who","when","where","why","how","not","no","so","do","does",
    "did","have","has","had","will","would","can","could","should","just",
    "from","with","into","onto","over","under","up","down","out","off",
    "than","then","there","here","as","if","by","about","very","really",
    "im","its","dont","cant","wont","didnt","doesnt","isnt","arent",
  ]);
  const tokenize = (s: string): string[] =>
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beatTextOf = (b: any): string => {
    const parts: string[] = [];
    const push = (v: unknown) => { if (typeof v === "string" && v) parts.push(v); };
    push(b.title); push(b.kicker); push(b.subtitle); push(b.quote_text);
    push(b.caption); push(b.value); push(b.pre_label); push(b.headline);
    push(b.dek); push(b.top_label); push(b.bottom_label);
    (b.top_items ?? []).forEach((x: unknown) => push(typeof x === "string" ? x : ""));
    (b.bottom_items ?? []).forEach((x: unknown) => push(typeof x === "string" ? x : ""));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.items ?? []).forEach((it: any) => { push(it?.text); push(it?.label); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.words ?? []).forEach((w: any) => push(w?.text));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.elements ?? []).forEach((e: any) => { push(e?.label); push(e?.sublabel); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.connectors ?? []).forEach((c: any) => push(c?.label));
    push(b.center_label);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.spokes ?? []).forEach((s: any) => push(s?.label));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.layers ?? []).forEach((l: any) => { push(l?.label); push(l?.sub); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.steps ?? []).forEach((s: any) => { push(s?.heading); push(s?.description); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.bars ?? []).forEach((bar: any) => { push(bar?.label); push(bar?.display); });
    return parts.join(" ");
  };
  const beatWords: Set<string>[] = broll.map((b) => new Set(tokenize(beatTextOf(b))));
  // Literal beat range — used both for the inside-beat drop AND for clipping
  // captions to surrounding speaker-gap bounds. CAPTION_FRIENDLY beats are
  // EXCLUDED — captions render straight through them.
  const captionBlackout: Array<{ start: number; end: number }> = broll
    // A beat with `solo: true` always blacks out captions, even if its kind is
    // normally caption-friendly (e.g. a hero logo reveal that must not be
    // overlaid by the burned caption).
    .filter((b) => !CAPTION_FRIENDLY_KINDS.has(b.kind ?? "") || (b as { solo?: boolean }).solo)
    .map((b) => ({ start: b.start_sec, end: b.end_sec }));
  const filteredCaptions = (captions ?? []).flatMap((line) => {
    const mid = (line.start_sec + line.end_sec) / 2;
    // 1) Always drop if mid is inside any literal beat range.
    if (captionBlackout.some((r) => mid >= r.start && mid < r.end)) return [];
    // 2) In a pad zone? Drop only on word overlap.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capText = (line.words ?? []).map((w: any) => w.word ?? w.text ?? "").join(" ");
    const capWords = tokenize(capText);
    for (let i = 0; i < broll.length; i++) {
      const b = broll[i];
      // Caption-friendly beats don't pad — captions are explicitly allowed
      // around them.
      if (CAPTION_FRIENDLY_KINDS.has(b.kind ?? "")) continue;
      const inLead = mid >= b.start_sec - CAPTION_LEAD_PAD && mid < b.start_sec;
      const inTail = mid >= b.end_sec && mid < b.end_sec + CAPTION_TAIL_PAD;
      if ((inLead || inTail) && capWords.some((w) => beatWords[i].has(w))) {
        return [];
      }
    }
    // 3) Clip the caption to the speaker-gap (literal beat ranges).
    let gapStart = 0;
    let gapEnd = Number.POSITIVE_INFINITY;
    for (const r of captionBlackout) {
      if (r.end <= mid && r.end > gapStart) gapStart = r.end;
      if (r.start >= mid && r.start < gapEnd) gapEnd = r.start;
    }
    const s = Math.max(line.start_sec, gapStart);
    const e = Math.min(line.end_sec, gapEnd);
    if (e - s < 0.3) return [];
    return [{ ...line, start_sec: s, end_sec: e }];
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", filter: GRADE_FILTER }}>
      {/* Speaker layer: zoom punch-ins, OR a follow-cam pan+zoom track. */}
      <AbsoluteFill style={{ transform: speakerTransform, transformOrigin: "center" }}>
        <OffthreadVideo src={resolveSrc(videoSrc)} />
      </AbsoluteFill>

      {/* Coverage underlay: a single solid raisin-black panel per run of
          adjacent takeover beats. Sits BETWEEN the speaker and the b-roll
          components, so any per-template entrance/exit fade no longer
          exposes the speaker. Without this, head-to-head visuals flash the
          speaker through during the ~6–10 frame transition window. */}
      {coverageRuns.map((run, idx) => {
        const from = Math.max(0, Math.round((run.start - COVERAGE_LEAD_SEC) * fps));
        const dur = Math.max(
          1,
          Math.round((run.end - run.start + COVERAGE_LEAD_SEC + COVERAGE_TAIL_SEC) * fps),
        );
        return (
          <Sequence key={`underlay-${idx}`} from={from} durationInFrames={dur}>
            <AbsoluteFill style={{ backgroundColor: "#0F121A" }} />
          </Sequence>
        );
      })}

      {/* B-roll layer: rendered ABOVE the zoom transform so overlays always
          render full-frame and never get cropped by the speaker punch-in. */}
      {broll.map((b, i) => {
        const from = Math.round(b.start_sec * fps);
        const dur = Math.max(1, Math.round((b.end_sec - b.start_sec) * fps));
        const kind = b.kind ?? "static";
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {kind === "video" && !(b as { ungraded?: boolean }).ungraded && <VideoOverlay broll={b} />}
            {kind === "icon" && <IconOverlay broll={b} />}
            {kind === "list" && <ListOverlay broll={b} />}
            {kind === "word_pop" && (
              <WordPop
                items={(b.items ?? []) as WordPopItem[]}
                beat_start_sec={b.start_sec}
                size={b.size}
                vertical={b.vertical}
              />
            )}
            {kind === "subscribe" && (
              <SubscribeButton vertical={b.vertical} />
            )}
            {kind === "image_card" && (
              <ImageCard src={resolveSrc(b.image_path ?? "")} caption={b.caption} />
            )}
            {kind === "headline_card" && (
              <HeadlineCard
                source={b.kicker ?? ""}
                headline={b.headline ?? ""}
                dek={b.dek}
              />
            )}
            {kind === "bar_overlay" && (
              <BarOverlay
                title={b.title}
                bars={(b.bars ?? []) as BarOverlayItem[]}
                vertical={b.vertical}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "bullet_burst" && (
              <BulletBurst
                items={(b.items ?? []) as BulletBurstItem[]}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "portrait_burst" && (
              <PortraitBurst
                items={(b.items ?? []) as unknown as PortraitBurstItem[]}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "tool_logo_burst" && (
              <ToolLogoBurst
                items={(b.items ?? []) as unknown as ToolLogoItem[]}
                beat_start_sec={b.start_sec}
                bare={(b as unknown as { bare?: boolean }).bare}
              />
            )}
            {kind === "broll_picker" && (
              <BrollPicker
                items={(b.items ?? []) as unknown as BrollPickerItem[]}
                pick_index={(b as unknown as { pick_index?: number }).pick_index}
                title={b.title}
                count_label={(b as unknown as { count_label?: string }).count_label}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "password_type" && (
              <PasswordType
                password={(b as unknown as { password?: string }).password}
                label={(b as unknown as { label?: string }).label}
                mask={(b as unknown as { mask?: boolean }).mask}
                vertical={(b as unknown as { vertical?: number }).vertical}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "agent_avatar_burst" && (
              <AgentAvatarBurst
                items={(b.items ?? []) as unknown as AgentAvatarItem[]}
                title={b.title}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "org_diagram" && (
              <OrgDiagram
                title={b.title}
                parent_label={(b as unknown as { parent_label?: string }).parent_label}
                nodes={((b as unknown as { nodes?: OrgDiagramNode[] }).nodes ?? [])}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "claude_code_terminal" && (
              <ClaudeCodeTerminal
                lines={((b as unknown as { lines?: ClaudeCodeLine[] }).lines ?? [])}
                title={b.title}
                vertical={b.vertical}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "dashboard_card" && (
              <DashboardCard
                title={b.title}
                stats={((b as unknown as { stats?: DashboardStat[] }).stats ?? [])}
                sparkline={(b as unknown as { sparkline?: number[] }).sparkline}
                vertical={b.vertical}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "ratio_dots" && (
              <RatioDots
                total={(b as unknown as { total?: number }).total ?? 0}
                marked={(b as unknown as { marked?: number }).marked ?? 0}
                polarity={(b as unknown as { polarity?: "negative" | "positive" }).polarity}
                appear_sec={(b as unknown as { appear_sec?: number }).appear_sec}
                mark_at={(b as unknown as { mark_at?: number }).mark_at}
                caption={b.caption}
                vertical={b.vertical}
                columns={(b as unknown as { columns?: number }).columns}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "inline_chart" && (
              <InlineChart
                title={b.title}
                data={((b as unknown as { data?: number[] }).data ?? [])}
                labels={((b as unknown as { labels?: string[] }).labels ?? undefined)}
                vertical={b.vertical}
                draw_duration={(b as unknown as { draw_duration?: number }).draw_duration}
                beat_start_sec={b.start_sec}
              />
            )}
            {/* ⭐ Cinematic viz beats render ABOVE the color grade (see the
                dedicated pass after <ColorGrade/>), NOT here — a flat brand card
                would otherwise get the cinematic vignette washed over it. */}
            {/* hook_title is rendered in a dedicated pass ABOVE the color grade
                (see below) so the cold-open text never gets dimmed by the
                vignette. Skipped here. */}
            {kind === "static" && <StaticOverlay broll={b} intensity={styles.kenBurnsIntensity} />}
            {kind === "title_card" && (
              <TitleCard number={b.number} title={b.title ?? ""} subtitle={b.subtitle} />
            )}
            {kind === "vertical_timeline" && (
              <VerticalTimeline
                title={b.title}
                items={(b.steps ?? []) as VerticalTimelineItem[]}
                beat_start_sec={b.start_sec}
              />
            )}
            {kind === "horizontal_timeline" && (
              <HorizontalTimeline title={b.title} steps={(b.steps ?? []) as HorizontalTimelineStep[]} />
            )}
            {kind === "kinetic_statement" && (
              <KineticStatement
                words={(b.words ?? []) as KineticWord[]}
                startSec={b.start_sec}
                overlay={b.overlay}
              />
            )}
            {kind === "concept_build" && (
              <ConceptBuild
                title={b.title}
                elements={(b.elements ?? []) as ConceptElement[]}
                connectors={(b.connectors ?? []) as ConceptConnector[]}
                startSec={b.start_sec}
              />
            )}
            {kind === "network_spread" && (
              <NetworkSpread
                title={b.title}
                centerLabel={b.center_label ?? ""}
                centerGlyph={b.center_glyph}
                nodes={(b.spokes ?? []) as SpreadNode[]}
                flow={b.flow}
                flowGlyph={b.flow_glyph}
                startSec={b.start_sec}
              />
            )}
            {kind === "command_deck" && (
              <CommandDeck
                title={b.title}
                brand={b.brand}
                tiles={(b.tiles ?? []) as DeckTile[]}
                startSec={b.start_sec}
              />
            )}
            {kind === "calendar_months" && (
              <CalendarMonths
                count={b.count}
                title={b.title}
                caption={b.caption}
                startSec={b.start_sec}
              />
            )}
            {kind === "layer_stack" && (
              <LayerStack
                title={b.title}
                layers={(b.layers ?? []) as StackLayer[]}
                startSec={b.start_sec}
              />
            )}
            {kind === "callout" && (
              <Callout
                prefix={b.callout_prefix ?? ""}
                highlight={b.callout_highlight ?? ""}
                suffix={b.callout_suffix}
                overlay={b.overlay}
              />
            )}
            {kind === "stat_punch" && (
              <StatPunch value={b.value ?? ""} caption={b.caption ?? ""} preLabel={b.pre_label} />
            )}
            {kind === "quote_pull" && (
              <QuotePull text={b.quote_text ?? ""} attribution={b.attribution} charsPerSecond={b.chars_per_second} />
            )}
            {kind === "vs_split" && (
              <VsSplit
                topLabel={b.top_label ?? ""}
                topItems={b.top_items ?? []}
                bottomLabel={b.bottom_label ?? ""}
                bottomItems={b.bottom_items ?? []}
                winner={b.winner}
              />
            )}
            {kind === "keyword_chips" && (
              <KeywordChips title={b.title} chips={b.chips ?? []} />
            )}
            {kind === "progress_steps" && (
              <ProgressSteps title={b.title} steps={b.progress ?? []} />
            )}
            {kind === "chapter_bar" && (
              <ChapterBar number={b.chapter_number ?? ""} title={b.chapter_title ?? ""} />
            )}
            {kind === "ai_image_on_grid" && (
              <AIImageOnGrid src={b.image_path ?? ""} caption={b.caption} />
            )}
            {kind === "metric_reveal" && (
              <MetricReveal
                pre_label={b.pre_label}
                prefix={b.callout_prefix /* re-use prefix slot for $/ + */}
                target={b.target ?? 0}
                suffix={b.callout_suffix /* re-use suffix slot for k/% etc */}
                caption={b.caption ?? ""}
                duration_sec={b.duration_sec}
                decimals={b.decimals}
              />
            )}
            {kind === "notification_toast" && (
              <NotificationToast
                app_name={b.app_name ?? ""}
                app_icon={b.app_icon}
                title={b.title ?? ""}
                body={b.body ?? ""}
                time={b.time}
                anchor={b.anchor === "top-center" ? "top-center" : "top-right"}
              />
            )}
            {kind === "chat_message" && (
              <ChatMessage messages={b.messages ?? []} />
            )}
            {kind === "stat_grid" && (
              <StatGrid title={b.title} stats={b.stats ?? []} />
            )}
            {kind === "flow_diagram" && (
              <FlowDiagram title={b.title} nodes={b.nodes ?? []} />
            )}
            {kind === "bulleted_list" && (
              <BulletedList title={b.title} items={b.bullets ?? []} />
            )}
            {kind === "comparison_grid" && (
              <ComparisonGrid title={b.title} columns={b.columns ?? []} rows={b.rows ?? []} />
            )}
            {kind === "bar_chart" && (
              <BarChart
                title={b.title}
                bars={b.bars ?? []}
                max={b.max}
                orientation={b.orientation}
              />
            )}
            {kind === "network_diagram" && (
              <NetworkDiagram
                title={b.title}
                nodes={b.network_nodes ?? []}
                edges={b.network_edges ?? []}
              />
            )}
            {kind === "annotated_screenshot" && (
              <AnnotatedScreenshot
                image_path={b.image_path ?? ""}
                highlights={b.highlights ?? []}
                zoom_to_highlights={b.zoom_to_highlights}
              />
            )}
            {kind === "cinematic_title" && (
              <CinematicTitle
                chapter={b.chapter ?? ""}
                title={b.title ?? ""}
                subtitle={b.subtitle}
                kicker={b.kicker}
              />
            )}
            {kind === "ticker_feed" && (
              <TickerFeed title={b.title} items={b.ticker_items ?? []} />
            )}
            {kind === "split_reveal" && (
              <SplitReveal
                before_image={b.before_image ?? ""}
                after_image={b.after_image ?? ""}
                before_label={b.before_label}
                after_label={b.after_label}
                wipe_start_sec={b.wipe_start_sec}
                wipe_duration_sec={b.wipe_duration_sec}
              />
            )}
            {kind === "lower_third" && (
              <LowerThird
                prefix={b.callout_prefix}
                highlight={b.callout_highlight ?? ""}
                suffix={b.callout_suffix}
                kicker={b.kicker}
              />
            )}
            {kind === "corner_stat" && (
              <CornerStat
                pre_label={b.pre_label}
                value={b.value ?? ""}
                caption={b.caption}
                delta={b.callout_suffix /* re-use suffix slot for delta string */}
                anchor={(b.anchor as "top-right" | "top-left" | "bottom-right" | "bottom-left") ?? "top-right"}
              />
            )}
            {kind === "side_panel" && (
              <SidePanel
                title={b.title}
                kicker={b.kicker}
                items={b.side_items ?? []}
                anchor={(b.anchor as "right" | "left") ?? "right"}
                beat_start_sec={b.start_sec}
              />
            )}
          </Sequence>
        );
      })}

      {/* Caption track (YouTube-intro mode): rendered above b-roll so simple
          lower-third captions stay readable even during a takeover, and
          emphasis pop-ups land in the cleanest plane the comp has. */}
      {filteredCaptions.length > 0 && <Captions lines={filteredCaptions} />}

      {/* Behind-subject layer: re-paints the speaker cutout (alpha matte webm)
          ON TOP of the b-roll text layer, but ONLY during beats flagged
          `behind_subject`. Result: text from those beats sits visually BEHIND
          the speaker — they're never covered. The cutout is the same footage
          frame-aligned to the source, wrapped in the IDENTICAL zoom transform
          as the speaker base layer so it registers pixel-for-pixel.
          Gated to behind_subject ranges only — those never overlap full
          takeovers, so painting the speaker on top there can't break an
          ai_image / quote_pull takeover. */}
      {speakerCutoutDir && (() => {
        const inBehindBeat = broll.some((b) => {
          if (!b.behind_subject) return false;
          const from = Math.round(b.start_sec * fps);
          const to = Math.round(b.end_sec * fps);
          return editFrame >= from && editFrame < to;
        });
        if (!inBehindBeat) return null;
        // PNG sequence: one frame per source frame, RGBA. Clamp the index so
        // a rounding edge can never request a frame past the end of the seq.
        const idx = Math.max(0, editFrame);
        const padded = String(idx).padStart(5, "0");
        return (
          <AbsoluteFill style={{
            transform: speakerTransform,
            transformOrigin: "center",
          }}>
            <Img
              src={resolveSrc(`${speakerCutoutDir}/frame_${padded}.png`)}
              style={{ width: "100%", height: "100%", objectFit: "fill" }}
            />
          </AbsoluteFill>
        );
      })()}

      {/* Hook intro: brief lime-tinted bloom in the first ~0.6s */}
      <HookIntro duration={hookDuration} />

      {/* Color grade — cinematic duotone wash + vignette over the WHOLE comp,
          so speaker and b-roll read as one graded film. Always last. */}
      <ColorGrade />

      {/* Ungraded video takeovers — rendered ABOVE the color grade on purpose.
          A full-screen brand-graphic takeover (kineticText cards, etc.) is UI,
          not graded footage: the cinematic vignette + duotone would wash a flat
          light card into a bright-center / dark-corner oval. Mark the beat
          `ungraded:true` and it composites here, clean, exactly as authored.
          (Dark clips like the noise grid look fine graded — leave those below.) */}
      {broll.map((b, i) => {
        if ((b.kind ?? "static") !== "video") return null;
        if (!(b as { ungraded?: boolean }).ungraded) return null;
        const from = Math.round(b.start_sec * fps);
        const dur = Math.max(1, Math.round((b.end_sec - b.start_sec) * fps));
        return (
          <Sequence key={`vidtop-${i}`} from={from} durationInFrames={dur}>
            <VideoOverlay broll={b} />
          </Sequence>
        );
      })}

      {/* ⭐ Cinematic motion viz — rendered ABOVE the color grade on purpose.
          A viz beat is either a full-screen brand-graphic takeover (SingleObjectStage
          bg) or a transparent overlay device. Both are UI, not graded footage: the
          global vignette/duotone would wash a flat brand card into a bright-center
          oval. Above the grade, the card composites exactly as authored; a
          transparent overlay lets the (already-graded) speaker show through clean.
          Auto-times to the beat: the Sequence supplies durationInFrames. */}
      {broll.map((b, i) => {
        if ((b.kind ?? "static") !== "viz") return null;
        const VizComp = MOTION_REGISTRY[(b as unknown as { viz?: string }).viz ?? ""];
        if (!VizComp) return null;
        const vizProps = (b as unknown as { props?: Record<string, unknown> }).props ?? {};
        const from = Math.round(b.start_sec * fps);
        const dur = Math.max(1, Math.round((b.end_sec - b.start_sec) * fps));
        return (
          <Sequence key={`viztop-${i}`} from={from} durationInFrames={dur}>
            <MotionFade dur={dur}>
              <VizComp {...vizProps} />
            </MotionFade>
          </Sequence>
        );
      })}

      {/* Hook title — rendered ABOVE the color grade on purpose. The cold-open
          title is UI, not graded footage: the vignette must darken the
          BACKGROUND behind it, never the title text itself. Its own scrim
          (inside HookTitle) darkens the background more; the text stays bright
          here because nothing grades over it. */}
      {broll.map((b, i) => {
        if ((b.kind ?? "static") !== "hook_title") return null;
        const from = Math.round(b.start_sec * fps);
        const dur = Math.max(1, Math.round((b.end_sec - b.start_sec) * fps));
        return (
          <Sequence key={`hooktop-${i}`} from={from} durationInFrames={dur}>
            {(b as unknown as { style?: string }).style === "cinematic" ? (
              <CinematicHook
                kicker={b.kicker ?? ""}
                title={b.title ?? ""}
                vertical={b.vertical}
                font={(b as unknown as { hook_font?: "grotesk" | "serif" }).hook_font}
                beat_start_sec={b.start_sec}
              />
            ) : (
            <HookTitle
              kicker={b.kicker ?? ""}
              title={b.title ?? ""}
              vertical={b.vertical}
              align={b.align as "center" | "left" | "flank" | undefined}
              left_text={b.left_text}
              right_text={b.right_text}
              beat_start_sec={b.start_sec}
              logo_path={(b as unknown as { logo_path?: string }).logo_path}
              logo_paths={(b as unknown as { logo_paths?: string[] }).logo_paths}
            />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
