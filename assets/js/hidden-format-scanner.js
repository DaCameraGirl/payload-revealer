/* ====================== Payload Revealer - Hidden Formatting Scanner ======================
   Detects the OTHER hiding technique: text that isn't Unicode-invisible at all, just
   styled invisible in its source (white-on-white, opacity:0, display:none, zero-size
   fonts) in a Google Doc, webpage, or Slack message. A plain-text paste already strips
   that styling before it ever reaches scan-engine.js, so this reads the clipboard's
   HTML flavor instead, where browsers inline the source's computed styles onto the
   copied markup, and inspects that formatting directly.
*/
(function (global) {
  "use strict";

  function parseColor(value) {
    if (!value) return null;
    value = value.trim().toLowerCase();
    if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    let m = value.match(/^#([0-9a-f]{3})$/);
    if (m) {
      const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
      return { r, g, b, a: 1 };
    }
    m = value.match(/^#([0-9a-f]{6})$/);
    if (m) {
      const hex = m[1];
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    m = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (m) {
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    }
    const NAMED = {
      white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0],
      green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
    };
    if (NAMED[value]) {
      const [r, g, b] = NAMED[value];
      return { r, g, b, a: 1 };
    }
    return null;
  }

  function relativeLuminance({ r, g, b }) {
    const chan = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  }

  function contrastRatio(c1, c2) {
    const l1 = relativeLuminance(c1);
    const l2 = relativeLuminance(c2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function parseFontSizePx(value) {
    if (!value) return null;
    const m = value.trim().match(/^([\d.]+)(px|pt)$/);
    if (!m) return null;
    const num = parseFloat(m[1]);
    return m[2] === "pt" ? num * (96 / 72) : num;
  }

  // Walks up from `el` through the parsed (detached) fragment, collecting the
  // ancestor chain's inline style info needed to resolve effective visibility.
  function resolveVisibility(el) {
    let node = el;
    let effectiveOpacity = 1;
    let effectiveBackground = null;
    let hidden = null;

    while (node && node.nodeType === 1) {
      const style = node.style;
      if (style) {
        if (style.display === "none") hidden = "display:none";
        if (style.visibility === "hidden") hidden = "visibility:hidden";

        const op = style.opacity !== "" ? parseFloat(style.opacity) : NaN;
        if (!Number.isNaN(op)) effectiveOpacity *= op;

        if (!effectiveBackground) {
          const bg = parseColor(style.backgroundColor);
          if (bg && bg.a > 0) effectiveBackground = bg;
        }
      }
      node = node.parentElement;
    }

    return {
      hidden,
      effectiveOpacity,
      effectiveBackground: effectiveBackground || { r: 255, g: 255, b: 255, a: 1 }, // default: assume a white page
    };
  }

  function scanHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);

    const findings = [];
    const visibleParts = [];
    let node;

    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      if (!text || !text.trim()) continue;

      const el = node.parentElement;
      const style = el ? el.style : null;
      const { hidden, effectiveOpacity, effectiveBackground } = resolveVisibility(el);

      const reasons = [];
      let risky = false;

      if (hidden) {
        reasons.push(hidden);
        risky = true;
      }
      if (effectiveOpacity <= 0.05) {
        reasons.push(`opacity:${effectiveOpacity.toFixed(2)}`);
        risky = true;
      }
      const fontPx = style ? parseFontSizePx(style.fontSize) : null;
      if (fontPx !== null && fontPx <= 2) {
        reasons.push(`font-size:${fontPx}px`);
        risky = true;
      }

      const color = style ? parseColor(style.color) : null;
      if (color && color.a > 0) {
        const ratio = contrastRatio(color, effectiveBackground);
        if (ratio < 1.3) {
          reasons.push(`color matches background (contrast ${ratio.toFixed(2)}:1)`);
          risky = true;
        }
      }

      if (risky) {
        findings.push({ text: text.trim(), reasons, risk: "critical" });
      } else {
        visibleParts.push(text);
      }
    }

    return {
      findings,
      visibleText: (doc.body.innerText || visibleParts.join(" ")).trim(),
      hiddenText: findings.map((f) => f.text).join(" "),
    };
  }

  global.HiddenFormatScanner = { scanHtml };
})(typeof window !== "undefined" ? window : globalThis);
