"""Payload extractor - reconstructs hidden messages from classified characters."""

from .sweeper import CharFinding, PayloadReport


def extract_all(report: PayloadReport) -> list[dict]:
    payloads: list[dict] = []

    zwsp = _extract_zwsp_binary(report.findings)
    if zwsp:
        payloads.append({"type": "zwsp_binary_stream", "decoded": zwsp, "description": "Zero-width space binary encoding"})

    bidi = _extract_bidi_reversal(report.findings)
    if bidi:
        payloads.append({"type": "bidi_override_reversal", "decoded": bidi, "description": "Bidi-override reversed text"})

    tags = _extract_tag_block(report.findings)
    if tags:
        payloads.append({"type": "unicode_tag_block", "decoded": tags, "description": "Unicode tag block metadata"})

    null_chunks = _extract_null_byte_chunks(report.findings)
    for chunk in null_chunks:
        payloads.append({"type": "null_byte_delimited", "decoded": chunk, "description": "Null-byte-delimited segment"})

    control_seq = _extract_control_sequences(report.findings)
    if control_seq:
        payloads.append({"type": "control_sequence", "decoded": control_seq, "description": "Control character sequence"})

    return payloads


ZWSP_BINARY_MAP = {
    0x200B: "1",
    0x200C: "1",
    0x200D: "0",
    0xFEFF: "0",
    0x2060: "1",
    0x2062: "0",
}


def _extract_zwsp_binary(findings: list[CharFinding]) -> str | None:
    bits: list[str] = []
    for f in findings:
        b = ZWSP_BINARY_MAP.get(f.codepoint)
        if b is not None:
            bits.append(b)
    if len(bits) < 8:
        return None
    # Try to decode as 8-bit ASCII
    result: list[str] = []
    byte_acc = ""
    for bit in bits:
        byte_acc += bit
        if len(byte_acc) == 8:
            val = int(byte_acc, 2)
            if 32 <= val < 127:
                result.append(chr(val))
            elif val == 10 or val == 13:
                result.append("\\n" if val == 10 else "\\r")
            else:
                result.append(f"[{val:02x}]")
            byte_acc = ""
    return "".join(result) if result else None


def _extract_bidi_reversal(findings: list[CharFinding]) -> str | None:
    mode = None
    buf: list[str] = []
    segments: list[str] = []

    for f in findings:
        if f.codepoint == 0x202E:  # RLO
            mode = "rlo"
            buf = []
        elif f.codepoint == 0x202D:  # LRO
            mode = "lro"
            buf = []
        elif f.codepoint == 0x202C:  # PDF
            if mode and buf:
                text = "".join(buf)
                segments.append(f"[{mode}] {text[::-1]}")
            mode = None
            buf = []
        elif mode and f.visible and f.category.startswith("L"):
            buf.append(f.char)

    return "\n".join(segments) if segments else None


TAG_LETTER_MAP = {
    cp: chr(cp - 0xE0000 + ord("a"))
    for cp in range(0xE0021, 0xE007A + 1)
}
TAG_LETTER_MAP.update({
    cp: chr(cp - 0xE0000 + ord("0"))
    for cp in range(0xE0030, 0xE0039 + 1)
})
TAG_LETTER_MAP[0xE0020] = " "


def _extract_tag_block(findings: list[CharFinding]) -> str | None:
    segments: list[str] = []
    in_tag = False
    buf: list[str] = []
    for f in findings:
        if f.codepoint == 0xE0001:
            in_tag = True
            buf = []
        elif f.codepoint == 0xE007F:
            if in_tag and buf:
                segments.append("".join(buf))
            in_tag = False
            buf = []
        elif in_tag and f.codepoint in TAG_LETTER_MAP:
            buf.append(TAG_LETTER_MAP[f.codepoint])
    return " | ".join(segments) if segments else None


def _extract_null_byte_chunks(findings: list[CharFinding]) -> list[str]:
    chunks: list[str] = []
    buf: list[str] = []
    for f in findings:
        if f.codepoint == 0x0000:
            if buf:
                chunks.append("".join(buf))
                buf = []
        else:
            buf.append(f.char)
    if buf:
        chunks.append("".join(buf))
    # Filter to only non-trivial, suspicious chunks
    return [c for c in chunks if len(c) > 0 and c != " " and len(c) < 200]


def _extract_control_sequences(findings: list[CharFinding]) -> str | None:
    # Collect sequences of consecutive control chars
    seqs: list[str] = []
    buf: list[str] = []
    for f in findings:
        if f.category == "Cc" and f.codepoint not in (0x000A, 0x000D, 0x0009):
            buf.append(f"U+{f.codepoint:04X}")
        else:
            if len(buf) >= 2:
                seqs.append(" ".join(buf))
            buf = []
    if len(buf) >= 2:
        seqs.append(" ".join(buf))
    return "\n".join(seqs) if seqs else None
