"""Run every scenario headless through the emulator and print its checks; save screenshots at chosen moments.

    ~/advert/.venv/bin/python tools/smoke.py [--url http://localhost:5190] [--only cloud-fast] [--shots 0.1,0.5,0.9] [--out out/smoke]

Needs the dev server running (npm run dev). Exit code 1 if any scenario has a lag, short-stage, repeat or overflow
warning, or a page error, so it can gate a change to the motion.
"""
import argparse, json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BAD = {"lag", "short", "repeat", "overflow"}
KEY = (ROOT / ".api_key").read_text().strip() if (ROOT / ".api_key").is_file() else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:5190")
    ap.add_argument("--only", default="")
    ap.add_argument("--film", default="", help="a finished film id instead of the presets (its real artifacts)")
    ap.add_argument("--shots", default="", help="comma list of fractions of the run (0-1) or seconds with an s suffix")
    ap.add_argument("--out", default=str(ROOT / "out" / "smoke"))
    a = ap.parse_args()
    names = sorted(p.stem for p in (ROOT / "scenarios").glob("*.json"))
    if a.film:
        names = [f"film:{f}" for f in a.film.split(",")]
    if a.only:
        names = [n for n in names if n in a.only.split(",")]
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    failed = False
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for n in names:
            pg = b.new_page(viewport={"width": 1500, "height": 1100})
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            q = f"film={n[5:]}" if n.startswith("film:") else f"scenario={n}"
            pg.goto(f"{a.url}/?{q}&auto=1&key={KEY}", wait_until="load")
            pg.wait_for_function("window.__report !== undefined", timeout=240000)
            r = pg.evaluate("window.__report")
            bad = [w for w in r["warnings"] if w["level"] in BAD]
            print(f"\n== {n}: {r['events']} events, {r['end']:.0f} s, {len(bad)} warnings, {len(errors)} page errors")
            for row in r["rows"]:
                lag = "-" if row["lag"] is None else f"{row['lag']:.1f}"
                dw = "-" if row["dwell"] is None else f"{row['dwell']:.1f}"
                print(f"   {row['stage']:<10} event {row['enterEvent'] if row['enterEvent'] is not None else '-':>7} lag {lag:>5} on {dw:>6}  beats {row['beats']:>3} worst {row['worst']}x{row['maxRep']}  reacts {row['reacts']} folded {row['folded']}{'  (compressed)' if row['fast'] else ''}")
            for w in r["warnings"]:
                print(f"   [{w['level']}] {w['text']}")
            for e in errors[:5]:
                print(f"   [page error] {e}")
            if bad or errors:
                failed = True
            if a.shots:
                for s in a.shots.split(","):
                    t = float(s[:-1]) if s.endswith("s") else float(s) * r["end"]
                    pg.evaluate(f"window.__emu.seek({t})")
                    pg.wait_for_timeout(150)
                    f = out / f"{n.replace(':', '-')}-{int(t):04d}.png"
                    pg.locator("#views").screenshot(path=str(f))
                    print(f"   shot {f}")
            (out / f"{n.replace(':', '-')}.json").write_text(json.dumps(r, indent=1, ensure_ascii=False))
            pg.close()
        b.close()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
