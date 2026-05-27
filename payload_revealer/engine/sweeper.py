"""Core character scanner - enumerates every character and classifies it."""

from dataclasses import dataclass
from collections import Counter
import unicodedata

HIDDEN_CATEGORIES = frozenset({"Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp"})

INVISIBLE_WHITESPACE = frozenset({
    0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
    0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
    0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000,
    0xFEFF, 0x180E,
})

ZERO_WIDTH_CHARS = frozenset({
    0x200B, 0x200C, 0x200D, 0xFEFF, 0x2060,
    0x2061, 0x2062, 0x2063, 0x2064, 0x180E, 0x00AD,
})

BIDI_OVERRIDES = frozenset({
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066,
    0x2067, 0x2068, 0x2069,
})

UNICODE_TAG_RANGE = range(0xE0001, 0xE007F + 1)
VARIATION_SELECTOR_RANGE = range(0xFE00, 0xFE0F + 1)
VARIATION_SELECTOR_SUPP = range(0xE0100, 0xE01EF + 1)
C0_CONTROLS = range(0x0000, 0x001F + 1)
C1_CONTROLS = range(0x0080, 0x009F + 1)
PUA_BMP = range(0xE000, 0xF8FF + 1)
PUA_AST = range(0xF0000, 0xFFFFD + 1)
PUA_B = range(0x100000, 0x10FFFD + 1)
NONCHARACTERS = frozenset({
    *(0xFDD0 + n for n in range(16)),
    0xFFFE, 0xFFFF, 0x1FFFE, 0x1FFFF, 0x2FFFE, 0x2FFFF,
    0x3FFFE, 0x3FFFF, 0x4FFFE, 0x4FFFF, 0x5FFFE, 0x5FFFF,
    0x6FFFE, 0x6FFFF, 0x7FFFE, 0x7FFFF, 0x8FFFE, 0x8FFFF,
    0x9FFFE, 0x9FFFF, 0xAFFFE, 0xAFFFF, 0xBFFFE, 0xBFFFF,
    0xCFFFE, 0xCFFFF, 0xDFFFE, 0xDFFFF, 0xEFFFE, 0xEFFFF,
    0xFFFFE, 0xFFFFF, 0x10FFFE, 0x10FFFF,
})

INTERLINEAR_ANNOTATION = frozenset({0xFFF9, 0xFFFA, 0xFFFB})


@dataclass
class CharFinding:
    index: int
    char: str
    codepoint: int
    name: str
    category: str
    block: str
    visible: bool
    risk: str        # "critical" | "high" | "medium" | "low" | "none"
    tags: list[str]  # e.g. ["zero-width", "bidi-override"]


@dataclass
class PayloadReport:
    file_path: str
    file_size: int
    encoding: str
    has_bom: bool
    bom_encoding: str | None
    total_chars: int
    visible_chars: int
    hidden_chars: int
    visible_word_count: int
    actual_word_count: int
    category_counts: Counter
    risk_counts: Counter
    findings: list[CharFinding]
    extracted_payloads: list[dict]


def classify_char(ch: str, index: int) -> CharFinding:
    if not ch:
        return CharFinding(
            index=index, char="", codepoint=-1, name="(empty string)",
            category="", block="", visible=False, risk="none", tags=["empty"]
        )

    cp = ord(ch)
    category = unicodedata.category(ch)
    try:
        name = unicodedata.name(ch, f"UNKNOWN U+{cp:04X}")
    except ValueError:
        name = f"UNKNOWN U+{cp:04X}"

    try:
        block = _codepoint_block(cp)
    except Exception:
        block = "Unknown"

    tags = []
    risk = "none"

    # Determine visibility
    if ch in {" ", "\t", "\n", "\r"}:
        visible = True          # standard whitespace is "visible" in structure
    elif cp in INVISIBLE_WHITESPACE:
        visible = False
        tags.append("invisible-whitespace")
    elif cp in ZERO_WIDTH_CHARS:
        visible = False
        tags.append("zero-width")
    elif category in HIDDEN_CATEGORIES:
        visible = False
    else:
        visible = True

    # Tag and risk
    if cp in ZERO_WIDTH_CHARS:
        tags.append("zero-width")
        risk = "critical"
    if cp in BIDI_OVERRIDES:
        tags.append("bidi-override")
        risk = "critical"
    if cp in UNICODE_TAG_RANGE:
        tags.append("unicode-tag")
        risk = "critical"
    if cp in INTERLINEAR_ANNOTATION:
        tags.append("interlinear-annotation")
        risk = "high"
    if cp in C0_CONTROLS and cp not in (0x0009, 0x000A, 0x000D):
        tags.append("c0-control")
        if risk not in ("critical",):
            risk = "high"
    if cp in C1_CONTROLS:
        tags.append("c1-control")
        if risk not in ("critical",):
            risk = "high"
    if cp in VARIATION_SELECTOR_RANGE or cp in VARIATION_SELECTOR_SUPP:
        tags.append("variation-selector")
        if risk not in ("critical", "high"):
            risk = "medium"
    if cp in PUA_BMP or cp in PUA_AST or cp in PUA_B:
        tags.append("private-use-area")
        if risk not in ("critical", "high"):
            risk = "medium"
    if cp in NONCHARACTERS:
        tags.append("noncharacter")
        if risk not in ("critical", "high"):
            risk = "high"

    if cp == 0x0000:
        tags.append("null-byte")
        risk = "critical"

    return CharFinding(
        index=index, char=ch, codepoint=cp, name=name,
        category=category, block=block, visible=visible,
        risk=risk, tags=tags,
    )


def _codepoint_block(cp: int) -> str:
    # Lightweight block lookup without regex/Icu
    blocks = [
        (0x0000, 0x007F, "Basic Latin"),
        (0x0080, 0x00FF, "Latin-1 Supplement"),
        (0x0100, 0x017F, "Latin Extended-A"),
        (0x0180, 0x024F, "Latin Extended-B"),
        (0x0250, 0x02AF, "IPA Extensions"),
        (0x02B0, 0x02FF, "Spacing Modifier Letters"),
        (0x0300, 0x036F, "Combining Diacritical Marks"),
        (0x0370, 0x03FF, "Greek and Coptic"),
        (0x0400, 0x04FF, "Cyrillic"),
        (0x0500, 0x052F, "Cyrillic Supplement"),
        (0x0530, 0x058F, "Armenian"),
        (0x0590, 0x05FF, "Hebrew"),
        (0x0600, 0x06FF, "Arabic"),
        (0x0700, 0x074F, "Syriac"),
        (0x0780, 0x07BF, "Thaana"),
        (0x0900, 0x097F, "Devanagari"),
        (0x0E00, 0x0E7F, "Thai"),
        (0x0E80, 0x0EFF, "Lao"),
        (0x1000, 0x109F, "Myanmar"),
        (0x1100, 0x11FF, "Hangul Jamo"),
        (0x2000, 0x206F, "General Punctuation"),
        (0x2070, 0x209F, "Superscripts and Subscripts"),
        (0x20A0, 0x20CF, "Currency Symbols"),
        (0x20D0, 0x20FF, "Combining Diacritical Marks for Symbols"),
        (0x2100, 0x214F, "Letterlike Symbols"),
        (0x2150, 0x218F, "Number Forms"),
        (0x2190, 0x21FF, "Arrows"),
        (0x2200, 0x22FF, "Mathematical Operators"),
        (0x2300, 0x23FF, "Miscellaneous Technical"),
        (0x2400, 0x243F, "Control Pictures"),
        (0x2460, 0x24FF, "Enclosed Alphanumerics"),
        (0x2500, 0x257F, "Box Drawing"),
        (0x2580, 0x259F, "Block Elements"),
        (0x25A0, 0x25FF, "Geometric Shapes"),
        (0x2600, 0x26FF, "Miscellaneous Symbols"),
        (0x2700, 0x27BF, "Dingbats"),
        (0x27C0, 0x27EF, "Miscellaneous Mathematical Symbols-A"),
        (0x27F0, 0x27FF, "Supplemental Arrows-A"),
        (0x2800, 0x28FF, "Braille Patterns"),
        (0x2900, 0x297F, "Supplemental Arrows-B"),
        (0x2980, 0x29FF, "Miscellaneous Mathematical Symbols-B"),
        (0x2A00, 0x2AFF, "Supplemental Mathematical Operators"),
        (0x2B00, 0x2BFF, "Miscellaneous Symbols and Arrows"),
        (0x3000, 0x303F, "CJK Symbols and Punctuation"),
        (0x3040, 0x309F, "Hiragana"),
        (0x30A0, 0x30FF, "Katakana"),
        (0x4E00, 0x9FFF, "CJK Unified Ideographs"),
        (0xE000, 0xF8FF, "Private Use Area"),
        (0xE0001, 0xE007F, "Tags"),
        (0xE0100, 0xE01EF, "Variation Selectors Supplement"),
        (0xF0000, 0xFFFFD, "Supplementary Private Use Area-A"),
        (0x100000, 0x10FFFD, "Supplementary Private Use Area-B"),
    ]
    for lo, hi, name in blocks:
        if lo <= cp <= hi:
            return name
    return "Unknown"


def scan_file(file_path: str) -> PayloadReport:
    with open(file_path, "rb") as f:
        raw = f.read()

    file_size = len(raw)

    # Detect encoding
    encoding = "utf-8"
    has_bom = False
    bom_encoding = None
    bom_map = {
        b"\xef\xbb\xbf": "utf-8",
        b"\xff\xfe": "utf-16-le",
        b"\xfe\xff": "utf-16-be",
        b"\xff\xfe\x00\x00": "utf-32-le",
        b"\x00\x00\xfe\xff": "utf-32-be",
    }
    for bom_bytes, enc in bom_map.items():
        if raw.startswith(bom_bytes):
            has_bom = True
            bom_encoding = enc
            encoding = enc
            break

    if not has_bom:
        try:
            raw.decode("utf-8")
            encoding = "utf-8"
        except UnicodeDecodeError:
            try:
                raw.decode("utf-16")
                encoding = "utf-16"
            except UnicodeDecodeError:
                encoding = "latin-1"  # fallback

    try:
        text = raw.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        text = raw.decode("latin-1")
        encoding = "latin-1 (fallback)"

    findings: list[CharFinding] = []
    for i, ch in enumerate(text):
        findings.append(classify_char(ch, i))

    visible_count = sum(1 for f in findings if f.visible)
    hidden_count = len(findings) - visible_count

    category_counts = Counter(f.category for f in findings)
    risk_counts = Counter(f.risk for f in findings)

    naive_words = len(text.split())
    actual_words = _unicode_word_count(text)

    return PayloadReport(
        file_path=file_path,
        file_size=file_size,
        encoding=encoding,
        has_bom=has_bom,
        bom_encoding=bom_encoding,
        total_chars=len(findings),
        visible_chars=visible_count,
        hidden_chars=hidden_count,
        visible_word_count=naive_words,
        actual_word_count=actual_words,
        category_counts=category_counts,
        risk_counts=risk_counts,
        findings=findings,
        extracted_payloads=[],
    )


def _unicode_word_count(text: str) -> int:
    count = 0
    in_word = False
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N"):
            if not in_word:
                count += 1
                in_word = True
        elif cat == "Mn" or cat == "Mc":
            continue
        else:
            in_word = False
    return count
