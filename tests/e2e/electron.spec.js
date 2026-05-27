const { _electron: electron } = require("playwright");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "forensic_report.txt");

async function run() {
  // Locate electron binary
  const electronBin = path.join(ROOT, "node_modules", ".bin", "electron");
  const electronPath = require("fs").existsSync(electronBin)
    ? electronBin
    : path.join(ROOT, "node_modules", "electron", "dist", "electron.exe");

  // Launch Electron app
  const app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(ROOT, "electron", "main.js")],
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "test" },
  });

  // Wait for first window
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  // Wait for drop zone to be visible (app is ready)
  await window.waitForSelector("#dropZone:not(.hidden)", { timeout: 15000 });
  console.log("[PASS] Drop zone rendered");

  // Wait for Python bridge to be ready (status bar may appear briefly during connect)
  // Give extra time for the bridge handshake
  await window.waitForTimeout(3000);

  // Execute scan through the renderer's scanFile() function
  // (function declaration in renderer.js is accessible as window.scanFile)
  await window.evaluate(async (fp) => {
    await window.scanFile(fp);
  }, FIXTURE);

  console.log("[INFO] Scan completed, awaiting render...");
  await window.waitForTimeout(2000);

  // ── Assertions: Status badges ──
  const badgeCriticalText = await window.textContent("#badgeCritical");
  assert(
    badgeCriticalText.includes(" critical"),
    `Expected badge to show "N critical", got: "${badgeCriticalText}"`
  );
  console.log(`[PASS] Critical badge shows "${badgeCriticalText.replace(/\s+/g," ").trim()}"`);

  const badgeCriticalVisible = await window.isVisible("#badgeCritical");
  assert(badgeCriticalVisible, "Critical badge should be visible");
  console.log("[PASS] Critical badge is visible");

  // ── Assertions: Stats grid ──
  const hiddenCharsText = await window.textContent("#statHiddenChars");
  assert.strictEqual(
    hiddenCharsText.trim(),
    "312",
    `Expected 312 hidden chars, got: "${hiddenCharsText}"`
  );
  console.log("[PASS] Hidden chars stat shows 312");

  // Verify results panel is visible (confirm render was triggered)
  const resultsVisible = await window.isVisible("#resultsPanel");
  assert(resultsVisible, "Results panel should be visible after scan");
  console.log("[PASS] Results panel is visible");

  // ── Assertions: Risk summary ──
  const totalCharsText = await window.textContent("#statTotalChars");
  const totalChars = parseInt(totalCharsText.replace(/,/g, "").trim(), 10);
  assert(totalChars > 0, `Total chars should be > 0, got: "${totalCharsText}"`);
  console.log(`[PASS] Total chars stat shows ${totalChars.toLocaleString()}`);

  const riskCriticalText = await window.textContent("#riskCritical");
  const riskCritical = parseInt(riskCriticalText.trim(), 10);
  assert(riskCritical > 0, `Risk critical count should be > 0, got: "${riskCriticalText}"`);
  console.log(`[PASS] Risk summary shows ${riskCritical} critical`);

  // ── Assertions: Findings table ──
  const findingsRows = await window.$$("#findingsBody tr");
  assert(
    findingsRows.length > 0,
    `Expected >0 findings rows, got ${findingsRows.length}`
  );
  console.log(`[PASS] Findings table has ${findingsRows.length} rows`);

  // ── Switch to payloads tab ──
  await window.click('.tab[data-tab="payloads"]');
  await window.waitForTimeout(500);

  const payloadCardText = await window.textContent(".payload-card-body");
  assert(
    payloadCardText.includes("beacon://c2-exfil.lan/reg?agent=demo-01"),
    `Payload card should contain the beacon URL, got: "${payloadCardText.trim()}"`
  );
  console.log("[PASS] Payload card shows decoded beacon URL");

  // ── Cleanup ──
  await app.close();
  console.log("\n--- All e2e assertions passed ---");
}

run().catch((err) => {
  console.error("[FAIL]", err.message);
  process.exit(1);
});
