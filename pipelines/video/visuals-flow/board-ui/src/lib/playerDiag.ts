// A flight recorder for the review player.
//
// It exists because "the video is stuck" has now been three DIFFERENT faults in
// one day — a crashed server, a keyboard dead end, and whatever this is — and
// all three look identical on screen: a frame frozen mid-play with an inert Play
// button. Guessing from a description costs a round trip each time and has been
// wrong twice, so the player now records what actually happened and the board
// keeps the log next to the video's other artifacts.
//
// The one question worth answering is WHO stopped it, so `pause()` is wrapped to
// capture a stack. A pause with an app frame in its stack is our bug; a pause
// with none came from the browser itself (an audio-device change, a policy, a
// decoder giving up) and needs a completely different fix.

type DiagEntry = {
  at: string;
  ev: string;
  t: number;
  paused: boolean;
  readyState: number;
  networkState: number;
  err: string | null;
  buffered: string;
  activeEl: string;
  stack?: string;
};

const MAX = 400;

export function installPlayerDiag(v: HTMLVideoElement, context: string): () => void {
  if ((v as unknown as { __diag?: boolean }).__diag) return () => {};
  (v as unknown as { __diag?: boolean }).__diag = true;

  const buf: DiagEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const describe = (): Omit<DiagEntry, 'ev' | 'at' | 'stack'> => {
    const b: string[] = [];
    for (let i = 0; i < v.buffered.length; i++) {
      b.push(`${v.buffered.start(i).toFixed(0)}-${v.buffered.end(i).toFixed(0)}`);
    }
    const a = document.activeElement;
    return {
      t: +v.currentTime.toFixed(2),
      paused: v.paused,
      readyState: v.readyState,
      networkState: v.networkState,
      err: v.error ? `${v.error.code}: ${v.error.message}` : null,
      buffered: b.join(','),
      activeEl: a ? `${a.tagName}.${(a as HTMLElement).className || ''}`.slice(0, 60) : 'none',
    };
  };

  const record = (ev: string, stack?: string) => {
    buf.push({ at: new Date().toISOString(), ev, ...describe(), ...(stack ? { stack } : {}) });
    if (buf.length > MAX) buf.splice(0, buf.length - MAX);
    // Flush soon after something happened, not on a timer: the interesting
    // moment is always followed by a quiet one.
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 1500);
  };

  const flush = () => {
    if (!buf.length) return;
    const batch = buf.splice(0, buf.length);
    // keepalive so a flush still lands if the tab is being closed
    fetch('/diag', {
      method: 'POST',
      keepalive: true,
      body: JSON.stringify({ context, entries: batch }),
    }).catch(() => { /* diagnostics must never break playback */ });
  };

  // WHO called pause(). This is the whole point of the file.
  const nativePause = v.pause.bind(v);
  (v as HTMLVideoElement).pause = function patchedPause() {
    const stack = (new Error().stack || '')
      .split('\n').slice(1, 6).map((l) => l.trim()).join(' | ');
    record('pause() CALLED', stack);
    return nativePause();
  };

  const nativePlay = v.play.bind(v);
  (v as HTMLVideoElement).play = function patchedPlay() {
    const stack = (new Error().stack || '')
      .split('\n').slice(1, 6).map((l) => l.trim()).join(' | ');
    record('play() CALLED', stack);
    return nativePlay().catch((e: Error) => {
      // A rejected play() is the single most under-reported cause of "I press
      // Play and nothing happens" — it resolves to nothing, silently.
      record(`play() REJECTED ${e.name}: ${e.message}`);
      throw e;
    });
  };

  const events = [
    'pause', 'play', 'playing', 'waiting', 'stalled', 'error', 'ended', 'emptied',
    'abort', 'suspend', 'seeking', 'seeked', 'ratechange', 'loadstart', 'canplay',
  ];
  const onEvent = (e: Event) => record(e.type);
  events.forEach((n) => v.addEventListener(n, onEvent));

  const onVis = () => record(`visibility:${document.visibilityState}`);
  document.addEventListener('visibilitychange', onVis);

  record('diag installed');

  return () => {
    events.forEach((n) => v.removeEventListener(n, onEvent));
    document.removeEventListener('visibilitychange', onVis);
    flush();
  };
}
