// The language picker, on every page of the marketing site.
//
// ── Why this is a script and not markup ───────────────────────────────────
// The pages are the source the extractor reads. Markup injected into them by
// the build would be picked up on the next extraction as more English text to
// translate — the picker's own language names, round and round. A script is
// opaque to the extractor, so the control can live on every page without ever
// entering the catalog.
//
// ── Why the cookie has a domain ───────────────────────────────────────────
// The app lives on app.tubebook.org and this site on tubebook.org. Scoped to
// ".tubebook.org" the choice is one cookie shared by both, so someone who
// reads the pitch in French and clicks "Start free" lands in a French app
// instead of being asked twice.
(function () {
  var LOCALES = [
    { code: "en", endonym: "English", dir: "ltr" },
    { code: "fr", endonym: "Français", dir: "ltr" },
    { code: "es", endonym: "Español", dir: "ltr" },
    { code: "pt", endonym: "Português", dir: "ltr" },
    { code: "de", endonym: "Deutsch", dir: "ltr" },
    { code: "ru", endonym: "Русский", dir: "ltr" },
    { code: "zh", endonym: "中文", dir: "ltr" },
    { code: "ar", endonym: "العربية", dir: "rtl" },
  ];
  var COOKIE = "tubebook_locale";
  var codes = LOCALES.map(function (l) { return l.code; });

  // Where are we? /fr/help -> ["fr", "help"]. The prefix is only a locale if
  // it is one of ours: /privacy must not be read as a language called
  // "privacy" and rewritten into oblivion.
  var parts = location.pathname.split("/").filter(Boolean);
  var current = codes.indexOf(parts[0]) > 0 ? parts[0] : "en";
  var page = (current === "en" ? parts : parts.slice(1)).join("/");

  function urlFor(code) {
    var prefix = code === "en" ? "/" : "/" + code + "/";
    return prefix + page + location.hash;
  }

  function remember(code) {
    var domain = location.hostname.indexOf("tubebook.org") >= 0 ? ";domain=.tubebook.org" : "";
    document.cookie =
      COOKIE + "=" + code + ";path=/" + domain + ";max-age=31536000;samesite=lax";
  }

  var nav = document.querySelector("nav .nav-links");
  if (!nav) return;

  var wrap = document.createElement("div");
  wrap.className = "lang-switcher";

  var select = document.createElement("select");
  select.setAttribute("aria-label", "Language");
  // Styled here rather than in the stylesheet: the control is created by this
  // script, so its appearance travels with it and a page cannot end up with
  // the picker but not the rules that make it legible.
  select.style.cssText =
    "background:transparent;border:1px solid var(--border2,rgba(255,255,255,0.12));" +
    "color:var(--muted2,#a0a3b1);font:inherit;font-size:0.85rem;padding:0.3rem 0.5rem;" +
    "border-radius:8px;cursor:pointer;";
  // The dropdown itself is painted by the OS, which does not inherit the
  // page's dark palette — without this the open list is black on black.
  select.style.colorScheme = "dark";
  LOCALES.forEach(function (l) {
    var opt = document.createElement("option");
    opt.value = l.code;
    // Each option is stamped with its own language so the browser applies the
    // right bidi rules to العربية inside a left-to-right list.
    opt.setAttribute("lang", l.code);
    opt.setAttribute("dir", l.dir);
    opt.textContent = l.endonym;
    if (l.code === current) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", function () {
    remember(select.value);
    location.href = urlFor(select.value);
  });

  wrap.appendChild(select);
  nav.appendChild(wrap);

  // Renew the cookie for the page actually being read, so arriving on /de/
  // from a search result is itself a choice the app will honour.
  remember(current);
})();
