import { RefObject, useEffect } from 'react';

// `ready` MUST be passed and MUST change when the iframe appears. Refs are
// stable objects, so with only [audioRef, iframeRef] as deps this effect ran
// exactly once — at mount, when the tile is still a poster and there is no
// iframe at all. It bailed on the null check and never re-ran, so audio
// playback drove nothing and every card sat frozen on its first frame (a
// count-up card rendered a literal "0"). Found 2026-08-07.
export function useTileSync(
  audioRef: RefObject<HTMLAudioElement | null>,
  iframeRef: RefObject<HTMLIFrameElement | null>,
  ready?: boolean,
) {
  useEffect(() => {
    const audio = audioRef.current;
    const iframe = iframeRef.current;
    if (!audio || !iframe) return;

    let raf: number | null = null;
    const post = () => {
      try {
        iframe.contentWindow?.postMessage({ t: audio.currentTime }, '*');
      } catch (e) {
        // ignore cross-origin or unloading iframe errors
      }
    };

    const onTimeUpdate = () => post();
    const onSeeked = () => post();
    const onPause = () => {
      post();
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };
    const onPlay = () => {
      // Pause all other tile audio
      document.querySelectorAll('.tile audio').forEach((a) => {
        if (a !== audio && !(a as HTMLAudioElement).paused) {
          (a as HTMLAudioElement).pause();
        }
      });
      const loop = () => {
        post();
        if (!audio.paused) {
          raf = requestAnimationFrame(loop);
        }
      };
      loop();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [audioRef, iframeRef, ready]);
}
