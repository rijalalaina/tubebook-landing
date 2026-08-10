// The launch-promotion banner, on every page, driven by the app.
//
// ── Where the switch lives ─────────────────────────────────────────────────
// Admin → Cost controls → "Free monthly credits". That one dropdown decides
// what is granted AND what this site says. Set it to 0 and the banner and the
// hero line disappear within about a minute, with no edit here and no deploy.
//
// It used to be a flag in this file, which made ending a promotion advertised
// as "withdrawable at any time" a job for a developer and two deploys. The
// site now asks the app what the offer is, because the app is the only thing
// that knows what it is actually granting.
//
// ── What this canNOT switch off ────────────────────────────────────────────
// The <meta description> in each page's head. Crawlers read it before any
// script runs, so it is static by nature and still needs a manual edit when
// the promotion ends. It is also the least visible claim on the page, which is
// the right thing to be left behind.
var PROMO_ENDPOINT = 'https://app.tubebook.org/api/public/promo';

(function () {
  var KEY = 'tb-promo-dismissed';
  // Bump when the OFFER changes, so people who dismissed the old one see the
  // new one. Not for copy tweaks — a banner that keeps returning is one people
  // learn to ignore.
  var VERSION = '2026-08-free75';

  function dismissed() {
    try {
      return localStorage.getItem(KEY) === VERSION;
    } catch (e) {
      // Private browsing can throw. Showing the banner is the right failure.
      return false;
    }
  }

  // The hero carries its own sentence about the offer. It is part of the page
  // rather than injected, so when the promotion ends it has to be hidden here
  // too — otherwise the loud claim goes and a quieter one stays.
  function hideStaticPromoCopy() {
    var nodes = document.querySelectorAll('[data-promo]');
    for (var i = 0; i < nodes.length; i++) nodes[i].style.display = 'none';
  }

  function render(promo) {
    if (!promo || !promo.enabled) {
      hideStaticPromoCopy();
      return;
    }
    if (dismissed()) return;

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
      // index.html's nav is position:fixed and the other four are sticky. A
      // fixed nav is out of flow and would sit UNDER this banner unless its own
      // top moves; a sticky one only needs the body pushed down, and then
      // sticks just below the banner. Both rules together handle both pages.
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
      '<span>Launch offer: <strong>' + promo.credits + ' free credits every month</strong>' +
        ' — about two illustrated lead magnets, or one illustrated short book. While it lasts.</span>' +
      '<a class="tb-promo-cta" href="https://app.tubebook.org/signup' +
        '?utm_source=site&utm_medium=promo_banner">Start free</a>' +
      '<button type="button" aria-label="Dismiss">&times;</button>';

    document.body.insertBefore(bar, document.body.firstChild);
    document.documentElement.classList.add('tb-promo-on');

    // Measured, not assumed: the copy wraps to two lines on a narrow screen,
    // and a hard-coded height would leave the nav overlapping it there.
    var sync = function () {
      document.documentElement.style.setProperty('--tb-promo-h', bar.offsetHeight + 'px');
    };
    sync();
    window.addEventListener('resize', sync);

    bar.querySelector('button').addEventListener('click', function () {
      try {
        localStorage.setItem(KEY, VERSION);
      } catch (e) {
        // Not persisting is survivable; leaving the bar up is not.
      }
      bar.remove();
      document.documentElement.classList.remove('tb-promo-on');
      document.documentElement.style.removeProperty('--tb-promo-h');
    });
  }

  function start() {
    fetch(PROMO_ENDPOINT, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(render)
      // Fail CLOSED. A blip hides a live offer for one page view; the opposite
      // error advertises free credits the app has stopped granting, which is a
      // promise somebody then has to honour or explain.
      .catch(function () { render(null); });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
