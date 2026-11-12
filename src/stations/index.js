import { STATION_GAP } from "../world/world.js";
import * as research from "./research.js";
import * as hooks from "./hooks.js";
import * as review from "./review.js";
import * as direction from "./direction.js";
import * as voice from "./voice.js";
import * as visuals from "./visuals.js";
import * as assembly from "./assembly.js";

// Stations left to right: the pipeline is a walk through one studio.
export const ORDERED = [research, hooks, review, direction, voice, visuals, assembly];

export function buildStations(world) {
  const out = {};
  ORDERED.forEach((m, i) => { const st = m.build(world, i * STATION_GAP); out[st.name] = st; world.stations[st.name] = st; });
  return out;
}
