import { useState, useEffect, ReactNode } from 'react';
import { Tab, TABS, tabForHash, urlForTab, videoFromSearch, visibleTabs } from './lib/router';
import { fetchBoardData, BoardData } from './lib/api';
import { AppHeader } from './components/AppHeader';
import { RunTab } from './tabs/RunTab';
import { CardPlanTab } from './tabs/CardPlanTab';
import { IntroTab } from './tabs/IntroTab';
import { StoryboardTab } from './tabs/StoryboardTab';
import { FinalCutTab } from './tabs/FinalCutTab';
import { CalibrateTab } from './tabs/CalibrateTab';
import { FeedbackProvider, useFeedback } from './lib/feedback';
import { FeedbackBox } from './components/FeedbackBox';

export function App() {
  const [tab, setTab] = useState<Tab>(() => tabForHash(location.hash));
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  
  const [meta, setMeta] = useState<ReactNode>(null);
  const [actions, setActions] = useState<ReactNode>(null);
  const [secondary, setSecondary] = useState<ReactNode>(null);
  const [backendDead, setBackendDead] = useState(false);
  
  const video = videoFromSearch(location.search) || '';

  const refetch = async () => {
    if (!video) return;
    try {
      const data = await fetchBoardData(video);
      setBoardData(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const onHashChange = () => setTab(tabForHash(location.hash));
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  // A liveness probe, not a data fetch — /health touches no filesystem and
  // the response is discarded either way. Before this, the interval hit
  // /api/board-data every 2s purely to detect a dead backend, doing real fs
  // work on every tick for a payload nothing used (plan 193).
  useEffect(() => {
    if (!video) return;
    const timer = setInterval(async () => {
      try {
        await fetch('/health');
        setBackendDead(false);
      } catch (e) {
        setBackendDead(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [video]);

  useEffect(() => {
    Promise.all([
      fetchBoardData(video),
      fetch('/run-videos').then(r => r.json()).then(d => d.videos).catch(() => [video])
    ]).then(([data, vids]) => {
      setVideos(vids);
      setBoardData(data);
      if (data.video) {
        document.title = `${data.video} — visuals-flow board`;
      }
    }).catch(err => console.error(err));
  }, [video]);

  useEffect(() => {
    if (!boardData) return;
    if (new URLSearchParams(location.search).get('probe') !== 'layout') return;
    setTimeout(() => {
      const r = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? { y: Math.round(el.getBoundingClientRect().y), h: Math.round(el.getBoundingClientRect().height) } : { y: -1, h: -1 };
      };
      const m = document.createElement('meta');
      m.name = 'layout-probe';
      m.content = JSON.stringify({
        hash: location.hash,
        header: r('.app-header'),
        tabs: r('.app-tabs'),
        slot: r('.action-slot'),
        row2: r('.app-header-row2'),
        headerCount: document.querySelectorAll('.app-header').length,
        // The rendered tab ids, so the smoke can assert tab visibility
        // without scraping button text (plan 193).
        tabIds: [...document.querySelectorAll('.app-tabs .tab-btn')].map((el) => el.getAttribute('data-tab-id')),
      });
      document.head.appendChild(m);
    }, 100);
  }, [boardData]);

  const onTab = (t: Tab) => {
    history.pushState(null, '', urlForTab(t, location));
    setTab(t);
  };

  if (!boardData) {
    // Keep the chrome on screen while data loads — a vanishing header reads
    // as a broken page, not a loading one (owner report 2026-07-31). The
    // applicable tab list is not known yet, so only the always-on Run tab
    // shows until board-data answers.
    return (
      <>
        <AppHeader video={video} videos={[video]} tab={tab} dirty={false} tabs={visibleTabs(TABS, ['run'])}
          meta={null} actions={null} secondary={null} onTab={onTab} />
        <main>
          <div className="app-loading"><span className="spinner" />loading {video}…</div>
        </main>
      </>
    );
  }

  const tabs = visibleTabs(TABS, boardData.tabs);
  // The URL hash can name a tab that does not apply to this video's flow —
  // e.g. a deep link to #intro on an intro:"cards" video, or a stale
  // bookmark from before this video's run-config changed. Fall back to Run
  // rather than rendering a tab whose data contract this video never fills
  // (an un-enumerated empty state gets invented behaviour, usually a control
  // that 500s — plan 193).
  const tabApplicable = boardData.tabs.includes(tab);
  const activeTab: Tab = tabApplicable ? tab : 'run';
  const tabNotice = tabApplicable ? null
    : `The "${TABS.find((t) => t.id === tab)?.label ?? tab}" tab isn't part of this video's flow — showing Run instead.`;

  return (
    <FeedbackProvider initialItems={boardData.feedback}>
      <FeedbackStateSync onDirty={setDirty} />
      {backendDead && (
        <div style={{ background: '#dc2626', color: 'white', padding: '12px 20px', fontWeight: 'bold', zIndex: 9999, position: 'relative' }}>
          BACKEND DEAD — Restart the server to continue saving and editing.
        </div>
      )}
      {/* The server ignores a ?video= it cannot open and falls back to the one it
          launched with. Silently, that means the URL names one video while the
          page shows another — and the owner reviews the wrong video believing the
          URL (owner report 2026-08-06). Say so instead of hiding it. */}
      {boardData.video && video && boardData.video !== video && (
        <div style={{ background: '#b45309', color: 'white', padding: '12px 20px', fontWeight: 'bold', zIndex: 9999, position: 'relative' }}>
          Showing <code>{boardData.video}</code>, not <code>{video}</code> — this board could not open that
          video (it is missing a file the board needs, or the name is wrong). Everything below is {boardData.video}.
        </div>
      )}
      {tabNotice && (
        <div style={{ background: '#1d4ed8', color: 'white', padding: '12px 20px', fontWeight: 'bold', zIndex: 9999, position: 'relative' }}>
          {tabNotice}
        </div>
      )}
      <AppHeader
        video={boardData.video || video}
        videos={videos}
        tab={activeTab}
        dirty={dirty}
        tabs={tabs}
        meta={meta}
        actions={actions}
        secondary={secondary}
        onTab={onTab}
      />
      <main>
        {activeTab === 'run' && <RunTab video={boardData.video} onMeta={setMeta} />}
        {activeTab === 'card-plan' && (
          <CardPlanTab
            video={boardData.video}
            cardPlan={boardData.cardPlan!}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {activeTab === 'intro' && (
          <IntroTab
            video={boardData.video!}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {activeTab === 'storyboard' && (
          <StoryboardTab
            video={boardData.video!}
            boardData={boardData}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {activeTab === 'final-cut' && (
          <FinalCutTab
            video={boardData.video!}
            boardData={boardData}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {activeTab === 'calibrate' && <CalibrateTab onMeta={setMeta} />}
      </main>
    </FeedbackProvider>
  );
}

function FeedbackStateSync({ onDirty }: { onDirty: (d: boolean) => void }) {
  const fb = useFeedback();
  useEffect(() => {
    onDirty(fb.dirty);
  }, [fb.dirty, onDirty]);
  return null;
}
