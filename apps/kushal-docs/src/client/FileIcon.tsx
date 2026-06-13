import { isPdf } from "../shared";

/** Placeholder tile for non-image files (PDFs etc.) shown in the grid/detail. */
export function FileIcon({ mime }: { mime: string }) {
  const label = isPdf(mime) ? "PDF" : (mime.split("/")[1] || "FILE").slice(0, 4).toUpperCase();
  return (
    <div className="file-icon">
      <svg viewBox="0 0 48 56" width="44" height="52" aria-hidden="true">
        <path
          d="M4 6a4 4 0 0 1 4-4h22l14 14v34a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"
          fill="#1b2336"
          stroke="#33405e"
          strokeWidth="1.5"
        />
        <path d="M30 2v10a4 4 0 0 0 4 4h10" fill="#33405e" />
      </svg>
      <span className="file-icon-label">{label}</span>
    </div>
  );
}
