import { describe, expect, it } from 'vitest'
import { categorize, colorFor, PALETTE, type Category } from '../src/worker/palette'

/** Every row here is an event that really appears on the owner's Monday. */
const REAL: [title: string, calendar: string, expected: Category][] = [
  ['Sleep', 'kushalbakliwal25@gmail.com', 'sleep'],
  ['Post wakeup/ Pre Gym Routine', 'kushalbakliwal25@gmail.com', 'routine'],
  ['Gym', 'kushalbakliwal25@gmail.com', 'fitness'],
  ['Gym', 'Health', 'fitness'],
  ['> Wakeup Routine', 'Daily chores', 'routine'],
  ['> Post Gym Routine', 'kushalbakliwal25@gmail.com', 'routine'],
  ['Random', 'kushalbakliwal25@gmail.com', 'buffer'],
  ['Commute Office', 'kushalbakliwal25@gmail.com', 'routine'],
  ['Lunch', 'Daily chores', 'food'],
  ['Zluri Work', 'kushalbakliwal25@gmail.com', 'work'],
  ['Zluri Work (Active)', 'Work', 'work'],
  ['Zluri Work [Continue]', 'kushalbakliwal25@gmail.com', 'work'],
  ['Snacks Break', 'kushalbakliwal25@gmail.com', 'food'],
  ['(Return home),Logout routine', 'kushalbakliwal25@gmail.com', 'routine'],
  ['(Return home),Logout routine, chores, Dinner', 'Daily chores', 'routine'],
  ['Dinner', 'kushalbakliwal25@gmail.com', 'food'],
  ['YT', 'kushalbakliwal25@gmail.com', 'growth'],
  ["To Do's, Random", 'Personal Goals', 'growth'],
  ['Pre Sleep Routine + Timepass', 'kushalbakliwal25@gmail.com', 'routine'],
  ['Buffer', 'Buffer', 'buffer'],
  ['Water - 500 mL', 'Diet', 'food'],
  ['Water + Amla Juice - 500 mL', 'Diet', 'food'],
  ['Ganesh Chaturthi', 'Holidays in India', 'holiday'],
]

describe('categorize — the owner’s real events', () => {
  it.each(REAL)('%s [%s] -> %s', (title, calendar, expected) => {
    expect(categorize(title, calendar)).toBe(expected)
  })
})

describe('categorize — the ordering decisions that make it work', () => {
  it('reads "Post Gym Routine" as a routine, and bare "Gym" as fitness', () => {
    expect(categorize('Post Gym Routine', '')).toBe('routine')
    expect(categorize('Gym', '')).toBe('fitness')
  })

  it('reads "Commute Office" as transit, not office work', () => {
    expect(categorize('Commute Office', '')).toBe('routine')
  })

  it('reads "Snacks Break" as food, not a break', () => {
    expect(categorize('Snacks Break', '')).toBe('food')
  })

  it('reads a routine that merely LISTS a meal as a routine', () => {
    // Real event. "Dinner" is one item in a logout routine, not the point of it.
    expect(categorize('(Return home),Logout routine, chores, Dinner', '')).toBe('routine')
    // ...while a meal on its own is still food.
    expect(categorize('Dinner', '')).toBe('food')
    expect(categorize('Lunch', '')).toBe('food')
  })

  it('reads "Pre Sleep Routine" as a routine, and bare "Sleep" as sleep', () => {
    expect(categorize('Pre Sleep Routine + Timepass', '')).toBe('routine')
    expect(categorize('Sleep', '')).toBe('sleep')
  })

  it('reads "To Do’s, Random" as growth, not backdrop', () => {
    expect(categorize("To Do's, Random", '')).toBe('growth')
    expect(categorize('Random', '')).toBe('buffer')
  })
})

describe('categorize — fallbacks and false positives', () => {
  it('falls back to the calendar when the title says nothing', () => {
    expect(categorize('Deep focus', 'Business')).toBe('work')
    expect(categorize('Catch up', 'Health')).toBe('fitness')
    expect(categorize('Something', 'Career Goals')).toBe('growth')
  })

  it('falls back to other when neither says anything', () => {
    expect(categorize('Xyzzy', 'kushalbakliwal25@gmail.com')).toBe('other')
    expect(categorize('', '')).toBe('other')
  })

  it('does not match a keyword inside a longer word', () => {
    // "yt" must not fire inside Physiotherapy; "run" must not fire inside Brunch.
    expect(categorize('Physiotherapy', '')).not.toBe('growth')
    expect(categorize('Runway review', '')).toBe('work')
  })

  it('is case-insensitive on both title and calendar', () => {
    expect(categorize('ZLURI WORK', '')).toBe('work')
    expect(categorize('anything', 'HEALTH')).toBe('fitness')
  })
})

describe('PALETTE', () => {
  it('gives every category its own hex', () => {
    const hexes = Object.values(PALETTE)
    expect(new Set(hexes).size).toBe(hexes.length)
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('never uses the NOW accent, which must stay unique to the live marker', () => {
    expect(Object.values(PALETTE).map((h) => h.toLowerCase())).not.toContain('#f0a32a')
  })

  it('colorFor is just categorize plus a lookup', () => {
    expect(colorFor('Gym', '')).toBe(PALETTE.fitness)
    expect(colorFor('Lunch', '')).toBe(PALETTE.food)
  })
})
