// The launch-promotion banner, on every page, from one file.
//
// ── Why a shared script and not markup in five files ───────────────────────
// The offer is advertised as withdrawable at any time, and a right to withdraw
// is worth what exercising it costs. Pasted into five static pages, ending the
// promotion would mean editing five banners plus the hero plus the meta tags —
// and whichever one got missed would keep advertising credits the app had
// stopped granting. Here it is one object, below.
//
// ── Turning the promotion off ──────────────────────────────────────────────
// Set enabled to false. That is the whole procedure for this site. Do it at the
// same time as setting "Free monthly credits" to 0 in Admin → Cost controls,
// and as flipping LAUNCH_PROMO in the app repo — those three are what the site
// promises and what the app actually grants, and they have to agree.
const PROMO = {
  enabled: true,
  credits: 75,
  href: 'https://app.tubebook.org/signup',
  // Deliberately open-ended. There is no end date, so naming one — or worse,
  // counting down to one — would be inventing a deadline. "While it lasts" is
  // true, needs no maintenance if this runs for a year, and says the same thing
  // the terms say.
  text: 'Launch offer: <strong>75 free credits every month</strong> — about two illustrated lead magnets, or one illustrated short book. While it lasts.',
  cta: 'Start free',
  // Bumping this makes the banner reappear for people who dismissed the old
  // one. Change it only when the OFFER changes, not for copy tweaks — a banner
  // that keeps coming back is one people learn to ignore.
  version: '2026-08-free75',
};

(function () {
  if (!PROMO.enabled) return;

  var KEY = 'tb-promo-dismissed';
  try {
    if (localStorage.getItem(KEY) === PROMO.version) return;
  } catch (e) {
    // Private browsing can throw on localStorage. Showing the banner is the
    // right failure: a promotion nobody sees is worse than one shown twice.
  }

  var style = document.createElement('style');
  style.textContent = [
    '.tb-promo{position:fixed;top:0;left:0;right:0;z-index:200;display:flex;align-items:center;',
    'justify-content:center;gap:14px;flex-wrap:wrap;padding:9px 44px 9px 20px;',
    'background:linear-gradient(90deg,#ff6200 0%,#ff8c42 100%);color:#12131a;',
    'font-size:0.86rem;font-weight:500;line-height:1.35;text-align:center;}',
    '.tb-promo strong{font-weight:800;}',
    '.tb-promo a.tb-promo-cta{background:#12131a;color:#fff;text-decoration:none;',
    'padding:4px 14px;border-radius:999px;font-weight:700;font-size:0.82rem;white-space:nowrap;}',
    '.tb-promo a.tb-promo-cta:hover{opacity:0.85;}',
    '.tb-promo button{position:absolute;right:12px;top:50%;transform:translateY(-50%);',
    'background:none;border:0;color:#12131a;font-size:20px;line-height:1;cursor:pointer;',
    'opacity:0.55;padding:4px 8px;}',
    '.tb-promo button:hover{opacity:1;}',
    // The banner is fixed, so every page needs its top offset by the banner's
    // height. A sticky nav flows in normal document order and only needs the
    // body pushed down; a FIXED nav (index.html) is taken out of flow entirely
    // and would sit underneath the banner unless its own top is moved too.
    'html.tb-promo-on body{padding-top:var(--tb-promo-h,44px);}',
    'html.tb-promo-on nav{top:var(--tb-promo-h,44px);}',
    '@media(max-width:760px){.tb-promo{font-size:0.78rem;padding:8px 40px 8px 14px;}}',
  ].join('');
  document.head.appendChild(style);

  var bar = document.createElement('div');
  bar.className = 'tb-promo';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Launch offer');
  bar.innerHTML =
    '<span>' + PROMO.text + '</span>' +
    '<a class="tb-promo-cta" href="' + PROMO.href + '?utm_source=site&utm_medium=promo_banner">' +
      PROMO.cta + '</a>' +
    '<button type="button" aria-label="Dismiss">&times;</button>';

  function place() {
    document.body.insertBefore(bar, document.body.firstChild);
    document.documentElement.classList.add('tb-promo-on');
    // Measured rather than assumed: the copy wraps to two lines on a narrow
    // screen, and a hard-coded height would leave the nav overlapping it.
    var sync = function () {
      document.documentElement.style.setProperty('--tb-promo-h', bar.offsetHeight + 'px');
    };
    sync();
    window.addEventListener('resize', sync);
  }

  if (document.body) place();
  else document.addEventListener('DOMContentLoaded', place);

  bar.querySelector('button').addEventListener('click', function () {
    try {
      localStorage.setItem(KEY, PROMO.version);
    } catch (e) {
      // Dismissal not persisting is survivable; leaving the bar up is not.
    }
    bar.remove();
    document.documentElement.classList.remove('tb-promo-on');
    document.documentElement.style.removeProperty('--tb-promo-h');
  });
})();
