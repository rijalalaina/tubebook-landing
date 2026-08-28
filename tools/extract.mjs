// Pulls the English strings out of the pages into i18n/<page>.en.json.
//
// Run it after editing any page in English. It only ever ADDS keys and reports
// ones that no longer appear, so a translation is never silently dropped
// because a sentence moved.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, DEFAULT_LOCALE, PAGES, keyOf, walk } from "./i18n.mjs";

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

  // ── Retired English takes its translations with it ──────────────────────
  // Reporting a retired key was not enough. The translations for it stayed in
  // every locale file, so wording removed from the English site was still
  // sitting in the repository in seven languages — which matters when the
  // reason for removing it was that the sentence should not be there at all.
  // Compared against the CURRENT English, not against what this run happened
  // to retire. A key orphaned by an earlier extract is just as orphaned, and
  // keying off `gone` left one behind for exactly that reason: wording removed
  // from the English site was still sitting in seven locale files afterwards.
  let pruned = 0;
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    const path = join(ROOT, "i18n", `${page}.${code}.json`);
    if (!existsSync(path)) continue;
    const cat = JSON.parse(readFileSync(path, "utf8"));
    let touched = false;
    for (const key of Object.keys(cat)) {
      if (found.has(key)) continue;
      delete cat[key];
      touched = true;
      pruned++;
    }
    if (touched) writeFileSync(path, JSON.stringify(cat, null, 2) + "\n");
  }

  console.log(
    `${page}: ${found.size} strings` +
      (gone.length ? ` (${gone.length} retired, ${pruned} translations pruned)` : ""),
  );
}
console.log(`\n${total} strings total`);
