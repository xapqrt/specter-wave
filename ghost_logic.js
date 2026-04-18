(function() {
   const MARK_ATTR = 'data-specter-ghost';

   function toNumber(v) {
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return n;
   }

   function hasRect(rect) {
        if (!rect) return false;
        if (rect.width > 0 && rect.height > 0) return true;
        if (rect.top !== rect.bottom && rect.left !== rect.right) return true;
        return false;
    }

    function visibleByRect(rect) {
        if (!rect) return false;      
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
    }

    function probablyInteractive(el) {
        if (!el) return false;
        const tag = String(el.tagName || '').toLowerCase();
        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (el.hasAttribute('onclick')) return true;
        if (el.hasAttribute('role') === 'button') return true;
        const ti = toNumber(el.getAttribute('tabindex'));
        if (ti >= 0) return true;
        return false;
    }
      
    function isZeroOpacity(style) {
        if (!style) return false;
        const op = toNumber(style.opacity);
        if (op === 0) return true;
        return false;
    }

   function isHiddenVisibility(style) {
if (!style) return false;
  return style.visibility === 'hidden' || style.visibility === 'collapse';
   }
  
    function isDisplayNone(style) {
    if (!style) return false;
    return style.display === 'none';
  }
  
  function isGhostLike(style) {
   if(!style) return false;
   if(isDisplayNone(style)) return true;
   if(isHiddenVisibility(style)) return true;
    if(isZeroOpacity(style)) return true;
    return false;
    }
  
 function getReason(style) {
     if (!style) return 'unknown';
     if (isDisplayNone(style)) return 'display_none';
     if (isHiddenVisibility(style)) return 'visibility_hidden';
     if (isZeroOpacity(style)) return 'opacity_zero';
     return 'unknown';
   }
 
 
 
    function getRectSafe(el) {
    try {
        return el.getBoundingClientRect();
    } catch (e) {
        return null;
    }
  }
  
   function shouldIgnore(el) {
    if (!el) return true;
    const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link' || tag === 'br' || tag === 'hr') return true;
  if (tag === 'svg' || tag === 'path') return false;
  if (el.id === 'spectervise-hud-root') return true;
  if (el.hasAttribute('data-specter-ignore')) return true;
  return false;
    }
    
    function paintGhost(el,idx,reason) {
     if (!el) return;
    try {
        el.setAttribute(MARK_ATTR,'1');
        el.style.setProperty('outline', '2px solid #bc13fe','important');
        el.style.outlineOffset = '1px';
        el.style.boxShadow = '0 0 0 1px #bc13fe inset';
        el.style.setProperty('--specter-ghost-reason', reason || 'ghost');
        if (idx % 2 === 0) {
            el.style.setProperty('--specter-ghost-index', String(idx));
        }
    } catch (e) {
       console.log('paint ghost failed',e);
    }
    }
    
   function clearGhostPaint(root) {
     const scope = root || document;
     const all = scope.querySelectorAll('[' + MARK_ATTR + '="1"]');
    for(let i = 0; i < all.length; i++) {
    const el = all[i];
    el.removeAttribute(MARK_ATTR);
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.boxShadow = '';
    el.style.removeProperty('--specter-ghost-reason');
    el.style.removeProperty('--specter-ghost-index');
    }
    }

    function normalizeNodelist(list) {
        const arr = [];
        if (!list) return arr;
        for(let i = 0; i < list.length; i++) {
            arr.push(list[i]);
        }
        return arr;
    }

    function scoreGhost(el,style,rect) {
        let score = 0;
        if (isDisplayNone(style)) score += 5;
        if (isHiddenVisibility(style)) score += 3;
        if (isZeroOpacity(style)) score += 4;
        if (probablyInteractive(el)) score += 2;
        if (rect && rect.width * rect.height > 20000) score += 1;
        return score;
    }





    function scanForGhosts(root) {
        const scope = root || document;
        const nodes = normalizeNodelist(scope.querySelectorAll('*'));
        const found = [];
        let stale_count = 0;

        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            if (shouldIgnore(el)) continue;

            let style;
            try {
                style = getComputedStyle(el);
            } catch (e) {
                continue;
            }

            if (!isGhostLike(style)) continue;

            const rect = getRectSafe(el);
            if (!rect) continue;

            const has_size = hasRect(rect);
            const vis_rect = visibleByRect(rect);

            if(!has_size && !vis_rect) {
                stale_count++;
                continue;
            }

            const reason = getReason(style);
            const score = scoreGhost(el, style, rect);

            found.push({
                el,
                rect,
                reason,
                score,
                index: i,
                style: {
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                }
            });
        }

        if (stale_count > 40) {
            console.log('ghost stale_count',stale_count);
        }

        found.sort((a,b) => b.score - a.score);
        return found;
    }

    function markGhosts(list) {
        const arr = Array.isArray(list) ? list : [];
        for (let i = 0; i < arr.length; i++) {
            const g = arr[i];
            paintGhost(g.el, i, g.reason);
        }
    }

    function summarize(list) {
        const s = {
            total: 0,
            display_none: 0,
            visibility_hidden: 0,
            opacity_zero: 0,
            unknown: 0,
        };

      if (!Array.isArray(list)) return s;
         
      for (let i = 0; i < list.length; i++) {
            const x = list[i];
            s.total += 1;
            if (x.reason === 'display_none') s.display_none += 1;
            else if (x.reason === 'visibility_hidden') s.visibility_hidden += 1;
            else if (x.reason === 'opacity_zero') s.opacity_zero += 1;
            else s.unknown += 1;
          }
        
          return s;
        }  

    window.SpecterGhostLogic = {
       scanForGhosts,
    markGhosts,
    clearGhostPaint,
    summarize,
    _internal: {
      probablyInteractive,
      isGhostLike,
      scoreGhost,
      visibleByRect
    }
  };
})(); 
        