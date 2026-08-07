import { useEffect, useState, ReactNode } from 'react';
import './AvatarTab.css';

// Gate 102 — the avatar spend gate. Nothing reaches HeyGen until this is
// approved (lib/avatar-plan.mjs requireAvatarPlanApproved(), called first
// thing inside avatar-render.mjs's --submit path). This tab proposes a
// character + model against the REAL clip/second totals from
// shots.resolved.json, never an estimate.

interface Candidate {
  id: string;
  description: string;
  hasTemplate: boolean;
  hasImage: boolean;
}

interface AvatarPlan {
  video: string;
  character: string | null;
  model: string | null;
  clips: number;
  seconds: number;
  candidates: Candidate[];
  models: string[];
  approved: boolean;
}

interface AvatarData {
  present: boolean;
  plan?: AvatarPlan;
}

export function AvatarTab({ video, onMeta, onActions, onSecondary }: {
  video: string;
  onMeta: (meta: ReactNode) => void;
  onActions: (actions: ReactNode) => void;
  onSecondary: (sec: ReactNode) => void;
}) {
  const [data, setData] = useState<AvatarData | null>(null);
  const [character, setCharacter] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/avatar-data?video=${encodeURIComponent(video)}`);
      const d: AvatarData = await res.json();
      setData(d);
      if (d.present && d.plan) {
        setCharacter(d.plan.character);
        setModel(d.plan.model);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [video]);

  useEffect(() => {
    onMeta(null);
    onActions(null);
    onSecondary(null);
    return () => { onActions(null); };
  }, [data, onMeta, onActions, onSecondary]);

  const approve = async () => {
    if (!character || !model) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/approve-avatar-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character, model }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `approve failed (${res.status})`);
      } else {
        await loadData();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="avatar-tab" style={{ padding: 24 }}>loading...</div>;

  // Degraded state, required: before shots.resolved.json exists there is
  // nothing real to propose against (LESSONS 2026-07-24 — an enabled button
  // over absent data is the recurring board defect). Every button below is
  // disabled with a title explaining why, not just hidden.
  if (!data.present) {
    return (
      <div className="avatar-tab" style={{ padding: 24 }}>
        <div className="banner err" style={{ marginBottom: 24 }}>
          the storyboard has not been resolved yet — run <code>run.sh {video} storyboard-check</code>
        </div>
        <div className="avatar-candidates">
          {['heygen3', 'heygen4'].map((m) => (
            <button key={m} className="avatar-model-btn" disabled title="the storyboard has not been resolved yet — run.sh <slug> storyboard-check">
              {m}
            </button>
          ))}
        </div>
        <button className="avatar-approve-btn" disabled title="the storyboard has not been resolved yet — run.sh <slug> storyboard-check">
          Approve avatar spend
        </button>
      </div>
    );
  }

  const plan = data.plan!;
  const isApproved = plan.approved && plan.character === character && plan.model === model;

  return (
    <div className="avatar-tab" style={{ padding: 24 }}>
      <div className="avatar-totals">
        <strong>{plan.clips}</strong> clip{plan.clips === 1 ? '' : 's'}, <strong>{plan.seconds}s</strong> of avatar total —
        this is what gets submitted to HeyGen once approved below. heygen4 (Avatar IV) is METERED against the monthly
        second-pool; heygen3 (Avatar III) is free and unlimited.
      </div>

      <h3>Character</h3>
      <div className="avatar-candidates">
        {plan.candidates.map((c) => (
          <button
            key={c.id}
            className={`avatar-candidate-btn ${character === c.id ? 'selected' : ''}`}
            onClick={() => setCharacter(c.id)}
            title={c.description}
          >
            {character === c.id ? '✓ ' : ''}{c.id}
            {!c.hasTemplate && !c.hasImage && ' (no template/image on file)'}
          </button>
        ))}
      </div>

      <h3>Model</h3>
      <div className="avatar-candidates">
        {plan.models.map((m) => (
          <button
            key={m}
            className={`avatar-model-btn ${model === m ? 'selected' : ''} ${m === 'heygen4' ? 'metered' : ''}`}
            onClick={() => setModel(m)}
            title={m === 'heygen4' ? 'Avatar IV — METERED against the monthly second-pool' : 'Avatar III — free, unlimited'}
          >
            {model === m ? '✓ ' : ''}{m}{m === 'heygen4' ? ' (METERED)' : ''}
          </button>
        ))}
      </div>

      {error && <div className="banner err" style={{ marginTop: 16 }}>{error}</div>}

      <button
        className={`avatar-approve-btn ${isApproved ? 'approved' : ''}`}
        disabled={!character || !model || saving || isApproved}
        title={!character || !model ? 'pick a character and a model first' : (isApproved ? 'approved' : undefined)}
        onClick={approve}
        style={{ marginTop: 24 }}
      >
        {isApproved ? `✓ approved — ${character} / ${model}` : (saving ? 'approving...' : 'Approve avatar spend')}
      </button>
    </div>
  );
}
