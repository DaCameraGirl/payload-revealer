/* ====================== Payload Revealer - Renderer Logic ====================== */

const DOM = {
  dropZone: document.getElementById("dropZone"),
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
  tabRaw: document.getElementById("tabRaw"),
  findingsBody: document.getElementById("findingsBody"),
  findingsTable: document.getElementById("findingsTable"),
  noFindings: document.getElementById("noFindings"),
  payloadContainer: document.getElementById("payloadContainer"),
  noPayloads: document.getElementById("noPayloads"),
  rawOutput: document.getElementById("rawOutput"),
  exportBar: document.getElementById("exportBar"),
  errorToast: document.getElementById("errorToast"),
  dropIcon: document.querySelector(".drop-icon"),
};

let scanResult = null;
let currentFilePath = null;

/* ===== File Selection ===== */
document.getElementById("btnSelectFile").addEventListener("click", async () => {
  const filePath = await window.payloadRevealer.selectFile();
  if (filePath) {
    scanFile(filePath);
  }
});

/* ===== Drop Zone ===== */
DOM.dropZone.addEventListener("click", async () => {
  const filePath = await window.payloadRevealer.selectFile();
  if (filePath) {
    scanFile(filePath);
  }
});

window.payloadRevealer.onDrop((filePath) => {
  scanFile(filePath);
});

/* ===== Tab Switching ===== */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    DOM.tabFindings.classList.toggle("hidden", target !== "findings");
    DOM.tabPayloads.classList.toggle("hidden", target !== "payloads");
    DOM.tabRaw.classList.toggle("hidden", target !== "raw");
  });
});

/* ===== Export Buttons ===== */
document.getElementById("btnExportJson").addEventListener("click", async () => {
  if (!currentFilePath) return;
  try {
    showSpinner(true);
    const result = await window.payloadRevealer.exportReport(currentFilePath, "json");
    const savePath = await window.payloadRevealer.saveFile(result.content, "payload-revealer-report.json");
    showSpinner(false);
    if (savePath) {
      showToast("Report exported: " + savePath, "success");
    }
  } catch (err) {
    showSpinner(false);
    showToast("Export failed: " + err.message, "error");
  }
});

document.getElementById("btnExportTxt").addEventListener("click", async () => {
  if (!currentFilePath) return;
  try {
    showSpinner(true);
    const result = await window.payloadRevealer.exportReport(currentFilePath, "txt");
    const savePath = await window.payloadRevealer.saveFile(result.content, "payload-revealer-report.txt");
    showSpinner(false);
    if (savePath) {
      showToast("Report exported: " + savePath, "success");
    }
  } catch (err) {
    showSpinner(false);
    showToast("Export failed: " + err.message, "error");
  }
});

/* ===== Scan File ===== */
async function scanFile(filePath) {
  currentFilePath = filePath;

  // Show scanning state
  DOM.dropZone.classList.add("hidden");
  DOM.statusBar.classList.remove("hidden");
  DOM.statusFile.textContent = filePath;
  DOM.statsGrid.classList.add("hidden");
  DOM.riskSummary.classList.add("hidden");
  DOM.resultsPanel.classList.add("hidden");
  DOM.exportBar.classList.add("hidden");
  showSpinner(true);

  try {
    scanResult = await window.payloadRevealer.scanFile(filePath);
    renderResults(scanResult);
  } catch (err) {
    showToast("Scan failed: " + err.message + ". Is Python installed with the payload_revealer module?", "error");
    DOM.statusBar.classList.add("hidden");
    DOM.dropZone.classList.remove("hidden");
  } finally {
    showSpinner(false);
  }
}

/* ===== Render Results ===== */
function renderResults(data) {
  const stats = data.stats;
  const file = data.file;
  const findings = data.findings || [];
  const payloads = data.extracted_payloads || [];
  const riskCounts = stats.risk_counts || {};

  // Status bar badges
  DOM.badgeTotal.textContent = stats.total_chars + " chars total";
  DOM.statusFile.textContent = file.path;

  if (stats.hidden_chars > 0) {
    DOM.badgeHidden.classList.remove("hidden");
    DOM.badgeHidden.textContent = stats.hidden_chars + " hidden";
  } else {
    DOM.badgeHidden.classList.add("hidden");
  }

  if ((riskCounts.critical || 0) > 0) {
    DOM.badgeCritical.classList.remove("hidden");
    DOM.badgeCritical.textContent = riskCounts.critical + " critical";
  } else {
    DOM.badgeCritical.classList.add("hidden");
  }

  // Stats grid
  DOM.statsGrid.classList.remove("hidden");
  DOM.statTotalChars.textContent = stats.total_chars.toLocaleString();
  DOM.statVisibleChars.textContent = stats.visible_chars.toLocaleString();
  DOM.statHiddenChars.textContent = stats.hidden_chars.toLocaleString();
  DOM.statVisibleWords.textContent = stats.visible_word_count.toLocaleString();
  DOM.statActualWords.textContent = stats.actual_word_count.toLocaleString();
  DOM.statWordDelta.textContent = (stats.word_count_delta >= 0 ? "+" : "") + stats.word_count_delta.toLocaleString();

  // Highlight hidden chars stat card
  const hiddenCard = DOM.statHiddenChars.closest(".stat-card");
  if (stats.hidden_chars > 0) {
    hiddenCard.classList.add("stat-card-warn");
  } else {
    hiddenCard.classList.remove("stat-card-warn");
  }

  // Risk summary
  DOM.riskSummary.classList.remove("hidden");
  DOM.riskCritical.textContent = riskCounts.critical || 0;
  DOM.riskHigh.textContent = riskCounts.high || 0;
  DOM.riskMedium.textContent = riskCounts.medium || 0;
  DOM.riskLow.textContent = riskCounts.low || 0;

  // Findings table
  DOM.resultsPanel.classList.remove("hidden");
  DOM.findingsBody.innerHTML = "";

  // Filter to non-visible or risky characters
  const suspicious = findings.filter((f) => !f.visible || f.risk !== "none");

  if (suspicious.length === 0) {
    DOM.noFindings.classList.remove("hidden");
    DOM.findingsTable.classList.add("hidden");
  } else {
    DOM.noFindings.classList.add("hidden");
    DOM.findingsTable.classList.remove("hidden");

    for (const f of suspicious) {
      const row = document.createElement("tr");
      row.className = "risk-" + f.risk;
      row.innerHTML = `
        <td>${f.index}</td>
        <td><code>${f.codepoint}</code></td>
        <td>${escapeHtml(f.name)}</td>
        <td><code>${f.category}</code></td>
        <td>${f.block}</td>
        <td><span class="risk-chip ${f.risk}">${f.risk.toUpperCase()}</span></td>
        <td>${f.tags.map((t) => '<code>' + escapeHtml(t) + '</code>').join(" ")}</td>
      `;
      DOM.findingsBody.appendChild(row);
    }
  }

  // Payloads
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

  // Raw output (JSON preview)
  DOM.rawOutput.textContent = JSON.stringify({ file, stats, findings, extracted_payloads: payloads }, null, 2);

  // Reset to first tab
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelector('.tab[data-tab="findings"]').classList.add("active");
  DOM.tabFindings.classList.remove("hidden");
  DOM.tabPayloads.classList.add("hidden");
  DOM.tabRaw.classList.add("hidden");

  // Show export bar
  DOM.exportBar.classList.remove("hidden");

  // Update status file with encoding info
  DOM.statusFile.textContent = file.path + "  |  " + file.encoding + (file.has_bom ? " (BOM)" : "");
}

/* ===== Helpers ===== */
function showSpinner(show) {
  if (show) {
    DOM.statusSpinner.classList.remove("hidden");
  } else {
    DOM.statusSpinner.classList.add("hidden");
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type) {
  const toast = DOM.errorToast;
  toast.classList.remove("hidden", "toast-error");
  toast.classList.add("toast-" + type);
  toast.textContent = message;
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}
