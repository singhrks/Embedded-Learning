/* ==========================================================================
   judge.js — renders DSA problem cards and runs your solution against test
   cases entirely in the browser. No server, no network, no build step.

   A page declares a global PROBLEMS array and an empty <div id="problems">.
   Each problem:

     {
       id:        'two-sum',                 // unique on the page
       title:     'Two Sum',
       difficulty:'Easy' | 'Medium' | 'Hard',
       pattern:   'Hash map complement',     // the pattern tag
       statement: '<p>…</p>',                // HTML
       examples:  [{in:'…', out:'…', note:'…'}],
       hints:     ['…','…'],
       approaches:[{name, idea, time, space, best:true}],
       fn:        'twoSum',                  // function the solver defines
       sig:       'twoSum(nums, target) -> number[]',
       starter:   'function twoSum(nums, target) {\n  \n}',
       argTypes:  ['value','value'],         // 'value'|'list'|'tree'
       retType:   'value',                   // 'value'|'list'|'tree'
       compare:   'deep',                    // see compareModes below
       checkArg:  0,                         // compare this ARG after the
                                             // call instead of the return
       verify:    'function(got,args,exp){…}',// escape hatch, as a string
       tests:     [{args:[[2,7,11,15],9], expect:[0,1]}],
       solutions: { js:'…', cpp:'…', python:'…', java:'…' },
       walkthrough:'<p>…</p>'
     }

   COMPARE MODES
     deep         strict structural equality (default)
     unordered    top-level order does not matter
     unorderedDeep each inner array sorted, then outer sorted (3Sum, subsets)
     approx       numeric, 1e-6 tolerance
     any          always pass if no error (use with verify)
   ========================================================================== */

(function () {
  'use strict';

  var STORE = 'dsa:';                 // localStorage prefix for saved code
  var TIMEOUT_MS = 4000;

  /* ---------- the code that runs inside the sandbox ---------------------
     Kept as a string so it can be injected into a Worker, or into a
     Function() when Workers are unavailable (file:// in some browsers).   */
  var PRELUDE = [
    'function ListNode(val, next){ this.val = (val===undefined?0:val); this.next = (next===undefined?null:next); }',
    'function TreeNode(val,left,right){ this.val=(val===undefined?0:val); this.left=(left===undefined?null:left); this.right=(right===undefined?null:right); }',
    'function buildList(a){ var h=null,t=null; for(var i=0;i<(a||[]).length;i++){ var n=new ListNode(a[i]); if(!h){h=n;t=n;} else {t.next=n;t=n;} } return h; }',
    'function listToArray(h){ var r=[],g=0; while(h){ r.push(h.val); h=h.next; if(++g>100000) throw new Error("cycle or runaway list"); } return r; }',
    'function buildTree(a){ a=a||[]; if(!a.length||a[0]===null) return null;',
    '  var root=new TreeNode(a[0]), q=[root], i=1;',
    '  while(q.length && i<a.length){ var n=q.shift();',
    '    if(i<a.length){ var lv=a[i++]; if(lv!==null&&lv!==undefined){ n.left=new TreeNode(lv); q.push(n.left);} }',
    '    if(i<a.length){ var rv=a[i++]; if(rv!==null&&rv!==undefined){ n.right=new TreeNode(rv); q.push(n.right);} } }',
    '  return root; }',
    'function treeToArray(r){ if(!r) return []; var out=[],q=[r];',
    '  while(q.length){ var n=q.shift(); if(n){ out.push(n.val); q.push(n.left); q.push(n.right);} else out.push(null); }',
    '  while(out.length && out[out.length-1]===null) out.pop(); return out; }',
    'function __hydrate(v,t){ return t==="list"?buildList(v) : t==="tree"?buildTree(v) : v; }',
    'function __dry(v,t){ return t==="list"?listToArray(v) : t==="tree"?treeToArray(v) : v; }',
    'function __eq(a,b){',
    '  if(a===b) return true;',
    '  if(typeof a==="number"&&typeof b==="number") return (a!==a&&b!==b)||a===b;',
    '  if(Array.isArray(a)&&Array.isArray(b)){ if(a.length!==b.length) return false;',
    '    for(var i=0;i<a.length;i++) if(!__eq(a[i],b[i])) return false; return true; }',
    '  if(a&&b&&typeof a==="object"&&typeof b==="object"){',
    '    var ka=Object.keys(a),kb=Object.keys(b); if(ka.length!==kb.length) return false;',
    '    for(var j=0;j<ka.length;j++) if(!__eq(a[ka[j]],b[ka[j]])) return false; return true; }',
    '  return false; }',
    'function __key(x){ return JSON.stringify(x); }',
    'function __sortDeep(x){ if(!Array.isArray(x)) return x;',
    '  var c=x.map(function(e){ return Array.isArray(e)?e.slice().sort(function(p,q){return __key(p)<__key(q)?-1:1;}):e; });',
    '  return c.sort(function(p,q){ return __key(p)<__key(q)?-1:1; }); }',
    'function __cmp(got,exp,mode){',
    '  if(mode==="any") return true;',
    '  if(mode==="approx"){ if(typeof got!=="number"||typeof exp!=="number") return __eq(got,exp); return Math.abs(got-exp)<1e-6; }',
    '  if(mode==="unordered"){ if(!Array.isArray(got)||!Array.isArray(exp)) return __eq(got,exp);',
    '    var g=got.slice().sort(),e=exp.slice().sort(); return __eq(g,e); }',
    '  if(mode==="unorderedDeep") return __eq(__sortDeep(got),__sortDeep(exp));',
    '  return __eq(got,exp); }'
  ].join('\n');

  var HARNESS = [
    'function __run(spec, userFnName){',
    '  var fn = (typeof self!=="undefined" && self[userFnName]) || __lookup(userFnName);',
    '  if(typeof fn!=="function") throw new Error("No function named \\"" + userFnName + "\\" was defined.");',
    '  var out=[], t0=__now();',
    '  for(var i=0;i<spec.tests.length;i++){',
    '    var t=spec.tests[i], res, err=null, got;',
    '    var live = t.args.map(function(a,k){ return __hydrate(__clone(a), (spec.argTypes&&spec.argTypes[k])||"value"); });',
    '    var shown = t.args.map(function(a){ return __fmt(a); }).join(", ");',
    '    try {',
    '      res = fn.apply(null, live);',
    '      if(spec.checkArg!==undefined && spec.checkArg!==null){',
    '        got = __dry(live[spec.checkArg], (spec.argTypes&&spec.argTypes[spec.checkArg])||"value");',
    '      } else { got = __dry(res, spec.retType||"value"); }',
    '      var ok;',
    '      if(spec.verify){ ok = !!__verify(got, t.args, t.expect, res); }',
    '      else ok = __cmp(got, t.expect, spec.compare||"deep");',
    '      out.push({ ok:ok, in:shown, exp:__fmt(t.expect), got:__fmt(got) });',
    '    } catch(e) {',
    '      out.push({ ok:false, in:shown, exp:__fmt(t.expect), got:null, err:(e&&e.message)||String(e) });',
    '    }',
    '  }',
    '  return { tests:out, ms: Math.round((__now()-t0)*100)/100 };',
    '}',
    'function __clone(v){ return v===undefined?v:JSON.parse(JSON.stringify(v)); }',
    'function __fmt(v){ if(v===undefined) return "undefined"; try { return JSON.stringify(v); } catch(e){ return String(v); } }',
    'function __now(){ return (typeof performance!=="undefined"&&performance.now)?performance.now():Date.now(); }'
  ].join('\n');

  /* ---------- Worker path ---------------------------------------------- */
  function workerSource(userCode, spec) {
    return [
      'var __logs=[];',
      'var console={ log:function(){ __logs.push(Array.prototype.map.call(arguments,function(a){',
      '  try{ return typeof a==="string"?a:JSON.stringify(a);}catch(e){return String(a);} }).join(" ")); },',
      '  error:function(){ console.log.apply(null,arguments); }, warn:function(){ console.log.apply(null,arguments); },',
      '  info:function(){ console.log.apply(null,arguments); } };',
      PRELUDE,
      'function __lookup(n){ try { return eval(n); } catch(e){ return undefined; } }',
      spec.verify ? 'var __verify = ' + spec.verify + ';' : 'var __verify = null;',
      HARNESS,
      '/* ---- user code ---- */',
      userCode,
      '/* ---- end user code ---- */',
      'self.onmessage = function(ev){',
      '  var spec = ev.data;',
      '  try { var r = __run(spec, spec.fn); r.logs = __logs; self.postMessage({ ok:true, result:r }); }',
      '  catch(e){ self.postMessage({ ok:false, error:(e&&e.message)||String(e), logs:__logs }); }',
      '};'
    ].join('\n');
  }

  function runInWorker(userCode, spec, cb) {
    var url, w;
    try {
      var blob = new Blob([workerSource(userCode, spec)], { type: 'text/javascript' });
      url = URL.createObjectURL(blob);
      w = new Worker(url);
    } catch (e) {
      return cb({ unsupported: true });
    }
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      try { w.terminate(); } catch (e) {}
      URL.revokeObjectURL(url);
      cb({ ok: false, error: 'Timed out after ' + (TIMEOUT_MS / 1000) + 's — likely an infinite loop.' });
    }, TIMEOUT_MS);

    w.onmessage = function (ev) {
      if (done) return;
      done = true; clearTimeout(timer);
      try { w.terminate(); } catch (e) {}
      URL.revokeObjectURL(url);
      cb(ev.data);
    };
    w.onerror = function (ev) {
      if (done) return;
      done = true; clearTimeout(timer);
      try { w.terminate(); } catch (e) {}
      URL.revokeObjectURL(url);
      cb({ ok: false, error: (ev && ev.message) || 'Script error (check your syntax).' });
    };
    w.postMessage(spec);
  }

  /* ---------- main-thread fallback (file:// without Workers) ----------- */
  function runInline(userCode, spec, cb) {
    var logs = [];
    var src = [
      PRELUDE,
      'function __lookup(n){ try { return eval(n); } catch(e){ return undefined; } }',
      spec.verify ? 'var __verify = ' + spec.verify + ';' : 'var __verify = null;',
      HARNESS,
      userCode,
      'return __run(__spec, __spec.fn);'
    ].join('\n');
    var fakeConsole = {
      log: function () {
        logs.push(Array.prototype.map.call(arguments, function (a) {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
        }).join(' '));
      }
    };
    fakeConsole.error = fakeConsole.warn = fakeConsole.info = fakeConsole.log;
    try {
      var f = new Function('__spec', 'console', src);
      var r = f(spec, fakeConsole);
      r.logs = logs;
      cb({ ok: true, result: r });
    } catch (e) {
      cb({ ok: false, error: (e && e.message) || String(e), logs: logs });
    }
  }

  var WORKERS_OK = null;
  function execute(userCode, spec, cb) {
    if (WORKERS_OK === false) return runInline(userCode, spec, cb);
    runInWorker(userCode, spec, function (res) {
      if (res && res.unsupported) { WORKERS_OK = false; return runInline(userCode, spec, cb); }
      WORKERS_OK = true;
      cb(res);
    });
  }

  /* ---------- rendering ------------------------------------------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderProblem(p, index) {
    var card = el('div', 'prob');
    card.id = p.id;

    /* header */
    var head = el('div', 'prob-head');
    head.appendChild(el('span', 'prob-num', 'Q' + String(index + 1).padStart(2, '0')));
    head.appendChild(el('h3', 'prob-title', '<a href="#' + p.id + '">' + esc(p.title) + '</a>'));
    if (p.pattern) head.appendChild(el('span', 'pat-tag', esc(p.pattern)));
    head.appendChild(el('span', 'diff diff-' + (p.difficulty || 'Easy').toLowerCase(),
      (p.difficulty || 'Easy').toUpperCase()));
    card.appendChild(head);

    var body = el('div', 'prob-body');
    body.appendChild(el('div', null, p.statement || ''));

    /* examples */
    (p.examples || []).forEach(function (x, i) {
      var e = el('div', 'ex');
      e.appendChild(el('div', 'ex-row', '<b>Input </b> ' + esc(x.in)));
      e.appendChild(el('div', 'ex-row', '<b>Output</b> ' + esc(x.out)));
      if (x.note) e.appendChild(el('div', 'ex-note', x.note));
      body.appendChild(e);
    });

    /* hints */
    if (p.hints && p.hints.length) {
      var hf = el('details', 'fold');
      hf.appendChild(el('summary', null, 'Hints (' + p.hints.length + ')'));
      var hb = el('div', 'fold-body');
      var ul = el('ul', 'hintlist');
      p.hints.forEach(function (h) { ul.appendChild(el('li', null, h)); });
      hb.appendChild(ul); hf.appendChild(hb); body.appendChild(hf);
    }

    /* approaches */
    if (p.approaches && p.approaches.length) {
      var af = el('details', 'fold');
      af.appendChild(el('summary', null, 'Approach — brute force to optimal'));
      var ab = el('div', 'fold-body');
      p.approaches.forEach(function (a) {
        var d = el('div', 'appr' + (a.best ? ' appr-best' : ''));
        var h = el('div', 'appr-head');
        h.appendChild(el('span', 'appr-name', esc(a.name)));
        h.appendChild(el('span', 'appr-cx',
          'time <b>' + esc(a.time) + '</b> &nbsp; space <b>' + esc(a.space) + '</b>'));
        d.appendChild(h);
        d.appendChild(el('div', null, a.idea));
        ab.appendChild(d);
      });
      af.appendChild(ab); body.appendChild(af);
    }

    /* editor */
    if (p.fn) {
      var wrap = el('div', 'editor-wrap');
      var bar = el('div', 'editor-bar');
      bar.appendChild(el('span', 'sig', esc(p.sig || (p.fn + '(…)'))));
      var runBtn = el('button', 'btn btn-run', 'Run tests');
      var resetBtn = el('button', 'btn', 'Reset');
      var solBtn = el('button', 'btn', 'Show solution');
      bar.appendChild(runBtn); bar.appendChild(resetBtn); bar.appendChild(solBtn);
      wrap.appendChild(bar);

      var ta = el('textarea', 'editor');
      ta.spellcheck = false;
      ta.setAttribute('aria-label', 'Solution editor for ' + p.title);
      var saved = null;
      try { saved = localStorage.getItem(STORE + p.id); } catch (e) {}
      ta.value = saved !== null ? saved : (p.starter || '');
      wrap.appendChild(ta);
      body.appendChild(wrap);

      var results = el('div', 'results');
      body.appendChild(results);

      /* tab inserts spaces; ctrl/cmd+enter runs */
      ta.addEventListener('keydown', function (ev) {
        if (ev.key === 'Tab') {
          ev.preventDefault();
          var s = ta.selectionStart, e2 = ta.selectionEnd;
          ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(e2);
          ta.selectionStart = ta.selectionEnd = s + 2;
        } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault(); runBtn.click();
        }
      });
      ta.addEventListener('input', function () {
        try { localStorage.setItem(STORE + p.id, ta.value); } catch (e) {}
      });

      resetBtn.addEventListener('click', function () {
        ta.value = p.starter || '';
        try { localStorage.removeItem(STORE + p.id); } catch (e) {}
        results.innerHTML = '';
      });

      runBtn.addEventListener('click', function () {
        runBtn.disabled = true; runBtn.textContent = 'Running…';
        results.innerHTML = '';
        var spec = {
          fn: p.fn, tests: p.tests || [], argTypes: p.argTypes, retType: p.retType,
          compare: p.compare, checkArg: p.checkArg, verify: p.verify
        };
        execute(ta.value, spec, function (res) {
          runBtn.disabled = false; runBtn.textContent = 'Run tests';
          showResults(results, res, p);
        });
      });

      solBtn.addEventListener('click', function () {
        var f = card.querySelector('.solfold');
        if (f) { f.open = true; f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
    }

    /* reference solutions */
    if (p.solutions) {
      var sf = el('details', 'fold solfold');
      sf.appendChild(el('summary', null, 'Reference solution'));
      var sb = el('div', 'fold-body');
      var langs = Object.keys(p.solutions);
      var tabs = el('div', 'langtabs');
      var panes = [];
      langs.forEach(function (L, i) {
        var t = el('button', 'langtab' + (i === 0 ? ' on' : ''), labelFor(L));
        var pane = el('div', 'langpane' + (i === 0 ? ' on' : ''));
        var pre = el('pre'); var code = el('code', null, esc(p.solutions[L]));
        pre.appendChild(code); pane.appendChild(pre);
        t.addEventListener('click', function () {
          tabs.querySelectorAll('.langtab').forEach(function (x) { x.classList.remove('on'); });
          panes.forEach(function (x) { x.classList.remove('on'); });
          t.classList.add('on'); pane.classList.add('on');
        });
        tabs.appendChild(t); panes.push(pane);
      });
      sb.appendChild(tabs);
      panes.forEach(function (x) { sb.appendChild(x); });
      if (p.walkthrough) sb.appendChild(el('div', null, p.walkthrough));
      sf.appendChild(sb); body.appendChild(sf);
    }

    card.appendChild(body);
    return card;
  }

  function labelFor(k) {
    return { js: 'JavaScript', cpp: 'C++', python: 'Python', java: 'Java', c: 'C' }[k] || k;
  }

  function showResults(box, res, p) {
    box.innerHTML = '';
    if (!res || (!res.ok && !res.result)) {
      var b = el('div', 'res-banner res-err', '⚠ ' + esc((res && res.error) || 'Unknown error'));
      box.appendChild(b);
      if (res && res.logs && res.logs.length) box.appendChild(el('div', 'res-console', esc(res.logs.join('\n'))));
      return;
    }
    var r = res.result;
    var passed = r.tests.filter(function (t) { return t.ok; }).length;
    var total = r.tests.length;
    var all = passed === total;
    var banner = el('div', 'res-banner ' + (all ? 'res-pass' : 'res-fail'),
      (all ? '✓ All tests passed' : '✗ ' + (total - passed) + ' of ' + total + ' failing') +
      ' <span class="res-time">' + passed + '/' + total + ' · ' + r.ms + ' ms</span>');
    box.appendChild(banner);

    var list = el('div', 'res-tests');
    r.tests.forEach(function (t, i) {
      var row = el('div', 'res-t ' + (t.ok ? 'ok' : 'bad'));
      row.appendChild(el('div', 'res-mark', t.ok ? '✓' : '✗'));
      var kv = el('div', 'res-kv');
      kv.appendChild(el('div', null, '<b>in  </b> ' + esc(t.in)));
      if (!t.ok) {
        kv.appendChild(el('div', null, '<b>want</b> ' + esc(t.exp)));
        kv.appendChild(el('div', null, t.err
          ? '<b>err </b> ' + esc(t.err)
          : '<b>got </b> ' + esc(t.got)));
      }
      row.appendChild(kv);
      list.appendChild(row);
    });
    box.appendChild(list);

    if (r.logs && r.logs.length) box.appendChild(el('div', 'res-console', esc(r.logs.join('\n'))));
  }

  /* ---------- free-form playground -------------------------------------- */
  function mountPlayground(host, starter) {
    var wrap = el('div', 'editor-wrap pg');
    var bar = el('div', 'editor-bar');
    bar.appendChild(el('span', 'sig', 'Scratch pad — console.log() to print. Ctrl/⌘+Enter to run.'));
    var run = el('button', 'btn btn-run', 'Run');
    var clr = el('button', 'btn', 'Clear output');
    bar.appendChild(run); bar.appendChild(clr);
    wrap.appendChild(bar);

    var ta = el('textarea', 'editor');
    ta.spellcheck = false;
    var saved = null;
    try { saved = localStorage.getItem(STORE + 'playground'); } catch (e) {}
    ta.value = saved !== null ? saved : (starter || '');
    wrap.appendChild(ta);
    host.appendChild(wrap);

    var out = el('div', 'res-console');
    host.appendChild(out);

    ta.addEventListener('input', function () {
      try { localStorage.setItem(STORE + 'playground', ta.value); } catch (e) {}
    });
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Tab') {
        ev.preventDefault();
        var s = ta.selectionStart, e2 = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(e2);
        ta.selectionStart = ta.selectionEnd = s + 2;
      } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); run.click(); }
    });
    clr.addEventListener('click', function () { out.textContent = ''; });

    run.addEventListener('click', function () {
      run.disabled = true; run.textContent = 'Running…';
      out.textContent = '';
      var spec = { fn: '__main', tests: [{ args: [], expect: null }], compare: 'any' };
      var code = ta.value + '\nfunction __main(){ return null; }';
      execute(code, spec, function (res) {
        run.disabled = false; run.textContent = 'Run';
        var logs = (res && (res.logs || (res.result && res.result.logs))) || [];
        var txt = logs.join('\n');
        if (res && !res.ok && res.error) txt += (txt ? '\n' : '') + '⚠ ' + res.error;
        out.textContent = txt || '(no output — use console.log)';
      });
    });
  }

  /* ---------- boot ------------------------------------------------------ */
  function boot() {
    var host = document.getElementById('problems');
    if (host && typeof PROBLEMS !== 'undefined') {
      PROBLEMS.forEach(function (p, i) { host.appendChild(renderProblem(p, i)); });
      /* main.js softens cross-references to unwritten chapters on
         DOMContentLoaded, which happens BEFORE these cards exist. Re-run it
         so links inside problem statements and walkthroughs are softened too. */
      if (typeof window.softenPendingLinks === 'function') {
        try { window.softenPendingLinks(); } catch (e) {}
      }
      if (location.hash) {
        var t = document.getElementById(location.hash.slice(1));
        if (t) setTimeout(function () { t.scrollIntoView(); }, 60);
      }
    }
    var pg = document.getElementById('playground');
    if (pg) mountPlayground(pg, pg.getAttribute('data-starter') || '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Belt and braces: if judge.js happened to run before main.js finished its
     own DOMContentLoaded work, soften again once everything has loaded. */
  window.addEventListener('load', function () {
    if (typeof window.softenPendingLinks === 'function') {
      try { window.softenPendingLinks(); } catch (e) {}
    }
  });

  window.Judge = { mountPlayground: mountPlayground, version: 2 };
})();
