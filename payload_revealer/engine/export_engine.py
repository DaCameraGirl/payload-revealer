"""Export engine - JSON and TXT artifact generation."""

import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from .sweeper import PayloadReport


def export_json(report: PayloadReport, pretty: bool = True) -> str:
    raw = Path(report.file_path).read_bytes()
    sha256 = hashlib.sha256(raw).hexdigest()

    findings_serialized = []
    for f in report.findings:
        findings_serialized.append({
            "index": f.index,
            "char": repr(f.char)[1:-1],
            "codepoint": f"U+{f.codepoint:04X}",
            "name": f.name,
            "category": f.category,
            "block": f.block,
            "visible": f.visible,
            "risk": f.risk,
            "tags": f.tags,
        })

    obj = {
        "tool": "Payload Revealer v1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "file": {
            "path": report.file_path,
            "size_bytes": report.file_size,
            "sha256": sha256,
            "encoding": report.encoding,
            "has_bom": report.has_bom,
            "bom_encoding": report.bom_encoding,
        },
        "stats": {
            "total_chars": report.total_chars,
            "visible_chars": report.visible_chars,
            "hidden_chars": report.hidden_chars,
            "hidden_pct": round(report.hidden_chars / max(report.total_chars, 1) * 100, 2),
            "visible_word_count": report.visible_word_count,
            "actual_word_count": report.actual_word_count,
            "word_count_delta": report.actual_word_count - report.visible_word_count,
            "category_counts": dict(report.category_counts),
            "risk_counts": dict(report.risk_counts),
        },
        "findings": findings_serialized,
        "extracted_payloads": report.extracted_payloads,
    }

    return json.dumps(obj, indent=2 if pretty else None, ensure_ascii=False)


def export_txt(report: PayloadReport) -> str:
    lines = []

    lines.append("=" * 60)
    lines.append("  PAYLOAD REVEALER - DECODED REPORT")
    lines.append("=" * 60)
    lines.append(f"File:       {report.file_path}")
    lines.append(f"Size:       {report.file_size:,} bytes")
    lines.append(f"Encoding:   {report.encoding}" + (" (BOM)" if report.has_bom else ""))
    if report.bom_encoding:
        lines.append(f"BOM Type:   {report.bom_encoding}")
    lines.append(f"Timestamp:  {datetime.now(timezone.utc).isoformat()}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("  CHARACTER STATISTICS")
    lines.append("-" * 60)
    lines.append(f"Total characters:   {report.total_chars:,}")
    lines.append(f"Visible characters: {report.visible_chars:,}")
    lines.append(f"Hidden characters:  {report.hidden_chars:,} ({_pct(report)})")
    lines.append(f"Naive word count:   {report.visible_word_count:,}")
    lines.append(f"Actual word count:  {report.actual_word_count:,}")
    lines.append(f"Word count delta:   {report.actual_word_count - report.visible_word_count:+,}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("  CATEGORY BREAKDOWN")
    lines.append("-" * 60)
    for cat, count in report.category_counts.most_common():
        lines.append(f"  {cat:6s}  {count:>8,}")
    lines.append("")
    lines.append("-" * 60)
    lines.append("  RISK BREAKDOWN")
    lines.append("-" * 60)
    for risk in ["critical", "high", "medium", "low", "none"]:
        count = report.risk_counts.get(risk, 0)
        if count:
            marker = { "critical": "!!", "high": "!", "medium": "~", "low": "-", "none": " " }
            lines.append(f"  {marker.get(risk, ' ')} {risk:8s}  {count:>8,}")
    lines.append("")

    findings = [f for f in report.findings if not f.visible or f.risk != "none"]
    if findings:
        lines.append("-" * 60)
        lines.append("  HIDDEN & SUSPICIOUS CHARACTERS")
        lines.append("-" * 60)
        lines.append(f"{'Index':>6}  {'Codepoint':>10}  {'Name':<40}  {'Risk':>8}")
        lines.append("-" * 60)
        for f in findings:
            lines.append(f"{f.index:>6}  U+{f.codepoint:04X}     {f.name:<40}  {f.risk:>8}")

    if report.extracted_payloads:
        lines.append("")
        lines.append("=" * 60)
        lines.append("  EXTRACTED PAYLOADS")
        lines.append("=" * 60)
        for i, p in enumerate(report.extracted_payloads, 1):
            lines.append(f"\n[{i}] {p['type']}")
            lines.append(f"    Description: {p.get('description', 'N/A')}")
            lines.append(f"    Content:")
            for line in p["decoded"].split("\n"):
                lines.append(f"      {line}")

    lines.append("")
    lines.append("=" * 60)
    lines.append("  END OF REPORT")
    lines.append("=" * 60)
    return "\n".join(lines)


def _pct(report: PayloadReport) -> str:
    if report.total_chars == 0:
        return "0.00%"
    return f"{report.hidden_chars / report.total_chars * 100:.2f}%"


def save_report(report: PayloadReport, output_path: str, fmt: str = "json") -> str:
    content = export_json(report) if fmt == "json" else export_txt(report)
    Path(output_path).write_text(content, encoding="utf-8")
    return output_path
