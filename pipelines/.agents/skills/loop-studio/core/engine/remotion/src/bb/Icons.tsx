/** Line-icon library for the Business Brain body — simple, one-idea, adapts to dark/light bg. */
import React from "react";
import { LIME, RED } from "./palette";

export const Icon: React.FC<{ id: string; size: number; line: string; frame: number; p?: number; accent?: string }> = ({ id, size, line, frame, p = 1, accent = LIME }) => {
  const sw = 3.0;
  const S = size;
  const box = (n: React.ReactNode, rot = 0) => (
    <svg width={S} height={S} viewBox="0 0 100 100" style={rot ? { transform: `rotate(${rot}deg)` } : undefined}>{n}</svg>
  );
  switch (id) {
    case "mdfile": // a markdown/text file (frozen)
      return box(<>
        <path d="M28 14 H60 L74 28 V86 H28 Z" fill="none" stroke={line} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M60 14 V28 H74" fill="none" stroke={line} strokeWidth={sw} strokeLinejoin="round" />
        {[40, 50, 60, 70].map((y, i) => <line key={y} x1="36" y1={y} x2={i === 3 ? 54 : 66} y2={y} stroke={line} strokeWidth={sw * 0.8} strokeLinecap="round" opacity={0.55} />)}
      </>);
    case "folder":
      return box(<>
        <path d="M16 30 H42 L50 38 H84 V78 H16 Z" fill="none" stroke={line} strokeWidth={sw} strokeLinejoin="round" />
      </>);
    case "database":
      return box(<>
        <ellipse cx="50" cy="26" rx="30" ry="11" fill="none" stroke={line} strokeWidth={sw} />
        <path d="M20 26 V74 A30 11 0 0 0 80 74 V26" fill="none" stroke={line} strokeWidth={sw} />
        <path d="M20 50 A30 11 0 0 0 80 50" fill="none" stroke={line} strokeWidth={sw} opacity={0.5} />
        <line x1="30" y1="40" x2="62" y2="40" stroke={accent} strokeWidth={sw * 1.2} strokeLinecap="round" opacity={p} />
      </>);
    case "loop":
      return box(<>
        <path d="M50 18 A32 32 0 1 1 22 34" fill="none" stroke={line} strokeWidth={sw} strokeLinecap="round" />
        <path d="M50 8 L50 24 L64 16" fill="none" stroke={accent} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </>, frame * 1.4);
    case "files":
      return box(<>{[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${18 + i * 9} ${20 + i * 8})`}>
          <rect x="0" y="0" width="46" height="34" rx="4" fill="none" stroke={line} strokeWidth={sw} />
          <line x1="8" y1="12" x2="30" y2="12" stroke={i === 2 ? accent : line} strokeWidth={sw * 0.8} strokeLinecap="round" opacity={i === 2 ? p : 0.5} />
        </g>))}</>);
    case "dashboard":
      return box(<>
        <rect x="16" y="24" width="68" height="52" rx="6" fill="none" stroke={line} strokeWidth={sw} />
        <line x1="16" y1="37" x2="84" y2="37" stroke={line} strokeWidth={sw * 0.7} opacity={0.6} />
        {[22, 26, 30].map((cx) => <circle key={cx} cx={cx} cy="30.5" r="1.6" fill={line} />)}
        <polyline points="26,64 40,56 52,60 66,44 76,50" fill="none" stroke={accent} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={p} />
      </>);
    case "spark":
      return box(<>{Array.from({ length: 11 }).map((_, i) => {
        const a = (i / 11) * Math.PI * 2 - Math.PI / 2, inn = 10, out = 30 + 9 * Math.abs(Math.sin(i * 1.7));
        return <line key={i} x1={50 + Math.cos(a) * inn} y1={50 + Math.sin(a) * inn} x2={50 + Math.cos(a) * out} y2={50 + Math.sin(a) * out} stroke={line} strokeWidth={sw * 1.4} strokeLinecap="round" />;
      })}</>, frame * 0.5);
    case "photo": // a frozen photo (file = photo)
      return box(<>
        <rect x="16" y="20" width="68" height="60" rx="4" fill="none" stroke={line} strokeWidth={sw} />
        <rect x="16" y="20" width="68" height="60" rx="4" fill="none" stroke={line} strokeWidth={sw * 3} opacity={0.15} />
        <circle cx="36" cy="40" r="6" fill="none" stroke={line} strokeWidth={sw} />
        <path d="M22 74 L44 54 L58 66 L70 56 L78 74 Z" fill="none" stroke={line} strokeWidth={sw} strokeLinejoin="round" />
      </>);
    case "movie": // a living film strip (business = movie)
      return box(<>
        <rect x="14" y="28" width="72" height="44" rx="4" fill="none" stroke={line} strokeWidth={sw} />
        {[20, 40, 60, 80].map((x) => <React.Fragment key={x}><rect x={x - 3} y="20" width="6" height="6" fill={line} opacity={0.5} /><rect x={x - 3} y="74" width="6" height="6" fill={line} opacity={0.5} /></React.Fragment>)}
        <path d="M42 40 L42 60 L60 50 Z" fill={accent} opacity={p} />
      </>);
    case "email":
      return box(<>
        <rect x="16" y="28" width="68" height="44" rx="5" fill="none" stroke={line} strokeWidth={sw} />
        <path d="M16 32 L50 54 L84 32" fill="none" stroke={line} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </>);
    case "cart": // new order
      return box(<>
        <path d="M20 24 H30 L38 62 H72 L80 36 H34" fill="none" stroke={line} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="42" cy="74" r="5" fill="none" stroke={line} strokeWidth={sw} />
        <circle cx="68" cy="74" r="5" fill="none" stroke={line} strokeWidth={sw} />
      </>);
    case "clock":
      return box(<>
        <circle cx="50" cy="50" r="32" fill="none" stroke={line} strokeWidth={sw} />
        <line x1="50" y1="50" x2="50" y2="30" stroke={accent} strokeWidth={sw} strokeLinecap="round" transform={`rotate(${frame * 6} 50 50)`} />
        <line x1="50" y1="50" x2="66" y2="50" stroke={line} strokeWidth={sw} strokeLinecap="round" transform={`rotate(${frame * 0.5} 50 50)`} />
      </>);
    case "question":
      return box(<>
        <path d="M36 38 A14 14 0 1 1 50 60 V66" fill="none" stroke={line} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="50" cy="78" r="2.6" fill={line} />
      </>);
    case "stream": // flowing data (business is a stream)
      return box(<>{[30, 44, 58, 72].map((y, i) => (
        <path key={y} d={`M12 ${y} Q 35 ${y - 8 + (frame / 4 + i * 20) % 16}, 55 ${y} T 88 ${y}`} fill="none" stroke={i === 1 ? accent : line} strokeWidth={sw * (i === 1 ? 1 : 0.8)} strokeLinecap="round" opacity={i === 1 ? p : 0.5} />
      ))}</>);
    case "plug": // MCP / give access
      return box(<>
        <line x1="20" y1="50" x2="44" y2="50" stroke={line} strokeWidth={sw} strokeLinecap="round" />
        <rect x="44" y="40" width="16" height="20" rx="3" fill="none" stroke={line} strokeWidth={sw} />
        <line x1="60" y1="45" x2="72" y2="45" stroke={accent} strokeWidth={sw} strokeLinecap="round" />
        <line x1="60" y1="55" x2="72" y2="55" stroke={accent} strokeWidth={sw} strokeLinecap="round" />
        <path d="M72 34 A18 18 0 0 1 72 66" fill="none" stroke={line} strokeWidth={sw} strokeLinecap="round" />
      </>);
    default:
      return box(<circle cx="50" cy="50" r="30" fill="none" stroke={line} strokeWidth={sw} />);
  }
};
