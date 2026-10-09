export const GAP_S = 0.35;

export function sectionSpan(audioDurSeconds, isLast) {
  return audioDurSeconds + (isLast ? 0 : GAP_S);
}

export function planTimeline(sections, audioDur, clips) {
  const demoSections = sections.filter(s => s.demo);
  if (demoSections.length === 0) {
    throw new Error('Script has no demo sections');
  }

  const audio = [];
  const video = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const isLast = i === sections.length - 1;
    const dur = audioDur[sec.id];
    
    if (dur === undefined) {
      throw new Error(`Missing audio duration for section ${sec.id}`);
    }

    const span = sectionSpan(dur, isLast);
    
    audio.push({
      id: sec.id,
      wav: `${sec.id}.wav`,
      gapAfter: isLast ? 0 : GAP_S
    });

    if (sec.demo) {
      const clipPath = clips[sec.id];
      if (!clipPath) {
         throw new Error(`Missing clip for demo section ${sec.id}`);
      }
      video.push({
        id: sec.id,
        span,
        source: { type: 'clip', path: clipPath }
      });
    } else {
      let prevDemo = null;
      for (let j = i - 1; j >= 0; j--) {
        if (sections[j].demo) {
          prevDemo = sections[j];
          break;
        }
      }

      if (prevDemo) {
        video.push({
          id: sec.id,
          span,
          source: {
            type: 'freeze',
            from: 'prev',
            clipPath: clips[prevDemo.id],
            frame: 'last'
          }
        });
      } else {
        let nextDemo = null;
        for (let j = i + 1; j < sections.length; j++) {
          if (sections[j].demo) {
            nextDemo = sections[j];
            break;
          }
        }
        video.push({
          id: sec.id,
          span,
          source: {
            type: 'freeze',
            from: 'next',
            clipPath: clips[nextDemo.id],
            frame: 'first'
          }
        });
      }
    }
  }

  return { audio, video };
}
