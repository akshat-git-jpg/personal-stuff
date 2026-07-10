// Grid: 6:00 AM → 6:00 AM next morning in 30-min slots → 48 slots (indices 0..47).
export const SLOTS = 48
// Keep in sync with the LABELS array in public/index.html (no build step shares them).
export const LABEL_IDS = ['deep', 'meeting', 'gym', 'break', 'personal'] as const
