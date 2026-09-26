/**
 * palette.ts — what colour an event gets, and why.
 *
 * Google hands back one colour PER CALENDAR. That is the wrong unit: the owner's
 * primary calendar alone holds Sleep, Gym, Lunch, Zluri Work and Random, so they
 * would all arrive the same shade, and the day would read as one flat wash.
 *
 * Dayboard colours by what an event IS, not where it is stored. Nine categories,
 * each a distinct hue at roughly matched chroma and lightness so no single band
 * shouts over the rest on a dark ground. The amber accent (--accent) is reserved
 * for NOW and never appears here, so "what is live" always wins the eye.
 */

export type Category =
  | 'sleep' | 'fitness' | 'food' | 'work' | 'routine'
  | 'growth' | 'family' | 'buffer' | 'holiday' | 'other'

/**
 * Saturated hues, spread around the wheel so neighbours are told apart at a glance.
 *
 * The first set was deliberately muted and it was a mistake: at the 13% tint the blocks
 * used, every category collapsed into the same near-black rectangle and only the 3px
 * left bar carried any hue at all. These are brighter AND further apart — the old
 * food / growth / holiday were three warm oranges within 20 degrees of each other, and
 * sleep / routine / work were a single blue-to-violet ramp.
 *
 * Each is the ACCENT (left bar, title tint, legend dot). The block's fill is mixed from
 * it in oklab, which keeps the chroma that an sRGB mix with near-black throws away.
 */
export const PALETTE: Record<Category, string> = {
  sleep:   '#5f7fe8', // indigo — the day's bookends
  routine: '#3fbfc9', // cyan — wake-up, post-gym, logout, chores, commute
  fitness: '#4fc98a', // green — gym, walks, anything physical
  growth:  '#e0b53a', // gold — goals, YouTube, learning, to-dos
  food:    '#f08a55', // orange — meals AND the water/juice pings
  family:  '#f0709e', // pink — family and birthdays
  work:    '#a878f0', // purple — Zluri, business, meetings
  holiday: '#c9803f', // bronze — all-day markers only
  buffer:  '#7a8290', // grey, deliberately dull — Random and Buffer are backdrop
  other:   '#8a91a1', // neutral fallback
}

/**
 * Title keywords, checked IN THIS ORDER. Order is the whole design:
 *
 *  - routine first, because a routine block often LISTS its contents: the real
 *    event "(Return home),Logout routine, chores, Dinner" is a routine, not a meal.
 *    Plain "Lunch" and "Dinner" carry no routine word, so they still land on food.
 *  - routine before fitness, so "Post Gym Routine" is a routine and bare "Gym" is
 *    fitness.
 *  - routine before work, so "Commute Office" is transit, not office work.
 *  - growth before buffer, so "To Do's, Random" is a goal, not backdrop.
 *  - sleep LAST, so "Pre Sleep Routine + Timepass" lands on routine.
 */
const TITLE_RULES: { category: Category; words: string[] }[] = [
  { category: 'routine', words: ['routine', 'wakeup', 'wake up', 'chore', 'logout', 'log out', 'commute', 'travel', 'drive', 'shower', 'getting ready'] },
  { category: 'food',    words: ['lunch', 'dinner', 'breakfast', 'snack', 'meal', 'water', 'juice', 'amla', 'tea', 'coffee', 'eat', 'food'] },
  { category: 'fitness', words: ['gym', 'workout', 'work out', 'run', 'walk', 'yoga', 'cycle', 'swim', 'stretch', 'cardio'] },
  { category: 'work',    words: ['zluri', 'work', 'standup', 'stand up', 'meeting', 'office', 'client', 'sync', 'review', 'sprint', 'oncall', 'on call', 'interview'] },
  { category: 'growth',  words: ['goal', 'to do', "to do's", 'todo', 'learn', 'study', 'read', 'course', 'youtube', 'yt', 'side project', 'build', 'write'] },
  { category: 'family',  words: ['family', 'birthday', 'anniversary', 'mom', 'dad', 'parents', 'call home'] },
  { category: 'buffer',  words: ['random', 'buffer', 'timepass', 'time pass', 'free time', 'slack time', 'misc'] },
  { category: 'sleep',   words: ['sleep', 'nap', 'rest'] },
]

/** Calendar names, used only when the title says nothing. Matched case-insensitively. */
const CALENDAR_RULES: { category: Category; names: string[] }[] = [
  { category: 'fitness', names: ['health', 'fitness', 'gym'] },
  { category: 'food',    names: ['diet', 'nutrition', 'meals'] },
  { category: 'work',    names: ['work', 'business', 'zluri'] },
  { category: 'routine', names: ['daily chores', 'chores', 'reminder', 'reminders'] },
  { category: 'growth',  names: ['career goals', 'personal goal', 'personal goals', 'goals', 'learning'] },
  { category: 'family',  names: ['family', 'birthdays'] },
  { category: 'buffer',  names: ['buffer'] },
  { category: 'holiday', names: ['holidays in india', 'holidays'] },
]

const has = (haystack: string, needle: string): boolean => {
  // Word-boundary match so "yt" does not fire inside "Physiotherapy", but with an
  // optional plural so "Snacks Break" still matches "snack" and "chores" matches
  // "chore". Calendar titles are written by a human, not a schema.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}(s|'s|\u2019s)?([^a-z0-9]|$)`, 'i').test(haystack)
}

/** What kind of thing is this? Title first — it is specific; calendar second. */
export function categorize(title: string, calendarName: string): Category {
  const t = (title || '').toLowerCase()
  for (const rule of TITLE_RULES) {
    if (rule.words.some((w) => has(t, w))) return rule.category
  }
  const c = (calendarName || '').toLowerCase().trim()
  for (const rule of CALENDAR_RULES) {
    if (rule.names.some((n) => c === n || has(c, n))) return rule.category
  }
  return 'other'
}

/** The hex an event should be drawn in. */
export function colorFor(title: string, calendarName: string): string {
  return PALETTE[categorize(title, calendarName)]
}
