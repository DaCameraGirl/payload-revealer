<p align="center">
  <img src="docs/readme-banner.svg" alt="Payload Revealer — Catches invisible Unicode instructions hidden inside copied Slack, chat, and doc text." width="720" />
</p>

<p align="center">
  <strong>Catches invisible Unicode instructions hidden inside copied text — zero-width characters, bidi overrides, Unicode tags, and other copy/paste artifacts that can smuggle answers or prompt instructions into Slack, docs, chats, or evaluation tasks.</strong>
</p>

<p align="center">
  <a href="https://dacameragirl.github.io/payload-revealer/"><img src="https://img.shields.io/badge/Project%20page-GitHub%20Pages-33d69f?style=for-the-badge&logo=github&logoColor=white" alt="Project page" /></a>
  <a href="https://github.com/DaCameraGirl/payload-revealer"><img src="https://img.shields.io/badge/Code-GitHub-58a6ff?style=for-the-badge&logo=github&logoColor=white" alt="Source code" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/deploy-GitHub Pages-000000?style=flat-square&logo=github&logoColor=white" alt="deploy-GitHub Pages" />
  <img src="https://img.shields.io/badge/stack-Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="stack-Python" />
</p>

### Languages

<p align="center">
  <img src="https://img.shields.io/badge/Python-52%25-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/JavaScript-29%25-F7DF1E?style=flat-square&logo=javascript&logoColor=111" alt="JavaScript" />
  <img src="https://img.shields.io/badge/CSS-13%25-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS" />
</p>

### Stack

<p align="center">
  <img src="https://img.shields.io/badge/Python-analysis-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python-analysis" />
  <img src="https://img.shields.io/badge/GitHub Pages-live-33d69f?style=flat-square&logo=github&logoColor=white" alt="GitHub Pages-live" />
</p>

<p align="center">
  Built by <strong>Angela Hudson</strong> · <a href="https://github.com/DaCameraGirl">DaCameraGirl</a>
</p>
# Payload Revealer

[![CI](https://github.com/DaCameraGirl/payload-revealer/actions/workflows/ci.yml/badge.svg)](https://github.com/DaCameraGirl/payload-revealer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/DaCameraGirl/payload-revealer?style=flat&color=blue)](https://github.com/DaCameraGirl/payload-revealer/releases/tag/v1.0.0)
[![Download](https://img.shields.io/badge/download-7.2MB%20.exe-brightgreen)](https://github.com/DaCameraGirl/payload-revealer/releases/download/v1.0.0/payload_revealer_engine-v1.0.0-win64.exe)

**Anti-hidden-answer scanner for copied text.**  
Built for DFIR analysts, developers, AI output auditing, and anyone vetting pasted Slack/chat/doc content.

Payload Revealer catches invisible Unicode instructions hidden inside copied text, including zero-width characters, bidi overrides, Unicode tags, and other hidden copy/paste artifacts that can smuggle answers or prompt instructions into Slack, docs, chats, or evaluation tasks. It scans text files character-by-character, flags invisible codepoints with risk tags (`zero-width`, `bidi-override`, `unicode-tag`, `c0-control`, `null-byte`, and more), and extracts decoded payloads when the hidden data uses supported encodings (zero-width binary streams, bidi reversals, Unicode tag blocks, null-byte chunks, and control sequences).

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=The%20Slack%20Scenario&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="The Slack Scenario" /></p>

A copied answer can look normal in Slack while carrying invisible Unicode underneath — hidden instructions like “pick option 3” or “tell them X said Y.” PowerShell and some editors may expose weird characters; Payload Revealer does the systematic version: enumerate every codepoint, report suspicious invisible characters, and decode embedded payloads when possible.

**If something pasted suspicious:**

1. Save the pasted text to a plain `.txt` file (not rich text).
2. Scan it:

```bash
python -m payload_revealer .\suspicious.txt
```

3. For a shareable audit trail:

```bash
python -m payload_revealer .\suspicious.txt --format json --output report.json
```

If the hidden instruction used zero-width Unicode, bidi tricks, Unicode tags, or control characters — and those codepoints survived the paste — this tool is built to catch it.

![demo](docs/demo.gif)

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=Quick%20Download&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="Quick Download" /></p>


**[Download payload_revealer_engine-v1.0.0-win64.exe](https://github.com/DaCameraGirl/payload-revealer/releases/download/v1.0.0/payload_revealer_engine-v1.0.0-win64.exe)** — 7.2MB standalone Windows executable, no Python required. Drag a file onto the drop zone or click Open File.

Or use the CLI with Python:

```bash
pip install -e .
python -m payload_revealer tests/fixtures/forensic_report.txt
```

The fixture contains 312 zero-width characters encoding a hidden beacon URL:

```
beacon://c2-exfil.lan/reg?agent=demo-01
```

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=Features&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="Features" /></p>


- **Character Count Scanner** — Total character count even if content is invisible
- **Invisible Payload Detector** — Flags zero-width spaces, Unicode control characters, bidirectional overrides, invisible whitespace, Unicode tags, and other hidden text artifacts
- **Visualizer Panel** — Shows hidden content in decoded, readable format
- **Word Count Tracker** — Actual word count vs. visible word count
- **Export Option** — Save decoded payload as `.txt` or `.json` forensic artifact

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=Installation&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="Installation" /></p>


```bash
git clone https://github.com/DaCameraGirl/payload-revealer.git
cd payload-revealer
npm install
pip install -e .
```

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=Usage&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="Usage" /></p>


### Desktop App (Electron)

```bash
npm start
```

### CLI Headless Mode

```bash
# Quick scan
python -m payload_revealer ./suspicious.txt

# JSON output
python -m payload_revealer ./suspicious.txt --format json

# Save report
python -m payload_revealer ./suspicious.txt --output report.json

# Batch scan a directory
python -m payload_revealer ./suspicious_docs/ --recursive
```

### CLI Options

| Flag | Description |
|------|-------------|
| `--format, -f` | `text`, `json`, or `txt` (default: text) |
| `--output, -o` | Save report to file |
| `--recursive, -r` | Recurse into directories |
| `--min-risk` | Filter findings: `critical`, `high`, `medium`, `low`, `none` |
| `--quiet, -q` | Suppress non-result output |
| `--version` | Show version |

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=What%20It%20Detects&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="What It Detects" /></p>


| Category | Examples | Risk |
|----------|----------|------|
| Zero-width spaces | `U+200B`, `U+200C`, `U+200D`, `U+FEFF` | Critical |
| Bidi overrides | `U+202A`–`U+202E` (LRE, RLO, etc.) | Critical |
| Unicode tags | `U+E0001`–`U+E007F` (hidden metadata) | Critical |
| C0/C1 controls | `U+0000`–`U+001F`, `U+0080`–`U+009F` | High |
| Variation selectors | `U+FE00`–`U+FE0F`, `U+E0100`–`U+E01EF` | Medium |
| Private Use Areas | `U+E000`–`U+F8FF`, `U+F0000`–`U+10FFFF` | Medium |
| Invisible whitespace | NBSP, en-space, ideographic space | Low |
| Noncharacters | `U+FFFE`, `U+FFFF`, etc. | High |

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=What%20It%20Does%20Not%20Detect&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="What It Does Not Detect" /></p>


This tool is scoped to **text and Unicode forensics**. It is not a universal steganography detector.

| Scenario | Why it is out of scope |
|----------|------------------------|
| **CSS-transparent text** | Letters hidden with `color: transparent` or similar styling are normal Unicode when pasted into a plain text file. Payload Revealer does not parse HTML or CSS. |
| **Image, PDF, or media steganography** | No parsers for LSB image stego, PDF object tricks, audio watermarks, or other binary media payloads. |

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=Build%20from%20Source&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="Build from Source" /></p>


Bundle the Python engine into a single `.exe` (no Python installation required):

```bash
pip install pyinstaller
pyinstaller payload_revealer_engine.spec
```

The output goes to `dist/payload_revealer_engine.exe`. Electron auto-detects it and uses it instead of `python -m`.

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=Architecture&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="Architecture" /></p>


```
payload_revealer/
├── payload_revealer/       # Python engine
│   ├── engine/
│   │   ├── sweeper.py      # Core character scanner
│   │   ├── classifier.py   # Unicode category tagging
│   │   ├── payload_extractor.py  # Hidden message reconstruction
│   │   ├── word_counter.py  # Visible vs actual word count
│   │   ├── export_engine.py # JSON/TXT report export
│   │   └── ipc_bridge.py   # JSON-RPC for Electron
│   └── cli/
│       └── reveal.py       # CLI headless mode
├── electron/               # Desktop shell
│   ├── main.js             # Electron main process
│   ├── preload.js          # Secure IPC bridge
│   └── renderer/           # UI
│       ├── index.html
│       ├── style.css
│       └── renderer.js
└── package.json
```

<p align="center"><img src="docs/readme-divider.svg" width="720" alt="" /></p>
<p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:070b14,100:12102a&height=50&section=header&text=License&fontSize=22&fontColor=e6edf3&animation=twinkling" width="720" alt="License" /></p>


MIT