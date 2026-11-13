"""The live page's time estimate starts from these: each stage's typical length (mid) and a long-but-normal length
(hi), from every advert run that recorded its events. Rerun after more runs exist; it rewrites src/live/priors.json.

    ~/advert/.venv/bin/python tools/priors.py

The cloud profile keeps the local numbers except where the cloud is known to be faster (pictures run in parallel and
the render is expected near 30 s: ~/advert/docs/first-run-story.md, principle 6). Adjust those by hand until cloud runs
exist to measure.
"""
from __future__ import annotations

import json
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import bundle as B  # noqa: E402

STAGES = ["research", "truths", "concepts", "judge", "direction", "audio", "visuals", "render"]
CLOUD = {"visuals": {"mid": 75, "hi": 110}, "render": {"mid": 40, "hi": 55}}  # guesses until cloud runs exist; match emulator/timing.js CLOUD


def q(v: list[float], f: float) -> float:
    v = sorted(v)
    i = f * (len(v) - 1)
    lo = int(i)
    return v[lo] + (v[min(lo + 1, len(v) - 1)] - v[lo]) * (i - lo)


def main() -> None:
    runs = []
    for f in (B.OUT / "films").iterdir():
        fj = B.read(f / "film.json")
        if not fj or not (f / "events.jsonl").is_file():
            continue
        prod = B.OUT / "products" / fj["product"]
        r = B.recorded(prod, prod / "ideas" / fj["batch"], f)
        if r:
            runs.append(r["stages"])
    local = {}
    for s in STAGES:
        v = [r[s] for r in runs if s in r]
        if not v:
            continue
        # hi: the 80th percentile, at least 25% over the median (few samples, so never trust a tight spread)
        local[s] = {"mid": round(statistics.median(v), 1), "hi": round(max(q(v, 0.8), statistics.median(v) * 1.25), 1), "n": len(v)}
    out = {"runs": len(runs), "local": local, "cloud": {**local, **CLOUD}}
    path = pathlib.Path(__file__).parent.parent / "src" / "live" / "priors.json"
    path.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
