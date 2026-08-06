import { ReactNode, useState } from 'react';
import { Tab, urlForVideo } from '../lib/router';
import './AppHeader.css';

export function AppHeader(props: {
  video: string; videos: string[]; tab: Tab; dirty: boolean;
  tabs: { id: Tab; label: string }[];  // plan 193: caller passes the VISIBLE rows, filtered server-side
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
    const target = urlForVideo(slug, location);
    // Assigning location.href a URL identical to the current one is a no-op, so
    // the overlay used to spin forever. That is reachable whenever the picker
    // disagrees with ?video= — e.g. the server ignored the param and fell back,
    // leaving the URL already naming the slug you are trying to select.
    if (target === location.pathname + location.search + location.hash) location.reload();
    else location.href = target;                   // full navigation, like today
  };
  return (
    <header className="app-header">
      <div className="app-header-row1">
        <nav className="app-tabs">
          {props.tabs.map((t) => (
            <button key={t.id} data-tab-id={t.id} className={'tab-btn' + (t.id === props.tab ? ' active' : '')}
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
