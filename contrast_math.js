(function() {
    const cache = new Map();
    let temp_arr = [];

    function clamp(v, min, max) {
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function isNum(v) {
        return typeof v === 'number' && !Number.isNaN(v);
    }

    function normByte(v) {
      const n = Number(v);
        if (!isNum(n)) return 0;
        return clamp(Math.round(n), 0, 255);
    }

     function normAlpha(v) {
        const n = Number(v);
        if (!isNum(n)) return 1;
        return clamp(n, 0, 1);
    }



    function hexToRgba(hex) {
        let h = String(hex ||'').replace('#','').trim();
        if (!h) return null;

        if (h.length === 3) {
             h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    } else if (h.length === 4) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }

      if (h.length !== 6 && h.length !== 8) return null;
    if (!/^[0-9a-f]+$/i.test(h)) return null;

    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    let a = 1;
    if (h.length == 8) {
      a = parseInt(h.slice(6, 8), 16) / 255;
    }

    return { r, g, b, a };
  }

  function parseRgbLike(s) {
    const m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (!m) return null;
    const bits = m[1].split(',').map((x) => x.trim());
    if (bits.length < 3) return null;

    const r = normByte(bits[0]);
    const g = normByte(bits[1]);
    const b = normByte(bits[2]);
    let a = 1;
    if (bits.length > 3) a = normAlpha(bits[3]);

    return { r, g, b, a };
  }

  function parseHslLike(s) {
    const m = s.match(/^hsla?\(([^)]+)\)$/i);
    if (!m) return null;

    const bits = m[1].split(',').map((x) => x.trim());
    if (bits.length < 3) return null;

    const h = Number(String(bits[0]).replace('deg', ''));
    const sp = String(bits[1]).replace('%', '');
    const lp = String(bits[2]).replace('%', '');
    const sat = clamp(Number(sp) / 100, 0, 1);
    const lig = clamp(Number(lp) / 100, 0, 1);

    if ([h, sat, lig].some((v) => Number.isNaN(v))) return null;

    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const hh = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let rp = 0;
    let gp = 0;
    let bp = 0;

    if (hh >= 0 && hh < 1) {
      rp = c; gp = x; bp = 0;
    } else if (hh >= 1 && hh < 2) {
      rp = x; gp = c; bp = 0;
    } else if (hh >= 2 && hh < 3) {
      rp = 0; gp = c; bp = x;
    } else if (hh >= 3 && hh < 4) {
      rp = 0; gp = x; bp = c;
    } else if (hh >= 4 && hh < 5) {
      rp = x; gp = 0; bp = c;
    } else {
      rp = c; gp = 0; bp = x;
    }

    const mm = lig - c / 2;
    const r = normByte((rp + mm) * 255);
    const g = normByte((gp + mm) * 255);
    const b = normByte((bp + mm) * 255);
    let a = 1;
    if (bits.length > 3) a = normAlpha(bits[3]);

    return { r, g, b, a };
  }

  function parseNamedViaDom(s) {
    try {
      const key = '__n__' + s;
      if (cache.has(key)) return cache.get(key);
      const probe = document.createElement('span');
      probe.style.color = s;
      probe.style.display = 'none';
      document.documentElement.appendChild(probe);
      const out = getComputedStyle(probe).color;
      probe.remove();
      const v = parseRgbLike(String(out || ''));
      cache.set(key, v);
      return v;
    } catch (e) {
      return null;
    }
  }



  function parseColor(input) {
    if (input == null) return null;
    const s = String(input).trim().toLowerCase();
    if (!s) return null;
    if (s === 'transparent') {
      return { r: 255, g: 255, b: 255, a: 0 };
    }

    let v = parseRgbLike(s);
    if (v) return v;

    v = parseHslLike(s);
    if (v) return v;

    if (s[0] === '#') {
      v = hexToRgba(s);
      if (v) return v;
    }

    return parseNamedViaDom(s);
  }

  function srgbToLinear(n) {
    const c = n / 255;
    if (c <= 0.03928) return c / 12.92;
    return Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(n) {
    if (n <= 0.0031308) return n * 12.92;
    return 1.055 * Math.pow(n, 1 / 2.4) - 0.055;
  }

  function relativeLuminance(rgb) {
    if (!rgb) return 1;
    const r = srgbToLinear(normByte(rgb.r));
    const g = srgbToLinear(normByte(rgb.g));
    const b = srgbToLinear(normByte(rgb.b));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function blend(fg, bg) {
    const af = fg && isNum(fg.a) ? fg.a : 1;
    const ab = bg && isNum(bg.a) ? bg.a : 1;
    const a = af + ab * (1 - af);

    if (a === 0) {
      return { r: 255, g: 255, b: 255, a: 0 };
    }

    const r = ((fg.r * af) + (bg.r * ab * (1 - af))) / a;
    const g = ((fg.g * af) + (bg.g * ab * (1 - af))) / a;
    const b = ((fg.b * af) + (bg.b * ab * (1 - af))) / a;

    return {
      r: normByte(r),
      g: normByte(g),
      b: normByte(b),
      a: a
    };
  }

  function withOpaqueFallback(c, fallback) {
    if (!c) return fallback;
    if (c.a == null || c.a >= 1) return c;
    return blend(c, fallback || { r: 255, g: 255, b: 255, a: 1 });
  }

  function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const hi = la > lb ? la : lb;
    const lo = la > lb ? lb : la;
    return (hi + 0.05) / (lo + 0.05);
    }

   function formatRatio(r) {
    if (!isNum(r)) return '0.00';
    return r.toFixed(2);
  }

  function chooseTextColor(bg) {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const rw = contrastRatio(bg, white);
    const rb = contrastRatio(bg, black);
    if (rw >= rb) return white;
    return black;
  }

  function linearMix(c1, c2, t) {
    const mix = clamp(Number(t), 0, 1);
    const l1 = {
      r: srgbToLinear(normByte(c1.r)),
      g: srgbToLinear(normByte(c1.g)),
      b: srgbToLinear(normByte(c1.b))
    };
    const l2 = {
      r: srgbToLinear(normByte(c2.r)),
      g: srgbToLinear(normByte(c2.g)),
      b: srgbToLinear(normByte(c2.b))
    };

    const outLinear = {
      r: l1.r * (1 - mix) + l2.r * mix,
      g: l1.g * (1 - mix) + l2.g * mix,
      b: l1.b * (1 - mix) + l2.b * mix
    };

    return {
      r: normByte(linearToSrgb(outLinear.r) * 255),
      g: normByte(linearToSrgb(outLinear.g) * 255),
      b: normByte(linearToSrgb(outLinear.b) * 255),
      a: 1
    };
  } 
 
  window.SpecterContrastMath = {
    parseColor,
    srgbToLinear,
    relativeLuminance,
    blend,
    withOpaqueFallback,
    contrastRatio,
    chooseTextColor,
    linearMix,
    formatRatio,
    _internal: {
        hexToRgba,
        parseRgbLike,
        parseHslLike,
        clamp,
        normByte,
        normAlpha,
    }
  };
})();                                                                                                                                                