import { defineConfig } from "vite";
import adanimeApi from "./server/api.js";

// Served as the user service advert-animation (port 5190), reached as https://adanime.photovault.live through Caddy
// on the VPN master. The dev server is used on purpose: edits go live without a deploy step. Everything sits behind
// the access key (server/api.js), including the finished films it reads from ~/advert/out.
export default defineConfig({
  plugins: [adanimeApi()],
  server: { host: "0.0.0.0", port: 5190, strictPort: true, allowedHosts: ["adanime.photovault.live", "localhost"] },
});
