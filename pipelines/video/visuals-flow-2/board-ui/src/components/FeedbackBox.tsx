import React, { useRef } from 'react';
import { useFeedback } from '../lib/feedback';
import './FeedbackBox.css';

export function FeedbackBox({ refKey, placeholder }: { refKey: string; placeholder: string }) {
  const fb = useFeedback();
  const item = fb.items[refKey];
  const fileRef = useRef<HTMLInputElement>(null);
  if (item?.folded) {
    return <div className="feedback-folded">✓ folded {item.folded} — “{item.text}”</div>;
  }
  const pending = fb.images[refKey];                     // dataURL | null | undefined
  const src = pending != null ? pending
    : (pending === null ? null
    : item?.image ? `/feedback-image/${encodeURIComponent(refKey)}` : null);
  const onPaste = (e: React.ClipboardEvent) => {
    for (const it of e.clipboardData?.items ?? []) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault(); fb.attach(refKey, it.getAsFile()!); return;
      }
    }
  };
  return (
    <div className="fb">
      <textarea className="feedback" data-ref={refKey} placeholder={placeholder}
        value={fb.texts[refKey] ?? ''} onChange={(e) => fb.setText(refKey, e.target.value)}
        onPaste={onPaste} />
      <div className="fb-shot" data-ref={refKey}>
        {src ? (
          <span className="fb-thumb-chip">
            <img src={src} alt="attached screenshot" />
            <button type="button" className="fb-clear" title="remove screenshot"
                    onClick={() => fb.clearImage(refKey)}>×</button>
          </span>
        ) : (
          <button type="button" className="fb-attach"
                  title="attach a screenshot — or just paste one into the box above"
                  onClick={() => fileRef.current?.click()}>📎 screenshot</button>
        )}
        <input ref={fileRef} type="file" className="fb-file" accept="image/*" hidden
               onChange={(e) => { const f = e.target.files?.[0]; if (f) fb.attach(refKey, f); e.target.value = ''; }} />
      </div>
    </div>
  );
}
