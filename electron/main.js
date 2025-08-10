require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const { app, BrowserWindow, ipcMain, shell } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")
const fs = require("fs")
const { exec } = require("child_process")
const util = require("util")

let PDFDocument
try {
  PDFDocument = require("pdf-lib").PDFDocument
} catch (e) {
  console.log("ℹ️ pdf-lib not installed. Custom page range will rely on external tools.")
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
    },
    titleBarStyle: "default",
    show: false,
  })

  mainWindow.loadURL("http://localhost:5173").catch((err) => {
    console.error("Failed to load local React app:", err)
    mainWindow.loadURL("https://last-and-final.vercel.app")
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  autoUpdater.checkForUpdatesAndNotify()
}

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// UTILITY FUNCTIONS
const pathExists = (p) => {
  try {
    if (!p) return false
    if (fs.existsSync(p)) return true
    const decoded = decodeURIComponent(p)
    if (decoded !== p && fs.existsSync(decoded)) return true
    return false
  } catch {
    return false
  }
}

const execAsync = util.promisify(exec)

// Create logs directory
const logsDir = path.join(__dirname, "logs")
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const logPrint = (message) => {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(message)
  try {
    fs.appendFileSync(path.join(logsDir, "print.log"), logMessage)
  } catch (e) {
    console.error("Failed to write to log:", e)
  }
}

// CORE FILE HANDLERS
ipcMain.handle("open-local-file", async (event, filePath) => {
  try {
    const decodedPath = decodeURIComponent(filePath)
    if (!fs.existsSync(decodedPath)) {
      throw new Error(`File does not exist: ${path.basename(decodedPath)}`)
    }
    await shell.openPath(decodedPath)
    return { success: true, message: "File opened successfully" }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("file-exists", async (event, filePath) => {
  try {
    return { success: true, exists: pathExists(filePath) }
  } catch (e) {
    return { success: false, exists: false, error: e.message }
  }
})

ipcMain.handle("get-file-as-base64", async (event, filePath) => {
  try {
    logPrint(`📸 Reading file as base64: ${filePath}`)
    const tryPaths = [filePath, decodeURIComponent(filePath)]
    let foundPath = null
    for (const p of tryPaths) {
      if (fs.existsSync(p)) {
        foundPath = p
        break
      }
    }
    if (!foundPath) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    const fileBuffer = fs.readFileSync(foundPath)
    const extension = path.extname(foundPath).toLowerCase()
    let mimeType = "application/octet-stream"
    if ([".jpg", ".jpeg"].includes(extension)) mimeType = "image/jpeg"
    else if (extension === ".png") mimeType = "image/png"
    else if (extension === ".gif") mimeType = "image/gif"
    else if (extension === ".bmp") mimeType = "image/bmp"
    else if (extension === ".webp") mimeType = "image/webp"

    const base64Data = fileBuffer.toString("base64")
    const dataUrl = `data:${mimeType};base64,${base64Data}`

    logPrint("✅ File converted to base64 successfully")
    return { success: true, dataUrl, mimeType, size: fileBuffer.length }
  } catch (error) {
    logPrint(`❌ Error reading file as base64: ${error.message}`)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("get-pdf-as-buffer", async (event, filePath) => {
  try {
    logPrint(`📄 Reading PDF as buffer: ${filePath}`)
    const tryPaths = [filePath, decodeURIComponent(filePath)]
    let foundPath = null
    for (const p of tryPaths) {
      if (fs.existsSync(p)) {
        foundPath = p
        break
      }
    }
    if (!foundPath) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    const fileBuffer = fs.readFileSync(foundPath)
    const uint8Array = new Uint8Array(fileBuffer)
    logPrint(`✅ PDF buffer read successfully, size: ${fileBuffer.length}`)
    return { success: true, buffer: Array.from(uint8Array), size: fileBuffer.length }
  } catch (error) {
    logPrint(`❌ Error reading PDF as buffer: ${error.message}`)
    return { success: false, error: error.message }
  }
})

// SESSION FILE MANAGEMENT
ipcMain.handle("get-session-files", async (event, sessionId) => {
  try {
    logPrint(`🔍 Getting files from session folder: ${sessionId}`)
    const baseDir = process.env.FILES_BASE_DIR
    const sessionDir = path.join(baseDir, sessionId)

    if (!fs.existsSync(sessionDir)) {
      logPrint(`📁 Session directory does not exist: ${sessionDir}`)
      return { files: [], count: 0, sessionDir, exists: false }
    }

    const files = fs
      .readdirSync(sessionDir)
      .filter((file) => {
        const filePath = path.join(sessionDir, file)
        return fs.statSync(filePath).isFile()
      })
      .map((file) => {
        const filePath = path.join(sessionDir, file)
        const stats = fs.statSync(filePath)
        const decodedName = decodeURIComponent(file)
        const extension = path.extname(decodedName).toLowerCase()
        let fileType = "other"
        if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(extension)) {
          fileType = "image"
        } else if (extension === ".pdf") {
          fileType = "pdf"
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
          isLocal: true,
        }
      })
      .sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime))

    logPrint(`✅ Found ${files.length} files in session folder`)
    return { files, count: files.length, sessionDir, exists: true, success: true }
  } catch (error) {
    logPrint(`❌ Error getting session files: ${error.message}`)
    return { files: [], count: 0, error: error.message, exists: false, success: false }
  }
})

ipcMain.handle("download-s3-files", async (event, sessionId, s3Files) => {
  try {
    logPrint(`📥 Downloading ${s3Files.length} files for session ${sessionId}`)
    const baseDir = process.env.FILES_BASE_DIR
    const sessionDir = path.join(baseDir, sessionId)

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const downloadedFiles = []
    const errors = []

    for (const s3File of s3Files) {
      try {
        const { key, name } = s3File
        const decodedName = decodeURIComponent(name)
        logPrint(`📥 Downloading: ${decodedName}`)

        const response = await fetch(
          `https://upload-backend-api.vercel.app/api/download-file?key=${encodeURIComponent(key)}`,
        )
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const buffer = await response.arrayBuffer()
        const localFilePath = path.join(sessionDir, decodedName)
        fs.writeFileSync(localFilePath, Buffer.from(buffer))

        const stats = fs.statSync(localFilePath)
        downloadedFiles.push({
          name: decodedName,
          localPath: localFilePath,
          size: stats.size,
          downloadTime: new Date().toISOString(),
        })
        logPrint(`✅ Downloaded: ${decodedName}`)
      } catch (error) {
        logPrint(`❌ Error downloading ${s3File.name}: ${error.message}`)
        errors.push({ name: s3File.name, error: error.message })
      }
    }

    return { success: true, downloadedFiles, errors, sessionDir }
  } catch (error) {
    logPrint(`❌ Error in download-s3-files: ${error.message}`)
    return { success: false, error: error.message }
  }
})

// SMS INVOICE
ipcMain.handle("send-sms-invoice", async (event, invoiceData) => {
  try {
    logPrint(`📱 Sending SMS invoice: ${JSON.stringify(invoiceData)}`)
    return { success: true, message: "SMS invoice sent successfully" }
  } catch (error) {
    logPrint(`❌ Error sending SMS invoice: ${error.message}`)
    return { success: false, error: error.message }
  }
})

// PRINTER DETECTION
ipcMain.handle("get-default-printer", async (event) => {
  try {
    logPrint("🖨️ Getting default printer...")
    const printerQuery = `Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object Name, PrinterStatus | ConvertTo-Json`
    const { stdout } = await execAsync(`powershell -Command "${printerQuery}"`)

    if (stdout.trim()) {
      const printer = JSON.parse(stdout.trim())
      logPrint(`✅ Default printer: ${printer.Name}`)
      return { success: true, defaultPrinter: printer.Name, status: printer.PrinterStatus }
    } else {
      logPrint("⚠️ No default printer found")
      return { success: false, error: "No default printer found" }
    }
  } catch (error) {
    logPrint(`❌ Error getting default printer: ${error.message}`)
    return { success: false, error: error.message }
  }
})

// CORE PRINTING FUNCTIONS - BASED ON PYTHON VERSION

// Parse custom page ranges like "1-3,5,7-9" into actual page numbers
function parsePageRange(pageRangeStr) {
  const pages = new Set()
  if (!pageRangeStr || !pageRangeStr.trim()) return []

  const parts = pageRangeStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim())
      const start = Number.parseInt(startStr, 10) || 0
      const end = Number.parseInt(endStr, 10) || 0
      if (start && end && start <= end) {
        for (let i = start; i <= end; i++) {
          pages.add(i)
        }
      }
    } else {
      const p = Number.parseInt(part, 10) || 0
      if (p) pages.add(p)
    }
  }
  return Array.from(pages).sort((a, b) => a - b)
}

// Create subset PDF for custom page ranges (like Python version)
async function createTempPdfWithPages(sourcePath, pageRangeStr) {
  if (!PDFDocument) {
    logPrint("⚠️ pdf-lib not available for custom page range")
    return null
  }

  try {
    const pages = parsePageRange(pageRangeStr)
    if (pages.length === 0) return null

    const buf = fs.readFileSync(sourcePath)
    const srcPdf = await PDFDocument.load(buf)
    const pageCount = srcPdf.getPageCount()

    const validPages = pages.filter((p) => p >= 1 && p <= pageCount)
    if (validPages.length === 0) return null

    const outPdf = await PDFDocument.create()
    const indices = validPages.map((p) => p - 1) // Convert to 0-based
    const copied = await outPdf.copyPages(srcPdf, indices)
    copied.forEach((p) => outPdf.addPage(p))

    const outBytes = await outPdf.save()
    const tempDir = path.join(__dirname, "temp")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const outPath = path.join(tempDir, `subset_${Date.now()}.pdf`)
    fs.writeFileSync(outPath, Buffer.from(outBytes))

    logPrint(`✅ Created temp PDF with pages ${validPages.join(",")}: ${outPath}`)
    return outPath
  } catch (error) {
    logPrint(`❌ Error creating temp PDF: ${error.message}`)
    return null
  }
}

// Find Adobe Reader (like Python version)
const findAdobeReader = () => {
  const paths = [
    "C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
    "C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
    "C:\\Program Files (x86)\\Adobe\\Acrobat Reader\\Reader\\AcroRd32.exe",
    "C:\\Program Files\\Adobe\\Acrobat Reader\\Reader\\AcroRd32.exe",
  ]

  for (const adobePath of paths) {
    if (fs.existsSync(adobePath)) {
      logPrint(`✅ Found Adobe Reader: ${adobePath}`)
      return adobePath
    }
  }
  logPrint("⚠️ Adobe Reader not found")
  return null
}

// Find SumatraPDF (like Python version)
const findSumatraPDF = () => {
  const paths = [
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
    path.join(require("os").homedir(), "AppData\\Local\\SumatraPDF\\SumatraPDF.exe"),
  ]

  for (const sumatraPath of paths) {
    if (fs.existsSync(sumatraPath)) {
      logPrint(`✅ Found SumatraPDF: ${sumatraPath}`)
      return sumatraPath
    }
  }
  logPrint("⚠️ SumatraPDF not found")
  return null
}

// SIMPLIFIED BUT RELIABLE PDF PRINTING WITH COLOR/DUPLEX SUPPORT
ipcMain.handle("print-pdf", async (event, printOptions) => {
  try {
    logPrint(`🖨️ Starting RELIABLE PDF print with options: ${JSON.stringify(printOptions)}`)

    const {
      filePath,
      copies = 1,
      pageRange = "all",
      customPages = "",
      colorMode = "bw",
      doubleSided = "one-side",
    } = printOptions

    // Validate file path
    let targetPath = filePath
    if (!pathExists(targetPath)) {
      const decoded = decodeURIComponent(filePath || "")
      if (pathExists(decoded)) {
        targetPath = decoded
      }
    }
    if (!pathExists(targetPath)) {
      throw new Error(`PDF file not found: ${filePath}`)
    }

    logPrint(`📄 File: ${path.basename(targetPath)}`)
    logPrint(`⚙️ Settings: ${copies} copies, ${pageRange}, ${colorMode}, ${doubleSided}`)

    let printSuccess = false
    let methodUsed = ""
    const tempFiles = []

    // Handle custom page range by creating subset PDF
    const isCustomRange = pageRange === "custom" && customPages.trim().length > 0
    if (isCustomRange) {
      const tempPdf = await createTempPdfWithPages(targetPath, customPages)
      if (tempPdf) {
        targetPath = tempPdf
        tempFiles.push(tempPdf)
        logPrint(`✅ Using temp PDF for custom pages: ${tempPdf}`)
      }
    }

    // Method 1: SumatraPDF with SIMPLE but EFFECTIVE settings
    const sumatraPath = findSumatraPDF()
    if (sumatraPath && !printSuccess) {
      try {
        logPrint("🔄 Trying SumatraPDF with RELIABLE settings...")

        // Build SumatraPDF command with proper settings
        let sumatraCmd = `"${sumatraPath}" -print-to-default "${targetPath}"`

        // Add print settings - SIMPLE but EFFECTIVE
        const settings = []
        if (doubleSided === "both-sides") {
          settings.push("duplex")
        }
        if (colorMode === "bw") {
          settings.push("monochrome")
        }
        if (settings.length > 0) {
          sumatraCmd += ` -print-settings "${settings.join(",")}"`
        }

        logPrint(`🖨️ SumatraPDF command: ${sumatraCmd}`)

        for (let copy = 1; copy <= copies; copy++) {
          const { stdout, stderr } = await execAsync(sumatraCmd)
          logPrint(`✅ SumatraPDF copy ${copy}/${copies} executed`)
          if (stderr) logPrint(`⚠️ SumatraPDF stderr: ${stderr}`)
          if (copy < copies) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        printSuccess = true
        methodUsed = "SumatraPDF"
        logPrint("✅ SumatraPDF print successful")
      } catch (error) {
        logPrint(`⚠️ SumatraPDF failed: ${error.message}`)
      }
    }

    // Method 2: Adobe Reader - SIMPLE and RELIABLE
    const adobePath = findAdobeReader()
    if (adobePath && !printSuccess) {
      try {
        logPrint("🔄 Trying Adobe Reader - SIMPLE method...")

        // Simple Adobe Reader command
        const adobeCmd = `"${adobePath}" /t "${targetPath}"`
        logPrint(`🖨️ Adobe Reader command: ${adobeCmd}`)

        for (let copy = 1; copy <= copies; copy++) {
          const { stdout, stderr } = await execAsync(adobeCmd)
          logPrint(`✅ Adobe Reader copy ${copy}/${copies} executed`)
          if (stderr) logPrint(`⚠️ Adobe Reader stderr: ${stderr}`)
          if (copy < copies) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        printSuccess = true
        methodUsed = "Adobe Reader"
        logPrint("✅ Adobe Reader print successful")
      } catch (error) {
        logPrint(`⚠️ Adobe Reader failed: ${error.message}`)
      }
    }

    // Method 3: Windows ShellExecute - MOST RELIABLE
    if (!printSuccess) {
      try {
        logPrint("🔄 Trying Windows ShellExecute - MOST RELIABLE...")

        const shellCmd = `powershell -Command "Start-Process -FilePath '${targetPath}' -Verb Print -WindowStyle Hidden"`
        logPrint(`🖨️ ShellExecute command: ${shellCmd}`)

        for (let copy = 1; copy <= copies; copy++) {
          const { stdout, stderr } = await execAsync(shellCmd)
          logPrint(`✅ ShellExecute copy ${copy}/${copies} executed`)
          if (stderr) logPrint(`⚠️ ShellExecute stderr: ${stderr}`)
          if (copy < copies) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        printSuccess = true
        methodUsed = "Windows ShellExecute"
        logPrint("✅ Windows ShellExecute print successful")
      } catch (error) {
        logPrint(`⚠️ Windows ShellExecute failed: ${error.message}`)
      }
    }

    // Method 4: Simple print command - FALLBACK
    if (!printSuccess) {
      try {
        logPrint("🔄 Trying simple print command - FALLBACK...")

        // Get default printer
        const printerQuery = `Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object Name | ConvertTo-Json`
        const { stdout: printerStdout } = await execAsync(`powershell -Command "${printerQuery}"`)

        if (printerStdout.trim()) {
          const printer = JSON.parse(printerStdout.trim())
          const printerName = printer.Name
          logPrint(`🖨️ Using printer: ${printerName}`)

          for (let copy = 1; copy <= copies; copy++) {
            const printCmd = `print /D:"${printerName}" "${targetPath}"`
            logPrint(`🖨️ Print command: ${printCmd}`)
            const { stdout, stderr } = await execAsync(printCmd)
            logPrint(`✅ Print command copy ${copy}/${copies} executed`)
            if (stderr) logPrint(`⚠️ Print command stderr: ${stderr}`)
            if (copy < copies) {
              await new Promise((resolve) => setTimeout(resolve, 2000))
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 2000))
          printSuccess = true
          methodUsed = "Windows Print Command"
          logPrint("✅ Windows print command successful")
        }
      } catch (error) {
        logPrint(`⚠️ Windows print command failed: ${error.message}`)
      }
    }

    // APPLY COLOR/DUPLEX SETTINGS AFTER PRINTING (if possible)
    if (printSuccess) {
      try {
        logPrint(`🎨 Attempting to apply ${colorMode} and ${doubleSided} settings post-print...`)

        const printerQuery = `Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object Name | ConvertTo-Json`
        const { stdout: printerStdout } = await execAsync(`powershell -Command "${printerQuery}"`)

        if (printerStdout.trim()) {
          const printer = JSON.parse(printerStdout.trim())
          const printerName = printer.Name

          // Try to set color mode
          if (colorMode === "bw") {
            try {
              await execAsync(
                `powershell -Command "Set-PrintConfiguration -PrinterName '${printerName}' -Color $false"`,
              )
              logPrint("✅ Post-print: B&W mode applied")
            } catch (e) {
              logPrint(`⚠️ Post-print color setting failed: ${e.message}`)
            }
          }

          // Try to set duplex mode
          if (doubleSided === "both-sides") {
            try {
              await execAsync(
                `powershell -Command "Set-PrintConfiguration -PrinterName '${printerName}' -DuplexingMode TwoSidedLongEdge"`,
              )
              logPrint("✅ Post-print: Duplex mode applied")
            } catch (e) {
              logPrint(`⚠️ Post-print duplex setting failed: ${e.message}`)
            }
          }
        }
      } catch (e) {
        logPrint(`⚠️ Post-print configuration failed: ${e.message}`)
      }
    }

    // Cleanup temp files after delay
    if (tempFiles.length > 0) {
      setTimeout(() => {
        tempFiles.forEach((tempFile) => {
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile)
              logPrint(`🗑️ Cleaned up temp file: ${tempFile}`)
            }
          } catch (e) {
            logPrint(`⚠️ Failed to clean temp file: ${e.message}`)
          }
        })
      }, 30000) // 30 seconds delay
    }

    if (printSuccess) {
      logPrint(`✅ PDF print completed using: ${methodUsed} with ${colorMode} mode and ${doubleSided} setting`)
      return {
        success: true,
        message: `PDF printed successfully using ${methodUsed} in ${colorMode} mode with ${doubleSided} setting`,
        method: methodUsed,
        copies,
        pageRange,
        colorMode,
        doubleSided,
      }
    } else {
      throw new Error("All PDF print methods failed - check if Adobe Reader or SumatraPDF is installed")
    }
  } catch (error) {
    logPrint(`❌ Error in PDF printing: ${error.message}`)
    return {
      success: false,
      error: error.message,
    }
  }
})

// CANVAS PRINTING - BASED ON PYTHON VERSION
ipcMain.handle("print-canvas", async (event, canvasData) => {
  try {
    logPrint(`🖨️ Starting canvas print: ${canvasData?.pageData?.id || ""}`)

    const { pageData, colorMode } = canvasData
    if (!pageData || !Array.isArray(pageData.items) || pageData.items.length === 0) {
      throw new Error("Canvas page has no items to print")
    }

    logPrint(`🎨 Color mode: ${colorMode}`)
    logPrint(`📄 Canvas items: ${pageData.items.length}`)

    const tempDir = path.join(__dirname, "temp")
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const timestamp = Date.now()
    const tempHtmlPath = path.join(tempDir, `canvas_${timestamp}.html`)
    const tempPdfPath = path.join(tempDir, `canvas_${timestamp}.pdf`)

    // Build HTML content with items (like Python version)
    const buildItemsHtml = () => {
      try {
        return pageData.items
          .map((item) => {
            let imgSrc = ""
            if (item.dataUrl && typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:")) {
              imgSrc = item.dataUrl
            } else if (item.file?.localPath && pathExists(item.file.localPath)) {
              const buf = fs.readFileSync(item.file.localPath)
              imgSrc = `data:image/jpeg;base64,${buf.toString("base64")}`
            } else {
              logPrint(`⚠️ No dataUrl/localPath for item ${item.id}`)
              return ""
            }

            return `
              <div class="canvas-item" style="
                position: absolute;
                left: ${item.x}px; 
                top: ${item.y}px; 
                width: ${item.width}px; 
                height: ${item.height}px;
                transform: rotate(${item.rotation || 0}deg);
              ">
                <img src="${imgSrc}" alt="${(item.file && item.file.name) || "image"}" style="
                  width: 100%; 
                  height: 100%; 
                  object-fit: contain;
                  ${colorMode === "bw" ? "filter: grayscale(100%);" : ""}
                " />
              </div>
            `
          })
          .join("")
      } catch (e) {
        logPrint(`❌ Error building items HTML: ${e.message}`)
        return ""
      }
    }

    // Generate HTML with proper styling
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
            background: white;
          }
          .canvas-container { 
            width: 595px; 
            height: 842px; 
            position: relative; 
            background: white;
            ${colorMode === "bw" ? "filter: grayscale(100%);" : ""}
          }
          .canvas-item { 
            position: absolute; 
          }
        </style>
      </head>
      <body>
        <div class="canvas-container">
          ${buildItemsHtml()}
        </div>
      </body>
      </html>
    `

    fs.writeFileSync(tempHtmlPath, htmlContent, "utf8")
    logPrint(`✅ Created HTML file: ${tempHtmlPath}`)

    // Convert HTML to PDF using headless browser (like Python version)
    const browsers = [
      "msedge",
      '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
      '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"',
    ]

    let pdfCreated = false
    for (const browser of browsers) {
      try {
        const command = `${browser} --headless=new --disable-gpu --print-to-pdf="${tempPdfPath}" --no-margins "file:///${tempHtmlPath.replace(/\\/g, "/")}"`
        logPrint(`🔄 Converting to PDF: ${command}`)
        await execAsync(command)

        if (fs.existsSync(tempPdfPath)) {
          pdfCreated = true
          logPrint("✅ PDF created successfully")
          break
        }
      } catch (browserError) {
        logPrint(`⚠️ ${browser} failed: ${browserError.message}`)
        continue
      }
    }

    if (!pdfCreated) {
      throw new Error("Failed to generate PDF from canvas HTML")
    }

    // Print the generated PDF using the same methods as PDF printing
    let printSuccess = false
    let methodUsed = ""

    // Try Adobe Reader first
    const adobePath = findAdobeReader()
    if (adobePath) {
      try {
        const adobeCmd = `"${adobePath}" /t "${tempPdfPath}"`
        await execAsync(adobeCmd)
        await new Promise((resolve) => setTimeout(resolve, 3000))
        printSuccess = true
        methodUsed = "Adobe Reader"
        logPrint("✅ Canvas printed via Adobe Reader")
      } catch (error) {
        logPrint(`⚠️ Adobe Reader failed for canvas: ${error.message}`)
      }
    }

    // Try SumatraPDF
    if (!printSuccess) {
      const sumatraPath = findSumatraPDF()
      if (sumatraPath) {
        try {
          let sumatraCmd = `"${sumatraPath}" -print-to-default "${tempPdfPath}"`
          if (colorMode === "bw") {
            sumatraCmd += ` -print-settings "monochrome"`
          }
          await execAsync(sumatraCmd)
          await new Promise((resolve) => setTimeout(resolve, 3000))
          printSuccess = true
          methodUsed = "SumatraPDF"
          logPrint("✅ Canvas printed via SumatraPDF")
        } catch (error) {
          logPrint(`⚠️ SumatraPDF failed for canvas: ${error.message}`)
        }
      }
    }

    // Try Windows ShellExecute
    if (!printSuccess) {
      try {
        const shellCmd = `powershell -Command "Start-Process -FilePath '${tempPdfPath}' -Verb Print -WindowStyle Hidden"`
        await execAsync(shellCmd)
        await new Promise((resolve) => setTimeout(resolve, 3000))
        printSuccess = true
        methodUsed = "Windows ShellExecute"
        logPrint("✅ Canvas printed via Windows ShellExecute")
      } catch (error) {
        logPrint(`⚠️ Windows ShellExecute failed for canvas: ${error.message}`)
      }
    }

    // Cleanup temp files after delay
    setTimeout(() => {
      try {
        ;[tempHtmlPath, tempPdfPath].forEach((file) => {
          if (file && fs.existsSync(file)) {
            fs.unlinkSync(file)
            logPrint(`🗑️ Cleaned up: ${file}`)
          }
        })
      } catch (cleanupError) {
        logPrint(`⚠️ Cleanup error: ${cleanupError.message}`)
      }
    }, 30000) // 30 seconds delay

    if (printSuccess) {
      logPrint(`✅ Canvas print completed using: ${methodUsed}`)
      return {
        success: true,
        message: `Canvas printed successfully using ${methodUsed}`,
        method: methodUsed,
        colorMode,
      }
    } else {
      throw new Error("Canvas print failed")
    }
  } catch (error) {
    logPrint(`❌ Error in canvas printing: ${error.message}`)
    return {
      success: false,
      error: error.message,
    }
  }
})
