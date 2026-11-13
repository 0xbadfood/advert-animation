// The places a business can be found, as typed by a person on a phone: tidy each one into a canonical value, or say
// it is not usable. Nothing here calls the network; the pipeline does the reading.
const clean = (s) => String(s || "").trim();

// "@name", "name", "instagram.com/name", "https://www.instagram.com/name/?hl=en" -> "name"
export function instagram(raw) {
  let s = clean(raw); if (!s) return null;
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i); if (m) s = m[1];
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) && !/^\.|\.\.|\.$/.test(s) ? { value: s, label: "@" + s, url: `https://www.instagram.com/${s}/` } : { error: true };
}

// "shop.in", "www.shop.in/about", "http://shop.in" -> "https://shop.in/..."
export function website(raw) {
  let s = clean(raw); if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (!/\./.test(u.hostname) || /\s/.test(s) || /(^|\.)(instagram|facebook)\.com$/i.test(u.hostname)) return { error: true };
    return { value: u.href.replace(/\/$/, ""), label: u.hostname.replace(/^www\./, ""), url: u.href };
  } catch (e) { return { error: true }; }
}

export function facebook(raw) {
  let s = clean(raw); if (!s) return null;
  const m = s.match(/(?:facebook|fb)\.com\/([^?#\s]+)/i);
  const page = m ? m[1].replace(/\/$/, "") : s.replace(/^@/, "");
  return /^[A-Za-z0-9.\-/]{2,100}$/.test(page) ? { value: `https://www.facebook.com/${page}`, label: page, url: `https://www.facebook.com/${page}` } : { error: true };
}

export function maps(raw) {
  const s = clean(raw); if (!s) return null;
  return /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)\//i.test(s) ? { value: /^https?:/.test(s) ? s : "https://" + s, label: "Google Maps", url: s } : { error: true };
}

// Indian mobile numbers by default (10 digits starting 6-9), any +country number otherwise
export function whatsapp(raw) {
  const s = clean(raw); if (!s) return null;
  const d = s.replace(/[^\d+]/g, "");
  if (/^(\+?91)?[6-9]\d{9}$/.test(d)) return { value: "+91" + d.slice(-10) };
  if (/^\+\d{8,15}$/.test(d)) return { value: d };
  return { error: true };
}

export function email(raw) {
  const s = clean(raw); if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? { value: s.toLowerCase() } : { error: true };
}
