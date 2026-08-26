// Fills the translation catalogs.
//
//   node tools/translate.mjs --dry-run
//   node tools/translate.mjs
//   node tools/translate.mjs --locale fr --page index
//   node tools/translate.mjs --provider openai
//
// The key is read from the shell, or from the app repo's .env beside this one.
// See tools/ai-provider.mjs — this repo deliberately stores no secrets.
//
// ── What this is and is not ───────────────────────────────────────────────
// It fills GAPS. Any key already present in a catalog is left exactly as it
// is, so a translation someone corrected by hand is never overwritten by a
// later run. That is what makes the machine pass and human review able to
// coexist: correct a string once and it stays corrected forever.
//
// It writes after every batch. Eighteen thousand words across seven languages
// is a long job, and losing an hour of it to one network error at the end
// would be the kind of failure that makes people not re-run it.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, DEFAULT_LOCALE, PAGES } from "./i18n.mjs";
import { loadEnv, pickProvider, completeJson } from "./ai-provider.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BATCH = 30;

const argv = process.argv.slice(2);
const envArg = argv.indexOf("--env") >= 0 ? argv[argv.indexOf("--env") + 1] : null;
loadEnv(envArg);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const DRY = argv.includes("--dry-run");
const onlyLocale = flag("locale");
const onlyPage = flag("page");

const targets = LOCALES.filter(
  (l) => l.code !== DEFAULT_LOCALE && (!onlyLocale || l.code === onlyLocale),
);
const pages = PAGES.filter((p) => !onlyPage || p === onlyPage);

const NAMES = {
  fr: "French", es: "Spanish", pt: "Brazilian Portuguese", de: "German",
  ru: "Russian", zh: "Simplified Chinese", ar: "Modern Standard Arabic",
};

function system(language) {
  return `You are translating the interface and marketing copy of TubeBook, a web app that turns YouTube videos and articles into publishable ebooks. Produce the ${language} version.

VOICE
- Translate for READERS of ${language}, not word for word. Marketing copy that reads like a translation does not sell. Write the sentence a ${language} copywriter would have written to make the same point.
- Keep the register: direct, confident, plain. Not corporate, not breathless.
- Keep it roughly the same LENGTH. This text sits in fixed layouts — buttons, nav items and cards — and a label three times longer than the English breaks the page it lives in.

GLOSSARY — translate these the SAME way every time
- "ebook": in a language written in the Latin alphabet, keep the English word "ebook" — it is the product's own vocabulary, and rendering it as "livre numérique" in one sentence and "ebook" in the next makes one product look like two. In a language NOT written in the Latin alphabet (Russian, Arabic, Chinese), use that language's own word: a Latin stem cannot take a Russian case ending, and Latin letters inside Arabic break the direction of the line.
- "credit" / "credits" — the app's currency. Pick the natural word in ${language} and use only that one, everywhere.
- "lead magnet" stays "lead magnet". It is marketing jargon with no settled translation, and the people buying this software use the English term.
- "outline", "chapter", "cover", "source" — ordinary words, translate them naturally, but pick one rendering per word and keep to it.

WHAT MUST NOT CHANGE
- "TubeBook" is a brand name and is never translated or transliterated.
- Product and company names stay as they are: YouTube, Amazon, KDP, Kindle, Audible, ACX, Kobo, Stripe, PDF, DOCX, EPUB, PPTX, MP3, WAV, ID3.
- Numbers, prices, credit amounts, percentages, file sizes and technical specs stay EXACTLY as written. They are facts about the product, not phrasing.
- HTML entities (&amp; &rsquo; &mdash; &nbsp; &times;) must be reproduced byte for byte. They are markup: "&" alone would corrupt the page.
- Placeholders in braces like {count} keep their exact spelling. They are replaced with values at runtime.

FORM
- A string that is a button or a nav label stays a label — no final period, no sentence.
- Keep any leading or trailing spaces exactly as given.
- Preserve capitalisation CONVENTION, not the letters: English title case becomes whatever that language uses for a heading.

Reply with a JSON object mapping each input id to its ${language} translation. No commentary, no markdown fence.`;
}

/**
 * Makes a translation safe to substitute back into the page.
 *
 * The model returns "Recherche & KDP" where the source had "&amp;" — the right
 * words, but a bare ampersand is not valid HTML. Rejecting those cost 302 good
 * translations on the first run; re-encoding them keeps the translation and
 * fixes the markup, which is what was wanted both times.
 *
 * Entities that came back intact are left alone: the negative lookahead means
 * an existing "&amp;" is not turned into "&amp;amp;".
 */
function sanitize(text) {
  return text
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * What must survive translation: the placeholders. Entity SPELLING may change
 * — sanitize() has already normalised it — but a dropped {placeholder} leaves
 * a hole in a sentence that nothing downstream can detect.
 */
function holes(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
}

async function translateBatch(provider, entries, language) {
  return completeJson(
    provider,
    system(language),
    JSON.stringify(Object.fromEntries(entries), null, 1),
  );
}

let pending = 0;
const plan = [];

for (const { code, endonym } of targets) {
  for (const page of pages) {
    const enPath = join(ROOT, "i18n", `${page}.en.json`);
    if (!existsSync(enPath)) continue;
    const en = JSON.parse(readFileSync(enPath, "utf8"));
    const outPath = join(ROOT, "i18n", `${page}.${code}.json`);
    const have = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
    const missing = Object.entries(en).filter(([k]) => !(k in have));
    if (missing.length) {
      pending += missing.length;
      plan.push({ code, endonym, page, outPath, have, missing });
    }
  }
}

if (DRY) {
  for (const p of plan) console.log(`${p.code}/${p.page}: ${p.missing.length} to translate`);
  const words = plan.reduce(
    (n, p) => n + p.missing.reduce((m, [, v]) => m + v.split(/\s+/).length, 0), 0);
  console.log(`\n${pending} strings, about ${words.toLocaleString()} words`);
  console.log(`${Math.ceil(pending / BATCH)} requests`);
  process.exit(0);
}

const provider = pickProvider(flag("provider"));
console.log(`translating with ${provider.name} (${provider.model})\n`);
let rejected = 0;

for (const { code, endonym, page, outPath, have, missing } of plan) {
  const language = NAMES[code] ?? endonym;
  for (let i = 0; i < missing.length; i += BATCH) {
    const slice = missing.slice(i, i + BATCH);
    const label = `${code}/${page} ${i + 1}-${i + slice.length}/${missing.length}`;
    try {
      const got = await translateBatch(provider, slice, language);
      let kept = 0;
      for (const [k, source] of slice) {
        const v = got[k];
        if (typeof v !== "string" || !v.trim()) continue;
        const clean = sanitize(v);
        if (holes(source) !== holes(clean)) {
          rejected++;
          continue;
        }
        have[k] = clean;
        kept++;
      }
      writeFileSync(outPath, JSON.stringify(have, null, 2) + "\n");
      console.log(`${label}  +${kept}`);
    } catch (err) {
      // Carry on: one failed batch should not abandon the other six languages.
      // The gap stays in the catalog and the next run picks it up.
      console.error(`${label}  FAILED — ${err.message}`);
    }
  }
}

if (rejected) console.log(`\n${rejected} rejected (entity or placeholder changed) — re-run to retry`);
console.log("\ndone — now run: node tools/build.mjs");
