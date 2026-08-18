import { describe, it, expect } from 'vitest'
import { sortClothes, sortLooks } from '../src/client/sort'
import type { Cloth, Look } from '../src/client/types'

const c = (name: string, wears: number, created_at: number, last_worn_at: number | null = null): Cloth => ({
  id: name, name, wears, created_at, last_worn_at, last_washed_at: null,
})
const l = (name: string | null, created_at: number): Look => ({ id: `${name}-${created_at}`, name, created_at })

const CLOTHES = [
  c('Blue jeans', 3, 100, 500),
  c('apple tee', 7, 300, null),
  c('Grey hoodie', 3, 200, 900),
  c('Shirt 10', 0, 400, 700),
  c('Shirt 2', 0, 50, null),
]
const names = (xs: { name: string }[]) => xs.map((x) => x.name)

describe('sortClothes', () => {
  it('most-worn puts the dirtiest first — that ordering IS the wash cue', () => {
    expect(names(sortClothes(CLOTHES, 'most-worn'))[0]).toBe('apple tee')
  })

  it('most-worn breaks ties by name, so the grid does not reshuffle between loads', () => {
    const twice = [sortClothes(CLOTHES, 'most-worn'), sortClothes(CLOTHES, 'most-worn')]
    expect(names(twice[0])).toEqual(names(twice[1]))
    expect(names(twice[0]).slice(1, 3)).toEqual(['Blue jeans', 'Grey hoodie'])
  })

  it('name sorts case-insensitively', () => {
    expect(names(sortClothes(CLOTHES, 'name'))[0]).toBe('apple tee')
  })

  it('name sorts numbers naturally — Shirt 2 before Shirt 10', () => {
    const got = names(sortClothes(CLOTHES, 'name'))
    expect(got.indexOf('Shirt 2')).toBeLessThan(got.indexOf('Shirt 10'))
  })

  it('newest is most-recently-added first', () => {
    expect(names(sortClothes(CLOTHES, 'newest'))).toEqual([
      'Shirt 10', 'apple tee', 'Grey hoodie', 'Blue jeans', 'Shirt 2',
    ])
  })

  it('last-worn pushes never-worn items to the BOTTOM, not the top', () => {
    const got = names(sortClothes(CLOTHES, 'last-worn'))
    expect(got.slice(0, 3)).toEqual(['Grey hoodie', 'Shirt 10', 'Blue jeans'])
    expect(got.slice(3).sort()).toEqual(['Shirt 2', 'apple tee'])
  })

  it('never mutates the array it was given', () => {
    const input = [...CLOTHES]
    sortClothes(input, 'name')
    expect(names(input)).toEqual(names(CLOTHES))
  })
})

const LOOKS = [l('Weekend', 100), l(null, 200), l('Friday office', 300), l('  ', 50)]

describe('sortLooks', () => {
  it('newest first by default', () => {
    expect(sortLooks(LOOKS, 'newest').map((x) => x.created_at)).toEqual([300, 200, 100, 50])
  })

  it('oldest reverses it', () => {
    expect(sortLooks(LOOKS, 'oldest').map((x) => x.created_at)).toEqual([50, 100, 200, 300])
  })

  it('A-Z puts unnamed looks last so the list never opens with blanks', () => {
    const got = sortLooks(LOOKS, 'name')
    expect(got.slice(0, 2).map((x) => x.name)).toEqual(['Friday office', 'Weekend'])
    // A whitespace-only name counts as unnamed, not as a name that sorts first.
    expect(got.slice(2).map((x) => x.created_at)).toEqual([200, 50])
  })

  it('never mutates the array it was given', () => {
    const input = [...LOOKS]
    sortLooks(input, 'name')
    expect(input.map((x) => x.created_at)).toEqual([100, 200, 300, 50])
  })
})
