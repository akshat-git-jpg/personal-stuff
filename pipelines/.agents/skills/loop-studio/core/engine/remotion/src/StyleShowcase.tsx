import {
  AbsoluteFill,
  Series,
  useVideoConfig,
} from "remotion";
import { TitleCard } from "./templates/TitleCard";
import { VerticalTimeline } from "./templates/VerticalTimeline";
import { Callout } from "./templates/Callout";
import { StatPunch } from "./templates/StatPunch";
import { QuotePull } from "./templates/QuotePull";
import { VsSplit } from "./templates/VsSplit";
import { KeywordChips } from "./templates/KeywordChips";
import { ProgressSteps } from "./templates/ProgressSteps";
import { ChapterBar } from "./templates/ChapterBar";
import { AIImageOnGrid } from "./templates/AIImageOnGrid";
import { MetricReveal } from "./templates/MetricReveal";
import { NotificationToast } from "./templates/NotificationToast";
import { HorizontalTimeline } from "./templates/HorizontalTimeline";
import { ChatMessage } from "./templates/ChatMessage";
import { StatGrid } from "./templates/StatGrid";
import { FlowDiagram } from "./templates/FlowDiagram";
import { BulletedList } from "./templates/BulletedList";
import { ComparisonGrid } from "./templates/ComparisonGrid";
import { BarChart } from "./templates/BarChart";
import { NetworkDiagram } from "./templates/NetworkDiagram";
import { CinematicTitle } from "./templates/CinematicTitle";
import { TickerFeed } from "./templates/TickerFeed";
import { LightGridBg, DarkGridBg } from "./templates/Backgrounds";
import { ConceptBuild } from "./templates/ConceptBuild";

const SECTION_SECONDS = 4.5;

const SectionTag: React.FC<{
  index: string;
  name: string;
  description: string;
  dark?: boolean;
}> = ({ index, name, description, dark }) => {
  const { width } = useVideoConfig();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const tagBg = dark ? "#CFFF05" : "#0F121A";
  const tagFg = dark ? "#0F121A" : "#FFFFFF";
  const descBg = dark ? "rgba(15,18,26,0.85)" : "rgba(255,255,255,0.92)";
  const descFg = dark ? "#FFFFFF" : "#0F121A";
  return (
    <div style={{
      position: "absolute",
      top: width * 0.04,
      left: width * 0.05,
      right: width * 0.05,
      zIndex: 1000,
      pointerEvents: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: width * 0.02, marginBottom: width * 0.018 }}>
        <div style={{
          padding: `${width * 0.012}px ${width * 0.022}px`,
          backgroundColor: tagBg,
          color: tagFg,
          fontFamily,
          fontWeight: 700,
          fontSize: Math.round(width * 0.030),
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          {index} — {name}
        </div>
      </div>
      <div style={{
        backgroundColor: descBg,
        color: descFg,
        fontFamily,
        fontWeight: 600,
        fontSize: Math.round(width * 0.028),
        lineHeight: 1.3,
        padding: `${width * 0.014}px ${width * 0.022}px`,
      }}>
        {description}
      </div>
    </div>
  );
};

export const StyleShowcase: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Series>
        {/* 01 — Title card */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <TitleCard number="5" title={"Ways to actually\nmake money"} />
            <SectionTag
              index="01"
              name="Title card"
              description="Section opener at the start of a video or chapter. Big number + bold uppercase title. Hold 2.5–4s on a hook line like '5 things' or '3 lessons'."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 02 — Vertical timeline */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1.5)}>
          <AbsoluteFill>
            <VerticalTimeline
              items={[
                {
                  heading: "The On-Site Audit",
                  description: "Walk in, spend two hours getting a deep understanding of their business",
                  appear_sec: 0.3,
                },
                {
                  heading: "AI Integration",
                  description: "Feed all the data and insights you gathered directly into Claude",
                  appear_sec: 1.6,
                },
                {
                  heading: "Strategic Roadmap",
                  description: "Have Claude generate a full roadmap with the top 10 actions to take",
                  appear_sec: 3.2,
                },
              ]}
            />
            <SectionTag
              index="02"
              name="Vertical timeline"
              description="Walking through 3–5 sequential steps with a heading + one-line description each. Items reveal in sync with the speaker. Best for processes, methodologies, frameworks."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 03 — Callout */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <Callout
              prefix={"You don't just deliver the plan,\nyou stay on as their"}
              highlight="AI advisor"
            />
            <SectionTag
              index="03"
              name="Callout"
              description="A single statement with one phrase highlighted in lime. The punchline beat — anchors a key claim, the 'remember this line' moment."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 04 — Stat punch */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <StatPunch
              preLabel="OF FOUNDERS"
              value="73%"
              caption="ship features nobody asked for"
            />
            <SectionTag
              index="04"
              name="Stat punch"
              description="One huge number anchored center, supporting caption below. Use mid-sentence on a landing word ('73 percent…', '$10K MRR…'). Hold 1.5–2.5s."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 05 — Quote pull */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <QuotePull
              text={"I built it in a weekend.\nIt now does $40K / mo."}
              attribution="@gregisenberg"
            />
            <SectionTag
              index="05"
              name="Quote pull"
              description="Reading a tweet, comment, or customer line verbatim. Lime quote glyph + attribution. The 'receipt' beat — proof / testimonial / quoting someone else."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 06 — VS split */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <VsSplit
              topLabel="OLD WAY"
              topItems={["7 tools, 4 hours", "$200/mo subscriptions", "Half of it broken"]}
              bottomLabel="NEW WAY"
              bottomItems={["1 prompt, 4 minutes", "$0/mo", "Just works"]}
              winner="bottom"
            />
            <SectionTag
              index="06"
              name="VS split (before/after)"
              description="Stacked top/bottom contrast. Lime accent goes on the winning side. Use when arguing two options, eras, or approaches in one shot."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 07 — Keyword chips */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <KeywordChips
              title="The stack"
              chips={[
                { text: "Supabase", appear_sec: 0.4 },
                { text: "Remotion", appear_sec: 0.9 },
                { text: "Claude", appear_sec: 1.4, active: true },
                { text: "Cloudflare", appear_sec: 1.9 },
                { text: "Stripe", appear_sec: 2.4 },
              ]}
            />
            <SectionTag
              index="07"
              name="Keyword chips"
              description="Pill-shaped tags pop in as the speaker name-drops tools/terms. Use for tech stacks, framework lists, vocabulary intros — anything 4–8 short tokens."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 08 — Progress steps */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <ProgressSteps
              title="Pipeline"
              steps={[
                { label: "Research", appear_sec: 0.2, active_sec: 0.5 },
                { label: "Outline", appear_sec: 0.8, active_sec: 1.2 },
                { label: "Script", appear_sec: 1.6, active_sec: 2.0 },
                { label: "Slides", appear_sec: 2.5, active_sec: 2.9 },
                { label: "Ship", appear_sec: 3.4, active_sec: 3.8 },
              ]}
            />
            <SectionTag
              index="08"
              name="Progress steps"
              description="Vertical numbered chain that fills with lime as the speaker walks through each step. Glanceable pipeline recap — ~2s vs the timeline's 6s."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 09 — Chapter bar (composited over a stand-in dark bg) */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            {/* Stand-in for "speaker layer" — a soft gradient */}
            <AbsoluteFill style={{
              background: "linear-gradient(135deg, #343E5B 0%, #0F121A 70%)",
            }} />
            <ChapterBar number="02" title="Retention engineering" />
            <SectionTag
              index="09"
              name="Chapter bar"
              description="Persistent chapter marker pinned bottom-third. Holds 6–10s while speaker talks. Editorial 'what part of the video is this' tag — not a name/title chyron."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 10 — AI image on grid */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <AIImageOnGrid
              src="style_showcase/ai_database.png"
              caption="Generated WITH brand grid as init image — one cohesive frame"
            />
            <SectionTag
              index="10"
              name="AI image on grid"
              description="Generated AI subject (database / key / chart / etc.) composited over the same brand grid the templates use — so the video stays visually unified across programmatic + AI beats."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 11 — Horizontal timeline (static, no pan) */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <HorizontalTimeline
              title="WHAT YOU'LL LEARN"
              steps={[
                { heading: "What a routine actually is", description: "Definition + the 6 moving parts", appear_sec: 0.30 },
                { heading: "When to automate", description: "The three yes/no questions", appear_sec: 1.30 },
                { heading: "Routine or static script", description: "Creative work vs deterministic jobs", appear_sec: 2.30 },
                { heading: "Build & run your own", description: "Spec sheet → live Claude Code session", appear_sec: 3.30 },
              ]}
            />
            <SectionTag
              index="11"
              name="Horizontal timeline"
              description="Static N-card strip across the frame. Cards reveal one-by-one at appear_sec then stay locked in place — never panning. Best for 'what you'll learn' / chapter previews. Hold 4.5–6.0s."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 12 — Metric reveal */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            <MetricReveal
              pre_label="MONTHLY RECURRING"
              prefix="$"
              target={28400}
              suffix="/mo"
              caption="from a single Claude routine running every morning"
            />
            <SectionTag
              index="12"
              name="Metric reveal"
              description="Animated count-up 0 → target. Prefix/suffix in lime sit on raisin chips so the lime accent reads as a deliberate badge. Use for growth / revenue / retention reveals where the magnitude lands during the count."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 13 — Notification toast (over a fake speaker tint) */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS)}>
          <AbsoluteFill>
            {/* Mid-grey placeholder backdrop simulates the speaker plate. The
                component itself adds NO backdrop — it overlays whatever's
                behind it. */}
            <AbsoluteFill style={{ background: "linear-gradient(135deg, #2A2F3D 0%, #1A1F2E 100%)" }} />
            <NotificationToast
              app_name="Slack"
              title="New message in #routines"
              body="Routine succeeded — drafted 3 emails, queued for review."
              time="now"
            />
            <SectionTag
              index="13"
              name="Notification toast"
              description="iOS/macOS-style push slides in from top, holds, slides out. PARTIAL overlay, NO backdrop of its own — sits over the live speaker. Use for 'I got a Slack saying X' / 'my routine pinged me' beats."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 14 — Chat message */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1.5)}>
          <AbsoluteFill>
            <ChatMessage
              messages={[
                { role: "user",  name: "Me",     text: "Run the morning signal routine.",                                  appear_sec: 0.3 },
                { role: "agent", name: "Claude", text: "Pulling Hacker News, Anthropic blog, and The Verge AI…",          appear_sec: 1.4 },
                { role: "agent",                  text: "5 picks queued, draft email ready to send.",                       appear_sec: 2.5 },
                { role: "user",                   text: "Send it.",                                                          appear_sec: 3.6 },
              ]}
            />
            <SectionTag
              index="14"
              name="Chat message"
              description="iMessage-style conversation. User bubbles right (raisin), agent left (lime), other left (steel). Stack bubbles bottom-up. Use for 'I asked Claude X and it said Y' / customer conversations / agent dialogue."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 15 — Stat grid */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <StatGrid
              title="FOUNDER OS — TODAY"
              stats={[
                { value: "12", label: "Schedules",  delta: "+2",   appear_sec: 0.30 },
                { value: "18", label: "Routines",   delta: "+3",   appear_sec: 0.80 },
                { value: "22", label: "Skills",                    appear_sec: 1.30 },
                { value: "48", label: "Edge fns",   delta: "+12",  appear_sec: 1.80 },
              ]}
            />
            <SectionTag
              index="15"
              name="Stat grid"
              description="Multiple mini-stats in a 1×N or 2×N grid. Each cell pops in at its own appear_sec so the grid builds with the speaker. Optional delta chip in lime for positive deltas. Use when speaker rattles off multiple numbers in sequence."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 16 — Flow diagram */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <FlowDiagram
              title="MORNING SIGNAL — PIPELINE"
              nodes={[
                { glyph: "🛰️", label: "Trigger",  description: "Cron at 7:30 Europe/Amsterdam", appear_sec: 0.3 },
                { glyph: "📥", label: "Fetch",    description: "HN, Anthropic, The Verge, Product Hunt", appear_sec: 1.2 },
                { glyph: "🧠", label: "Score",    description: "Filter through me-context", appear_sec: 2.1 },
                { glyph: "✉️", label: "Send",     description: "Drafted email, ready to ship", appear_sec: 3.0, highlight: true },
              ]}
            />
            <SectionTag
              index="16"
              name="Flow diagram"
              description="Horizontal pipeline of 2–5 nodes connected by arrows. Boxes pop in left-to-right; arrows wipe between them. Use for showing a workflow / data pipeline / decision sequence. Highlight the 'current' or 'winning' node in lime."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 17 — Bulleted list */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <BulletedList
              title="SHOULD YOU AUTOMATE THIS?"
              items={[
                { glyph: "check", text: "Does it actually repeat?",                appear_sec: 0.3 },
                { glyph: "check", text: "Are the inputs predictable without you?", appear_sec: 1.2 },
                { glyph: "x",     text: "Does the failure mode have a fallback?",  appear_sec: 2.1 },
                { glyph: "warn",  text: "Most ideas shouldn't pass.",              appear_sec: 3.0 },
              ]}
            />
            <SectionTag
              index="17"
              name="Bulleted list"
              description="Vertical list with semantic glyphs (✓/✗/•/→/!) on lime/raisin/amber chips. Items reveal one at a time. Use for yes/no checklists, requirements, single-column pros/cons."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 19 — Bar chart */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <BarChart
              title="DAILY USERS — LAST 4 WEEKS"
              bars={[
                { label: "Week 1", value: 1240, appear_sec: 0.30 },
                { label: "Week 2", value: 2180, appear_sec: 0.80 },
                { label: "Week 3", value: 3950, appear_sec: 1.30 },
                { label: "Week 4", value: 6420, highlight: true, appear_sec: 1.80 },
              ]}
            />
            <SectionTag
              index="19"
              name="Bar chart"
              description="Animated horizontal/vertical bars that grow from 0 → value over 0.75s with a smooth ease. Value labels tick up in sync with the bars. Highlight one bar with the lime accent. Use for growth comparisons, rankings, before/after metrics."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 20 — Network diagram */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 2)}>
          <AbsoluteFill>
            <NetworkDiagram
              title="MORNING SIGNAL — AGENT TOPOLOGY"
              nodes={[
                { id: "cron",   label: "Cron",       glyph: "🛰️", x: 0.10, y: 0.25, appear_sec: 0.30 },
                { id: "fetch",  label: "Fetch",      glyph: "📥", x: 0.40, y: 0.25, appear_sec: 0.85 },
                { id: "score",  label: "Claude",     glyph: "🧠", x: 0.70, y: 0.50, appear_sec: 1.40, highlight: true },
                { id: "send",   label: "Resend",     glyph: "✉️", x: 0.40, y: 0.75, appear_sec: 2.00 },
                { id: "log",    label: "Supabase",   glyph: "🗄️", x: 0.10, y: 0.75, appear_sec: 2.50 },
              ]}
              edges={[
                { from: "cron",  to: "fetch", label: "07:30",  flowing: true,  appear_sec: 0.85 },
                { from: "fetch", to: "score",                  flowing: true,  appear_sec: 1.40 },
                { from: "score", to: "send",  label: "draft",  flowing: true,  appear_sec: 2.00 },
                { from: "send",  to: "log",                                    appear_sec: 2.50 },
                { from: "log",   to: "cron",  label: "next",                   appear_sec: 3.00 },
              ]}
            />
            <SectionTag
              index="20"
              name="Network diagram"
              description="Circular nodes connected by animated edges. Lime arrow lines draw in left-to-right; optional 'flowing' marker travels along edges to show data movement. Use for system topology, agent maps, decision trees, branching workflows."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 21 — Cinematic title */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1)}>
          <AbsoluteFill>
            <CinematicTitle
              chapter="03"
              title="The Four-Step Rule"
              subtitle="What I run every time Anthropic ships."
              kicker="CHAPTER"
            />
            <SectionTag
              index="21"
              name="Cinematic title"
              description="Chapter divider for longform. Curtain wipe → kicker → chapter number slams in → lime divider → title slides → subtitle. The 'we're moving on' beat between major sections of a 5+ min video."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 22 — Ticker feed */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 1.5)}>
          <AbsoluteFill>
            <TickerFeed
              title="ROUTINES — LIVE FEED"
              items={[
                { label: "Cron Fired",      text: "morning-signal: triggered at 07:30",                 time: "now",   glyph: "⚡",  appear_sec: 0.30 },
                { label: "Fetch",           text: "Pulled 47 stories from HN, Anthropic, The Verge.",   time: "1s",    glyph: "📥",  appear_sec: 1.10 },
                { label: "Score",           text: "Filtered through me-context — 5 picks selected.",    time: "3s",    glyph: "🧠",  appear_sec: 1.90 },
                { label: "Send",            text: "Email queued to luuk@alleman.nl via Resend.",        time: "5s",    glyph: "✉️",   appear_sec: 2.70 },
                { label: "Done",            text: "Wrote run-log to Supabase. Routine succeeded.",      time: "6s",    glyph: "✓",    appear_sec: 3.50 },
              ]}
            />
            <SectionTag
              index="22"
              name="Ticker feed"
              description="Newest item appears at top; older items slide down. Each row has a lime border-left that 'lights up' on entrance, then dims as the row ages. Use for live activity logs, automation events, transactions, build progress."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 18 — Comparison grid */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 2)}>
          <AbsoluteFill>
            <ComparisonGrid
              title="ROUTINE vs SCRIPT"
              columns={[
                { label: "Manual",        appear_sec: 0.20 },
                { label: "Static script", appear_sec: 0.50 },
                { label: "Routine",       winner: true, appear_sec: 0.80 },
              ]}
              rows={[
                { feature: "Repeats?",         values: [true, true, true],       appear_sec: 1.40 },
                { feature: "Adapts?",          values: [false, false, true],     appear_sec: 2.10 },
                { feature: "Maintenance",      values: ["high", "medium", "low"], appear_sec: 2.80 },
                { feature: "Setup time",       values: ["0 min", "1 hr", "10 min"], appear_sec: 3.50 },
              ]}
            />
            <SectionTag
              index="18"
              name="Comparison grid"
              description="Multi-column feature matrix beyond vs_split's two sides. Headers fade in left-to-right; rows reveal top-to-bottom. Boolean cells render ✓ (lime) / ✗ (grey); strings render verbatim. Highlight one column as `winner` for the lime header."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 29 — Concept build (flagship explainer) */}
        <Series.Sequence durationInFrames={sec(SECTION_SECONDS + 2.5)}>
          <AbsoluteFill>
            <ConceptBuild
              title="ANATOMY OF AN AGENT"
              startSec={0}
              elements={[
                { id: "agent", label: "THE AGENT", variant: "frame", x: 0.33, y: 0.52, w: 0.52, h: 0.6, appear_sec: 0.2 },
                { id: "llm",   label: "Model",  glyph: "🧠", variant: "tile", x: 0.20, y: 0.36, appear_sec: 0.7 },
                { id: "mem",   label: "Memory", glyph: "💾", variant: "tile", x: 0.20, y: 0.68, appear_sec: 1.2 },
                { id: "tools", label: "Tools",  glyph: "🔧", variant: "tile", x: 0.46, y: 0.52, emphasis: true, appear_sec: 1.8 },
                { id: "world", label: "Your systems", sublabel: "DB · APIs · email", variant: "box", x: 0.82, y: 0.52, appear_sec: 2.5 },
                { id: "note",  label: "the part that touches reality", variant: "note", x: 0.82, y: 0.78, appear_sec: 3.0 },
              ]}
              connectors={[
                { from: "tools", to: "world", label: "acts on", flowing: true, emphasis: true, appear_sec: 2.9 },
              ]}
            />
            <SectionTag
              index="29"
              name="Concept build"
              description="Flagship 'more than a diagram' explainer. Free-form VO-synced canvas: labeled elements (box / chip / tile / frame / note) at arbitrary positions + connectors, each revealed on its spoken beat. Use for structure / composition / metaphor builds the rigid flow & network templates can't express."
              dark
            />
          </AbsoluteFill>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
