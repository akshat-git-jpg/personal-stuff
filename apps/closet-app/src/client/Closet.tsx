import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { filterByTags, photoIndex, tagIndex } from './filter'
import ClothesTab from './ClothesTab'
import LooksTab from './LooksTab'
import EditSheet from './EditSheet'
import ItemViewer from './ItemViewer'
import { SortPill, SortSheet } from './SortSheet'
import UndoBar from './UndoBar'
import {
  CLOTH_SORTS,
  LOOK_SORTS,
  loadSort,
  saveSort,
  sortClothes,
  sortLooks,
  type ClothSort,
  type LookSort,
} from './sort'
import type { AppState, Cloth, TabKey, ViewingItem } from './types'

type SheetState =
  | { kind: 'closed' }
  | { kind: 'add-cloth' }
  | { kind: 'add-look' }
  | { kind: 'edit-cloth'; id: string }
  | { kind: 'edit-look'; id: string }

const UNDO_MS = 10_000

/**
 * Closet — the shell. Owns all app state and is the only component that
 * calls the API for mutations; tabs and tiles receive callbacks.
 */
export default function Closet({ onLogout }: { onLogout: () => void }) {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('clothes')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })
  // One viewer for both tabs — clothes and looks open the identical catalogue
  // view (owner decision, 2026-08-17).
  const [viewing, setViewing] = useState<ViewingItem | null>(null)
  const [undo, setUndo] = useState<{ label: string; eventId: string } | null>(null)
  // Read once on mount (lazy initialiser): localStorage is impure, so touching
  // it during render would trip react-hooks/purity.
  const [clothSort, setClothSort] = useState<ClothSort>(() =>
    loadSort('clothes', 'most-worn', CLOTH_SORTS.map((o) => o.value)),
  )
  const [lookSort, setLookSort] = useState<LookSort>(() =>
    loadSort('looks', 'newest', LOOK_SORTS.map((o) => o.value)),
  )
  const [sortOpen, setSortOpen] = useState(false)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function loadState() {
    api
      .state()
      .then((data) => {
        // Clear a stale error only once the refetch actually succeeds — the
        // error screen must stay up through the request, not blink away
        // before there is fresh state to show instead (react-hooks/set-state-in-effect
        // otherwise flags a setState that runs synchronously before the fetch starts).
        setError(null)
        setState(data)
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Unauthorized') return onLogout()
        setError(err instanceof Error ? err.message : 'Could not load your closet')
      })
  }

  useEffect(loadState, [])

  // A tag that exists on clothes may match no looks (or vice versa); carrying
  // the selection across tabs leaves the user on a mysteriously empty grid.
  // Adjusted during render (the pattern React recommends for "reset state when
  // a prop/state changes") instead of an effect, so no cascading extra render.
  const [prevTab, setPrevTab] = useState(tab)
  if (tab !== prevTab) {
    setPrevTab(tab)
    setSelectedTagIds([])
  }

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  function handleApiError(err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      onLogout()
      return
    }
    window.alert(err instanceof Error ? err.message : 'Something went wrong')
  }

  function replaceCloth(cloth: Cloth) {
    setState((prev) => (prev ? { ...prev, clothes: prev.clothes.map((c) => (c.id === cloth.id ? cloth : c)) } : prev))
  }

  function startUndo(label: string, eventId: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndo({ label, eventId })
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }

  async function handleWear(cloth: Cloth) {
    try {
      const res = await api.wear(cloth.id)
      replaceCloth(res.cloth)
      startUndo(`Marked "${cloth.name}" worn`, res.event_id)
    } catch (err) {
      handleApiError(err)
    }
  }

  async function handleWash(cloth: Cloth) {
    try {
      const res = await api.wash(cloth.id)
      replaceCloth(res.cloth)
      startUndo(`Marked "${cloth.name}" washed`, res.event_id)
    } catch (err) {
      handleApiError(err)
    }
  }

  async function handleUndo() {
    if (!undo) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    const eventId = undo.eventId
    setUndo(null)
    try {
      const res = await api.undo(eventId)
      replaceCloth(res.cloth)
    } catch (err) {
      handleApiError(err)
    }
  }

  function pickClothSort(value: ClothSort) {
    setClothSort(value)
    saveSort('clothes', value)
    setSortOpen(false)
  }

  function pickLookSort(value: LookSort) {
    setLookSort(value)
    saveSort('looks', value)
    setSortOpen(false)
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  if (error) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center">
        <div>
          <p className="mb-4">{error}</p>
          <button type="button" className="btn-primary" onClick={loadState}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-dvh grid place-items-center" style={{ color: 'var(--muted)' }}>
        Loading…
      </div>
    )
  }

  const itemType = tab === 'clothes' ? 'cloth' : 'look'
  const index = tagIndex(state.item_tags, itemType)
  const relevantTagIds = new Set(state.item_tags.filter((it) => it.item_type === itemType).map((it) => it.tag_id))
  const tabTags = state.tags.filter((t) => relevantTagIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name))

  // Filter first, then order — sorting the whole set and filtering after would
  // do the same work on rows about to be thrown away.
  const filteredClothes =
    tab === 'clothes' ? sortClothes(filterByTags(state.clothes, index, selectedTagIds), clothSort) : []
  const filteredLooks =
    tab === 'looks' ? sortLooks(filterByTags(state.looks, index, selectedTagIds), lookSort) : []

  const editingCloth = sheet.kind === 'edit-cloth' ? (state.clothes.find((c) => c.id === sheet.id) ?? null) : null
  const editingLook = sheet.kind === 'edit-look' ? (state.looks.find((l) => l.id === sheet.id) ?? null) : null

  const lookIndex = tagIndex(state.item_tags, 'look')
  const clothIndex = tagIndex(state.item_tags, 'cloth')
  const clothPhotos = photoIndex(state.photos, 'cloth')
  const lookPhotos = photoIndex(state.photos, 'look')
  const tagName = (id: string) => state.tags.find((t) => t.id === id)?.name ?? ''

  const photosFor = (v: ViewingItem) =>
    (v.type === 'cloth' ? clothPhotos : lookPhotos).get(v.id) ?? []
  const tagsFor = (v: ViewingItem) =>
    [...((v.type === 'cloth' ? clothIndex : lookIndex).get(v.id) ?? [])].map(tagName)

  // Resolve the viewed item every render rather than storing the row: after an
  // edit reloads state, a stored copy would keep showing the OLD photos.
  const viewingCloth = viewing?.type === 'cloth' ? (state.clothes.find((c) => c.id === viewing.id) ?? null) : null
  const viewingLook = viewing?.type === 'look' ? (state.looks.find((l) => l.id === viewing.id) ?? null) : null
  const viewingExists = Boolean(viewingCloth || viewingLook)

  async function deleteViewed() {
    if (!viewing) return
    try {
      if (viewing.type === 'cloth') await api.deleteCloth(viewing.id)
      else await api.deleteLook(viewing.id)
      setViewing(null)
      loadState()
    } catch (err) {
      handleApiError(err)
    }
  }

  const sheetMode: 'cloth' | 'look' = sheet.kind === 'add-look' || sheet.kind === 'edit-look' ? 'look' : 'cloth'
  const sheetItemId = sheet.kind === 'edit-cloth' || sheet.kind === 'edit-look' ? sheet.id : null
  const sheetInitialTags =
    sheetMode === 'cloth'
      ? editingCloth
        ? [...(clothIndex.get(editingCloth.id) ?? [])].map(tagName)
        : []
      : editingLook
        ? [...(lookIndex.get(editingLook.id) ?? [])].map(tagName)
        : []
  const sheetInitialPhotoKeys =
    sheetMode === 'cloth'
      ? editingCloth
        ? (clothPhotos.get(editingCloth.id) ?? [])
        : []
      : editingLook
        ? (lookPhotos.get(editingLook.id) ?? [])
        : []

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex">
          <button type="button" className="tab-btn" data-active={tab === 'clothes'} onClick={() => setTab('clothes')}>
            Clothes
          </button>
          <button type="button" className="tab-btn" data-active={tab === 'looks'} onClick={() => setTab('looks')}>
            Looks
          </button>
        </div>

        {/*
          Sort sits OUTSIDE the scrolling chip row and never scrolls away —
          a control the user must hunt for by swiping is not a control.
        */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {tabTags.map((t) => (
              <button key={t.id} type="button" className="chip"
                data-active={selectedTagIds.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>

          {tab === 'clothes' ? (
            <SortPill value={clothSort} options={CLOTH_SORTS} onOpen={() => setSortOpen(true)} />
          ) : (
            <SortPill value={lookSort} options={LOOK_SORTS} onOpen={() => setSortOpen(true)} />
          )}
        </div>
      </header>

      <main className="flex-1 pb-28">
        {tab === 'clothes' ? (
          <ClothesTab
            clothes={filteredClothes}
            photosByCloth={clothPhotos}
            hasAny={state.clothes.length > 0}
            hasSelection={selectedTagIds.length > 0}
            onOpen={(cloth) => setViewing({ type: 'cloth', id: cloth.id })}
            onWear={handleWear}
            onWash={handleWash}
            onClearTags={() => setSelectedTagIds([])}
            onAddFirst={() => setSheet({ kind: 'add-cloth' })}
          />
        ) : (
          <LooksTab
            looks={filteredLooks}
            photosByLook={lookPhotos}
            hasAny={state.looks.length > 0}
            hasSelection={selectedTagIds.length > 0}
            onOpen={(look) => setViewing({ type: 'look', id: look.id })}
            onClearTags={() => setSelectedTagIds([])}
            onAddFirst={() => setSheet({ kind: 'add-look' })}
          />
        )}
      </main>

      <button type="button" className="btn-primary fixed right-4 flex h-14 w-14 items-center justify-center rounded-full p-0 text-2xl"
        style={{ bottom: `calc(${undo ? '88px' : '24px'} + env(safe-area-inset-bottom))`, zIndex: 20 }}
        onClick={() => setSheet({ kind: tab === 'clothes' ? 'add-cloth' : 'add-look' })}
        aria-label={tab === 'clothes' ? 'Add a cloth' : 'Add a look'}
      >
        +
      </button>

      {undo && <UndoBar label={undo.label} onUndo={handleUndo} />}

      {sortOpen &&
        (tab === 'clothes' ? (
          <SortSheet
            value={clothSort}
            options={CLOTH_SORTS}
            onPick={pickClothSort}
            onClose={() => setSortOpen(false)}
          />
        ) : (
          <SortSheet
            value={lookSort}
            options={LOOK_SORTS}
            onPick={pickLookSort}
            onClose={() => setSortOpen(false)}
          />
        ))}

      {sheet.kind !== 'closed' && (
        <EditSheet
          mode={sheetMode}
          itemId={sheetItemId}
          initialName={sheetMode === 'cloth' ? (editingCloth?.name ?? '') : (editingLook?.name ?? '')}
          initialPhotoKeys={sheetInitialPhotoKeys}
          initialTags={sheetInitialTags}
          allTags={state.tags}
          onClose={() => setSheet({ kind: 'closed' })}
          onSaved={() => {
            setSheet({ kind: 'closed' })
            loadState()
          }}
        />
      )}

      {viewing && viewingExists && (
        <ItemViewer
          item={viewing}
          title={viewing.type === 'cloth' ? (viewingCloth?.name ?? null) : (viewingLook?.name ?? null)}
          photoKeys={photosFor(viewing)}
          tagNames={tagsFor(viewing)}
          onClose={() => setViewing(null)}
          onEdit={() =>
            setSheet(
              viewing.type === 'cloth'
                ? { kind: 'edit-cloth', id: viewing.id }
                : { kind: 'edit-look', id: viewing.id },
            )
          }
          onDelete={deleteViewed}
        />
      )}
    </div>
  )
}
