// The free-monthly-credit banner, on every page, driven by the app.
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
  var VERSION = '2026-08-free100'; // offer ended Nov 2026; endpoint now reports enabled:false

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

  // ── Sales (Admin → Promotions) ──────────────────────────────────────────
  // An automatic sale, when one is running, replaces the free-credit banner
  // and shows the sale price on the pricing cards. The app applies the real
  // discount at checkout; this only announces it, with the same rules:
  // founding prices are never discounted.
  var SALE_TEXT = {
    en: ['{name}: {p}% off all plans', 'Monthly plans: first {m} months. Yearly plans: first year. Until {d}.', 'See prices', '{p}% off your first {m} months', '{p}% off your first year'],
    fr: ['{name} : -{p} % sur toutes les formules', 'Mensuel : vos {m} premiers mois. Annuel : votre première année. Jusqu’au {d}.', 'Voir les prix', '-{p} % sur vos {m} premiers mois', '-{p} % sur votre première année'],
    es: ['{name}: {p} % de descuento en todos los planes', 'Mensual: primeros {m} meses. Anual: primer año. Hasta el {d}.', 'Ver precios', '{p} % de descuento en tus primeros {m} meses', '{p} % de descuento en tu primer año'],
    pt: ['{name}: {p}% de desconto em todos os planos', 'Mensal: primeiros {m} meses. Anual: primeiro ano. Até {d}.', 'Ver preços', '{p}% de desconto nos primeiros {m} meses', '{p}% de desconto no primeiro ano'],
    de: ['{name}: {p} % Rabatt auf alle Pläne', 'Monatlich: erste {m} Monate. Jährlich: erstes Jahr. Bis {d}.', 'Preise ansehen', '{p} % Rabatt auf Ihre ersten {m} Monate', '{p} % Rabatt auf Ihr erstes Jahr'],
    ru: ['{name}: скидка {p}% на все планы', 'Ежемесячно: первые {m} мес. Ежегодно: первый год. До {d}.', 'Смотреть цены', 'Скидка {p}% на первые {m} мес.', 'Скидка {p}% на первый год'],
    zh: ['{name}：全部方案减 {p}%', '月付：前 {m} 个月。年付：首年。截止 {d}。', '查看价格', '前 {m} 个月减 {p}%', '首年减 {p}%'],
    ar: ['{name}: خصم {p}% على جميع الخطط', 'الشهري: أول {m} أشهر. السنوي: السنة الأولى. حتى {d}.', 'عرض الأسعار', 'خصم {p}% على أول {m} أشهر', 'خصم {p}% على السنة الأولى'],
  };

  function saleText(i, sale) {
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    var tpl = (SALE_TEXT[lang] || SALE_TEXT.en)[i];
    var d = new Date(sale.endsAt).toLocaleString(lang, { timeZone: 'UTC', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' GMT';
    return tpl.replace('{name}', sale.name).replace('{p}', sale.percentOff).replace('{m}', sale.monthlyMonths).replace('{d}', d);
  }

  // The pricing section of the page in the visitor's language.
  function pricingHref() {
    if (document.getElementById('pricing')) return '#pricing';
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    return (lang === 'en' ? '/' : '/' + lang + '/') + '#pricing';
  }

  function escapeHtml(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // Sale price on each card. Each card has a monthly and a yearly price
  // element (data-period); the Monthly/Yearly switch shows one of them.
  function applySaleToCards(sale) {
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    var prices = document.querySelectorAll('#pricing .plan-price[data-period]');
    for (var i = 0; i < prices.length; i++) {
      var el = prices[i];
      var yearly = el.getAttribute('data-period') === 'yearly';
      var byok = !!el.closest('#byok');
      if (yearly ? !sale.appliesYearly : !sale.appliesMonthly) continue;
      if (byok && !sale.appliesByok) continue;
      var node = null;
      for (var j = 0; j < el.childNodes.length; j++) {
        if (el.childNodes[j].nodeType === 3 && /\d/.test(el.childNodes[j].nodeValue)) node = el.childNodes[j];
      }
      if (!node) continue;
      var was = parseFloat(node.nodeValue.replace(/[^0-9.]/g, ''));
      if (!was) continue;
      var now = Math.round(was * (100 - sale.percentOff)) / 100;
      node.nodeValue = now.toLocaleString(lang, { minimumFractionDigits: now % 1 ? 2 : 0, maximumFractionDigits: 2 });
      var s = document.createElement('s');
      s.className = 'tb-was';
      s.textContent = ' $' + was;
      el.appendChild(s);
      var note = document.createElement('div');
      note.className = 'tb-sale-note';
      note.setAttribute('data-period', el.getAttribute('data-period'));
      note.textContent = saleText(yearly ? 4 : 3, sale);
      el.parentNode.insertBefore(note, el.nextSibling);
    }
    var style = document.createElement('style');
    style.textContent =
      '.tb-was{font-family:Outfit,sans-serif;font-size:1rem;font-weight:400;color:#7b7d8a;margin-inline-start:0.5rem;}' +
      '.tb-sale-note{font-size:0.8rem;font-weight:700;color:#ff9542;margin:-0.1rem 0 0.4rem;}' +
      '#pricing[data-billing="monthly"] .tb-sale-note[data-period="yearly"],#pricing[data-billing="yearly"] .tb-sale-note[data-period="monthly"]{display:none;}';
    document.head.appendChild(style);
  }

  function render(promo) {
    if (promo && promo.sale) {
      hideStaticPromoCopy();
      applySaleToCards(promo.sale);
      var saleVersion = 'sale-' + promo.sale.name + '-' + promo.sale.endsAt;
      try {
        if (localStorage.getItem(KEY) === saleVersion) return;
      } catch (e) {}
      VERSION = saleVersion;
      showBar(
        '<span><strong>' + escapeHtml(saleText(0, promo.sale)) + '</strong> — ' + escapeHtml(saleText(1, promo.sale)) + '</span>' +
          '<a class="tb-promo-cta" href="' + pricingHref() + '">' + escapeHtml(saleText(2, promo.sale)) + '</a>',
        promo.sale.name,
      );
      return;
    }
    if (!promo || !promo.enabled) {
      hideStaticPromoCopy();
      return;
    }
    if (dismissed()) return;
    showBar(
      '<span><strong>' + promo.credits + ' free credits every month</strong>' +
        ' — every feature included, no credit card required.</span>' +
        '<a class="tb-promo-cta" href="https://app.tubebook.org/signup' +
        '?utm_source=site&utm_medium=promo_banner">Start free</a>',
      'Free monthly credits',
    );
  }

  function showBar(inner, label) {
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
    bar.setAttribute('aria-label', label);
    bar.innerHTML = inner + '<button type="button" aria-label="Dismiss">&times;</button>';

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
