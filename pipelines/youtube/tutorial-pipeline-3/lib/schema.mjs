import { scanFlags, stripFlags } from './flags.mjs';

export function validateScript(obj, { stage = 'generated' } = {}) {
  const errors = [];
  const warnings = [];

  if (!obj) {
    return { ok: false, errors: ['Script object is missing or null'], warnings };
  }

  if (typeof obj.video !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(obj.video)) {
    errors.push('video field must match /^[a-z0-9][a-z0-9-]*$/');
  }

  if (typeof obj.channel !== 'string' || obj.channel.length === 0) {
    errors.push('channel field must be a non-empty string');
  }

  if (!Number.isInteger(obj.version) || obj.version < 1) {
    errors.push('top-level version must be an integer >= 1');
  }

  const validStages = ["generated", "verified", "polished", "tts", "locked", "recorded", "qc-passed"];
  if (!validStages.includes(obj.stage)) {
    errors.push(`stage must be one of: ${validStages.join(' | ')}`);
  }

  if (!Array.isArray(obj.sections) || obj.sections.length < 3) {
    errors.push('sections must be an array of length >= 3');
  } else {
    let hasDemo = false;
    for (let i = 0; i < obj.sections.length; i++) {
      const section = obj.sections[i];
      const expectedId = `s${String(i + 1).padStart(2, '0')}`;
      if (section.id !== expectedId) {
        errors.push(`section at index ${i} has non-sequential id "${section.id}", expected "${expectedId}"`);
      }

      const sid = section.id || `index ${i}`;

      if (section.demo === true) {
        hasDemo = true;
      } else if (typeof section.demo !== 'boolean') {
        errors.push(`${sid}: demo must be boolean`);
      }

      if (!section.display_text || typeof section.display_text !== 'string') {
        errors.push(`${sid}: display_text must be non-empty string`);
      } else {
        const words = stripFlags(section.display_text).split(/\s+/).filter(Boolean);
        if (words.length < 8 || words.length > 320) {
          errors.push(`${sid}: display_text word count is ${words.length}, must be between 8 and 320`);
        } else if (words.length < 45 || words.length > 170) {
          warnings.push(`${sid}: display_text word count is ${words.length}, warning outside 45-170`);
        }
      }

      if (typeof section.spoken_text !== 'string') {
        errors.push(`${sid}: spoken_text must be string`);
      } else if (section.spoken_text !== '') {
        if (/\[(VERIFY|FILL):/.test(section.spoken_text)) {
          errors.push(`${sid}: non-empty spoken_text must contain no [VERIFY: / [FILL: markers`);
        }
      }

      if (!Array.isArray(section.flags)) {
        errors.push(`${sid}: flags must be an array`);
      } else {
        const inlineFlags = section.display_text ? scanFlags(section.display_text) : [];
        const inlineCounts = {};
        for (const f of inlineFlags) {
          const key = `${f.kind}:${f.note}`;
          inlineCounts[key] = (inlineCounts[key] || 0) + 1;
        }
        const declaredCounts = {};
        for (const f of section.flags) {
          if (typeof f !== 'object' || !f) {
            errors.push(`${sid}: invalid flag object`);
            continue;
          }
          if (f.kind !== 'VERIFY' && f.kind !== 'FILL') {
            errors.push(`${sid}: invalid flag kind "${f.kind}"`);
          }
          if (typeof f.note !== 'string' || f.note === '') {
            errors.push(`${sid}: flag note must be non-empty string`);
          }
          const key = `${f.kind}:${f.note}`;
          declaredCounts[key] = (declaredCounts[key] || 0) + 1;
        }

        const allKeys = new Set([...Object.keys(inlineCounts), ...Object.keys(declaredCounts)]);
        for (const key of allKeys) {
          const ic = inlineCounts[key] || 0;
          const dc = declaredCounts[key] || 0;
          if (ic > dc) {
            errors.push(`${sid}: inline marker ${key} has no flags[] entry`);
          } else if (dc > ic) {
            errors.push(`${sid}: flags[] entry ${key} has no inline marker`);
          }
        }
      }

      if (typeof section.notes !== 'string') {
        errors.push(`${sid}: notes must be string`);
      }

      if (!Number.isInteger(section.version) || section.version < 1) {
        errors.push(`${sid}: section version must be integer >= 1`);
      }

      if (!section.tts) {
        errors.push(`${sid}: tts must be an object`);
      } else {
        if (!Number.isInteger(section.tts.regens_used) || section.tts.regens_used < 0) {
          errors.push(`${sid}: tts.regens_used must be integer >= 0`);
        }
        if (typeof section.tts.locked !== 'boolean') {
          errors.push(`${sid}: tts.locked must be boolean`);
        }
        if (section.tts.take !== null && typeof section.tts.take !== 'string') {
          errors.push(`${sid}: tts.take must be string or null`);
        }
      }

      if (!section.recording || !section.recording.status) {
        errors.push(`${sid}: recording.status is missing`);
      } else {
        const rs = section.recording.status;
        if (section.demo === false && rs !== 'none') {
          errors.push(`${sid}: non-demo section has recording.status "${rs}"`);
        } else if (section.demo === true && rs === 'none') {
          errors.push(`${sid}: demo section has recording.status "none"`);
        } else if (section.demo === true && !["pending", "received", "qc-passed", "re-record"].includes(rs)) {
          errors.push(`${sid}: demo section has invalid recording.status "${rs}"`);
        }
      }

      if (stage === 'polished') {
        if (section.flags && section.flags.length > 0) {
          errors.push(`${sid}: polished stage forbids flags`);
        } else {
           const inline = section.display_text ? scanFlags(section.display_text) : [];
           if (inline.length > 0) {
             errors.push(`${sid}: polished stage forbids flags`);
           }
        }
        if (section.spoken_text === '') {
          errors.push(`${sid}: polished stage requires non-empty spoken_text`);
        }
      }
    }

    if (!hasDemo) {
      errors.push('At least one section must have demo: true');
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
