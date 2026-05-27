import pathlib

payload = "beacon://c2-exfil.lan/reg?agent=demo-01"

bits = []
for ch in payload:
    bits.extend(format(ord(ch), '08b'))

hidden_chars = []
for bit in bits:
    hidden_chars.append('\u200b' if bit == '1' else '\u200d')

visible_words = [
    "Forensic", "Analysis", "Report",
    "Case", "ID:", "FR-2026-05-27-001",
    "Classification:", "CONFIDENTIAL",
    "",
    "Executive", "Summary:",
    "During", "routine", "audit", "of", "internal",
    "network", "segment", "172.16.0.0/24,", "anomalous",
    "outbound", "connections", "were", "identified",
    "originating", "from", "host", "WORKSTN-204.",
    "",
    "Indicators", "of", "Compromise:",
    "-", "Unexpected", "TLS", "handshakes", "to", "unregistered",
    "external", "IP", "ranges",
    "-", "Base64-encoded", "DNS", "queries", "to",
    "non-corporate", "resolvers",
    "-", "Modified", "Windows", "registry", "autorun", "keys",
    "",
    "Extracted", "Artifacts:",
    "SHA256:", "a3f8b2c1...",
    "File:", "svchost_modified.exe",
    "Path:", "C:\\Users\\public\\",
    "",
    "Recommendation:",
    "Immediately", "isolate", "affected", "hosts.",
    "Revoke", "all", "active", "session", "tokens.",
    "Rotate", "domain", "admin", "credentials.",
    "Escalate", "to", "tier-3", "incident", "response.",
    "",
    "---", "END", "OF", "REPORT", "---",
]

result = []
hi = 0
for word in visible_words:
    for ch in word:
        result.append(ch)
        if hi < len(hidden_chars):
            result.append(hidden_chars[hi])
            hi += 1
    result.append(' ')

text = ''.join(result)

fixture_path = pathlib.Path('tests/fixtures/forensic_report.txt')
fixture_path.write_text(text, encoding='utf-8')

print(f'Wrote {fixture_path}')
print(f'Payload length: {len(payload)} chars ({len(bits)} bits)')
print(f'Hidden chars embedded: {hi}')
print(f'Total chars in file: {len(text)}')
