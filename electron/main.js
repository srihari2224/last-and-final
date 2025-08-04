const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const printer = require('node-printer');

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false
  });

  // Load your web app - use local development server for PDF functionality
  mainWindow.loadURL('http://localhost:5173').catch(err => {
    console.error('Failed to load local React app:', err);
    console.log('Falling back to deployed version...');
    mainWindow.loadURL('https://last-and-final.vercel.app');
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info);
  });

  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('Download progress:', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
    autoUpdater.quitAndInstall();
  });

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();
}

// Create window when app is ready
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file printing (for future use)
ipcMain.handle('print-files', async (event, files) => {
  console.log('Printing files:', files);
  return { success: true };
});

// Handle opening local files
ipcMain.handle('open-local-file', async (event, filePath) => {
  try {
    console.log('Opening local file:', filePath);
    
    // Decode URL-encoded characters in the file path
    const decodedPath = decodeURIComponent(filePath);
    console.log('Decoded path:', decodedPath);
    
    // Check if file exists
    if (!fs.existsSync(decodedPath)) {
      console.error('File not found at path:', decodedPath);
      throw new Error(`File does not exist: ${path.basename(decodedPath)}`);
    }
    
    // Open file with default system application
    await shell.openPath(decodedPath);
    
    return { success: true, message: 'File opened successfully' };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, error: error.message };
  }
});

// Print queue storage
let printQueue = [];

// Handle opening PDF print dialog - DIRECT TO OS PRINT QUEUE
ipcMain.handle('open-pdf-print-dialog', async (event, filePath) => {
  try {
    console.log('🎯 PDF Print Dialog Requested');
    console.log('📁 Original file path:', filePath);
    
    // Decode URL-encoded characters in the file path
    const decodedPath = decodeURIComponent(filePath);
    console.log('🔓 Decoded path:', decodedPath);
    
    // Check if file exists
    if (!fs.existsSync(decodedPath)) {
      console.error('❌ File not found at path:', decodedPath);
      throw new Error(`File does not exist: ${path.basename(decodedPath)}`);
    }
    console.log('✅ File exists at path');
    
    // Check if it's a PDF file
    const fileExtension = path.extname(decodedPath).toLowerCase();
    console.log('📄 File extension:', fileExtension);
    if (fileExtension !== '.pdf') {
      throw new Error('File is not a PDF');
    }
    console.log('✅ File is a PDF');
    
    // Create a hidden window to load the PDF
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    });
    
    // Load the PDF file
    await printWindow.loadFile(decodedPath);
    
    // Wait for PDF to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get default printer
    const printers = printWindow.webContents.getPrinters();
    const defaultPrinter = printers.find(p => p.isDefault) || printers[0];
    console.log('🖨️ Using printer:', defaultPrinter?.name || 'Default');
    
    // Print options - DIRECT TO OS PRINT QUEUE
    const printOptions = {
      silent: false, // SHOW NATIVE DIALOG
      printBackground: true,
      color: true,
      margin: {
        marginType: 'printableArea'
      },
      landscape: false,
      pagesPerSheet: 1,
      collate: false,
      copies: 1,
      header: '',
      footer: '',
      deviceName: defaultPrinter?.name
    };
    
    console.log('🖨️ Sending PDF directly to OS print queue...');
    
    // Print the document - THIS WILL SHOW NATIVE DIALOG AND SEND TO OS PRINT QUEUE
    printWindow.webContents.print(printOptions, (success, reason) => {
      if (success) {
        console.log('✅ PDF sent to OS print queue successfully');
      } else {
        console.error('❌ Print failed:', reason);
      }
    });
    
    // Close the window after printing
    setTimeout(() => {
      if (!printWindow.isDestroyed()) {
        printWindow.close();
      }
    }, 10000);
    
    return { success: true, message: 'PDF sent to OS print queue' };
  } catch (error) {
    console.error('❌ Error opening PDF:', error);
    return { success: false, error: error.message };
  }
});

// Handle adding to print queue
ipcMain.handle('add-to-print-queue', async (event, printJob) => {
  try {
    console.log('📋 Adding to print queue:', printJob);
    console.log('📋 Current queue length before:', printQueue.length);
    
    // Validate print job
    if (!printJob.id || !printJob.fileName || !printJob.filePath) {
      throw new Error('Invalid print job: missing required fields');
    }
    
    // Check if file exists
    if (!fs.existsSync(printJob.filePath)) {
      throw new Error(`File not found: ${printJob.filePath}`);
    }
    
    printQueue.push(printJob);
    console.log('✅ Print job added to queue');
    console.log('📋 Current queue length after:', printQueue.length);
    console.log('📋 Queue contents:', printQueue);
    
    return { success: true, message: 'Print job added to queue', queueLength: printQueue.length };
  } catch (error) {
    console.error('❌ Error adding to print queue:', error);
    return { success: false, error: error.message };
  }
});

// Handle getting print queue
ipcMain.handle('get-print-queue', async (event) => {
  try {
    console.log('📋 Getting print queue');
    return { success: true, jobs: printQueue };
  } catch (error) {
    console.error('❌ Error getting print queue:', error);
    return { success: false, error: error.message };
  }
});

// Handle removing from print queue
ipcMain.handle('remove-from-print-queue', async (event, jobId) => {
  try {
    console.log('🗑️ Removing from print queue:', jobId);
    printQueue = printQueue.filter(job => job.id !== jobId);
    console.log('✅ Print job removed from queue');
    return { success: true, message: 'Print job removed from queue' };
  } catch (error) {
    console.error('❌ Error removing from print queue:', error);
    return { success: false, error: error.message };
  }
});

// Handle clearing print queue
ipcMain.handle('clear-print-queue', async (event) => {
  try {
    console.log('🗑️ Clearing print queue');
    printQueue = [];
    console.log('✅ Print queue cleared');
    return { success: true, message: 'Print queue cleared' };
  } catch (error) {
    console.error('❌ Error clearing print queue:', error);
    return { success: false, error: error.message };
  }
});

// Handle getting PDF page count
ipcMain.handle('get-pdf-page-count', async (event, filePath) => {
  try {
    console.log('📄 Getting PDF page count for:', filePath);
    
    // Create a hidden window to load the PDF
    const tempWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    });
    
    // Load the PDF file
    await tempWindow.loadFile(filePath);
    
    // Wait for PDF to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get page count using JavaScript injection
    const pageCount = await tempWindow.webContents.executeJavaScript(`
      // Try to get page count from PDF.js if available
      if (typeof PDFViewerApplication !== 'undefined') {
        return PDFViewerApplication.pagesCount || 0;
      }
      return 0;
    `);
    
    // Close the temporary window
    tempWindow.close();
    
    console.log('📄 PDF page count:', pageCount);
    return { success: true, pageCount: pageCount || 0 };
  } catch (error) {
    console.error('❌ Error getting PDF page count:', error);
    return { success: false, error: error.message };
  }
});

// Handle getting default printer
ipcMain.handle('get-default-printer', async (event) => {
  try {
    const printers = require('electron').webContents.getAllWebContents()[0]?.getPrinters() || [];
    const defaultPrinter = printers.find(p => p.isDefault) || printers[0];
    console.log('🖨️ Default printer:', defaultPrinter);
    return { success: true, printer: defaultPrinter };
  } catch (error) {
    console.error('❌ Error getting default printer:', error);
    return { success: false, error: error.message };
  }
});

// Handle executing print job - SILENT PRINTING TO OS QUEUE
ipcMain.handle('execute-print-job', async (event, jobId) => {
  try {
    console.log('🖨️ Executing print job:', jobId);
    
    const job = printQueue.find(j => j.id === jobId);
    if (!job) {
      throw new Error('Print job not found');
    }
    
    // Update job status
    job.status = 'printing';
    
    // Use silent printing with node-printer
    await silentPrintPDF(job.filePath, job.printOptions);
    
    job.status = 'completed';
    console.log('✅ Print job sent to OS print queue silently');
    
    return { success: true, message: 'Print job sent to OS print queue silently' };
  } catch (error) {
    console.error('❌ Error executing print job:', error);
    return { success: false, error: error.message };
  }
});

// Handle opening PDF viewer window
ipcMain.handle('open-pdf-viewer', async (event, filePath) => {
  try {
    console.log('📄 Opening PDF viewer for:', filePath);
    
    const viewerWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: 'PDF Viewer - Silent Printing'
    });
    
    const viewerUrl = `file://${__dirname}/viewer.html?file=${encodeURIComponent(filePath)}`;
    await viewerWindow.loadURL(viewerUrl);
    
    console.log('✅ PDF viewer window opened');
    return { success: true };
  } catch (error) {
    console.error('❌ Error opening PDF viewer:', error);
    return { success: false, error: error.message };
  }
});

// Handle silent PDF printing
ipcMain.on('print-pdf-silent', async (event, data) => {
  try {
    const { path: filePath, options } = data;
    console.log('🖨️ Silent print request:', { filePath, options });
    
    await silentPrintPDF(filePath, options);
    
    console.log('✅ PDF sent to OS print queue silently');
  } catch (error) {
    console.error('❌ Error in silent printing:', error);
  }
});

// Silent PDF printing function
async function silentPrintPDF(filePath, options) {
  try {
    const { copies = 1, range = 'all', duplex = false, color = true } = options;
    
    console.log('🖨️ Processing PDF for silent printing...');
    
    // Read original PDF
    const originalBytes = fs.readFileSync(filePath);
    let pdfDoc = await PDFDocument.load(originalBytes);
    
    // Handle page range
    if (range !== 'all' && range.trim()) {
      const finalPdf = await PDFDocument.create();
      const ranges = range.split(",").map(r => r.trim());
      
      for (let r of ranges) {
        if (r.includes("-")) {
          const [start, end] = r.split("-").map(Number);
          const pages = await finalPdf.copyPages(pdfDoc, 
            Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i)
          );
          pages.forEach(p => finalPdf.addPage(p));
        } else {
          const pageNum = parseInt(r) - 1;
          const [page] = await finalPdf.copyPages(pdfDoc, [pageNum]);
          finalPdf.addPage(page);
        }
      }
      pdfDoc = finalPdf;
    }
    
    // Save processed PDF to temp file
    const outputPdf = await pdfDoc.save();
    const tempPath = path.join(app.getPath("temp"), `print_temp_${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, outputPdf);
    
    console.log('🖨️ Processed PDF saved to:', tempPath);
    
    // Get default printer
    const defaultPrinter = printer.getDefaultPrinterName();
    console.log('🖨️ Using printer:', defaultPrinter);
    
    // Print silently for each copy
    for (let i = 0; i < copies; i++) {
      printer.printFile({
        filename: tempPath,
        printer: defaultPrinter,
        options: {
          'color': color ? 'Color' : 'Monochrome',
          'sides': duplex ? 'two-sided-long-edge' : 'one-sided',
        },
        success: jobID => {
          console.log(`✅ Printed copy ${i + 1}, job ID:`, jobID);
        },
        error: err => {
          console.error(`❌ Print error for copy ${i + 1}:`, err);
        },
      });
    }
    
    // Clean up temp file after a delay
    setTimeout(() => {
      try {
        fs.unlinkSync(tempPath);
        console.log('🗑️ Temp file cleaned up');
      } catch (err) {
        console.log('Could not clean up temp file:', err.message);
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error in silentPrintPDF:', error);
    throw error;
  }
}

// Handle getting local files for a session
ipcMain.handle('get-local-files', async (event, sessionId) => {
  try {
    // Use the correct path for local files - Windows path
    const baseDir = path.join('C:', 'Users', 'msrih', 'Downloads', 'eastIT', 'files');
    const sessionDir = path.join(baseDir, sessionId);
    
    console.log(`🔍 Looking for files in: ${sessionDir}`);
    
    if (!fs.existsSync(sessionDir)) {
      console.log(`📁 Session directory does not exist: ${sessionDir}`);
      return { files: [], count: 0, sessionDir };
    }
    
    const files = fs.readdirSync(sessionDir)
      .filter(file => {
        const filePath = path.join(sessionDir, file);
        return fs.statSync(filePath).isFile();
      })
      .map(file => {
        const filePath = path.join(sessionDir, file);
        const stats = fs.statSync(filePath);
        
        // Decode the filename to handle URL-encoded characters
        const decodedName = decodeURIComponent(file);
        
        return {
          name: decodedName,
          localPath: filePath,
          size: stats.size,
          uploadTime: stats.mtime,
          modifiedTime: stats.mtime,
          createdTime: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    
    console.log(`✅ Found ${files.length} local files for session ${sessionId}`);
    return { files, count: files.length, sessionDir };
  } catch (error) {
    console.error('Error getting local files:', error);
    return { files: [], count: 0, error: error.message };
  }
});

// Handle downloading files from S3 to local storage
ipcMain.handle('download-s3-files', async (event, sessionId, s3Files) => {
  try {
    console.log(`📥 Downloading ${s3Files.length} files for session ${sessionId}`);
    
    // Create local directory
    const baseDir = path.join('C:', 'Users', 'msrih', 'Downloads', 'eastIT', 'files');
    const sessionDir = path.join(baseDir, sessionId);
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(`✅ Created base directory: ${baseDir}`);
    }
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      console.log(`✅ Created session directory: ${sessionDir}`);
    }
    
    const downloadedFiles = [];
    const errors = [];
    
          for (const s3File of s3Files) {
        try {
          const { key, name } = s3File;
          
          // Decode the filename to handle URL-encoded characters
          const decodedName = decodeURIComponent(name);
          console.log(`📥 Downloading: ${decodedName} (original: ${name})`);
          
          // Download file from backend
          const response = await fetch(`https://upload-backend-api.vercel.app/api/download-file?key=${encodeURIComponent(key)}`);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Get file buffer
          const buffer = await response.arrayBuffer();
          
          // Save to local file with decoded name
          const localFilePath = path.join(sessionDir, decodedName);
          fs.writeFileSync(localFilePath, Buffer.from(buffer));
          
          // Get file stats
          const stats = fs.statSync(localFilePath);
          
          downloadedFiles.push({
            name: decodedName,
            localPath: localFilePath,
            size: stats.size,
            downloadTime: new Date().toISOString()
          });
          
          console.log(`✅ Downloaded: ${decodedName} to ${localFilePath}`);
          
        } catch (error) {
          console.error(`❌ Error downloading ${s3File.name}:`, error);
          errors.push({
            name: s3File.name,
            error: error.message
          });
        }
      }
    
    console.log(`✅ Completed downloading ${downloadedFiles.length} files for session ${sessionId}`);
    
    return {
      success: true,
      downloadedFiles,
      errors,
      sessionDir
    };
    
  } catch (error) {
    console.error('Error in download-s3-files:', error);
    return {
      success: false,
      error: error.message
    };
  }
});


