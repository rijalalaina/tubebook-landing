// Pulls the English strings out of the pages into i18n/<page>.en.json.
//
// Run it after editing any page in English. It only ever ADDS keys and reports
// ones that no longer appear, so a translation is never silently dropped
// because a sentence moved.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, keyOf, walk } from "./i18n.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let total = 0;
for (const page of PAGES) {
  const file = join(ROOT, `${page}.html`);
  if (!existsSync(file)) {
    console.warn(`skip ${page}.html — not found`);
    continue;
  }
  const html = readFileSync(file, "utf8");

  const found = new Map();
  walk(html, ({ text }) => {
    found.set(keyOf(text), text);
    return undefined;                      // extraction changes nothing
  });

  const out = join(ROOT, "i18n", `${page}.en.json`);
  const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const gone = Object.keys(prev).filter((k) => !found.has(k));

  writeFileSync(out, JSON.stringify(Object.fromEntries(found), null, 2) + "\n");
  total += found.size;
  console.log(
    `${page}: ${found.size} strings` + (gone.length ? ` (${gone.length} retired)` : ""),
  );
}
console.log(`\n${total} strings total`);
