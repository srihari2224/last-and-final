"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash, ImageIcon, FileText, X, Printer, CheckCircle, AlertCircle } from 'lucide-react'
import "./IntegratedFilePage.css"

function IntegratedFilePage({ files = [], sessionId, onNavigateToPayment }) {
  const canvasRef = useRef(null)

  // State for managing pages
  const [pages, setPages] = useState([{ id: 1, items: [], colorMode: "color" }])
  const [activePage, setActivePage] = useState(1)
  const [draggingFile, setDraggingFile] = useState(null)
  const [draggingItem, setDraggingItem] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // State for image editing
  const [selectedItem, setSelectedItem] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  const [cropEnd, setCropEnd] = useState({ x: 0, y: 0 })

  // PDF viewer state
  const [pdfDoc, setPdfDoc] = useState(null)
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [allPdfPages, setAllPdfPages] = useState([])

  // Microsoft Edge style print dialog state
  const [showEdgePrintDialog, setShowEdgePrintDialog] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [edgePrintSettings, setEdgePrintSettings] = useState({
    copies: 1,
    pageRange: "all",
    customPages: "",
    doubleSided: "one-side",
    colorMode: "bw",
  })

  // Print queue state
  const [printQueue, setPrintQueue] = useState([])

  // Payment state - ENHANCED WITH MOBILE NUMBER
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [mobileNumber, setMobileNumber] = useState("")
  const [mobileError, setMobileError] = useState("")

  // NEW: File data cache
  const [fileDataCache, setFileDataCache] = useState({})

  // ENHANCED: Printing state with progress tracking
  const [printingInProgress, setPrintingInProgress] = useState(false)
  const [printProgress, setPrintProgress] = useState({
    currentJob: '',
    completed: 0,
    total: 0,
    status: 'idle'
  })
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [selectedPrinter, setSelectedPrinter] = useState(null)
  const [printerStatus, setPrinterStatus] = useState({})

  // Group files by type (only images and PDFs) - USING LOCAL FILES
  const fileCategories = {
    images: files.filter((file) => {
      if (file.type) return file.type === 'image' || file.type.startsWith("image/")
      return file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
    }),
    pdfs: files.filter((file) => {
      if (file.type) return file.type === 'pdf' || file.type === "application/pdf"
      return file.name.toLowerCase().endsWith(".pdf")
    }),
  }

  // Initialize PDF.js
  useEffect(() => {
    const loadPDFJS = async () => {
      try {
        if (!window.pdfjsLib) {
          console.log("Loading PDF.js...")
          const script = document.createElement("script")
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
            console.log("PDF.js loaded successfully")
          }
          script.onerror = () => console.error("Failed to load PDF.js")
          document.head.appendChild(script)
        }
      } catch (error) {
        console.error("Error loading PDF.js:", error)
      }
    }
    loadPDFJS()
  }, [])

  // ENHANCED: Load printer information on component mount
  useEffect(() => {
    const loadEnhancedPrinterInfo = async () => {
      if (window.electronAPI) {
        try {
          console.log('🖨️ Loading enhanced printer information...')
          const result = await window.electronAPI.getEnhancedPrinterInfo()
          
          if (result.success) {
            setAvailablePrinters(result.printers)
            setSelectedPrinter(result.defaultPrinter)
            console.log('✅ Enhanced printer info loaded:', result.printers.length, 'printers')
            
            // Test connectivity for default printer
            if (result.defaultPrinter) {
              testPrinterConnectivity(result.defaultPrinter.name)
            }
          } else {
            console.error('❌ Failed to load printer info:', result.error)
          }
        } catch (error) {
          console.error('❌ Error loading enhanced printer info:', error)
        }
      }
    }
    loadEnhancedPrinterInfo()
  }, [])

  // Test printer connectivity
  const testPrinterConnectivity = async (printerName) => {
    if (!window.electronAPI) return
    
    try {
      console.log(`🔍 Testing connectivity for: ${printerName}`)
      const result = await window.electronAPI.testPrinterConnectivity(printerName)
      
      setPrinterStatus(prev => ({
        ...prev,
        [printerName]: {
          online: result.online,
          status: result.status,
          message: result.message,
          lastChecked: new Date().toISOString()
        }
      }))
      
      console.log(`✅ Printer status updated for ${printerName}:`, result)
    } catch (error) {
      console.error(`❌ Error testing printer connectivity for ${printerName}:`, error)
      setPrinterStatus(prev => ({
        ...prev,
        [printerName]: {
          online: false,
          status: 'error',
          message: 'Connection test failed',
          lastChecked: new Date().toISOString()
        }
      }))
    }
  }

  // NEW: Load file data when files change - FIXED PDF BUFFER HANDLING
  useEffect(() => {
    const loadFileData = async () => {
      if (!window.electronAPI || files.length === 0) return

      console.log("🔄 Loading file data for", files.length, "files")
      const newCache = {}

      for (const file of files) {
        try {
          if (file.type === 'image' && file.localPath) {
            console.log("📸 Loading image data for:", file.name)
            const result = await window.electronAPI.getFileAsBase64(file.localPath)
            if (result.success) {
              newCache[file.name] = {
                type: 'image',
                dataUrl: result.dataUrl,
                mimeType: result.mimeType,
                size: result.size
              }
              console.log("✅ Image data loaded for:", file.name)
            } else {
              console.error("❌ Failed to load image data:", result.error)
            }
          } else if (file.type === 'pdf' && file.localPath) {
            console.log("📄 Loading PDF data for:", file.name)
            const result = await window.electronAPI.getPdfAsBuffer(file.localPath)
            if (result.success) {
              // Create a fresh Uint8Array from the transferred array data
              const uint8Array = new Uint8Array(result.buffer)
              newCache[file.name] = {
                type: 'pdf',
                buffer: uint8Array,
                size: result.size,
                // Store a function to create fresh copies
                createFreshBuffer: () => new Uint8Array(result.buffer)
              }
              console.log("✅ PDF data loaded for:", file.name)
            } else {
              console.error("❌ Failed to load PDF data:", result.error)
            }
          }
        } catch (error) {
          console.error("❌ Error loading file data for", file.name, ":", error)
        }
      }

      setFileDataCache(newCache)
      console.log("✅ File data cache updated with", Object.keys(newCache).length, "files")
    }

    loadFileData()
  }, [files])

  // Function to get image dimensions - FIXED FOR BASE64 DATA
  const getImageDimensions = (file) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const maxWidth = 250
        const maxHeight = 250
        const aspectRatio = img.width / img.height

        let width, height
        if (aspectRatio > 1) {
          width = Math.min(maxWidth, img.width)
          height = width / aspectRatio
        } else {
          height = Math.min(maxHeight, img.height)
          width = height * aspectRatio
        }

        resolve({ width: Math.round(width), height: Math.round(height) })
      }
      img.onerror = () => {
        console.error("Error loading image for dimensions:", file.name)
        resolve({ width: 150, height: 150 })
      }

      // Use cached base64 data
      const cachedData = fileDataCache[file.name]
      if (cachedData && cachedData.type === 'image') {
        img.src = cachedData.dataUrl
      } else {
        console.warn("No cached data for image:", file.name)
        resolve({ width: 150, height: 150 })
      }
    })
  }

  // Function to get PDF page count - FIXED FOR FRESH BUFFER
  const getPDFPageCount = async (file) => {
    return new Promise((resolve) => {
      try {
        if (!window.pdfjsLib) {
          console.warn("PDF.js not available")
          resolve(1)
          return
        }

        const cachedData = fileDataCache[file.name]
        if (cachedData && cachedData.type === 'pdf') {
          console.log("📄 Getting PDF page count from cached buffer:", file.name)
        
          // Create a fresh buffer copy to prevent detached buffer issues
          const freshBuffer = cachedData.createFreshBuffer()
        
          window.pdfjsLib.getDocument({ data: freshBuffer }).promise
            .then((pdf) => {
              console.log("✅ PDF page count:", pdf.numPages)
              resolve(pdf.numPages)
            })
            .catch((error) => {
              console.error("❌ Error getting PDF page count:", error)
              resolve(1)
            })
      } else {
        console.warn("No cached PDF data for:", file.name)
        resolve(1)
      }
    } catch (error) {
      console.error("Error in getPDFPageCount:", error)
      resolve(1)
    }
  })
}

// Load PDF for preview - FIXED FOR FRESH BUFFER
const loadPDFPreview = async (file) => {
  try {
    if (!window.pdfjsLib) {
      console.log("PDF.js not available")
      return
    }

    console.log("📄 Loading PDF preview for:", file.name)

    const cachedData = fileDataCache[file.name]
    if (cachedData && cachedData.type === 'pdf') {
      console.log("📁 Loading PDF from cached buffer")
      
      // Create a fresh buffer copy to prevent detached buffer issues
      const freshBuffer = cachedData.createFreshBuffer()
      
      const pdf = await window.pdfjsLib.getDocument({ data: freshBuffer }).promise
      setPdfDoc(pdf)
      setCurrentPdfPage(1)

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

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        await page.render(renderContext).promise
        pages.push({ canvas, pageNumber: i })
      }

      setAllPdfPages(pages)
      console.log("✅ PDF preview loaded successfully")
    } else {
      console.error("❌ No cached PDF data available for:", file.name)
    }
  } catch (error) {
    console.error("❌ Error in loadPDFPreview:", error)
  }
}

  // Show Microsoft Edge style print dialog when PDF is clicked
  const handlePDFClick = async (file) => {
    console.log("🖨️ Opening Edge-style print dialog for:", file.name)

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

  // Calculate cost based on Edge print settings
  const calculateEdgePrintCost = () => {
    if (!currentPdfFile || pdfPageCount === 0) return 0

    let totalPages = 0

    switch (edgePrintSettings.pageRange) {
      case "all":
        totalPages = pdfPageCount
        break
      case "odd":
        totalPages = Math.ceil(pdfPageCount / 2)
        break
      case "even":
        totalPages = Math.floor(pdfPageCount / 2)
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

  // Calculate custom pages count
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
          if (pageNum >= 1 && pageNum <= pdfPageCount) {
            totalPages += 1
          }
        }
      })

      return totalPages
    } catch (error) {
      return 0
    }
  }

  // Add PDF to print queue
  const addPDFToQueue = () => {
    if (!currentPdfFile) return

    let pagesToPrint = 0

    switch (edgePrintSettings.pageRange) {
      case "all":
        pagesToPrint = pdfPageCount
        break
      case "odd":
        pagesToPrint = Math.ceil(pdfPageCount / 2)
        break
      case "even":
        pagesToPrint = Math.floor(pdfPageCount / 2)
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
      pagesToPrint: pagesToPrint,
      cost: calculateEdgePrintCost(),
      timestamp: new Date().toLocaleTimeString(),
    }

    setPrintQueue([...printQueue, queueItem])
    setShowEdgePrintDialog(false)
    setCurrentPdfFile(null)

    console.log("✅ Added PDF to queue:", queueItem)
  }

  // Remove item from queue
  const removeFromQueue = (itemId) => {
    setPrintQueue(printQueue.filter((item) => item.id !== itemId))
  }

  // Handle adding a new canvas page
  const addNewPage = () => {
    const newPage = {
      id: pages.length + 1,
      items: [],
      colorMode: "color",
    }
    setPages([...pages, newPage])
    setActivePage(newPage.id)
  }

  // Handle duplicating a page
  const duplicatePage = () => {
    const currentPage = pages.find((page) => page.id === activePage)
    if (!currentPage) return

    const duplicatedItems = currentPage.items.map((item) => ({
      ...item,
      id: `${item.id}-dup-${Date.now()}`,
    }))

    const newPage = {
      id: pages.length + 1,
      items: duplicatedItems,
      colorMode: currentPage.colorMode,
    }

    setPages([...pages, newPage])
    setActivePage(newPage.id)
  }

  // Handle toggling color mode
  const toggleColorMode = (pageId) => {
    setPages(
      pages.map((page) =>
        page.id === pageId ? { ...page, colorMode: page.colorMode === "bw" ? "color" : "bw" } : page,
      ),
    )
  }

// Handle deleting a page
const deletePage = (pageId) => {
  const newPages = pages.filter((page) => page.id !== pageId)
  if (newPages.length > 0) {
    newPages.forEach((page, index) => {
      page.id = index + 1
    })
    const pageIndex = pages.findIndex((page) => page.id === pageId)
    const newActivePageId =
      pageIndex > 0 ? (pageIndex < newPages.length ? pageIndex : newPages.length > 0 ? 1 : 1) : 1
    setActivePage(newActivePageId)
  } else {
    setActivePage(null)
  }
  setPages(newPages)
}

  // Handle drag start for files
  const handleDragStart = (file) => {
    setDraggingFile(file)
  }

  // Handle drag start for canvas items
  const handleItemDragStart = (e, item) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setDraggingItem(item)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault()
  }

  // Handle drop on canvas
  const handleDrop = async (e) => {
    e.preventDefault()
    const canvasRect = canvasRef.current.getBoundingClientRect()

    if (draggingFile) {
      let x = e.clientX - canvasRect.left
      let y = e.clientY - canvasRect.top

      const dimensions = await getImageDimensions(draggingFile)

      // Adjust for compressed canvas size
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
                  rotation: 0,
                  crop: null,
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
              items: page.items.map((item) => {
                if (item.id === draggingItem.id) {
                  return { ...item, x, y }
                }
                return item
              }),
            }
          }
          return page
        }),
      )
      setDraggingItem(null)
    }
  }

  // Calculate total cost
  const calculateTotalCost = () => {
    let totalCost = 0

    pages.forEach((page) => {
      totalCost += page.colorMode === "color" ? 10 : 2
    })

    printQueue.forEach((item) => {
      totalCost += item.cost
    })

    return totalCost
  }

  // Validate mobile number
  const validateMobileNumber = (number) => {
    const mobileRegex = /^[6-9]\d{9}$/
    return mobileRegex.test(number)
  }

  // Handle mobile number change
  const handleMobileNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10)
    setMobileNumber(value)
    
    if (value && !validateMobileNumber(value)) {
      setMobileError("Please enter a valid 10-digit mobile number")
    } else {
      setMobileError("")
    }
  }

  // Handle payment button click - ENHANCED WITH MOBILE NUMBER AND SMS INVOICE
  const handlePaymentClick = async () => {
    const totalAmount = calculateTotalCost()
    if (totalAmount === 0) return

    // Validate mobile number
    if (!mobileNumber) {
      setMobileError("Mobile number is required")
      return
    }

    if (!validateMobileNumber(mobileNumber)) {
      setMobileError("Please enter a valid 10-digit mobile number")
      return
    }

    // ENHANCED: Check printer connectivity before payment
    if (selectedPrinter && window.electronAPI) {
      try {
        const connectivityResult = await window.electronAPI.testPrinterConnectivity(selectedPrinter.name)
        if (!connectivityResult.online) {
          const proceed = confirm(`Warning: Selected printer "${selectedPrinter.displayName}" appears to be offline. Do you want to proceed with payment anyway?`)
          if (!proceed) return
        }
      } catch (error) {
        console.warn('Could not test printer connectivity:', error)
      }
    }

    console.log("💳 Starting direct Razorpay payment for ₹", totalAmount)
    console.log("📱 Mobile number:", mobileNumber)
    console.log("🖨️ Selected printer:", selectedPrinter?.displayName || 'Default')
    setPaymentProcessing(true)

    try {
      // Load Razorpay script
      console.log("📜 Loading Razorpay script...")
      const loadRazorpayScript = () => {
        return new Promise((resolve, reject) => {
          if (window.Razorpay) {
            resolve(window.Razorpay)
            return
          }

          const script = document.createElement("script")
          script.src = "https://checkout.razorpay.com/v1/checkout.js"
          script.async = true
          
          script.onload = () => {
            if (window.Razorpay) {
              console.log("✅ Razorpay script loaded successfully")
              resolve(window.Razorpay)
            } else {
              reject(new Error("Razorpay object not found after script load"))
            }
          }
          
          script.onerror = () => {
            reject(new Error("Failed to load Razorpay script. Please check your internet connection."))
          }

          // Set timeout for script loading
          setTimeout(() => {
            if (!window.Razorpay) {
              reject(new Error("Razorpay script loading timeout"))
            }
          }, 10000)

          document.head.appendChild(script)
        })
      }

      const Razorpay = await loadRazorpayScript()

      // DIRECT PAYMENT WITHOUT ORDER - ENHANCED WITH MOBILE
      const options = {
        key: "rzp_test_MPGpNqI89C5GgW", // Your Razorpay key
        amount: totalAmount * 100, // Amount in paise
        currency: "INR",
        name: "Print Shop",
        description: `Print Job - Session ${sessionId}`,
        image: "/placeholder.svg?height=100&width=100&text=Print", // Optional logo
        handler: function (response) {
          console.log("✅ Payment successful:", response)
          console.log("Payment ID:", response.razorpay_payment_id)
          
          // Process the print job and send SMS invoice
          processAdvancedPrintJobWithInvoice(response)
        },
        prefill: {
          name: "Customer",
          email: "customer@example.com",
          contact: mobileNumber, // Use the entered mobile number
        },
        notes: {
          sessionId: sessionId,
          canvasPages: pages.length,
          pdfJobs: printQueue.length,
          timestamp: new Date().toISOString(),
          mobileNumber: mobileNumber,
          printerName: selectedPrinter?.name || 'default'
        },
        theme: {
          color: "#000000",
        },
        modal: {
          ondismiss: function () {
            console.log("❌ Payment cancelled by user")
            setPaymentProcessing(false)
          },
          onhidden: function () {
            console.log("🔒 Payment modal closed")
            setPaymentProcessing(false)
          },
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
        timeout: 300, // 5 minutes timeout
        remember_customer: false,
      }

      console.log("🚀 Opening Razorpay checkout with options:", options)
      const rzp = new Razorpay(options)
      
      // Handle payment failure
      rzp.on('payment.failed', function (response) {
        console.error("❌ Payment failed:", response.error)
        alert(`Payment failed: ${response.error.description || 'Unknown error occurred'}`)
        setPaymentProcessing(false)
      })

      // Open the payment modal
      rzp.open()

    } catch (error) {
      console.error("❌ Error in payment initialization:", error)
      
      let errorMessage = "Payment initialization failed. Please try again."
      
      if (error.message.includes("Razorpay script")) {
        errorMessage = "Unable to load payment gateway. Please check your internet connection and try again."
      } else if (error.message.includes("timeout")) {
        errorMessage = "Payment gateway is taking too long to load. Please try again."
      }
      
      alert(errorMessage)
      setPaymentProcessing(false)
    }
  }

  // ENHANCED: ADVANCED SILENT PRINTING IMPLEMENTATION - Process print job after successful payment
  const processAdvancedPrintJobWithInvoice = async (paymentResponse) => {
    console.log("🖨️ Processing advanced print job after payment:", paymentResponse)
    
    try {
      // Show success message immediately
      alert("Payment successful! Your print job is being processed...")
      
      // Start printing process
      setPrintingInProgress(true)
      
      // Calculate total jobs for progress tracking
      const totalJobs = pages.length + printQueue.length
      let completedJobs = 0
      
      console.log(`📊 Total print jobs to process: ${totalJobs} (${pages.length} canvas pages + ${printQueue.length} PDF jobs)`)
      
      setPrintProgress({
        currentJob: 'Initializing print jobs...',
        completed: 0,
        total: totalJobs,
        status: 'processing'
      })
      
      // Prepare invoice data
      const invoiceItems = []
      
      // Add canvas pages to invoice
      pages.forEach((page) => {
        invoiceItems.push({
          type: 'canvas',
          description: `Canvas Page ${page.id} (${page.colorMode === 'color' ? 'Color' : 'B&W'})`,
          cost: page.colorMode === 'color' ? 10 : 2
        })
      })
      
      // Add PDF jobs to invoice
      printQueue.forEach((pdfJob) => {
        invoiceItems.push({
          type: 'pdf',
          description: `${pdfJob.fileName} (${pdfJob.printSettings.copies} copies, ${pdfJob.printSettings.colorMode === 'color' ? 'Color' : 'B&W'}, ${pdfJob.printSettings.doubleSided === 'both-sides' ? 'Duplex' : 'Single-sided'})`,
          cost: pdfJob.cost
        })
      })

      // Send SMS invoice if in Electron
      if (window.electronAPI) {
        try {
          const invoiceData = {
            phoneNumber: mobileNumber,
            amount: calculateTotalCost(),
            paymentId: paymentResponse.razorpay_payment_id,
            sessionId: sessionId,
            items: invoiceItems,
            printerName: selectedPrinter?.displayName || 'Default Printer'
          }
          
          const smsResult = await window.electronAPI.sendSmsInvoice(invoiceData)
          
          if (smsResult.success) {
            console.log("✅ SMS invoice sent successfully")
          } else {
            console.warn("⚠️ SMS invoice failed:", smsResult.error)
          }
        } catch (smsError) {
          console.error("❌ Error sending SMS invoice:", smsError)
        }
      }
      
      // ENHANCED SILENT PRINTING WITH PROPER ERROR HANDLING
      if (window.electronAPI && selectedPrinter) {
        console.log("🖨️ Starting enhanced silent printing process...")
        console.log(`🎯 Using printer: ${selectedPrinter.name} (${selectedPrinter.displayName})`)
        
        let printErrors = []
        const printerName = selectedPrinter.name // Use the actual printer name, not displayName
        
        // Verify printer is available before starting
        try {
          console.log(`🔍 Verifying printer availability: ${printerName}`)
          const connectivityTest = await window.electronAPI.testPrinterConnectivity(printerName)
          console.log(`📊 Printer connectivity result:`, connectivityTest)
          
          if (!connectivityTest.success || !connectivityTest.online) {
            console.warn(`⚠️ Printer may be offline: ${connectivityTest.message}`)
            // Continue anyway but warn user
          }
        } catch (connectivityError) {
          console.warn(`⚠️ Could not test printer connectivity:`, connectivityError)
        }
        
        // 1. Process Canvas Pages with Enhanced Error Handling
        if (pages.length > 0) {
          console.log(`🖨️ Processing ${pages.length} canvas pages...`)
          
          for (const page of pages) {
            try {
              completedJobs++
              setPrintProgress({
                currentJob: `Printing Canvas Page ${page.id} (${page.colorMode})`,
                completed: completedJobs,
                total: totalJobs,
                status: 'processing'
              })
              
              console.log(`🖨️ Printing canvas page ${page.id} (${page.colorMode}) to ${printerName}`)
              
              // Validate page has items
              if (!page.items || page.items.length === 0) {
                console.warn(`⚠️ Canvas page ${page.id} has no items, skipping...`)
                continue
              }
              
              const canvasData = {
                pageData: page,
                colorMode: page.colorMode,
                printerName: printerName,
                silent: true
              }
              
              console.log(`📤 Sending canvas print request:`, canvasData)
              const printResult = await window.electronAPI.advancedCanvasPrint(canvasData)
              console.log(`📥 Canvas print result:`, printResult)
              
              if (printResult.success) {
                console.log(`✅ Canvas page ${page.id} printed successfully using ${printResult.method}`)
              } else {
                console.error(`❌ Failed to print canvas page ${page.id}:`, printResult.error)
                printErrors.push(`Canvas Page ${page.id}: ${printResult.error}`)
              }
              
              // Delay between prints to avoid overwhelming the printer
              await new Promise(resolve => setTimeout(resolve, 2000))
              
            } catch (error) {
              console.error(`❌ Error printing canvas page ${page.id}:`, error)
              printErrors.push(`Canvas Page ${page.id}: ${error.message}`)
            }
          }
        }

        // 2. Process PDF Queue with Enhanced Error Handling
        if (printQueue.length > 0) {
          console.log(`🖨️ Processing ${printQueue.length} PDF jobs...`)
          
          for (const pdfJob of printQueue) {
            try {
              completedJobs++
              setPrintProgress({
                currentJob: `Printing PDF: ${pdfJob.fileName} (${pdfJob.printSettings.copies} copies)`,
                completed: completedJobs,
                total: totalJobs,
                status: 'processing'
            })
            
            console.log(`🖨️ Printing PDF: ${pdfJob.fileName} with settings:`, pdfJob.printSettings)
            
            // Validate PDF file exists
            if (!pdfJob.file || !pdfJob.file.localPath) {
              console.error(`❌ PDF job missing file path:`, pdfJob)
              printErrors.push(`PDF ${pdfJob.fileName}: Missing file path`)
              continue
            }
            
            const printOptions = {
              filePath: pdfJob.file.localPath,
              printerName: printerName,
              copies: pdfJob.printSettings.copies,
              pageRange: pdfJob.printSettings.pageRange,
              customPages: pdfJob.printSettings.customPages,
              colorMode: pdfJob.printSettings.colorMode,
              doubleSided: pdfJob.printSettings.doubleSided,
              silent: true
            }
            
            console.log(`📤 Sending PDF print request:`, printOptions)
            const printResult = await window.electronAPI.advancedPdfPrint(printOptions)
            console.log(`📥 PDF print result:`, printResult)
            
            if (printResult.success) {
              console.log(`✅ PDF ${pdfJob.fileName} printed successfully using ${printResult.method}`)
            } else {
              console.error(`❌ Failed to print PDF ${pdfJob.fileName}:`, printResult.error)
              printErrors.push(`PDF ${pdfJob.fileName}: ${printResult.error}`)
              
              // Show specific error details
              if (printResult.details) {
                console.warn(`💡 PDF Printing Details: ${printResult.details}`)
              }
            }
            
            // Longer delay between PDF prints
            await new Promise(resolve => setTimeout(resolve, 3000))
            
          } catch (error) {
            console.error(`❌ Error printing PDF ${pdfJob.fileName}:`, error)
            printErrors.push(`PDF ${pdfJob.fileName}: ${error.message}`)
          }
        }
      }
      
      // Update final progress
      setPrintProgress({
        currentJob: 'Print jobs completed',
        completed: totalJobs,
        total: totalJobs,
        status: printErrors.length === 0 ? 'completed' : 'completed_with_errors'
      })
      
      // Show comprehensive final status
      if (printErrors.length === 0) {
        alert(`✅ All ${totalJobs} print jobs completed successfully!\n\nPrinter: ${selectedPrinter.displayName}\nCanvas Pages: ${pages.length}\nPDF Jobs: ${printQueue.length}`)
      } else {
        console.warn("⚠️ Print jobs completed with errors:", printErrors)
        const errorSummary = printErrors.join('\n• ')
        alert(`⚠️ Print jobs completed with ${printErrors.length} errors:\n\n• ${errorSummary}\n\nSuccessful jobs: ${totalJobs - printErrors.length}/${totalJobs}`)
      }
      
    } else {
      // Handle case where Electron API is not available or no printer selected
      if (!window.electronAPI) {
        console.warn("⚠️ Electron API not available - printing skipped")
        alert("✅ Payment successful! Print jobs queued.\n\n⚠️ Desktop app required for actual printing.")
      } else if (!selectedPrinter) {
        console.warn("⚠️ No printer selected - printing skipped")
        alert("✅ Payment successful! Print jobs queued.\n\n⚠️ Please select a printer for printing.")
      }
    }

    // Clear the queues after processing
    console.log("🧹 Clearing print queues...")
    setPages([{ id: 1, items: [], colorMode: "color" }])
    setPrintQueue([])
    setActivePage(1)
    setMobileNumber("")
    
    console.log("✅ Advanced print job processing completed successfully")
    
  } catch (error) {
    console.error("❌ Error processing advanced print job:", error)
    alert(`❌ Payment successful, but there was an issue processing your print job:\n\n${error.message}\n\nPlease contact support with Payment ID: ${paymentResponse.razorpay_payment_id}`)
  } finally {
    setPaymentProcessing(false)
    setPrintingInProgress(false)
    setPrintProgress({
      currentJob: '',
      completed: 0,
      total: 0,
      status: 'idle'
    })
  }
}

  // Get current page
  const currentPage = pages.find((page) => page.id === activePage) || pages[0]

  // Handle item selection
  const selectItem = (item) => {
    setSelectedItem(item)
    setCropMode(false)
  }

  // Handle click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (canvasRef.current && !canvasRef.current.contains(e.target)) {
        setSelectedItem(null)
        setCropMode(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Create file URL helper - FIXED FOR BASE64 DATA
  const getFileUrl = (file) => {
    const cachedData = fileDataCache[file.name]
    if (cachedData && cachedData.type === 'image') {
      return cachedData.dataUrl
    }
    
    console.warn("⚠️ No cached data for file:", file.name)
    return "/placeholder.svg"
  }

  // Debug: Log files being used
  useEffect(() => {
    console.log("📁 IntegratedFilePage received files:", files)
    console.log("📊 File categories:", fileCategories)
    console.log("💾 File data cache:", fileDataCache)
  }, [files, fileDataCache])

  return (
    <div className="integrated-files-page">
      <div className="main-content">
        <div className="sidebar">
          <div className="file-categories">
            <div className="category-header">
              <h3>Categories</h3>
              {/* ENHANCED: Printer Status Display */}
              {selectedPrinter && (
                <div className="printer-status" style={{ 
                  marginTop: '10px', 
                  padding: '8px', 
                  backgroundColor: printerStatus[selectedPrinter.name]?.online ? '#e8f5e8' : '#ffeaea',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Printer size={14} />
                    <span style={{ fontWeight: 'bold' }}>{selectedPrinter.displayName}</span>
                    {printerStatus[selectedPrinter.name]?.online ? (
                      <CheckCircle size={14} color="#28a745" />
                    ) : (
                      <AlertCircle size={14} color="#dc3545" />
                    )}
                  </div>
                  <div style={{ marginTop: '4px', color: '#666' }}>
                    {printerStatus[selectedPrinter.name]?.message || 'Status unknown'}
                  </div>
                  {selectedPrinter.capabilities && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#888' }}>
                      Features: {selectedPrinter.capabilities.duplex ? 'Duplex' : 'Single-sided'}, {selectedPrinter.capabilities.color ? 'Color' : 'B&W only'}
                    </div>
                  )}
                </div>
              )}
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
                        {cachedData && cachedData.type === 'image' ? (
                          <img
                            src={cachedData.dataUrl || "/placeholder.svg"}
                            alt={file.name}
                            className="thumbnail"
                            onError={(e) => {
                              console.error("❌ Failed to load cached image:", file.name)
                              e.target.src = "/placeholder.svg"
                            }}
                          />
                        ) : (
                          <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            background: '#f0f0f0', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: '#666'
                          }}>
                            Loading...
                          </div>
                        )}
                      </div>
                      <div className="file-info">
                        <div className="file-name">
                          {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                        </div>
                        <div className="file-size">{file.size ? (file.size / 1024).toFixed(1) : "0"} KB</div>
                        {file.localPath && (
                          <div className="file-size" style={{ color: "#28a745", fontSize: "10px" }}>
                            📁 Local
                          </div>
                        )}
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
                      {file.localPath && (
                        <div className="file-size" style={{ color: "#28a745", fontSize: "10px" }}>
                          📁 Local
                        </div>
                      )}
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

            <div className="color-toggle">
              <label className="switch">
                <input
                  id="input"
                  type="checkbox"
                  checked={currentPage?.colorMode === "bw"}
                  onChange={() => currentPage && toggleColorMode(activePage)}
                />
                <div className="slider round">
                  <div className="sun-moon">
                    <svg id="moon-dot-1" className="moon-dot" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="50"></circle>
                    </svg>
                    <svg id="moon-dot-2" className="moon-dot" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="50"></circle>
                    </svg>
                    <svg id="moon-dot-3" className="moon-dot" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="50"></circle>
                    </svg>
                  </div>
                </div>
              </label>
              <span className="toggle-text">{currentPage?.colorMode === "color" ? "Color" : "B&W"}</span>
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
                        selectItem(item)
                      }}
                      onMouseDown={(e) => {
                        if (!cropMode) {
                          handleItemDragStart(e, item)
                        }
                      }}
                    >
                      <div className="canvas-image-container">
                        <img
                          src={getFileUrl(item.file) || "/placeholder.svg"}
                          alt={item.file.name}
                          className="canvas-image"
                          onError={(e) => {
                            console.error("❌ Failed to load canvas image:", item.file.name)
                            e.target.src = "/placeholder.svg"
                          }}
                        />
                      </div>

                      {selectedItem && selectedItem.id === item.id && (
                        <div className="item-controls">
                          <button
                            className="item-delete"
                            onClick={() => {
                              setPages(
                                pages.map((page) => {
                                  if (page.id === activePage) {
                                    return {
                                      ...page,
                                      items: page.items.filter((i) => i.id !== item.id),
                                    }
                                  }
                                  return page
                                }),
                              )
                              setSelectedItem(null)
                            }}
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

        <div className="right-sidebar">
          <div className="cost-summary">
            <h4>Cost Summary</h4>
            <div className="cost-details">
              {pages.length > 0 && (
                <div className="cost-section">
                  <h5>Canvas Pages</h5>
                  {pages.map((page) => (
                    <div key={page.id} className="cost-item">
                      <span>
                        Page {page.id} ({page.colorMode === "color" ? "Color" : "B&W"})
                      </span>
                      <span>₹{page.colorMode === "color" ? 10 : 2}</span>
                    </div>
                  ))}
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

          {/* ENHANCED PAYMENT SECTION WITH MOBILE NUMBER AND PRINTER SELECTION */}
          <div className="payment-floating-container">
            <div className="payment-box">
              <div className="payment-summary">
                <div className="payment-total">
                  <span>Total:</span>
                  <span>₹{calculateTotalCost()}</span>
                </div>
              </div>
              
              {/* Printer Selection */}
              {availablePrinters.length > 0 && (
                <div className="printer-selection-section">
                  <label className="printer-selection-label" htmlFor="printer-select">
                    Select Printer
                  </label>
                  <select
                    id="printer-select"
                    className="printer-select"
                    value={selectedPrinter?.name || ''}
                    onChange={(e) => {
                      const printer = availablePrinters.find(p => p.name === e.target.value)
                      setSelectedPrinter(printer)
                      if (printer) {
                        testPrinterConnectivity(printer.name)
                      }
                    }}
                  >
                    {availablePrinters.map((printer) => (
                      <option key={printer.name} value={printer.name}>
                        {printer.displayName} {printer.isDefault ? '(Default)' : ''} {printer.type === 'network' ? '(Network)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Mobile Number Input */}
              <div className="mobile-input-section">
                <label className="mobile-input-label" htmlFor="mobile-number">
                  Mobile Number *
                </label>
                <input
                  id="mobile-number"
                  type="tel"
                  className={`mobile-input ${mobileError ? 'error' : ''}`}
                  placeholder="Enter 10-digit mobile number"
                  value={mobileNumber}
                  onChange={handleMobileNumberChange}
                  maxLength={10}
                />
                {mobileError && (
                  <div className="mobile-error">{mobileError}</div>
                )}
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
                  {printingInProgress && printProgress.status !== 'idle' && (
                    <div className="print-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${(printProgress.completed / printProgress.total) * 100}%`,
                            backgroundColor: printProgress.status === 'completed' ? '#28a745' : 
                                           printProgress.status === 'completed_with_errors' ? '#ffc107' : '#007bff'
                          }}
                        ></div>
                      </div>
                      <div className="progress-text">
                        {printProgress.currentJob} ({printProgress.completed}/{printProgress.total})
                      </div>
                    </div>
                  )}
                  <p style={{ textAlign: "center", marginTop: "10px", color: "#666", fontSize: "14px" }}>
                    {printingInProgress ? "Advanced print jobs are being processed..." : "Loading Razorpay payment gateway..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Microsoft Edge Style Print Dialog - ENHANCED WITH DUPLEX SUPPORT */}
      {showEdgePrintDialog && (
        <div className="print-modal">
          <div className="edge-print-dialog">
            <div className="print-dialog-left">
              <div className="print-dialog-header">
                <h2>Advanced Print Settings</h2>
                <button className="close-dialog" onClick={() => setShowEdgePrintDialog(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="print-info">
                <p className="total-sheets">Total: {pdfPageCount} sheets of paper</p>
                {selectedPrinter && (
                  <p className="printer-info">Printer: {selectedPrinter.displayName}</p>
                )}
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

                {/* ENHANCED: DUPLEX OPTION WITH PRINTER CAPABILITY CHECK */}
                <div className="print-option-group">
                  <label className="print-option-label">
                    Duplex 
                    {selectedPrinter && !selectedPrinter.capabilities?.duplex && (
                      <span style={{ fontSize: '11px', color: '#888' }}> (Not supported)</span>
                    )}
                  </label>
                  <select
                    value={edgePrintSettings.doubleSided}
                    onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, doubleSided: e.target.value })}
                    className="print-select"
                    disabled={selectedPrinter && !selectedPrinter.capabilities?.duplex}
                  >
                    <option value="one-side">Print one-sided</option>
                    <option value="both-sides">Print on both sides</option>
                  </select>
                </div>

                <div className="cost-display-section">
                  <div className="cost-breakdown">
                    <h4>Cost: ₹{calculateEdgePrintCost()}</h4>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Advanced printing features will be applied
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
                                if (edgePrintSettings.colorMode === "bw") {
                                  canvas.style.filter = "grayscale(100%)"
                                } else {
                                  canvas.style.filter = "none"
                                }
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
