import sys, argparse, pathlib, subprocess

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("step_folder")
    parser.add_argument("--base")
    args = parser.parse_args()
    
    rulebook_path = pathlib.Path(args.step_folder) / "rulebook.md"
    if not rulebook_path.exists():
        sys.exit(f"✖ missing rulebook: {rulebook_path}")
        
    with open(rulebook_path) as f:
        content = f.read()
        
    if args.base:
        content = content.replace("<base>", args.base)
        
    p = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
    p.communicate(input=content.encode("utf-8"))
    
    print("pasted prompt ready for Antigravity")

if __name__ == "__main__":
    main()
