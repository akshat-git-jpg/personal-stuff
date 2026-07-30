import { RefObject, useEffect } from 'react';

export function useTileSync(audioRef: RefObject<HTMLAudioElement | null>, iframeRef: RefObject<HTMLIFrameElement | null>) {
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
  }, [audioRef, iframeRef]);
}
