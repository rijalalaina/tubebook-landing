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

  // ── Phone menu ─────────────────────────────────────────────────────────
  // Below 760px every page hides .nav-links (and below 1100px this script
  // does too, for tablets), and with it this language
  // picker, so a phone visitor had neither the section links nor a way to
  // change language. A menu button reveals the same links as a drop-down
  // under the fixed header. Styles travel with the script, like the picker's.
  var bar = nav.parentElement;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-menu-btn";
  btn.setAttribute("aria-label", "Menu");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
  var cta = bar.querySelector(".nav-cta");
  bar.insertBefore(btn, cta ? cta.nextSibling : null);
  function setOpen(open) {
    bar.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function () { setOpen(!bar.classList.contains("nav-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });

  var css = document.createElement("style");
  css.textContent =
    ".nav-menu-btn{display:none;background:transparent;border:1px solid var(--border2,rgba(255,255,255,0.12));" +
    "color:var(--text,#f0eee8);border-radius:8px;width:40px;height:40px;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}" +
    // 1100px, not the pages' own 760px: on a tablet (768-1024px) the full row
    // of links does not fit beside the logo and button, and wrapped "How it
    // works" onto three lines while pushing "Start Free" off the screen.
    "@media(max-width:1100px){" +
    "nav .nav-links{display:none;}" +
    ".nav-menu-btn{display:inline-flex;margin-inline-start:0.5rem;}" +
    "nav.nav-open .nav-links{display:flex!important;flex-direction:column;align-items:flex-start;gap:1.1rem;" +
    "position:absolute;top:100%;left:0;right:0;padding:1.2rem 1.5rem 1.4rem;" +
    "background:var(--bg,#08090d);border-bottom:1px solid var(--border2,rgba(255,255,255,0.12));}" +
    "nav.nav-open .nav-links a{font-size:1rem;}" +
    "nav .nav-cta{margin-inline-start:auto;}" +
    "}" +
    "@media(max-width:420px){" +
    "nav .nav-logo img{height:34px!important;}" +
    "nav .nav-cta{padding:0.5rem 0.75rem!important;font-size:0.8rem!important;white-space:nowrap;}" +
    "}" +
    // The longest translations ("Kostenlos starten →") need the last pixels.
    "@media(max-width:430px){" +
    "nav{padding-left:1rem!important;padding-right:1rem!important;}" +
    "nav .nav-logo img{height:28px!important;}" +
    "nav .nav-cta{font-size:0.76rem!important;padding:0.45rem 0.6rem!important;}" +
    ".nav-menu-btn{width:36px;height:36px;margin-inline-start:0.4rem;}" +
    "}";
  document.head.appendChild(css);

  // Renew the cookie for the page actually being read, so arriving on /de/
  // from a search result is itself a choice the app will honour.
  remember(current);
})();
