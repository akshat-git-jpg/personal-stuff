// Domain types shared between the React client and the Cloudflare Worker.

/** One page (file) within a document. The bytes live in R2 under blob/<id>,
 *  and (for images) a small preview under thumb/<id>. A document can hold
 *  several of these — e.g. the front and back of an Aadhaar card. */
export interface DocPage {
  /** Stable id; also the R2 object key suffix. Client-generated UUID. */
  id: string;
  /** MIME type of the stored blob, e.g. "image/jpeg" or "application/pdf". */
  mime: string;
  /** Original filename, kept for downloads. */
  filename: string;
  /** Byte size of the original file. */
  size: number;
  /** True if a thumb/<id> preview exists (images only). */
  hasThumb: boolean;
  /** True if a view/<id> medium-res derivative exists (images only). Served in
   *  the detail viewer so we don't pull the multi-MB original just to look. */
  hasView?: boolean;
}

/** One stored document. Metadata only — page bytes live in R2 (see DocPage). */
export interface DocItem {
  /** Stable document id. Client-generated UUID. */
  id: string;
  /** User-facing name, e.g. "Aadhaar card". */
  name: string;
  /** Free-form tags for filtering, e.g. ["IDs", "gov"]. */
  tags: string[];
  /** One or more pages/files that make up this document. */
  pages: DocPage[];
  /** ISO timestamp of when it was added. */
  createdAt: string;
}

/** The on-disk shape may predate the multi-page model: older items stored a
 *  single file's fields at the top level with no `pages` array. */
type LegacyDocItem = Omit<DocItem, "pages"> & Partial<DocPage> & { pages?: DocPage[] };

/** Coerce any stored item (new or legacy single-file) into the DocItem shape.
 *  Legacy items become a one-page document keyed by the original id, so their
 *  existing blob/<id> + thumb/<id> objects keep resolving untouched. */
export function normalizeItem(raw: LegacyDocItem): DocItem {
  if (Array.isArray(raw.pages) && raw.pages.length > 0) {
    return { id: raw.id, name: raw.name, tags: raw.tags ?? [], pages: raw.pages, createdAt: raw.createdAt };
  }
  return {
    id: raw.id,
    name: raw.name,
    tags: raw.tags ?? [],
    createdAt: raw.createdAt,
    pages: [
      {
        id: raw.id,
        mime: raw.mime ?? "application/octet-stream",
        filename: raw.filename ?? raw.name,
        size: raw.size ?? 0,
        hasThumb: !!raw.hasThumb,
      },
    ],
  };
}

/** The page used for the document's cover/thumbnail: first image with a
 *  preview, else the first page. */
export function coverPage(item: DocItem): DocPage {
  return item.pages.find((p) => p.hasThumb && isImage(p.mime)) ?? item.pages[0];
}

/** The whole library index — a single JSON object stored at R2 key "index.json". */
export interface DocIndex {
  items: DocItem[];
}

export const INDEX_KEY = "index.json";
export const blobKey = (id: string) => `blob/${id}`;
export const thumbKey = (id: string) => `thumb/${id}`;
export const viewKey = (id: string) => `view/${id}`;

export const isImage = (mime: string) => mime.startsWith("image/");
export const isPdf = (mime: string) => mime === "application/pdf";
