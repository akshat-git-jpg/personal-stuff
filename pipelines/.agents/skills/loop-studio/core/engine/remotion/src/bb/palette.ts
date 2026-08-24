// Business Brain — section palette (the color IS the structure, like the 5-Ways video).
export const RAISIN = "#12161E";
export const LIME = "#CFFF05";
export const CLAY = "#D97757";
export const RED = "#E0614A";

export type Act = "a1" | "a2" | "a3" | "a4";
// each act = its own background colour + ink family (dark vs light bg)
export const ACTS: Record<Act, { bg: string; grad: string; dark: boolean }> = {
  a1: { bg: "#E9ECEE", grad: "radial-gradient(ellipse 80% 70% at 42% 42%, #F3F5F6 0%, #DFE3E5 78%)", dark: false }, // THE PROBLEM — clinical light
  a2: { bg: "#241318", grad: "radial-gradient(ellipse 80% 70% at 42% 42%, #33191F 0%, #1B0E12 78%)", dark: true },  // IT GETS WORSE — maroon
  a3: { bg: "#0E1A2C", grad: "radial-gradient(ellipse 72% 64% at 40% 42%, #18293f 0%, #0e1a2c 68%)", dark: true },   // THE MACHINE — navy
  a4: { bg: "#0A2422", grad: "radial-gradient(ellipse 74% 66% at 42% 42%, #113230 0%, #08201E 72%)", dark: true },   // THE UNLOCK — teal
};

export const SANS = "'Space Grotesk','Helvetica Neue',sans-serif";
export const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";
export const SERIF = "'Playfair Display',Georgia,serif";

export const ink = (dark: boolean) => (dark ? "#EAF0F1" : "#141922");
export const sub = (dark: boolean) => (dark ? "#93A0A6" : "#5A6470");
export const lineC = (dark: boolean) => (dark ? "#CDD5D8" : "#2A3340");
