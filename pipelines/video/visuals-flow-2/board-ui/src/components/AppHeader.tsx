import { ReactNode, useState } from 'react';
import { Tab, TABS, urlForVideo } from '../lib/router';
import './AppHeader.css';

export function AppHeader(props: {
  video: string; videos: string[]; tab: Tab; dirty: boolean;
  meta?: ReactNode;            // tab-scoped info text (duration, counts…)
  actions?: ReactNode;         // right-aligned gate actions for the active tab
  secondary?: ReactNode;       // row 2 — allowed to differ per tab
  onTab: (t: Tab) => void;
}) {
  // Video switch is a full navigation; the OLD page stays painted until the
  // server answers, which used to look frozen. The overlay is the feedback
  // for that in-between (owner report 2026-07-31).
  const [switching, setSwitching] = useState<string | null>(null);
  const switchVideo = (slug: string) => {
    if (props.dirty && !confirm('You have unsaved feedback. Switch video and lose it?')) return;
    setSwitching(slug);
    location.href = urlForVideo(slug, location);   // full navigation, like today
  };
  return (
    <header className="app-header">
      <div className="app-header-row1">
        <nav className="app-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'tab-btn' + (t.id === props.tab ? ' active' : '')}
                    onClick={() => props.onTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <label className="app-video">video:
          <select id="videoPicker" value={props.video}
                  onChange={(e) => switchVideo(e.target.value)}>
            {props.videos.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <span className="app-meta">{props.meta}</span>
        <div className="action-slot">{props.actions}</div>
      </div>
      <div className="app-header-row2">{props.secondary}</div>
      {switching && (
        <div className="switch-overlay"><span className="spinner" />opening {switching}…</div>
      )}
    </header>
  );
}
