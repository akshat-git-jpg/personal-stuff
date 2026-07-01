/**
 * db.ts
 * D1 data access for categories + items. Thin, typed helpers — no ORM.
 */

import type { Env } from './auth'

export interface Category {
  id: string
  name: string
  position: number
  created_at: number
}

export interface Item {
  id: string
  category_id: string
  text: string
  position: number
  created_at: number
}

export interface AppState {
  categories: Category[]
  items: Item[]
}

export async function getState(env: Env): Promise<AppState> {
  const [cats, items] = await Promise.all([
    env.DB.prepare('SELECT id, name, position, created_at FROM categories ORDER BY position, created_at').all<Category>(),
    env.DB.prepare('SELECT id, category_id, text, position, created_at FROM items ORDER BY position, created_at').all<Item>(),
  ])
  return { categories: cats.results ?? [], items: items.results ?? [] }
}

async function nextCategoryPosition(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM categories').first<{ pos: number }>()
  return row?.pos ?? 0
}

async function nextItemPosition(env: Env, categoryId: string): Promise<number> {
  const row = await env.DB
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM items WHERE category_id = ?')
    .bind(categoryId)
    .first<{ pos: number }>()
  return row?.pos ?? 0
}

export async function createCategory(env: Env, name: string): Promise<Category> {
  const cat: Category = {
    id: crypto.randomUUID(),
    name,
    position: await nextCategoryPosition(env),
    created_at: Date.now(),
  }
  await env.DB.prepare('INSERT INTO categories (id, name, position, created_at) VALUES (?, ?, ?, ?)')
    .bind(cat.id, cat.name, cat.position, cat.created_at)
    .run()
  return cat
}

export async function renameCategory(env: Env, id: string, name: string): Promise<void> {
  await env.DB.prepare('UPDATE categories SET name = ? WHERE id = ?').bind(name, id).run()
}

export async function deleteCategory(env: Env, id: string): Promise<void> {
  // Cascade by hand — FK enforcement isn't relied upon.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM items WHERE category_id = ?').bind(id),
    env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id),
  ])
}

export async function createItem(env: Env, categoryId: string, text: string): Promise<Item> {
  const item: Item = {
    id: crypto.randomUUID(),
    category_id: categoryId,
    text,
    position: await nextItemPosition(env, categoryId),
    created_at: Date.now(),
  }
  await env.DB.prepare('INSERT INTO items (id, category_id, text, position, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(item.id, item.category_id, item.text, item.position, item.created_at)
    .run()
  return item
}

export async function updateItem(env: Env, id: string, text: string): Promise<void> {
  await env.DB.prepare('UPDATE items SET text = ? WHERE id = ?').bind(text, id).run()
}

export async function deleteItem(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()
}

/** Persist a new order by writing each id's index as its position. */
export async function reorderCategories(env: Env, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return
  await env.DB.batch(
    orderedIds.map((id, i) => env.DB.prepare('UPDATE categories SET position = ? WHERE id = ?').bind(i, id)),
  )
}

export async function reorderItems(env: Env, categoryId: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return
  await env.DB.batch(
    orderedIds.map((id, i) =>
      env.DB.prepare('UPDATE items SET position = ?, category_id = ? WHERE id = ?').bind(i, categoryId, id),
    ),
  )
}
