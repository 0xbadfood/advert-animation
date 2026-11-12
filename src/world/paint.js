// Canvas painters for slot faces. Every artifact is drawn here (never as 3D text), so Devanagari is shaped by the
// browser and the same card system is used everywhere. A painter returns {overflow: bool} when text was cut.

export const FONT = `"Nunito", "Noto Sans Devanagari", "Noto Sans", system-ui, sans-serif`;
export const INK = "#26214a", MUTED = "#7d77a3", VIOLET = "#5b3fd1", GOLD = "#ffc857", GREEN = "#2bb673", PAPER = "#fbfaff";

export function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// wrap text into at most maxLines lines of width w; returns {lines, overflow}
export function wrap(c, text, w, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = []; let line = "", overflow = false;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (c.measureText(test).width <= w || !line) { line = test; continue; }
    lines.push(line); line = words[i];
    if (lines.length === maxLines) { overflow = true; line = ""; break; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; overflow = true; }
  if (overflow || lines.some((l) => c.measureText(l).width > w)) {
    overflow = true;
    let last = lines[lines.length - 1] || "";
    while (last && c.measureText(last + "…").width > w) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return { lines, overflow };
}

function clear(c, W, H, bg = PAPER) { c.clearRect(0, 0, W, H); c.fillStyle = bg; c.fillRect(0, 0, W, H); }

export const painters = {
  // a caller-supplied drawing (the playing ad, live video frames later)
  fn(c, W, H, o = {}) { if (o.draw) o.draw(c, W, H); return {}; },

  placeholder(c, W, H, o = {}) {
    clear(c, W, H, o.bg || "#ece8fb");
    c.strokeStyle = "#c9c0f0"; c.lineWidth = Math.max(2, W / 120); c.setLineDash([W / 30, W / 40]);
    rr(c, W * 0.06, H * 0.06, W * 0.88, H * 0.88, Math.min(W, H) * 0.06); c.stroke(); c.setLineDash([]);
    if (o.label) { c.fillStyle = "#b3a9e3"; c.font = `600 ${Math.round(Math.min(W, H) * 0.12)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(o.label, W / 2, H / 2); }
    return {};
  },

  // a card: optional header strip, body text wrapped, optional sub line
  card(c, W, H, o = {}) {
    clear(c, W, H, o.bg || PAPER);
    const pad = W * 0.06; let y = pad;
    if (o.title) {
      const hh = H * (o.headerFrac || 0.24);
      c.fillStyle = o.accent || VIOLET; c.fillRect(0, 0, W, hh);
      c.fillStyle = "#fff"; c.font = `800 ${Math.round(hh * 0.46)}px ${FONT}`; c.textBaseline = "middle"; c.textAlign = "left";
      c.fillText(o.title, pad, hh / 2);
      y = hh + pad * 0.8;
    }
    // shrink to fit before cutting (down to 62% of the asked size); only text that still does not fit is cut
    const base = Math.round(o.size || H * 0.13);
    let size = base, lines, overflow, subH;
    for (;;) {
      c.font = `${o.weight || 700} ${size}px ${FONT}`;
      subH = o.sub ? size * 1.3 : 0;
      const maxLines = Math.max(1, Math.floor((H - y - pad - subH) / (size * 1.25)));
      ({ lines, overflow } = wrap(c, o.text, W - pad * 2, Math.min(maxLines, o.maxLines || 99)));
      if (!overflow || size <= base * 0.62) break;
      size = Math.max(Math.round(base * 0.62), Math.round(size * 0.9));
    }
    c.fillStyle = o.ink || INK; c.textBaseline = "top"; c.textAlign = o.align || "left";
    const x = o.align === "center" ? W / 2 : pad;
    lines.forEach((l, i) => c.fillText(l, x, y + i * size * 1.25));
    if (o.sub) { c.font = `600 ${Math.round(size * 0.8)}px ${FONT}`; c.fillStyle = MUTED; c.fillText(o.sub, x, H - pad - size * 0.9); }
    if (o.check) { c.fillStyle = GREEN; c.beginPath(); c.arc(W - pad * 1.6, pad * 1.6 + (o.title ? H * 0.24 : 0), pad, 0, Math.PI * 2); c.fill(); }
    return { overflow };
  },

  // a thought bubble with a hook line inside (transparent outside the bubble)
  bubble(c, W, H, o = {}) {
    c.clearRect(0, 0, W, H);
    c.fillStyle = o.fill || "#ffffff"; c.strokeStyle = o.stroke || "#d9cff9"; c.lineWidth = W * 0.012;
    c.beginPath(); c.ellipse(W / 2, H * 0.46, W * 0.47, H * 0.42, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(W * 0.2, H * 0.92, H * 0.05, 0, Math.PI * 2); c.fill(); c.stroke();
    let size = Math.round(H * 0.13), lines, overflow;
    for (;;) {
      c.font = `700 ${size}px ${FONT}`;
      ({ lines, overflow } = wrap(c, o.text, W * 0.72, size < H * 0.11 ? 4 : 3));
      if (!overflow || size <= H * 0.085) break;
      size = Math.round(size * 0.9);
    }
    c.fillStyle = INK; c.textAlign = "center"; c.textBaseline = "top";
    const y0 = H * 0.46 - (lines.length * size * 1.22) / 2;
    lines.forEach((l, i) => c.fillText(l, W / 2, y0 + i * size * 1.22));
    return { overflow };
  },

  image(c, W, H, o = {}) {
    clear(c, W, H, "#ddd6f5");
    const img = o.image;
    if (img) {
      const iw = img.width || img.videoWidth, ih = img.height || img.videoHeight;
      const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
      if (o.filter) c.filter = o.filter;
      c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      c.filter = "none";
    }
    if (o.play) {
      c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.arc(W / 2, H / 2, Math.min(W, H) * 0.12, 0, Math.PI * 2); c.fill();
      c.fillStyle = VIOLET; c.beginPath(); const r = Math.min(W, H) * 0.06;
      c.moveTo(W / 2 - r * 0.6, H / 2 - r); c.lineTo(W / 2 + r, H / 2); c.lineTo(W / 2 - r * 0.6, H / 2 + r); c.closePath(); c.fill();
    }
    if (o.label) {
      c.fillStyle = "rgba(38,33,74,0.65)"; c.fillRect(0, H - H * 0.1, W, H * 0.1);
      c.fillStyle = "#fff"; c.font = `700 ${Math.round(H * 0.055)}px ${FONT}`; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(o.label, W * 0.05, H - H * 0.05);
    }
    return {};
  },

  // waveform: samples 0..1, progress 0..1 (played part bright)
  wave(c, W, H, o = {}) {
    clear(c, W, H, o.bg || "#1f1a44");
    const s = o.samples || [], n = s.length || 1, bw = W / n;
    for (let i = 0; i < s.length; i++) {
      const a = Math.max(0.03, s[i]) * H * 0.42;
      const played = i / n <= (o.progress ?? 1);
      c.fillStyle = played ? (o.color || "#8be9ff") : "rgba(139,233,255,0.25)";
      c.fillRect(i * bw + bw * 0.15, H / 2 - a, Math.max(1, bw * 0.7), a * 2);
    }
    if (o.label) { c.fillStyle = "#cfc6ff"; c.font = `700 ${Math.round(H * 0.12)}px ${FONT}`; c.textAlign = "left"; c.textBaseline = "top"; c.fillText(o.label, W * 0.03, H * 0.05); }
    return {};
  },

  swatches(c, W, H, o = {}) {
    clear(c, W, H, PAPER);
    const cols = o.colors || [], n = Math.max(1, cols.length), gap = W * 0.03, sw = (W - gap * (n + 1)) / n;
    cols.forEach((col, i) => { c.fillStyle = col; rr(c, gap + i * (sw + gap), H * 0.15, sw, H * 0.7, sw * 0.18); c.fill(); });
    return {};
  },

  counter(c, W, H, o = {}) {
    clear(c, W, H, o.bg || PAPER);
    c.fillStyle = o.ink || VIOLET; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `900 ${Math.round(H * 0.5)}px ${FONT}`; c.fillText(String(o.value ?? ""), W / 2, H * 0.42);
    if (o.label) { c.font = `700 ${Math.round(H * 0.16)}px ${FONT}`; c.fillStyle = MUTED; c.fillText(o.label, W / 2, H * 0.8); }
    return {};
  },

  // a checklist of lines with ticks
  checklist(c, W, H, o = {}) {
    clear(c, W, H, PAPER);
    const items = o.items || [], rowH = H / Math.max(3, items.length + 0.5), size = Math.round(rowH * 0.42);
    c.font = `700 ${size}px ${FONT}`; c.textBaseline = "middle"; c.textAlign = "left";
    items.forEach((it, i) => {
      const y = rowH * (i + 0.75);
      c.fillStyle = it.done ? GREEN : it.running ? GOLD : "#d6d0ef";
      c.beginPath(); c.arc(W * 0.08, y, size * 0.45, 0, Math.PI * 2); c.fill();
      c.fillStyle = it.done || it.running ? INK : MUTED; c.fillText(it.label, W * 0.16, y);
    });
    return {};
  },

  // a progress ring with a number
  ring(c, W, H, o = {}) {
    c.clearRect(0, 0, W, H);
    const r = Math.min(W, H) * 0.4, p = Math.max(0, Math.min(1, o.p || 0));
    c.lineWidth = r * 0.22; c.strokeStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(W / 2, H / 2, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = o.color || GOLD; c.lineCap = "round"; c.beginPath(); c.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.stroke();
    c.fillStyle = "#fff"; c.font = `900 ${Math.round(r * 0.6)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(o.text ?? Math.round(p * 100) + "%", W / 2, H / 2);
    return {};
  },

  // the storyboard: n numbered frames with duration bars (counts and numbers only, never scene text)
  storyboard(c, W, H, o = {}) {
    clear(c, W, H, PAPER);
    const max = o.max || 9, scenes = o.scenes || [], lit = o.lit ?? scenes.length;
    const cols = Math.min(max, 9), gap = W * 0.012, fw = (W - gap * (cols + 1)) / cols, fh = H * 0.55;
    const total = scenes.reduce((a, s) => a + (s.seconds || 0), 0) || 1;
    for (let i = 0; i < cols; i++) {
      const x = gap + i * (fw + gap), y = H * 0.08, s = scenes[i];
      c.fillStyle = s && i < lit ? "#efeaff" : "#f4f2fa"; rr(c, x, y, fw, fh, fw * 0.08); c.fill();
      c.strokeStyle = s && i < lit ? VIOLET : "#ddd7f0"; c.lineWidth = W * 0.003; c.stroke();
      if (s && i < lit) {
        if (o.sketches && o.sketches[i]) { c.save(); rr(c, x, y, fw, fh, fw * 0.08); c.clip(); c.globalAlpha = 0.9; c.drawImage(o.sketches[i], x, y, fw, fh); c.restore(); }
        c.fillStyle = VIOLET; c.font = `900 ${Math.round(fh * 0.22)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(i + 1), x + fw / 2, y + fh * 0.18);
      }
    }
    // the timeline bar: one segment per lit scene, width by its seconds
    let x = gap; const by = H * 0.74, bh = H * 0.14, bw = W - gap * 2;
    const hues = ["#7cc4ff", "#7ee0a1", "#ffd36e", "#ff9db5", "#b49cff", "#7ce0d8", "#ffb07c", "#c3e87c", "#e7a6ff"];
    scenes.slice(0, lit).forEach((s, i) => {
      const w = ((s.seconds || 0) / total) * bw;
      c.fillStyle = hues[i % hues.length]; rr(c, x, by, Math.max(2, w - 2), bh, bh * 0.3); c.fill(); x += w;
    });
    if (o.label) { c.fillStyle = MUTED; c.font = `700 ${Math.round(H * 0.07)}px ${FONT}`; c.textAlign = "right"; c.textBaseline = "top"; c.fillText(o.label, W - gap, by + bh + H * 0.02); }
    return {};
  },
};
