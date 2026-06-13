import type { DocIndex, DocItem } from "../shared";

/** GET /api/me — resolves to the signed-in email, or null if unauthenticated. */
export async function getMe(): Promise<string | null> {
  const r = await fetch("/api/me");
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(`me: ${r.status}`);
  const { email } = (await r.json()) as { email: string };
  return email;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function getIndex(): Promise<DocItem[]> {
  const r = await fetch("/api/index");
  if (!r.ok) throw new Error(`index: ${r.status}`);
  const data = (await r.json()) as DocIndex;
  return data.items ?? [];
}

async function putIndex(items: DocItem[]): Promise<void> {
  const r = await fetch("/api/index", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items } satisfies DocIndex),
  });
  if (!r.ok) throw new Error(`save index: ${r.status}`);
}

async function putBlob(id: string, body: Blob, mime: string): Promise<void> {
  const r = await fetch(`/api/blob/${id}`, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body,
  });
  if (!r.ok) throw new Error(`upload: ${r.status}`);
}

async function putThumb(id: string, body: Blob): Promise<void> {
  const r = await fetch(`/api/thumb/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body,
  });
  if (!r.ok) throw new Error(`thumb: ${r.status}`);
}

async function deleteBlob(id: string): Promise<void> {
  const r = await fetch(`/api/blob/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`delete: ${r.status}`);
}

// ---- High-level operations (blob + index kept consistent) ------------------

/** Upload a file (+ optional thumbnail), then append it to the index. */
export async function addDoc(
  item: DocItem,
  file: Blob,
  thumb: Blob | null,
  currentItems: DocItem[],
): Promise<DocItem[]> {
  await putBlob(item.id, file, item.mime);
  if (thumb) await putThumb(item.id, thumb);
  const next = [item, ...currentItems];
  await putIndex(next);
  return next;
}

/** Persist edited metadata (name/tags) for an existing item. */
export async function updateDoc(updated: DocItem, currentItems: DocItem[]): Promise<DocItem[]> {
  const next = currentItems.map((it) => (it.id === updated.id ? updated : it));
  await putIndex(next);
  return next;
}

/** Remove a doc's blob + thumb, then drop it from the index. */
export async function removeDoc(id: string, currentItems: DocItem[]): Promise<DocItem[]> {
  await deleteBlob(id);
  const next = currentItems.filter((it) => it.id !== id);
  await putIndex(next);
  return next;
}

export const blobSrc = (id: string) => `/api/blob/${id}`;
export const thumbSrc = (id: string) => `/api/thumb/${id}`;
export const downloadSrc = (item: DocItem) =>
  `/api/blob/${item.id}?download=1&name=${encodeURIComponent(item.filename || item.name)}`;
