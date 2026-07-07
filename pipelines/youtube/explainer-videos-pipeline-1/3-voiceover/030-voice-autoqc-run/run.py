#!/usr/bin/env python3
"""105 voice-autoqc: flag bad TTS chunks so the human gate only listens to flags.

In:  ../010-synthesize-voice-run/output/<base>.work/{clips/*.wav, chunks.json}
Out: ./output/<base>.voice-qc.json  {id: {"verdict": "pass"|"flag", "reasons": [...]}}

Checks (all deterministic, thresholds below):
  1. WER: re-transcribe each clip via lib.asr (Groq whisper), compare to the chunk's
     script text after normalization (lowercase, strip punctuation, numbers spelled out).
     Flag when WER > WER_FLAG.
  2. Loudness: mean dBFS per clip vs median of all clips. Flag when > LOUD_DB_DELTA away,
     or when clipping (peak >= 0 dBFS).
  3. Pace: words / duration outside PACE_BAND (words per second).
"""
import sys, os, json, argparse, re, subprocess, pathlib
from statistics import median

# Add lib to path
STEP_DIR = pathlib.Path(__file__).resolve().parent
PIPELINE_ROOT = STEP_DIR.parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))
import lib.asr as asr
import lib.audio as audio

WER_FLAG = 0.18
LOUD_DB_DELTA = 6.0
PACE_BAND = (1.8, 3.6)
CLIP_PEAK_COUNT = 50  # samples at full scale before we call it clipping

def levenshtein(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1): dp[i][0] = i
    for j in range(len(b) + 1): dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[len(a)][len(b)]

def normalize(text):
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    num_map = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
    for d, w in num_map.items():
        text = text.replace(d, w)
    return text.split()

def get_loudness(wav_path):
    res = subprocess.run(["ffmpeg", "-i", str(wav_path), "-af", "volumedetect,astats=metadata=0", "-f", "null", "-"], capture_output=True, text=True)
    mean_db = peak_db = 0.0
    peak_count = 0
    for line in res.stderr.splitlines():
        if "mean_volume:" in line:
            mean_db = float(line.split("mean_volume:")[1].replace("dB", "").strip())
        if "max_volume:" in line:
            peak_db = float(line.split("max_volume:")[1].replace("dB", "").strip())
        # astats Overall block: how many samples sit at the peak value.
        # Normalized TTS touches full scale a handful of times; true clipping
        # slams into it repeatedly.
        if "Peak count:" in line:
            try:
                peak_count = max(peak_count, int(float(line.split("Peak count:")[1].strip())))
            except ValueError:
                pass
    return mean_db, peak_db, peak_count

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--skip-wer", action="store_true")
    args = parser.parse_args()

    work_dir = PIPELINE_ROOT / "3-voiceover" / "010-synthesize-voice-run" / "output" / f"{args.base}.work"
    chunks_file = work_dir / "chunks.json"
    clips_dir = work_dir / "clips"
    out_dir = STEP_DIR / "output"
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / f"{args.base}.voice-qc.json"

    if not chunks_file.exists():
        sys.exit(f"✖ missing chunks: {chunks_file}")

    with open(chunks_file) as f:
        chunks = json.load(f)

    results = {}
    mean_dbs = {}
    
    for c in chunks:
        cid = c["id"]
        wav_path = clips_dir / f"{cid}.wav"
        if not wav_path.exists(): continue
        
        dur = audio.dur(wav_path)
        mean_db, peak_db, peak_count = get_loudness(wav_path)
        mean_dbs[cid] = mean_db

        c["_dur"] = dur
        c["_mean_db"] = mean_db
        c["_peak_db"] = peak_db
        c["_peak_count"] = peak_count
        c["_wav"] = wav_path
        
    if not mean_dbs:
        sys.exit("✖ no clips found")

    med_db = median(mean_dbs.values())

    pass_count = flag_count = 0

    print(f"Running QC on {args.base} ({len(chunks)} chunks)...")
    if args.skip_wer:
        print("(Skipping WER check)")

    for c in chunks:
        cid = c["id"]
        if "_wav" not in c:
            results[cid] = {"verdict": "flag", "reasons": ["clip missing / synthesis failed"]}
            flag_count += 1
            continue
        
        reasons = []
        
        if not args.skip_wer:
            try:
                transcript = asr.groq_transcribe(c["_wav"]).get("text", "")
                ref_words = normalize(c["text"])
                hyp_words = normalize(transcript)
                if not ref_words:
                    wer = 0.0
                else:
                    wer = levenshtein(ref_words, hyp_words) / len(ref_words)
                if wer > WER_FLAG:
                    reasons.append(f"WER {wer:.2f} > {WER_FLAG}")
            except Exception as e:
                reasons.append(f"WER check failed: {e}")
        
        mean_db, peak_db = c["_mean_db"], c["_peak_db"]
        if abs(mean_db - med_db) > LOUD_DB_DELTA:
            reasons.append(f"Mean loudness {mean_db:.1f} dB is > {LOUD_DB_DELTA}dB from median {med_db:.1f} dB")
        # Normalized TTS peaks at full scale by design; that alone is not
        # clipping. Flag only when many samples pile up at the peak.
        if peak_db >= -0.05 and c["_peak_count"] >= CLIP_PEAK_COUNT:
            reasons.append(f"Clipping detected (peak {peak_db:.1f} dB hit {c['_peak_count']} times)")
            
        dur = c["_dur"]
        words = len(normalize(c["text"]))
        pace = words / dur if dur > 0 else 0
        if not (PACE_BAND[0] <= pace <= PACE_BAND[1]):
            reasons.append(f"Pace {pace:.1f} wps outside band {PACE_BAND}")
            
        verdict = "flag" if reasons else "pass"
        if verdict == "pass":
            pass_count += 1
        else:
            flag_count += 1
            
        results[cid] = {"verdict": verdict, "reasons": reasons}
        
    if len(results) != len(chunks):
        missing = [c["id"] for c in chunks if c["id"] not in results]
        sys.exit(f"✖ QC bug: {len(results)} results for {len(chunks)} chunks; unaccounted: {missing}")

    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"\nQC complete. Pass: {pass_count}, Flag: {flag_count}")
    for cid, data in results.items():
        if data["verdict"] == "flag":
            print(f"  {cid}: {', '.join(data['reasons'])}")

if __name__ == "__main__":
    main()
