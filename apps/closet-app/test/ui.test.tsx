// @vitest-environment jsdom
//
// Component tests for the catalogue rework (2026-08-17).
//
// The load-bearing case is "photo opens, + wear logs". Before this change,
// tapping a tile's photo logged a wear; a regression back to that would be
// invisible to the API smoke and would silently inflate every count the owner
// relies on. Everything here renders a component directly with stub callbacks —
// no fetch mocking, so these stay fast and can't go flaky on network shape.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ClothTile from '../src/client/ClothTile'
import ItemViewer from '../src/client/ItemViewer'
import PhotoGrid from '../src/client/PhotoGrid'
import { SortPill, SortSheet } from '../src/client/SortSheet'
import type { Cloth } from '../src/client/types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const CLOTH: Cloth = {
  id: 'C1',
  name: 'Blue jeans',
  wears: 4,
  last_worn_at: null,
  last_washed_at: null,
  created_at: 0,
}

function tile(over: { photoKeys?: string[]; cloth?: Partial<Cloth> } = {}) {
  const onOpen = vi.fn()
  const onWear = vi.fn()
  const onWash = vi.fn()
  render(
    <ClothTile
      cloth={{ ...CLOTH, ...over.cloth }}
      photoKeys={over.photoKeys ?? ['front.jpg']}
      wornLabel="worn 3 days ago"
      onOpen={onOpen}
      onWear={onWear}
      onWash={onWash}
    />,
  )
  return { onOpen, onWear, onWash }
}

describe('ClothTile', () => {
  it('shows the name, the bare count and the worn label', () => {
    tile()
    expect(screen.getByText('Blue jeans')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('worn 3 days ago')).toBeTruthy()
  })

  it('tapping the photo opens the catalogue and does NOT log a wear', () => {
    const { onOpen, onWear } = tile()
    fireEvent.click(screen.getByLabelText('Open Blue jeans'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onWear).not.toHaveBeenCalled()
  })

  it('tapping "+ wear" logs a wear and does NOT open the catalogue', () => {
    const { onOpen, onWear } = tile()
    fireEvent.click(screen.getByLabelText('Add a wear to Blue jeans'))
    expect(onWear).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('uses the FIRST photo key as the cover', () => {
    tile({ photoKeys: ['cover.jpg', 'second.jpg'] })
    const img = screen.getByLabelText('Open Blue jeans').querySelector('img')
    expect(img?.getAttribute('src')).toBe('/api/photos/cover.jpg')
  })

  it('badges the photo count only when there is more than one', () => {
    tile({ photoKeys: ['a.jpg', 'b.jpg', 'c.jpg'] })
    expect(screen.getByText('3 photos')).toBeTruthy()
    cleanup()
    tile({ photoKeys: ['only.jpg'] })
    expect(screen.queryByText(/photos$/)).toBeNull()
  })

  it('falls back to the initial letter with no photos, and still allows a wear', () => {
    const { onWear } = tile({ photoKeys: [] })
    expect(screen.getByText('B')).toBeTruthy()
    const wear = screen.getByLabelText('Add a wear to Blue jeans')
    expect(wear.hasAttribute('disabled')).toBe(false)
    fireEvent.click(wear)
    expect(onWear).toHaveBeenCalledTimes(1)
  })

  it('washes only when the confirm is accepted', () => {
    const yes = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const a = tile()
    fireEvent.click(screen.getByLabelText('Mark Blue jeans as washed'))
    expect(a.onWash).toHaveBeenCalledTimes(1)
    yes.mockRestore()
    cleanup()

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const b = tile()
    fireEvent.click(screen.getByLabelText('Mark Blue jeans as washed'))
    expect(b.onWash).not.toHaveBeenCalled()
  })
})

function viewer(photoKeys: string[], type: 'cloth' | 'look' = 'cloth') {
  const onClose = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <ItemViewer
      item={{ type, id: 'C1' }}
      title="Blue jeans"
      photoKeys={photoKeys}
      tagNames={['jeans', 'casual']}
      onClose={onClose}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  )
  return { onClose, onEdit, onDelete }
}

describe('ItemViewer', () => {
  it('renders every photo in the catalogue, in order', () => {
    viewer(['a.jpg', 'b.jpg', 'c.jpg'])
    const srcs = Array.from(screen.getByTestId('photo-strip').querySelectorAll('img')).map((i) =>
      i.getAttribute('src'),
    )
    expect(srcs).toEqual(['/api/photos/a.jpg', '/api/photos/b.jpg', '/api/photos/c.jpg'])
  })

  it('shows one dot per photo, and a position line, only when there are several', () => {
    viewer(['a.jpg', 'b.jpg'])
    expect(screen.getAllByLabelText(/^Photo \d+ of 2$/)).toHaveLength(2)
    expect(screen.getByText('1 of 2 photos')).toBeTruthy()
  })

  it('hides the dots for a single photo', () => {
    viewer(['a.jpg'])
    expect(screen.queryByLabelText(/^Photo \d+ of/)).toBeNull()
  })

  it('says so when an item has no photos yet', () => {
    viewer([])
    expect(screen.getByText('no photos yet')).toBeTruthy()
  })

  it('offers exactly Close, Edit and Delete — and never a wear action', () => {
    viewer(['a.jpg'])
    expect(screen.getByText('Close')).toBeTruthy()
    expect(screen.getByText('Edit')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
    // A wear button here would let browsing the catalogue change a count.
    expect(screen.queryByText(/wear/i)).toBeNull()
  })

  it('deletes only after the confirm is accepted', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const a = viewer(['a.jpg'])
    fireEvent.click(screen.getByText('Delete'))
    expect(a.onDelete).not.toHaveBeenCalled()
    cleanup()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const b = viewer(['a.jpg'])
    fireEvent.click(screen.getByText('Delete'))
    expect(b.onDelete).toHaveBeenCalledTimes(1)
  })
})

function grid(keys: string[]) {
  const onChange = vi.fn()
  render(<PhotoGrid keys={keys} onChange={onChange} onBusyChange={vi.fn()} onError={vi.fn()} />)
  return { onChange }
}

describe('PhotoGrid', () => {
  it('badges only the first photo as the cover', () => {
    grid(['a.jpg', 'b.jpg', 'c.jpg'])
    expect(screen.getAllByText('Cover')).toHaveLength(1)
  })

  it('renders every photo plus the add tile, in order', () => {
    grid(['a.jpg', 'b.jpg'])
    const srcs = Array.from(screen.getByTestId('photo-grid').querySelectorAll('img')).map((i) =>
      i.getAttribute('src'),
    )
    expect(srcs).toEqual(['/api/photos/a.jpg', '/api/photos/b.jpg'])
    expect(screen.getByLabelText('Add a photo')).toBeTruthy()
  })

  it('exposes each photo as a drag handle so reordering is discoverable', () => {
    grid(['a.jpg', 'b.jpg', 'c.jpg'])
    expect(screen.getAllByLabelText(/Press and hold, then drag to reorder/)).toHaveLength(3)
  })

  it('removing a photo drops just that one', () => {
    const { onChange } = grid(['a.jpg', 'b.jpg', 'c.jpg'])
    fireEvent.click(screen.getByLabelText('Remove photo 2'))
    expect(onChange).toHaveBeenCalledWith(['a.jpg', 'c.jpg'])
  })

  it('disables adding once the 12-photo cap is reached', () => {
    grid(Array.from({ length: 12 }, (_, i) => `p${i}.jpg`))
    expect(screen.getByLabelText('Add a photo').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('max 12')).toBeTruthy()
  })

  it('tells the user how to reorder only when there is more than one photo', () => {
    grid(['a.jpg', 'b.jpg'])
    expect(screen.getByText(/Hold and drag to reorder/)).toBeTruthy()
    cleanup()
    grid(['a.jpg'])
    expect(screen.queryByText(/Hold and drag to reorder/)).toBeNull()
  })
})

const SORTS = [
  { value: 'most-worn' as const, label: 'Most worn' },
  { value: 'name' as const, label: 'A → Z' },
  { value: 'newest' as const, label: 'Newest' },
]

describe('SortPill / SortSheet', () => {
  it('the pill names the CURRENT ordering, so it is readable without opening', () => {
    render(<SortPill value="name" options={SORTS} onOpen={vi.fn()} />)
    expect(screen.getByText('A → Z')).toBeTruthy()
  })

  it('tapping the pill opens the sheet', () => {
    const onOpen = vi.fn()
    render(<SortPill value="most-worn" options={SORTS} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('ticks the active option and only that one', () => {
    render(<SortSheet value="newest" options={SORTS} onPick={vi.fn()} onClose={vi.fn()} />)
    const ticked = SORTS.filter((o) => screen.getByText(o.label).closest('button')?.textContent?.includes('✓'))
    expect(ticked.map((o) => o.value)).toEqual(['newest'])
  })

  it('picking an option reports the new value', () => {
    const onPick = vi.fn()
    render(<SortSheet value="most-worn" options={SORTS} onPick={onPick} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('A → Z'))
    expect(onPick).toHaveBeenCalledWith('name')
  })

  it('Cancel closes without changing the ordering', () => {
    const onPick = vi.fn()
    const onClose = vi.fn()
    render(<SortSheet value="most-worn" options={SORTS} onPick={onPick} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })
})
