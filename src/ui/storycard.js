import { STEPS } from "../story/narration.js";

// The story card: an HTML overlay on the canvas, explainer-style. A step's card slides in with its number, its title
// revealed word by word, a plain explanation and a live status; after a few seconds it settles into a compact pill
// in the corner (the status keeps updating) so it never covers a long wait. Catch-up (seek, late load) shows the
// current step compact, without the entrance.
const HOLD_MS = 5200;

export class StoryCard {
  constructor(host) {
    this.host = host;
    this.el = document.createElement("div"); this.el.className = "story-card"; host.appendChild(this.el);
    this.el.innerHTML = `
      <div class="sc-inner">
        <div class="sc-num"><span></span></div>
        <div class="sc-text">
          <div class="sc-kicker"></div>
          <div class="sc-title"></div>
          <div class="sc-body"></div>
          <div class="sc-status"><i></i><span></span></div>
        </div>
      </div>
      <div class="sc-rail">${STEPS.map((s) => `<b data-n="${s.n}"></b>`).join("")}</div>`;
    this.q = (s) => this.el.querySelector(s);
    this.key = null; this.timer = null;
  }

  reset() { this.key = null; clearTimeout(this.timer); this.el.className = "story-card"; }

  // show a step's card; animate = false shows it already settled (catch-up)
  show(card, { animate = true } = {}) {
    if (!card || card.key === this.key) return;
    this.key = card.key;
    clearTimeout(this.timer);
    this.q(".sc-num span").textContent = card.final ? "✓" : String(card.n);
    this.q(".sc-kicker").textContent = card.final ? "All done" : card.honest ? "Step 4 of 8 · the pick" : `Step ${card.n} of ${STEPS.length}`;
    const title = this.q(".sc-title");
    title.innerHTML = card.title.split(" ").map((w, i) => `<span style="--i:${i}">${w}</span>`).join(" ");
    this.q(".sc-body").textContent = card.body;
    this.el.classList.toggle("honest", !!card.honest);
    this.el.classList.toggle("final", !!card.final);
    this.q(".sc-rail").querySelectorAll("b").forEach((b) => {
      const n = +b.dataset.n; b.className = n < card.n || card.final ? "done" : n === card.n ? "now" : "";
    });
    this.el.classList.remove("in", "compact", "instant");
    if (!animate) { this.el.classList.add("instant", "in", "compact"); return; }
    void this.el.offsetWidth;                                // restart the entrance
    this.el.classList.add("in");
    if (!card.final) this.timer = setTimeout(() => this.el.classList.add("compact"), HOLD_MS);
  }

  status(text) {
    const s = this.q(".sc-status span");
    if (s.textContent === text) return;
    s.textContent = text || "";
    this.q(".sc-status").classList.toggle("empty", !text);
    this.q(".sc-status").classList.remove("tick"); void this.el.offsetWidth; this.q(".sc-status").classList.add("tick");
  }
}

export const STORY_CARD_CSS = `
.story-card { position: absolute; left: 2.2%; top: 6%; width: min(36%, 460px); pointer-events: none; z-index: 3;
  font-family: "Nunito", "Noto Sans Devanagari", system-ui, sans-serif; color: #26214a; opacity: 0;
  transform: translateX(-30px) scale(.96); transform-origin: top left;
  transition: transform .55s cubic-bezier(.2,1.4,.4,1), opacity .35s ease, width .45s ease; }
.story-card.in { opacity: 1; transform: none; }
.story-card.instant, .story-card.instant * { transition: none !important; animation: none !important; }
.story-card.instant .sc-title span { opacity: 1; transform: none; }
.story-card.instant .sc-body { opacity: 1; }
.story-card .sc-inner { display: flex; gap: 14px; align-items: flex-start; background: rgba(255,255,255,.94);
  border-radius: 18px; padding: 16px 18px 14px; box-shadow: 0 14px 40px rgba(38,33,74,.22), 0 2px 0 rgba(91,63,209,.15) inset;
  border: 1px solid rgba(91,63,209,.14); backdrop-filter: blur(6px); transition: padding .45s ease, border-radius .45s ease; }
.story-card .sc-num { flex: 0 0 auto; width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(140deg,#7b5cd6,#5b3fd1);
  color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 26px; box-shadow: 0 6px 16px rgba(91,63,209,.4);
  transition: width .45s ease, height .45s ease, font-size .45s ease; }
.story-card.honest .sc-num { background: linear-gradient(140deg,#3ccf8e,#2bb673); box-shadow: 0 6px 16px rgba(43,182,115,.4); }
.story-card.final .sc-num { background: linear-gradient(140deg,#ffd36e,#f0a92b); box-shadow: 0 6px 16px rgba(240,169,43,.45); }
.story-card .sc-text { min-width: 0; flex: 1; }
.story-card .sc-kicker { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #7d77a3; margin-bottom: 2px;
  transition: opacity .3s ease, max-height .45s ease; max-height: 20px; overflow: hidden; }
.story-card .sc-title { font-size: clamp(18px, 2.1vw, 28px); font-weight: 900; line-height: 1.12; letter-spacing: -.01em; transition: font-size .45s ease; }
.story-card .sc-title span { display: inline-block; opacity: 0; transform: translateY(12px); }
.story-card.in .sc-title span { animation: sc-word .5s cubic-bezier(.2,1.3,.4,1) forwards; animation-delay: calc(.12s + var(--i) * .07s); }
@keyframes sc-word { to { opacity: 1; transform: none; } }
.story-card .sc-body { font-size: clamp(13px, 1.2vw, 16px); font-weight: 600; line-height: 1.4; color: #4a4470; margin-top: 6px;
  max-height: 80px; overflow: hidden; transition: max-height .45s ease, opacity .3s ease, margin .45s ease; opacity: 0; }
.story-card.in .sc-body { opacity: 1; transition-delay: .35s; }
.story-card.honest .sc-body { color: #1b7a50; font-weight: 800; }
.story-card .sc-status { display: inline-flex; align-items: center; gap: 7px; margin-top: 10px; padding: 4px 11px 4px 9px; border-radius: 999px;
  background: #f1edff; color: #4b2db5; font-size: 13px; font-weight: 800; }
.story-card .sc-status.empty { display: none; }
.story-card .sc-status i { width: 8px; height: 8px; border-radius: 50%; background: #5b3fd1; animation: sc-pulse 1.4s ease-in-out infinite; }
.story-card .sc-status.tick { animation: sc-tick .4s ease; }
@keyframes sc-pulse { 50% { opacity: .3; transform: scale(.7); } }
@keyframes sc-tick { 40% { transform: scale(1.08); } }
.story-card .sc-rail { display: flex; gap: 5px; margin: 10px 4px 0; transition: opacity .3s ease; }
.story-card .sc-rail b { flex: 1; height: 5px; border-radius: 3px; background: rgba(255,255,255,.7); box-shadow: 0 1px 3px rgba(38,33,74,.15); }
.story-card .sc-rail b.done { background: #7b5cd6; }
.story-card .sc-rail b.now { background: linear-gradient(90deg,#7b5cd6,#ffc857); }
/* compact: the corner pill */
.story-card.compact { width: auto; max-width: 48%; }
.story-card.compact .sc-inner { padding: 8px 14px 8px 8px; border-radius: 999px; align-items: center; gap: 10px; }
.story-card.compact .sc-num { width: 34px; height: 34px; font-size: 16px; }
.story-card.compact .sc-kicker, .story-card.compact .sc-body { max-height: 0; opacity: 0; margin: 0; }
.story-card.compact .sc-title { font-size: clamp(14px, 1.3vw, 17px); white-space: nowrap; }
.story-card.compact .sc-text { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; }
.story-card.compact .sc-status { margin-top: 0; white-space: nowrap; }
.story-card.compact .sc-rail { opacity: 0; height: 0; margin: 0; }
.story-card.final { left: 50%; top: 8%; transform: translateX(-50%); }
.story-card.final.in { transform: translateX(-50%); }
`;
