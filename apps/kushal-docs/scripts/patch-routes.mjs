// The @cloudflare/vite-plugin regenerates dist/<name>/wrangler.json on every
// build and drops the `routes` from wrangler.jsonc. This re-injects the custom
// domain (and re-asserts the R2 binding) so `wrangler deploy` keeps
// kushal-docs.agrolloo.com attached and the DOCS bucket bound.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const f = "dist/kushal_docs/wrangler.json";
if (!existsSync(f)) {
  console.error(`patch-routes: ${f} not found (run build first)`);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(f, "utf8"));
cfg.routes = [{ pattern: "kushal-docs.agrolloo.com", custom_domain: true }];
if (!cfg.r2_buckets?.length) {
  cfg.r2_buckets = [{ binding: "DOCS", bucket_name: "kushal-docs" }];
}
writeFileSync(f, JSON.stringify(cfg, null, 2));
console.log("patch-routes: injected custom domain + R2 binding");
