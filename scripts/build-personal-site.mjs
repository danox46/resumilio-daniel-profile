import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "personal-dist");
await rm(output, { recursive: true, force: true });

const result = spawnSync(process.execPath, [resolve(root, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PUBLIC_SITE_ORIGIN: "https://danienremoto.com", PUBLIC_SITE_BASE: "/dani" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
