// Shared machinery for translating the static site.
//
// ── Why there is no HTML library here ─────────────────────────────────────
// This repo has no package.json and is served straight off GitHub Pages: the
// files in it ARE the site. Adding a dependency would mean adding npm, a
// lockfile and node_modules to a repository whose whole virtue is that you can
// open a file and see what ships. The pages are hand-written and well-formed,
// so a small tokenizer that understands the subset actually used is a better
// trade than a parser that understands HTML nobody here writes.
//
// ── Why keys are content hashes ───────────────────────────────────────────
// A key derived from position ("hero.p3") silently re-points at different
// words the moment a paragraph moves, and the French page keeps the old
// translation under the new sentence. Hashing the English text means an edit
// produces a NEW key with no translation, which shows up as a gap the build
// reports — the failure is loud instead of invisible.
import { createHash } from "node:crypto";

export const LOCALES = [
  { code: "en", endonym: "English", dir: "ltr", hreflang: "en" },
  { code: "fr", endonym: "Français", dir: "ltr", hreflang: "fr" },
  { code: "es", endonym: "Español", dir: "ltr", hreflang: "es" },
  { code: "pt", endonym: "Português", dir: "ltr", hreflang: "pt" },
  { code: "de", endonym: "Deutsch", dir: "ltr", hreflang: "de" },
  { code: "ru", endonym: "Русский", dir: "ltr", hreflang: "ru" },
  { code: "zh", endonym: "中文", dir: "ltr", hreflang: "zh-Hans" },
  { code: "ar", endonym: "العربية", dir: "rtl", hreflang: "ar" },
];

export const DEFAULT_LOCALE = "en";
export const PAGES = ["index", "help", "support", "contact", "privacy", "terms"];

/** Elements whose text is code or styling, never prose. */
const OPAQUE = new Set(["script", "style", "noscript"]);

/**
 * Elements that live INSIDE a sentence rather than ending one.
 *
 * The tokenizer used to break a text run at every tag, so
 *   "Nothing reaches your files until you press <strong>Save</strong>, so one
 *    rebuild covers a whole review pass."
 * reached a translator as three unrelated pieces: a clause ending in "you
 * press", a button name, and a clause starting with a comma. That is 138 of
 * the 621 text blocks on this site — 22% of its prose — and it is why Chinese
 * rendered "Manage your plan and payment method from" as the single character
 * "从". No translator could have done better; the sentence was never shown to
 * them.
 *
 * These tags now travel WITH the text, so the catalog holds the whole sentence
 * and its emphasis, and the translation may move the emphasis to wherever that
 * language needs it.
 *
 * `a` is deliberately absent. Its href would ride along into the catalog and
 * into a model's output, and a rewritten URL is a worse failure than a split
 * sentence. `span` too: it is a styling hook here, not emphasis.
 */
const INLINE = new Set(["strong", "em", "b", "i", "code", "small", "mark", "u", "sub", "sup"]);

/** Attributes that hold words a reader sees. */
const ATTRS = new Set(["title", "alt", "placeholder", "aria-label"]);

/** <meta> names/properties worth translating — the rest are URLs and sizes. */
const META = new Set([
  "description",
  "og:title",
  "og:description",
  "twitter:title",
  "twitter:description",
  "keywords",
]);

export function keyOf(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 10);
}

/** Collapse the whitespace an HTML author uses for indentation. */
export function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** Worth translating? Skips markup artefacts, numbers and bare entities. */
export function translatable(text) {
  const t = normalize(text);
  if (t.length < 2) return false;
  if (!/[A-Za-z]/.test(t)) return false;          // numbers, punctuation, emoji
  if (/^&[a-z]+;$/.test(t)) return false;         // a lone &nbsp;
  return true;
}

/**
 * Walks the document and calls back on every piece of translatable text.
 *
 * `visit({ text, replace })` — call replace(newText) to substitute. The walker
 * returns the rebuilt document, so the same pass serves extraction (visit
 * records and replaces nothing) and generation (visit replaces).
 */
export function walk(html, visit) {
  let out = "";
  let i = 0;
  let skipUntil = null;

  // Text and the inline markup within it, held until a tag that really does
  // end the sentence. Flushing on every tag is what used to cut sentences in
  // three; flushing on BLOCK tags keeps them whole.
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    out += emitText(buffer, visit);
    buffer = "";
  };

  // Comments and the doctype are matched FIRST so they are stepped over as
  // markup. Without them the tokenizer, which only recognises tags beginning
  // with a letter, hands "<!-- NAV -->" to the walker as though it were a
  // sentence — and the site ships with its own comments translated into
  // Russian and rendered on the page.
  const TAG =
    /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  TAG.lastIndex = 0;
  let m;

  while ((m = TAG.exec(html)) !== null) {
    const textBefore = html.slice(i, m.index);

    if (skipUntil) {
      out += textBefore;
    } else if (textBefore) {
      buffer += textBefore;
    }

    // A comment or doctype: no capture groups, nothing to translate.
    if (m[1] === undefined) {
      if (!skipUntil) flush();
      out += m[0];
      i = TAG.lastIndex;
      continue;
    }

    const tagName = m[1].toLowerCase();
    const isClose = m[0][1] === "/";

    if (skipUntil) {
      if (isClose && tagName === skipUntil) skipUntil = null;
      out += m[0];
    } else if (!isClose && OPAQUE.has(tagName)) {
      flush();
      skipUntil = tagName;
      out += m[0];
    } else if (INLINE.has(tagName)) {
      // Part of the sentence, not the end of it.
      buffer += m[0];
    } else {
      flush();
      out += isClose ? m[0] : rewriteTag(m[0], tagName, m[2], visit);
    }
    i = TAG.lastIndex;
  }

  const tail = html.slice(i);
  if (skipUntil) {
    flush();
    out += tail;
  } else {
    buffer += tail;
    flush();
  }
  return out;
}

function emitText(chunk, visit) {
  const trimmed = normalize(chunk);
  if (!translatable(trimmed)) return chunk;
  const replaced = visit({ text: trimmed, kind: "text" });
  if (replaced === undefined || replaced === trimmed) return chunk;
  // Keep the author's surrounding whitespace so indentation survives.
  const lead = chunk.match(/^\s*/)[0];
  const trail = chunk.match(/\s*$/)[0];
  return lead + replaced + trail;
}

function rewriteTag(whole, tagName, attrText, visit) {
  let out = whole;

  const each = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
  const edits = [];
  let a;
  while ((a = each.exec(attrText)) !== null) {
    const [, name, value] = a;
    const lower = name.toLowerCase();

    let wanted = ATTRS.has(lower);
    if (tagName === "meta" && lower === "content") {
      const id = (attrText.match(/\b(?:name|property)\s*=\s*"([^"]*)"/i) || [])[1];
      wanted = META.has((id || "").toLowerCase());
    }
    if (tagName === "title") wanted = false;      // handled as element text
    if (!wanted || !translatable(value)) continue;

    const replaced = visit({ text: normalize(value), kind: `@${lower}` });
    if (replaced !== undefined && replaced !== value) {
      edits.push([a[0], `${name}="${escapeAttr(replaced)}"`]);
    }
  }
  for (const [from, to] of edits) out = out.replace(from, to);
  return out;
}

export function escapeAttr(s) {
  return s.replace(/"/g, "&quot;");
}
