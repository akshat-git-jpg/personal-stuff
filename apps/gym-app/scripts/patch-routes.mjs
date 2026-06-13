// The @cloudflare/vite-plugin regenerates dist/<name>/wrangler.json on every
// build and drops the `routes` from wrangler.jsonc. This re-injects the custom
// domain so `wrangler deploy` keeps kushal-gym.agrolloo.com attached.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const f = "dist/kushal_gym/wrangler.json";
if (!existsSync(f)) {
  console.error(`patch-routes: ${f} not found (run build first)`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(f, "utf8"));
cfg.routes = [{ pattern: "kushal-gym.agrolloo.com", custom_domain: true }];
writeFileSync(f, JSON.stringify(cfg, null, 2));
console.log("patch-routes: injected custom domain kushal-gym.agrolloo.com");
