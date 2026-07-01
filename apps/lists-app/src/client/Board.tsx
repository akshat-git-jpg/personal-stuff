import { useEffect, useMemo, useState } from 'react'
import { ListChecks, Search, X, LogOut, ChevronDown, Loader2 } from 'lucide-react'
import { api } from './api'
import type { Category, Item } from './types'
import CategoryList from './CategoryList'
import ItemList from './ItemList'
import SearchResults from './SearchResults'
import { cn } from '@/lib/utils'

export default function Board({ onLogout }: { onLogout: () => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false)

  useEffect(() => {
    api
      .state()
      .then((s) => {
        setCategories(s.categories)
        setItems(s.items)
        setSelectedId((prev) => prev ?? s.categories[0]?.id ?? null)
      })
      .catch(() => setError('Could not load your lists.'))
      .finally(() => setLoading(false))
  }, [])

  // Wrap a mutation: bounce to login on 401, otherwise surface + resync.
  async function run<T>(p: Promise<T>): Promise<T | undefined> {
    try {
      return await p
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLogout()
        return
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      const s = await api.state().catch(() => null)
      if (s) {
        setCategories(s.categories)
        setItems(s.items)
      }
      return
    }
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const it of items) m[it.category_id] = (m[it.category_id] ?? 0) + 1
    return m
  }, [items])

  const trimmedQuery = query.trim()
  const hits = useMemo(() => {
    if (!trimmedQuery) return []
    const q = trimmedQuery.toLowerCase()
    const byId = new Map(categories.map((c) => [c.id, c]))
    return items
      .filter((it) => it.text.toLowerCase().includes(q))
      .map((it) => ({ item: it, category: byId.get(it.category_id)! }))
      .filter((h) => h.category)
  }, [trimmedQuery, items, categories])

  const selected = categories.find((c) => c.id === selectedId) ?? null
  const selectedItems = useMemo(
    () => items.filter((it) => it.category_id === selectedId),
    [items, selectedId],
  )

  // ── Category mutations ──────────────────────────────────────────────────
  async function addCategory(name: string) {
    const created = await run(api.createCategory(name))
    if (created) {
      setCategories((cs) => [...cs, created])
      setSelectedId(created.id)
    }
  }
  function renameCategory(id: string, name: string) {
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)))
    run(api.renameCategory(id, name))
  }
  function deleteCategory(id: string) {
    setCategories((cs) => cs.filter((c) => c.id !== id))
    setItems((is) => is.filter((i) => i.category_id !== id))
    if (selectedId === id) setSelectedId(categories.find((c) => c.id !== id)?.id ?? null)
    run(api.deleteCategory(id))
  }
  function reorderCategories(orderedIds: string[]) {
    const map = new Map(categories.map((c) => [c.id, c]))
    setCategories(orderedIds.map((id, i) => ({ ...map.get(id)!, position: i })))
    run(api.reorderCategories(orderedIds))
  }

  // ── Item mutations ──────────────────────────────────────────────────────
  async function addItem(text: string) {
    if (!selectedId) return
    const created = await run(api.createItem(selectedId, text))
    if (created) setItems((is) => [...is, created])
  }
  function updateItem(id: string, text: string) {
    setItems((is) => is.map((i) => (i.id === id ? { ...i, text } : i)))
    run(api.updateItem(id, text))
  }
  function deleteItem(id: string) {
    setItems((is) => is.filter((i) => i.id !== id))
    run(api.deleteItem(id))
  }
  function reorderItems(orderedIds: string[]) {
    if (!selectedId) return
    const pos = new Map(orderedIds.map((id, i) => [id, i]))
    setItems((is) =>
      is.map((i) => (i.category_id === selectedId ? { ...i, position: pos.get(i.id) ?? i.position } : i)),
    )
    run(api.reorderItems(selectedId, orderedIds))
  }

  function pickCategory(id: string) {
    setSelectedId(id)
    setQuery('')
    setMobileCatsOpen(false)
  }

  async function doLogout() {
    await api.logout().catch(() => {})
    onLogout()
  }

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const sidebar = (
    <CategoryList
      categories={categories}
      counts={counts}
      selectedId={selectedId}
      onSelect={pickCategory}
      onAdd={addCategory}
      onRename={renameCategory}
      onDelete={deleteCategory}
      onReorder={reorderCategories}
    />
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      {/* Header */}
      <header className="flex items-center gap-3 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <ListChecks className="size-5" />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">Lists</h1>

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all items"
            className="w-full rounded-full border border-input bg-card py-2 pl-8 pr-8 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={doLogout}
          aria-label="Log out"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4.5" />
        </button>
      </header>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Mobile category switcher */}
      {!trimmedQuery && (
        <div className="relative mb-3 md:hidden">
          <button
            onClick={() => setMobileCatsOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
          >
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              {selected?.name ?? 'No categories yet'}
            </span>
            <ChevronDown className={cn('size-4 text-muted-foreground transition', mobileCatsOpen && 'rotate-180')} />
          </button>
          {mobileCatsOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-pop)]">
              {sidebar}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 gap-6 pb-10">
        <aside className="hidden w-64 shrink-0 md:block">{sidebar}</aside>

        <main className="min-w-0 flex-1">
          {trimmedQuery ? (
            <SearchResults query={trimmedQuery} hits={hits} onJump={pickCategory} />
          ) : selected ? (
            <ItemList
              key={selected.id}
              category={selected}
              items={selectedItems}
              onAdd={addItem}
              onUpdate={updateItem}
              onDelete={deleteItem}
              onReorder={reorderItems}
            />
          ) : (
            <div className="mt-10 grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
              <ListChecks className="mb-3 size-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No categories yet</p>
              <p className="text-sm text-muted-foreground">Add one from the left to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
