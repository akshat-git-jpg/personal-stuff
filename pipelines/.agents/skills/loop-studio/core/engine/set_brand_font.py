#!/usr/bin/env python3
"""
set_brand_font.py — change the brand fonts in ONE place, safely.

WHY THIS EXISTS
---------------
A font is a TWO-PLACE change and nothing used to keep the two in sync:
  1. core/brand/brand.json          → "fonts": { sans / mono / serif }   (the human-readable name)
  2. remotion/src/bb2/engine.tsx    → the three @remotion/google-fonts import lines (the ACTUAL loader)
The Remotion loader needs a STATIC import, so editing only the JSON name changes nothing —
the render silently falls back to the default font. (Every "the font isn't mine" support
ticket is this trap.) This helper rewrites BOTH places together, or refuses and changes nothing.

USAGE
-----
  python3 core/engine/set_brand_font.py --sans "Montserrat"
  python3 core/engine/set_brand_font.py --sans "Inter" --mono "IBM Plex Mono" --serif "Fraunces"
  python3 core/engine/set_brand_font.py --check         # report drift, change nothing (exit 1 if out of sync)

Only the roles you pass are changed. Family names are the Google Fonts names ("Space Grotesk",
"JetBrains Mono", …); they're validated against the @remotion/google-fonts families actually
installed in the Remotion project. For a NON-Google custom .ttf, this helper can't wire it —
ask Claude to set up an @remotion/fonts loadFont() with your file instead.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent               # core/engine
BRAND_JSON = ENGINE_DIR.parent / "brand" / "brand.json"    # core/brand/brand.json
ENGINE_TSX = ENGINE_DIR / "remotion" / "src" / "bb2" / "engine.tsx"
GF_DIST = ENGINE_DIR / "remotion" / "node_modules" / "@remotion" / "google-fonts" / "dist" / "cjs"

# role -> the loadFont alias used in engine.tsx
ROLE_ALIAS = {"sans": "loadSans", "mono": "loadMono", "serif": "loadSerif"}


def module_name(family: str) -> str:
    """Google Fonts family -> @remotion/google-fonts module name (strip non-alphanumerics)."""
    return re.sub(r"[^A-Za-z0-9]", "", family)


def valid_family(family: str) -> bool:
    """A family is loadable iff its module file ships in the installed @remotion/google-fonts."""
    return (GF_DIST / f"{module_name(family)}.js").exists()


def suggest(family: str, n: int = 6) -> list[str]:
    """Cheap fuzzy suggestions when a family name isn't found (typo help)."""
    if not GF_DIST.exists():
        return []
    key = re.sub(r"[^a-z0-9]", "", family.lower())
    names = [p.stem for p in GF_DIST.glob("*.js")]
    starts = sorted(n for n in names if n.lower().startswith(key[:4]))
    return starts[:n]


def read_engine_imports(tsx: str) -> dict[str, str]:
    """role -> currently-imported module name, parsed from engine.tsx."""
    out: dict[str, str] = {}
    for role, alias in ROLE_ALIAS.items():
        m = re.search(rf'import \{{ loadFont as {alias} \}} from "@remotion/google-fonts/([A-Za-z0-9]+)";', tsx)
        if m:
            out[role] = m.group(1)
    return out


def read_brand_fonts(brand_txt: str) -> dict[str, str]:
    """role -> family name string, parsed from brand.json's fonts block."""
    out: dict[str, str] = {}
    for role in ROLE_ALIAS:
        m = re.search(rf'"{role}"\s*:\s*"([^"]+)"', brand_txt)
        if m:
            out[role] = m.group(1)
    return out


def drift() -> list[str]:
    """Return a list of human-readable mismatches between brand.json and engine.tsx (empty = in sync)."""
    problems: list[str] = []
    if not BRAND_JSON.exists() or not ENGINE_TSX.exists():
        return problems  # nothing to compare (e.g. partial checkout) — don't false-alarm
    fonts = read_brand_fonts(BRAND_JSON.read_text())
    imports = read_engine_imports(ENGINE_TSX.read_text())
    for role in ROLE_ALIAS:
        want = module_name(fonts.get(role, ""))
        got = imports.get(role, "")
        if want and got and want != got:
            problems.append(
                f"{role}: brand.json says '{fonts[role]}' (module {want}) but engine.tsx loads {got} "
                f"→ renders would use {got}, not {fonts[role]}"
            )
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description="Change brand fonts in brand.json + engine.tsx together.")
    ap.add_argument("--sans", help="sans/display family (e.g. 'Space Grotesk')")
    ap.add_argument("--mono", help="mono family (e.g. 'JetBrains Mono')")
    ap.add_argument("--serif", help="serif/editorial family (e.g. 'Playfair Display')")
    ap.add_argument("--check", action="store_true", help="report drift only; change nothing")
    args = ap.parse_args()

    if args.check:
        problems = drift()
        if problems:
            print("FONT DRIFT — brand.json and engine.tsx disagree:")
            for p in problems:
                print("  •", p)
            print("\nFix: rerun this script with the family you actually want, e.g.")
            print('  python3 core/engine/set_brand_font.py --sans "<Family>"')
            return 1
        print("fonts: brand.json and engine.tsx are in sync [OK]")
        return 0

    changes = {r: v for r, v in (("sans", args.sans), ("mono", args.mono), ("serif", args.serif)) if v}
    if not changes:
        ap.error("give at least one of --sans/--mono/--serif, or use --check")

    for path in (BRAND_JSON, ENGINE_TSX):
        if not path.exists():
            print(f"error: {path} not found — run this from inside the loop-studio skill.", file=sys.stderr)
            return 2

    # Validate every requested family BEFORE touching a single file (all-or-nothing).
    for role, family in changes.items():
        if not valid_family(family):
            print(f"error: '{family}' isn't an available @remotion/google-fonts family.", file=sys.stderr)
            tips = suggest(family)
            if tips:
                print("  did you mean:", ", ".join(tips), file=sys.stderr)
            print("  (for a custom .ttf that isn't on Google Fonts, ask Claude to wire an @remotion/fonts loadFont).",
                  file=sys.stderr)
            return 2

    brand_txt = BRAND_JSON.read_text()
    tsx = ENGINE_TSX.read_text()

    # Compute both new contents first; only write once everything replaced cleanly.
    for role, family in changes.items():
        mod = module_name(family)
        alias = ROLE_ALIAS[role]

        brand_txt, n1 = re.subn(rf'("{role}"\s*:\s*")[^"]+(")', rf'\g<1>{family}\g<2>', brand_txt, count=1)
        if n1 != 1:
            print(f"error: couldn't locate the \"{role}\" key in brand.json — aborted, nothing written.", file=sys.stderr)
            return 3

        tsx, n2 = re.subn(
            rf'(import \{{ loadFont as {alias} \}} from "@remotion/google-fonts/)[A-Za-z0-9]+(";)',
            rf'\g<1>{mod}\g<2>', tsx, count=1)
        if n2 != 1:
            print(f"error: couldn't locate the {alias} import in engine.tsx — aborted, nothing written.", file=sys.stderr)
            return 3

    BRAND_JSON.write_text(brand_txt)
    ENGINE_TSX.write_text(tsx)

    for role, family in changes.items():
        print(f"  {role:5s} → {family}  (module @remotion/google-fonts/{module_name(family)})")
    print("\nUpdated brand.json + engine.tsx together. Re-render to see it — the old render is cached.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
