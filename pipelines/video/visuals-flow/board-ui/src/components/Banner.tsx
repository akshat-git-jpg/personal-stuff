import React from 'react';
import './Banner.css';

export function Banner({ html, kind, onDismiss }: { html: string; kind: 'ok' | 'err'; onDismiss: () => void }) {
  return (
    <div className={`banner ${kind}`}>
      <button className="banner-x" title="dismiss" onClick={onDismiss}>&times;</button>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
