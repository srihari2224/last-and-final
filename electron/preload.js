const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File management
  openLocalFile: (filePath) => ipcRenderer.invoke('open-local-file', filePath),
  getSessionFiles: (sessionId) => ipcRenderer.invoke('get-session-files', sessionId),
  downloadS3Files: (sessionId, s3Files) => ipcRenderer.invoke('download-s3-files', sessionId, s3Files),
  
  // File data access
  getFileAsBase64: (filePath) => ipcRenderer.invoke('get-file-as-base64', filePath),
  getPdfAsBuffer: (filePath) => ipcRenderer.invoke('get-pdf-as-buffer', filePath),
  
  // Payment and SMS
  sendSmsInvoice: (invoiceData) => ipcRenderer.invoke('send-sms-invoice', invoiceData),
  
  // ENHANCED PRINTING APIS
  getEnhancedPrinterInfo: () => ipcRenderer.invoke('get-enhanced-printer-info'),
  testPrinterConnectivity: (printerName) => ipcRenderer.invoke('test-printer-connectivity', printerName),
  advancedPdfPrint: (printOptions) => ipcRenderer.invoke('advanced-pdf-print', printOptions),
  advancedCanvasPrint: (canvasData) => ipcRenderer.invoke('advanced-canvas-print', canvasData),
  
  // LEGACY COMPATIBILITY APIS
  getAvailablePrinters: () => ipcRenderer.invoke('get-available-printers'),
  getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
  printCanvas: (canvasData) => ipcRenderer.invoke('print-canvas', canvasData),
  printPdf: (printOptions) => ipcRenderer.invoke('print-pdf', printOptions),
  
  // System info
  getVersion: () => process.versions.electron,
  platform: () => process.platform
});
