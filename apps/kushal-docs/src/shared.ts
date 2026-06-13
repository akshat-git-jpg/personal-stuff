// Domain types shared between the React client and the Cloudflare Worker.

/** One stored document (image or PDF). Metadata only — the bytes live in R2
 *  under blob/<id>, and (for images) a small preview under thumb/<id>. */
export interface DocItem {
  /** Stable id; also the R2 object key suffix. Client-generated UUID. */
  id: string;
  /** User-facing name, e.g. "Aadhaar card". */
  name: string;
  /** Free-form tags for filtering, e.g. ["IDs", "gov"]. */
  tags: string[];
  /** MIME type of the stored blob, e.g. "image/jpeg" or "application/pdf". */
  mime: string;
  /** Original filename, kept for downloads. */
  filename: string;
  /** Byte size of the original file. */
  size: number;
  /** True if a thumb/<id> preview exists (images only). */
  hasThumb: boolean;
  /** ISO timestamp of when it was added. */
  createdAt: string;
}

/** The whole library index — a single JSON object stored at R2 key "index.json". */
export interface DocIndex {
  items: DocItem[];
}

export const INDEX_KEY = "index.json";
export const blobKey = (id: string) => `blob/${id}`;
export const thumbKey = (id: string) => `thumb/${id}`;

export const isImage = (mime: string) => mime.startsWith("image/");
export const isPdf = (mime: string) => mime === "application/pdf";
