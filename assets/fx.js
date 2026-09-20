/* FactoryPlug client-side currency localization.
 *
 * Alibaba shows prices in the visitor's region, so FactoryPlug does the same:
 * each price carries its source currency (data-cur) and is converted in the
 * visitor's browser: source -> USD -> visitor currency. Default is USD; a
 * non-USD listing still converts for US visitors. Conversion is skipped only
 * when source and visitor currencies match. Converted prices are always
 * approximate and carry an on-page note + a tooltip showing the original
 * listing price.
 *
 * APPROXIMATE RATES (USD base, updated manually — see README "Currency"):
 *   USD 1 | GBP 0.79 | EUR 0.92 | CAD 1.37 | AUD 1.53 | AED 3.67 | SAR 3.75
 *
 * Detection: navigator.language region subtag (e.g. en-GB -> GBP). No
 * geolocation API, no network calls, no cookies.
 */
(function () {
  "use strict";

  var RATES = { USD: 1, GBP: 0.79, EUR: 0.92, CAD: 1.37, AUD: 1.53, AED: 3.67, SAR: 3.75 };

  // region -> currency (only regions we have approximate rates for)
  var REGION_CUR = {
    US: "USD",
    GB: "GBP", GG: "GBP", IM: "GBP", JE: "GBP",
    IE: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
    BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
    SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR",
    MT: "EUR", HR: "EUR",
    CA: "CAD", AU: "AUD", AE: "AED", SA: "SAR"
  };

  function detectCurrency() {
    try {
      var lang = navigator.language || navigator.userLanguage || "en-US";
      var parts = String(lang).split(/[-_]/);
      var region = (parts[1] || "US").toUpperCase();
      var cur = REGION_CUR[region];
      return (cur && RATES[cur]) ? cur : "USD";
    } catch (e) {
      return "USD";
    }
  }

  var target = detectCurrency();

  var api = { target: target, converted: false };

  function convertScope(scope) {
    if (!RATES[target]) return;
    var nf;
    try {
      nf = new Intl.NumberFormat(navigator.language || "en-US",
        { style: "currency", currency: target, maximumFractionDigits: 0 });
    } catch (e) { return; }

    // Rates are "units per 1 USD": amount_in_src / RATES[src] = USD value.
    // Convert source -> USD -> target. Skip only when source == target.
    function toTarget(amount, srcCur) {
      var usd = amount / (RATES[srcCur] || 1);
      return usd * RATES[target];
    }
    function fmt(amount, srcCur) { return nf.format(Math.round(toTarget(amount, srcCur))); }
    function range(min, max, srcCur) {
      return min === max ? fmt(min, srcCur) : fmt(min, srcCur) + "\u2013" + fmt(max, srcCur);
    }

    var els = (scope || document).querySelectorAll(".conv-price[data-min]:not([data-fx])");
    els.forEach(function (el) {
      var min = parseFloat(el.getAttribute("data-min"));
      var maxv = parseFloat(el.getAttribute("data-max") || el.getAttribute("data-min"));
      if (isNaN(min)) return;
      var orig = el.getAttribute("data-orig") || el.textContent.trim();
      var srcCur = (el.getAttribute("data-cur") || "USD").toUpperCase();
      if (!RATES[srcCur]) srcCur = "USD";
      el.setAttribute("data-fx", "1"); // never convert twice
      if (srcCur === target) return; // already in the visitor's currency
      el.textContent = "\u2248 " + range(min, maxv, srcCur);
      el.classList.add("converted");
      el.setAttribute("title", "Listed as " + orig + " (" + srcCur + "). " +
        "\u2248 Approximate conversion \u2014 the live Alibaba listing shows the exact price.");
      var note = document.createElement("span");
      note.className = "fx-note";
      note.textContent = "\u2248 approximate \u2014 the live Alibaba listing shows the exact price";
      el.insertAdjacentElement("afterend", note);
    });

    api.converted = true;
    api.fmt = fmt;
    api.range = range;
  }

  // Convert everything present at load; pages that render prices later
  // (search results) call window.__fp_convert(container) afterwards.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { convertScope(document); });
  } else {
    convertScope(document);
  }
  window.__fp_convert = convertScope;
  window.__factoryplug_fx = api;

  // ---- Fitment verification modal (Buyer-to-Factory Communication Protocol) ----
  // Intercepts all outbound sponsored supplier links so the buyer reads the
  // 5-point fitment briefing before reaching the factory chat. Professional
  // B2B-sourcing framing: no scam talk, just standard procedure.
  (function fitmentModal() {
    var MODAL_HTML =
      '<div class="fp-modal-backdrop" id="fpFitModal" role="dialog" aria-modal="true" aria-labelledby="fpFitTitle">' +
      '<div class="fp-modal">' +
      '<h2 id="fpFitTitle">Fitment Verification</h2>' +
      '<p class="fp-sub">You\'re one click from the supplier. Professional buyers on Alibaba confirm fitment <b>in writing</b> before money moves — this is standard operating procedure in global B2B automotive sourcing. Have these five things ready:</p>' +
      '<ol class="fp-checklist">' +
      '<li><b>1. Exact chassis code + trim/package</b>Year/make/model isn\'t enough. Send the chassis code (F30, G80, S650\u2026) and your exact trim/package — they determine mounting points, clearances, and connector types.</li>' +
      '<li><b>2. Your full 17-digit VIN</b>Find it on the driver-side dash, the door jamb, or the B-pillar sticker. The VIN pins down your exact build — send it so the factory can verify against the right specification.</li>' +
      '<li><b>3. The OE part number</b>Read the Original Equipment number off your existing component. It\'s the most precise way to match the replacement.</li>' +
      '<li><b>4. Clear photos</b>Sharp shots of the mounting points and connectors. If anything looks off, the engineer will spot it before you pay.</li>' +
      '<li><b>5. Written confirmation</b>Get the factory\'s fitment confirmation in writing in the Alibaba chat <b>before</b> payment. A one-line &ldquo;yes, it fits&rdquo; is your evidence if the wrong part shows up.</li>' +
      '</ol>' +
      '<div class="fp-actions">' +
      '<button class="fp-continue" id="fpFitContinue">Continue to supplier &rarr;</button>' +
      '<a class="fp-scripts" href="/factoryplug-catalog/guides/alibaba-chat-scripts.html">Copy a factory chat script</a>' +
      '<button class="fp-close" id="fpFitClose">Not yet</button>' +
      '</div>' +
      '<p class="fp-note">Keep the whole conversation in the Alibaba chat — every message is timestamped in your order record.</p>' +
      '</div></div>';

    var pendingHref = null;
    var backdrop = null;
    var triggerEl = null;

    function openModal(href, trigger) {
      pendingHref = href;
      triggerEl = trigger || null;
      if (!backdrop) {
        var wrap = document.createElement('div');
        wrap.innerHTML = MODAL_HTML;
        backdrop = wrap.firstChild;
        document.body.appendChild(backdrop);
        backdrop.querySelector('#fpFitContinue').addEventListener('click', function () {
          // Save the destination BEFORE closeModal() clears it.
          var dest = pendingHref;
          closeModal();
          // Opened inside a real user gesture so popup blockers stay happy.
          if (dest) window.open(dest, '_blank', 'noopener');
        });
        backdrop.querySelector('#fpFitClose').addEventListener('click', closeModal);
        backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
        document.addEventListener('keydown', function (e) {
          if (!backdrop.classList.contains('open')) return;
          if (e.key === 'Escape') { closeModal(); return; }
          // Focus trap: keep Tab cycling inside the modal.
          if (e.key === 'Tab') {
            var focusables = backdrop.querySelectorAll('button, a[href]');
            if (!focusables.length) return;
            var first = focusables[0], last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        });
      }
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
      var btn = backdrop.querySelector('#fpFitContinue');
      if (btn) btn.focus();
    }

    function closeModal() {
      if (backdrop) backdrop.classList.remove('open');
      document.body.style.overflow = '';
      pendingHref = null;
      if (triggerEl && document.contains(triggerEl)) {
        try { triggerEl.focus(); } catch (err) {}
      }
      triggerEl = null;
    }

    // Instant interception of the approved product CTA only
    // (a.btn.buy with a real affiliate href). Disabled/pending CTAs are
    // <span>, not <a>, so they never reach here.
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a.btn.buy[rel~="sponsored"]');
      if (!a || !a.href) return;
      e.preventDefault();
      openModal(a.href, a);
    }, true);
  })();

  // ---- Copy-to-clipboard for chat scripts ([data-copy] buttons) ----
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var src = document.querySelector(btn.getAttribute('data-copy'));
    if (!src) return;
    var text = src.innerText;
    function done() {
      var orig = btn.textContent;
      btn.textContent = 'Copied ✓';
      btn.disabled = true;
      setTimeout(function () { btn.textContent = orig; btn.disabled = false; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (err) {}
      document.body.removeChild(ta);
    }
  });
})();