// Six static design options for the "link in description" overlay.
// All are positioned mid-bottom, centered horizontally. NO animation here —
// these are just the final look so the user can pick a visual style first.

import React from "react";
import { AbsoluteFill } from "remotion";
import { colors, fonts } from "../design/theme";

// Shared positioning: a hair below center, horizontally centered.
const stage = (children: React.ReactNode): React.ReactElement => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "70%",
        display: "flex",
        justifyContent: "center",
        fontFamily: fonts.family,
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

// Reusable down-arrow svg
const DownArrow: React.FC<{ size?: number; color?: string; weight?: number }> = ({
  size = 18,
  color = colors.accentSolid,
  weight = 2.5,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 4 L12 18 M6 13 L12 19 L18 13"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// =============================================================================
// 1. PILL — rounded pill, arrow + text, soft amber border. Mid-weight default.
// =============================================================================
export const LinkPill: React.FC = () =>
  stage(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 28px",
        background:
          "linear-gradient(180deg, rgba(20, 12, 4, 0.92), rgba(10, 6, 2, 0.88))",
        border: `1.5px solid rgba(251, 146, 60, 0.65)`,
        borderRadius: 999,
        boxShadow: "0 0 24px rgba(251, 146, 60, 0.25), 0 6px 20px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
      }}
    >
      <DownArrow size={22} />
      <span
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: colors.textPrimary,
        }}
      >
        Link in description
      </span>
    </div>,
  );

// =============================================================================
// 2. TICKET — coupon-style with dashed top edge + uppercase text.
// =============================================================================
export const LinkTicket: React.FC = () =>
  stage(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "20px 36px 22px",
        background:
          "linear-gradient(180deg, rgba(25, 15, 5, 0.94), rgba(15, 9, 3, 0.92))",
        borderRadius: 6,
        border: `1px solid rgba(251, 146, 60, 0.35)`,
        borderTop: `2px dashed ${colors.accentSolid}`,
        boxShadow: "0 6px 24px rgba(0,0,0,0.55)",
        position: "relative",
      }}
    >
      {/* Notched bottom corners */}
      <div
        style={{
          position: "absolute",
          left: -7,
          bottom: -1,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "transparent",
          boxShadow: `inset 0 0 0 1px rgba(251, 146, 60, 0.35)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -7,
          bottom: -1,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "transparent",
          boxShadow: `inset 0 0 0 1px rgba(251, 146, 60, 0.35)`,
        }}
      />
      <DownArrow size={26} color={colors.win} weight={2.8} />
      <span
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: colors.textPrimary,
        }}
      >
        Link in description
      </span>
    </div>,
  );

// =============================================================================
// 3. BRACKET — minimalist editorial framing with angled corner brackets.
// =============================================================================
export const LinkBracket: React.FC = () => {
  const brackSize = 18;
  const brackStyle: React.CSSProperties = {
    position: "absolute",
    width: brackSize,
    height: brackSize,
    borderColor: colors.accentSolid,
    borderStyle: "solid",
    borderWidth: 0,
  };
  return stage(
    <div
      style={{
        position: "relative",
        padding: "20px 44px",
        background: "rgba(10, 6, 2, 0.55)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* 4 corner brackets */}
      <span style={{ ...brackStyle, top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <span style={{ ...brackStyle, top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }} />
      <span style={{ ...brackStyle, bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <span style={{ ...brackStyle, bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <DownArrow size={22} />
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: colors.textPrimary,
          }}
        >
          Link in description
        </span>
      </div>
    </div>,
  );
};

// =============================================================================
// 4. UNDERLINE — pure text with a thick gradient underline + small down arrow.
// =============================================================================
export const LinkUnderline: React.FC = () =>
  stage(
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: -0.6,
          color: colors.textPrimary,
          background: "transparent",
          paddingBottom: 6,
          borderBottom: `4px solid ${colors.accentSolid}`,
          // soft glow on the underline
          boxShadow: `inset 0 -8px 12px -8px ${colors.accentGlow}`,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}
      >
        Link in description
      </span>
      <DownArrow size={32} weight={3.2} />
    </div>,
  );

// =============================================================================
// 5. HIGHLIGHT BAR — full-width thin horizontal stripe with arrow + text inside.
// =============================================================================
export const LinkHighlightBar: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "72%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        fontFamily: fonts.family,
      }}
    >
      {/* top accent line */}
      <div
        style={{
          width: 700,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${colors.accentSolid}, transparent)`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          width: "100%",
          background:
            "linear-gradient(180deg, rgba(20, 12, 4, 0.88), rgba(10, 6, 2, 0.85))",
          padding: "18px 0",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          backdropFilter: "blur(10px)",
        }}
      >
        <DownArrow size={22} color={colors.win} />
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: colors.textPrimary,
          }}
        >
          Link in description
        </span>
        <DownArrow size={22} color={colors.win} />
      </div>
      {/* bottom accent line */}
      <div
        style={{
          width: 700,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${colors.accentSolid}, transparent)`,
          opacity: 0.6,
        }}
      />
    </div>
  </AbsoluteFill>
);

// =============================================================================
// 6. TAG — asymmetric price-tag shape with bold caps + arrow.
// =============================================================================
export const LinkTag: React.FC = () =>
  stage(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: `linear-gradient(135deg, ${colors.accentFrom}, ${colors.accentTo})`,
        padding: "14px 22px 14px 36px",
        clipPath:
          "polygon(20px 0, 100% 0, 100% 100%, 20px 100%, 0 50%)",
        boxShadow: "0 8px 28px rgba(194, 65, 12, 0.45), 0 0 24px rgba(251, 146, 60, 0.35)",
      }}
    >
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#1a0f04",
          marginRight: 14,
        }}
      >
        Link below
      </span>
      <DownArrow size={22} color="#1a0f04" weight={3} />
    </div>,
  );
