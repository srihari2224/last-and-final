"use client"

import { useState, useRef, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Plus, Trash, ImageIcon, FileText, Crop, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react"
import "./FilesPage.css"

function FilesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const files = location.state?.files || []
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
    pageRange: "all", // "all", "odd", "even", "custom"
    customPages: "",
    doubleSided: "one-side", // "one-side", "both-sides"
    colorMode: "bw", // "color", "bw"
  })

  // Print queue state
  const [printQueue, setPrintQueue] = useState([])

  // Group files by type (only images and PDFs now - NO WORD DOCS)
  const fileCategories = {
    images: files.filter((file) => file.type.startsWith("image/")),
    pdfs: files.filter((file) => file.type === "application/pdf"),
  }

  // Initialize PDF.js only
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

  // Function to get image dimensions
  const getImageDimensions = (file) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        // Calculate aspect ratio and fit within reasonable bounds
        const maxWidth = 300
        const maxHeight = 300
        const aspectRatio = img.width / img.height

        let width, height
        if (aspectRatio > 1) {
          // Landscape
          width = Math.min(maxWidth, img.width)
          height = width / aspectRatio
        } else {
          // Portrait or square
          height = Math.min(maxHeight, img.height)
          width = height * aspectRatio
        }

        resolve({ width: Math.round(width), height: Math.round(height) })
      }
      img.onerror = () => resolve({ width: 200, height: 200 }) // fallback
      img.src = URL.createObjectURL(file)
    })
  }

  // Function to get PDF page count
  const getPDFPageCount = async (file) => {
    return new Promise((resolve) => {
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
      reader.readAsArrayBuffer(file)
    })
  }

  // Load PDF for preview
  const loadPDFPreview = async (file) => {
    try {
      if (!window.pdfjsLib) {
        console.log("PDF.js not available")
        return
      }

      const reader = new FileReader()
      reader.onload = async function () {
        try {
          const pdf = await window.pdfjsLib.getDocument({ data: this.result }).promise
          setPdfDoc(pdf)
          setCurrentPdfPage(1)

          // Render first few pages for preview
          const pages = []
          const maxPreviewPages = Math.min(5, pdf.numPages)

          for (let i = 1; i <= maxPreviewPages; i++) {
            const page = await pdf.getPage(i)
            const scale = 1.5
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
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error("Error in loadPDFPreview:", error)
    }
  }

  // Show Microsoft Edge style print dialog when PDF is clicked
  const handlePDFClick = async (file) => {
    console.log("Opening Edge-style print dialog for:", file.name)

    const pageCount = await getPDFPageCount(file)
    setPdfPageCount(pageCount)
    setCurrentPdfFile(file)

    // Reset print settings
    setEdgePrintSettings({
      copies: 1,
      pageRange: "all",
      customPages: "",
      doubleSided: "one-side",
      colorMode: "bw",
    })

    // Load PDF preview
    await loadPDFPreview(file)

    setShowEdgePrintDialog(true)
  }

  // Calculate cost based on Edge print settings
  const calculateEdgePrintCost = () => {
    if (!currentPdfFile || pdfPageCount === 0) return 0

    let totalPages = 0

    // Calculate pages based on range selection
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

    // Multiply by copies
    totalPages *= edgePrintSettings.copies

    // Calculate cost based on color mode and double-sided
    const costPerPage = edgePrintSettings.colorMode === "color" ? 10 : 2

    if (edgePrintSettings.doubleSided === "both-sides") {
      // For double-sided printing
      if (edgePrintSettings.colorMode === "color") {
        return totalPages * 10 // Color double-sided same as single
      } else {
        // B&W double-sided: ₹3 per sheet (2 pages)
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

  // Add PDF to print queue with Edge settings
  const addPDFToQueue = () => {
    if (!currentPdfFile) return

    let pagesToPrint = 0
    let actualStartPage = 1
    let actualEndPage = pdfPageCount

    // Calculate pages based on range selection
    switch (edgePrintSettings.pageRange) {
      case "all":
        pagesToPrint = pdfPageCount
        actualStartPage = 1
        actualEndPage = pdfPageCount
        break
      case "odd":
        pagesToPrint = Math.ceil(pdfPageCount / 2)
        // For odd pages, we'll handle this in printing logic
        break
      case "even":
        pagesToPrint = Math.floor(pdfPageCount / 2)
        // For even pages, we'll handle this in printing logic
        break
      case "custom":
        pagesToPrint = calculateCustomPages()
        // Custom pages will be handled in printing logic
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
      actualStartPage: actualStartPage,
      actualEndPage: actualEndPage,
      cost: calculateEdgePrintCost(),
      timestamp: new Date().toLocaleTimeString(),
    }

    setPrintQueue([...printQueue, queueItem])
    setShowEdgePrintDialog(false)
    setCurrentPdfFile(null)

    console.log("Added PDF to queue:", queueItem)
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

      // Get dynamic image dimensions based on actual image
      const dimensions = await getImageDimensions(draggingFile)

      // Ensure image stays within canvas bounds
      x = Math.max(0, Math.min(x, 743.75 - dimensions.width))
      y = Math.max(0, Math.min(y, 1052.5 - dimensions.height))

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

      // Constrain to canvas boundaries
      x = Math.max(0, Math.min(x, 743.75 - draggingItem.width))
      y = Math.max(0, Math.min(y, 1052.5 - draggingItem.height))

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

  const [resizing, setResizing] = useState(null)

  // Handle resize start
  const handleResizeStart = (e, itemId, handle) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const item = currentPage.items.find((item) => item.id === itemId)
    if (!item) return

    const initialWidth = item.width
    const initialHeight = item.height
    const initialX = item.x
    const initialY = item.y

    setResizing({
      itemId,
      handle,
      startX,
      startY,
      initialWidth,
      initialHeight,
      initialX,
      initialY,
    })

    document.addEventListener("mousemove", handleResize)
    document.addEventListener("mouseup", handleResizeEnd)
  }

  // Handle resize
  const handleResize = (e) => {
    if (!resizing) return

    const { itemId, handle, startX, startY, initialWidth, initialHeight, initialX, initialY } = resizing

    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY

    let newWidth = initialWidth
    let newHeight = initialHeight
    let newX = initialX
    let newY = initialY

    switch (handle) {
      case "bottom-right":
        newWidth = Math.max(50, Math.min(initialWidth + deltaX, 743.75 - initialX))
        newHeight = Math.max(50, Math.min(initialHeight + deltaY, 1052.5 - initialY))
        break
      case "bottom-left":
        newWidth = Math.max(50, initialWidth - deltaX)
        newHeight = Math.max(50, Math.min(initialHeight + deltaY, 1052.5 - initialY))
        newX = Math.max(0, initialX + deltaX)
        break
      case "top-right":
        newWidth = Math.max(50, Math.min(initialWidth + deltaX, 743.75 - initialX))
        newHeight = Math.max(50, initialHeight - deltaY)
        newY = Math.max(0, initialY + deltaY)
        break
      case "top-left":
        newWidth = Math.max(50, initialWidth - deltaX)
        newHeight = Math.max(50, initialHeight - deltaY)
        newX = Math.max(0, initialX + deltaX)
        newY = Math.max(0, initialY + deltaY)
        break
    }

    // Ensure item stays within canvas bounds
    if (newX + newWidth > 743.75) {
      newWidth = 743.75 - newX
    }
    if (newY + newHeight > 1052.5) {
      newHeight = 1052.5 - newY
    }

    setPages(
      pages.map((page) => {
        if (page.id === activePage) {
          return {
            ...page,
            items: page.items.map((item) => {
              if (item.id === itemId) {
                return { ...item, width: newWidth, height: newHeight, x: newX, y: newY }
              }
              return item
            }),
          }
        }
        return page
      }),
    )
  }

  // Handle resize end
  const handleResizeEnd = () => {
    setResizing(null)
    document.removeEventListener("mousemove", handleResize)
    document.removeEventListener("mouseup", handleResizeEnd)
  }

  // Handle image enlargement and compression
  const resizeImage = (itemId, action) => {
    setPages(
      pages.map((page) => {
        if (page.id === activePage) {
          return {
            ...page,
            items: page.items.map((item) => {
              if (item.id === itemId) {
                const scaleFactor = action === "enlarge" ? 1.2 : 0.8
                const newWidth = item.width * scaleFactor
                const newHeight = item.height * scaleFactor
                return { ...item, width: newWidth, height: newHeight }
              }
              return item
            }),
          }
        }
        return page
      }),
    )
  }

  // Handle rotation
  const rotateItem = (itemId, direction) => {
    setPages(
      pages.map((page) => {
        if (page.id === activePage) {
          return {
            ...page,
            items: page.items.map((item) => {
              if (item.id === itemId) {
                const newRotation = item.rotation + (direction === "clockwise" ? 90 : -90)
                return { ...item, rotation: newRotation }
              }
              return item
            }),
          }
        }
        return page
      }),
    )
  }

  // Handle crop start
  const handleCropStart = (e) => {
    if (!selectedItem || !cropMode) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setCropStart({ x, y })
    setCropEnd({ x, y })

    document.addEventListener("mousemove", handleCropMove)
    document.addEventListener("mouseup", handleCropEnd)
  }

  // Handle crop move
  const handleCropMove = (e) => {
    if (!selectedItem || !cropMode) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(selectedItem.width, e.clientX - rect.left - selectedItem.x))
    const y = Math.max(0, Math.min(selectedItem.height, e.clientY - rect.top - selectedItem.y))

    setCropEnd({ x, y })
  }

  // Handle crop end
  const handleCropEnd = () => {
    if (!selectedItem || !cropMode) return

    const cropX = Math.min(cropStart.x, cropEnd.x)
    const cropY = Math.min(cropStart.y, cropEnd.y)
    const cropWidth = Math.abs(cropEnd.x - cropStart.x)
    const cropHeight = Math.abs(cropEnd.y - cropStart.y)

    if (cropWidth > 10 && cropHeight > 10) {
      setPages(
        pages.map((page) => {
          if (page.id === activePage) {
            return {
              ...page,
              items: page.items.map((item) => {
                if (item.id === selectedItem.id) {
                  return {
                    ...item,
                    crop: {
                      x: cropX,
                      y: cropY,
                      width: cropWidth,
                      height: cropHeight,
                    },
                  }
                }
                return item
              }),
            }
          }
          return page
        }),
      )
    }

    setCropMode(false)
    document.removeEventListener("mousemove", handleCropMove)
    document.removeEventListener("mouseup", handleCropEnd)
  }

  // Handle item deletion
  const deleteItem = (pageId, itemId) => {
    setPages(
      pages.map((page) => {
        if (page.id === pageId) {
          return {
            ...page,
            items: page.items.filter((item) => item.id !== itemId),
          }
        }
        return page
      }),
    )
    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem(null)
    }
  }

  // Calculate total cost including canvas pages and PDF queue
  const calculateTotalCost = () => {
    let totalCost = 0

    // Canvas pages cost
    pages.forEach((page) => {
      totalCost += page.colorMode === "color" ? 10 : 2
    })

    // PDF queue cost
    printQueue.forEach((item) => {
      totalCost += item.cost
    })

    return totalCost
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

  return (
    <div className="files-page">
      <div className="navi">
        <div className="logo1" onClick={() => navigate("/")}>
          <span className="home">HOME</span>
          <span className="num">25</span>
        </div>
        <div className="title">File Editor & Print Queue</div>
      </div>

      <div className="main-content">
        <div className="sidebar">
          <div className="file-categories">
            <div className="category-header">
              <h3>Categories</h3>
            </div>

            <div className="category">
              <div className="category-title">
                <ImageIcon size={18} />
                <span>Images ({fileCategories.images.length})</span>
              </div>
              <ul className="file-list">
                {fileCategories.images.map((file, index) => (
                  <li key={index} className="file-item" draggable onDragStart={() => handleDragStart(file)}>
                    <div className="file-preview">
                      <img
                        src={URL.createObjectURL(file) || "/placeholder.svg"}
                        alt={file.name}
                        className="thumbnail"
                      />
                    </div>
                    <div className="file-info">
                      <div className="file-name">
                        {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                      </div>
                      <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="category">
              <div className="category-title">
                <FileText size={18} />
                <span>PDFs ({fileCategories.pdfs.length})</span>
              </div>
              <ul className="file-list">
                {fileCategories.pdfs.map((file, index) => (
                  <li key={index} className="file-item" onClick={() => handlePDFClick(file)}>
                    <div className="file-icon">
                      <FileText size={24} />
                    </div>
                    <div className="file-info">
                      <div className="file-name">
                        {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                      </div>
                      <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
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
                        <FileText size={24} />
                      </div>
                      <div className="file-info">
                        <div className="file-name">
                          {item.fileName.length > 15 ? `${item.fileName.substring(0, 15)}...` : item.fileName}
                        </div>
                        <div className="file-details">
                          {item.printSettings.copies} copies • {item.printSettings.pageRange} pages •
                          {item.printSettings.colorMode === "color" ? " Color" : " B&W"} •
                          {item.printSettings.doubleSided === "both-sides" ? " Double-sided" : " Single-sided"}
                        </div>
                        <div className="cost-display">₹{item.cost}</div>
                      </div>
                      <button className="remove-button" onClick={() => removeFromQueue(item.id)}>
                        <Trash size={16} />
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
                  width="24"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  stroke="currentColor"
                  height="24"
                  fill="none"
                  className="svg"
                >
                  <line y2="19" y1="5" x2="12" x1="12"></line>
                  <line y2="12" y1="12" x2="19" x1="5"></line>
                </svg>
              </span>
            </button>

            <button className="Duplicate" onClick={duplicatePage}>
              <span> COPY Page</span>
            </button>

            <button className="delete-button" onClick={() => deletePage(activePage)}>
              <span className="delete-button__text">Delete</span>
              <span className="delete-button__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
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
                  <div className="stars">
                    <svg id="star-1" className="star" viewBox="0 0 20 20">
                      <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"></path>
                    </svg>
                    <svg id="star-2" className="star" viewBox="0 0 20 20">
                      <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"></path>
                    </svg>
                    <svg id="star-3" className="star" viewBox="0 0 20 20">
                      <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"></path>
                    </svg>
                    <svg id="star-4" className="star" viewBox="0 0 20 20">
                      <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"></path>
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
                      className={`canvas-item ${selectedItem && selectedItem.id === item.id ? "selected" : ""} ${
                        cropMode && selectedItem && selectedItem.id === item.id ? "crop-mode" : ""
                      }`}
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
                        if (cropMode && selectedItem && selectedItem.id === item.id) {
                          handleCropStart(e)
                        } else if (!cropMode) {
                          handleItemDragStart(e, item)
                        }
                      }}
                    >
                      <div className="canvas-image-container">
                        <img
                          src={URL.createObjectURL(item.file) || "/placeholder.svg"}
                          alt={item.file.name}
                          className="canvas-image"
                          style={
                            item.crop
                              ? {
                                  objectPosition: `-${item.crop.x}px -${item.crop.y}px`,
                                  width: `${(item.width / item.crop.width) * 100}%`,
                                  height: `${(item.height / item.crop.height) * 100}%`,
                                }
                              : {}
                          }
                        />
                      </div>

                      {selectedItem && selectedItem.id === item.id && cropMode && (
                        <div
                          className="crop-overlay"
                          style={{
                            left: `${Math.min(cropStart.x, cropEnd.x)}px`,
                            top: `${Math.min(cropStart.y, cropEnd.y)}px`,
                            width: `${Math.abs(cropEnd.x - cropStart.x)}px`,
                            height: `${Math.abs(cropEnd.y - cropStart.y)}px`,
                          }}
                        ></div>
                      )}

                      {selectedItem && selectedItem.id === item.id && !cropMode && (
                        <>
                          <div className="item-controls">
                            <button className="item-control-button" onClick={() => resizeImage(item.id, "enlarge")}>
                              <ZoomIn size={16} />
                            </button>
                            <button className="item-control-button" onClick={() => resizeImage(item.id, "compress")}>
                              <ZoomOut size={16} />
                            </button>
                            <button className="item-delete" onClick={() => deleteItem(activePage, item.id)}>
                              <Trash size={16} />
                            </button>
                          </div>

                          <div
                            className="resize-handle top-left"
                            onMouseDown={(e) => handleResizeStart(e, item.id, "top-left")}
                          ></div>
                          <div
                            className="resize-handle top-right"
                            onMouseDown={(e) => handleResizeStart(e, item.id, "top-right")}
                          ></div>
                          <div
                            className="resize-handle bottom-left"
                            onMouseDown={(e) => handleResizeStart(e, item.id, "bottom-left")}
                          ></div>
                          <div
                            className="resize-handle bottom-right"
                            onMouseDown={(e) => handleResizeStart(e, item.id, "bottom-right")}
                          ></div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-pages-message">
                <div className="no-pages-content">
                  <FileText size={48} />
                  <h3>No Canvas Pages</h3>
                  <p>Add a canvas page to start designing</p>
                  <button className="toolbar-button" onClick={addNewPage}>
                    <Plus size={16} />
                    <span>Add Canvas Page</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar for image editing or cost summary */}
          <div className="right-sidebar">
            {selectedItem ? (
              <div className="edit-panel">
                <div className="panel-header">
                  <h3>Image Editor</h3>
                  <button className="close-button" onClick={() => setSelectedItem(null)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="edit-tools">
                  <button className={`edit-button ${cropMode ? "active" : ""}`} onClick={() => setCropMode(!cropMode)}>
                    <Crop size={16} />
                    <span>Crop</span>
                  </button>
                  <button className="edit-button" onClick={() => rotateItem(selectedItem.id, "counterclockwise")}>
                    <RotateCcw size={16} />
                    <span>Rotate Left</span>
                  </button>
                  <button className="edit-button" onClick={() => rotateItem(selectedItem.id, "clockwise")}>
                    <RotateCw size={16} />
                    <span>Rotate Right</span>
                  </button>
                  <button className="edit-button" onClick={() => resizeImage(selectedItem.id, "enlarge")}>
                    <ZoomIn size={16} />
                    <span>Enlarge</span>
                  </button>
                  <button className="edit-button" onClick={() => resizeImage(selectedItem.id, "compress")}>
                    <ZoomOut size={16} />
                    <span>Compress</span>
                  </button>
                </div>

                {cropMode && (
                  <div className="crop-instructions">
                    <p>Click and drag on the image to crop</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="print-panel">
                <div className="cost-summary">
                  <h4>Cost Summary</h4>
                  <div className="cost-details">
                    {/* Canvas pages */}
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

                    {/* PDF queue items */}
                    {printQueue.length > 0 && (
                      <div className="cost-section">
                        <h5>PDF Documents</h5>
                        {printQueue.map((item) => (
                          <div key={item.id} className="cost-item">
                            <span>
                              {item.fileName.substring(0, 20)}
                              {item.fileName.length > 20 ? "..." : ""} ({item.printSettings.copies} copies,{" "}
                              {item.printSettings.pageRange},
                              {item.printSettings.colorMode === "color" ? " Color" : " B&W"},
                              {item.printSettings.doubleSided === "both-sides" ? " Double-sided" : " Single-sided"})
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating payment button */}
      <div className="payment-floating-container">
        <div className="payment-box">
          <div className="payment-summary">
            <div className="payment-total">
              <span>Total Cost:</span>
              <span>₹{calculateTotalCost()}</span>
            </div>
          </div>
          <button
            className="payment-button"
            onClick={() =>
              navigate("/payment", {
                state: {
                  totalCost: calculateTotalCost(),
                  pages: pages,
                  printQueue: printQueue,
                  blankSheets: 0,
                },
              })
            }
            disabled={calculateTotalCost() === 0}
          >
            <span className="btn-text">Pay & Print Now</span>
            <div className="icon-container">
              <svg viewBox="0 0 24 24" className="icon">
                <path
                  d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"
                  fill="currentColor"
                ></path>
              </svg>
            </div>
          </button>
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
                  <X size={20} />
                </button>
              </div>

              <div className="print-info">
                <p className="total-sheets">Total: {pdfPageCount} sheets of paper</p>
              </div>

              <div className="print-options-section">
                <div className="print-option-group">
                  <label className="print-option-label">Printer</label>
                  <select className="print-select" disabled>
                    <option>Canon MF240 (Default)</option>
                  </select>
                </div>

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
                        value="odd"
                        checked={edgePrintSettings.pageRange === "odd"}
                        onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, pageRange: e.target.value })}
                      />
                      <span>Odd pages only</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="pageRange"
                        value="even"
                        checked={edgePrintSettings.pageRange === "even"}
                        onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, pageRange: e.target.value })}
                      />
                      <span>Even pages only</span>
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
                  <label className="print-option-label">Print on both sides</label>
                  <select
                    value={edgePrintSettings.doubleSided}
                    onChange={(e) => setEdgePrintSettings({ ...edgePrintSettings, doubleSided: e.target.value })}
                    className="print-select"
                  >
                    <option value="one-side">Print on one side</option>
                    <option value="both-sides">Print on both sides</option>
                  </select>
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
                    <h4>Cost Breakdown</h4>
                    <div className="cost-item">
                      <span>Pages to print:</span>
                      <span>
                        {edgePrintSettings.pageRange === "all"
                          ? pdfPageCount
                          : edgePrintSettings.pageRange === "odd"
                            ? Math.ceil(pdfPageCount / 2)
                            : edgePrintSettings.pageRange === "even"
                              ? Math.floor(pdfPageCount / 2)
                              : calculateCustomPages()}{" "}
                        × {edgePrintSettings.copies} copies
                      </span>
                    </div>
                    <div className="cost-item">
                      <span>Print mode:</span>
                      <span>
                        {edgePrintSettings.colorMode === "color" ? "Color" : "B&W"},{" "}
                        {edgePrintSettings.doubleSided === "both-sides" ? "Double-sided" : "Single-sided"}
                      </span>
                    </div>
                    <div className="cost-item total-cost-item">
                      <span>Total Cost:</span>
                      <span>₹{calculateEdgePrintCost()}</span>
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
                      {allPdfPages.slice(0, 3).map((page, index) => (
                        <div key={index} className="pdf-page-preview">
                          <div className="page-number">Page {page.pageNumber}</div>
                          <canvas
                            ref={(canvas) => {
                              if (canvas && page.canvas) {
                                const ctx = canvas.getContext("2d")
                                canvas.width = page.canvas.width
                                canvas.height = page.canvas.height
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
                      {allPdfPages.length > 3 && (
                        <div className="more-pages-indicator">+{allPdfPages.length - 3} more pages</div>
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

      <style jsx>{`
        .edge-print-dialog {
          display: flex;
          width: 90vw;
          max-width: 1200px;
          height: 80vh;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .print-dialog-left {
          width: 40%;
          padding: 24px;
          border-right: 1px solid #e0e0e0;
          overflow-y: auto;
        }

        .print-dialog-right {
          width: 60%;
          background: #f5f5f5;
        }

        .print-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .print-dialog-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .close-dialog {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .close-dialog:hover {
          background: #f0f0f0;
        }

        .print-info {
          margin-bottom: 24px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .total-sheets {
          margin: 0;
          font-weight: 500;
          color: #333;
        }

        .print-options-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .print-option-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .print-option-label {
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .print-select,
        .print-input {
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }

        .radio-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .radio-option input[type="radio"] {
          margin: 0;
        }

        .custom-pages-input {
          margin-top: 8px;
        }

        .cost-display-section {
          margin-top: 20px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .cost-breakdown h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .cost-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .total-cost-item {
          font-weight: 600;
          border-top: 1px solid #ddd;
          padding-top: 8px;
          margin-top: 8px;
        }

        .print-dialog-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .cancel-btn,
        .add-to-queue-btn {
          flex: 1;
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .cancel-btn {
          background: #f0f0f0;
          color: #333;
        }

        .cancel-btn:hover {
          background: #e0e0e0;
        }

        .add-to-queue-btn {
          background: #0078d4;
          color: white;
        }

        .add-to-queue-btn:hover:not(:disabled) {
          background: #106ebe;
        }

        .add-to-queue-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .pdf-preview-section {
          padding: 24px;
          height: 100%;
          overflow-y: auto;
        }

        .pdf-preview-section h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .pdf-pages-preview {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pdf-page-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .page-number {
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        .preview-canvas {
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .more-pages-indicator {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 16px;
        }

        .loading-preview {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>
    </div>
  )
}

export default FilesPage