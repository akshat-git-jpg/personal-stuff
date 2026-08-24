import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useFadeRise, useSettleZoom, useSpringIn, useTypeBase } from "./motion";

export type MetricRevealProps = {
  /** Optional small label above the metric (e.g. "MRR" / "DAILY USERS"). */
  pre_label?: string;
  /** Prefix attached to the rolling number ("$" / "+"). */
  prefix?: string;
  /** Numerical target the counter rolls TO. Use raw integer/float. */
  target: number;
  /** Suffix attached after the number ("k", "%", "/mo", "x"). */
  suffix?: string;
  /** Caption beneath the metric. */
  caption: string;
  /** Roll-up duration in seconds. Default 1.2s. */
  duration_sec?: number;
  /** Number of decimal places to render. Default 0 (integer). */
  decimals?: number;
};

/**
 * Animated count-up to a hero number. The richer cousin of `stat_punch`:
 * stat_punch is a static reveal; metric_reveal counts from 0 → target so the
 * viewer sees the magnitude land. Best for growth stories ("0 → 12k subs"),
 * revenue reveals ("$28k MRR"), retention shifts ("retention at 87%").
 *
 * Choreography (relative to beat start):
 *   0.00s   pre_label fades up
 *   0.20s   counter starts rolling 0 → target (smooth ease-out)
 *  ~1.50s   counter lands; settle zoom 1.00 → 1.025 over 1.5s
 *   0.55s   caption fades up beneath
 *
 * Hard rules baked in:
 *  - Counter font auto-fits so the LONGEST formatted value (target +
 *    prefix + suffix) fits inside 80% of the frame at hero size
 *  - Tabular-nums so digits don't shift width as the counter rolls
 *  - Decimal places lock — passing decimals=2 keeps the ".XX" stable from
 *    the first frame, so layout doesn't reflow mid-roll
 *  - Single neo-lime accent: prefix + suffix in lime, target number in raisin
 */
export const MetricReveal: React.FC<MetricRevealProps> = ({
  pre_label,
  prefix,
  target,
  suffix,
  caption,
  duration_sec,
  decimals,
}) => {
  const { fps, width } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const dur = duration_sec ?? 1.2;
  const decimalPlaces = decimals ?? 0;
  const startSec = 0.20;

  // Roll-up — eased so the counter slows into its landing.
  const k = interpolate(
    frame / fps,
    [startSec, startSec + dur],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.20, 0.65, 0.20, 1.0),
    },
  );
  const current = target * k;
  const formatted = current.toFixed(decimalPlaces);
  // Format with thousand separators while preserving decimals (en-US)
  const formattedHuman = (() => {
    const [intPart, decPart] = formatted.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart != null ? `${intWithSep}.${decPart}` : intWithSep;
  })();

  // ── Auto-fit hero font size ───────────────────────────────────────────
  // Final string is `<prefix><target_human><suffix>`. We size for that.
  const finalIntPart = Math.floor(target).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const finalStr = `${prefix ?? ""}${finalIntPart}${decimalPlaces ? "." + "0".repeat(decimalPlaces) : ""}${suffix ?? ""}`;
  const AVG_CHAR = 0.62;
  const SAFE = 0.80;
  const maxByWord = (width * SAFE) / (Math.max(1, finalStr.length) * AVG_CHAR);
  const heroFontSize = Math.round(Math.min(typeBase * 0.30, maxByWord));

  // ── Animations ─────────────────────────────────────────────────────────
  const labelEnter = useFadeRise(0.00, 0.40, 12);
  const counterSpring = useSpringIn(0.10, 0.50);
  const settleZoom = useSettleZoom(startSec + dur, 1.5, 1.025);
  const captionEnter = useFadeRise(0.55, 0.45, 14);

  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: width * 0.04,
      }}>
        {pre_label && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.034),
            color: "#B5BFC2",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: Math.round(typeBase * 0.025),
            opacity: labelEnter.opacity,
            transform: `translateY(${labelEnter.ty}px)`,
          }}>
            {pre_label}
          </div>
        )}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: Math.round(typeBase * 0.005),
          opacity: counterSpring,
          transform: `scale(${(0.85 + 0.15 * counterSpring) * settleZoom})`,
        }}>
          {prefix && (
            <span style={{
              fontFamily,
              fontWeight: 700,
              fontSize: Math.round(heroFontSize * 0.40),
              color: "#CFFF05",
              lineHeight: 1.0,
              letterSpacing: "-0.01em",
              alignSelf: "flex-start",
              marginTop: Math.round(heroFontSize * 0.12),
              marginRight: Math.round(typeBase * 0.008),
              padding: `${Math.round(heroFontSize * 0.08)}px ${Math.round(heroFontSize * 0.14)}px`,
              backgroundColor: "#1E2434",
              borderRadius: Math.round(heroFontSize * 0.10),
              boxShadow: `0 ${Math.round(heroFontSize * 0.015)}px ${Math.round(heroFontSize * 0.040)}px rgba(15,18,26,0.20)`,
              display: "inline-block",
            }}>
              {prefix}
            </span>
          )}
          <span style={{
            fontFamily,
            fontWeight: 700,
            fontSize: heroFontSize,
            color: "#E9ECED",
            lineHeight: 0.85,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {formattedHuman}
          </span>
          {suffix && (
            <span style={{
              fontFamily,
              fontWeight: 700,
              fontSize: Math.round(heroFontSize * 0.36),
              color: "#CFFF05",
              lineHeight: 1.0,
              letterSpacing: "-0.01em",
              alignSelf: "flex-end",
              marginBottom: Math.round(heroFontSize * 0.10),
              marginLeft: Math.round(typeBase * 0.008),
              padding: `${Math.round(heroFontSize * 0.08)}px ${Math.round(heroFontSize * 0.14)}px`,
              backgroundColor: "#1E2434",
              borderRadius: Math.round(heroFontSize * 0.10),
              boxShadow: `0 ${Math.round(heroFontSize * 0.015)}px ${Math.round(heroFontSize * 0.040)}px rgba(15,18,26,0.20)`,
              display: "inline-block",
            }}>
              {suffix}
            </span>
          )}
        </div>
        <div style={{
          fontFamily,
          fontWeight: 600,
          fontSize: Math.round(typeBase * 0.040),
          color: "#B5BFC2",
          lineHeight: 1.25,
          marginTop: Math.round(typeBase * 0.040),
          maxWidth: width * 0.85,
          opacity: captionEnter.opacity,
          transform: `translateY(${captionEnter.ty}px)`,
        }}>
          {caption}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
