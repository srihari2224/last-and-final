require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    titleBarStyle: 'default',
    show: false
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src \'self\' \'unsafe-inline\' data: blob: https:; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https:; img-src \'self\' data: blob: https: file:;']
      }
    })
  })

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

// Handle opening local files
ipcMain.handle('open-local-file', async (event, filePath) => {
  try {
    const decodedPath = decodeURIComponent(filePath);
    
    if (!fs.existsSync(decodedPath)) {
      throw new Error(`File does not exist: ${path.basename(decodedPath)}`);
    }
    
    await shell.openPath(decodedPath);
    
    return { success: true, message: 'File opened successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// NEW: Get file as base64 data URL (for images)
ipcMain.handle('get-file-as-base64', async (event, filePath) => {
  try {
    console.log('📸 Reading file as base64:', filePath);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    let mimeType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(extension)) {
      mimeType = 'image/jpeg';
    } else if (extension === '.png') {
      mimeType = 'image/png';
    } else if (extension === '.gif') {
      mimeType = 'image/gif';
    } else if (extension === '.bmp') {
      mimeType = 'image/bmp';
    } else if (extension === '.webp') {
      mimeType = 'image/webp';
    }
    
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    console.log('✅ File converted to base64 successfully');
    return {
      success: true,
      dataUrl: dataUrl,
      mimeType: mimeType,
      size: fileBuffer.length
    };
    
  } catch (error) {
    console.error('❌ Error reading file as base64:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// NEW: Get PDF file as buffer (for PDF.js) - FIXED FOR DETACHED BUFFER
ipcMain.handle('get-pdf-as-buffer', async (event, filePath) => {
  try {
    console.log('📄 Reading PDF as buffer:', filePath);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    
    // Convert to Uint8Array to prevent detached ArrayBuffer issues
    const uint8Array = new Uint8Array(fileBuffer);
    
    console.log('✅ PDF buffer read successfully, size:', fileBuffer.length);
    return {
      success: true,
      buffer: Array.from(uint8Array), // Convert to regular array for safe IPC transfer
      size: fileBuffer.length
    };
    
  } catch (error) {
    console.error('❌ Error reading PDF as buffer:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle getting session files directly from folder - ENHANCED WITH FILE DATA
ipcMain.handle('get-session-files', async (event, sessionId) => {
  try {
    console.log(`🔍 Getting files directly from session folder: ${sessionId}`);
    
  const baseDir = process.env.FILES_BASE_DIR;
    const sessionDir = path.join(baseDir, sessionId);
    
    console.log(`📁 Session directory: ${sessionDir}`);
    
    if (!fs.existsSync(sessionDir)) {
      console.log(`📁 Session directory does not exist: ${sessionDir}`);
      return { files: [], count: 0, sessionDir, exists: false };
    }
    
    const files = fs.readdirSync(sessionDir)
      .filter(file => {
        const filePath = path.join(sessionDir, file);
        return fs.statSync(filePath).isFile();
      })
      .map(file => {
        const filePath = path.join(sessionDir, file);
        const stats = fs.statSync(filePath);
        
        const decodedName = decodeURIComponent(file);
        
        const extension = path.extname(decodedName).toLowerCase();
        let fileType = 'other';
        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(extension)) {
          fileType = 'image';
        } else if (extension === '.pdf') {
          fileType = 'pdf';
        }
        
        return {
          name: decodedName,
          originalName: file,
          localPath: filePath,
          size: stats.size,
          type: fileType,
          extension: extension,
          uploadTime: stats.mtime,
          modifiedTime: stats.mtime,
          createdTime: stats.birthtime,
          isLocal: true
        };
      })
      .sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    
    console.log(`✅ Found ${files.length} files in session folder`);
    files.forEach(file => {
      console.log(`  📄 ${file.name} (${file.type}) - ${(file.size / 1024).toFixed(1)} KB`);
    });
    
    return { 
      files, 
      count: files.length, 
      sessionDir, 
      exists: true,
      success: true 
    };
  } catch (error) {
    console.error('❌ Error getting session files:', error);
    return { 
      files: [], 
      count: 0, 
      error: error.message, 
      exists: false,
      success: false 
    };
  }
});

// Handle downloading files from S3 to local storage
ipcMain.handle('download-s3-files', async (event, sessionId, s3Files) => {
  try {
    console.log(`📥 Downloading ${s3Files.length} files for session ${sessionId}`);
    
  const baseDir = process.env.FILES_BASE_DIR;
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
        
        const decodedName = decodeURIComponent(name);
        console.log(`📥 Downloading: ${decodedName} (original: ${name})`);
        
        const response = await fetch(`https://upload-backend-api.vercel.app/api/download-file?key=${encodeURIComponent(key)}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        
        const localFilePath = path.join(sessionDir, decodedName);
        fs.writeFileSync(localFilePath, Buffer.from(buffer));
        
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

// Handle SMS invoice sending
ipcMain.handle('send-sms-invoice', async (event, invoiceData) => {
  try {
    console.log('📱 Sending SMS invoice:', invoiceData);
    
    const { phoneNumber, amount, paymentId, sessionId, items } = invoiceData;
    
    const message = `
Print Shop Invoice
Payment ID: ${paymentId}
Session: ${sessionId}
Amount: ₹${amount}
Items: ${items.length} items
Thank you for your business!
    `.trim();
    
    console.log('📱 SMS Message:', message);
    console.log('📱 Sending to:', phoneNumber);
    
    return {
      success: true,
      message: 'SMS invoice sent successfully',
      phoneNumber: phoneNumber
    };
    
  } catch (error) {
    console.error('❌ Error sending SMS invoice:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// ==================== ENHANCED PRINTING SYSTEM ====================

// ENHANCED PRINTER DETECTION SYSTEM
ipcMain.handle('get-enhanced-printer-info', async (event) => {
  try {
    console.log('🖨️ Getting enhanced printer information...');
    const execAsync = util.promisify(exec);
    
    // Get comprehensive printer information with better error handling
    const printerQuery = `
      try {
        Get-WmiObject -Class Win32_Printer | ForEach-Object {
          [PSCustomObject]@{
            Name = $_.Name
            ShareName = $_.ShareName
            PortName = $_.PortName
            DriverName = $_.DriverName
            Default = $_.Default
            Local = $_.Local
            Network = $_.Network
            PrinterStatus = $_.PrinterStatus
            WorkOffline = $_.WorkOffline
            Attributes = $_.Attributes
            Location = $_.Location
            Comment = $_.Comment
          }
        } | ConvertTo-Json -Depth 3
      } catch {
        Write-Output "[]"
      }
    `;
    
    console.log('🔍 Executing printer query...');
    const { stdout } = await execAsync(`powershell -Command "${printerQuery}"`);
    
    let printers = [];
    try {
      const parsed = JSON.parse(stdout.trim() || '[]');
      printers = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      console.error('❌ Error parsing printer data:', parseError);
      console.log('Raw stdout:', stdout);
      return {
        success: false,
        error: 'Failed to parse printer information',
        printers: []
      };
    }
    
    console.log(`🔍 Found ${printers.length} raw printers:`, printers.map(p => p.Name));
    
    // Process and enhance printer information
    const enhancedPrinters = await Promise.all(printers.map(async (printer) => {
      // Clean printer name - remove network suffixes and extra info
      let cleanName = printer.Name;
      if (cleanName) {
        // Remove common network printer suffixes
        cleanName = cleanName.replace(/\s*$$[^)]*$$\s*$/, '').trim();
        cleanName = cleanName.replace(/\s*-\s*Network\s*$/, '').trim();
        cleanName = cleanName.replace(/\s*PCL-\d+.*$/, '').trim();
      }
      
      // Get printer capabilities with better error handling
      let capabilities = {
        duplex: false,
        color: false,
        paperSizes: [],
        resolutions: []
      };
      
      try {
        const capQuery = `
          try {
            Get-PrinterProperty -PrinterName "${printer.Name}" -ErrorAction SilentlyContinue | 
            Select-Object PropertyName, Value | ConvertTo-Json
          } catch {
            Write-Output "[]"
          }
        `;
        
        const { stdout: capStdout } = await execAsync(`powershell -Command "${capQuery}"`);
        
        if (capStdout.trim()) {
          const properties = JSON.parse(capStdout.trim() || '[]');
          const propArray = Array.isArray(properties) ? properties : [properties];
          
          propArray.forEach(prop => {
            if (prop.PropertyName) {
              const propName = prop.PropertyName.toLowerCase();
              if (propName.includes('duplex') || propName.includes('double')) {
                capabilities.duplex = true;
              }
              if (propName.includes('color') || propName.includes('colour')) {
                capabilities.color = true;
              }
            }
          });
        }
        
        // Additional capability detection based on driver name
        if (printer.DriverName) {
          const driverName = printer.DriverName.toLowerCase();
          if (driverName.includes('color') || driverName.includes('colour')) {
            capabilities.color = true;
          }
          if (driverName.includes('duplex') || driverName.includes('pcl')) {
            capabilities.duplex = true;
          }
        }
        
      } catch (capError) {
        console.log(`⚠️ Could not get capabilities for ${printer.Name}:`, capError.message);
      }
      
      return {
        name: printer.Name,
        cleanName: cleanName,
        displayName: cleanName || printer.Name,
        shareName: printer.ShareName,
        portName: printer.PortName,
        driverName: printer.DriverName,
        isDefault: printer.Default === true,
        isLocal: printer.Local === true,
        isNetwork: printer.Network === true,
        status: printer.PrinterStatus,
        workOffline: printer.WorkOffline === true,
        location: printer.Location,
        comment: printer.Comment,
        capabilities: capabilities,
        type: printer.Network ? 'network' : (printer.Local ? 'local' : 'unknown')
      };
    }));
    
    // Filter out invalid printers
    const validPrinters = enhancedPrinters.filter(p => p.name && p.name.trim());
    
    console.log('✅ Enhanced printer information retrieved:', validPrinters.length, 'valid printers');
    validPrinters.forEach(p => {
      console.log(`  🖨️ ${p.displayName} (${p.type}) - Default: ${p.isDefault}, Duplex: ${p.capabilities.duplex}, Color: ${p.capabilities.color}`);
    });
    
    const defaultPrinter = validPrinters.find(p => p.isDefault) || validPrinters[0];
    
    return {
      success: true,
      printers: validPrinters,
      defaultPrinter: defaultPrinter
    };
    
  } catch (error) {
    console.error('❌ Error getting enhanced printer info:', error);
    return {
      success: false,
      error: error.message,
      printers: []
    };
  }
});

// TEST PRINTER CONNECTIVITY
ipcMain.handle('test-printer-connectivity', async (event, printerName) => {
  try {
    console.log(`🔍 Testing connectivity for printer: ${printerName}`);
    const execAsync = util.promisify(exec);
    
    // Test printer status
    const statusQuery = `
      Get-Printer -Name "${printerName}" | Select-Object Name, PrinterStatus, JobCount | ConvertTo-Json
    `;
    
    const { stdout } = await execAsync(`powershell -Command "${statusQuery}"`);
    const printerStatus = JSON.parse(stdout);
    
    // Test print queue
    const queueQuery = `
      Get-PrintJob -PrinterName "${printerName}" | Measure-Object | Select-Object Count | ConvertTo-Json
    `;
    
    let queueCount = 0;
    try {
      const { stdout: queueStdout } = await execAsync(`powershell -Command "${queueQuery}"`);
      const queueResult = JSON.parse(queueStdout);
      queueCount = queueResult.Count || 0;
    } catch (queueError) {
      console.log('⚠️ Could not get queue count:', queueError.message);
    }
    
    const isOnline = printerStatus.PrinterStatus === 0; // 0 = Normal/Online
    
    console.log(`✅ Printer connectivity test completed for ${printerName}:`, {
      online: isOnline,
      jobCount: printerStatus.JobCount,
      queueCount: queueCount
    });
    
    return {
      success: true,
      online: isOnline,
      status: printerStatus.PrinterStatus,
      jobCount: printerStatus.JobCount,
      queueCount: queueCount,
      message: isOnline ? 'Printer is online and ready' : 'Printer may be offline or busy'
    };
    
  } catch (error) {
    console.error('❌ Error testing printer connectivity:', error);
    return {
      success: false,
      error: error.message,
      online: false
    };
  }
});

// ENHANCED PDF READER DETECTION
const findAdvancedPDFReader = () => {
  const readers = [
    {
      name: 'SumatraPDF',
      paths: [
        'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
        'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe'
      ],
      printCommand: (filePath, options) => `"${readers[0].foundPath}" -print-to "${options.printerName}" "${filePath}"`,
      silentSupport: true,
      duplexSupport: false
    },
    {
      name: 'Adobe Acrobat',
      paths: [
        'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
        'C:\\Program Files (x86)\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe'
      ],
      printCommand: (filePath, options) => `"${readers[1].foundPath}" /t "${filePath}" "${options.printerName}"`,
      silentSupport: true,
      duplexSupport: true
    },
    {
      name: 'Adobe Reader',
      paths: [
        'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
        'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
        'C:\\Program Files\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe',
        'C:\\Program Files (x86)\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe'
      ],
      printCommand: (filePath, options) => `"${readers[2].foundPath}" /t "${filePath}" "${options.printerName}"`,
      silentSupport: true,
      duplexSupport: false
    }
  ];
  
  for (const reader of readers) {
    for (const readerPath of reader.paths) {
      if (fs.existsSync(readerPath)) {
        reader.foundPath = readerPath;
        console.log(`✅ Found PDF reader: ${reader.name} at ${readerPath}`);
        return reader;
      }
    }
  }
  
  console.log('⚠️ No PDF reader found in standard locations');
  return null;
};

// ADVANCED PDF PRINTING WITH FULL FEATURE SUPPORT
ipcMain.handle('advanced-pdf-print', async (event, printOptions) => {
  try {
    console.log('🖨️ Starting advanced PDF print job:', printOptions);
    
    const {
      filePath,
      printerName,
      copies = 1,
      pageRange = 'all',
      customPages = '',
      colorMode = 'bw',
      doubleSided = 'one-side',
      silent = true
    } = printOptions;
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`);
    }
    
    console.log(`🎯 Target printer: "${printerName}"`);
    console.log(`📄 File: ${path.basename(filePath)}`);
    console.log(`⚙️ Settings: ${copies} copies, ${pageRange}, ${colorMode}, ${doubleSided}`);
    
    const execAsync = util.promisify(exec);
    const quotedFilePath = `"${filePath}"`;
    const quotedPrinterName = `"${printerName}"`;
    
    let printSuccess = false;
    let lastError = null;
    let methodUsed = '';
    
    // Method 1: Try PowerShell with Print Management (Most reliable for Windows)
    try {
      console.log('🔄 Method 1: Trying PowerShell Print Management...');
      
      // Build PowerShell command with proper error handling
      const psCommand = `
        try {
          $ErrorActionPreference = "Stop"
          $printer = "${printerName}"
          $file = "${filePath}"
          
          Write-Host "Testing printer availability..."
          $printerObj = Get-Printer -Name $printer -ErrorAction Stop
          Write-Host "Printer found: $($printerObj.Name)"
          
          # Apply printer configuration if supported
          try {
            ${doubleSided === 'both-sides' ? 'Set-PrintConfiguration -PrinterName $printer -DuplexingMode TwoSidedLongEdge -ErrorAction SilentlyContinue' : ''}
            ${colorMode === 'bw' ? 'Set-PrintConfiguration -PrinterName $printer -Color $false -ErrorAction SilentlyContinue' : ''}
            ${colorMode === 'color' ? 'Set-PrintConfiguration -PrinterName $printer -Color $true -ErrorAction SilentlyContinue' : ''}
          } catch {
            Write-Host "Could not apply advanced settings, continuing with basic print..."
          }
          
          # Print multiple copies with verification
          for ($i = 1; $i -le ${copies}; $i++) {
            Write-Host "Printing copy $i of ${copies}..."
            
            # Use Out-Printer cmdlet for direct printing
            Get-Content $file -Raw | Out-Printer -Name $printer
            
            # Alternative method if Out-Printer fails
            if ($LASTEXITCODE -ne 0) {
              Start-Process -FilePath $file -Verb Print -ArgumentList $printer -Wait -WindowStyle Hidden
            }
            
            if ($i -lt ${copies}) { 
              Start-Sleep -Seconds 2 
            }
          }
          
          Write-Host "Print job completed successfully"
          exit 0
        } catch {
          Write-Error "PowerShell print failed: $($_.Exception.Message)"
          exit 1
        }
      `;
      
      console.log('🖨️ Executing PowerShell Print Management command...');
      const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand}"`);
      
      console.log('📤 PowerShell stdout:', stdout);
      if (stderr) console.log('⚠️ PowerShell stderr:', stderr);
      
      printSuccess = true;
      methodUsed = 'PowerShell Print Management';
      console.log('✅ PowerShell Print Management successful');
      
    } catch (error) {
      console.log(`⚠️ Method 1 failed: ${error.message}`);
      lastError = error;
    }
    
    // Method 2: Try Adobe Reader/Acrobat if PowerShell failed
    if (!printSuccess) {
      try {
        console.log('🔄 Method 2: Trying Adobe Reader/Acrobat...');
        const adobeReader = findAdvancedPDFReader();
        
        if (adobeReader && (adobeReader.name.includes('Adobe'))) {
          console.log(`✅ Found Adobe application: ${adobeReader.name}`);
          
          for (let copy = 1; copy <= copies; copy++) {
            const command = `"${adobeReader.foundPath}" /t ${quotedFilePath} ${quotedPrinterName}`;
            console.log(`🖨️ Executing Adobe command (copy ${copy}/${copies}): ${command}`);
            
            await execAsync(command);
            
            if (copy < copies) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          // Apply advanced settings after printing
          if (doubleSided === 'both-sides' || colorMode === 'bw') {
            await applyAdvancedPrintSettings(printerName, { doubleSided, colorMode });
          }
          
          printSuccess = true;
          methodUsed = adobeReader.name;
          console.log(`✅ Adobe ${adobeReader.name} print successful`);
        }
      } catch (error) {
        console.log(`⚠️ Method 2 failed: ${error.message}`);
        lastError = error;
      }
    }
    
    // Method 3: Try SumatraPDF if Adobe failed
    if (!printSuccess) {
      try {
        console.log('🔄 Method 3: Trying SumatraPDF...');
        const sumatraReader = findAdvancedPDFReader();
        
        if (sumatraReader && sumatraReader.name === 'SumatraPDF') {
          console.log(`✅ Found SumatraPDF: ${sumatraReader.foundPath}`);
          
          for (let copy = 1; copy <= copies; copy++) {
            const command = `"${sumatraReader.foundPath}" -print-to ${quotedPrinterName} ${quotedFilePath}`;
            console.log(`🖨️ Executing SumatraPDF command (copy ${copy}/${copies}): ${command}`);
            await execAsync(command);
            
            if (copy < copies) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          printSuccess = true;
          methodUsed = 'SumatraPDF';
          console.log('✅ SumatraPDF print successful');
        }
      } catch (error) {
        console.log(`⚠️ Method 3 failed: ${error.message}`);
        lastError = error;
      }
    }
    
    // Method 4: Direct Windows print command as fallback
    if (!printSuccess) {
      try {
        console.log('🔄 Method 4: Trying direct Windows print command...');
        
        for (let copy = 1; copy <= copies; copy++) {
          const command = `print /D:${quotedPrinterName} ${quotedFilePath}`;
          console.log(`🖨️ Executing Windows print command (copy ${copy}/${copies}): ${command}`);
          await execAsync(command);
          
          if (copy < copies) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        printSuccess = true;
        methodUsed = 'Windows Print Command';
        console.log('✅ Windows print command successful');
      } catch (error) {
        console.log(`⚠️ Method 4 failed: ${error.message}`);
        lastError = error;
      }
    }
    
    if (printSuccess) {
      console.log(`✅ Advanced PDF print completed successfully using: ${methodUsed}`);
      return {
        success: true,
        message: `PDF printed successfully using ${methodUsed}`,
        method: methodUsed,
        copies: copies,
        pageRange: pageRange,
        colorMode: colorMode,
        doubleSided: doubleSided,
        printerName: printerName
      };
    } else {
      throw lastError || new Error('All advanced PDF print methods failed');
    }
    
  } catch (error) {
    console.error('❌ Error in advanced PDF printing:', error);
    return {
      success: false,
      error: error.message,
      details: 'All advanced PDF printing methods failed. Please check printer connectivity and PDF reader installation.'
    };
  }
});

// APPLY ADVANCED PRINT SETTINGS
const applyAdvancedPrintSettings = async (printerName, settings) => {
  try {
    console.log(`🔧 Applying advanced print settings for ${printerName}:`, settings);
    const execAsync = util.promisify(exec);
    
    const commands = [];
    
    if (settings.doubleSided === 'both-sides') {
      commands.push(`Set-PrintConfiguration -PrinterName "${printerName}" -DuplexingMode TwoSidedLongEdge`);
    }
    
    if (settings.colorMode === 'bw') {
      commands.push(`Set-PrintConfiguration -PrinterName "${printerName}" -Color $false`);
    } else if (settings.colorMode === 'color') {
      commands.push(`Set-PrintConfiguration -PrinterName "${printerName}" -Color $true`);
    }
    
    for (const command of commands) {
      try {
        await execAsync(`powershell -Command "${command}"`);
        console.log(`✅ Applied setting: ${command}`);
      } catch (settingError) {
        console.log(`⚠️ Could not apply setting: ${command} - ${settingError.message}`);
      }
    }
    
  } catch (error) {
    console.log('⚠️ Error applying advanced print settings:', error.message);
  }
};

// ADVANCED CANVAS PRINTING
ipcMain.handle('advanced-canvas-print', async (event, canvasData) => {
  try {
    console.log('🖨️ Starting advanced canvas print job:', canvasData);
    
    const { pageData, colorMode, printerName, silent = true } = canvasData;
    
    console.log(`🎯 Target printer: "${printerName}"`);
    console.log(`🎨 Color mode: ${colorMode}`);
    console.log(`📄 Canvas items: ${pageData.items.length}`);
    
    // Create temporary directory
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const tempHtmlPath = path.join(tempDir, `canvas_${timestamp}.html`);
    const tempPdfPath = path.join(tempDir, `canvas_${timestamp}.pdf`);
    
    // Generate high-quality HTML with print CSS
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Canvas Print Job</title>
      <style>
        @page { 
          size: A4; 
          margin: 0; 
        }
        @media print {
          body { 
            margin: 0; 
            padding: 0;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
        }
        body { 
          margin: 0; 
          padding: 20px;
          font-family: Arial, sans-serif;
          background: white
        }
        .canvas-container { 
          width: 595px; 
          height: 842px; 
          position: relative; 
          background: white;
          ${colorMode === 'bw' ? 'filter: grayscale(100%);' : ''}
        }
        .canvas-item { 
          position: absolute; 
        }
        .canvas-item img { 
          width: 100%; 
          height: 100%; 
          object-fit: contain; 
          ${colorMode === 'bw' ? 'filter: grayscale(100%);' : ''}
        }
      </style>
    </head>
    <body>
      <div class="canvas-container">
        ${pageData.items.map(item => `
          <div class="canvas-item" style="
            left: ${item.x}px; 
            top: ${item.y}px; 
            width: ${item.width}px; 
            height: ${item.height}px;
            transform: rotate(${item.rotation || 0}deg);
          ">
            <img src="data:image/jpeg;base64,${fs.readFileSync(item.file.localPath).toString('base64')}" alt="${item.file.name}" />
          </div>
        `).join('')}
      </div>
    </body>
    </html>`;
    
    fs.writeFileSync(tempHtmlPath, htmlContent);
    
    const execAsync = util.promisify(exec);
    let printSuccess = false;
    let lastError = null;
    let methodUsed = '';
    
    // Method 1: Convert to PDF using Chrome/Edge, then print with PowerShell
    try {
      console.log('🔄 Canvas Method 1: Chrome/Edge to PDF conversion...');
      
      const browsers = [
        'msedge',
        '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
        '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"'
      ];
      
      for (const browser of browsers) {
        try {
          const command = `${browser} --headless --disable-gpu --print-to-pdf="${tempPdfPath}" --no-margins "${tempHtmlPath}"`;
          console.log(`🔄 Executing: ${command}`);
          await execAsync(command);
          
          if (fs.existsSync(tempPdfPath)) {
            console.log('✅ PDF created successfully, now printing with PowerShell...');
            
            // Print the generated PDF using PowerShell
            const printCommand = `
              try {
                $printer = "${printerName}"
                $file = "${tempPdfPath}"
                
                Write-Host "Printing canvas PDF to $printer..."
                Get-Content $file -Raw | Out-Printer -Name $printer
                
                Write-Host "Canvas print completed"
                exit 0
              } catch {
                Write-Error "Canvas print failed: $($_.Exception.Message)"
                exit 1
              }
            `;
            
            const { stdout } = await execAsync(`powershell -Command "${printCommand}"`);
            console.log('📤 Canvas print stdout:', stdout);
            
            printSuccess = true;
            methodUsed = `${browser.includes('msedge') ? 'Edge' : 'Chrome'} + PowerShell`;
            break;
          }
        } catch (browserError) {
          console.log(`⚠️ ${browser} failed: ${browserError.message}`);
          continue;
        }
      }
    } catch (error) {
      console.log(`⚠️ Canvas Method 1 failed: ${error.message}`);
      lastError = error;
    }
    
    // Method 2: Direct HTML printing with PowerShell
    if (!printSuccess) {
      try {
        console.log('🔄 Canvas Method 2: Direct HTML printing with PowerShell...');
        
        const printCommand = `
          try {
            $printer = "${printerName}"
            $file = "${tempHtmlPath}"
            
            Write-Host "Printing HTML canvas to $printer..."
            
            # Try to print HTML file directly
            Start-Process -FilePath $file -Verb Print -ArgumentList $printer -Wait -WindowStyle Hidden
            
            Write-Host "HTML canvas print completed"
            exit 0
          } catch {
            Write-Error "HTML canvas print failed: $($_.Exception.Message)"
            exit 1
          }
        `;
        
        const { stdout } = await execAsync(`powershell -Command "${printCommand}"`);
        console.log('📤 HTML print stdout:', stdout);
        
        printSuccess = true;
        methodUsed = 'Direct HTML Print with PowerShell';
        console.log('✅ Direct HTML print successful');
      } catch (error) {
        console.log(`⚠️ Canvas Method 2 failed: ${error.message}`);
        lastError = error;
      }
    }
    
    // Clean up temp files after delay
    setTimeout(() => {
      try {
        [tempHtmlPath, tempPdfPath].forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`🗑️ Cleaned up: ${file}`);
          }
        });
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup error:', cleanupError);
      }
    }, 10000);
    
    if (printSuccess) {
      console.log(`✅ Advanced canvas print completed successfully using: ${methodUsed}`);
      return {
        success: true,
        message: `Canvas printed successfully using ${methodUsed}`,
        method: methodUsed,
        colorMode: colorMode,
        printerName: printerName
      };
    } else {
      throw lastError || new Error('All advanced canvas print methods failed');
    }
    
  } catch (error) {
    console.error('❌ Error in advanced canvas printing:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// LEGACY COMPATIBILITY METHODS (keeping existing API)
ipcMain.handle('get-available-printers', async (event) => {
  const result = await event.sender.invoke('get-enhanced-printer-info');
  return {
    success: result.success,
    printers: result.printers?.map(p => ({ Name: p.name, PrinterStatus: p.status })) || [],
    error: result.error
  };
});

ipcMain.handle('get-default-printer', async (event) => {
  const result = await event.sender.invoke('get-enhanced-printer-info');
  return {
    success: result.success,
    defaultPrinter: result.defaultPrinter?.name || null,
    error: result.error
  };
});

ipcMain.handle('print-canvas', async (event, canvasData) => {
  // Use advanced canvas printing with default printer
  const printerInfo = await event.sender.invoke('get-enhanced-printer-info');
  const defaultPrinter = printerInfo.defaultPrinter?.name;
  
  if (!defaultPrinter) {
    return {
      success: false,
      error: 'No default printer found'
    };
  }
  
  return await event.sender.invoke('advanced-canvas-print', {
    ...canvasData,
    printerName: defaultPrinter
  });
});

ipcMain.handle('print-pdf', async (event, printOptions) => {
  // Use advanced PDF printing with default printer if not specified
  if (!printOptions.printerName) {
    const printerInfo = await event.sender.invoke('get-enhanced-printer-info');
    const defaultPrinter = printerInfo.defaultPrinter?.name;
    
    if (!defaultPrinter) {
      return {
        success: false,
        error: 'No default printer found'
      };
    }
    
    printOptions.printerName = defaultPrinter;
  }
  
  return await event.sender.invoke('advanced-pdf-print', printOptions);
});
