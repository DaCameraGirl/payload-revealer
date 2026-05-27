"""Unicode classifier - alternative view grouped by category/block/risk."""

from .sweeper import PayloadReport, CharFinding


def filter_findings(report: PayloadReport, *, min_risk: str = "low") -> list[CharFinding]:
    risk_order = {"critical": 5, "high": 4, "medium": 3, "low": 2, "none": 1}
    threshold = risk_order.get(min_risk, 1)
    return [f for f in report.findings if risk_order.get(f.risk, 0) >= threshold]


def group_by_category(report: PayloadReport) -> dict[str, list[CharFinding]]:
    groups: dict[str, list[CharFinding]] = {}
    for f in report.findings:
        groups.setdefault(f.category, []).append(f)
    return groups


def group_by_tag(report: PayloadReport) -> dict[str, list[CharFinding]]:
    groups: dict[str, list[CharFinding]] = {}
    for f in report.findings:
        for tag in f.tags:
            groups.setdefault(tag, []).append(f)
    return groups


def summary_text(report: PayloadReport) -> str:
    lines = [
        f"File: {report.file_path}",
        f"Size: {report.file_size:,} bytes",
        f"Encoding: {report.encoding}" + (" (BOM)" if report.has_bom else ""),
        f"Total characters: {report.total_chars:,}",
        f"  Visible: {report.visible_chars:,}",
        f"  Hidden:  {report.hidden_chars:,}",
        f"Naive word count: {report.visible_word_count:,}",
        f"Unicode-aware word count: {report.actual_word_count:,}",
        "",
        "Category breakdown:",
    ]
    for cat, count in report.category_counts.most_common():
        lines.append(f"  {cat}: {count:,}")
    lines.append("")
    lines.append("Risk breakdown:")
    for risk in ["critical", "high", "medium", "low", "none"]:
        count = report.risk_counts.get(risk, 0)
        if count:
            lines.append(f"  {risk}: {count:,}")
    return "\n".join(lines)
