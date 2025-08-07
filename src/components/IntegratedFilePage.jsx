"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash, ImageIcon, FileText, X } from 'lucide-react'
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

  // Function to get image dimensions - FIXED FOR LOCAL FILES
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

      // Handle local files from session folder
      if (file.localPath && window.electronAPI) {
        console.log("📐 Getting dimensions for local file:", file.localPath)
        img.src = `file://${file.localPath.replace(/\\/g, "/")}`
      } else if (file instanceof File) {
        img.src = URL.createObjectURL(file)
      } else if (file.url) {
        img.src = file.url
      } else {
        console.warn("No valid source for image dimensions:", file)
        resolve({ width: 150, height: 150 })
      }
    })
  }

  // Function to get PDF page count - FIXED FOR LOCAL FILES
  const getPDFPageCount = async (file) => {
    return new Promise((resolve) => {
      // For Electron local files, use the Electron API
      if (file.localPath && window.electronAPI) {
        console.log("📄 Getting PDF page count for local file:", file.localPath)
        window.electronAPI
          .getPdfPageCount(file.localPath)
          .then((result) => {
            if (result.success) {
              console.log("✅ PDF page count:", result.pageCount)
              resolve(result.pageCount)
            } else {
              console.warn("⚠️ Failed to get PDF page count:", result.error)
              resolve(1)
            }
          })
          .catch((error) => {
            console.error("❌ Error getting PDF page count:", error)
            resolve(1)
          })
        return
      }

      // Fallback for web files
      const reader = new FileReader()
      reader.onload = async function () {
        try {
          if (!window.pdfjsLib) {
            resolve(1)
            return
          }
          const pdf = await window.pdfjsLib.getDocument({ data: this.result }).promise
          resolve(pdf.numPages)
        } catch (error) {
          console.error("Error loading PDF:", error)
          resolve(1)
        }
      }
      reader.onerror = () => resolve(1)

      if (file instanceof File) {
        reader.readAsArrayBuffer(file)
      } else {
        resolve(1)
      }
    })
  }

  // Load PDF for preview - FIXED FOR LOCAL FILES
  const loadPDFPreview = async (file) => {
    try {
      if (!window.pdfjsLib) {
        console.log("PDF.js not available")
        return
      }

      console.log("📄 Loading PDF preview for:", file.name)

      // For Electron local files, read the file directly
      if (file.localPath && window.electronAPI) {
        try {
          console.log("📁 Loading local PDF:", file.localPath)
          const response = await fetch(`file://${file.localPath.replace(/\\/g, "/")}`)
          const arrayBuffer = await response.arrayBuffer()

          const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
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
        } catch (error) {
          console.error("❌ Error loading local PDF for preview:", error)
        }
        return
      }

      // Fallback for web files
      const reader = new FileReader()
      reader.onload = async function () {
        try {
          const pdf = await window.pdfjsLib.getDocument({ data: this.result }).promise
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
        } catch (error) {
          console.error("Error loading PDF for preview:", error)
        }
      }

      if (file instanceof File) {
        reader.readAsArrayBuffer(file)
      }
    } catch (error) {
      console.error("Error in loadPDFPreview:", error)
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
        pageIndex > 0 ? (pageIndex < newPages.length ? pageIndex : newPages.length) : newPages.length > 0 ? 1 : 1
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

    console.log("💳 Starting direct Razorpay payment for ₹", totalAmount)
    console.log("📱 Mobile number:", mobileNumber)
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
        key: "rzp_live_jm6OsGGo5hOcUQ", // Your Razorpay key
        amount: totalAmount * 100, // Amount in paise
        currency: "INR",
        name: "Print Shop",
        description: `Print Job - Session ${sessionId}`,
        image: "/placeholder.svg?height=100&width=100&text=Print", // Optional logo
        handler: function (response) {
          console.log("✅ Payment successful:", response)
          console.log("Payment ID:", response.razorpay_payment_id)
          
          // Process the print job and send SMS invoice
          processPrintJobWithInvoice(response)
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

  // Process print job after successful payment and send SMS invoice
  const processPrintJobWithInvoice = async (paymentResponse) => {
    console.log("🖨️ Processing print job after payment:", paymentResponse)
    
    try {
      // Show success message immediately
      alert("Payment successful! Your print job will be processed.")
      
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
          description: `${pdfJob.fileName} (${pdfJob.printSettings.copies} copies)`,
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
            items: invoiceItems
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
      
      // Process canvas pages
      for (const page of pages) {
        console.log(`🖨️ Processing canvas page ${page.id} (${page.colorMode})`)
        // Here you would send the page data to your printing service
      }

      // Process PDF queue
      for (const pdfJob of printQueue) {
        console.log(`🖨️ Processing PDF: ${pdfJob.fileName}`)
        
        // If using Electron, you can use the print APIs
        if (window.electronAPI && pdfJob.file.localPath) {
          try {
            const printResult = await window.electronAPI.addToPrintQueue({
              id: pdfJob.id,
              fileName: pdfJob.fileName,
              filePath: pdfJob.file.localPath,
              printOptions: pdfJob.printSettings,
              cost: pdfJob.cost,
              paymentId: paymentResponse.razorpay_payment_id,
            })
            
            if (printResult.success) {
              console.log("✅ PDF added to print queue:", pdfJob.fileName)
            }
          } catch (error) {
            console.error("❌ Error adding PDF to print queue:", error)
          }
        }
      }

      // Clear the queues after processing
      setPages([{ id: 1, items: [], colorMode: "color" }])
      setPrintQueue([])
      setActivePage(1)
      setMobileNumber("")
      
      console.log("✅ Print job processing completed")
      
    } catch (error) {
      console.error("❌ Error processing print job:", error)
      alert("Payment successful, but there was an issue processing your print job. Please contact support.")
    } finally {
      setPaymentProcessing(false)
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

  // Create file URL helper - FIXED FOR LOCAL FILES
  const getFileUrl = (file) => {
    if (file.localPath && window.electronAPI) {
      // Use file:// protocol for local files in Electron
      const localUrl = `file://${file.localPath.replace(/\\/g, "/")}`
      console.log("🔗 Using local file URL:", localUrl)
      return localUrl
    } else if (file instanceof File) {
      return URL.createObjectURL(file)
    } else if (file.url) {
      return file.url
    }
    console.warn("⚠️ No valid URL source for file:", file.name)
    return "/placeholder.svg"
  }

  // Debug: Log files being used
  useEffect(() => {
    console.log("📁 IntegratedFilePage received files:", files)
    console.log("📊 File categories:", fileCategories)
  }, [files])

  return (
    <div className="integrated-files-page">
      <div className="main-content">
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
                {fileCategories.images.map((file, index) => (
                  <li key={index} className="file-item" draggable onDragStart={() => handleDragStart(file)}>
                    <div className="file-preview">
                      <img
                        src={getFileUrl(file) || "/placeholder.svg"}
                        alt={file.name}
                        className="thumbnail"
                        onError={(e) => {
                          console.error("❌ Failed to load image:", file.name)
                          e.target.src = "/placeholder.svg"
                        }}
                      />
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
                          {item.printSettings.colorMode === "color" ? " Color" : " B&W"}
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

          {/* ENHANCED PAYMENT SECTION WITH MOBILE NUMBER */}
          <div className="payment-floating-container">
            <div className="payment-box">
              <div className="payment-summary">
                <div className="payment-total">
                  <span>Total:</span>
                  <span>₹{calculateTotalCost()}</span>
                </div>
              </div>
              
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
                disabled={calculateTotalCost() === 0 || paymentProcessing || !mobileNumber}
              >
                <span className="btn-text">
                  {paymentProcessing ? "Loading Payment..." : "Pay Now"}
                </span>
              </button>
              
              {paymentProcessing && (
                <div className="payment-processing">
                  <p style={{ textAlign: "center", marginTop: "10px", color: "#666", fontSize: "14px" }}>
                    Loading Razorpay payment gateway...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Microsoft Edge Style Print Dialog */}
      {showEdgePrintDialog && (
        <div className="print-modal">
          <div className="edge-print-dialog">
            <div className="print-dialog-left">
              <div className="print-dialog-header">
                <h2>Print</h2>
                <button className="close-dialog" onClick={() => setShowEdgePrintDialog(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="print-info">
                <p className="total-sheets">Total: {pdfPageCount} sheets of paper</p>
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

                <div className="cost-display-section">
                  <div className="cost-breakdown">
                    <h4>Cost: ₹{calculateEdgePrintCost()}</h4>
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
