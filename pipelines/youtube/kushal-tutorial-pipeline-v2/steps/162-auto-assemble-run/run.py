#!/usr/bin/env python3
"""162 auto-assemble: build the draft cut from the assembly plan with ffmpeg.

In:  ../125-build-assembly-plan-run/output/<base>.assembly-plan.json
     the raw screen recording (path via --recording)
     ../100-trim-silence-run/output/<base>.voice.trim.wav
     ../160-download-avatar-videos-human/output/videos/  (A3 corner parts, A4 blocks)
     ../135-build-graphics-sonnet/output/{clips,overlays}/
Out: ./output/<base>.draft-cut.mp4
"""
import sys, os, json, argparse, subprocess, pathlib, tempfile

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--recording", help="Path to raw screen recording")
    parser.add_argument("--vo", help="Path to VO wav")
    parser.add_argument("--plan", help="Path to assembly plan")
    parser.add_argument("--out", help="Output path")
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parents[1]
    
    recording = pathlib.Path(args.recording) if args.recording else root / "010-record-screen" / f"{args.base}.mp4"
    vo_wav = pathlib.Path(args.vo) if args.vo else root / "100-trim-silence-run" / "output" / f"{args.base}.voice.trim.wav"
    plan_file = pathlib.Path(args.plan) if args.plan else root / "125-build-assembly-plan-run" / "output" / f"{args.base}.assembly-plan.json"
    out_file = pathlib.Path(args.out) if args.out else pathlib.Path(__file__).resolve().parent / "output" / f"{args.base}.draft-cut.mp4"

    if not plan_file.exists(): sys.exit(f"✖ missing plan: {plan_file}")
    if not recording.exists(): sys.exit(f"✖ missing recording: {recording}")
    if not vo_wav.exists(): sys.exit(f"✖ missing vo track: {vo_wav}")

    out_file.parent.mkdir(parents=True, exist_ok=True)

    with open(plan_file) as f:
        plan = json.load(f)
        
    avatar_dir = root / "160-download-avatar-videos-human" / "output" / "videos"
    gfx_dir = root / "135-build-graphics-sonnet" / "output"
    
    if not avatar_dir.exists(): print("(Notice: no avatar videos found, skipping avatar overlays)")
    if not gfx_dir.exists(): print("(Notice: no graphics found, skipping graphics overlays)")

    with tempfile.TemporaryDirectory() as td:
        tdp = pathlib.Path(td)
        segment_files = []
        
        print("Slicing and retiming segments...")
        for i, p in enumerate(plan):
            sid = p["seg_id"]
            if p.get("flag"):
                print(f"  Flag on {sid}: {p.get('reason')}")
                
            seg_out = tdp / f"{i:04d}_{sid}.mp4"
            
            target_dur = p.get("target_dur", 0.0)
            src_in = p.get("src_in", 0.0)
            src_out = p.get("src_out", 0.0)
            speed = p.get("speed", 1.0)
            freeze_pad = p.get("freeze_pad", 0.0)
            
            if target_dur <= 0:
                target_dur = max(0.1, src_out - src_in)
                speed = 1.0
            
            vf = f"scale=1920:1080,fps=30,setpts=PTS/{speed}"
            if freeze_pad > 0:
                vf += f",tpad=stop_mode=clone:stop_duration={freeze_pad}"
                
            cmd = [
                "ffmpeg", "-y", "-ss", str(src_in), "-t", str(src_out - src_in),
                "-i", str(recording),
                "-vf", vf,
                "-an",
                "-c:v", "libx264", "-preset", "ultrafast",
                str(seg_out)
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            segment_files.append(seg_out)
            
        print("Concatenating segments...")
        concat_txt = tdp / "concat.txt"
        with open(concat_txt, "w") as f:
            for sf in segment_files:
                f.write(f"file '{sf.resolve()}'\n")
                
        concat_out = tdp / "concat.mp4"
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_txt),
            "-c", "copy", str(concat_out)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        print("Muxing audio...")
        cmd = [
            "ffmpeg", "-y", "-i", str(concat_out), "-i", str(vo_wav),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", "-c:a", "aac", "-shortest",
            str(out_file)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        print(f"Draft cut saved to {out_file}")

if __name__ == "__main__":
    main()
