import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
import { GripVertical, Plus, Trash2, ListPlus } from 'lucide-react'
import type { Category, Item } from './types'
import { cn } from '@/lib/utils'

interface Props {
  category: Category
  items: Item[]
  onAdd: (text: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
  onReorder: (orderedIds: string[]) => void
}

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/g

/** Turn raw text into nodes, making any URL a clickable new-tab link. */
function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) => {
    if (!part) return null
    if (/^(https?:\/\/|www\.)/.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="break-all text-primary underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

/** A textarea that grows to fit its content (no inner scrollbar). */
function AutoTextarea({
  value,
  onChange,
  className,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      className={cn('resize-none overflow-hidden', className)}
      {...rest}
    />
  )
}

function Row({
  item,
  onUpdate,
  onDelete,
}: {
  item: Item
  onUpdate: (text: string) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const style = { transform: CSS.Transform.toString(transform), transition }

  function commit() {
    const v = draft.trim()
    if (v && v !== item.text) onUpdate(v)
    else setDraft(item.text)
    setEditing(false)
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded-lg border border-transparent bg-card px-2 py-2 shadow-[var(--shadow-soft)] transition hover:border-border',
        isDragging && 'z-10 opacity-80 shadow-[var(--shadow-pop)]',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Reorder item"
        className="mt-0.5 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      {editing ? (
        <AutoTextarea
          autoFocus
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ;(e.target as HTMLTextAreaElement).blur()
            }
            if (e.key === 'Escape') {
              setDraft(item.text)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1 text-sm leading-relaxed outline-none"
        />
      ) : (
        <div
          onClick={() => {
            setDraft(item.text)
            setEditing(true)
          }}
          className="min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words px-2 py-1 text-sm leading-relaxed"
        >
          {linkify(item.text)}
        </div>
      )}

      <button
        onClick={onDelete}
        aria-label="Delete item"
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}

export default function ItemList({ category, items, onAdd, onUpdate, onDelete, onReorder }: Props) {
  const [adding, setAdding] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = items.map((i) => i.id)
    onReorder(arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string)))
  }

  function add() {
    const v = adding.trim()
    if (!v) return
    onAdd(v)
    setAdding('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{category.name}</h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Add box, always first — fastest path to capture a thought.
          Enter adds, Shift+Enter makes a new line for longer notes. */}
      <div className="mb-3 flex items-start gap-2">
        <AutoTextarea
          value={adding}
          onChange={setAdding}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              add()
            }
          }}
          placeholder={`Add to ${category.name}…  (Shift+Enter for a new line)`}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          onClick={add}
          disabled={!adding.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-border py-14 text-center">
          <ListPlus className="mb-3 size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">No items yet</p>
          <p className="text-sm text-muted-foreground">Add your first one above.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onUpdate={(text) => onUpdate(item.id, text)}
                  onDelete={() => onDelete(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
