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
