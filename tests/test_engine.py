"""Tests for Payload Revealer engine."""

import pathlib
from payload_revealer.engine.sweeper import scan_file, classify_char
from payload_revealer.engine.payload_extractor import extract_all
from payload_revealer.engine.export_engine import export_json, export_txt


fixtures = pathlib.Path(__file__).parent / "fixtures"


def test_scan_normal_text():
    text = "Hello World\nThis is normal text with basic ASCII.\n"
    path = fixtures / "normal.txt"
    path.write_bytes(text.encode("utf-8"))
    report = scan_file(str(path))
    assert report.total_chars == len(text)
    assert report.hidden_chars == 0


def test_scan_zero_width():
    path = fixtures / "zero_width.txt"
    path.write_bytes(
        "Hello\u200b\u200c\u200dWorld".encode("utf-8")
    )
    report = scan_file(str(path))
    assert report.hidden_chars == 3
    assert any(f.codepoint == 0x200B for f in report.findings)
    assert any(f.codepoint == 0x200C for f in report.findings)
    assert any(f.codepoint == 0x200D for f in report.findings)
    findings = [f for f in report.findings if not f.visible]
    assert all(f.risk == "critical" for f in findings)


def test_scan_bidi_override():
    path = fixtures / "bidi.txt"
    path.write_bytes("Before\u202ERev201\u202CAfter".encode("utf-8"))
    report = scan_file(str(path))
    bidi_findings = [f for f in report.findings if "bidi-override" in f.tags]
    assert len(bidi_findings) >= 2
    payloads = extract_all(report)
    bidi_payloads = [p for p in payloads if p["type"] == "bidi_override_reversal"]
    assert len(bidi_payloads) > 0


def test_scan_null_bytes():
    path = fixtures / "null_bytes.txt"
    path.write_bytes(b"before\x00hidden\x00after\x00end")
    report = scan_file(str(path))
    null_findings = [f for f in report.findings if "null-byte" in f.tags]
    assert len(null_findings) == 3
    payloads = extract_all(report)
    null_payloads = [p for p in payloads if p["type"] == "null_byte_delimited"]
    assert any("hidden" in p["decoded"] for p in null_payloads)


def test_export_json():
    path = fixtures / "normal.txt"
    report = scan_file(str(path))
    output = export_json(report)
    assert "total_chars" in output
    assert "findings" in output


def test_export_txt():
    path = fixtures / "normal.txt"
    report = scan_file(str(path))
    output = export_txt(report)
    assert "PAYLOAD REVEALER" in output
