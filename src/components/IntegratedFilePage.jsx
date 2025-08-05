"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash, ImageIcon, FileText, X } from "lucide-react"
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

  // Payment state
  const [showPaymentExpanded, setShowPaymentExpanded] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState("pending") // pending, success, failed
  const [mobileNumber, setMobileNumber] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [razorpayOrderId, setRazorpayOrderId] = useState("")

  // Group files by type (only images and PDFs) - USING LOCAL FILES
  const fileCategories = {
    images: files.filter((file) => {
      if (file.type) return file.type.startsWith("image/")
      return file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
    }),
    pdfs: files.filter((file) => {
      if (file.type) return file.type === "application/pdf"
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

  // Handle payment button click - FIXED RAZORPAY INTEGRATION
  const handlePaymentClick = async () => {
    const totalAmount = calculateTotalCost()
    if (totalAmount === 0) return

    console.log("💳 Starting payment process for ₹", totalAmount)
    setShowPaymentExpanded(true)
    setPaymentStatus("pending")

    // Create Razorpay order
    try {
      console.log("🔄 Creating Razorpay order...")

      // Since we're in Electron, we need to make the API call to our backend
      const response = await fetch("https://upload-backend-api.vercel.app/api/create-razorpay-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: totalAmount * 100, // Razorpay expects amount in paise
          currency: "INR",
        }),
      })

      const orderData = await response.json()
      console.log("📋 Razorpay order response:", orderData)

      if (orderData.success) {
        setRazorpayOrderId(orderData.orderId)

        // Generate UPI QR code using Razorpay's UPI format
        const upiString = `upi://pay?pa=success@razorpay&pn=PrintShop&am=${totalAmount}&cu=INR&tn=Print Payment&tr=${orderData.orderId}`

        // Generate QR code using QR server
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiString)}`
        setQrCodeUrl(qrUrl)

        console.log("✅ Payment QR code generated:", qrUrl)

        // Simulate payment verification after 10 seconds (for demo)
        setTimeout(() => {
          console.log("✅ Payment verification (demo)")
          setPaymentStatus("success")

          // Auto-close after success
          setTimeout(() => {
            closePaymentExpansion()
            // Here you would trigger the actual printing process
            console.log("🖨️ Starting print process...")
          }, 2000)
        }, 10000)
      } else {
        console.error("❌ Failed to create Razorpay order:", orderData.error)
        setPaymentStatus("failed")
      }
    } catch (error) {
      console.error("❌ Error creating payment:", error)
      setPaymentStatus("failed")
    }
  }

  // Close payment expansion
  const closePaymentExpansion = () => {
    setShowPaymentExpanded(false)
    setPaymentStatus("pending")
    setMobileNumber("")
    setQrCodeUrl("")
    setRazorpayOrderId("")
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

          {/* Payment button and expansion */}
          <div className="payment-floating-container">
            <div className="payment-box">
              <div className="payment-summary">
                <div className="payment-total">
                  <span>Total:</span>
                  <span>₹{calculateTotalCost()}</span>
                </div>
              </div>
              <button
                className="payment-button"
                onClick={handlePaymentClick}
                disabled={calculateTotalCost() === 0 || showPaymentExpanded}
              >
                <span className="btn-text">{showPaymentExpanded ? "Processing..." : "Pay & Print Now"}</span>
              </button>

              {/* Payment Expansion */}
              {showPaymentExpanded && (
                <div className="payment-expanded">
                  <div className="payment-header">
                    <h3>Complete Payment</h3>
                    <button className="close-payment" onClick={closePaymentExpansion}>
                      ×
                    </button>
                  </div>

                  <div className="payment-amount">
                    <h2>₹{calculateTotalCost()}</h2>
                  </div>

                  <div className="mobile-input">
                    <label>Mobile Number (Optional)</label>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Enter mobile number"
                      maxLength="10"
                    />
                  </div>

                  {qrCodeUrl && (
                    <div className="qr-container">
                      <p>Scan QR code to pay via UPI</p>
                      <img
                        src={qrCodeUrl || "/placeholder.svg"}
                        alt="UPI QR Code"
                        className="qr-code-image"
                        onError={(e) => {
                          console.error("❌ Failed to load QR code")
                          e.target.style.display = "none"
                        }}
                      />
                    </div>
                  )}

                  <div className={`payment-status ${paymentStatus}`}>
                    {paymentStatus === "pending" && "Waiting for payment..."}
                    {paymentStatus === "success" && "Payment successful! Processing print job..."}
                    {paymentStatus === "failed" && "Payment failed. Please try again."}
                  </div>
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
