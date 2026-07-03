"""Convenience wrapper: extract.py then aggregate.py end-to-end.

Run:
  python keyword-research/run.py                    # 3 videos per channel, full pipeline
  python keyword-research/run.py --limit 5
"""

import argparse
import subprocess
import sys

SCRIPT_DIR = __import__("os").path.dirname(__import__("os").path.abspath(__file__))


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--limit", type=int, default=3)
    p.add_argument("--channels", default=None)
    return p.parse_args()


def main():
    args = parse_args()

    extract_cmd = [sys.executable, f"{SCRIPT_DIR}/extract.py", "--limit", str(args.limit)]
    if args.channels:
        extract_cmd.extend(["--channels", args.channels])
    print(f">>> {' '.join(extract_cmd)}")
    rc = subprocess.call(extract_cmd)
    if rc != 0:
        print(f"extract.py exited with {rc}; aborting.", file=sys.stderr)
        sys.exit(rc)

    aggregate_cmd = [sys.executable, f"{SCRIPT_DIR}/aggregate.py"]
    print(f"\n>>> {' '.join(aggregate_cmd)}")
    rc = subprocess.call(aggregate_cmd)
    sys.exit(rc)


if __name__ == "__main__":
    main()
