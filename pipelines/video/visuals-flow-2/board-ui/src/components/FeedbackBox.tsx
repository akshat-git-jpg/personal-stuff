import React, { useRef } from 'react';
import { feedbackRounds, useFeedback } from '../lib/feedback';
import './FeedbackBox.css';

export function FeedbackBox({ refKey, placeholder }: { refKey: string; placeholder: string }) {
  const fb = useFeedback();
  // Folded rounds are history, never a wall: each stays visible read-only and
  // a fresh box binds to the next round key (`c20` → `c20#2` → …). One slot
  // per cue is what silently blocked round-2 feedback (owner, 2026-07-31).
  const { folded, activeKey } = feedbackRounds(refKey, fb.items);
  const item = fb.items[activeKey];
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = fb.images[activeKey];                  // dataURL | null | undefined
  const src = pending != null ? pending
    : (pending === null ? null
    : item?.image ? `/feedback-image/${encodeURIComponent(activeKey)}` : null);
  const onPaste = (e: React.ClipboardEvent) => {
    for (const it of e.clipboardData?.items ?? []) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault(); fb.attach(activeKey, it.getAsFile()!); return;
      }
    }
  };
  return (
    <div className="fb">
      {folded.map(({ key, item: f }) => (
        <div key={key} className="feedback-folded">✓ folded {f.folded} — “{f.text}”</div>
      ))}
      <textarea className="feedback" data-ref={activeKey}
        placeholder={folded.length ? 'new feedback for this round…' : placeholder}
        value={fb.texts[activeKey] ?? ''} onChange={(e) => fb.setText(activeKey, e.target.value)}
        onPaste={onPaste} />
      <div className="fb-shot" data-ref={activeKey}>
        {src ? (
          <span className="fb-thumb-chip">
            <img src={src} alt="attached screenshot" />
            <button type="button" className="fb-clear" title="remove screenshot"
                    onClick={() => fb.clearImage(activeKey)}>×</button>
          </span>
        ) : (
          <button type="button" className="fb-attach"
                  title="attach a screenshot — or just paste one into the box above"
                  onClick={() => fileRef.current?.click()}>📎 screenshot</button>
        )}
        <input ref={fileRef} type="file" className="fb-file" accept="image/*" hidden
               onChange={(e) => { const f = e.target.files?.[0]; if (f) fb.attach(activeKey, f); e.target.value = ''; }} />
      </div>
    </div>
  );
}
