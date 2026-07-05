/* ====================== Payload Revealer - Browser Scan Engine ======================
   Client-side port of payload_revealer/engine/{sweeper,classifier,payload_extractor,word_counter}.py
   Runs entirely in the browser tab — no upload, no server, no install.
*/
(function (global) {
  "use strict";

  const HIDDEN_CATEGORIES = new Set(["Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp"]);

  const INVISIBLE_WHITESPACE = new Set([
    0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
    0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
    0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
    0xfeff, 0x180e,
  ]);

  const ZERO_WIDTH_CHARS = new Set([
    0x200b, 0x200c, 0x200d, 0xfeff, 0x2060,
    0x2061, 0x2062, 0x2063, 0x2064, 0x180e, 0x00ad,
  ]);

  const BIDI_OVERRIDES = new Set([
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066,
    0x2067, 0x2068, 0x2069,
  ]);

  const UNICODE_TAG_LO = 0xe0001, UNICODE_TAG_HI = 0xe007f;
  const VARIATION_SELECTOR_LO = 0xfe00, VARIATION_SELECTOR_HI = 0xfe0f;
  const VARIATION_SELECTOR_SUPP_LO = 0xe0100, VARIATION_SELECTOR_SUPP_HI = 0xe01ef;
  const C0_LO = 0x0000, C0_HI = 0x001f;
  const C1_LO = 0x0080, C1_HI = 0x009f;
  const PUA_BMP_LO = 0xe000, PUA_BMP_HI = 0xf8ff;
  const PUA_AST_LO = 0xf0000, PUA_AST_HI = 0xffffd;
  const PUA_B_LO = 0x100000, PUA_B_HI = 0x10fffd;

  const NONCHARACTERS = new Set([
    ...Array.from({ length: 16 }, (_, n) => 0xfdd0 + n),
    0xfffe, 0xffff, 0x1fffe, 0x1ffff, 0x2fffe, 0x2ffff,
    0x3fffe, 0x3ffff, 0x4fffe, 0x4ffff, 0x5fffe, 0x5ffff,
    0x6fffe, 0x6ffff, 0x7fffe, 0x7ffff, 0x8fffe, 0x8ffff,
    0x9fffe, 0x9ffff, 0xafffe, 0xaffff, 0xbfffe, 0xbffff,
    0xcfffe, 0xcffff, 0xdfffe, 0xdffff, 0xefffe, 0xeffff,
    0xffffe, 0xfffff, 0x10fffe, 0x10ffff,
  ]);

  const INTERLINEAR_ANNOTATION = new Set([0xfff9, 0xfffa, 0xfffb]);

  const BLOCKS = [
    [0x0000, 0x007f, "Basic Latin"],
    [0x0080, 0x00ff, "Latin-1 Supplement"],
    [0x0100, 0x017f, "Latin Extended-A"],
    [0x0180, 0x024f, "Latin Extended-B"],
    [0x0250, 0x02af, "IPA Extensions"],
    [0x02b0, 0x02ff, "Spacing Modifier Letters"],
    [0x0300, 0x036f, "Combining Diacritical Marks"],
    [0x0370, 0x03ff, "Greek and Coptic"],
    [0x0400, 0x04ff, "Cyrillic"],
    [0x0500, 0x052f, "Cyrillic Supplement"],
    [0x0530, 0x058f, "Armenian"],
    [0x0590, 0x05ff, "Hebrew"],
    [0x0600, 0x06ff, "Arabic"],
    [0x0700, 0x074f, "Syriac"],
    [0x0780, 0x07bf, "Thaana"],
    [0x0900, 0x097f, "Devanagari"],
    [0x0e00, 0x0e7f, "Thai"],
    [0x0e80, 0x0eff, "Lao"],
    [0x1000, 0x109f, "Myanmar"],
    [0x1100, 0x11ff, "Hangul Jamo"],
    [0x2000, 0x206f, "General Punctuation"],
    [0x2070, 0x209f, "Superscripts and Subscripts"],
    [0x20a0, 0x20cf, "Currency Symbols"],
    [0x20d0, 0x20ff, "Combining Diacritical Marks for Symbols"],
    [0x2100, 0x214f, "Letterlike Symbols"],
    [0x2150, 0x218f, "Number Forms"],
    [0x2190, 0x21ff, "Arrows"],
    [0x2200, 0x22ff, "Mathematical Operators"],
    [0x2300, 0x23ff, "Miscellaneous Technical"],
    [0x2400, 0x243f, "Control Pictures"],
    [0x2460, 0x24ff, "Enclosed Alphanumerics"],
    [0x2500, 0x257f, "Box Drawing"],
    [0x2580, 0x259f, "Block Elements"],
    [0x25a0, 0x25ff, "Geometric Shapes"],
    [0x2600, 0x26ff, "Miscellaneous Symbols"],
    [0x2700, 0x27bf, "Dingbats"],
    [0x27c0, 0x27ef, "Miscellaneous Mathematical Symbols-A"],
    [0x27f0, 0x27ff, "Supplemental Arrows-A"],
    [0x2800, 0x28ff, "Braille Patterns"],
    [0x2900, 0x297f, "Supplemental Arrows-B"],
    [0x2980, 0x29ff, "Miscellaneous Mathematical Symbols-B"],
    [0x2a00, 0x2aff, "Supplemental Mathematical Operators"],
    [0x2b00, 0x2bff, "Miscellaneous Symbols and Arrows"],
    [0x3000, 0x303f, "CJK Symbols and Punctuation"],
    [0x3040, 0x309f, "Hiragana"],
    [0x30a0, 0x30ff, "Katakana"],
    [0x4e00, 0x9fff, "CJK Unified Ideographs"],
    [0xe000, 0xf8ff, "Private Use Area"],
    [0xe0001, 0xe007f, "Tags"],
    [0xe0100, 0xe01ef, "Variation Selectors Supplement"],
    [0xf0000, 0xffffd, "Supplementary Private Use Area-A"],
    [0x100000, 0x10fffd, "Supplementary Private Use Area-B"],
  ];

  function codepointBlock(cp) {
    for (const [lo, hi, name] of BLOCKS) {
      if (cp >= lo && cp <= hi) return name;
    }
    return "Unknown";
  }

  // General Category detection via Unicode property escapes (native ICU data, same
  // categories unicodedata.category() returns in the Python engine).
  const GENERAL_CATEGORIES = [
    "Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp", "Zs",
    "Mn", "Mc", "Me", "Nd", "Nl", "No",
    "Lu", "Ll", "Lt", "Lm", "Lo",
    "Pc", "Pd", "Ps", "Pe", "Pi", "Pf", "Po",
    "Sm", "Sc", "Sk", "So",
  ];
  const categoryRegex = new Map(
    GENERAL_CATEGORIES.map((code) => [code, new RegExp(`^\\p{${code}}$`, "u")])
  );

  function unicodeCategory(ch) {
    for (const code of GENERAL_CATEGORIES) {
      if (categoryRegex.get(code).test(ch)) return code;
    }
    return "Cn";
  }

  // Best-effort character names. Full parity with Python's unicodedata.name()
  // would require embedding the entire Unicode Character Database; instead this
  // names ASCII printable/control characters and every codepoint the risk logic
  // below actually cares about, and falls back to "UNKNOWN U+XXXX" otherwise —
  // the same fallback the Python engine uses for unnamed codepoints.
  const C0_NAMES = [
    "NULL", "START OF HEADING", "START OF TEXT", "END OF TEXT", "END OF TRANSMISSION",
    "ENQUIRY", "ACKNOWLEDGE", "BELL", "BACKSPACE", "CHARACTER TABULATION", "LINE FEED",
    "LINE TABULATION", "FORM FEED", "CARRIAGE RETURN", "SHIFT OUT", "SHIFT IN",
    "DATA LINK ESCAPE", "DEVICE CONTROL ONE", "DEVICE CONTROL TWO", "DEVICE CONTROL THREE",
    "DEVICE CONTROL FOUR", "NEGATIVE ACKNOWLEDGE", "SYNCHRONOUS IDLE",
    "END OF TRANSMISSION BLOCK", "CANCEL", "END OF MEDIUM", "SUBSTITUTE", "ESCAPE",
    "INFORMATION SEPARATOR FOUR", "INFORMATION SEPARATOR THREE", "INFORMATION SEPARATOR TWO",
    "INFORMATION SEPARATOR ONE",
  ];

  const SPECIAL_NAMES = {
    0x0020: "SPACE", 0x007f: "DELETE",
    0x00a0: "NO-BREAK SPACE", 0x00ad: "SOFT HYPHEN",
    0x1680: "OGHAM SPACE MARK",
    0x180e: "MONGOLIAN VOWEL SEPARATOR",
    0x2000: "EN QUAD", 0x2001: "EM QUAD", 0x2002: "EN SPACE", 0x2003: "EM SPACE",
    0x2004: "THREE-PER-EM SPACE", 0x2005: "FOUR-PER-EM SPACE", 0x2006: "SIX-PER-EM SPACE",
    0x2007: "FIGURE SPACE", 0x2008: "PUNCTUATION SPACE", 0x2009: "THIN SPACE",
    0x200a: "HAIR SPACE",
    0x200b: "ZERO WIDTH SPACE", 0x200c: "ZERO WIDTH NON-JOINER", 0x200d: "ZERO WIDTH JOINER",
    0x2028: "LINE SEPARATOR", 0x2029: "PARAGRAPH SEPARATOR",
    0x202a: "LEFT-TO-RIGHT EMBEDDING", 0x202b: "RIGHT-TO-LEFT EMBEDDING",
    0x202c: "POP DIRECTIONAL FORMATTING", 0x202d: "LEFT-TO-RIGHT OVERRIDE",
    0x202e: "RIGHT-TO-LEFT OVERRIDE", 0x202f: "NARROW NO-BREAK SPACE",
    0x205f: "MEDIUM MATHEMATICAL SPACE",
    0x2060: "WORD JOINER", 0x2061: "FUNCTION APPLICATION", 0x2062: "INVISIBLE TIMES",
    0x2063: "INVISIBLE SEPARATOR", 0x2064: "INVISIBLE PLUS",
    0x2066: "LEFT-TO-RIGHT ISOLATE", 0x2067: "RIGHT-TO-LEFT ISOLATE",
    0x2068: "FIRST STRONG ISOLATE", 0x2069: "POP DIRECTIONAL ISOLATE",
    0x3000: "IDEOGRAPHIC SPACE",
    0xfeff: "ZERO WIDTH NO-BREAK SPACE",
    0xfff9: "INTERLINEAR ANNOTATION ANCHOR", 0xfffa: "INTERLINEAR ANNOTATION SEPARATOR",
    0xfffb: "INTERLINEAR ANNOTATION TERMINATOR",
    0xfffe: "<noncharacter-FFFE>", 0xffff: "<noncharacter-FFFF>",
  };

  function codepointName(cp) {
    if (SPECIAL_NAMES[cp]) return SPECIAL_NAMES[cp];
    if (cp >= C0_LO && cp <= C0_HI) return C0_NAMES[cp];
    if (cp >= UNICODE_TAG_LO && cp <= UNICODE_TAG_HI) return `TAG CHARACTER U+${hex(cp)}`;
    if (cp >= VARIATION_SELECTOR_LO && cp <= VARIATION_SELECTOR_HI)
      return `VARIATION SELECTOR-${cp - VARIATION_SELECTOR_LO + 1}`;
    if (NONCHARACTERS.has(cp)) return `<noncharacter-${hex(cp)}>`;
    return `UNKNOWN U+${hex(cp)}`;
  }

  function hex(cp) {
    return cp.toString(16).toUpperCase().padStart(4, "0");
  }

  function classifyChar(ch, index) {
    const cp = ch.codePointAt(0);
    const category = unicodeCategory(ch);
    const name = codepointName(cp);
    const block = codepointBlock(cp);

    const tags = [];
    let risk = "none";
    let visible;

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      visible = true;
    } else if (INVISIBLE_WHITESPACE.has(cp)) {
      visible = false;
      tags.push("invisible-whitespace");
    } else if (ZERO_WIDTH_CHARS.has(cp)) {
      visible = false;
      tags.push("zero-width");
    } else if (HIDDEN_CATEGORIES.has(category)) {
      visible = false;
    } else {
      visible = true;
    }

    if (ZERO_WIDTH_CHARS.has(cp)) {
      if (!tags.includes("zero-width")) tags.push("zero-width");
      risk = "critical";
    }
    if (BIDI_OVERRIDES.has(cp)) {
      tags.push("bidi-override");
      risk = "critical";
    }
    if (cp >= UNICODE_TAG_LO && cp <= UNICODE_TAG_HI) {
      tags.push("unicode-tag");
      risk = "critical";
    }
    if (INTERLINEAR_ANNOTATION.has(cp)) {
      tags.push("interlinear-annotation");
      if (risk !== "critical") risk = "high";
    }
    if (cp >= C0_LO && cp <= C0_HI && cp !== 0x0009 && cp !== 0x000a && cp !== 0x000d) {
      tags.push("c0-control");
      if (risk !== "critical") risk = "high";
    }
    if (cp >= C1_LO && cp <= C1_HI) {
      tags.push("c1-control");
      if (risk !== "critical") risk = "high";
    }
    if (
      (cp >= VARIATION_SELECTOR_LO && cp <= VARIATION_SELECTOR_HI) ||
      (cp >= VARIATION_SELECTOR_SUPP_LO && cp <= VARIATION_SELECTOR_SUPP_HI)
    ) {
      tags.push("variation-selector");
      if (risk !== "critical" && risk !== "high") risk = "medium";
    }
    if (
      (cp >= PUA_BMP_LO && cp <= PUA_BMP_HI) ||
      (cp >= PUA_AST_LO && cp <= PUA_AST_HI) ||
      (cp >= PUA_B_LO && cp <= PUA_B_HI)
    ) {
      tags.push("private-use-area");
      if (risk !== "critical" && risk !== "high") risk = "medium";
    }
    if (NONCHARACTERS.has(cp)) {
      tags.push("noncharacter");
      if (risk !== "critical" && risk !== "high") risk = "high";
    }
    if (cp === 0x0000) {
      tags.push("null-byte");
      risk = "critical";
    }

    return { index, char: ch, codepoint: cp, name, category, block, visible, risk, tags };
  }

  function unicodeWordCount(text) {
    let count = 0;
    let inWord = false;
    for (const ch of text) {
      const cat = unicodeCategory(ch);
      if (cat.startsWith("L") || cat.startsWith("N")) {
        if (!inWord) {
          count += 1;
          inWord = true;
        }
      } else if (cat === "Mn" || cat === "Mc") {
        continue;
      } else {
        inWord = false;
      }
    }
    return count;
  }

  function naiveWordCount(text) {
    const trimmed = text.trim();
    return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  }

  function scanText(text) {
    const findings = [];
    let i = 0;
    for (const ch of text) {
      findings.push(classifyChar(ch, i));
      i += 1;
    }

    const visibleCount = findings.reduce((n, f) => n + (f.visible ? 1 : 0), 0);
    const hiddenCount = findings.length - visibleCount;

    const categoryCounts = {};
    const riskCounts = {};
    for (const f of findings) {
      categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
      riskCounts[f.risk] = (riskCounts[f.risk] || 0) + 1;
    }

    return {
      totalChars: findings.length,
      visibleChars: visibleCount,
      hiddenChars: hiddenCount,
      visibleWordCount: naiveWordCount(text),
      actualWordCount: unicodeWordCount(text),
      categoryCounts,
      riskCounts,
      findings,
    };
  }

  // ====================== Payload extraction (payload_extractor.py port) ======================

  const ZWSP_BINARY_MAP = {
    0x200b: "1", 0x200c: "1", 0x200d: "0", 0xfeff: "0", 0x2060: "1", 0x2062: "0",
  };

  function extractZwspBinary(findings) {
    const bits = [];
    for (const f of findings) {
      const b = ZWSP_BINARY_MAP[f.codepoint];
      if (b !== undefined) bits.push(b);
    }
    if (bits.length < 8) return null;

    const result = [];
    let acc = "";
    for (const bit of bits) {
      acc += bit;
      if (acc.length === 8) {
        const val = parseInt(acc, 2);
        if (val >= 32 && val < 127) result.push(String.fromCharCode(val));
        else if (val === 10) result.push("\\n");
        else if (val === 13) result.push("\\r");
        else result.push(`[${val.toString(16).padStart(2, "0")}]`);
        acc = "";
      }
    }
    return result.length ? result.join("") : null;
  }

  function extractBidiReversal(findings) {
    let mode = null;
    let buf = [];
    const segments = [];

    for (const f of findings) {
      if (f.codepoint === 0x202e) {
        mode = "rlo";
        buf = [];
      } else if (f.codepoint === 0x202d) {
        mode = "lro";
        buf = [];
      } else if (f.codepoint === 0x202c) {
        if (mode && buf.length) {
          segments.push(`[${mode}] ${buf.slice().reverse().join("")}`);
        }
        mode = null;
        buf = [];
      } else if (mode && f.visible && f.category.startsWith("L")) {
        buf.push(f.char);
      }
    }
    return segments.length ? segments.join("\n") : null;
  }

  const TAG_LETTER_MAP = {};
  for (let cp = 0xe0021; cp <= 0xe007a; cp++) {
    TAG_LETTER_MAP[cp] = String.fromCharCode(cp - 0xe0000 + "a".charCodeAt(0));
  }
  for (let cp = 0xe0030; cp <= 0xe0039; cp++) {
    TAG_LETTER_MAP[cp] = String.fromCharCode(cp - 0xe0000 + "0".charCodeAt(0));
  }
  TAG_LETTER_MAP[0xe0020] = " ";

  function extractTagBlock(findings) {
    const segments = [];
    let inTag = false;
    let buf = [];
    for (const f of findings) {
      if (f.codepoint === 0xe0001) {
        inTag = true;
        buf = [];
      } else if (f.codepoint === 0xe007f) {
        if (inTag && buf.length) segments.push(buf.join(""));
        inTag = false;
        buf = [];
      } else if (inTag && TAG_LETTER_MAP[f.codepoint] !== undefined) {
        buf.push(TAG_LETTER_MAP[f.codepoint]);
      }
    }
    return segments.length ? segments.join(" | ") : null;
  }

  function extractNullByteChunks(findings) {
    const chunks = [];
    let buf = [];
    for (const f of findings) {
      if (f.codepoint === 0x0000) {
        if (buf.length) {
          chunks.push(buf.join(""));
          buf = [];
        }
      } else {
        buf.push(f.char);
      }
    }
    if (buf.length) chunks.push(buf.join(""));
    return chunks.filter((c) => c.length > 0 && c !== " " && c.length < 200);
  }

  function extractControlSequences(findings) {
    const seqs = [];
    let buf = [];
    for (const f of findings) {
      if (f.category === "Cc" && f.codepoint !== 0x000a && f.codepoint !== 0x000d && f.codepoint !== 0x0009) {
        buf.push(`U+${hex(f.codepoint)}`);
      } else {
        if (buf.length >= 2) seqs.push(buf.join(" "));
        buf = [];
      }
    }
    if (buf.length >= 2) seqs.push(buf.join(" "));
    return seqs.length ? seqs.join("\n") : null;
  }

  function extractAll(findings) {
    const payloads = [];

    const zwsp = extractZwspBinary(findings);
    if (zwsp) payloads.push({ type: "zwsp_binary_stream", decoded: zwsp, description: "Zero-width space binary encoding" });

    const bidi = extractBidiReversal(findings);
    if (bidi) payloads.push({ type: "bidi_override_reversal", decoded: bidi, description: "Bidi-override reversed text" });

    const tags = extractTagBlock(findings);
    if (tags) payloads.push({ type: "unicode_tag_block", decoded: tags, description: "Unicode tag block metadata" });

    for (const chunk of extractNullByteChunks(findings)) {
      payloads.push({ type: "null_byte_delimited", decoded: chunk, description: "Null-byte-delimited segment" });
    }

    const controlSeq = extractControlSequences(findings);
    if (controlSeq) payloads.push({ type: "control_sequence", decoded: controlSeq, description: "Control character sequence" });

    return payloads;
  }

  // ====================== Encoding detection for uploaded files ======================

  const BOM_TABLE = [
    { bytes: [0xff, 0xfe, 0x00, 0x00], encoding: "utf-32-le" },
    { bytes: [0x00, 0x00, 0xfe, 0xff], encoding: "utf-32-be" },
    { bytes: [0xef, 0xbb, 0xbf], encoding: "utf-8" },
    { bytes: [0xff, 0xfe], encoding: "utf-16-le" },
    { bytes: [0xfe, 0xff], encoding: "utf-16-be" },
  ];

  function detectBom(bytes) {
    for (const { bytes: bom, encoding } of BOM_TABLE) {
      if (bytes.length >= bom.length && bom.every((b, i) => bytes[i] === b)) {
        return { hasBom: true, bomEncoding: encoding };
      }
    }
    return { hasBom: false, bomEncoding: null };
  }

  const TEXT_DECODER_LABELS = {
    "utf-8": "utf-8",
    "utf-16-le": "utf-16le",
    "utf-16-be": "utf-16be",
    "utf-32-le": "utf-8", // browsers have no native UTF-32 decoder; fall back below
    "utf-32-be": "utf-8",
  };

  function decodeBytes(bytes) {
    const { hasBom, bomEncoding } = detectBom(bytes);
    let encoding = "utf-8";
    let text;

    if (hasBom && bomEncoding !== "utf-32-le" && bomEncoding !== "utf-32-be") {
      encoding = bomEncoding;
      text = new TextDecoder(TEXT_DECODER_LABELS[bomEncoding]).decode(bytes);
    } else if (hasBom) {
      // No native UTF-32 TextDecoder in browsers; decode as latin-1 fallback like the
      // Python engine does when its chosen codec can't decode the bytes.
      encoding = "latin-1 (fallback)";
      text = decodeLatin1(bytes);
    } else {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        encoding = "utf-8";
      } catch (e) {
        try {
          text = new TextDecoder("utf-16le", { fatal: true }).decode(bytes);
          encoding = "utf-16";
        } catch (e2) {
          text = decodeLatin1(bytes);
          encoding = "latin-1";
        }
      }
    }

    return { text, encoding, hasBom, bomEncoding };
  }

  function decodeLatin1(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  // ====================== Public report builders (match ipc_bridge.py's JSON shape) ======================

  function buildReport(text, file) {
    const scan = scanText(text);
    const findings = scan.findings.map((f) => ({
      index: f.index,
      char: f.char,
      codepoint: `U+${hex(f.codepoint)}`,
      codepoint_int: f.codepoint,
      name: f.name,
      category: f.category,
      block: f.block,
      visible: f.visible,
      risk: f.risk,
      tags: f.tags,
    }));
    const extractedPayloads = extractAll(scan.findings);

    return {
      file,
      stats: {
        total_chars: scan.totalChars,
        visible_chars: scan.visibleChars,
        hidden_chars: scan.hiddenChars,
        hidden_pct: scan.totalChars ? Math.round((scan.hiddenChars / scan.totalChars) * 10000) / 100 : 0,
        visible_word_count: scan.visibleWordCount,
        actual_word_count: scan.actualWordCount,
        word_count_delta: scan.actualWordCount - scan.visibleWordCount,
        category_counts: scan.categoryCounts,
        risk_counts: scan.riskCounts,
      },
      findings,
      extracted_payloads: extractedPayloads,
    };
  }

  function scanPastedText(text, label) {
    return buildReport(text, {
      path: label || "(pasted text)",
      size: new TextEncoder().encode(text).length,
      encoding: "utf-8 (pasted)",
      has_bom: false,
      bom_encoding: null,
    });
  }

  function scanFileBytes(bytes, fileName) {
    const { text, encoding, hasBom, bomEncoding } = decodeBytes(bytes);
    return buildReport(text, {
      path: fileName,
      size: bytes.length,
      encoding,
      has_bom: hasBom,
      bom_encoding: bomEncoding,
    });
  }

  global.PayloadRevealerEngine = {
    scanText,
    classifyChar,
    extractAll,
    scanPastedText,
    scanFileBytes,
    decodeBytes,
  };
})(typeof window !== "undefined" ? window : globalThis);
