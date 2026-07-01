import { SearchX } from 'lucide-react'
import type { Category, Item } from './types'

interface Hit {
  item: Item
  category: Category
}

function highlight(text: string, query: string) {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0 || !query) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary-soft px-0.5 text-foreground">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}

export default function SearchResults({
  query,
  hits,
  onJump,
}: {
  query: string
  hits: Hit[]
  onJump: (categoryId: string) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {hits.length} {hits.length === 1 ? 'result' : 'results'} for “{query}”
        </span>
      </div>

      {hits.length === 0 ? (
        <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-border py-14 text-center">
          <SearchX className="mb-3 size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nothing matches “{query}”</p>
          <p className="text-sm text-muted-foreground">Try a different word.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {hits.map(({ item, category }) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2 shadow-[var(--shadow-soft)]"
            >
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {highlight(item.text, query)}
              </span>
              <button
                onClick={() => onJump(category.id)}
                className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-primary-soft hover:text-primary"
              >
                <span className="size-1.5 rounded-full bg-primary/50" />
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
