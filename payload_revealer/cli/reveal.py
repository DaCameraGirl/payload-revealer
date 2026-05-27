"""CLI headless mode for Payload Revealer."""

import argparse
import sys
import os
import json
import unicodedata

from ..engine.sweeper import scan_file
from ..engine.classifier import summary_text, filter_findings
from ..engine.payload_extractor import extract_all
from ..engine.export_engine import export_json, export_txt, save_report


def _safe_output(text: str) -> str:
    try:
        text.encode(sys.stdout.encoding or "utf-8", errors="strict")
        return text
    except UnicodeEncodeError:
        result = []
        for ch in text:
            try:
                ch.encode(sys.stdout.encoding or "utf-8", errors="strict")
                result.append(ch)
            except UnicodeEncodeError:
                if unicodedata.category(ch) in ("Cc", "Cf", "Co", "Cs"):
                    result.append(f"<U+{ord(ch):04X}>")
                else:
                    result.append(ch)
        return "".join(result)


def main():
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        prog="payload-revealer",
        description="Scan files for hidden Unicode payloads and steganography.",
    )
    parser.add_argument("target", help="File or directory to scan")
    parser.add_argument("--recursive", "-r", action="store_true", help="Recurse into directories")
    parser.add_argument("--format", "-f", choices=["json", "text", "txt"], default="text",
                        help="Output format (default: text summary)")
    parser.add_argument("--output", "-o", help="Save report to file")
    parser.add_argument("--quiet", "-q", action="store_true", help="Suppress non-result output")
    parser.add_argument("--min-risk", default="low",
                        choices=["critical", "high", "medium", "low", "none"],
                        help="Minimum risk level to show findings")
    parser.add_argument("--version", action="store_true", help="Show version")

    args = parser.parse_args()

    if args.version:
        from .. import __version__
        print(f"Payload Revealer v{__version__}")
        return

    target = os.path.abspath(args.target)

    if os.path.isfile(target):
        _scan_file(target, args)
    elif os.path.isdir(target):
        files = _collect_files(target, args.recursive)
        for f in files:
            _scan_file(f, args)
    else:
        print(f"Error: '{target}' is not a valid file or directory", file=sys.stderr)
        sys.exit(1)


def _collect_files(directory: str, recursive: bool) -> list[str]:
    files = []
    if recursive:
        for root, _, filenames in os.walk(directory):
            for fn in filenames:
                files.append(os.path.join(root, fn))
    else:
        for fn in os.listdir(directory):
            fp = os.path.join(directory, fn)
            if os.path.isfile(fp):
                files.append(fp)
    return sorted(files)


def _scan_file(file_path: str, args):
    if not args.quiet:
        print(f"\nScanning: {file_path}", file=sys.stderr)

    try:
        report = scan_file(file_path)
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        return

    report.extracted_payloads = extract_all(report)

    if args.format == "text":
        if not args.quiet:
            print(summary_text(report))
            findings = filter_findings(report, min_risk=args.min_risk)
            if findings:
                print(f"\n{len(findings)} findings at or above risk '{args.min_risk}':")
                for f in findings[:50]:
                    print(f"  [{f.index:>5}] U+{f.codepoint:04X}  {f.name:<35}  {f.risk:>8}  {' '.join(f.tags)}")
                if len(findings) > 50:
                    print(f"  ... and {len(findings) - 50} more")
            if report.extracted_payloads:
                print("\nExtracted payloads:")
                for p in report.extracted_payloads:
                    print(f"\n  [{p['type']}]")
                    print(f"  {_safe_output(p.get('description', ''))}")
                    for line in p["decoded"].split("\n"):
                        print(f"    {_safe_output(line)}")

    elif args.format == "json":
        output = export_json(report, pretty=not args.quiet)
        if not args.output:
            print(output)

    elif args.format == "txt":
        output = export_txt(report)
        if not args.output:
            print(output)

    if args.output:
        fmt = args.format if args.format != "text" else "txt"
        save_report(report, args.output, fmt=fmt)
        if not args.quiet:
            print(f"\nReport saved to: {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
