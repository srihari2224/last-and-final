const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  // File management
  openLocalFile: (filePath) => ipcRenderer.invoke("open-local-file", filePath),
  getSessionFiles: (sessionId) => ipcRenderer.invoke("get-session-files", sessionId),
  downloadS3Files: (sessionId, s3Files) => ipcRenderer.invoke("download-s3-files", sessionId, s3Files),

  // File data access
  getFileAsBase64: (filePath) => ipcRenderer.invoke("get-file-as-base64", filePath),
  getPdfAsBuffer: (filePath) => ipcRenderer.invoke("get-pdf-as-buffer", filePath),
  fileExists: (filePath) => ipcRenderer.invoke("file-exists", filePath),

  // Payment and SMS
  sendSmsInvoice: (invoiceData) => ipcRenderer.invoke("send-sms-invoice", invoiceData),

  // Printer management
  getDefaultPrinter: () => ipcRenderer.invoke("get-default-printer"),
  getPrintQueue: (printerName) => ipcRenderer.invoke("get-print-queue", printerName),
  cancelPrintJob: (printerName, jobId) => ipcRenderer.invoke("cancel-print-job", printerName, jobId),
  restartSpooler: () => ipcRenderer.invoke("restart-spooler"),

  // CORE PRINTING - RESPECTS ALL USER OPTIONS
  printPdf: (printOptions) => ipcRenderer.invoke("print-pdf", printOptions),
  printCanvas: (canvasData) => ipcRenderer.invoke("print-canvas", canvasData),

  // System info
  getVersion: () => process.versions.electron,
  platform: () => process.platform,
})
