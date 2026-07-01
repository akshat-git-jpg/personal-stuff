import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Check, X, Pencil, Trash2 } from 'lucide-react'
import type { Category } from './types'
import { cn } from '@/lib/utils'

interface Props {
  categories: Category[]
  counts: Record<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onReorder: (orderedIds: string[]) => void
}

function Row({
  cat,
  count,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  cat: Category
  count: number
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cat.name)

  const style = { transform: CSS.Transform.toString(transform), transition }

  function commit() {
    const v = draft.trim()
    if (v && v !== cat.name) onRename(v)
    else setDraft(cat.name)
    setEditing(false)
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('group relative', isDragging && 'z-10 opacity-80')}
    >
      {editing ? (
        <div className="flex items-center gap-1 rounded-lg bg-card p-1 shadow-[var(--shadow-soft)]">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(cat.name)
                setEditing(false)
              }
            }}
            className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm outline-none"
          />
          <button onClick={commit} className="grid size-7 place-items-center rounded-md text-primary hover:bg-primary-soft">
            <Check className="size-4" />
          </button>
          <button
            onClick={() => {
              setDraft(cat.name)
              setEditing(false)
            }}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-2 transition-colors',
            selected ? 'bg-primary-soft' : 'hover:bg-muted',
          )}
        >
          <button
            {...attributes}
            {...listeners}
            aria-label="Reorder category"
            className="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground/50 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>

          <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className={cn('size-2 shrink-0 rounded-full', selected ? 'bg-primary' : 'bg-muted-foreground/30')} />
            <span className={cn('truncate text-sm', selected ? 'font-medium text-foreground' : 'text-foreground/80')}>
              {cat.name}
            </span>
          </button>

          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 text-xs tabular-nums transition group-hover:opacity-0',
              selected ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
            )}
          >
            {count}
          </span>

          <div className="absolute right-2 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => {
                setDraft(cat.name)
                setEditing(true)
              }}
              aria-label="Rename"
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${cat.name}" and all its items?`)) onDelete()
              }}
              aria-label="Delete"
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function CategoryList({
  categories,
  counts,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: Props) {
  const [adding, setAdding] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = categories.map((c) => c.id)
    const next = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string))
    onReorder(next)
  }

  function add() {
    const v = adding.trim()
    if (!v) return
    onAdd(v)
    setAdding('')
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categories</h2>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-0.5">
            {categories.map((cat) => (
              <Row
                key={cat.id}
                cat={cat}
                count={counts[cat.id] ?? 0}
                selected={cat.id === selectedId}
                onSelect={() => onSelect(cat.id)}
                onRename={(name) => onRename(cat.id, name)}
                onDelete={() => onDelete(cat.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-1 flex items-center gap-1 px-1">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add category"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          onClick={add}
          disabled={!adding.trim()}
          aria-label="Add category"
          className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
