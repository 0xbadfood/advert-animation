// One palette per station: the wall, the rug, the accent (card backings, pillars' trim) and the sky (background and
// fog as the camera arrives). Stations sit left to right at x = index * STATION_GAP (world.js).
export const STATION_ORDER = ["research", "hooks", "review", "direction", "voice", "visuals", "assembly"];

export const THEMES = {
  research: { wall: 0xdbe7ff, rug: 0xbfd2ff, accent: 0x3d6fe0, sky: 0xe6eeff, label: "the lab" },
  hooks: { wall: 0xffefd2, rug: 0xffd79a, accent: 0xe8a33a, sky: 0xfff4e0, label: "the ideas corner" },
  review: { wall: 0xffe1ea, rug: 0xffbfd1, accent: 0xe0567a, sky: 0xfff0f4, label: "the meeting room" },
  direction: { wall: 0xe7defe, rug: 0xcbb9ff, accent: 0x5b3fd1, sky: 0xf0eaff, label: "the film set" },
  voice: { wall: 0xd5f2ee, rug: 0xa3e0d7, accent: 0x1f9e8f, sky: 0xe4f8f5, label: "the booth" },
  visuals: { wall: 0xe1f5d9, rug: 0xbbe6ab, accent: 0x3f9a5e, sky: 0xedf9e8, label: "the studio" },
  assembly: { wall: 0xfff1c2, rug: 0xffdf85, accent: 0xc99a12, sky: 0xfff7dc, label: "the premiere" },
};

// the theme for a world x (the nearest station), and a blend for the camera between two stations
export function stationAt(x, gap) { return STATION_ORDER[Math.max(0, Math.min(STATION_ORDER.length - 1, Math.round(x / gap)))]; }
export function themeAt(x, gap) { return THEMES[stationAt(x, gap)]; }
export function blendAt(x, gap, key) {
  const f = Math.max(0, Math.min(STATION_ORDER.length - 1, x / gap)), i = Math.floor(f), t = f - i;
  const a = THEMES[STATION_ORDER[i]][key], b = THEMES[STATION_ORDER[Math.min(STATION_ORDER.length - 1, i + 1)]][key];
  return [a, b, t];
}
