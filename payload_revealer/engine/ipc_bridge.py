"""IPC Bridge - JSON-RPC over stdin/stdout for Electron ↔ Python communication."""

import sys
import json
import traceback

from .engine.sweeper import scan_file
from .engine.classifier import filter_findings
from .engine.payload_extractor import extract_all
from .engine.export_engine import export_json, export_txt


def handle_request(req: dict) -> dict:
    method = req.get("method", "")
    params = req.get("params", {})
    req_id = req.get("id")

    try:
        if method == "scan_file":
            file_path = params["file_path"]
            report = scan_file(file_path)
            report.extracted_payloads = extract_all(report)

            findings = []
            for f in report.findings:
                findings.append({
                    "index": f.index,
                    "char": repr(f.char)[1:-1],
                    "codepoint": f"U+{f.codepoint:04X}",
                    "codepoint_int": f.codepoint,
                    "name": f.name,
                    "category": f.category,
                    "block": f.block,
                    "visible": f.visible,
                    "risk": f.risk,
                    "tags": f.tags,
                })

            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "file": {
                        "path": report.file_path,
                        "size": report.file_size,
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
                    "findings": findings,
                    "extracted_payloads": report.extracted_payloads,
                },
            }

        elif method == "export_report":
            file_path = params["file_path"]
            fmt = params.get("format", "json")
            report = scan_file(file_path)
            report.extracted_payloads = extract_all(report)
            content = export_json(report) if fmt == "json" else export_txt(report)
            return {"jsonrpc": "2.0", "id": req_id, "result": {"content": content}}

        elif method == "version":
            from .. import __version__
            return {"jsonrpc": "2.0", "id": req_id, "result": {"version": __version__}}

        else:
            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}

    except Exception as e:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32000, "message": str(e), "data": traceback.format_exc()}}


def run_ipc():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = handle_request(req)
        sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    run_ipc()
