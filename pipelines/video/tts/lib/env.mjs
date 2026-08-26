import fs from "fs";
import path from "path";

export function loadEnv(rootDir) {
  const envPath = path.join(rootDir, "../../.env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (let line of content.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}
