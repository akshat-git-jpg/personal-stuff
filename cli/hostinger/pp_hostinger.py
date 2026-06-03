"""pp-hostinger — agent-native CLI for the Hostinger API.

Replaces the 118-tool hostinger-api-mcp (which cost ~18k context tokens per
session) with curated commands over the same REST API, plus a raw `api`
escape hatch covering every endpoint. Auth: Bearer API_TOKEN sourced from
mcp/hostinger/.env (same token the MCP used). Stdlib only — no deps.

Subcommands:
  domains check NAME [--tlds com,net,...] [--alternatives]
  domains list                              portfolio
  vps list                                  all virtual machines
  vps info VM_ID
  vps metrics VM_ID [--hours N]
  vps start|stop|restart VM_ID
  firewall list
  firewall info FIREWALL_ID
  firewall add-rule FIREWALL_ID --protocol TCP --port 443 [--source any|custom --source-detail IP]
  firewall sync FIREWALL_ID VM_ID
  snapshot get|create|restore VM_ID         (create OVERWRITES the existing snapshot)
  dns list DOMAIN
  dns update DOMAIN --records JSON|@file [--overwrite]
  api METHOD /api/PATH [--body JSON|@file]  raw escape hatch (any endpoint)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:  # macOS framework python ships without root certs; certifi fixes that
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()

BASE_URL = os.environ.get("API_BASE_URL", "https://developers.hostinger.com")
ENV_FILE = Path(__file__).resolve().parent.parent.parent / "mcp" / "hostinger" / ".env"


def _token() -> str:
    tok = os.environ.get("API_TOKEN")
    if tok:
        return tok
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line.startswith("API_TOKEN="):
                return line.split("=", 1)[1].strip().strip("'\"")
    raise ValueError(f"API_TOKEN not set and not found in {ENV_FILE}")


def _request(method: str, path: str, body: dict | list | None = None) -> object:
    if not path.startswith("/"):
        path = "/" + path
    req = urllib.request.Request(
        BASE_URL + path,
        method=method.upper(),
        headers={
            "Authorization": f"Bearer {_token()}",
            "Content-Type": "application/json",
            "User-Agent": "pp-hostinger/1.0",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise ValueError(f"HTTP {e.code} on {method} {path}: {detail[:500]}") from None
    if not raw:
        return {"status": "ok"}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _dump(data: object) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


def _parse_json_arg(raw: str) -> object:
    if raw.startswith("@"):
        raw = Path(raw[1:]).read_text()
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_domains_check(args) -> str:
    body = {"domain": args.name, "tlds": args.tlds.split(",")}
    if args.alternatives:
        body["with_alternatives"] = True
    out = _request("POST", "/api/domains/v1/availability", body)
    lines = []
    for item in out if isinstance(out, list) else out.get("data", []):
        mark = "AVAILABLE" if item.get("is_available") else "taken"
        lines.append(f"{item.get('domain'):40} {mark}")
    return "\n".join(lines) or _dump(out)


def cmd_domains_list(args) -> str:
    return _dump(_request("GET", "/api/domains/v1/portfolio"))


def cmd_vps_list(args) -> str:
    out = _request("GET", "/api/vps/v1/virtual-machines")
    lines = []
    for vm in out if isinstance(out, list) else []:
        ip = (vm.get("ipv4") or [{}])[0].get("address", "?")
        lines.append(f"{vm.get('id')}\t{vm.get('hostname')}\t{vm.get('state')}\t{ip}\t{vm.get('plan')}")
    return "\n".join(lines) or _dump(out)


def cmd_vps_info(args) -> str:
    return _dump(_request("GET", f"/api/vps/v1/virtual-machines/{args.vm_id}"))


def cmd_vps_metrics(args) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    frm = now - dt.timedelta(hours=args.hours)
    path = (
        f"/api/vps/v1/virtual-machines/{args.vm_id}/metrics"
        f"?date_from={frm.strftime('%Y-%m-%dT%H:%M:%SZ')}&date_to={now.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )
    return _dump(_request("GET", path))


def _vps_action(args, action: str) -> str:
    return _dump(_request("POST", f"/api/vps/v1/virtual-machines/{args.vm_id}/{action}"))


def cmd_firewall_list(args) -> str:
    return _dump(_request("GET", "/api/vps/v1/firewall"))


def cmd_firewall_info(args) -> str:
    return _dump(_request("GET", f"/api/vps/v1/firewall/{args.firewall_id}"))


def cmd_firewall_add_rule(args) -> str:
    body = {
        "protocol": args.protocol.upper(),
        "port": args.port,
        "source": args.source,
        "source_detail": args.source_detail,
        "action": "accept",
    }
    return _dump(_request("POST", f"/api/vps/v1/firewall/{args.firewall_id}/rules", body))


def cmd_firewall_sync(args) -> str:
    return _dump(_request("POST", f"/api/vps/v1/firewall/{args.firewall_id}/sync/{args.vm_id}"))


def cmd_snapshot(args) -> str:
    path = f"/api/vps/v1/virtual-machines/{args.vm_id}/snapshot"
    if args.action == "get":
        return _dump(_request("GET", path))
    if args.action == "create":
        return _dump(_request("POST", path))
    return _dump(_request("POST", path + "/restore"))


def cmd_dns_list(args) -> str:
    return _dump(_request("GET", f"/api/dns/v1/zones/{args.domain}"))


def cmd_dns_update(args) -> str:
    records = _parse_json_arg(args.records)
    body = {"zone": records, "overwrite": args.overwrite}
    return _dump(_request("PUT", f"/api/dns/v1/zones/{args.domain}", body))


def cmd_api(args) -> str:
    body = _parse_json_arg(args.body) if args.body else None
    return _dump(_request(args.method, args.path, body))


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pp-hostinger",
        description="Agent-native Hostinger API CLI (Bearer token from mcp/hostinger/.env).",
    )
    sub = p.add_subparsers(dest="command", required=True)

    # domains
    dom = sub.add_parser("domains", help="Domain availability and portfolio.")
    dsub = dom.add_subparsers(dest="sub", required=True)
    dc = dsub.add_parser("check", help="Check availability (rate limit: 10/min).")
    dc.add_argument("name", help="Domain name without TLD, e.g. 'bridebestie'")
    dc.add_argument("--tlds", default="com", help="Comma-separated TLDs without dots (default: com)")
    dc.add_argument("--alternatives", action="store_true", help="Suggest alternatives (single TLD only)")
    dc.set_defaults(func=cmd_domains_check)
    dl = dsub.add_parser("list", help="List owned domains (portfolio).")
    dl.set_defaults(func=cmd_domains_list)

    # vps
    vps = sub.add_parser("vps", help="Virtual machine state, metrics, power actions.")
    vsub = vps.add_subparsers(dest="sub", required=True)
    vl = vsub.add_parser("list", help="List all VMs (id, hostname, state, ip, plan).")
    vl.set_defaults(func=cmd_vps_list)
    vi = vsub.add_parser("info", help="Full details of one VM.")
    vi.add_argument("vm_id")
    vi.set_defaults(func=cmd_vps_info)
    vm_ = vsub.add_parser("metrics", help="CPU/RAM/disk/network metrics.")
    vm_.add_argument("vm_id")
    vm_.add_argument("--hours", type=int, default=24, help="Lookback window (default 24h)")
    vm_.set_defaults(func=cmd_vps_metrics)
    for action in ("start", "stop", "restart"):
        va = vsub.add_parser(action, help=f"{action.capitalize()} a VM.")
        va.add_argument("vm_id")
        va.set_defaults(func=lambda a, _act=action: _vps_action(a, _act))

    # firewall
    fw = sub.add_parser("firewall", help="VPS firewall management.")
    fsub = fw.add_subparsers(dest="sub", required=True)
    fl = fsub.add_parser("list", help="List firewalls.")
    fl.set_defaults(func=cmd_firewall_list)
    fi = fsub.add_parser("info", help="Firewall details incl. rules.")
    fi.add_argument("firewall_id")
    fi.set_defaults(func=cmd_firewall_info)
    fa = fsub.add_parser("add-rule", help="Add an accept rule.")
    fa.add_argument("firewall_id")
    fa.add_argument("--protocol", required=True, help="TCP, UDP, ICMP, SSH, HTTP, ...")
    fa.add_argument("--port", required=True, help="Port or range, e.g. '443' or '1024:2048'")
    fa.add_argument("--source", default="any", choices=["any", "custom"])
    fa.add_argument("--source-detail", default="any", help="IP/CIDR when --source custom")
    fa.set_defaults(func=cmd_firewall_add_rule)
    fs = fsub.add_parser("sync", help="Apply firewall to a VM.")
    fs.add_argument("firewall_id")
    fs.add_argument("vm_id")
    fs.set_defaults(func=cmd_firewall_sync)

    # snapshot
    sn = sub.add_parser("snapshot", help="VM snapshot (one per VM; create OVERWRITES it).")
    sn.add_argument("action", choices=["get", "create", "restore"])
    sn.add_argument("vm_id")
    sn.set_defaults(func=cmd_snapshot)

    # dns
    dns = sub.add_parser("dns", help="DNS zone records.")
    nsub = dns.add_subparsers(dest="sub", required=True)
    nl = nsub.add_parser("list", help="List records for a domain.")
    nl.add_argument("domain")
    nl.set_defaults(func=cmd_dns_list)
    nu = nsub.add_parser("update", help="Update records (JSON zone array).")
    nu.add_argument("domain")
    nu.add_argument("--records", required=True, help="JSON zone records array (or @file)")
    nu.add_argument("--overwrite", action="store_true", help="Replace instead of merge")
    nu.set_defaults(func=cmd_dns_update)

    # raw escape hatch
    api = sub.add_parser("api", help="Raw API call — covers every endpoint the MCP had.")
    api.add_argument("method", choices=["GET", "POST", "PUT", "DELETE", "PATCH"],
                     help="Writes (POST/PUT/DELETE/PATCH) are sent as-is; double-check the path.")
    api.add_argument("path", help="e.g. /api/vps/v1/virtual-machines")
    api.add_argument("--body", help="JSON body (or @file)")
    api.set_defaults(func=cmd_api)

    return p


def main() -> int:
    args = build_parser().parse_args()
    try:
        print(args.func(args))
        return 0
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Network error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
