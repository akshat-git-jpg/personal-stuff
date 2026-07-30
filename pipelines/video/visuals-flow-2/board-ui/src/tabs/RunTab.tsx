import { useEffect, useState, ReactNode } from 'react';
import { fetchRunLog } from '../lib/api';
import './RunTab.css';

const RUN_MARK: Record<string, [string, string]> = {
  done:    ['✅', 'done'],
  running: ['🔄', 'in progress'],
  blocked: ['❌', 'blocked'],
  skipped: ['⏭️', 'skipped'],
  todo:    ['⚪', 'to do']
};

export function RunTab({ video, onMeta }: { video: string; onMeta: (meta: ReactNode) => void }) {
  const [log, setLog] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!video) return;
      try {
        const data = await fetchRunLog(video);
        if (active) {
          if (data.error) setError(data.error);
          else {
            setLog(data);
            const sm = data.summary;
            onMeta(
              <>
                <span style={{ fontSize: '14px' }}>✅ {sm.done} / {sm.total}</span>
                {sm.running > 0 && <span style={{ marginLeft: '12px' }}>🔄 {sm.running}</span>}
                {sm.blocked > 0 && <span style={{ marginLeft: '12px' }}>❌ {sm.blocked}</span>}
                {sm.derived > 0 && <span style={{ marginLeft: '12px', fontSize: '12px' }}>({sm.derived} inferred)</span>}
              </>
            );
          }
        }
      } catch (e: any) {
        if (active) setError(e.message);
      }
    };
    load();
    return () => {
      active = false;
      onMeta(null);
    };
  }, [video, onMeta]);

  if (error) return <div style={{ color: '#ef4444', padding: '24px' }}>could not load the run log: {error}</div>;
  if (!log) return <div style={{ padding: '24px' }}>Loading run log...</div>;

  return (
    <div className="run-tab-content">
      <div className={`run-banner ${!log.next ? 'ok' : ''}`}>
        {log.next ? (
          <>next: <code>{log.next}</code></>
        ) : (
          <>every step is done</>
        )}
      </div>
      <div className="run-steps">
        {log.steps.map((s: any) => {
          const mark = RUN_MARK[s.status] || RUN_MARK.todo;
          const name = s.id.slice(4);
          return (
            <div key={s.id} className={`run-row is-${s.status}`}>
              <div className="run-head">
                <span className="run-num">{s.number}</span>
                <span className="run-name">{name}</span>
                <span className="run-kind">{s.kind}</span>
                <span className={`run-mark ${s.status === 'running' ? 'spin' : ''}`} title={mark[1]}>
                  {mark[0]}
                </span>
              </div>
              {s.derived ? (
                <div className="run-inferred">
                  status inferred from the files on disk — this step ran before the ledger, so nothing was recorded about it
                </div>
              ) : (s.did || s.issues || s.output) ? (
                <div className="run-fields">
                  {s.did && <div className="run-field"><b>did</b><span>{s.did}</span></div>}
                  {s.issues && <div className="run-field"><b>issues</b><span>{s.issues}</span></div>}
                  {s.output && <div className="run-field"><b>output</b><span>{s.output}</span></div>}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
