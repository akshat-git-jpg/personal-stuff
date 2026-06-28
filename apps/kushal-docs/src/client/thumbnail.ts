// Generate downscaled JPEGs from an image File, client-side, so the app loads
// fast on mobile instead of pulling full-resolution camera photos:
//   - thumbnail (480px) → grid tiles
//   - view (1440px)     → the detail viewer (the original is kept for download)

async function downscale(file: Blob, maxEdge: number, quality: number): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
  } catch {
    return null; // unsupported / corrupt image — fall back to no derivative
  }
}

/** Small preview for the grid (longest edge 480px). */
export const makeThumbnail = (file: Blob) => downscale(file, 480, 0.72);

/** Medium image for the detail viewer (longest edge 1440px). */
export const makeView = (file: Blob) => downscale(file, 1440, 0.82);
