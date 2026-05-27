const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let pythonProcess = null;
let pendingRequests = new Map();
let requestId = 0;

function getPythonCommand() {
  // Try to find Python - check common locations
  const candidates = [
    "python",
    "python3",
    "py",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "python.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python313", "python.exe"),
  ];

  for (const cmd of candidates) {
    try {
      const result = require("child_process").spawnSync(cmd, ["--version"], { timeout: 3000 });
      if (result.status === 0) return cmd;
    } catch (_) {
      continue;
    }
  }
  return "python";
}

function startPythonBridge() {
  const pythonCmd = getPythonCommand();
  const bridgePath = path.join(__dirname, "..", "payload_revealer", "engine", "ipc_bridge.py");

  // Run as module
  const moduleDir = path.join(__dirname, "..");
  pythonProcess = spawn(pythonCmd, ["-m", "payload_revealer.engine.ipc_bridge"], {
    cwd: moduleDir,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";

  pythonProcess.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        const { id, result, error } = response;
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error.message || "Python bridge error"));
          } else {
            pending.resolve(result);
          }
        }
      } catch (_) {
        // Non-JSON output (e.g., debug prints) - ignore or log
      }
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("[Python stderr]", data.toString());
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python bridge exited with code ${code}`);
    pythonProcess = null;
  });
}

function sendToPython(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || pythonProcess.killed) {
      reject(new Error("Python bridge is not running"));
      return;
    }

    const id = ++requestId;
    const request = JSON.stringify({ jsonrpc: "2.0", method, id, params });

    pendingRequests.set(id, { resolve, reject });

    try {
      pythonProcess.stdin.write(request + "\n");
    } catch (err) {
      pendingRequests.delete(id);
      reject(err);
    }

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Request timed out"));
      }
    }, 30000);
  });
}

// Wait for Python to be ready
function waitForPython() {
  return sendToPython("version")
    .then((result) => {
      console.log("[Payload Revealer] Python bridge v" + result.version + " ready");
    })
    .catch((err) => {
      console.error("[Payload Revealer] Failed to start Python bridge:", err.message);
      throw err;
    });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Payload Revealer",
    icon: path.join(__dirname, "assets", "icon.svg"),
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle("scan-file", async (_event, filePath) => {
  try {
    return await sendToPython("scan_file", { file_path: filePath });
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("export-report", async (_event, filePath, format) => {
  try {
    return await sendToPython("export_report", { file_path: filePath, format });
  } catch (err) {
    throw err;
  }
});

ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select file to scan",
    properties: ["openFile"],
    filters: [
      { name: "All Files", extensions: ["*"] },
      { name: "Text Files", extensions: ["txt", "csv", "log", "json", "xml", "html", "md"] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("save-file", async (_event, content, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save report",
    defaultPath: defaultName,
    filters: [
      { name: "JSON Report", extensions: ["json"] },
      { name: "Text Report", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (!result.canceled && result.filePath) {
    const fs = require("fs");
    fs.writeFileSync(result.filePath, content, "utf-8");
    return result.filePath;
  }
  return null;
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    startPythonBridge();
    await waitForPython();
  } catch (_) {
    // Python bridge failed - Electron will show error state in renderer
    console.error("Python bridge unavailable - running with limited functionality");
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
