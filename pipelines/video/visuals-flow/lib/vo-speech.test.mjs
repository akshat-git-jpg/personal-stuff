import test from 'node:test';
import assert from 'node:assert';
import {
  parseSilences, speechFromSilences, probeVoSpeech, lastSpeechEnd,
  SILENCE_NOISE_DB, SILENCE_MIN,
} from './vo-speech.mjs';

// Verbatim ffmpeg output, captured 2026-08-22 from
// videos/opusclip-vs-submagic/vo.mp3 with the module's own thresholds. The tail
// is the whole reason this module exists: the transcript put "Goodbye." at
// 1074.31-1074.83, but acoustically it runs 1074.889-1075.377, so span s10
// (which resolved to end at 1074.83) never had the word in its slice.
const REAL_TAIL = `
[Parsed_silencedetect_0 @ 0x9cac08e40] silence_start: 0
[Parsed_silencedetect_0 @ 0x9cac08e40] silence_end: 0.921312 | silence_duration: 0.921312
[Parsed_silencedetect_0 @ 0x9cac08e40] silence_start: 1074.647792
[Parsed_silencedetect_0 @ 0x9cac08e40] silence_end: 1074.889271 | silence_duration: 0.241479
[Parsed_silencedetect_0 @ 0x9cac08e40] silence_start: 1075.377396
[Parsed_silencedetect_0 @ 0x9cac08e40] silence_end: 1076.352 | silence_duration: 0.974604
`;

test('parseSilences pairs start/end lines in order', () => {
  const s = parseSilences(REAL_TAIL);
  assert.deepStrictEqual(s, [
    { start: 0, end: 0.921312 },
    { start: 1074.647792, end: 1074.889271 },
    { start: 1075.377396, end: 1076.352 },
  ]);
});

test('parseSilences ignores unrelated ffmpeg chatter', () => {
  assert.deepStrictEqual(parseSilences('Duration: 00:17:56.35, start: 0.023021\nfoo\n'), []);
});

// A silence_start with no closing silence_end happens when the file ends mid
// silence and ffmpeg is killed; treat it as running to the end rather than
// dropping it, or the tail check would see speech that is not there.
test('parseSilences closes a dangling silence_start at Infinity', () => {
  const s = parseSilences('silence_start: 12.5\n');
  assert.deepStrictEqual(s, [{ start: 12.5, end: Infinity }]);
});

test('speechFromSilences returns the complement inside [0, duration]', () => {
  const speech = speechFromSilences(parseSilences(REAL_TAIL), 1076.352);
  assert.deepStrictEqual(speech, [
    { start: 0.921312, end: 1074.647792 },
    { start: 1074.889271, end: 1075.377396 },
  ]);
});

test('speechFromSilences handles no silence at all', () => {
  assert.deepStrictEqual(speechFromSilences([], 10), [{ start: 0, end: 10 }]);
});

test('speechFromSilences handles wall-to-wall silence', () => {
  assert.deepStrictEqual(speechFromSilences([{ start: 0, end: 10 }], 10), []);
});

// Zero-length slivers would otherwise show up as speech intervals of 0s and
// make lastSpeechEnd report a boundary where nothing is spoken.
test('speechFromSilences drops zero-length gaps', () => {
  const speech = speechFromSilences([{ start: 0, end: 5 }, { start: 5, end: 10 }], 10);
  assert.deepStrictEqual(speech, []);
});

test('lastSpeechEnd is the end of the final speech interval, not the file duration', () => {
  const vo = { duration: 1076.352, speech: speechFromSilences(parseSilences(REAL_TAIL), 1076.352) };
  assert.strictEqual(lastSpeechEnd(vo), 1075.377396);
});

test('lastSpeechEnd is null when there is no speech', () => {
  assert.strictEqual(lastSpeechEnd({ duration: 5, speech: [] }), null);
});

test('probeVoSpeech shells out with the documented thresholds and parses the result', () => {
  const calls = [];
  const vo = probeVoSpeech('/tmp/vo.mp3', {
    run: (bin, args) => {
      calls.push({ bin, args });
      return { status: 0, stderr: `${REAL_TAIL}\n  Duration: 00:17:56.35, start: 0.02, bitrate: 124 kb/s\n` };
    },
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].bin, 'ffmpeg');
  assert.ok(calls[0].args.includes('/tmp/vo.mp3'));
  assert.ok(
    calls[0].args.some((a) => a === `silencedetect=noise=${SILENCE_NOISE_DB}dB:d=${SILENCE_MIN}`),
    `expected the silencedetect filter in ${JSON.stringify(calls[0].args)}`,
  );
  // Duration comes from ffmpeg's own header line, so the complement is bounded
  // by the real file length and not by the last silence.
  assert.strictEqual(vo.duration, 1076.35);
  assert.strictEqual(lastSpeechEnd(vo), 1075.377396);
});

test('probeVoSpeech throws when ffmpeg fails, rather than reporting no speech', () => {
  assert.throws(
    () => probeVoSpeech('/tmp/nope.mp3', { run: () => ({ status: 1, stderr: 'No such file' }) }),
    /vo-speech probe failed/,
  );
});
