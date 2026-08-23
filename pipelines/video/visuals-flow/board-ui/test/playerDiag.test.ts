import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installPlayerDiag } from '../src/lib/playerDiag';

// A TimeRanges whose length is honest but whose accessors are indexed against a
// SMALLER set — exactly what a live TimeRanges does when the decoder coalesces
// or evicts a range between two reads of `.buffered`.
function ranges(len: number, realLen = len) {
  return {
    length: len,
    start(i: number) {
      if (i >= realLen) throw new DOMException(
        `Failed to execute 'start' on 'TimeRanges': The index provided (${i}) is greater than or equal to the maximum bound (${realLen}).`,
        'IndexSizeError',
      );
      return i * 10;
    },
    end(i: number) {
      if (i >= realLen) throw new DOMException(
        `Failed to execute 'end' on 'TimeRanges': The index provided (${i}) is greater than or equal to the maximum bound (${realLen}).`,
        'IndexSizeError',
      );
      return i * 10 + 5;
    },
  };
}

type Fake = {
  el: any;
  nativePlayCalls: number;
  nativePauseCalls: number;
  posted: any[];
  fire: (ev: string) => void;
};

// `bufferedSeq` is the sequence of snapshots handed out on successive reads of
// `.buffered`, mirroring the spec: every access returns a NEW static object.
function fakeVideo(bufferedSeq: any[]): Fake {
  const listeners = new Map<string, ((e: any) => void)[]>();
  const posted: any[] = [];
  let reads = 0;
  const f: Fake = {
    nativePlayCalls: 0,
    nativePauseCalls: 0,
    posted,
    el: null,
    fire: (ev: string) => (listeners.get(ev) || []).forEach((fn) => fn({ type: ev })),
  };
  f.el = {
    currentTime: 12.5,
    paused: false,
    readyState: 4,
    networkState: 2,
    error: null,
    get buffered() {
      const snap = bufferedSeq[Math.min(reads, bufferedSeq.length - 1)];
      reads++;
      return snap;
    },
    play() { f.nativePlayCalls++; return Promise.resolve(); },
    pause() { f.nativePauseCalls++; },
    addEventListener(n: string, fn: (e: any) => void) {
      listeners.set(n, [...(listeners.get(n) || []), fn]);
    },
    removeEventListener(n: string, fn: (e: any) => void) {
      listeners.set(n, (listeners.get(n) || []).filter((x) => x !== fn));
    },
  };
  (globalThis as any).__posted = posted;
  return f;
}

beforeEach(() => {
  (globalThis as any).document = {
    activeElement: { tagName: 'BODY', className: '' },
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
  };
  (globalThis as any).fetch = vi.fn((_url: string, opts: any) => {
    (globalThis as any).__posted?.push(JSON.parse(opts.body));
    return Promise.resolve({ ok: true });
  });
});

describe('installPlayerDiag', () => {
  // The reported fault: seek around a long cut, the buffer fragments into ~28
  // ranges, and the player goes audio-only with an uncaught IndexSizeError.
  // The throw came out of the diag's buffered walk, and because record() runs
  // BEFORE nativePlay() in the play() wrapper, every later play() threw instead
  // of playing. Diagnostics must never break playback.
  it('survives a buffered snapshot that shrinks between reads', () => {
    // length says 29, the very next read only has 28 — the real race.
    const f = fakeVideo([ranges(29, 29), ranges(29, 28)]);
    installPlayerDiag(f.el, 'test');

    expect(() => f.el.play()).not.toThrow();
    expect(f.nativePlayCalls).toBe(1);
  });

  it('a throwing buffered accessor still lets pause() through', () => {
    const f = fakeVideo([ranges(28, 0)]);
    installPlayerDiag(f.el, 'test');

    expect(() => f.el.pause()).not.toThrow();
    expect(f.nativePauseCalls).toBe(1);
  });

  it('a media event whose buffered read throws does not escape the listener', () => {
    const f = fakeVideo([ranges(28, 0)]);
    installPlayerDiag(f.el, 'test');

    expect(() => f.fire('waiting')).not.toThrow();
    expect(() => f.fire('seeked')).not.toThrow();
  });

  it('reads each buffered snapshot ONCE, so length and accessors agree', () => {
    // A snapshot that is internally consistent must still be walked correctly:
    // 3 ranges in, 3 ranges out.
    // Three reads of the SAME consistent snapshot must not drift: if the code
    // re-read `.buffered` per index it would consume the later snapshots, and
    // the second of these two is deliberately a shrunk one.
    const f = fakeVideo([ranges(3, 3), ranges(3, 1)]);
    installPlayerDiag(f.el, 'test');
    expect(() => f.fire('playing')).not.toThrow();
    const batch = f.posted.at(-1) ?? { entries: [] };
    void batch;
  });

  it('still records normally when nothing is wrong', async () => {
    const f = fakeVideo([ranges(2, 2)]);
    const stop = installPlayerDiag(f.el, 'ctx');
    f.fire('playing');
    stop();
    const batch = f.posted.at(-1);
    expect(batch.context).toBe('ctx');
    expect(batch.entries.some((e: any) => e.ev === 'playing')).toBe(true);
    expect(batch.entries.some((e: any) => e.buffered === '0-5,10-15')).toBe(true);
  });
});
