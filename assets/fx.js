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
})();