import { useState, useEffect, ReactNode } from 'react';
import { Tab, tabForHash, urlForTab, videoFromSearch } from './lib/router';
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

  useEffect(() => {
    if (!video) return;
    const timer = setInterval(async () => {
      try {
        await fetch(`/api/board-data?video=${encodeURIComponent(video)}`);
        setBackendDead(false);
      } catch (e) {
        setBackendDead(true);
      }
    }, 2000);
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
    // as a broken page, not a loading one (owner report 2026-07-31).
    return (
      <>
        <AppHeader video={video} videos={[video]} tab={tab} dirty={false}
          meta={null} actions={null} secondary={null} onTab={onTab} />
        <main>
          <div className="app-loading"><span className="spinner" />loading {video}…</div>
        </main>
      </>
    );
  }

  return (
    <FeedbackProvider initialItems={boardData.feedback}>
      <FeedbackStateSync onDirty={setDirty} />
      {backendDead && (
        <div style={{ background: '#dc2626', color: 'white', padding: '12px 20px', fontWeight: 'bold', zIndex: 9999, position: 'relative' }}>
          BACKEND DEAD — Restart the server to continue saving and editing.
        </div>
      )}
      <AppHeader
        video={boardData.video || video}
        videos={videos}
        tab={tab}
        dirty={dirty}
        meta={meta}
        actions={actions}
        secondary={secondary}
        onTab={onTab}
      />
      <main>
        {tab === 'run' && <RunTab video={boardData.video} onMeta={setMeta} />}
        {tab === 'card-plan' && (
          <CardPlanTab
            video={boardData.video}
            cardPlan={boardData.cardPlan!}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {tab === 'intro' && (
          <IntroTab
            video={boardData.video!}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {tab === 'storyboard' && (
          <StoryboardTab
            video={boardData.video!}
            boardData={boardData}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {tab === 'final-cut' && (
          <FinalCutTab
            video={boardData.video!}
            boardData={boardData}
            onMeta={setMeta}
            onActions={setActions}
            onSecondary={setSecondary}
            onRefetch={refetch}
          />
        )}
        {tab === 'calibrate' && <CalibrateTab onMeta={setMeta} />}
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
