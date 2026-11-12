"""A finished advert film as a story bundle: only what the story may show, in the shapes the live views use.

    ~/advert/.venv/bin/python tools/bundle.py --list          # finished films (ad.mp4 present), newest first
    ~/advert/.venv/bin/python tools/bundle.py <film_id>       # the bundle for one film

The rules of ~/advert/docs/first-run-story.md are enforced here, not in the page: the bundle carries hook lines (the
first spoken line of each idea), the pick's name, counts, durations, the product's own screenshots and colours, the
fact cards (advert's own story_facts), the film's pictures, voice files and the ad. Never truths, ideas, beats, plan or
scene text, judge reasons, costs or model names. `files` is the whitelist the server serves from ~/advert/out.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

ADVERT = pathlib.Path.home() / "advert"
OUT = ADVERT / "out"
sys.path.insert(0, str(ADVERT))


def read(p: pathlib.Path, default=None):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def events(p: pathlib.Path) -> list[dict]:
    if not p.is_file():
        return []
    out = []
    for line in p.read_text().splitlines():
        try:
            out.append(json.loads(line))
        except Exception:
            pass
    return out


def facts(prod: pathlib.Path) -> list[str]:
    f = read(prod / "story" / "facts.json")
    if f and f.get("cards"):
        return f["cards"]
    brief, digest = read(prod / "brief.json"), read(prod / "digest.json")
    if not brief:
        return []
    try:                                                     # advert's own cards, so they match production exactly
        from advert.creative.store import story_facts
        from advert.creative.schemas import Digest
        from advert.schemas import Brief
        if digest:
            return story_facts(Brief.model_validate(brief), Digest.model_validate(digest))
    except Exception:
        pass
    cards = [f"{brief.get('product_name', '')}: {brief.get('tagline', '')}".strip(": ")[:120], str(brief.get("category", ""))[:80]]
    return [c for c in cards if c]


def recorded(prod: pathlib.Path, batch: pathlib.Path, film: pathlib.Path) -> dict | None:
    """Stage lengths and where the ticks fell inside them (0..1), from the run's own event logs, when it has them."""
    fe, be, pe = events(film / "events.jsonl"), events(batch / "events.jsonl"), events(prod / "events.jsonl")
    if not fe or not be:
        return None
    first = lambda evs, k, **d: next((e["t"] for e in evs if e["kind"] == k and all(e.get("data", {}).get(a) == b for a, b in d.items())), None)
    last = lambda evs, k: max((e["t"] for e in evs if e["kind"] == k), default=None)
    st = {}
    b0, td, cd, bd = first(be, "batch.start"), first(be, "truths.done"), first(be, "concepts.done"), last(be, "judge.pair")
    if b0 and td: st["truths"] = td - b0
    if td and cd: st["concepts"] = cd - td
    if cd and bd: st["judge"] = max(1.0, bd - cd)
    for s in ("direction", "audio", "visuals", "render"):
        a, b = first(fe, "film.stage", stage=s, state="running"), first(fe, "film.stage", stage=s, state="done")
        if a and b: st[s] = b - a
    i0, dd = first(pe, "research.stage", stage="ingest", state="running"), first(pe, "research.stage", stage="digest", state="done")
    if i0 and dd and dd > i0: st["research"] = dd - i0
    ticks = {}
    if td and cd:
        ticks["concepts"] = [round((e["t"] - td) / max(1e-6, cd - td), 3) for e in be if e["kind"] == "concept.done"]
    va, vb = first(fe, "film.stage", stage="visuals", state="running"), first(fe, "film.stage", stage="visuals", state="done")
    if va and vb:
        ticks["visuals"] = [{"f": round((e["t"] - va) / max(1e-6, vb - va), 3), "ref": e.get("ref", "")} for e in fe if e["kind"] == "asset.landed"]
    return {"stages": {k: round(v, 1) for k, v in st.items()}, "ticks": ticks}


def bundle(fid: str) -> dict:
    film = OUT / "films" / fid
    fj = read(film / "film.json")
    if not fj or not (film / "ad.mp4").is_file():
        raise SystemExit(f"no finished film {fid}")
    prod = OUT / "products" / fj["product"]
    batch = prod / "ideas" / fj["batch"]
    files: set[str] = set()
    rel = lambda p: str(p.relative_to(OUT))

    def keep(p: pathlib.Path) -> str | None:
        if p.is_file():
            files.add(rel(p)); return rel(p)
        return None

    # research: the product's own screenshots, its colours and logo, the fact cards
    assets = (read(prod / "assets.json", {}) or {}).get("assets", [])
    shot = lambda kind: next((keep(prod / "assets" / a["file"]) for a in assets if a.get("kind") == kind), None)
    brief = read(prod / "brief.json", {}) or {}
    brand = brief.get("brand") or {}
    palette = [c for c in [brand.get("primary"), brand.get("accent"), brand.get("bg"), brand.get("text")] if c]
    measured = (read(prod / "assets.json", {}) or {}).get("palette") or []
    hexes = []
    for c in palette + [m if isinstance(m, str) else (m or {}).get("hex", "") for m in measured]:
        h = re.match(r"\s*(#[0-9a-fA-F]{6})", str(c or ""))
        if h and h.group(1).lower() not in hexes:
            hexes.append(h.group(1).lower())
    palette = hexes[:5]
    logo = next((keep(prod / "assets" / a["file"]) for a in assets if a.get("kind") == "logo"), None)
    digest = read(prod / "digest.json", {}) or {}
    mk = digest.get("markets") or {}
    where = ", ".join(c.get("country", "") for c in (mk.get("chief") or [])[:3]) if mk.get("scope") != "worldwide" else ""
    market = f"Sells in {where}" if where else "Sells worldwide"

    # the batch: hook lines only, the pick, counts
    cj = read(batch / "concepts.json", {}) or {}
    items = cj.get("items", [])
    def first_line(c: dict) -> str:
        # the idea as its first spoken line: hook_voice, or the first beat with a voice (a silent opening), or its name
        if (c.get("hook_voice") or "").strip():
            return c["hook_voice"].strip()
        for b in c.get("beats") or []:
            if isinstance(b, dict) and (b.get("voice") or "").strip():
                return b["voice"].strip()
        return c.get("name", "")
    hooks = [first_line(it.get("concept") or {}) for it in items]
    pick_i = next((i for i, it in enumerate(items) if it.get("id") == fj.get("concept_id")), 0)
    bev = events(batch / "events.jsonl")
    # the angles count: the batch's own event, else the distinct truths (a string in newer batches, an object in older)
    truth_key = lambda t: json.dumps(t, sort_keys=True, ensure_ascii=False) if isinstance(t, (dict, list)) else str(t)
    truths_n = next((e["data"].get("n") for e in bev if e["kind"] == "truths.done"), None) or len({truth_key(it["truth"]) for it in items if it.get("truth")}) or len(items)

    # the film: scene count and seconds (from the voice lines), voice files, pictures, the ad
    au = read(film / "audio" / "audio.json", {}) or {}
    lines = [{"file": keep(film / "audio" / l["file"]), "seconds": round(l.get("duration", 0), 2)} for l in au.get("lines", []) if l.get("file")]
    plan = read(film / "plan.json", {}) or {}
    n_scenes = len(plan.get("scenes", [])) or len(lines)
    vis = film / "visuals"
    stills = sorted([p for p in vis.glob("still_*.jpg") if "_after" not in p.name])
    clips = sorted(vis.glob("clip_*.mp4"))
    num = lambda p: int("".join(ch for ch in p.stem.split("_")[1] if ch.isdigit()) or 0)
    return {
        "film": fid, "product": fj["product"], "product_name": fj.get("product_name") or brief.get("product_name") or fj["product"],
        "language": (fj.get("market") or cj.get("market") or {}).get("language", "en"), "created": fj.get("created"),
        "research": {"desktop": shot("screenshot_desktop"), "mobile": shot("screenshot_mobile"), "logo": logo,
                     "palette": palette, "facts": facts(prod), "market": market},
        "truths": {"n": truths_n},
        "concepts": {"hooks": hooks},
        "judge": {"pairs": len(cj.get("judgements", [])) or 56},
        "pick": {"index": pick_i, "hook": hooks[pick_i] if hooks else "", "name": (fj.get("concept") or {}).get("name", "")},
        "direction": {"scenes": [{"seconds": l["seconds"]} for l in lines] or [{"seconds": 4}] * n_scenes},
        "audio": {"seconds": au.get("seconds") or sum(l["seconds"] for l in lines), "lines": lines},
        "visuals": {"poster": keep(vis / "poster.jpg"), "stills": [{"file": keep(p), "index": num(p)} for p in stills],
                    "clips": [{"file": keep(p), "scene": num(p), "still": next((rel(s) for s in stills if num(s) == num(p)), None)} for p in clips]},
        "ad": keep(film / "ad.mp4"),
        "recorded": recorded(prod, batch, film),
        "files": sorted(files),
    }


def gaps(b: dict) -> list[str]:
    """What a film lacks for a full story; films with any gap stay out of the picker."""
    g = []
    if not b["research"]["desktop"] or not b["research"]["mobile"]: g.append("screenshots")
    if not b["research"]["facts"]: g.append("facts")
    hooks = b["concepts"]["hooks"]
    if len(hooks) < 3 or not all(h.strip() for h in hooks): g.append("hooks")
    if not b["pick"]["name"]: g.append("idea name")
    if len(b["audio"]["lines"]) < 3: g.append("voice")
    if len(b["visuals"]["stills"]) < 3: g.append("stills")
    if not b["ad"]: g.append("ad")
    return g


def listing() -> list[dict]:
    out = []
    for film in (OUT / "films").iterdir():
        fj = read(film / "film.json")
        if not fj or not (film / "ad.mp4").is_file():
            continue
        try:
            if gaps(bundle(film.name)):
                continue
        except Exception:
            continue
        vis = film / "visuals"
        out.append({"film": film.name, "product": fj.get("product"), "product_name": fj.get("product_name") or fj.get("product"),
                    "name": (fj.get("concept") or {}).get("name", ""), "language": (fj.get("market") or {}).get("language", "en"),
                    "created": fj.get("created") or film.stat().st_mtime, "stills": len([p for p in vis.glob("still_*.jpg") if "_after" not in p.name]),
                    "clips": len(list(vis.glob("clip_*.mp4"))), "recorded": (film / "events.jsonl").is_file()})
    return sorted(out, key=lambda x: x["created"] or 0, reverse=True)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "--list"
    if arg == "--gaps":                                      # why each film is in or out of the picker
        for film in sorted((OUT / "films").iterdir()):
            if (film / "ad.mp4").is_file():
                try:
                    print(film.name, ", ".join(gaps(bundle(film.name))) or "complete")
                except Exception as e:
                    print(film.name, "error:", e)
    else:
        print(json.dumps(listing() if arg == "--list" else bundle(arg), ensure_ascii=False))
