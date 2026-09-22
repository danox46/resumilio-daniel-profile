import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "personal-dist", "dani");
const home = await readFile(resolve(root, "index.html"), "utf8");
const classic = await readFile(resolve(root, "classic", "index.html"), "utf8");
const spanish = await readFile(resolve(root, "es", "index.html"), "utf8");
const resume = JSON.parse(await readFile(resolve(root, "resume.json"), "utf8"));

assert.match(home, /<title>Daniel Rosales/);
assert.match(home, /href="https:\/\/danienremoto\.com\/dani\/"/);
assert.match(home, /href="\/dani\/assets\/[^" ]+\.css"/);
assert.match(home, /src="\/dani\/media\/avatar\/daniel-idle\.mp4"/);
assert.match(home, /href="\/dani\/classic\/#claim-/);
assert.match(classic, /href="\/dani\/"/);
assert.match(spanish, /href="https:\/\/danienremoto\.com\/dani\/es\/"/);
assert.ok(resume.claims?.length > 10);

for (const asset of ["media/avatar/daniel-idle.mp4", "media/avatar/daniel-smile.mp4", "favicon.svg", "graph.json", "llms.txt"]) {
  assert.ok((await stat(resolve(root, asset))).size > 0, `${asset} missing`);
}

for (const html of [home, classic, spanish]) {
  const unprefixed = [...html.matchAll(/(?:href|src)="\/(?!dani(?:\/|"))[^"#]+"/g)];
  assert.equal(unprefixed.length, 0, `Unprefixed local URLs: ${unprefixed.map(([value]) => value).join(", ")}`);
}
console.log("Personal /dani build: routes, assets, and local URLs verified.");
