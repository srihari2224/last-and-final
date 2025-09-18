import pdf from "../assets/pdf.svg"
import image from "../assets/img.svg"
;("use client")

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./FileTransferPage.css"
import sessionIcon from "../assets/session.svg"
import wifiIcon from "../assets/wifi.svg"
import IntegratedFilePage from "./IntegratedFilePage"

import videoAdSrc from "../assets/1_video_1.mp4"
import videoAdsec2 from "../assets/1_video_2.mp4"
import videoAdsec3 from "../assets/1_video_3.mp4"

import imgAd1 from "../assets/ad/1.1.png"
import imgAd2 from "../assets/ad/1.2.png"
import imgAd3 from "../assets/ad/1.3.png"

import imgAd4 from "../assets/ad/2.1.png"
import imgAd5 from "../assets/ad/2.2.png"
import imgAd6 from "../assets/ad/2.3.png"

import imgAd7 from "../assets/ad/3.1.png"
import imgAd8 from "../assets/ad/3.2.png"
import imgAd9 from "../assets/ad/3.3.png"

import navimoto from "../assets/moto.png"

import graph from "../assets/graph.png"
import plane from "../assets/plane.png"
import margin from "../assets/margin.png"

import shop from "../assets/shop.svg"
import logo from "../assets/logo.png"
import logo2 from "../assets/logo2.png"


const FileTransferPage = () => {
  const videoSources = [videoAdSrc, videoAdsec2, videoAdsec3]
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0)
  const [currentImageSet, setCurrentImageSet] = useState(0)
  const [showScrollIndicator, setShowScrollIndicator] = useState(true)
  const [hasScrolledToImages, setHasScrolledToImages] = useState(false)
  const [showCouponCard, setShowCouponCard] = useState(false)
  const [couponImageIndex, setCouponImageIndex] = useState(0) // Which image has the coupon
  const [couponFound, setCouponFound] = useState(false) // Whether coupon was found in current position
  const [selectedCouponVideos, setSelectedCouponVideos] = useState([]) // Which videos have coupons
  const [couponImageIndices, setCouponImageIndices] = useState({}) // Which image has coupon for each video
  const [hoverTimeout, setHoverTimeout] = useState(null) // Timeout for 1.2 second hover delay
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [clockTime, setClockTime] = useState("")
  const [showFiles, setShowFiles] = useState(false)
  const [showIntegratedView, setShowIntegratedView] = useState(false)
  const [activeSection, setActiveSection] = useState("session")

  const [cartItems, setCartItems] = useState([])
  const [showCart, setShowCart] = useState(false)

  const [mobileNumber, setMobileNumber] = useState("")
  const [mobileError, setMobileError] = useState("")
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [printingInProgress, setPrintingInProgress] = useState(false)
  const [printProgress, setPrintProgress] = useState({
    currentJob: "",
    completed: 0,
    total: 0,
    status: "idle",
  })

  const products = [
    {
      id: 1,
      name: "PLAIN SHEET",
      category: "The Blank Beast",
      price: 0.99,
      originalPrice: 2,
      image: plane,
      inStock: true,
      pdfPath: import.meta.env.VITE_PLANE || "C:\\Users\\msrih\\Downloads\\eastIT\\extras\\blank_A4.pdf",
      printSettings: { colorMode: "color", doubleSided: false },
    },
    {
      id: 2,
      name: "GRAPH SHEET",
      category: "The Engineer's Playground",
      price: 2.9,
      originalPrice: 5,
      image: graph,
      inStock: true,
      pdfPath: import.meta.env.VITE_GRAPH || "C:\\Users\\msrih\\Downloads\\eastIT\\extras\\graph_A4.pdf",
      printSettings: { colorMode: "color", doubleSided: false },
    },
    // {
    //   id: 3,
    //   name: "MARGIN LINED PAPER",
    //   category: "Stay inside the lines",
    //   price: 1.49,
    //   originalPrice: 4,
    //   image: margin,
    //   inStock: true,
    //   pdfPath: import.meta.env.VITE_MARGIN || "C:\\Users\\msrih\\Downloads\\eastIT\\extras\\lined_A4.pdf",
    //   printSettings: { colorMode: "blackwhite", doubleSided: true },
    // },
  ]

  const addToCart = (product) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id)
      if (existingItem) {
        return prevItems.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      } else {
        return [...prevItems, { ...product, quantity: 1 }]
      }
    })
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId))
    } else {
      setCartItems((prevItems) =>
        prevItems.map((item) => (item.id === productId ? { ...item, quantity: newQuantity } : item)),
      )
    }
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const getTotalCost = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const clearCart = () => {
    setCartItems([])
  }

  const generateUniqueSessionId = () => {
    const adjectives = [
      "Fuzzy",
      "Happy",
      "Sneaky",
      "Lazy",
      "Tiny",
      "Brave",
      "Swift",
      "Clever",
      "Gentle",
      "Mighty",
      "Bright",
      "Calm",
      "Eager",
      "Fierce",
      "Jolly",
      "Kind",
      "Lively",
      "Noble",
      "Quick",
      "Wise",
      "Bold",
      "Cool",
      "Daring",
      "Epic",
      "Fast",
      "Great",
      "Huge",
      "Icy",
      "Jumbo",
      "Keen",
    ]

    const animals = [
      "Cat",
      "Llama",
      "Fox",
      "Koala",
      "Hawk",
      "Bear",
      "Wolf",
      "Tiger",
      "Lion",
      "Eagle",
      "Panda",
      "Shark",
      "Whale",
      "Deer",
      "Rabbit",
      "Horse",
      "Zebra",
      "Giraffe",
      "Elephant",
      "Rhino",
      "Monkey",
      "Parrot",
      "Owl",
      "Falcon",
      "Raven",
      "Swan",
      "Duck",
      "Goose",
      "Crane",
      "Heron",
    ]

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)]
    const randomNumber = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0")

    return `${randomAdjective}${randomAnimal}${randomNumber}`
  }

  const generateSessionCouponCode = (sessionId) => {
    if (!sessionId) return "0000"

    // Create a simple hash from session ID
    let hash = 0
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    // Convert to positive 4-digit number
    const fourDigitCode = Math.abs(hash % 9000) + 1000
    return fourDigitCode.toString()
  }

  const handleVideoEnd = () => {
    setCurrentVideoIdx((prevIdx) => (prevIdx + 1) % videoSources.length)
    setCurrentImageSet((prevIdx) => (prevIdx + 1) % videoSources.length)
  }

  useEffect(() => {
    const newSessionId = generateUniqueSessionId()
    setSessionId(newSessionId)
    localStorage.setItem("currentSessionId", newSessionId)
    console.log("🆔 Generated session ID:", newSessionId)

    const totalVideos = videoSources.length
    const couponVideoCount = totalVideos - 1

    // Generate array of video indices and shuffle to get random selection
    const allVideoIndices = Array.from({ length: totalVideos }, (_, i) => i)
    const shuffled = allVideoIndices.sort(() => Math.random() - 0.5)
    const selectedVideos = shuffled.slice(0, couponVideoCount)

    setSelectedCouponVideos(selectedVideos)

    const imageIndices = {}
    selectedVideos.forEach((videoIndex) => {
      imageIndices[videoIndex] = Math.floor(Math.random() * 3)
    })
    setCouponImageIndices(imageIndices)
    setCouponFound(false)

  const qrUrl = `https://innvera.vercel.app/?session=${newSessionId}`;

    console.log("QR Code URL:", qrUrl)

    QRCode.toDataURL(qrUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        setQrCodeUrl(url)
      })
      .catch((err) => {
        console.error("Error generating QR code:", err)
      })

    const handleOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener("online", handleOnlineStatus)
    window.addEventListener("offline", handleOnlineStatus)

    const timeInterval = setInterval(() => {
      const cd = new Date()
      setClockTime(
        zeroPadding(cd.getHours(), 2) + ":" + zeroPadding(cd.getMinutes(), 2) + ":" + zeroPadding(cd.getSeconds(), 2),
      )
    }, 1000)

    return () => {
      clearInterval(timeInterval)
      window.removeEventListener("online", handleOnlineStatus)
      window.removeEventListener("offline", handleOnlineStatus)
    }
  }, [])

  useEffect(() => {
    const handleScroll = (e) => {
      const imgContainer = document.querySelector(".img_container")

      if (imgContainer) {
        const imgRect = imgContainer.getBoundingClientRect()

        if (imgRect.top <= window.innerHeight && imgRect.bottom >= 0) {
          if (!hasScrolledToImages) {
            setHasScrolledToImages(true)
            setShowScrollIndicator(false)
            setCurrentImageSet(currentVideoIdx)
          }
        } else {
          setHasScrolledToImages(false)
          setShowScrollIndicator(true)
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [hasScrolledToImages, currentVideoIdx])

  const fetchSessionFiles = async (sessionId) => {
    try {
      setLoading(true)
      console.log(`🔍 Fetching files directly from session folder: ${sessionId}`)

      if (window.electronAPI) {
        console.log("🔌 Using Electron API to get session files")
        try {
          const result = await window.electronAPI.getSessionFiles(sessionId)
          console.log("📁 Session Files Response:", result)

          if (result.exists === false) {
            console.log("📭 Session folder does not exist yet - downloading from S3")
            await downloadS3FilesToSession(sessionId)

            const retryResult = await window.electronAPI.getSessionFiles(sessionId)
            console.log("📁 Retry Session Files Response:", retryResult)

            if (retryResult.success && retryResult.files && retryResult.files.length > 0) {
              setFiles(retryResult.files)
              console.log(`✅ Found ${retryResult.files.length} files after download:`, retryResult.files)
              return
            }
          } else if (result.success && result.files && result.files.length > 0) {
            setFiles(result.files)
            console.log(`✅ Found ${result.files.length} files in session folder:`, result.files)
            return
          } else {
            console.log("📭 No files found in session folder, trying S3 download...")
            await downloadS3FilesToSession(sessionId)

            const finalResult = await window.electronAPI.getSessionFiles(sessionId)
            if (finalResult.success && finalResult.files && finalResult.files.length > 0) {
              setFiles(finalResult.files)
              console.log(`✅ Found ${finalResult.files.length} files after S3 download:`, finalResult.files)
              return
            }
          }
        } catch (electronError) {
          console.error("❌ Electron API error:", electronError)
        }
      }

      console.log("📭 No files available for this session")
      setFiles([])
    } catch (error) {
      console.error("❌ Error fetching session files:", error)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const downloadS3FilesToSession = async (sessionId) => {
    try {
      console.log("🌐 Checking for S3 files to download")

      const s3Response = await fetch(`https://upload-backend-api.vercel.app/api/list-files?session=${sessionId}`)

      if (!s3Response.ok) {
        console.warn("⚠️ Could not fetch S3 files")
        return false
      }

      const s3Data = await s3Response.json()
      console.log("📁 S3 Files Response:", s3Data)

      if (s3Data.files && s3Data.files.length > 0 && window.electronAPI) {
        console.log(`🔌 Downloading ${s3Data.files.length} S3 files to session folder`)

        const downloadResult = await window.electronAPI.downloadS3Files(sessionId, s3Data.files)
        console.log("📥 Download result:", downloadResult)

        if (downloadResult.success) {
          console.log(`✅ Successfully downloaded ${downloadResult.downloadedFiles.length} files`)
          return true
        }
      }
      return false
    } catch (error) {
      console.error("❌ Error downloading S3 files:", error)
      return false
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const zeroPadding = (num, digit) => {
    let zero = ""
    for (let i = 0; i < digit; i++) zero += "0"
    return (zero + num).slice(-digit)
  }

  const updateTime = () => {
    const cd = new Date()
    setClockTime(
      zeroPadding(cd.getHours(), 2) + ":" + zeroPadding(cd.getMinutes(), 2) + ":" + zeroPadding(cd.getSeconds(), 2),
    )
  }

  useEffect(() => {
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleStorageBoxClick = () => {
    if (!showFiles) {
      setShowFiles(true)
      fetchSessionFiles(sessionId)
    }
  }

  const handleNext = async () => {
    if (files.length > 0) {
      console.log("🔄 Processing all files for integrated view...")
      console.log("📁 All files:", files)
      setShowIntegratedView(true)
    }
  }

  const handleBackToSelection = () => {
    setShowIntegratedView(false)
  }

  const handleNavigateToPayment = (paymentData) => {
    navigate("/payment", { state: paymentData })
  }

  const validateMobileNumber = (number) => {
    const mobileRegex = /^[6-9]\d{9}$/
    return mobileRegex.test(number)
  }

  const handlePrintShopPayment = async () => {
    const totalAmount = getTotalCost()
    if (totalAmount === 0 || cartItems.length === 0) return

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
        key: "rzp_live_RIHIU9s2p53vFn",
        amount: totalAmount * 100,
        currency: "INR",
        name: "Print Shop",
        description: `Paper Print Order - Session ${sessionId}`,
        handler: (response) => {
          processPrintShopOrder(response)
        },
        prefill: {
          name: "Customer",
          email: "customer@example.com",
          contact: mobileNumber,
        },
        notes: {
          sessionId,
          totalItems: getTotalItems(),
          cartItems: JSON.stringify(cartItems.map((item) => ({ name: item.name, quantity: item.quantity }))),
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

  const processPrintShopOrder = async (paymentResponse) => {
    try {
      setPrintingInProgress(true)
      setPaymentProcessing(false)

      const totalJobs = cartItems.reduce((sum, item) => sum + item.quantity, 0)
      let completedJobs = 0

      setPrintProgress({
        currentJob: "Starting print shop order...",
        completed: 0,
        total: totalJobs,
        status: "processing",
      })

      console.log("🖨️ Starting print shop silent printing...")
      console.log("🛒 Cart items:", cartItems)

      const printErrors = []

      if (window.electronAPI) {
        for (const cartItem of cartItems) {
          const product = products.find((p) => p.id === cartItem.id)
          if (!product) continue

          for (let copy = 1; copy <= cartItem.quantity; copy++) {
            completedJobs++
            setPrintProgress({
              currentJob: `Printing ${product.name} (Copy ${copy}/${cartItem.quantity})...`,
              completed: completedJobs,
              total: totalJobs,
              status: "processing",
            })

            try {
              const printOptions = {
                filePath: product.pdfPath,
                copies: 1,
                pageRange: "all",
                customPages: "",
                colorMode: product.printSettings.colorMode,
                doubleSided: product.printSettings.doubleSided,
              }

              const printResult = await window.electronAPI.printPdf(printOptions)

              if (!printResult?.success) {
                console.error(`❌ ${product.name} copy ${copy} failed:`, printResult?.error)
                printErrors.push(`${product.name} (Copy ${copy})`)
              } else {
                console.log(`✅ ${product.name} copy ${copy} sent to print queue`)
              }
            } catch (e) {
              console.error(`❌ ${product.name} copy ${copy} error:`, e)
              printErrors.push(`${product.name} (Copy ${copy})`)
            }

            await new Promise((r) => setTimeout(r, 1500))
          }
        }
      }

      setPrintProgress({
        currentJob: printErrors.length
          ? `Completed - ${printErrors.length} jobs failed`
          : "All print jobs sent successfully!",
        completed: totalJobs,
        total: totalJobs,
        status: printErrors.length ? "completed_with_errors" : "completed",
      })

      console.log("🎉 Print shop order completed")
      if (printErrors.length > 0) {
        console.log("❌ Failed jobs:", printErrors)
      }

      setTimeout(() => {
        setCartItems([])
        setMobileNumber("")
        setMobileError("")
        setPrintingInProgress(false)
        setPrintProgress({ currentJob: "", completed: 0, total: 0, status: "idle" })
        setShowCart(false)
      }, 3000)
    } catch (error) {
      console.error("❌ Print shop order failed:", error)
      setPrintingInProgress(false)
      setPaymentProcessing(false)
    }
  }

  const imageGroups = [
    [imgAd1, imgAd2, imgAd3], // Video 1 images
    [imgAd4, imgAd5, imgAd6], // Video 2 images
    [imgAd7, imgAd8, imgAd9], // Video 3 images
  ]

  const handleImageHover = (imageIndex) => {
    if (
      selectedCouponVideos.includes(currentImageSet) &&
      imageIndex === couponImageIndices[currentImageSet] &&
      !couponFound
    ) {
      // Clear any existing timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }

      // Set new timeout for 1.2 seconds
      const timeout = setTimeout(() => {
        setShowCouponCard(true)
        setCouponFound(true)
      }, 400)

      setHoverTimeout(timeout)
    }
  }

  const handleImageLeave = () => {
    // Clear timeout if user stops hovering before 1.2 seconds
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
  }

  const handleCloseCouponCard = () => {
    setShowCouponCard(false)

    const currentVideoHasCoupon = selectedCouponVideos.includes(currentImageSet)

    if (currentVideoHasCoupon) {
      let newIndex
      do {
        newIndex = Math.floor(Math.random() * 3)
      } while (newIndex === couponImageIndices[currentImageSet])

      setCouponImageIndices((prev) => ({
        ...prev,
        [currentImageSet]: newIndex,
      }))
    }
    setCouponFound(false)

    // Clear any remaining timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
  }

  return (
    <div className="file-transfer-page">
      <div className="navbar">
        <div className="nav-content">
          <div class="logo">
            <div class="logo-icon">
              <img src={logo} alt="Logo" className="app-logo" />  
            </div>
            
          </div>
          <div className="nav-status">
            <div
              className="nav-logo"
              style={{ display: "flex", alignItems: "center", height: "48px", padding: "0 8px" }}
            >
              <img
                src={navimoto || "/placeholder.svg"}
                alt="Logo"
                className="navi-moto"
                style={{ height: "40px", width: "auto", maxWidth: "120px", objectFit: "contain", display: "block" }}
              />
            </div>

            <div className="wifi-status">
              <img src={wifiIcon || "/placeholder.svg"} alt="WiFi" className="wifi-icon" />
              <span className={`status-text ${isOnline ? "online" : "offline"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div id="clock" className="nav-clock">
              <p className="time">{clockTime}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="section-toggle" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          className={`toggle-btn ${activeSection === "session" ? "active" : ""}`}
          onClick={() => setActiveSection("session")}
        >
          Session
        </button>
        <button
          className={`toggle-btn ${activeSection === "papershop" ? "active" : ""}`}
          onClick={() => setActiveSection("papershop")}
        >
          Paper shop
        </button>
      </div>

      {activeSection === "session" ? (
        <div className="container">
          <div className="qr-section">
            <h2>Scan QR Code to Upload Files</h2>
            <div className="qr-container">
              {qrCodeUrl ? (
                <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code for file upload" className="qr-code" />
              ) : (
                <div className="qr-placeholder">Generating QR Code...</div>
              )}
            </div>
            <div className="session-info" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={sessionIcon || "/placeholder.svg"} alt="Session" className="session-icon" />
              <span className="session-id">{sessionId}</span>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "4px 14px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="storage-section">
            <div className={`storage-box ${showFiles ? "files-mode" : ""}`} onClick={handleStorageBoxClick}>
              {!showFiles ? (
                <div className="storage-box-blur">
                  <section className="relative group flex flex-col items-center justify-center w-full h-full">
                    <div className="file relative w-60 h-40 cursor-pointer origin-bottom [perspective:1500px] z-50">
                      <div className="work-5 bg-amber-600 w-full h-full origin-top rounded-2xl rounded-tl-none group-hover:shadow-[0_20px_40px_rgba(0,0,0,.2)] transition-all ease duration-300 relative after:absolute after:content-[''] after:bottom-[99%] after:left-0 after:w-20 after:h-4 after:bg-amber-600 after:rounded-t-2xl before:absolute before:content-[''] before:-top-[15px] before:left-[75.5px] before:w-4 before:h-4 before:bg-amber-600 before:[clip-path:polygon(0_35%,0%_100%,50%_100%);]"></div>
                      <div className="work-4 absolute inset-1 bg-zinc-400 rounded-2xl transition-all ease duration-300 origin-bottom select-none group-hover:[transform:rotateX(-20deg)]"></div>
                      <div className="work-3 absolute inset-1 bg-zinc-300 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-30deg)]"></div>
                      <div className="work-2 absolute inset-1 bg-zinc-200 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-38deg)]"></div>
                      <div className="work-1 absolute bottom-0 bg-gradient-to-t from-amber-500 to-amber-400 w-full h-[156px] rounded-2xl rounded-tr-none after:absolute after:content-[''] after:bottom-[99%] after:right-0 after:w-[146px] after:h-[16px] after:bg-amber-400 after:rounded-t-2xl before:absolute before:content-[''] before:-top-[10px] before:right-[142px] before:size-3 before:bg-amber-400 before:[clip-path:polygon(100%_14%,50%_100%,100%_100%);] transition-all ease duration-300 origin-bottom flex items-end group-hover:shadow-[inset_0_20px_40px_#fbbf24,_inset_0_-20px_40px_#d97706] group-hover:[transform:rotateX(-46deg)_translateY(1px)]"></div>
                    </div>
                    <p className="text-3xl pt-4 opacity-20" style={{ color: "black" }}>UPLOADED FILES</p>
                    <p className="text-3xl pt-4 opacity-20" style={{ color: "red" }}>CLICK HERE ONLY AFTER UPLODING FILES</p>

                  </section>
                </div>
              ) : (
                <div className="files-display" onClick={(e) => e.stopPropagation()}>
                  <div className="files-header">
                    <h3 className="files-title">Files</h3>
                    <button
                      className="refresh-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        fetchSessionFiles(sessionId)
                      }}
                      disabled={loading}
                    >
                      <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                      </svg>
                    </button>
                  </div>

                  {loading ? (
                    <div className="loading-animation-card">
                      <div className="text-loader">
                        <p>loading</p>
                        <div className="rotating-words">
                          <span className="animated-word">buttons</span>
                          <span className="animated-word">forms</span>
                          <span className="animated-word">switches</span>
                          <span className="animated-word">cards</span>
                          <span className="animated-word">buttons</span>
                        </div>
                      </div>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="empty-state"> Click REFRESH to start new SESSION | NO files found</div>
                  ) : (
                    <>
                      <div className="modern-files-list">
                        {files.map((file, index) => {
                          const isPdf = file.type === "pdf" || file.name.toLowerCase().endsWith(".pdf")
                          const isImage =
                            file.type === "image" || file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)

                          return (
                            <div key={index} className="modern-file-card">
                              <div className="file-icon-container">
                                {isPdf ? (
                                  <div className="pdf-icon">
                                    <img
                                      src={pdf || "/placeholder.svg"}
                                      alt="PDF"
                                      style={{ width: 32, height: 32, objectFit: "contain", display: "block" }}
                                    />
                                  </div>
                                ) : (
                                  <div className="image-icon">
                                    <img
                                      src={image || "/placeholder.svg"}
                                      alt="Image"
                                      style={{ width: 24, height: 24, objectFit: "contain", display: "block" }}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="file-details">
                                <h4 className="file-name" title={file.name}>
                                  {file.name}
                                </h4>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="">
                        <button class="Btn-Container" onClick={handleNext} disabled={files.length === 0}>
                          <span class="text">let's go!</span>
                          <span class="icon-Container">
                            <svg
                              width="16"
                              height="19"
                              viewBox="0 0 16 19"
                              fill="nones"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle cx="1.61321" cy="1.61321" r="1.5" fill="black"></circle>
                              <circle cx="5.73583" cy="1.61321" r="1.5" fill="black"></circle>
                              <circle cx="5.73583" cy="5.5566" r="1.5" fill="black"></circle>
                              <circle cx="9.85851" cy="5.5566" r="1.5" fill="black"></circle>
                              <circle cx="9.85851" cy="9.5" r="1.5" fill="black"></circle>
                              <circle cx="13.9811" cy="9.5" r="1.5" fill="black"></circle>
                              <circle cx="5.73583" cy="13.4434" r="1.5" fill="black"></circle>
                              <circle cx="9.85851" cy="13.4434" r="1.5" fill="black"></circle>
                              <circle cx="1.61321" cy="17.3868" r="1.5" fill="black"></circle>
                              <circle cx="5.73583" cy="17.3868" r="1.5" fill="black"></circle>
                            </svg>
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="container">
          {activeSection === "papershop" && (
            <div className="floating-cart-container">
              <button className="floating-cart-btn" onClick={() => setShowCart(!showCart)}>
                <img
                  src={shop || "/placeholder.svg"}
                  alt="Cart"
                  className="basket-icon"
                  style={{ width: 32, height: 32, objectFit: "contain" }}
                />
                {getTotalItems() > 0 && <span className="floating-cart-counter">{getTotalItems()}</span>}
              </button>
            </div>
          )}

          <div className="paper-shop-content">
            <div className="product-cards-container">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <div className="product-tilt">
                    <div className="product-img">
                      <img src={product.image || "/placeholder.svg"} alt={product.name} />
                    </div>
                  </div>
                  <div className="product-info">
                    <div className="product-cat">{product.category}</div>
                    <h2 className="product-title">{product.name}</h2>
                    <div className="product-bottom">
                      <div className="product-price">
                        <span className="price-old">₹{product.originalPrice}</span>
                        <span className="price-new">₹{product.price}</span>
                      </div>
                      <button className="product-btn" onClick={() => addToCart(product)} disabled={!product.inStock}>
                        <span>Add to Cart</span>
                        <svg
                          className="cart-icon"
                          width="19"
                          height="19"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 01-8 0" />
                        </svg>
                      </button>
                    </div>
                    <div className="product-meta">
                      <div className="product-stock">{product.inStock ? "In Stock" : "Out of Stock"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCart && activeSection === "papershop" && (
        <div className="cart-overlay" onClick={() => setShowCart(false)}>
          <div className="modern-cart-container" onClick={(e) => e.stopPropagation()}>
            <div className="unified-cart">
              <div className="cart-header-modern">
                <div>
                  <img class="cart-logo"src={logo2}></img>

                </div>
                <label className="cart-title">Your cart</label>
                <button className="cart-close-btn-modern" onClick={() => setShowCart(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {cartItems.length === 0 ? (
                <div className="cart-empty-modern">
                  <svg
                    className="empty-cart-icon-modern"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="cart-items-section">
                  {cartItems.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div className="item-icon">
                        {item.name === "PLAIN SHEET" && (
                          <svg
                            fill="none"
                            viewBox="0 0 60 60"
                            height="40"
                            width="40"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect fill="#F0F8FF" rx="8.25" height="60" width="60"></rect>
                            <path stroke="#4A90E2" strokeWidth="2" fill="#87CEEB" d="M15 15h30v30H15z"></path>
                            <path stroke="#4A90E2" strokeWidth="1.5" d="M20 25h20M20 30h20M20 35h15"></path>
                          </svg>
                        )}
                        {item.name === "GRAPH SHEET" && (
                          <svg
                            fill="none"
                            viewBox="0 0 60 60"
                            height="40"
                            width="40"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect fill="#F0FFF0" rx="8.25" height="60" width="60"></rect>
                            <defs>
                              <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#32CD32" strokeWidth="0.5" />
                              </pattern>
                            </defs>
                            <rect
                              x="10"
                              y="10"
                              width="40"
                              height="40"
                              fill="url(#grid)"
                              stroke="#228B22"
                              strokeWidth="1"
                            />
                          </svg>
                        )}
                        {/* {item.name === "MARGIN LINED PAPER" && (
                          <svg
                            fill="none"
                            viewBox="0 0 60 60"
                            height="40"
                            width="40"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect fill="#FFF8DC" rx="8.25" height="60" width="60"></rect>
                            <rect x="10" y="10" width="40" height="40" fill="white" stroke="#DAA520" strokeWidth="1" />
                            <line x1="18" y1="10" x2="18" y2="50" stroke="#FF6B6B" strokeWidth="1" />
                            <path
                              stroke="#DAA520"
                              strokeWidth="0.5"
                              d="M10 20h40M10 25h40M10 30h40M10 35h40M10 40h40M10 45h40"
                            ></path>
                          </svg>
                        )} */}
                      </div>
                      <div className="item-details">
                        <div className="item-name">{item.name}</div>
                        <div className="item-category">{item.category}</div>
                        <div className="item-price">₹{item.price} each</div>
                      </div>
                      <div className="item-quantity">
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                          <svg
                            fill="none"
                            viewBox="0 0 24 24"
                            height="14"
                            width="14"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              strokeWidth="2.5"
                              stroke="#47484b"
                              d="M20 12L4 12"
                            ></path>
                          </svg>
                        </button>
                        <span className="qty-number">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                          <svg
                            fill="none"
                            viewBox="0 0 24 24"
                            height="14"
                            width="14"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              strokeWidth="2.5"
                              stroke="#47484b"
                              d="M12 4V20M20 12H4"
                            ></path>
                          </svg>
                        </button>
                      </div>
                      <div className="item-total">₹{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}

              {cartItems.length > 0 && (
                <div className="mobile-input-section">
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value)
                      setMobileError("")
                    }}
                    placeholder="Enter 10-digit mobile number"
                    className="mobile-input"
                    maxLength="10"
                    disabled={paymentProcessing || printingInProgress}
                  />
                  {mobileError && <div className="mobile-error">{mobileError}</div>}
                </div>
              )}

              {printingInProgress && (
                <div className="printing-progress-section">
                  <div className="progress-title">Printing Progress</div>
                  <div className="progress-job">{printProgress.currentJob}</div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${printProgress.total > 0 ? (printProgress.completed / printProgress.total) * 100 : 0}%`,
                        backgroundColor: printProgress.status === "completed_with_errors" ? "#ffc107" : "#28a745",
                      }}
                    ></div>
                  </div>
                  <div className="progress-status">
                    {printProgress.completed} of {printProgress.total} jobs completed
                  </div>
                </div>
              )}

              {cartItems.length > 0 && (
                <div className="checkout-section">
                  <div className="checkout-details">
                    <div className="detail-row">
                      <span>Total Items:</span>
                      <span>{getTotalItems()}</span>
                    </div>
                    <div className="detail-row">
                      <span>Your cart total:</span>
                      <span>₹{getTotalCost().toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="total-price">₹{getTotalCost().toFixed(2)}</div>
                  <div className="checkout-buttons">
                    <button
                      className="clear-btn"
                      onClick={clearCart}
                      disabled={paymentProcessing || printingInProgress}
                    >
                      Clear Cart
                    </button>
                    <button
                      className="pay-btn"
                      onClick={handlePrintShopPayment}
                      disabled={paymentProcessing || printingInProgress || cartItems.length === 0}
                    >
                      {paymentProcessing ? "Processing..." : printingInProgress ? "Printing..." : "Pay Now"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="video_ad">
        <div class="video_container">
          <video
            className="video_ad_player"
            src={videoSources[currentVideoIdx]}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnd}
            key={currentVideoIdx}
          ></video>
        </div>

        <div class="img_container">
          {imageGroups[currentImageSet].map((imgSrc, index) => (
            <img
              key={index}
              src={imgSrc || "/placeholder.svg"}
              className="img_ad"
              alt={`Ad ${currentImageSet + 1}.${index + 1}`}
              onMouseEnter={() => handleImageHover(index)}
              onMouseLeave={handleImageLeave}
            />
          ))}
        </div>

        {showCouponCard && (
          <div className="coupon-overlay" onClick={handleCloseCouponCard}>
            <div className="coupon-card">
              <div className="close-btn" onClick={handleCloseCouponCard}>
                ×
              </div>
              <div className="innvera-logo">INNVERA</div>
              <div className="offer-text">10% flat off valid only on pdf/canvas prints only</div>
              <div className="promo-codes">
                <div className="promo-code">{generateSessionCouponCode(sessionId)}</div>
                <div
                  className="promo-code copy-btn"
                  onClick={() => navigator.clipboard.writeText(generateSessionCouponCode(sessionId))}
                >
                  COPY
                </div>
              </div>
              <div className="validity">Valid Till: only for this session</div>
            </div>
          </div>
        )}
      </div>

      {showIntegratedView && activeSection === "session" && (
        <div className="integrated-files-section">
          <IntegratedFilePage files={files} sessionId={sessionId} onNavigateToPayment={handleNavigateToPayment} />
        </div>
      )}
    </div>
  )
}

export default FileTransferPage
