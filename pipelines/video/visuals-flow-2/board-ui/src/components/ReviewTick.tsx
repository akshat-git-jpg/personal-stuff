import React from 'react';
import './ReviewTick.css';

export function ReviewTick({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className={`rev ${checked ? 'rev-on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} /> reviewed
    </label>
  );
}
