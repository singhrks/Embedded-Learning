/* ==========================================================================
   Embedded Learning Hub — shared behaviour
   Builds the header, collapsible track sidebar, on-page TOC, prev/next,
   copy buttons, theme toggle and a full-manifest filter.
   Depends on assets/js/site.js (TRACKS).
   ========================================================================== */

const FLAT = [];
TRACKS.forEach(tr => tr.p.forEach((p, i) => FLAT.push({
  f: p[0], t: p[1], done: !!p[2], track: tr, num: String(i + 1).padStart(2, "0")
})));

function currentFile() {
  const p = decodeURIComponent(location.pathname).split("/").pop();
  return (!p || p === "") ? "index.html" : p;
}
function trackOf(file) {
  const e = FLAT.find(x => x.f === file);
  return e ? e.track : null;
}
function esc(s) { return s.replace(/&(?!\w+;)/g, "&amp;"); }

/* ---------- header ---------- */
function buildHeader() {
  const h = document.createElement("header");
  h.className = "site-header";
  h.innerHTML =
    '<button class="icon-btn" id="navToggle" aria-label="Toggle navigation">&#9776;</button>' +
    '<a class="brand" href="index.html"><span class="chip">EL</span>' +
      '<span class="brand-text">Embedded Learning Hub' +
      '<small>architecture &middot; languages &middot; kernels &middot; security &middot; AI</small></span></a>' +
    '<span class="header-spacer"></span>' +
    '<input class="search-box" id="navSearch" type="search" placeholder="Search all chapters..." aria-label="Search chapters">' +
    '<button class="icon-btn" id="themeToggle" aria-label="Toggle colour theme">&#9681;</button>';
  document.body.prepend(h);
}

/* ---------- sidebar ---------- */
function buildSidebar() {
  const here = currentFile();
  const openTrack = trackOf(here);
  const nav = document.createElement("nav");
  nav.className = "sidebar";
  nav.id = "sidebar";

  nav.innerHTML = TRACKS.map(tr => {
    const isOpen = openTrack && openTrack.id === tr.id;
    const done = tr.p.filter(p => p[2]).length;
    const items = tr.p.map((p, i) => {
      const n = String(i + 1).padStart(2, "0");
      const cls = [p[0] === here ? "active" : "", p[2] ? "" : "pending"].join(" ").trim();
      const label = '<span class="num">' + n + "</span>" + p[1];
      return p[2]
        ? '<a href="' + p[0] + '" class="' + cls + '" data-t="' + (tr.n + " " + p[1]).toLowerCase().replace(/"/g, "") + '">' + label + "</a>"
        : '<span class="pending" data-t="' + (tr.n + " " + p[1]).toLowerCase().replace(/"/g, "") + '">' + label + "</span>";
    }).join("");

    return '<div class="trk' + (isOpen ? " open" : "") + '" data-track="' + tr.id + '">' +
      '<button class="trk-head" type="button">' +
        '<span class="trk-ic">' + tr.ic + "</span>" +
        '<span class="trk-name">' + tr.n + "</span>" +
        '<span class="trk-count">' + done + "/" + tr.p.length + "</span>" +
        '<span class="trk-caret">&#9656;</span>' +
      "</button>" +
      '<div class="trk-body">' +
        '<a class="trk-index" href="track.html?t=' + tr.id + '">Track overview &rarr;</a>' +
        items +
      "</div></div>";
  }).join("");

  document.querySelector(".layout").prepend(nav);

  nav.querySelectorAll(".trk-head").forEach(b => {
    b.addEventListener("click", () => b.parentElement.classList.toggle("open"));
  });
}

/* ---------- on-page TOC ---------- */
function buildToc() {
  const content = document.querySelector(".content");
  const toc = document.createElement("aside");
  toc.className = "toc";
  toc.id = "toc";
  document.querySelector(".layout").append(toc);
  if (!content) return;

  const heads = [...content.querySelectorAll("h2, h3")];
  if (heads.length < 2) { toc.style.display = "none"; return; }

  let auto = 0;
  toc.innerHTML = "<strong>On this page</strong>" + heads.map(h => {
    if (!h.id) h.id = "s" + (++auto) + "-" + h.textContent.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return '<a href="#' + h.id + '" class="' + h.tagName.toLowerCase() + '">' +
           h.textContent.replace(/\s+/g, " ").trim() + "</a>";
  }).join("");

  const map = new Map();
  toc.querySelectorAll("a").forEach(a => map.set(a.getAttribute("href").slice(1), a));
  const obs = new IntersectionObserver(es => es.forEach(e => {
    const a = map.get(e.target.id);
    if (a && e.isIntersecting) {
      toc.querySelectorAll("a.active").forEach(x => x.classList.remove("active"));
      a.classList.add("active");
    }
  }), { rootMargin: "-70px 0px -75% 0px" });
  heads.forEach(h => obs.observe(h));
}

/* ---------- prev / next across the whole curriculum ---------- */
function buildPageNav() {
  const content = document.querySelector(".content");
  if (!content) return;
  const written = FLAT.filter(p => p.done);
  const i = written.findIndex(p => p.f === currentFile());
  if (i < 0) return;
  const prev = written[i - 1], next = written[i + 1];
  const el = document.createElement("nav");
  el.className = "pagenav";
  el.innerHTML =
    (prev ? '<a href="' + prev.f + '"><span class="dir">&larr; ' + esc(prev.track.n) +
            '</span><span class="ttl">' + prev.t + "</span></a>" : "") +
    (next ? '<a class="next" href="' + next.f + '"><span class="dir">' + esc(next.track.n) +
            ' &rarr;</span><span class="ttl">' + next.t + "</span></a>" : "");
  if (el.innerHTML) content.append(el);
}

/* ---------- chapter header chip ---------- */
function buildCrumbs() {
  const content = document.querySelector(".content");
  if (!content) return;
  const here = currentFile();
  const e = FLAT.find(x => x.f === here);
  if (!e || here === "index.html") return;
  const idx = e.track.p.findIndex(p => p[0] === here) + 1;
  const c = document.createElement("p");
  c.className = "crumbs";
  c.innerHTML = '<a href="index.html">Home</a> / <a href="track.html?t=' + e.track.id + '">' +
                esc(e.track.n) + "</a> / chapter " + String(idx).padStart(2, "0");
  content.prepend(c);
}

/* ---------- soften cross-references to chapters not yet published ----------
   A chapter may legitimately point forward to one still being written.
   Rather than leaving a dead link, render it as inert text with a marker. */
function softenPendingLinks() {
  const byFile = new Map(FLAT.map(p => [p.f, p]));
  document.querySelectorAll(".content a[href]").forEach(a => {
    const href = a.getAttribute("href").split("#")[0];
    const entry = byFile.get(href);
    if (!entry || entry.done) return;
    const span = document.createElement("span");
    span.className = "xref-pending";
    span.title = "This chapter is still being written";
    span.textContent = a.textContent;
    a.replaceWith(span);
  });
}

/* ---------- copy buttons ---------- */
function buildCopyButtons() {
  document.querySelectorAll(".content pre").forEach(pre => {
    if (pre.classList.contains("diagram")) return;
    let wrap = pre.parentElement;
    if (!wrap.classList.contains("codewrap")) {
      wrap = document.createElement("div");
      wrap.className = "codewrap";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.append(pre);
    }
    const b = document.createElement("button");
    b.className = "copy-btn";
    b.textContent = "copy";
    b.addEventListener("click", () => navigator.clipboard.writeText(pre.innerText).then(() => {
      b.textContent = "copied";
      setTimeout(() => (b.textContent = "copy"), 1200);
    }));
    wrap.append(b);
  });
}

/* ---------- theme ---------- */
function initTheme() {
  const root = document.documentElement;
  document.getElementById("themeToggle").addEventListener("click", () => {
    const now = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", now);
    localStorage.setItem("elh-theme", now);
  });
}

/* ---------- search / filter ---------- */
function initNavBits() {
  const bar = document.getElementById("sidebar");
  document.getElementById("navToggle").addEventListener("click", () => bar.classList.toggle("open"));
  bar.addEventListener("click", e => { if (e.target.closest("a")) bar.classList.remove("open"); });

  const search = document.getElementById("navSearch");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    bar.querySelectorAll(".trk").forEach(trk => {
      let hits = 0;
      trk.querySelectorAll("[data-t]").forEach(el => {
        const hit = !q || el.dataset.t.includes(q);
        el.classList.toggle("nohit", !hit);
        if (hit) hits++;
      });
      trk.classList.toggle("nohit", !!q && hits === 0);
      if (q && hits) trk.classList.add("open");
      if (!q) trk.classList.toggle("open", trk.dataset.track === (trackOf(currentFile()) || {}).id);
    });
  });

  const active = bar.querySelector("a.active");
  if (active) active.scrollIntoView({ block: "center" });
}

document.addEventListener("DOMContentLoaded", () => {
  buildHeader();
  buildSidebar();
  buildCrumbs();
  buildToc();
  buildPageNav();
  softenPendingLinks();
  buildCopyButtons();
  initTheme();
  initNavBits();
  if (window.renderPage) window.renderPage();
});

(function () {
  const s = localStorage.getItem("elh-theme");
  if (s) document.documentElement.setAttribute("data-theme", s);
})();
