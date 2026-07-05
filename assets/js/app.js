/* ====================== Payload Revealer - Browser App Wiring ======================
   Drives the live in-page scanner using PayloadRevealerEngine (scan-engine.js).
   Adapted from electron/renderer/renderer.js: same results UI, but fed by text
   pasted or dropped directly in the browser instead of Electron IPC to Python.
*/
(function () {
  "use strict";

  const Engine = window.PayloadRevealerEngine;
  const HiddenFormatScanner = window.HiddenFormatScanner;

  const DOM = {
    pasteTab: document.getElementById("scPasteTab"),
    fileTab: document.getElementById("scFileTab"),
    richTab: document.getElementById("scRichTab"),
    pastePanel: document.getElementById("scPastePanel"),
    filePanel: document.getElementById("scFilePanel"),
    richPanel: document.getElementById("scRichPanel"),
    textarea: document.getElementById("scTextarea"),
    btnScanText: document.getElementById("scBtnScanText"),
    fileInput: document.getElementById("scFileInput"),
    dropZone: document.getElementById("dropZone"),
    richInput: document.getElementById("scRichInput"),
    btnClearRich: document.getElementById("scBtnClearRich"),
    statusBar: document.getElementById("statusBar"),
    statusFile: document.querySelector(".status-file"),
    statusSpinner: document.querySelector(".status-spinner"),
    badgeTotal: document.getElementById("badgeTotal"),
    badgeHidden: document.getElementById("badgeHidden"),
    badgeCritical: document.getElementById("badgeCritical"),
    statsGrid: document.getElementById("statsGrid"),
    statTotalChars: document.getElementById("statTotalChars"),
    statVisibleChars: document.getElementById("statVisibleChars"),
    statHiddenChars: document.getElementById("statHiddenChars"),
    statVisibleWords: document.getElementById("statVisibleWords"),
    statActualWords: document.getElementById("statActualWords"),
    statWordDelta: document.getElementById("statWordDelta"),
    riskSummary: document.getElementById("riskSummary"),
    riskCritical: document.getElementById("riskCritical"),
    riskHigh: document.getElementById("riskHigh"),
    riskMedium: document.getElementById("riskMedium"),
    riskLow: document.getElementById("riskLow"),
    resultsPanel: document.getElementById("resultsPanel"),
    tabFindings: document.getElementById("tabFindings"),
    tabPayloads: document.getElementById("tabPayloads"),
    tabHiddenFormat: document.getElementById("tabHiddenFormat"),
    tabHiddenFormatBtn: document.getElementById("tabHiddenFormatBtn"),
    tabRaw: document.getElementById("tabRaw"),
    findingsBody: document.getElementById("findingsBody"),
    findingsTable: document.getElementById("findingsTable"),
    noFindings: document.getElementById("noFindings"),
    payloadContainer: document.getElementById("payloadContainer"),
    noPayloads: document.getElementById("noPayloads"),
    hiddenFormatContainer: document.getElementById("hiddenFormatContainer"),
    noHiddenFormat: document.getElementById("noHiddenFormat"),
    rawOutput: document.getElementById("rawOutput"),
    exportBar: document.getElementById("exportBar"),
    errorToast: document.getElementById("errorToast"),
  };

  let lastReport = null;

  /* ===== Input mode tabs (paste text vs. file vs. rich text) ===== */
  DOM.pasteTab.addEventListener("click", () => setInputMode("paste"));
  DOM.fileTab.addEventListener("click", () => setInputMode("file"));
  DOM.richTab.addEventListener("click", () => setInputMode("rich"));

  function setInputMode(mode) {
    DOM.pasteTab.classList.toggle("active", mode === "paste");
    DOM.fileTab.classList.toggle("active", mode === "file");
    DOM.richTab.classList.toggle("active", mode === "rich");
    DOM.pastePanel.classList.toggle("hidden", mode !== "paste");
    DOM.filePanel.classList.toggle("hidden", mode !== "file");
    DOM.richPanel.classList.toggle("hidden", mode !== "rich");
  }

  /* ===== Paste rich text (catches CSS-hidden formatting) ===== */
  DOM.richInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");

    if (html) {
      DOM.richInput.innerHTML = html;
    } else {
      DOM.richInput.textContent = plain;
    }

    runScan(() => {
      const hf = html
        ? HiddenFormatScanner.scanHtml(html)
        : { findings: [], visibleText: plain, hiddenText: "" };
      const report = Engine.scanPastedText(hf.visibleText, "(pasted rich text)");
      report.hidden_format_findings = hf.findings;
      return report;
    });
  });

  DOM.btnClearRich.addEventListener("click", () => {
    DOM.richInput.innerHTML = "";
    DOM.statusBar.classList.add("hidden");
    DOM.statsGrid.classList.add("hidden");
    DOM.riskSummary.classList.add("hidden");
    DOM.resultsPanel.classList.add("hidden");
    DOM.exportBar.classList.add("hidden");
  });

  /* ===== Paste + Scan ===== */
  DOM.btnScanText.addEventListener("click", () => {
    const text = DOM.textarea.value;
    if (!text) {
      showToast("Paste some text first.", "error");
      return;
    }
    runScan(() => Engine.scanPastedText(text, "(pasted text)"));
  });

  /* ===== File picker + drop zone ===== */
  DOM.dropZone.addEventListener("click", () => DOM.fileInput.click());
  DOM.fileInput.addEventListener("change", () => {
    const file = DOM.fileInput.files[0];
    if (file) scanFile(file);
  });

  ["dragover", "dragenter"].forEach((evt) =>
    DOM.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      DOM.dropZone.classList.add("drag-over");
    })
  );
  ["dragleave", "dragend"].forEach((evt) =>
    DOM.dropZone.addEventListener(evt, () => DOM.dropZone.classList.remove("drag-over"))
  );
  DOM.dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    DOM.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) scanFile(file);
  });

  function scanFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      runScan(() => Engine.scanFileBytes(bytes, file.name));
    };
    reader.onerror = () => showToast("Could not read that file.", "error");
    reader.readAsArrayBuffer(file);
  }

  /* ===== Run a scan and render ===== */
  function runScan(getReport) {
    DOM.statusBar.classList.remove("hidden");
    showSpinner(true);
    // Defer one tick so the spinner actually paints before the (synchronous) scan runs.
    setTimeout(() => {
      try {
        lastReport = getReport();
        renderResults(lastReport);
      } catch (err) {
        showToast("Scan failed: " + err.message, "error");
      } finally {
        showSpinner(false);
      }
    }, 10);
  }

  /* ===== Tab switching (results: findings / payloads / raw) ===== */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      DOM.tabFindings.classList.toggle("hidden", target !== "findings");
      DOM.tabPayloads.classList.toggle("hidden", target !== "payloads");
      DOM.tabHiddenFormat.classList.toggle("hidden", target !== "hiddenFormat");
      DOM.tabRaw.classList.toggle("hidden", target !== "raw");
    });
  });

  /* ===== Export ===== */
  document.getElementById("btnExportJson").addEventListener("click", () => {
    if (!lastReport) return;
    downloadFile(
      JSON.stringify(lastReport, null, 2),
      "payload-revealer-report.json",
      "application/json"
    );
  });

  document.getElementById("btnExportTxt").addEventListener("click", () => {
    if (!lastReport) return;
    downloadFile(summaryText(lastReport), "payload-revealer-report.txt", "text/plain");
  });

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function summaryText(data) {
    const { file, stats } = data;
    const lines = [
      `File: ${file.path}`,
      `Size: ${file.size.toLocaleString()} bytes`,
      `Encoding: ${file.encoding}${file.has_bom ? " (BOM)" : ""}`,
      `Total characters: ${stats.total_chars.toLocaleString()}`,
      `  Visible: ${stats.visible_chars.toLocaleString()}`,
      `  Hidden:  ${stats.hidden_chars.toLocaleString()}`,
      `Naive word count: ${stats.visible_word_count.toLocaleString()}`,
      `Unicode-aware word count: ${stats.actual_word_count.toLocaleString()}`,
      "",
      "Category breakdown:",
    ];
    const cats = Object.entries(stats.category_counts).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of cats) lines.push(`  ${cat}: ${count.toLocaleString()}`);
    lines.push("", "Risk breakdown:");
    for (const risk of ["critical", "high", "medium", "low", "none"]) {
      const count = stats.risk_counts[risk];
      if (count) lines.push(`  ${risk}: ${count.toLocaleString()}`);
    }
    return lines.join("\n");
  }

  /* ===== Render Results ===== */
  function renderResults(data) {
    const stats = data.stats;
    const file = data.file;
    const findings = data.findings || [];
    const payloads = data.extracted_payloads || [];
    const hiddenFormatFindings = data.hidden_format_findings || [];
    const riskCounts = stats.risk_counts || {};
    const totalCritical = (riskCounts.critical || 0) + hiddenFormatFindings.length;

    DOM.badgeTotal.textContent = stats.total_chars + " chars total";
    DOM.statusFile.textContent = file.path;

    if (stats.hidden_chars > 0 || hiddenFormatFindings.length > 0) {
      DOM.badgeHidden.classList.remove("hidden");
      DOM.badgeHidden.textContent = stats.hidden_chars + hiddenFormatFindings.length + " hidden";
    } else {
      DOM.badgeHidden.classList.add("hidden");
    }

    if (totalCritical > 0) {
      DOM.badgeCritical.classList.remove("hidden");
      DOM.badgeCritical.textContent = totalCritical + " critical";
    } else {
      DOM.badgeCritical.classList.add("hidden");
    }

    DOM.statsGrid.classList.remove("hidden");
    DOM.statTotalChars.textContent = stats.total_chars.toLocaleString();
    DOM.statVisibleChars.textContent = stats.visible_chars.toLocaleString();
    DOM.statHiddenChars.textContent = stats.hidden_chars.toLocaleString();
    DOM.statVisibleWords.textContent = stats.visible_word_count.toLocaleString();
    DOM.statActualWords.textContent = stats.actual_word_count.toLocaleString();
    DOM.statWordDelta.textContent =
      (stats.word_count_delta >= 0 ? "+" : "") + stats.word_count_delta.toLocaleString();

    const hiddenCard = DOM.statHiddenChars.closest(".stat-card");
    hiddenCard.classList.toggle("stat-card-warn", stats.hidden_chars > 0);

    DOM.riskSummary.classList.remove("hidden");
    DOM.riskCritical.textContent = totalCritical;
    DOM.riskHigh.textContent = riskCounts.high || 0;
    DOM.riskMedium.textContent = riskCounts.medium || 0;
    DOM.riskLow.textContent = riskCounts.low || 0;

    DOM.resultsPanel.classList.remove("hidden");
    DOM.findingsBody.innerHTML = "";

    const suspicious = findings.filter((f) => !f.visible || f.risk !== "none");

    if (suspicious.length === 0) {
      DOM.noFindings.classList.remove("hidden");
      DOM.findingsTable.classList.add("hidden");
    } else {
      DOM.noFindings.classList.add("hidden");
      DOM.findingsTable.classList.remove("hidden");

      const frag = document.createDocumentFragment();
      for (const f of suspicious) {
        const row = document.createElement("tr");
        row.className = "risk-" + f.risk;
        row.innerHTML = `
          <td>${f.index}</td>
          <td><code>${f.codepoint}</code></td>
          <td>${escapeHtml(f.name)}</td>
          <td><code>${f.category}</code></td>
          <td>${escapeHtml(f.block)}</td>
          <td><span class="risk-chip ${f.risk}">${f.risk.toUpperCase()}</span></td>
          <td>${f.tags.map((t) => "<code>" + escapeHtml(t) + "</code>").join(" ")}</td>
        `;
        frag.appendChild(row);
      }
      DOM.findingsBody.appendChild(frag);
    }

    DOM.payloadContainer.innerHTML = "";
    if (payloads.length === 0) {
      DOM.noPayloads.classList.remove("hidden");
    } else {
      DOM.noPayloads.classList.add("hidden");
      for (const p of payloads) {
        const card = document.createElement("div");
        card.className = "payload-card";
        card.innerHTML = `
          <div class="payload-card-header">
            <span class="payload-card-type">${escapeHtml(p.type)}</span>
            <span class="payload-card-desc">${escapeHtml(p.description || "")}</span>
          </div>
          <div class="payload-card-body">${escapeHtml(p.decoded)}</div>
        `;
        DOM.payloadContainer.appendChild(card);
      }
    }

    DOM.hiddenFormatContainer.innerHTML = "";
    DOM.tabHiddenFormatBtn.classList.toggle("hidden", hiddenFormatFindings.length === 0 && !("hidden_format_findings" in data));
    if (hiddenFormatFindings.length === 0) {
      DOM.noHiddenFormat.classList.remove("hidden");
    } else {
      DOM.noHiddenFormat.classList.add("hidden");
      for (const f of hiddenFormatFindings) {
        const card = document.createElement("div");
        card.className = "hiddenformat-card";
        card.innerHTML = `
          <div class="hiddenformat-text">${escapeHtml(f.text)}</div>
          <div class="hiddenformat-reasons">${f.reasons.map((r) => "<code>" + escapeHtml(r) + "</code>").join(" ")}</div>
        `;
        DOM.hiddenFormatContainer.appendChild(card);
      }
    }

    DOM.rawOutput.textContent = JSON.stringify(
      { file, stats, findings, extracted_payloads: payloads, hidden_format_findings: hiddenFormatFindings },
      null,
      2
    );

    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    const defaultTab = hiddenFormatFindings.length > 0 ? "hiddenFormat" : "findings";
    document.querySelector(`.tab[data-tab="${defaultTab}"]`).classList.add("active");
    DOM.tabFindings.classList.toggle("hidden", defaultTab !== "findings");
    DOM.tabPayloads.classList.add("hidden");
    DOM.tabHiddenFormat.classList.toggle("hidden", defaultTab !== "hiddenFormat");
    DOM.tabRaw.classList.add("hidden");

    DOM.exportBar.classList.remove("hidden");

    DOM.statusFile.textContent = file.path + "  |  " + file.encoding + (file.has_bom ? " (BOM)" : "");
  }

  function showSpinner(show) {
    DOM.statusSpinner.classList.toggle("hidden", !show);
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type) {
    const toast = DOM.errorToast;
    toast.classList.remove("hidden", "toast-error", "toast-success");
    toast.classList.add("toast-" + type);
    toast.textContent = message;
    setTimeout(() => toast.classList.add("hidden"), 4000);
  }
})();
