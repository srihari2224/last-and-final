const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File management
  printFiles: (files) => ipcRenderer.invoke('print-files', files),
  openLocalFile: (filePath) => ipcRenderer.invoke('open-local-file', filePath),
  openPdfPrintDialog: (filePath) => ipcRenderer.invoke('open-pdf-print-dialog', filePath),
  getLocalFiles: (sessionId) => ipcRenderer.invoke('get-local-files', sessionId),
  getSessionFiles: (sessionId) => ipcRenderer.invoke('get-session-files', sessionId), // NEW: Added this line
  downloadS3Files: (sessionId, s3Files) => ipcRenderer.invoke('download-s3-files', sessionId, s3Files),
  
  // PDF processing
  getPdfPageCount: (filePath) => ipcRenderer.invoke('get-pdf-page-count', filePath),
  openPdfViewer: (filePath) => ipcRenderer.invoke('open-pdf-viewer', filePath),
  
  // Print queue management
  addToPrintQueue: (printJob) => ipcRenderer.invoke('add-to-print-queue', printJob),
  getPrintQueue: () => ipcRenderer.invoke('get-print-queue'),
  removeFromPrintQueue: (jobId) => ipcRenderer.invoke('remove-from-print-queue', jobId),
  clearPrintQueue: () => ipcRenderer.invoke('clear-print-queue'),
  executePrintJob: (jobId) => ipcRenderer.invoke('execute-print-job', jobId),
  getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
  
  // Admin panel
  verifyAdminPasskey: (passkey) => ipcRenderer.invoke('verify-admin-passkey', passkey),
  getAdminPrices: () => ipcRenderer.invoke('get-admin-prices'),
  saveAdminPrices: (prices) => ipcRenderer.invoke('save-admin-prices', prices),
  
  // Payment and printing
  processPaymentAndPrint: (paymentData) => ipcRenderer.invoke('process-payment-and-print', paymentData),
  sendSmsInvoice: (invoiceData) => ipcRenderer.invoke('send-sms-invoice', invoiceData), // NEW: Added this line
  
  // System info
  getVersion: () => process.versions.electron,
  platform: () => process.platform
});
