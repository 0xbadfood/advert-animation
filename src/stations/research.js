import * as THREE from "three";
import { makeFigure, props } from "../world/cast.js";
import { panel, stand, flash, orb, v3 } from "./common.js";

// Station 1, research (engine stages arrive, research). The researcher scans the business's own pages; panels fill
// with the real screenshots, palette, logo and fact cards; threads pull them into the collector.
export function build(world, X) {
  world.rug(X, 4.6);
  // the collector: stacked glowing rings on a pedestal
  const col = new THREE.Group(); col.position.set(X + 0.4, 0, -0.9); world.scene.add(col);
  world.box(1.3, 0.35, 1.3, 0xf6f2ff, 0, 0.175, 0, col, 0.3);
  const glowM = new THREE.MeshStandardMaterial({ color: 0x8f7bff, roughness: 0.2, emissive: 0x6d4cff, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 36), glowM); r.position.y = 0.55 + i * 0.3; r.castShadow = true; col.add(r); return r; });
  void rings;

  const s = {
    desktop: panel(world, "site_desktop", { x: X - 2.6, y: 2.75, z: -1.7, w: 2.3, h: 1.45, rotY: 0.28, kind: "image", placeholder: "website" }),
    mobile: panel(world, "site_mobile", { x: X - 0.7, y: 3.15, z: -2.1, w: 0.72, h: 1.45, rotY: 0.08, kind: "image", placeholder: "phone" }),
    logo: panel(world, "logo", { x: X + 0.75, y: 3.55, z: -2.2, w: 0.7, h: 0.7, kind: "image", placeholder: "logo" }),
    palette: panel(world, "palette", { x: X + 2.4, y: 3.5, z: -1.9, w: 1.9, h: 0.5, rotY: -0.15, kind: "swatches", placeholder: "colours" }),
    fact: panel(world, "fact", { x: X + 2.75, y: 2.35, z: -1.3, w: 2.2, h: 1.05, rotY: -0.3, kind: "card", placeholder: "facts" }),
    market: panel(world, "market", { x: X + 2.75, y: 1.5, z: -1.15, w: 1.5, h: 0.38, rotY: -0.3, kind: "card", placeholder: "market" }),
    check: panel(world, "checklist", { x: X - 2.9, y: 1.25, z: -0.7, w: 1.7, h: 0.85, rotY: 0.32, kind: "checklist", placeholder: "" }),
  };
  stand(world, X - 2.9, -0.7, 0.8); stand(world, X + 2.75, -1.15, 1.3);
  const checklist = [{ key: "ingest", label: "Reading your pages" }, { key: "brief", label: "Understanding the offer" }, { key: "digest", label: "Checking the market" }];
  s.check.repaint("checklist", { items: checklist });

  const R = makeFigure(world, "researcher", X - 7, 1.0, Math.PI / 2);
  const mag = R.hold(props.magnifier(), "R");
  void mag;
  const MARK = [X - 1.0, 0.7];
  const colTop = v3(X + 0.4, 1.4, -0.9);
  let factNo = 0;

  function* cycleFact(ctx) {
    const f = ctx.data.facts; if (!f.length) return;
    s.fact.set({ title: "We learned", text: f[factNo++ % f.length], headerFrac: 0.26 });
  }
  function* scan(ctx, target) {
    const V = ctx.V;
    yield* V.all(R.pose("point", 0.4), R.turnTo(target, 0.4));
    R.j.headNod = -0.2;
    yield* V.all(R.wiggle("headTurn", 0.18, 1, 1.4), R.bounce(0.05, 0.5));
    yield* V.all(R.pose("stand", 0.4), R.turnTo(0, 0.4));
  }

  const station = {
    name: "research", x: X, framing: { x: X, y: 2.0, z: -0.6, w: 9.6, h: 4.9, tw: 4.6, th: 7.4 },
    stages: {
      arrive: {
        *enter(ctx) { if (R.root.position.x < X - 4) yield* R.hopTo(MARK[0], MARK[1]); yield* R.pose("wave", 0.35); yield* R.wiggle("rR", 0.25, 2, 0.9); yield* R.pose("stand", 0.3); },
        phases: { early: ["look", "bounce"] },
        beats: {
          *look(ctx) { yield* ctx.V.all(R.pose("lookUp", 0.5)); yield* R.wiggle("headTurn", 0.4, 1, 1.6); yield* R.pose("stand", 0.4); },
          *bounce(ctx) { yield* R.bounce(0.1, 0.5); yield 0.8; },
        },
      },
      research: {
        *enter(ctx) {
          if (R.root.position.x < X - 4) yield* R.hopTo(MARK[0], MARK[1]);
          yield* R.pose("point", 0.35); yield* orb(world, v3(X - 0.6, 1.5, 0.7), colTop, { dur: 0.8 }); yield* R.pose("stand", 0.3);
        },
        phases: { early: ["scanSite", "scanPhone", "pull", "fact"], mid: ["scanSite", "pull", "fact", "think", "typing"], late: ["fact", "think", "stretch", "pull", "typing"] },
        beats: {
          *scanSite(ctx) { yield* scan(ctx, 0.6); },
          *scanPhone(ctx) { yield* scan(ctx, 0.2); },
          *pull(ctx) { yield* R.pose("point", 0.3); yield* ctx.V.all(orb(world, v3(X - 2.6, 2.7, -1.6), colTop), flash(world, s.desktop)); yield* R.pose("stand", 0.3); yield 0.4; },
          *fact(ctx) { yield* R.turnTo(-0.5, 0.3); yield* cycleFact(ctx); yield* R.pose("read", 0.4); yield* R.wiggle("headNod", 0.08, 2, 1.6); yield* ctx.V.all(R.pose("stand", 0.4), R.turnTo(0, 0.4)); },
          *think(ctx) { yield* R.pose("think", 0.5); yield* R.wiggle("headTilt", 0.12, 1, 1.8); yield* R.pose("stand", 0.4); },
          *typing(ctx) { yield* R.pose("hold", 0.4); yield* R.wiggle("eR", 0.3, 5, 1.6); yield* R.pose("stand", 0.3); },
          *stretch(ctx) { yield* R.pose("cheer", 0.5); yield 0.3; yield* R.pose("stand", 0.5); yield 0.6; },
        },
        *react(ctx, evs) {
          yield* ctx.V.all(R.bounce(evs.length > 1 ? 0.18 : 0.1, 0.5), R.pose(evs.length > 1 ? "cheer" : "point", 0.35));
          yield 0.35; yield* R.pose("stand", 0.35);
        },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "research.stage") {
        const it = checklist.find((x) => x.key === d.stage);
        if (it) { it.running = d.state === "running"; it.done = d.state === "done"; s.check.set({ items: checklist }, { kind: "checklist", reveal: "none" }); }
        if (c.palette) s.palette.set({ colors: c.palette }, { kind: "swatches", reveal: "pop" });
        if (c.logo) s.logo.set({ image: c.logo }, { kind: "image", reveal: "flip" });
      }
      if (e.kind === "asset.landed" && c.image) (c.which === "mobile" ? s.mobile : s.desktop).set({ image: c.image }, { kind: "image" });
      if (e.kind === "view.facts" && c.cards) { ctx.data.facts = c.cards; if (!s.fact.content) { factNo = 0; s.fact.set({ title: "We learned", text: c.cards[factNo++], headerFrac: 0.26 }); } }
      if (e.kind === "research.market" && c.market) s.market.set({ text: c.market, size: 34, align: "center", bg: "#efeaff" }, { reveal: "pop" });
    },
    *retry(ctx) { yield* R.pose("shrug", 0.4); yield 0.8; yield* R.pose("stand", 0.4); },
    *fail(ctx) { yield* R.pose("sad", 0.8); },
  };
  return station;
}
