// The @cloudflare/vite-plugin regenerates dist/<name>/wrangler.json on every
// build and drops the `routes` from wrangler.jsonc. This re-injects the custom
// domain so `wrangler deploy` keeps the app's domain attached.
// Usage: node scripts/patch-routes.mjs [sparkly]   (no arg = the owner's app)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TARGETS = {
  main: { dir: "dist/kushal_gym", host: "kushal-gym.agrolloo.com" },
  // The plugin names the folder after the top-level worker, whatever the env.
  sparkly: { dir: "dist/kushal_gym", host: "sparkly-poop.agrolloo.com" },
};
const t = TARGETS[process.argv[2] ?? "main"];
if (!t) {
  console.error(`patch-routes: unknown target ${process.argv[2]}`);
  process.exit(1);
}

const f = `${t.dir}/wrangler.json`;
if (!existsSync(f)) {
  console.error(`patch-routes: ${f} not found (run build first)`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(f, "utf8"));
cfg.routes = [{ pattern: t.host, custom_domain: true }];
writeFileSync(f, JSON.stringify(cfg, null, 2));
console.log(`patch-routes: injected custom domain ${t.host}`);
