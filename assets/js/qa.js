/* ==========================================================================
   qa.js — interview question banks for the embedded system design track.

   The questions are STATIC HTML (<details class="qa">), so the page is
   fully readable with JavaScript disabled and prints correctly. This file
   adds two conveniences only:

     1. a "reveal all / hide all" control on each <div class="qbank">
     2. every answer opened before printing, so a PDF is complete

   ========================================================================== */

(function () {
  'use strict';

  function init() {
    var banks = document.querySelectorAll('.qbank');

    Array.prototype.forEach.call(banks, function (bank) {
      var cards = bank.querySelectorAll('details.qa');
      if (!cards.length) return;

      var head = bank.querySelector('.qbank-head');
      if (!head) return;

      /* question count, so the reader knows the size of the bank */
      var count = head.querySelector('.qbank-count');
      if (count && !count.textContent.trim()) {
        count.textContent = cards.length + (cards.length === 1 ? ' question' : ' questions');
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qbank-toggle';
      btn.textContent = 'Reveal all';
      btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        Array.prototype.forEach.call(cards, function (c) { c.open = !open; });
        btn.setAttribute('aria-expanded', String(!open));
        btn.textContent = open ? 'Reveal all' : 'Hide all';
      });

      /* keep the label honest if the reader opens cards by hand */
      Array.prototype.forEach.call(cards, function (c) {
        c.addEventListener('toggle', function () {
          var anyClosed = Array.prototype.some.call(cards, function (x) { return !x.open; });
          btn.setAttribute('aria-expanded', String(!anyClosed));
          btn.textContent = anyClosed ? 'Reveal all' : 'Hide all';
        });
      });

      head.appendChild(btn);
    });

    /* A printed page must contain the answers. Chrome's print-to-PDF
       fires beforeprint, so this covers both the browser's print dialog
       and a headless PDF build. */
    function openAll() {
      var all = document.querySelectorAll('details.qa');
      Array.prototype.forEach.call(all, function (d) { d.open = true; });
    }
    if (window.matchMedia) {
      var mql = window.matchMedia('print');
      if (mql.addEventListener) mql.addEventListener('change', function (e) { if (e.matches) openAll(); });
    }
    window.addEventListener('beforeprint', openAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
