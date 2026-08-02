import React, { useEffect, useState, ReactNode } from 'react';
import './IntroTab.css';

export function IntroTab({ video, onMeta, onActions, onSecondary, onRefetch }: {
  video: string;
  onMeta: (meta: ReactNode) => void;
  onActions: (actions: ReactNode) => void;
  onSecondary: (sec: ReactNode) => void;
  onRefetch: () => Promise<void>;
}) {
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/intro-data?video=${encodeURIComponent(video)}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [video]);

  useEffect(() => {
    onMeta(null);
    onSecondary(null);

    if (data?.present) {
      const isApproved = !!data.approved;
      const approve = async () => {
        try {
          const res = await fetch('/approve-intro', { method: 'POST' });
          if (res.ok) await loadData();
        } catch (e) {
          console.error(e);
        }
      };

      onActions(
        <button
          className={`approve intro-approve-btn ${isApproved ? 'approved' : ''}`}
          onClick={approve}
          disabled={isApproved}
          title={isApproved ? 'approved' : undefined}
          style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}
        >
          {isApproved ? '✓ intro film approved' : 'Approve intro film'}
        </button>
      );
    } else {
      onActions(null);
    }

    return () => {
      onActions(null);
    };
  }, [data, onActions, onMeta, onSecondary]);

  if (!data) return <div className="intro-tab">loading...</div>;

  if (!data.present) {
    return (
      <div className="intro-tab">
        <div style={{ maxWidth: 800, margin: '24px auto', color: 'var(--dim)', fontSize: 13 }}>
          This video does not use the bespoke intro film. Opt in with <code>run.sh &lt;slug&gt; configure --intro film</code>.
        </div>
      </div>
    );
  }

  const errors = data.findings?.filter((f: any) => f.severity === 'error') || [];
  const warns = data.findings?.filter((f: any) => f.severity !== 'error') || [];
  const findings = [...errors, ...warns];

  return (
    <div className="intro-tab">
      {findings.length > 0 && (
        <div className="intro-findings">
          <h3>Findings</h3>
          {findings.map((f: any, i: number) => (
            <div key={i} className={`intro-finding severity-${f.severity}`}>
              <strong>[{f.severity.toUpperCase()}]</strong> {f.from ? `${f.from} - ` : ''}{f.text || f.message}
            </div>
          ))}
        </div>
      )}

      {data.beats?.map((b: any, i: number) => (
        <div key={i} className="intro-beat">
          <div className="intro-beat-header">
            <strong>{b.id}</strong> · {b.intent} · {b.register} · {b.face}
          </div>
          <div className="intro-beat-clause">“{b.clause}”</div>
          <div className="intro-beat-content">
            <div className="intro-beat-stage">
              {b.stage}
            </div>
            <div className="intro-beat-frames">
              {b.frames?.map((f: string, j: number) => (
                <img key={j} src={`/intro-frame?f=${encodeURIComponent(f)}`} alt={f} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
