# Translating the site

The pages you edit stay where they are. `index.html` at the root **is** the
English site and the source everything else is generated from. Each other
language is written to its own directory — `/fr/index.html`, `/ar/help.html` —
so every translation is a real URL Google can rank in its own market, rather
than a variant hidden behind a cookie.

Eight languages: `en fr es pt de ru zh ar`. Arabic is right-to-left.

## The loop

```sh
node tools/extract.mjs      # English HTML  -> i18n/<page>.en.json
node tools/translate.mjs    # fills the gaps in i18n/<page>.<locale>.json
node tools/build.mjs        # writes /<locale>/<page>.html
```

This repo stores no secrets — it is a public static site, and a `.env` here is
one `git add .` away from being published. The key is read from the shell, or
from the app repo's `.env` if it sits beside this one; `--env <path>` points
somewhere else. DeepSeek by default, `--provider openai` to switch.

Run all three after editing any English page. `extract` and `translate` are
both incremental: a string that already has a translation is never re-sent and
never overwritten, so a wording you fixed by hand stays fixed.

`node tools/translate.mjs --dry-run` prints what a run would cost before it
costs it. A translation that changes an HTML entity or drops a placeholder is
rejected rather than saved: `&amp;` coming back as a bare `&` would corrupt the
page it is substituted into.

## Why keys are hashes of the English text

A key tied to position — `hero.p3` — silently re-points at different words the
moment a paragraph moves, and the French page keeps yesterday's translation
under today's sentence. Hashing the English means editing a sentence produces a
*new* key with no translation, which `build.mjs` reports as a gap. Loud, not
invisible.

The cost is that fixing a typo in English retires the old translations for that
string. That is the right trade: they were translations of different words.

## What the build adds to every page

- `<html lang dir>` — `dir="rtl"` for Arabic
- `hreflang` for all eight languages plus `x-default`, each pointing at every
  other. A partial set is treated by Google as an unconfirmed claim and ignored.
- a per-language `<link rel="canonical">`, replacing the original
- `lang-switcher.js`

Root-absolute internal links (`/help`) gain the language prefix. Assets do not:
one logo serves the whole site.

## The switcher, and the app

`lang-switcher.js` writes the choice to a `tubebook_locale` cookie scoped to
`.tubebook.org`. The app on `app.tubebook.org` reads that same cookie, so
someone who reads the pitch in French and clicks "Start free" lands in a French
app instead of being asked twice.

It is a script rather than markup on purpose: markup in the pages would be
picked up by the next extraction as more English to translate — the picker's own
language names, round and round.

## Untranslated strings

`build.mjs` leaves them in English and reports the count. A page that is 90%
French is usable; one with holes in it is not.
