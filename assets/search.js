/* FactoryPlug shared search engine.
 * Used by the homepage instant-search panel and /search.html.
 * Exposes window.FPSearch: loadIndex(), score(docs, q),
 * highlight(text, words), resultRow(doc, words), liveItem(doc, words), esc(),
 * url(path) — and FPSearch.onShard hook fired as each index shard arrives.
 */
(function () {
  "use strict";
  var cache = null;

  /* Site base path, derived from this script's own URL so search works on
     both the apex flavor (/) and the project flavor (/factoryplug-catalog).
     Previously every fetch()/link used a root-absolute path, which 404'd
     search entirely on the project subpath. */
  var FP_BASE = (function () {
    try {
      var s = document.querySelector('script[src*="search.js"]');
      var src = (s && s.getAttribute("src")) || "";
      var m = src.match(/^(.*)\/assets\/search\.js$/);
      return m ? m[1] : "";
    } catch (e) { return ""; }
  })();
  function fpUrl(p) { return FP_BASE + p; }

  /* Sharded index (scales past 4,000 products): one small core file
     (guides/pages/manufacturers) loads first so something renders instantly,
     then per-category shards stream in and FPSearch.onShard fires so live
     results refresh as each shard arrives. Phones never block on one giant
     JSON download/parse. */
  function loadIndex() {
    if (cache) return Promise.resolve(cache);
    return fetch(fpUrl("/search-index-manifest.json")).then(function (r) { return r.json(); })
      .then(function (m) {
        return fetch(fpUrl(m.core)).then(function (r) { return r.json(); })
          .then(function (core) {
            cache = core.slice();
            (m.shards || []).forEach(function (shard) {
              fetch(fpUrl(shard)).then(function (r) { return r.json(); })
                .then(function (docs) {
                  cache = cache.concat(docs);
                  if (window.FPSearch && window.FPSearch.onShard) {
                    try { window.FPSearch.onShard(cache); } catch (e) {}
                  }
                }).catch(function () {});
            });
            return cache;
          });
      });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function wordsOf(q) {
    return String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  }

  function score(docs, q) {
    var words = wordsOf(q);
    if (!words.length) return [];
    var out = [];
    docs.forEach(function (d) {
      var t = (d.t || "").toLowerCase(),
          k = (d.k || "").toLowerCase(),
          s = (d.s || "").toLowerCase();
      var sc = 0;
      words.forEach(function (w) {
        if (t.indexOf(w) !== -1) sc += 6;
        else if (k.indexOf(w) !== -1) sc += 3;
        else if (s.indexOf(w) !== -1) sc += 1;
      });
      if (sc > 0) out.push({ doc: d, score: sc });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  function highlight(text, words) {
    var out = esc(text);
    (words || []).forEach(function (w) {
      if (!w || w.length < 2) return;
      var re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  function priceSpan(d) {
    if (d.type !== "part" || d.pm == null) return "";
    return '<span class="conv-price" data-min="' + esc(d.pm) +
      '" data-max="' + esc(d.px) + '" data-cur="' + esc(d.pc || "USD") +
      '" data-orig="' + esc(d.pr || "") + '">' + esc(d.pr || "") + "</span>";
  }

  function typeLabel(d) {
    return d.type === "part" ? "Part" :
           d.type === "guide" ? "Guide" :
           d.type === "manufacturer" ? "Who Makes What" : "Page";
  }

  /* Full result row for /search.html */
  function resultRow(d, words) {
    var thumb = d.img ? '<img class="rthumb" src="' + esc(fpUrl(d.img)) + '" alt="" loading="lazy">' : "";
    var badge = d.win ? ' <span class="chip hot">\uD83D\uDD25 Winning</span>' : "";
    return '<div class="result-item">' + thumb + '<div style="min-width:0;flex:1">' +
      '<div class="rtype">' + typeLabel(d) + "</div>" +
      '<h3><a href="' + esc(fpUrl(d.u)) + '">' + highlight(d.t, words) + "</a></h3>" + badge +
      '<div class="rprice">' + priceSpan(d) + "</div>" +
      "<p>" + highlight(d.s, words) + "</p></div></div>";
  }

  /* Compact row for the homepage live-search dropdown */
  function liveItem(d, words) {
    var thumb = d.img ? '<img class="sl-thumb" src="' + esc(fpUrl(d.img)) + '" alt="" loading="lazy">' : "";
    var price = (d.type === "part" && d.pm != null)
      ? '<span class="sl-price">' + priceSpan(d) + "</span>" : "";
    return '<a class="sl-item" href="' + esc(fpUrl(d.u)) + '">' + thumb +
      '<span class="sl-name">' + highlight(d.t, words) + "</span>" + price + "</a>";
  }

  window.FPSearch = {
    loadIndex: loadIndex, score: score, wordsOf: wordsOf,
    highlight: highlight, resultRow: resultRow, liveItem: liveItem, esc: esc,
    url: fpUrl, onShard: null
  };
})();