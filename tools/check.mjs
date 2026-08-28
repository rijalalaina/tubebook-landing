// Finds translations that went wrong in ways the translator cannot see.
//
//   node tools/check.mjs              report
//   node tools/check.mjs --drop       delete them, so the next translate run redoes them
//
// ── Why length ─────────────────────────────────────────────────────────────
// The batch translator validates placeholders and entities, which catches a
// corrupted string. It cannot catch a WRONG one: a model that answers a
// 88-character question with "Acheteurs de livres" has produced valid French
// that means something else entirely, and nothing about the output says so.
//
// Length does say so. A translation a fraction of its source is either
// truncated or invented — both real, both found this way:
//   "— which facts, figures, names and claims may appear at all." -> "sustancia"
//   a 348-character passage on grounding rendered in 60
//
// It is a heuristic and it over-reports. That is the right way round: a false
// positive costs one string's worth of re-translation, a false negative ships.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, DEFAULT_LOCALE, PAGES } from "./i18n.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DROP = process.argv.includes("--drop");

/** Entities count as one character, not six, or every `&amp;` skews the ratio. */
const visible = (t) => t.replace(/&[a-zA-Z]+;/g, "x").length;

/**
 * Below this fraction of the source, a translation is suspect.
 *
 * Chinese is genuinely compact — "合作、集成、采访。" is a complete rendering of
 * "Collaborations, integrations, interviews." — so it is judged on its own
 * scale rather than flagged for being what it should be.
 */
// Tuned against the corpus, not guessed. At 0.22 Chinese reported nine
// correct translations — "平装书的常规设置。" IS "The normal setting for a trade
// paperback." in nine characters. The genuine Chinese failures sat far lower
// (a 55-character sentence rendered as "文本", 0.04), so the line belongs
// between them.
const FLOOR = { zh: 0.14, ar: 0.34 };
const DEFAULT_FLOOR = 0.38;

/** Short strings are noisy: a two-word label can halve legitimately. */
const MIN_SOURCE = 40;

let found = 0;
let dropped = 0;

for (const page of PAGES) {
  const enPath = join(ROOT, "i18n", `${page}.en.json`);
  if (!existsSync(enPath)) continue;
  const en = JSON.parse(readFileSync(enPath, "utf8"));

  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    const path = join(ROOT, "i18n", `${page}.${code}.json`);
    if (!existsSync(path)) continue;
    const cat = JSON.parse(readFileSync(path, "utf8"));
    const floor = FLOOR[code] ?? DEFAULT_FLOOR;
    let touched = false;

    for (const [key, src] of Object.entries(en)) {
      const value = cat[key];
      if (!value) continue;
      const s = visible(src);
      if (s < MIN_SOURCE) continue;
      if (visible(value) >= s * floor) continue;

      found++;
      console.log(`${page}/${code}  ${key}`);
      console.log(`   EN (${s}) ${src.slice(0, 78)}`);
      console.log(`   ${code.toUpperCase()} (${visible(value)}) ${value.slice(0, 78)}\n`);
      if (DROP) {
        delete cat[key];
        touched = true;
        dropped++;
      }
    }
    if (touched) writeFileSync(path, JSON.stringify(cat, null, 2) + "\n");
  }
}

console.log(found ? `${found} suspect` + (DROP ? `, ${dropped} dropped — re-run tools/translate.mjs` : "") : "nothing to flag");
