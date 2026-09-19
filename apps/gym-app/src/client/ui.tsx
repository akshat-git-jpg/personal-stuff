import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/* ---- Icons (stroke, 24px grid) ---- */
type IP = { size?: number; style?: React.CSSProperties };
const S = ({ size = 22, style, children }: IP & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);
export const IconBack = (p: IP) => (
  <S {...p}>
    <path d="M15 18l-6-6 6-6" />
  </S>
);
export const IconPlus = (p: IP) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconCheck = (p: IP) => (
  <S {...p}>
    <path d="M20 6L9 17l-5-5" />
  </S>
);
export const IconGrip = (p: IP) => (
  <S {...p}>
    <circle cx="9" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="18" r="1" />
  </S>
);
export const IconTrash = (p: IP) => (
  <S {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </S>
);
export const IconMinusCircle = (p: IP) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </S>
);
/** `on` fills the star, so starred reads at a glance without colour alone. */
export const IconStar = ({ on, ...p }: IP & { on?: boolean }) => (
  <S {...p} style={{ ...p.style, fill: on ? "currentColor" : "none" }}>
    <path d="M12 3.6l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z" />
  </S>
);
export const IconRepeat = (p: IP) => (
  <S {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </S>
);
export const IconHistory = (p: IP) => (
  <S {...p}>
    <path d="M3 3v5h5" />
    <path d="M3 8a9 9 0 1 0 3-5L3 8" />
    <path d="M12 7v5l3 2" />
  </S>
);

/* ---- Per-group accent colors (instant recognition) ---- */
const PALETTE: Record<string, string> = {
  chest: "#ccff00",
  triceps: "#ff7a45",
  back: "#3ad6ff",
  biceps: "#ff5ea8",
  forearms: "#b388ff",
  legs: "#ffd23a",
  abs: "#5dff9b",
  "front delts": "#ff9f1c",
  "side delts": "#46e0d0",
  "rear delts": "#8c9eff",
  "anu gym": "#e0e0e6",
};
export function accentFor(name: string): string {
  const k = name.trim().toLowerCase();
  if (PALETTE[k]) return PALETTE[k];
  // Stable hash -> hue for anything new.
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
  return `hsl(${h} 90% 62%)`;
}

/* ---- Toast ---- */
export type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; msg: string; err?: boolean; action?: ToastAction };
type Push = (msg: string, err?: boolean, action?: ToastAction) => void;
const ToastCtx = createContext<Push>(() => {});
export const useToast = () => useContext(ToastCtx);

/** An actionable toast stays up long enough to be clicked. */
const LIFE_MS = 2200;
const LIFE_ACTION_MS = 5000;

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const drop = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>(
    (msg, err, action) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, err, action }]);
      setTimeout(() => drop(id), action ? LIFE_ACTION_MS : LIFE_MS);
    },
    [drop],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.err ? " err" : ""}`}>
          <span className="tdot" />
          <span className="tmsg">{t.msg}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.onClick();
                drop(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </ToastCtx.Provider>
  );
}
