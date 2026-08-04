import { RefObject, useEffect, useState } from 'react';

export type OverflowModel = {
  times: { t: number; offenders: string[] }[];
};

export function useOverflowBadge(iframeRef: RefObject<HTMLIFrameElement | null>, probeTimes: number[]): OverflowModel {
  const [model, setModel] = useState<OverflowModel>({ times: [] });

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      if (probeTimes && probeTimes.length > 0) {
        try {
          iframe.contentWindow?.postMessage({ probe: probeTimes }, '*');
        } catch (e) {}
      }
    };
    iframe.addEventListener('load', onLoad);
    
    // In case it's already loaded before effect ran
    if (iframe.contentWindow && probeTimes.length > 0) {
      try {
        iframe.contentWindow?.postMessage({ probe: probeTimes }, '*');
      } catch (e) {}
    }

    const onMessage = (e: MessageEvent) => {
      if (!e.data || !e.data.__overflow) return;
      if (iframe.contentWindow !== e.source) return;
      
      const { t, offenders } = e.data.__overflow;
      setModel(prev => {
        const next = [...prev.times, { t, offenders }];
        return { times: next };
      });
    };

    window.addEventListener('message', onMessage);

    return () => {
      iframe.removeEventListener('load', onLoad);
      window.removeEventListener('message', onMessage);
    };
  }, [iframeRef, probeTimes]);

  return model;
}
