import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { filterByTags, tagIndex } from './filter'
import ClothesTab from './ClothesTab'
import LooksTab from './LooksTab'
import EditSheet from './EditSheet'
import LookViewer from './LookViewer'
import UndoBar from './UndoBar'
import type { AppState, Cloth, TabKey } from './types'

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
  const [viewingLookId, setViewingLookId] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ label: string; eventId: string } | null>(null)
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

  const filteredClothes = tab === 'clothes' ? filterByTags(state.clothes, index, selectedTagIds) : []
  const filteredLooks = tab === 'looks' ? filterByTags(state.looks, index, selectedTagIds) : []

  const editingCloth = sheet.kind === 'edit-cloth' ? (state.clothes.find((c) => c.id === sheet.id) ?? null) : null
  const editingLook = sheet.kind === 'edit-look' ? (state.looks.find((l) => l.id === sheet.id) ?? null) : null
  const viewingLook = viewingLookId ? (state.looks.find((l) => l.id === viewingLookId) ?? null) : null

  const lookIndex = tagIndex(state.item_tags, 'look')
  const clothIndex = tagIndex(state.item_tags, 'cloth')
  const tagName = (id: string) => state.tags.find((t) => t.id === id)?.name ?? ''

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

        {tabTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {tabTags.map((t) => (
              <button key={t.id} type="button" className="chip"
                data-active={selectedTagIds.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 pb-28">
        {tab === 'clothes' ? (
          <ClothesTab
            clothes={filteredClothes}
            hasAny={state.clothes.length > 0}
            hasSelection={selectedTagIds.length > 0}
            onWear={handleWear}
            onEditName={(cloth) => setSheet({ kind: 'edit-cloth', id: cloth.id })}
            onWash={handleWash}
            onClearTags={() => setSelectedTagIds([])}
            onAddFirst={() => setSheet({ kind: 'add-cloth' })}
          />
        ) : (
          <LooksTab
            looks={filteredLooks}
            hasAny={state.looks.length > 0}
            hasSelection={selectedTagIds.length > 0}
            onOpen={(look) => setViewingLookId(look.id)}
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

      {sheet.kind !== 'closed' && (
        <EditSheet
          mode={sheetMode}
          itemId={sheetItemId}
          initialName={sheetMode === 'cloth' ? (editingCloth?.name ?? '') : (editingLook?.name ?? '')}
          initialPhotoKey={sheetMode === 'cloth' ? (editingCloth?.photo_key ?? null) : (editingLook?.photo_key ?? null)}
          initialTags={sheetInitialTags}
          allTags={state.tags}
          onClose={() => setSheet({ kind: 'closed' })}
          onSaved={() => {
            setSheet({ kind: 'closed' })
            loadState()
          }}
        />
      )}

      {viewingLook && (
        <LookViewer
          look={viewingLook}
          tagNames={[...(lookIndex.get(viewingLook.id) ?? [])].map(tagName)}
          onClose={() => setViewingLookId(null)}
          onEdit={() => {
            setViewingLookId(null)
            setSheet({ kind: 'edit-look', id: viewingLook.id })
          }}
          onDeleted={() => {
            setViewingLookId(null)
            loadState()
          }}
        />
      )}
    </div>
  )
}
