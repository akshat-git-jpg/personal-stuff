import { Act } from "./palette";

export type Screen = {
  start: number; end: number; act: Act;
  type: "statement" | "icon" | "compare" | "caption" | "stat" | "quote" | "assemble" | "aroll";
  head?: string; headHl?: string; sub?: string; big?: boolean;
  icon?: string; label?: string; tone?: "bad";
  left?: { icon: string; label: string; sub?: string; tone?: "bad" };
  right?: { icon: string; label: string; sub?: string; tone?: "bad" };
  connector?: string;
  text?: string; hl?: string;
  value?: string;
};

export const ACT_TITLES: Record<Act, string> = {
  a1: "THE PROBLEM",
  a2: "IT GETS WORSE",
  a3: "THE MACHINE",
  a4: "THE UNLOCK",
};

// ---- ACT 1 — THE PROBLEM (light / clinical) — anchored to real speech times ----
const A1: Screen[] = [
  { start: 18.06, end: 22.1, act: "a1", type: "aroll" }, // land the hook on camera
  { start: 22.16, end: 28.3, act: "a1", type: "statement", head: "Go all-in on the one thing I’d never have picked.", headHl: "one thing" },
  { start: 28.42, end: 33.1, act: "a1", type: "statement", head: "The “second brain” you built last weekend?", sub: "It could never answer this." },
  { start: 33.18, end: 39.5, act: "a1", type: "caption", text: "Not more prompts. Not a better model. Never.", hl: "Never" },
  { start: 39.59, end: 42.7, act: "a1", type: "statement", head: "Two things you need to understand.", big: true },
  { start: 42.77, end: 49.2, act: "a1", type: "statement", head: "Your business isn’t information. It’s change.", headHl: "change" },
  { start: 49.27, end: 60.9, act: "a1", type: "icon", icon: "folder", label: "A FOLDER OF MARKDOWN FILES", sub: "you · priorities · skills" },
  { start: 60.96, end: 65.2, act: "a1", type: "caption", text: "The gurus call it a “second brain.”", hl: "second brain" },
  { start: 65.24, end: 67.6, act: "a1", type: "caption", text: "Done in a weekend. Feels amazing.", hl: "a weekend" },
  { start: 67.67, end: 77.2, act: "a1", type: "statement", head: "There’s just one problem.", big: true },
  { start: 77.27, end: 88.1, act: "a1", type: "icon", icon: "stream", label: "IT MOVES EVERY DAY", sub: "revenue · inquiries · chats · content" },
  { start: 88.23, end: 96.3, act: "a1", type: "statement", head: "Your business is a stream.", headHl: "stream" },
  { start: 96.4, end: 113.6, act: "a1", type: "compare", left: { icon: "photo", label: "A FILE", sub: "a photo" }, right: { icon: "movie", label: "A BUSINESS", sub: "a movie" }, connector: "vs" },
  { start: 113.74, end: 120.4, act: "a1", type: "statement", head: "Who types every order back into a text file?", headHl: "Who" },
  { start: 120.55, end: 128.3, act: "a1", type: "stat", value: "forever?", label: "EVERY ORDER · EVERY MESSAGE" },
  { start: 128.4, end: 138.0, act: "a1", type: "icon", icon: "database", label: "DATABASES", sub: "built for exactly this" },
  { start: 138.06, end: 143.1, act: "a1", type: "statement", head: "Your files are frozen. Your business isn’t.", headHl: "frozen" },
];

// ---- ACT 2 — IT GETS WORSE (maroon / tension) ----
const A2: Screen[] = [
  { start: 143.15, end: 148.2, act: "a2", type: "statement", head: "But it gets worse.", big: true },
  { start: 148.32, end: 151.8, act: "a2", type: "statement", head: "Files are for tasks — not facts.", headHl: "not facts" },
  { start: 151.86, end: 167.2, act: "a2", type: "caption", text: "Plot twist: I use markdown files every day.", hl: "every day" },
  { start: 167.3, end: 172.6, act: "a2", type: "icon", icon: "mdfile", label: "STEPS · RULES · COMMANDS", sub: "it’s a recipe" },
  { start: 172.74, end: 182.4, act: "a2", type: "statement", head: "Zero facts about my business.", headHl: "Zero", sub: "no revenue. no customers. nothing that changes." },
  { start: 182.53, end: 185.2, act: "a2", type: "caption", text: "And missing it isn’t your fault.", hl: "isn’t your fault" },
  { start: 185.27, end: 198.5, act: "a2", type: "statement", head: "Templates are built to finish in a weekend.", headHl: "a weekend", sub: "a real second brain isn’t." },
  { start: 198.56, end: 219.4, act: "a2", type: "compare", left: { icon: "mdfile", label: "FILES", sub: "the HOW" }, right: { icon: "database", label: "DATABASE", sub: "the WHAT" }, connector: "vs" },
  { start: 219.5, end: 223.5, act: "a2", type: "statement", head: "The database fills itself.", headHl: "fills itself" },
  { start: 223.6, end: 241.0, act: "a2", type: "icon", icon: "loop", label: "AUTOMATIC JOBS", sub: "every hour · every 5 minutes" },
  { start: 241.12, end: 253.2, act: "a2", type: "statement", head: "So the data is always up to date.", headHl: "up to date" },
  { start: 253.23, end: 265.1, act: "a2", type: "statement", head: "Files hold the recipes. The database holds the truth.", headHl: "the truth" },
];

// ---- ACT 3 — THE MACHINE (navy / payoff) ----
const A3: Screen[] = [
  { start: 265.15, end: 277.1, act: "a3", type: "statement", head: "Now — the answer, and the machine.", headHl: "the machine", big: true },
  { start: 277.19, end: 281.5, act: "a3", type: "statement", head: "Back to the start." },
  { start: 281.52, end: 286.1, act: "a3", type: "caption", text: "It knew what I earn on every product.", hl: "every product" },
  { start: 286.2, end: 292.2, act: "a3", type: "caption", text: "It knew where my time goes.", hl: "my time" },
  { start: 292.25, end: 296.3, act: "a3", type: "statement", head: "And I never told it any of that.", headHl: "never", sub: "it was all already there." },
  { start: 296.37, end: 298.7, act: "a3", type: "statement", head: "Here’s how it’s built." },
  { start: 298.71, end: 320.0, act: "a3", type: "icon", icon: "database", label: "ONE DATABASE", sub: "the core" },
  { start: 320.08, end: 326.3, act: "a3", type: "icon", icon: "loop", label: "SMALL LOOPS", sub: "they fill it, automatically" },
  { start: 326.37, end: 340.8, act: "a3", type: "caption", text: "Payments, conversations, subscribers — logged automatically.", hl: "automatically" },
  { start: 340.86, end: 357.2, act: "a3", type: "icon", icon: "files", label: "SKILL FILES", sub: "the recipes, on top" },
  { start: 357.33, end: 363.0, act: "a3", type: "icon", icon: "dashboard", label: "ONE DASHBOARD", sub: "the whole business, one screen" },
  { start: 363.0, end: 368.8, act: "a3", type: "icon", icon: "spark", label: "THE MODEL", sub: "comes last — least important" },
  { start: 368.88, end: 382.3, act: "a3", type: "assemble", head: "This is a business brain.", headHl: "business brain." },
];

// ---- ACT 4 — THE UNLOCK (teal / alive) ----
const A4: Screen[] = [
  { start: 382.43, end: 389.5, act: "a4", type: "statement", head: "Now flip the whole thing around.", headHl: "flip", big: true },
  { start: 389.5, end: 407.1, act: "a4", type: "icon", icon: "plug", label: "GIVE IT THE KEYS", sub: "Claude + your data · Supabase MCP" },
  { start: 407.2, end: 413.3, act: "a4", type: "statement", head: "Ask anything. Get a mind-blowing answer.", headHl: "mind-blowing" },
  { start: 413.4, end: 419.0, act: "a4", type: "statement", head: "Businesses hire data scientists for this.", headHl: "data scientists" },
  { start: 419.11, end: 426.5, act: "a4", type: "caption", text: "Start with my full system — links below.", hl: "full system" },
  { start: 426.5, end: 431.0, act: "a4", type: "statement", head: "See you in the next one." },
];

export const SCREENS: Screen[] = [...A1, ...A2, ...A3, ...A4];

