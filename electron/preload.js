const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("payloadRevealer", {
  scanFile: (filePath) => ipcRenderer.invoke("scan-file", filePath),
  exportReport: (filePath, format) => ipcRenderer.invoke("export-report", filePath, format),
  selectFile: () => ipcRenderer.invoke("select-file"),
  saveFile: (content, defaultName) => ipcRenderer.invoke("save-file", content, defaultName),
  onDrop: (callback) => {
    document.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        callback(files[0].path);
      }
    });
  },
});
