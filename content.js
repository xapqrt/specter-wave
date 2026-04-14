(function () {
  const HUD_ID = 'spectervise-hud-root';
  const OUTLINE_STYLE_ID = 'spectervise-outline-style';
  const CONTRAST_FAIL_ATTR = 'data-specter-contrast-fail';

  const state = {
    enabled: false,
    hud: null,
    outlineStyle: null,
    runCount: 0,
    last: {
      ghosts: 0,
      contrast: 0,
      total: 0,
      ms: 0
    },
    stopWatch: null,
    dirty: false
  };

  let arr = []; // whatever
  const scan_cache = new WeakMap();

  function now() {
    return Date.now();
  }

  function isMac() {
    const p = (navigator.platform || '').toLowerCase();
    return p.indexOf('mac') >= 0;
  }

  function hasMetaCombo(e) {
    if (isMac()) {
      return e.metaKey === true;
    }
    return e.ctrlKey === true;
  }

  function keyIsS(e) {
    const k = String(e.key || '').toLowerCase();
    if (k === 's') return true;
    if (e.code === 'KeyS') return true;
    return false;
  }

  function ensureOutlineStyle() {
    if (state.outlineStyle && document.contains(state.outlineStyle)) return state.outlineStyle;

    let s = document.getElementById(OUTLINE_STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = OUTLINE_STYLE_ID;
      s.textContent = '* { outline: 1px solid cyan !important; }';
      (document.head || document.documentElement).appendChild(s);
    }

    state.outlineStyle = s;
    return s;
  }

  function removeOutlineStyle() {
    const s = document.getElementById(OUTLINE_STYLE_ID);
    if (s) s.remove();
    if (state.outlineStyle) state.outlineStyle = null;
  }

  function toggleRefactorVision() {
    if (!state.enabled) {
      ensureOutlineStyle();
      state.enabled = true;
    } else {
      removeOutlineStyle();
      state.enabled = false;
    }
  }

  function ensureHud() {
    if (state.hud && document.contains(state.hud)) return state.hud;

    let hud = document.getElementById(HUD_ID);
    if (!hud) {
      hud = document.createElement('div');
      hud.id = HUD_ID;
      hud.setAttribute('data-specter-ignore', '1');

      hud.style.position = 'fixed';
      hud.style.right = '12px';
      hud.style.top = '12px';
      hud.style.padding = '10px 12px';
      hud.style.borderRadius = '10px';
      hud.style.zIndex = '2147483647';
      hud.style.color = '#f7f7f7';
      hud.style.background = 'rgba(8,8,8,0.88)';
      hud.style.backdropFilter = 'blur(3px)';
      hud.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
      hud.style.fontSize = '12px';
      hud.style.lineHeight = '1.35';
      hud.style.boxShadow = '0 4px 22px rgba(0,0,0,0.34)';
      hud.style.border = '1px solid rgba(255,255,255,0.12)';
      hud.style.whiteSpace = 'pre';
      hud.style.minWidth = '220px';


      const title = document.createElement('div');
      title.textContent = 'spectervise';
      title.style.fontWeight = '700';
      title.style.letterSpacing = '0.03em';
      title.style.marginBottom = '6px';
      title.style.color = '#9ef4ff';

      const body = document.createElement('div');
      body.setAttribute('data-specter-hud-body', '1');
      body.textContent = 'warming up';

      const foot = document.createElement('div');
      foot.setAttribute('data-specter-hud-foot', '1');
      foot.style.marginTop = '7px';
      foot.style.opacity = '0.7';
      foot.textContent = 'cmd/ctrl+shift+s';

      hud.appendChild(title);
      hud.appendChild(body);
      hud.appendChild(foot);

      (document.body || document.documentElement).appendChild(hud);
    }

    state.hud = hud;
    return hud;
  }

  function hudSetText(stats) {
    const h = ensureHud();
    const b = h.querySelector('[data-specter-hud-body="1"]');
    if (!b) return;

    const lines = [];
    lines.push('run: ' + state.runCount);
    lines.push('ghosts: ' + stats.ghosts);
    lines.push('contrast fails: ' + stats.contrast);
    lines.push('total bugs: ' + stats.total);
    lines.push('last scan: ' + stats.ms + 'ms');


    b.textContent = lines.join('\n');

    if (stats.total > 0) {
      h.style.borderColor = 'rgba(188,19,254,0.6)';
    } else {
      h.style.borderColor = 'rgba(255,255,255,0.12)';
    }
  }

  function parseColorSafe(v) {
    try {
      return window.SpecterContrastMath.parseColor(v);
    } catch (e) {
      return null;
    }
  }

  function walkForBackgroundColor(el) {
    let node = el;
    let depth = 0;

    while (node && depth < 12) {
      let st;
      try {
        st = getComputedStyle(node);
      } catch (e) {
        break;
      }

      const bg = parseColorSafe(st.backgroundColor);
      if (bg && bg.a > 0) return bg;

      node = node.parentElement;
      depth++;
    }

    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function looksLikeTextNode(el) {
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return false;
    if (tag === 'svg' || tag === 'path') return false;

    const txt = (el.textContent || '').trim();
    if (!txt) return false;
    if (txt.length > 1500) return false;

    const st = getComputedStyle(el);
    const fs = parseFloat(st.fontSize || '0');
    if (Number.isNaN(fs) || fs <= 0) return false;
    if (st.display === 'none' || st.visibility === 'hidden') return false;

    return true;
  }

  function clearContrastMarks(root) {
    const scope = root || document;
    const all = scope.querySelectorAll('[' + CONTRAST_FAIL_ATTR + '="1"]');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      el.removeAttribute(CONTRAST_FAIL_ATTR);
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
      el.style.removeProperty('text-decoration');
      el.style.removeProperty('text-decoration-color');
    }
  }



  function markContrastFail(el, ratio) {
    el.setAttribute(CONTRAST_FAIL_ATTR, '1');
    el.style.outline = '2px dashed #ff4365';
    el.style.outlineOffset = '2px';
    el.style.textDecoration = 'underline wavy #ff4365';
    el.style.textDecorationColor = '#ff4365';
    el.setAttribute('data-specter-ratio', String(ratio));
  }

  function nodeCacheGet(el) {
    if (!scan_cache.has(el)) return null;
    return scan_cache.get(el);
  }

  function nodeCacheSet(el, val) {
    scan_cache.set(el, val);
  }

  function contrastScan(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll('*');
    const fails = [];
    let checked = 0;

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.id === HUD_ID) continue;
      if (!looksLikeTextNode(el)) continue;

      const prev = nodeCacheGet(el);
      const txt = (el.textContent || '').trim();

      if (prev && prev.txt === txt && prev.len === txt.length) {
        checked += 1;
        if (prev.fail === true) {
          fails.push(prev.payload);
        }
        continue;
      }

      let st;
      try {
        st = getComputedStyle(el);
      } catch (e) {
        continue;
      }

      const fg = parseColorSafe(st.color);
      const bgRaw = walkForBackgroundColor(el);
      const bg = window.SpecterContrastMath.withOpaqueFallback(bgRaw, { r: 255, g: 255, b: 255, a: 1 });

      if (!fg || !bg) continue;

      const rr = window.SpecterContrastMath.contrastRatio(fg, bg);
      checked += 1;

      const payload = {
        el,
        ratio: rr,
        fg,
        bg,
        text: txt.slice(0, 120)
      };

      if (rr < 4.5) {
        fails.push(payload);
        nodeCacheSet(el, { txt, len: txt.length, fail: true, payload });
      } else {
        nodeCacheSet(el, { txt, len: txt.length, fail: false, payload: null });
      }
    }

    return {
      fails,
      checked
    };
  }

  function applyContrastFails(items) {
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      markContrastFail(x.el, x.ratio.toFixed(2));
    }
  }

  function runGhostScan() {
    const ghosts = window.SpecterGhostLogic.scanForGhosts(document);
    window.SpecterGhostLogic.markGhosts(ghosts);
    return ghosts;
  }
  
  function runContrastScan() {
    const contrast = contrastScan(document);
    applyContrastFails(contrast.fails);
    return contrast;
  }
  
  function scanOnce() {
    const t0 = now();

    window.SpecterGhostLogic.clearGhostPaint(document);
    clearContrastMarks(document);

    const ghosts = runGhostScan();
    const contrast = runContrastScan();

     state.runCount += 1;

    const total = ghosts.length + contrast.fails.length;
    state.last = {
      ghosts: ghosts.length,
      contrast: contrast.fails.length,
      total,
      ms: now() - t0
    };

    hudSetText(state.last);

    console.log('here 1');
    if (ghosts.length > 0) console.log(ghosts[0]);

    return state.last;
  }

  function debounce(fn, ms) {
    let timer = null;
    return function () {
      const args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(null, args);
      }, ms);
    };
  }

  const delayedScan = debounce(() => {
    try {
      scanOnce();
    } catch (e) {
      console.log('scan err', e);
    }
  }, 120);

  function startAutoWatch() {
    if (state.stopWatch) return;

    const mo = new MutationObserver(() => {
      if (!state.enabled) return;
      state.dirty = true;
      delayedScan();
    });

    mo.observe(document.documentElement || document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: false
    });

    state.stopWatch = function () {
      mo.disconnect();
      state.stopWatch = null;
    };
  }

  function stopAutoWatch() {
    if (state.stopWatch) {
      state.stopWatch();
    }
  }



  function triggerFromKey(e) {
    if (!hasMetaCombo(e)) return false;
    if (!e.shiftKey) return false;
    if (!keyIsS(e)) return false;
    if (e.repeat) return false;

    e.preventDefault();
    toggleRefactorVision();
    if (state.enabled) {
      startAutoWatch();
      scanOnce();
    } else {
      stopAutoWatch();
    }

    return true;
  }

  function onKeyDown(e) {
    triggerFromKey(e);
  }

  function safePing() {
    try {
      chrome.runtime.sendMessage({ type: 'SPECTERVISE_PING' }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          // do nothing
        }
      });
    } catch (e) {
      // no runtime in weird pages
    }
  }

  function onRuntimeMessage(msg, sender, sendResponse) {
    if (!msg) return;

    if (msg.type == 'SPECTERVISE_TOGGLE') {
      toggleRefactorVision();
      if (state.enabled) {
        startAutoWatch();
        const st = scanOnce();
        sendResponse && sendResponse({ ok: true, state: st });
      } else {
        stopAutoWatch();
        sendResponse && sendResponse({ ok: true, state: 'off' });
      }
      return true;
    }

    if (msg.type === 'SPECTERVISE_SCAN_NOW') {
      const st = scanOnce();
      sendResponse && sendResponse({ ok: true, state: st });
      return true;
    }
  }

  function boot() {
    ensureHud();
    hudSetText(state.last);
    window.addEventListener('keydown', onKeyDown, true);

    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }

    safePing();
  }

  boot();
})();