// Generates the per-language copies of the site.
//
//   node tools/build.mjs            build every locale
//   node tools/build.mjs fr de      build just those
//
// English is the SOURCE and stays where it is: tubebook.org/index.html is the
// file a person edits. Every other language is written to /<locale>/, which is
// what makes each translation a real URL a search engine can rank in its own
// market rather than a variant hidden behind a cookie.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, DEFAULT_LOCALE, PAGES, keyOf, walk, escapeAttr } from "./i18n.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://tubebook.org";

const only = process.argv.slice(2);
const targets = LOCALES.filter((l) => (only.length ? only.includes(l.code) : true));

const BEGIN = "<!-- i18n:begin -->";
const END = "<!-- i18n:end -->";

/** Root-absolute internal links have to carry the language with them. */
function localizeLinks(html, locale) {
  if (locale === DEFAULT_LOCALE) return html;
  const prefix = `/${locale}`;
  return html.replace(/\b(href|action)="([^"]*)"/g, (whole, attr, url) => {
    // Leave anchors, other origins, assets and mailto alone. An asset lives at
    // one path for the whole site — copying the logo into eight directories to
    // satisfy a rewrite would be eight times the bytes for no benefit.
    if (!url.startsWith("/") || url.startsWith("//")) return whole;
    if (/\.(png|jpe?g|svg|ico|css|js|webp|gif|pdf|xml|txt)$/i.test(url)) return whole;
    return `${attr}="${prefix}${url === "/" ? "/" : url}"`;
  });
}

/** hreflang, canonical and the switcher — the same block on every page. */
function headBlock(page, locale) {
  const path = page === "index" ? "/" : `/${page}`;
  const href = (code) =>
    code === DEFAULT_LOCALE ? `${SITE}${path}` : `${SITE}/${code}${path}`;

  const lines = [BEGIN];
  // Every language points at every other, itself included — a partial set is
  // treated by Google as an unconfirmed claim and largely ignored.
  for (const l of LOCALES) {
    lines.push(
      `<link rel="alternate" hreflang="${l.hreflang}" href="${escapeAttr(href(l.code))}" />`,
    );
  }
  lines.push(
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(href(DEFAULT_LOCALE))}" />`,
  );
  lines.push(`<link rel="canonical" href="${escapeAttr(href(locale))}" />`);
  lines.push(`<script src="/lang-switcher.js" defer></script>`);
  lines.push(END);
  return lines.join("\n");
}

/** Replaces any previous block, so the build is safe to re-run. */
function injectHead(html, block) {
  const existing = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`, "g");
  const cleaned = html.replace(existing, "");
  // The site already declares its own canonical; ours supersedes it per
  // language, so the original is dropped rather than left to compete.
  const withoutCanonical = cleaned.replace(/<link rel="canonical"[^>]*>\n?/g, "");
  return withoutCanonical.replace(/<\/head>/i, `${block}\n</head>`);
}

let built = 0;
const gaps = [];
const broken = [];

for (const { code: locale, dir } of targets) {
  for (const page of PAGES) {
    const source = join(ROOT, `${page}.html`);
    if (!existsSync(source)) continue;

    let html = readFileSync(source, "utf8");
    let missing = 0;

    if (locale !== DEFAULT_LOCALE) {
      const catalogPath = join(ROOT, "i18n", `${page}.${locale}.json`);
      const catalog = existsSync(catalogPath)
        ? JSON.parse(readFileSync(catalogPath, "utf8"))
        : {};

      html = walk(html, ({ text }) => {
        const hit = catalog[keyOf(text)];
        if (hit) return hit;
        missing++;
        // Untranslated text is left in English rather than blanked. A page
        // that is 90% French and 10% English is usable; one with holes in it
        // is not.
        return undefined;
      });

      html = html.replace(
        /<html[^>]*>/i,
        `<html lang="${locale}" dir="${dir}">`,
      );
      html = localizeLinks(html, locale);
    }

    // A translated page must have exactly the markup the English one has.
    //
    // Text is substituted into the document node by node, so a translation
    // containing a stray "<" or a mangled entity would change the tag count
    // and silently break the layout for one language — the kind of fault
    // nobody finds until a reader in that language reports it. Comparing
    // against the source is cheap and catches it at build time.
    if (locale !== DEFAULT_LOCALE) {
      const count = (text) => (text.match(/<[a-zA-Z/]/g) ?? []).length;
      const before = count(readFileSync(source, "utf8"));
      const after = count(html);
      if (before !== after) {
        broken.push(`${locale}/${page}: ${after} tags, English has ${before}`);
      }
    }

    html = injectHead(html, headBlock(page, locale));

    const outDir = locale === DEFAULT_LOCALE ? ROOT : join(ROOT, locale);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${page}.html`), html);
    built++;
    if (missing) gaps.push(`${locale}/${page}: ${missing} untranslated`);
  }
}

console.log(`built ${built} pages`);
if (broken.length) {
  console.log("\nMARKUP CHANGED — these pages differ structurally from English:");
  for (const b of broken) console.log("  " + b);
  process.exitCode = 1;
}
if (gaps.length) {
  console.log("\nstill English:");
  for (const g of gaps) console.log("  " + g);
  console.log("\nrun tools/translate.mjs to fill these in");
}
