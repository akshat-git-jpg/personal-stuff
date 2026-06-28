import type { DocIndex, DocItem, DocPage } from "../shared";
import { isImage, normalizeItem } from "../shared";
import { makeThumbnail, makeView } from "./thumbnail";

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
  return (data.items ?? []).map(normalizeItem);
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

async function putView(id: string, body: Blob): Promise<void> {
  const r = await fetch(`/api/view/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body,
  });
  if (!r.ok) throw new Error(`view: ${r.status}`);
}

async function deleteBlob(id: string): Promise<void> {
  const r = await fetch(`/api/blob/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`delete: ${r.status}`);
}

/** A page staged in the UI, ready to be uploaded. */
export interface StagedPage {
  file: File;
}

/** Upload one staged page: the original blob plus, for images, a thumbnail and
 *  a medium view derivative. Returns the DocPage to store in the index. */
async function uploadPage(staged: StagedPage): Promise<DocPage> {
  const id = crypto.randomUUID();
  const mime = staged.file.type || "application/octet-stream";
  const [thumb, view] = await Promise.all([makeThumbnail(staged.file), makeView(staged.file)]);
  await putBlob(id, staged.file, mime);
  await Promise.all([
    thumb ? putThumb(id, thumb) : Promise.resolve(),
    view ? putView(id, view) : Promise.resolve(),
  ]);
  return {
    id,
    mime,
    filename: staged.file.name,
    size: staged.file.size,
    hasThumb: !!thumb,
    hasView: !!view,
  };
}

// ---- High-level operations (blobs + index kept consistent) -----------------

/** Create a new document from one or more staged pages, then prepend it. */
export async function addDoc(
  meta: { name: string; tags: string[] },
  staged: StagedPage[],
  currentItems: DocItem[],
): Promise<DocItem[]> {
  const pages = await Promise.all(staged.map(uploadPage));
  const item: DocItem = {
    id: crypto.randomUUID(),
    name: meta.name,
    tags: meta.tags,
    pages,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...currentItems];
  await putIndex(next);
  return next;
}

/** Append more pages to an existing document. */
export async function addPagesToDoc(
  item: DocItem,
  staged: StagedPage[],
  currentItems: DocItem[],
): Promise<DocItem[]> {
  const pages = await Promise.all(staged.map(uploadPage));
  const updated: DocItem = { ...item, pages: [...item.pages, ...pages] };
  return updateDoc(updated, currentItems);
}

/** Persist edited metadata / page list for an existing item. */
export async function updateDoc(updated: DocItem, currentItems: DocItem[]): Promise<DocItem[]> {
  const next = currentItems.map((it) => (it.id === updated.id ? updated : it));
  await putIndex(next);
  return next;
}

/** Remove a single page from a document. If it was the last page, the whole
 *  document is removed. Returns the updated index. */
export async function removePage(
  item: DocItem,
  pageId: string,
  currentItems: DocItem[],
): Promise<DocItem[]> {
  await deleteBlob(pageId);
  const remaining = item.pages.filter((p) => p.id !== pageId);
  if (remaining.length === 0) {
    const next = currentItems.filter((it) => it.id !== item.id);
    await putIndex(next);
    return next;
  }
  return updateDoc({ ...item, pages: remaining }, currentItems);
}

/** Remove a doc's every page blob + thumb, then drop it from the index. */
export async function removeDoc(item: DocItem, currentItems: DocItem[]): Promise<DocItem[]> {
  await Promise.all(item.pages.map((p) => deleteBlob(p.id)));
  const next = currentItems.filter((it) => it.id !== item.id);
  await putIndex(next);
  return next;
}

export const blobSrc = (id: string) => `/api/blob/${id}`;
export const thumbSrc = (id: string) => `/api/thumb/${id}`;
export const viewSrc = (id: string) => `/api/view/${id}`;
export const pageDownloadSrc = (page: DocPage, docName: string) =>
  `/api/blob/${page.id}?download=1&name=${encodeURIComponent(page.filename || docName)}`;

/** The fast image to show in the viewer: the medium derivative when present,
 *  else the (now cached) original. */
export const viewableSrc = (page: DocPage) => (page.hasView ? viewSrc(page.id) : blobSrc(page.id));

/** Lazily generate a missing view derivative for an older image: fetch the
 *  original, downscale, upload it, and flag the page. Best-effort — returns the
 *  updated index on success, or null if there's nothing to do / it failed. */
export async function ensurePageView(
  item: DocItem,
  page: DocPage,
  currentItems: DocItem[],
): Promise<DocItem[] | null> {
  if (page.hasView || !isImage(page.mime)) return null;
  try {
    const orig = await fetch(blobSrc(page.id));
    if (!orig.ok) return null;
    const view = await makeView(await orig.blob());
    if (!view) return null;
    await putView(page.id, view);
    const updated: DocItem = {
      ...item,
      pages: item.pages.map((p) => (p.id === page.id ? { ...p, hasView: true } : p)),
    };
    return await updateDoc(updated, currentItems);
  } catch {
    return null;
  }
}
