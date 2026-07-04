"""Shared orchestration for step 150's two entrypoints (run-a4.py, run-a3.py).

Each entrypoint calls main("a4") / main("a3"). The clips are already render-ready (A4 per block
from step 080, A3 corner parts from step 090), so this does NO chunking — it just SUBMITS (no
polling). Downloading the finished renders is step 160. Anti-ban pacing + usage checks apply.
"""
import sys, json, argparse, pathlib

HERE = pathlib.Path(__file__).resolve().parent              # steps/150-submit-avatar-videos-run/
ROOT = HERE.parents[1]                                       # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import heygen, audio                                # noqa: E402
from shared import heygen_config as C                        # noqa: E402

OUT = HERE / "output"
SYNTH_OUT = ROOT / "steps/080-synthesize-voice-run/output"
A4_AUDIO = SYNTH_OUT / "avatar-audio"
A3_PARTS = ROOT / "steps/090-plan-corner-render-parts-run/output/corner-parts"


def die(m): raise SystemExit("✖ " + m)


def infer_base(arg):
    if arg:
        return arg
    cands = sorted(SYNTH_OUT.glob("*.voice.wav"))
    if not cands:
        die(f"can't infer <base> — run synth (step 080) first ({SYNTH_OUT})")
    return cands[0].name.split(".voice.wav")[0]


def jobs_for_flow(flow, base):
    """One job per pre-made clip. a4 → step 080 per-block audio; a3 → step 090 corner parts."""
    fcfg = C.FLOWS[flow]
    src = A4_AUDIO if flow == "a4" else A3_PARTS
    if not src.exists():
        print(f"   (no audio at {src} — run {'step 080 (avatar mode)' if flow=='a4' else 'step 090'} first)")
        return []
    jobs = []
    for wav in sorted(src.glob("*.wav")):
        # a4 clips are named <seg>.wav → prefix; a3 parts already <base>__a3__corner...
        name = f"{base}__a4__{wav.stem}" if flow == "a4" else wav.stem
        jobs.append({"flow": flow, "name": name, "audio": str(wav),
                     "avatar_id": fcfg["avatar_id"], "status": "pending",
                     "video_id": None, "file": None})
    return jobs


def load_manifest(p, base):
    return json.loads(p.read_text()) if p.exists() else {"base": base, "jobs": []}


def save_manifest(p, man):
    p.write_text(json.dumps(man, ensure_ascii=False, indent=2))


def generate(flow, base, man, manifest_path, usage_log):
    fcfg = C.FLOWS[flow]
    print(f"=== flow {flow} ({fcfg['label']}) · backend={fcfg['backend']} ===")
    if "REPLACE_WITH" in fcfg["avatar_id"]:
        print(f"   ⚠ avatar_id not set for {flow} (edit shared/heygen_config.py) — submitting as stub")
    backend = heygen.get_backend(fcfg["backend"], fcfg, ROOT)
    have = {j["name"] for j in man["jobs"]}
    new = [j for j in jobs_for_flow(flow, base) if j["name"] not in have]
    man["jobs"].extend(new)
    print(f"   {len(new)} job(s) to submit")

    heygen.usage_snapshot(C.USAGE, usage_log, f"{flow} before")
    submitted, cap = 0, C.PACING.get("max_per_run", 0)
    for j in heygen.maybe_jitter(new, C.PACING):
        if cap and submitted >= cap:
            print(f"   per-run cap ({cap}) reached — rest stay 'pending' for next run")
            break
        if submitted:
            heygen.human_delay(C.PACING, submitted)
        print(f"   → submit {j['name']}  ({audio.mmss(audio.dur(j['audio']))})")
        try:
            res = backend.submit(j["audio"], j["avatar_id"], j["name"])
            j.update(video_id=res.get("video_id"), status=res.get("status", "submitted"))
        except NotImplementedError as e:
            j["status"] = "stub-not-wired"
            print(f"     [stub] {e}")
        submitted += 1
        save_manifest(manifest_path, man)
    heygen.usage_diff(C.USAGE, usage_log, f"{flow} after", C.USAGE["expect"].get(flow))
    save_manifest(manifest_path, man)
    real = sum(1 for j in man["jobs"] if j["flow"] == flow and j["status"] == "submitted")
    print(f"✓ {flow}: {submitted} submitted this run ({real} real). No polling.")
    print(f"  manifest: {manifest_path}")
    print("  → check HeyGen yourself; when renders finish, download in step 160")


def main(flow):
    ap = argparse.ArgumentParser(description=f"HeyGen {flow} flow — submit (no polling)")
    ap.add_argument("base", nargs="?", help="video name (default: inferred from step 080 output)")
    a = ap.parse_args()

    base = infer_base(a.base)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / f"{base}.heygen-manifest.json"
    usage_log = OUT / f"{base}.usage-log.md"
    man = load_manifest(manifest_path, base)
    print(f"video: {base} · flow: {flow} · submit (no polling)")
    generate(flow, base, man, manifest_path, usage_log)
