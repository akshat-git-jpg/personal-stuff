export type Word = [number, number, string];
export interface Part { name: string; start: number }
export interface Card { id: string; card: string; start: number; duration: number }
export interface Item {
  text: string; why?: string; t?: number; context?: string; added?: string;
  applied?: string; folded?: string; deferred?: string; images?: number; moment?: string;
}
export interface Version { label: string; created: string | null; draft: boolean }
export interface VideoSummary {
  recipe: string; recipeLabel: string; slug: string; title: string; updated: string;
  versions: string[]; approved: { version: string | null } | null;
  comments: { total: number; open: number };
}
export interface VideoDetail {
  recipe: string; recipeLabel: string; slug: string; title: string;
  versions: Version[]; approved: { version: string | null } | null; duration: number;
  parts: Part[]; cards: Card[]; words: Word[]; items: Record<string, Item>;
  notes: string; notesEnabled: boolean;
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

const base = (recipe: string, slug: string) => `/api/videos/${recipe}/${slug}`;

export const api = {
  videos: () => call<{ videos: VideoSummary[] }>('/api/videos').then((d) => d.videos),
  video: (recipe: string, slug: string) => call<VideoDetail>(base(recipe, slug)),
  addComment: (recipe: string, slug: string, body: { label: string; t: number; text: string; why: string; images: string[] }) =>
    call<{ key: string }>(`${base(recipe, slug)}/comments`, body),
  editComment: (recipe: string, slug: string, body: { key: string; text: string; why: string }) =>
    call(`${base(recipe, slug)}/comments-edit`, body),
  deleteComment: (recipe: string, slug: string, key: string) => call(`${base(recipe, slug)}/comments-delete`, { key }),
  saveNotes: (recipe: string, slug: string, text: string) => call(`${base(recipe, slug)}/notes`, { text }),
  peaks: (recipe: string, slug: string, label: string) =>
    call<{ perSec: number; data: number[] }>(`/api/peaks/${recipe}/${slug}/${label}`),
  mediaUrl: (recipe: string, slug: string, label: string) => `/api/media/${recipe}/${slug}/${label}`,
  thumbUrl: (recipe: string, slug: string, label: string, t: number) => `/api/thumb/${recipe}/${slug}/${label}?t=${Math.floor(t)}`,
  imageUrl: (recipe: string, slug: string, key: string, n: number) => `/api/image/${recipe}/${slug}?key=${encodeURIComponent(key)}&n=${n}`,
};
