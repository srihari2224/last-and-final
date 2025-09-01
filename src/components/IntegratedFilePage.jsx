"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash, ImageIcon, FileText, X } from "lucide-react"
import "./IntegratedFilePage.css"
import india from "../assets/india-flag-icon.svg"

function IntegratedFilePage({ files = [], sessionId, onNavigateToPayment }) {
  const canvasRef = useRef(null)

  // Pages and canvas editing
  const [pages, setPages] = useState([{ id: 1, items: [], colorMode: "color" }])
  const [activePage, setActivePage] = useState(1)
  const [draggingFile, setDraggingFile] = useState(null)
  const [draggingItem, setDraggingItem] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedItem, setSelectedItem] = useState(null)

  // PDF preview dialog and settings
  const [showEdgePrintDialog, setShowEdgePrintDialog] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [allPdfPages, setAllPdfPages] = useState([])
  const [edgePrintSettings, setEdgePrintSettings] = useState({
    copies: 1,
    pageRange: "all",
    customPages: "",
    doubleSided: "one-side",
    colorMode: "bw",
  })

  // Print queue for PDFs
  const [printQueue, setPrintQueue] = useState([])

  // Payment and printing
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [printingInProgress, setPrintingInProgress] = useState(false)
  const [printProgress, setPrintProgress] = useState({
    currentJob: "",
    completed: 0,
    total: 0,
    status: "idle",
  })
  const [mobileNumber, setMobileNumber] = useState("")
  const [mobileError, setMobileError] = useState("")

  // File data cache
  const [fileDataCache, setFileDataCache] = useState({})
  const [fileDataReady, setFileDataReady] = useState(false)

  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState("")
  const [clipboardCode, setClipboardCode] = useState("")
  const [showPasteButton, setShowPasteButton] = useState(false)

  // Categorize files
  const fileCategories = {
    images: files.filter((file) => {
      if (file.type) return file.type === "image" || (typeof file.type === "string" && file.type.startsWith("image/"))
      return file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
    }),
    pdfs: files.filter((file) => {
      if (file.type) return file.type === "pdf" || file.type === "application/pdf"
      return file.name.toLowerCase().endsWith(".pdf")
    }),
  }

  // Load PDF.js
  useEffect(() => {
    const loadPDFJS = async () => {
      try {
        if (!window.pdfjsLib) {
          const script = document.createElement("script")
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          }
          document.head.appendChild(script)
        }
      } catch (error) {
        console.error("Error loading PDF.js:", error)
      }
    }
    loadPDFJS()
  }, [])

  // Preload file data
  useEffect(() => {
    let cancelled = false
    const loadFileData = async () => {
      if (!window.electronAPI || files.length === 0) {
        setFileDataReady(true)
        return
      }

      setFileDataReady(false)
      const newCache = {}

      for (const file of files) {
        if (cancelled) break
        try {
          if ((file.type === "image" || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)) && file.localPath) {
            const result = await window.electronAPI.getFileAsBase64(file.localPath)
            if (result.success) {
              newCache[file.name] = {
                type: "image",
                dataUrl: result.dataUrl,
                mimeType: result.mimeType,
                size: result.size,
              }
            }
          } else if ((file.type === "pdf" || /\.pdf$/i.test(file.name)) && file.localPath) {
            const result = await window.electronAPI.getPdfAsBuffer(file.localPath)
            if (result.success) {
              const freshArray = result.buffer.slice()
              newCache[file.name] = {
                type: "pdf",
                size: result.size,
                createFreshBuffer: () => new Uint8Array(freshArray),
              }
            }
          }
        } catch (error) {
          console.error("Error loading file data for", file.name, ":", error)
        }
      }

      if (!cancelled) {
        setFileDataCache(newCache)
        setFileDataReady(true)
      }
    }

    loadFileData()
    return () => {
      cancelled = true
    }
  }, [files])

  // Helper functions
  const getImageDimensions = (file) =>
    new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const maxWidth = 250
        const maxHeight = 250
        const aspect = img.width / img.height
        let width, height
        if (aspect > 1) {
          width = Math.min(maxWidth, img.width)
          height = width / aspect
        } else {
          height = Math.min(maxHeight, img.height)
          width = height * aspect
        }
        resolve({ width: Math.round(width), height: Math.round(height) })
      }
      img.onerror = () => resolve({ width: 150, height: 150 })
      const cachedData = fileDataCache[file.name]
      if (cachedData && cachedData.type === "image") img.src = cachedData.dataUrl
      else resolve({ width: 150, height: 150 })
    })

  const getPDFPageCount = async (file) =>
    new Promise((resolve) => {
      try {
        if (!window.pdfjsLib) return resolve(1)
        const cachedData = fileDataCache[file.name]
        if (cachedData && cachedData.type === "pdf") {
          const freshBuffer = cachedData.createFreshBuffer()
          window.pdfjsLib
            .getDocument({ data: freshBuffer })
            .promise.then((pdf) => resolve(pdf.numPages))
            .catch(() => resolve(1))
        } else {
          resolve(1)
        }
      } catch {
        resolve(1)
      }
    })

  const getFileUrl = (file) => {
    const cachedData = fileDataCache[file.name]
    if (cachedData && cachedData.type === "image") return cachedData.dataUrl
    return "/placeholder.svg"
  }

  const buildCanvasPagesForPrint = () =>
    pages.map((p) => ({
      id: p.id,
      colorMode: p.colorMode,
      items: p.items.map((item) => {
        const f = item.file || {}
        const cached = fileDataCache[f.name]
        return {
          id: item.id,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: item.rotation || 0,
          dataUrl: cached && cached.type === "image" ? cached.dataUrl : undefined,
          file: { name: f.name, localPath: f.localPath || "" },
        }
      }),
    }))

  // UI handlers
  const addNewPage = () => {
    const newPage = { id: pages.length + 1, items: [], colorMode: "color" }
    setPages([...pages, newPage])
    setActivePage(newPage.id)
  }

  const duplicatePage = () => {
    const currentPage = pages.find((page) => page.id === activePage)
    if (!currentPage) return
    const duplicatedItems = currentPage.items.map((item) => ({ ...item, id: `${item.id}-dup-${Date.now()}` }))
    const newPage = { id: pages.length + 1, items: duplicatedItems, colorMode: currentPage.colorMode }
    setPages([...pages, newPage])
    setActivePage(newPage.id)
  }

  const toggleColorMode = (pageId) => {
    setPages(
      pages.map((page) =>
        page.id === pageId ? { ...page, colorMode: page.colorMode === "bw" ? "color" : "bw" } : page,
      ),
    )
  }

  const deletePage = (pageId) => {
    const newPages = pages.filter((page) => page.id !== pageId)
    if (newPages.length > 0) {
      newPages.forEach((page, index) => (page.id = index + 1))
      const pageIndex = pages.findIndex((page) => page.id === pageId)
      const newActivePageId = pageIndex > 0 ? (pageIndex < newPages.length ? pageIndex : 1) : 1
      setActivePage(newActivePageId)
    } else {
      setActivePage(null)
    }
    setPages(newPages)
  }

  // Drag and drop handlers
  const handleDragStart = (file) => setDraggingFile(file)

  const handleItemDragStart = (e, item) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setDraggingItem(item)
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleDragOver = (e) => e.preventDefault()

  const handleDrop = async (e) => {
    e.preventDefault()
    const canvasRect = canvasRef.current.getBoundingClientRect()

    if (draggingFile) {
      let x = e.clientX - canvasRect.left
      let y = e.clientY - canvasRect.top
      const dimensions = await getImageDimensions(draggingFile)
      x = Math.max(0, Math.min(x, 595 - dimensions.width))
      y = Math.max(0, Math.min(y, 842 - dimensions.height))

      setPages(
        pages.map((page) => {
          if (page.id === activePage) {
            return {
              ...page,
                                items: [
                    ...page.items,
                    {
                      id: `${draggingFile.name}-${Date.now()}`,
                      file: draggingFile,
                      x,
                      y,
                      width: dimensions.width,
                      height: dimensions.height,
                      originalWidth: dimensions.width,
                      originalHeight: dimensions.height,
                      rotation: 0,
                    },
                  ],
            }
          }
          return page
        }),
      )
      setDraggingFile(null)
    } else if (draggingItem) {
      let x = e.clientX - canvasRect.left - dragOffset.x
      let y = e.clientY - canvasRect.top - dragOffset.y
      x = Math.max(0, Math.min(x, 595 - draggingItem.width))
      y = Math.max(0, Math.min(y, 842 - draggingItem.height))

      setPages(
        pages.map((page) => {
          if (page.id === activePage) {
            return {
              ...page,
              items: page.items.map((item) => (item.id === draggingItem.id ? { ...item, x, y } : item)),
            }
          }
          return page
        }),
      )
      setDraggingItem(null)
    }
  }

  // PDF dialog handlers
  const handlePDFClick = async (file) => {
    const pageCount = await getPDFPageCount(file)
    setPdfPageCount(pageCount)
    setCurrentPdfFile(file)
    setEdgePrintSettings({
      copies: 1,
      pageRange: "all",
      customPages: "",
      doubleSided: "one-side",
      colorMode: "bw",
    })
    await loadPDFPreview(file)
    setShowEdgePrintDialog(true)
  }

  const loadPDFPreview = async (file) => {
    try {
      if (!window.pdfjsLib) return
      const cachedData = fileDataCache[file.name]
      if (cachedData && cachedData.type === "pdf") {
        const freshBuffer = cachedData.createFreshBuffer()
        const pdf = await window.pdfjsLib.getDocument({ data: freshBuffer }).promise
        const pages = []
        const maxPreviewPages = Math.min(5, pdf.numPages)

        for (let i = 1; i <= maxPreviewPages; i++) {
          const page = await pdf.getPage(i)
          const scale = 1.2
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")
          canvas.height = viewport.height
          canvas.width = viewport.width
          const renderContext = { canvasContext: context, viewport }
          await page.render(renderContext).promise
          pages.push({ canvas, pageNumber: i })
        }
        setAllPdfPages(pages)
      }
    } catch (error) {
      console.error("Error in loadPDFPreview:", error)
    }
  }

  const calculateEdgePrintCost = () => {
    if (!currentPdfFile || pdfPageCount === 0) return 0

    let totalPages = 0
    switch (edgePrintSettings.pageRange) {
      case "all":
        totalPages = pdfPageCount
        break
      case "custom":
        totalPages = calculateCustomPages()
        break
      default:
        totalPages = pdfPageCount
    }

    totalPages *= edgePrintSettings.copies
    const costPerPage = edgePrintSettings.colorMode === "color" ? 10 : 2

    if (edgePrintSettings.doubleSided === "both-sides") {
      if (edgePrintSettings.colorMode === "color") {
        return totalPages * 10
      } else {
        const sheets = Math.ceil(totalPages / 2)
        return sheets * 3
      }
    }
    return totalPages * costPerPage
  }

  const calculateCustomPages = () => {
    if (!edgePrintSettings.customPages.trim()) return 0
    try {
      const ranges = edgePrintSettings.customPages.split(",")
      let totalPages = 0
      ranges.forEach((range) => {
        const trimmed = range.trim()
        if (trimmed.includes("-")) {
          const [start, end] = trimmed.split("-").map((n) => Number.parseInt(n.trim()))
          if (start && end && start <= end && start >= 1 && end <= pdfPageCount) {
            totalPages += end - start + 1
          }
        } else {
          const pageNum = Number.parseInt(trimmed)
          if (pageNum >= 1 && pageNum <= pdfPageCount) totalPages += 1
        }
      })
      return totalPages
    } catch {
      return 0
    }
  }

  const addPDFToQueue = () => {
    if (!currentPdfFile) return

    let pagesToPrint = 0
    switch (edgePrintSettings.pageRange) {
      case "all":
        pagesToPrint = pdfPageCount
        break
      case "custom":
        pagesToPrint = calculateCustomPages()
        break
    }

    const queueItem = {
      id: Date.now(),
      file: currentPdfFile,
      fileName: currentPdfFile.name,
      fileType: "pdf",
      totalPages: pdfPageCount,
      printSettings: { ...edgePrintSettings },
      pagesToPrint,
      cost: calculateEdgePrintCost(),
      timestamp: new Date().toLocaleTimeString(),
    }

    setPrintQueue([...printQueue, queueItem])
    setShowEdgePrintDialog(false)
    setCurrentPdfFile(null)
  }

  const removeFromQueue = (itemId) => setPrintQueue(printQueue.filter((item) => item.id !== itemId))

  const validateCoupon = () => {
    const validCoupons = [
      import.meta.env.VITE_CODE_1 || "4536",
      import.meta.env.VITE_CODE_2 || "0566",
      import.meta.env.VITE_CODE_3 || "8536",
    ]

    const sessionId = localStorage.getItem("currentSessionId") || sessionStorage.getItem("currentSessionId") || ""
    const sessionCouponCode = generateSessionCouponCode(sessionId)
    validCoupons.push(sessionCouponCode)

    console.log("[v0] Validating coupon:", couponCode)
    console.log("[v0] Valid coupons:", validCoupons)
    console.log("[v0] Session ID:", sessionId)
    console.log("[v0] Generated session code:", sessionCouponCode)

    const trimmedCouponCode = couponCode.trim()
    if (validCoupons.includes(trimmedCouponCode)) {
      setAppliedCoupon(trimmedCouponCode)
      setCouponError("")
      console.log("[v0] Coupon validation successful - 10% discount applied")
    } else {
      setCouponError("Invalid coupon code")
      setAppliedCoupon("")
      console.log("[v0] Coupon validation failed")
    }
  }

  const generateSessionCouponCode = (sessionId) => {
    if (!sessionId) {
      console.log("[v0] No session ID found, returning default code")
      return "0000"
    }

    let hash = 0
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    const fourDigitCode = Math.abs(hash % 9000) + 1000
    const codeString = fourDigitCode.toString()
    console.log("[v0] Generated session coupon code:", codeString, "from session:", sessionId)
    return codeString
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.length === 4 && /^\d{4}$/.test(text)) {
        setCouponCode(text)
        setCouponError("")
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err)
    }
  }

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text.length === 4 && /^\d{4}$/.test(text)) {
          setClipboardCode(text)
          setShowPasteButton(true)
        } else {
          setShowPasteButton(false)
        }
      } catch (err) {
        setShowPasteButton(false)
      }
    }

    // Check clipboard periodically
    const interval = setInterval(checkClipboard, 1000)
    return () => clearInterval(interval)
  }, [])

  // Payment and printing
  const calculateTotalCost = () => {
    const baseCost =
      pages.reduce((total, page) => {
        if (page.items.length === 0) return total
        return total + (page.colorMode === "color" ? 10 : 2)
      }, 0) + printQueue.reduce((total, item) => total + item.cost, 0)

    return baseCost
  }

  const calculateDiscountedTotal = () => {
    const originalCost = calculateTotalCost()
    if (appliedCoupon) {
      const discount = Math.round(originalCost * 0.1)
      return { originalCost, discount, finalCost: originalCost - discount }
    }
    return { originalCost, discount: 0, finalCost: originalCost }
  }

  const validateMobileNumber = (number) => /^[6-9]\d{9}$/.test(number)

  const handleMobileNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setMobileNumber(value)
    if (value && !validateMobileNumber(value)) setMobileError("Please enter a valid 10-digit mobile number")
    else setMobileError("")
  }

  // PAYMENT AND SILENT PRINTING WITH USER OPTIONS
  const handlePaymentClick = async () => {
    const totalAmount = calculateDiscountedTotal().finalCost
    if (totalAmount === 0) return

    if (!mobileNumber) {
      setMobileError("Mobile number is required")
      return
    }
    if (!validateMobileNumber(mobileNumber)) {
      setMobileError("Please enter a valid 10-digit mobile number")
      return
    }

    setPaymentProcessing(true)

    try {
      // Load Razorpay
      const loadRazorpayScript = () =>
        new Promise((resolve, reject) => {
          if (window.Razorpay) return resolve(window.Razorpay)
          const script = document.createElement("script")
          script.src = "https://checkout.razorpay.com/v1/checkout.js"
          script.async = true
          const timeout = setTimeout(() => reject(new Error("Razorpay script loading timeout")), 10000)
          script.onload = () => {
            clearTimeout(timeout)
            return window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay object not found"))
          }
          script.onerror = () => reject(new Error("Failed to load Razorpay script"))
          document.head.appendChild(script)
        })

      const Razorpay = await loadRazorpayScript()
      const options = {
        key: "rzp_test_MPGpNqI89C5GgW",
        amount: totalAmount * 100,
        currency: "INR",
        name: "Print Shop",
        description: `Print Job - Session ${sessionId}`,
        handler: (response) => {
          // Start printing with user-selected options after payment
          processAdvancedPrintJobWithUserOptions(response)
        },
        prefill: { name: "Customer", email: "customer@example.com", contact: mobileNumber },
        notes: {
          sessionId,
          canvasPages: pages.length,
          pdfJobs: printQueue.length,
          timestamp: new Date().toISOString(),
          mobileNumber,
        },
        theme: { color: "#000000" },
        modal: {
          ondismiss: () => setPaymentProcessing(false),
          onhidden: () => setPaymentProcessing(false),
        },
        retry: { enabled: true, max_count: 3 },
        timeout: 300,
        remember_customer: false,
      }

      const rzp = new Razorpay(options)
      rzp.on("payment.failed", () => {
        setPaymentProcessing(false)
      })
      rzp.open()
    } catch (error) {
      console.error("Payment init error:", error)
      setPaymentProcessing(false)
    }
  }

  // PROCESS PRINTING WITH EXACT USER OPTIONS
  const processAdvancedPrintJobWithUserOptions = async (paymentResponse) => {
    try {
      setPrintingInProgress(true)
      setPaymentProcessing(false)

      const builtPages = buildCanvasPagesForPrint().filter((p) => p.items.length > 0)
      const totalJobs = builtPages.length + printQueue.length
      let completedJobs = 0

      setPrintProgress({
        currentJob: "Starting silent print jobs...",
        completed: 0,
        total: totalJobs,
        status: "processing",
      })

      console.log("🖨️ Starting SILENT printing to Windows print queue...")
      console.log("📄 Canvas pages:", builtPages.length)
      console.log("📄 PDF jobs:", printQueue.length)

      const printErrors = []

      // 1) Print canvas pages silently
      if (window.electronAPI) {
        for (const page of builtPages) {
          completedJobs++
          setPrintProgress({
            currentJob: `Sending Canvas Page ${page.id} to print queue...`,
            completed: completedJobs,
            total: totalJobs,
            status: "processing",
          })

          try {
            const printResult = await window.electronAPI.printCanvas({
              pageData: page,
              colorMode: page.colorMode,
            })

            if (!printResult?.success) {
              console.error(`❌ Canvas page ${page.id} failed:`, printResult?.error)
              printErrors.push(`Canvas Page ${page.id}`)
            } else {
              console.log(`✅ Canvas page ${page.id} sent to Windows print queue`)
            }
          } catch (e) {
            console.error(`❌ Canvas page ${page.id} error:`, e)
            printErrors.push(`Canvas Page ${page.id}`)
          }

          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      // 2) Print PDFs silently with exact user options
      if (window.electronAPI && printQueue.length > 0) {
        for (const pdfJob of printQueue) {
          completedJobs++
          setPrintProgress({
            currentJob: `Sending PDF to print queue: ${pdfJob.fileName}`,
            completed: completedJobs,
            total: totalJobs,
            status: "processing",
          })

          try {
            let localPath = pdfJob.file?.localPath || ""
            if (localPath && localPath.includes("%")) {
              try {
                localPath = decodeURIComponent(localPath)
              } catch {}
            }

            const printOptions = {
              filePath: localPath,
              copies: pdfJob.printSettings.copies,
              pageRange: pdfJob.printSettings.pageRange,
              customPages: pdfJob.printSettings.customPages,
              colorMode: pdfJob.printSettings.colorMode,
              doubleSided: pdfJob.printSettings.doubleSided,
            }

            const printResult = await window.electronAPI.printPdf(printOptions)

            if (!printResult?.success) {
              console.error(`❌ PDF ${pdfJob.fileName} failed:`, printResult?.error)
              printErrors.push(`PDF ${pdfJob.fileName}`)
            } else {
              console.log(`✅ PDF ${pdfJob.fileName} sent to Windows print queue`)
            }
          } catch (e) {
            console.error(`❌ PDF ${pdfJob.fileName} error:`, e)
            printErrors.push(`PDF ${pdfJob.fileName}`)
          }

          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      setPrintProgress({
        currentJob: printErrors.length
          ? `Completed - ${printErrors.length} jobs failed`
          : "All jobs sent to Windows print queue successfully!",
        completed: totalJobs,
        total: totalJobs,
        status: printErrors.length ? "completed_with_errors" : "completed",
      })

      console.log("🎉 Silent printing completed - Check Windows Print Queue")
      if (printErrors.length > 0) {
        console.log("❌ Failed jobs:", printErrors)
      }

      // Reset for next user
      // setTimeout(() => {
      //   setPages([{ id: 1, items: [], colorMode: "color" }])
      //   setActivePage(1)
      //   setPrintQueue([])
      //   setMobileNumber("")
      //   setPrintingInProgress(false)
      //   setPrintProgress({ currentJob: "", completed: 0, total: 0, status: "idle" })
      // }, 3000)
    } catch (error) {
      console.error("❌ Silent printing failed:", error)
      setPrintingInProgress(false)
      setPaymentProcessing(false)
    }
  }

  // Current page
  const currentPage = pages.find((page) => page.id === activePage) || pages[0]

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (canvasRef.current && !canvasRef.current.contains(e.target)) {
        setSelectedItem(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const [currentView, setCurrentView] = useState("canvas")

  return (
    <div className="integrated-files-page">
      <div className="main-content">
        {/* Left Sidebar: Files and Queue */}
        <div className="sidebar">
          <div className="file-categories">
            <div className="category-header">
              <h3>Categories</h3>
            </div>

            <div className="category">
              <div className="category-title">
                <ImageIcon size={16} />
                <span>Images ({fileCategories.images.length})</span>
              </div>
              <ul className="file-list">
                {fileCategories.images.map((file, index) => {
                  const cachedData = fileDataCache[file.name]
                  return (
                    <li key={index} className="file-item" draggable onDragStart={() => handleDragStart(file)}>
                      <div className="file-preview">
                        {cachedData && cachedData.type === "image" ? (
                          <img
                            src={cachedData.dataUrl || "/placeholder.svg"}
                            alt={file.name}
                            className="thumbnail"
                            onError={(e) => {
                              e.target.src = "/placeholder.svg"
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              background: "#f0f0f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "#666",
                            }}
                          >
                            Loading...
                          </div>
                        )}
                      </div>
                      <div className="file-info">
                        <div className="file-name">
                          {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                        </div>
                        <div className="file-size">{file.size ? (file.size / 1024).toFixed(1) : "0"} KB</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="category">
              <div className="category-title">
                <FileText size={16} />
                <span>PDFs ({fileCategories.pdfs.length})</span>
              </div>
              <ul className="file-list">
                {fileCategories.pdfs.map((file, index) => (
                  <li key={index} className="file-item" onClick={() => handlePDFClick(file)}>
                    <div className="file-icon">
                      <FileText size={20} />
                    </div>
                    <div className="file-info">
                      <div className="file-name">
                        {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                      </div>
                      <div className="file-size">{file.size ? (file.size / 1024).toFixed(1) : "0"} KB</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {printQueue.length > 0 && (
              <div className="print-queue">
                <div className="category-header">
                  <h3>Print Queue ({printQueue.length})</h3>
                </div>
                <ul className="queue-list">
                  {printQueue.map((item) => (
                    <li key={item.id} className="queue-item">
                      <div className="file-icon">
                        <FileText size={20} />
                      </div>
                      <div className="file-info">
                        <div className="file-name">
                          {item.fileName.length > 15 ? `${item.fileName.substring(0, 15)}...` : item.fileName}
                        </div>
                        <div className="file-details">
                          {item.printSettings.copies} copies • {item.printSettings.pageRange} •
                          {item.printSettings.colorMode === "color" ? " Color" : " B&W"} •
                          {item.printSettings.doubleSided === "both-sides" ? " Duplex" : " Single"}
                        </div>
                        <div className="cost-display">₹{item.cost}</div>
                      </div>
                      <button className="remove-button" onClick={() => removeFromQueue(item.id)}>
                        <Trash size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-area">
          <div className="canvas-toolbar">
            <button type="button" className="Add-button" onClick={addNewPage}>
              <span className="button__text">Add Page</span>
              <span className="button__icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  stroke="currentColor"
                  height="20"
                  fill="none"
                  className="svg"
                >
                  <line y2="19" y1="5" x2="12" x1="12"></line>
                  <line y2="12" y1="12" x2="19" x1="5"></line>
                </svg>
              </span>
            </button>

            <button className="Duplicate" onClick={duplicatePage}>
              <span>COPY Page</span>
            </button>

            <button className="delete-button" onClick={() => deletePage(activePage)}>
              <span className="delete-button__text">Delete</span>
              <span className="delete-button__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"></path>
                </svg>
              </span>
            </button>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label className="theme-switch">
                  <input
                    type="checkbox"
                    className="theme-switch__checkbox"
                    id="input"
                    checked={currentPage?.colorMode === "bw"}
                    onChange={() => currentPage && toggleColorMode(activePage)}
                  />
                  <div className="theme-switch__container">
                    <div className="theme-switch__clouds"></div>
                    <div className="theme-switch__stars-container">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 55" fill="none">
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z"
                          fill="currentColor"
                        ></path>
                      </svg>
                    </div>
                    <div className="theme-switch__circle-container">
                      <div className="theme-switch__sun-moon-container">
                        <div className="theme-switch__moon">
                          <div className="theme-switch__spot"></div>
                          <div className="theme-switch__spot"></div>
                          <div className="theme-switch__spot"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
                <span style={{ fontWeight: "500", fontSize: "14px" }}>
                  {currentPage?.colorMode === "color" ? "Color" : "B&W"}
                </span>
              </div>
            </div>
          </div>

          <div className="canvas-container">
            <div className="canvas-background"></div>
            {pages.length > 0 ? (
              <>
                <div className="page-navigation">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      className={`page-button ${page.id === activePage ? "active" : ""}`}
                      onClick={() => setActivePage(page.id)}
                    >
                      {page.id}
                    </button>
                  ))}
                </div>

                <div
                  className={`a4-canvas ${currentPage?.colorMode}`}
                  ref={canvasRef}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => setSelectedItem(null)}
                >
                  {currentPage?.items.map((item) => (
                    <div
                      key={item.id}
                      className={`canvas-item ${selectedItem && selectedItem.id === item.id ? "selected" : ""}`}
                      style={{
                        left: `${item.x}px`,
                        top: `${item.y}px`,
                        width: `${item.width}px`,
                        height: `${item.height}px`,
                        transform: `rotate(${item.rotation}deg)`,
                        border:
                          selectedItem && selectedItem.id === item.id
                            ? `2px solid #000000`
                            : `1px dashed rgba(0,0,0,0.3)`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedItem(item)
                      }}
                      onMouseDown={(e) => {
                        handleItemDragStart(e, item)
                      }}
                    >
                      <div className="canvas-image-container">
                        <div
                          className="canvas-image"
                          data-scale="1"
                          style={{ transform: "scale(1)", transformOrigin: "center center" }}
                        >
                          <img
                            src={getFileUrl(item.file) || "/placeholder.svg"}
                            alt={item.file.name}
                            className="canvas-image-inner"
                            onError={(e) => {
                              e.target.src = "/placeholder.svg"
                            }}
                          />
                        </div>
                      </div>

                      {selectedItem && selectedItem.id === item.id && (
                        <div className="item-controls">
                          {/* Zoom Out */}
                          <button
                            className="item-zoom item-zoom-out"
                            onClick={(e) => {
                              const controls = e.currentTarget.closest(".item-controls")
                              const canvasItem = controls?.closest(".canvas-item")
                              const container = controls?.previousElementSibling
                              const target = container?.querySelector(".canvas-image")
                              if (target && canvasItem) {
                                const current = Number(target.dataset.scale || "1")
                                const next = Math.max(0.2, +(current - 0.1).toFixed(2))
                                target.dataset.scale = String(next)
                                target.style.transform = `scale(${next})`
                                
                                // Update the canvas item size to accommodate the zoomed image
                                const originalWidth = item.width
                                const originalHeight = item.height
                                const newWidth = originalWidth * next
                                const newHeight = originalHeight * next
                                
                                canvasItem.style.width = `${newWidth}px`
                                canvasItem.style.height = `${newHeight}px`
                                
                                // Update the item in state to persist the new dimensions
                                setPages(pages.map(page => {
                                  if (page.id === activePage) {
                                    return {
                                      ...page,
                                      items: page.items.map(i => 
                                        i.id === item.id 
                                          ? { ...i, width: newWidth, height: newHeight }
                                          : i
                                      )
                                    }
                                  }
                                  return page
                                }))
                              }
                            }}
                            aria-label="Zoom out"
                            title="Zoom out"
                            type="button"
                          >
                            <span aria-hidden="true">−</span>
                          </button>

                          {/* Zoom In */}
                          <button
                            className="item-zoom item-zoom-in"
                            onClick={(e) => {
                              const controls = e.currentTarget.closest(".item-controls")
                              const canvasItem = controls?.closest(".canvas-item")
                              const container = controls?.previousElementSibling
                              const target = container?.querySelector(".canvas-image")
                              if (target && canvasItem) {
                                const current = Number(target.dataset.scale || "1")
                                const next = Math.min(3, +(current + 0.1).toFixed(2))
                                target.dataset.scale = String(next)
                                target.style.transform = `scale(${next})`
                                
                                // Update the canvas item size to accommodate the zoomed image
                                const originalWidth = item.width
                                const originalHeight = item.height
                                const newWidth = originalWidth * next
                                const newHeight = originalHeight * next
                                
                                canvasItem.style.width = `${newWidth}px`
                                canvasItem.style.height = `${newHeight}px`
                                
                                // Update the item in state to persist the new dimensions
                                setPages(pages.map(page => {
                                  if (page.id === activePage) {
                                    return {
                                      ...page,
                                      items: page.items.map(i => 
                                        i.id === item.id 
                                          ? { ...i, width: newWidth, height: newHeight }
                                          : i
                                      )
                                    }
                                  }
                                  return page
                                }))
                              }
                            }}
                            aria-label="Zoom in"
                            title="Zoom in"
                            type="button"
                          >
                            <span aria-hidden="true">+</span>
                          </button>

                          {/* Reset Zoom */}
                          <button
                            className="item-reset-zoom"
                            onClick={(e) => {
                              const controls = e.currentTarget.closest(".item-controls")
                              const canvasItem = controls?.closest(".canvas-item")
                              const container = controls?.previousElementSibling
                              const target = container?.querySelector(".canvas-image")
                              if (target && canvasItem) {
                                // Reset to original scale
                                target.dataset.scale = "1"
                                target.style.transform = "scale(1)"
                                
                                // Reset the canvas item size to original dimensions
                                const originalWidth = item.originalWidth || 250
                                const originalHeight = item.originalHeight || 250
                                
                                canvasItem.style.width = `${originalWidth}px`
                                canvasItem.style.height = `${originalHeight}px`
                                
                                // Update the item in state to persist the original dimensions
                                setPages(pages.map(page => {
                                  if (page.id === activePage) {
                                    return {
                                      ...page,
                                      items: page.items.map(i => 
                                        i.id === item.id 
                                          ? { ...i, width: originalWidth, height: originalHeight }
                                          : i
                                      )
                                    }
                                  }
                                  return page
                                }))
                              }
                            }}
                            aria-label="Reset zoom"
                            title="Reset zoom"
                            type="button"
                          >
                            <span aria-hidden="true">⟲</span>
                          </button>

                          {/* Existing delete button - unchanged */}
                          <button
                            className="item-delete"
                            onClick={() => {
                              setPages(
                                pages.map((page) => {
                                  if (page.id === activePage) {
                                    return { ...page, items: page.items.filter((i) => i.id !== item.id) }
                                  }
                                  return page
                                }),
                              )
                              setSelectedItem(null)
                            }}
                            type="button"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-pages-message">
                <div className="no-pages-content">
                  <FileText size={40} />
                  <h3>No Canvas Pages</h3>
                  <p>Add a canvas page to start designing</p>
                  <button className="toolbar-button" onClick={addNewPage}>
                    <Plus size={14} />
                    <span>Add Canvas Page</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Cost + Payment + Print Queue */}
        <div className="right-sidebar">
          <div className="cost-summary">
            <h4>Cost Summary</h4>
            <div className="cost-details">
              {pages.length > 0 && (
                <div className="cost-section">
                  <h5>Canvas Pages</h5>
                  {pages.map((page) => {
                    if (page.items.length === 0) return null
                    return (
                      <div key={page.id} className="cost-item">
                        <span>
                          Page {page.id} ({page.colorMode === "color" ? "Color" : "B&W"})
                        </span>
                        <span>₹{page.colorMode === "color" ? 10 : 2}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {printQueue.length > 0 && (
                <div className="cost-section">
                  <h5>PDF Documents</h5>
                  {printQueue.map((item) => (
                    <div key={item.id} className="cost-item">
                      <span>
                        {item.fileName.substring(0, 18)}
                        {item.fileName.length > 18 ? "..." : ""} ({item.printSettings.copies} copies)
                      </span>
                      <span>₹{item.cost}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="total-cost">
                <span>Total Cost:</span>
                <span>₹{calculateTotalCost()}</span>
              </div>
            </div>
          </div>

          <div className="coupon-section">
            <div className="coupon-input-container">
              <input
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value)
                  setCouponError("")
                }}
                className="coupon-input"
                maxLength={4}
              />
              <div className="coupon-buttons">
                {showPasteButton && (
                  <button onClick={handlePaste} className="paste-coupon-btn">
                    Paste
                  </button>
                )}
                <button onClick={validateCoupon} className="apply-coupon-btn" disabled={!couponCode}>
                  Apply
                </button>
              </div>
            </div>
            <div className="coupon-message-container">
              {couponError && <div className="coupon-error">{couponError}</div>}
              {appliedCoupon && <div className="coupon-success">Coupon applied successfully 🎉🎊</div>}
            </div>
          </div>

          <div className="payment-floating-container">
            <div className="payment-box">
              <div className="payment-summary">
                {appliedCoupon ? (
                  <>
                    <div className="payment-breakdown">
                      <div className="payment-line">
                        <span>Cost Estimated:</span>
                        <span>₹{calculateDiscountedTotal().originalCost}</span>
                      </div>
                      <div className="payment-line discount">
                        <span>Discount (10%):</span>
                        <span>-₹{calculateDiscountedTotal().discount}</span>
                      </div>
                      <div className="payment-total">
                        <span>Total Pay:</span>
                        <span>₹{calculateDiscountedTotal().finalCost}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="payment-total">
                    <span>Total Pay:</span>
                    <span>₹{calculateTotalCost()}</span>
                  </div>
                )}
              </div>

              <div className="mobile-input-section">
                <label className="mobile-input-label" htmlFor="mobile-number">
                  MOBILE NUMBER
                </label>
                <div className="mobile-input-wrapper">
                  <div className="mobile-prefix">
                    <img src={india} alt="India" className="country-flag" />
                    <span className="dial-code">+91</span>
                  </div>
                  <input
                    id="mobile-number"  
                    type="tel"
                    className={`mobile-input ${mobileError ? "error" : ""}`}
                    placeholder="Enter mobile number"
                    value={mobileNumber}
                    onChange={handleMobileNumberChange}
                    maxLength={10}
                  />
                </div>
              </div>
              {mobileError && <div className="mobile-error">{mobileError}</div>}
            </div>

            <button
              className="payment-button"
              onClick={handlePaymentClick}
              disabled={calculateTotalCost() === 0 || paymentProcessing || !mobileNumber || printingInProgress}
            >
              <span className="btn-text">
                {printingInProgress ? "Printing..." : paymentProcessing ? "Loading Payment..." : "Pay Now"}
              </span>
            </button>

            {(paymentProcessing || printingInProgress) && (
              <div className="payment-processing">
                {printingInProgress && printProgress.status !== "idle" && (
                  <div className="print-progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "#f0f0f0",
                        borderRadius: "2px",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundColor:
                            printProgress.status === "completed"
                              ? "#28a745"
                              : printProgress.status === "completed_with_errors"
                                ? "#ffc107"
                                : "#007bff",
                          borderRadius: "2px",
                          transition: "width 0.3s ease",
                        }}
                      ></div>
                    </div>
                    <div className="progress-text" style={{ fontSize: "12px", color: "#666" }}>
                      {printProgress.currentJob} ({printProgress.completed}/{printProgress.total})
                    </div>
                  </div>
                )}
                <p style={{ textAlign: "center", marginTop: "10px", color: "#666", fontSize: "14px" }}>
                  {printingInProgress
                    ? "Printing with your selected options..."
                    : "Loading Razorpay payment gateway..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {!paymentProcessing &&
        (printProgress.status === "completed" || printProgress.status === "completed_with_errors") && (
          <section className="feedback-bar" role="region" aria-label="Feedback">
            <div className="feedback-content">
              <h3 className="feedback-title">Give feedback</h3>
              <p className="feedback-subtitle">How was your printing experience?</p>
              <div className="feedback-emojis" role="group" aria-label="Rate your experience">
                <button className="emoji-option" type="button" aria-label="Terrible">
                  😞
                </button>
                <button className="emoji-option" type="button" aria-label="Bad">
                  😕
                </button>
                <button className="emoji-option" type="button" aria-label="Okay">
                  🙂
                </button>
                <button className="emoji-option" type="button" aria-label="Good">
                  😄
                </button>
                <button className="emoji-option" type="button" aria-label="Amazing">
                  🤩
                </button>
              </div>
              {/* Submit as a link to reload or return to initial stage without JS changes */}
              <form className="feedback-form" method="GET" action=".">
                <button className="feedback-submit" type="submit">
                  Submit
                </button>
              </form>
            </div>
          </section>
        )}

      {/* PDF Print Settings Dialog */}
      {showEdgePrintDialog && (
        <div className="print-modal">
          <div className="edge-print-dialog">
            <div className="print-dialog-left">
              <div className="print-dialog-header">
                <h2>PDF Print Settings</h2>
                <button className="close-dialog" onClick={() => setShowEdgePrintDialog(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="print-info">
                <p className="total-sheets">Total: {pdfPageCount} pages</p>
              </div>

              <div className="print-options-section">
                <div className="print-option-group">
                  <label className="print-option-label">Copies</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={edgePrintSettings.copies}
                    onChange={(e) =>
                      setEdgePrintSettings({ ...edgePrintSettings, copies: Number.parseInt(e.target.value) || 1 })
                    }
                    className="print-input"
                  />
                </div>

                <div className="print-option-group">
                  <label className="print-option-label">Pages</label>
                  <div className="radio-options">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="pageRange"
                        value="all"
                        checked={edgePrintSettings.pageRange === "all"}
                        onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, pageRange: e.target.value })}
                      />
                      <span>All</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="pageRange"
                        value="custom"
                        checked={edgePrintSettings.pageRange === "custom"}
                        onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, pageRange: e.target.value })}
                      />
                      <span>Custom</span>
                    </label>
                  </div>
                  {edgePrintSettings.pageRange === "custom" && (
                    <input
                      type="text"
                      placeholder="e.g. 1-5, 8, 11-13"
                      value={edgePrintSettings.customPages}
                      onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, customPages: e.target.value })}
                      className="print-input custom-pages-input"
                    />
                  )}
                </div>

                <div className="print-option-group">
                  <label className="print-option-label">Color Mode</label>
                  <select
                    value={edgePrintSettings.colorMode}
                    onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, colorMode: e.target.value })}
                    className="print-select"
                  >
                    <option value="bw">Black & White</option>
                    <option value="color">Color</option>
                  </select>
                </div>

                <div className="print-option-group">
                  <label className="print-option-label">Duplex</label>
                  <select
                    value={edgePrintSettings.doubleSided}
                    onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, doubleSided: e.target.value })}
                    className="print-select"
                  >
                    <option value="one-side">Print one-sided</option>
                    <option value="both-sides">Print on both sides</option>
                  </select>
                </div>

                <div className="cost-display-section">
                  <div className="cost-breakdown">
                    <h4>Cost: ₹{calculateEdgePrintCost()}</h4>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      These settings will be applied exactly as selected
                    </div>
                  </div>
                </div>
              </div>

              <div className="print-dialog-actions">
                <button className="cancel-btn" onClick={() => setShowEdgePrintDialog(false)}>
                  Cancel
                </button>
                <button className="add-to-queue-btn" onClick={addPDFToQueue} disabled={calculateEdgePrintCost() === 0}>
                  Add to Queue
                </button>
              </div>
            </div>

            <div className="print-dialog-right">
              <div className="pdf-preview-section">
                <h3>Preview</h3>
                <div className="pdf-preview-container">
                  {allPdfPages.length > 0 ? (
                    <div className="pdf-pages-preview">
                      {allPdfPages.slice(0, 2).map((page, index) => (
                        <div key={index} className="pdf-page-preview">
                          <div className="page-number">Page {page.pageNumber}</div>
                          <canvas
                            ref={(canvas) => {
                              if (canvas && page.canvas) {
                                const ctx = canvas.getContext("2d")
                                canvas.width = page.canvas.width * 0.8
                                canvas.height = page.canvas.height * 0.8
                                ctx.scale(0.8, 0.8)
                                ctx.drawImage(page.canvas, 0, 0)
                                if (edgePrintSettings.colorMode === "bw") canvas.style.filter = "grayscale(100%)"
                                else canvas.style.filter = "none"
                              }
                            }}
                            className="preview-canvas"
                          />
                        </div>
                      ))}
                      {allPdfPages.length > 2 && (
                        <div className="more-pages-indicator">+{allPdfPages.length - 2} more pages</div>
                      )}
                    </div>
                  ) : (
                    <div className="loading-preview">
                      <p>Loading PDF preview...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IntegratedFilePage
