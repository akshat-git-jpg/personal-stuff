#!/usr/bin/env python3
"""Parse an Argo workflow JSON (live get or archived get) from stdin.

Default: print the workflow phase/message + a one-line summary per Pod node.
--failed-pods: print `<nodeId>\t<logArtifactName>\t<displayName>` for each FAILED
               Pod node (consumed by argo-logs.sh to fetch log artifacts).
"""
import sys, json

failed_only = "--failed-pods" in sys.argv

try:
    d = json.load(sys.stdin)
except Exception as e:  # noqa: BLE001
    print(f"(could not parse workflow JSON: {e})", file=sys.stderr)
    sys.exit(1)

st = d.get("status", {}) or {}
nodes = st.get("nodes", {}) or {}

if not failed_only:
    print(f"phase: {st.get('phase')}  |  message: {st.get('message')}")

for nid, n in nodes.items():
    if n.get("type") != "Pod":
        continue
    phase = n.get("phase")
    disp = n.get("displayName")
    msg = n.get("message")
    if failed_only:
        if phase != "Failed":
            continue
        arts = [a.get("name") for a in ((n.get("outputs") or {}).get("artifacts") or [])]
        art = "main-logs" if "main-logs" in arts else (arts[0] if arts else "main-logs")
        print(f"{n.get('id')}\t{art}\t{disp}")
    else:
        print(f"  {phase:<10} {disp:<30} id={n.get('id')}  msg={msg}")
