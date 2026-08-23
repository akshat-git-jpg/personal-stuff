// @vitest-environment jsdom
//
// Component tests for the simple-flow gate (125) added to IntroTab.tsx by
// plan 221, plus a regression guard on the untouched complex-flow idea gate.
// vite.config.ts runs this workspace's tests under Node — jsdom is opted in
// per-file (the pragma above) rather than globally, so every other *.test.ts
// in this app keeps running fast with no DOM.
//
// There is no @testing-library/react here (none of this app's tests use one)
// — a small createRoot()+act() harness renders the real component, with
// `fetch` mocked per URL, and asserts on the DOM exactly like
// scripts/board-ui-smoke.mjs does against Chrome's dump-dom. That is
// deliberate: asserting on props or on an extracted render function would not
// exercise the branch condition IntroTab.tsx actually evaluates, and the
// existing idea gate must be driven the same way to be a real regression
// guard rather than an inert lookalike (LESSONS 2026-08-17 / 2026-07-24).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IntroTab } from './IntroTab';
import { FeedbackProvider } from '../lib/feedback';

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

// Same three fetches loadData() makes, keyed by pathname so call order never
// matters. videoStatus mirrors the Range-probe /intro-video makes to learn
// whether the film exists at all.
function mockFetch(introData: unknown, opts: { boardData?: unknown; videoStatus?: number } = {}) {
  const { boardData = { feedback: {} }, videoStatus = 200 } = opts;
  return vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/intro-data')) return jsonResponse(introData);
    if (u.includes('/api/board-data')) return jsonResponse(boardData);
    if (u.includes('/intro-video')) return Promise.resolve({ status: videoStatus, ok: videoStatus < 400 } as Response);
    if (u.includes('/approve-intro')) return jsonResponse({ ok: true });
    return jsonResponse({});
  });
}

// A macrotask boundary drains every microtask loadData()'s three sequential
// awaits scheduled — including the ones scheduled by earlier ones — before
// this fires, which one is enough for either.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) { root.unmount(); root = null; }
  if (container) { container.remove(); container = null; }
  vi.unstubAllGlobals();
});

async function renderTab(introData: unknown, opts: { boardData?: unknown; videoStatus?: number } = {}) {
  vi.stubGlobal('fetch', mockFetch(introData, opts));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      // FeedbackProvider matches how App.tsx actually mounts this tab — the
      // per-beat comments (FeedbackBox) call useFeedback() and throw without it.
      <FeedbackProvider>
        <IntroTab
          video="test-video"
          onMeta={() => {}}
          onActions={() => {}}
          onSecondary={() => {}}
          onRefetch={async () => {}}
        />
      </FeedbackProvider>,
    );
    await flush();
    await flush();
  });
  return container;
}

const oneBeatCutlist = (approved: boolean) => ({
  video: 'test-video',
  mode: 'simple',
  approved,
  span: { start: 0, end: 3 },
  beats: [{ id: 'b01', kind: 'avatar', t_start: 0, t_end: 3 }],
});

describe('IntroTab — simple-flow gate (125)', () => {
  it('renders the beat table with one row per beat', async () => {
    const cutlist = {
      video: 'test-video',
      mode: 'simple',
      approved: false,
      span: { start: 0, end: 8 },
      beats: [
        { id: 'b01', kind: 'avatar', t_start: 0, t_end: 3 },
        { id: 'b02', kind: 'card', card: 'statement', t_start: 3, t_end: 6, vars: { text: 'hello there' } },
        { id: 'b03', kind: 'overlay', card: 'lower-third', t_start: 6, t_end: 8, vars: { text: 'Mira' } },
      ],
    };
    const el = await renderTab({
      present: false, mode: 'simple', cutlist,
      pacing: { avatarShare: 0.4, cuts: cutlist.beats.length, longestAvatarHold: 3 },
    });
    const rows = el.querySelectorAll('.intro-simple-beat-row');
    expect(rows.length, 'SIMPLE-INTRO: beat table did not render one row per beat').toBe(cutlist.beats.length);
    // The overlay row is visually distinct — the presenter is still on
    // screen underneath the card, which is exactly what the owner judges.
    expect(el.querySelector('.intro-simple-beat-overlay')).toBeTruthy();
  });

  it('disables Approve and shows the render command when the video is missing', async () => {
    const cutlist = oneBeatCutlist(false);
    const el = await renderTab(
      { present: false, mode: 'simple', cutlist, pacing: { avatarShare: 1, cuts: 1, longestAvatarHold: 3 } },
      { videoStatus: 404 },
    );
    const btn = el.querySelector('.intro-simple-approve-btn') as HTMLButtonElement | null;
    expect(btn, 'SIMPLE-INTRO: no Approve control found in the gate branch').toBeTruthy();
    expect(btn!.disabled, 'SIMPLE-INTRO: Approve must be disabled while the video is missing').toBe(true);
    expect(el.textContent).toContain('intro-simple-render');
    // The degraded state must not render an enabled button anywhere else in
    // this branch either — there is exactly one Approve control.
    expect(el.querySelectorAll('.intro-simple-approve-btn').length).toBe(1);
  });

  it('does not render the gate branch once the cut list is approved', async () => {
    const cutlist = oneBeatCutlist(true);
    const el = await renderTab({
      present: false, mode: 'simple', cutlist,
      pacing: { avatarShare: 1, cuts: 1, longestAvatarHold: 3 },
    });
    expect(el.querySelector('.intro-simple-tab')).toBeNull();
  });

  it('shows the pacing strip avatar-share figure as a percentage with its limit', async () => {
    const cutlist = oneBeatCutlist(false);
    const el = await renderTab({
      present: false, mode: 'simple', cutlist,
      pacing: { avatarShare: 0.482, cuts: 1, longestAvatarHold: 4.2 },
    });
    const value = el.querySelector('.intro-simple-pacing-value');
    expect(value?.textContent, 'SIMPLE-INTRO: pacing strip avatar-share figure not found').toBe('48%');
    expect(el.textContent).toContain('≤ 55%');
    expect(el.textContent).toContain('≤ 5.0s');
  });

  // Gate 125 reviews a video, so its feedback must be TIMESTAMPED like the
  // Final Cut tab — pause, comment, the comment carries the moment. It shipped
  // as a bare <video> plus one autosaved box per beat, which made the owner
  // translate "this card is late" into a beat id by hand (owner report
  // 2026-08-22). Without these two assertions the surface can silently revert:
  // the beat table, pacing strip and Approve button all still pass their own
  // tests either way.
  it('reviews the cut through the shared timestamped ReviewSurface, not per-beat boxes', async () => {
    const cutlist = oneBeatCutlist(false);
    const el = await renderTab({
      present: false, mode: 'simple', cutlist,
      pacing: { avatarShare: 0.3, cuts: 1, longestAvatarHold: 2.5 },
    });
    expect(
      el.querySelector('.rs-container'),
      'SIMPLE-INTRO: the shared ReviewSurface (timestamped player + comment composer) is not mounted',
    ).toBeTruthy();
    expect(
      el.querySelectorAll('.intro-simple-beat-feedback').length,
      'SIMPLE-INTRO: the per-beat feedback boxes are back — feedback must be timestamped, not per-beat',
    ).toBe(0);
    // the beat table stays as a reference strip under the player
    expect(el.querySelector('.intro-simple-beat-row')).toBeTruthy();
  });

  // Regression guard (plan 221 STOP condition: the two existing complex-flow
  // branches must not be touched). Driven through the real fetch → state →
  // render path, same as the simple-gate cases above, not through props —
  // an extracted render function would pass even if IntroTab's actual branch
  // order stopped reaching this code at all.
  it('mode "complex": an unapproved idea.json still renders the idea gate exactly as before', async () => {
    const el = await renderTab({
      present: true,
      approved: false,
      beats: [],
      findings: [],
      sheets: [],
      mode: 'complex',
      cutlist: null,
      pacing: null,
      idea: {
        directions: [{
          id: 'a', name: 'Direction A', central_object: 'a coin', arc: ['opens', 'closes'],
          motifs: ['coin'], enacts_throughline: 'yes', rejects: 'nothing',
        }],
        chosen: null,
        approved: false,
        round: 1,
        rejected: [],
        playable: ['a'],
      },
    });
    expect(el.querySelector('.intro-idea-directions')).toBeTruthy();
    expect(el.textContent).toContain('Approve direction a');
    expect(el.querySelector('.intro-simple-tab')).toBeNull();
  });
});
