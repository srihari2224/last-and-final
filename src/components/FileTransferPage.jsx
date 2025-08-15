"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./FileTransferPage.css"
import sessionIcon from "../assets/session.svg"
import storageIcon from "../assets/storage.svg"
import wifiIcon from "../assets/wifi.svg"
import IntegratedFilePage from "./IntegratedFilePage"

const FileTransferPage = () => {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showFiles, setShowFiles] = useState(false)

  // New state for file selection and integration
  const [selectedFiles, setSelectedFiles] = useState([])
  const [showIntegratedView, setShowIntegratedView] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)

  // FIXED: Generate unique session ID with format {Adjective}{Animal}{Number}
  const generateUniqueSessionId = () => {
    const adjectives = [
      'Fuzzy', 'Happy', 'Sneaky', 'Lazy', 'Tiny', 'Brave', 'Swift', 'Clever', 'Gentle', 'Mighty',
      'Bright', 'Calm', 'Eager', 'Fierce', 'Jolly', 'Kind', 'Lively', 'Noble', 'Quick', 'Wise',
      'Bold', 'Cool', 'Daring', 'Epic', 'Fast', 'Great', 'Huge', 'Icy', 'Jumbo', 'Keen'
    ];
    
    const animals = [
      'Cat', 'Llama', 'Fox', 'Koala', 'Hawk', 'Bear', 'Wolf', 'Tiger', 'Lion', 'Eagle',
      'Panda', 'Shark', 'Whale', 'Deer', 'Rabbit', 'Horse', 'Zebra', 'Giraffe', 'Elephant', 'Rhino',
      'Monkey', 'Parrot', 'Owl', 'Falcon', 'Raven', 'Swan', 'Duck', 'Goose', 'Crane', 'Heron'
    ];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `${randomAdjective}${randomAnimal}${randomNumber}`;
  };

  useEffect(() => {
    // Generate unique session ID with new format
    const newSessionId = generateUniqueSessionId();
    setSessionId(newSessionId);
    console.log('🆔 Generated session ID:', newSessionId);

    // Use the S3 domain for scan.html
    const qrUrl = `http://nit-calicut.s3-website.ap-south-1.amazonaws.com/scan.html?session=${newSessionId}`

    console.log("QR Code URL:", qrUrl)

    // Generate QR code
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

    // Online/Offline status
    const handleOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener("online", handleOnlineStatus)
    window.addEventListener("offline", handleOnlineStatus)

    // Real-time clock update
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(timeInterval)
      window.removeEventListener("online", handleOnlineStatus)
      window.removeEventListener("offline", handleOnlineStatus)
    }
  }, [])

  // COMPLETELY NEW: Fetch files directly from session folder - FIXED
  const fetchSessionFiles = async (sessionId) => {
    try {
      setLoading(true)
      console.log(`🔍 Fetching files directly from session folder: ${sessionId}`)

      // Check if we're in Electron and get files from session folder
      if (window.electronAPI) {
        console.log("🔌 Using Electron API to get session files")
        try {
          const result = await window.electronAPI.getSessionFiles(sessionId)
          console.log("📁 Session Files Response:", result)

          // If session folder doesn't exist, try to download from S3 first
          if (result.exists === false) {
            console.log("📭 Session folder does not exist yet - downloading from S3")
            await downloadS3FilesToSession(sessionId)
            
            // After downloading, try again to get the files
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
            
            // Final retry after download
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

      // If still no files, show empty state
      console.log("📭 No files available for this session")
      setFiles([])
      
    } catch (error) {
      console.error("❌ Error fetching session files:", error)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  // Download S3 files to session folder - ENHANCED
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

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const handleStorageBoxClick = () => {
    if (!showFiles) {
      setShowFiles(true)
      fetchSessionFiles(sessionId)
    }
  }

  // Handle file selection
  const handleFileSelection = (file, isSelected) => {
    if (isSelected) {
      setSelectedFiles([...selectedFiles, file])
    } else {
      setSelectedFiles(selectedFiles.filter((f) => f.name !== file.name))
    }
  }

  // Handle select all files
  const handleSelectAll = () => {
    setSelectedFiles([...files])
  }

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedFiles([])
  }

  // Handle next button click
  const handleNext = async () => {
    if (selectedFiles.length > 0) {
      console.log("🔄 Processing selected files for integrated view...")
      console.log("📁 Selected files:", selectedFiles)
      setShowIntegratedView(true)
    }
  }

  // Handle back to file selection
  const handleBackToSelection = () => {
    setShowIntegratedView(false)
    setSelectedFiles([])
  }

  // Handle navigate to payment
  const handleNavigateToPayment = (paymentData) => {
    navigate("/payment", { state: paymentData })
  }

  // Handle file click - now for selection instead of opening
  const handleFileClick = (file) => {
    if (!selectionMode) {
      setSelectionMode(true)
    }

    const isSelected = selectedFiles.some((f) => f.name === file.name)
    handleFileSelection(file, !isSelected)
  }

  return (
    <div className="file-transfer-page">
      <div className="navbar">
        <div className="nav-content">
          
          <div class="logo">  
                    <div class="logo-icon"></div>
                    <span class="logo-text">INNVERA</span>
                </div>
          <div className="nav-status">
            <div className="wifi-status">
              <img src={wifiIcon || "/placeholder.svg"} alt="WiFi" className="wifi-icon" />
              <span className={`status-text ${isOnline ? "online" : "offline"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div className="time-display">{formatTime(currentTime)}</div>
            {showIntegratedView && (
              <button
                onClick={handleBackToSelection}
                style={{
                  marginLeft: "10px",
                  padding: "5px 10px",
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Back to Files
              </button>
            )}
          </div>
        </div>
      </div>

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
          <div className="session-info">
            <img src={sessionIcon || "/placeholder.svg"} alt="Session" className="session-icon" />
            <span className="session-id">{sessionId}</span>
            <button
              onClick={() => {
                window.location.reload()
              }}
              style={{
                marginLeft: "10px",
                padding: "2px 8px",
                fontSize: "10px",
                background: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "3px",
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
                <img src={storageIcon || "/placeholder.svg"} alt="Storage" className="storage-icon" />
                <span className="storage-text">Storage</span>
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
                  <div className="loading-state">Loading files...</div>
                ) : files.length === 0 ? (
                  <div className="empty-state">No files found in session folder</div>
                ) : (
                  <>
                    <div className="files-list">
                      {files.map((file, index) => {
                        const isPdf = file.type === 'pdf' || file.name.toLowerCase().endsWith(".pdf")
                        const isSelected = selectedFiles.some((f) => f.name === file.name)

                        return (
                          <div
                            key={index}
                            className={`file-item ${isPdf ? "pdf-file" : ""} ${selectionMode ? "selectable" : ""} ${isSelected ? "selected" : ""}`}
                            onClick={() => handleFileClick(file)}
                            style={{ cursor: "pointer" }}
                          >
                            {selectionMode && (
                              <input
                                type="checkbox"
                                className="file-checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleFileSelection(file, e.target.checked)
                                }}
                              />
                            )}
                            <div className="file-info">
                              <h4>
                                {file.name}
                                {isPdf && <span className="pdf-badge">PDF</span>}
                                {file.type === 'image' && <span className="pdf-badge" style={{background: '#2196f3'}}>IMG</span>}
                              </h4>
                              <p>{formatFileSize(file.size)}</p>
                              <p>{new Date(file.uploadTime).toLocaleString()}</p>
                              {!selectionMode && (
                                <p style={{ color: "#1976d2", fontSize: "0.75rem", fontStyle: "italic" }}>
                                  Click to select files for editing
                                </p>
                              )}
                              <p style={{ color: "#28a745", fontSize: "0.7rem", fontWeight: "500" }}>
                                📁 Local: {file.localPath}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {selectionMode && (
                      <div className="selection-controls">
                        <div className="selected-count">
                          {selectedFiles.length} of {files.length} files selected
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="clear-selection-btn" onClick={handleClearSelection}>
                            Clear
                          </button>
                          <button className="clear-selection-btn" onClick={handleSelectAll}>
                            Select All
                          </button>
                          <button className="next-btn" onClick={handleNext} disabled={selectedFiles.length === 0}>
                            Next ({selectedFiles.length})
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Integrated FilePage Section - 75% width - FIXED GAPS */}
      {showIntegratedView && (
        <div className="integrated-files-section">
          <IntegratedFilePage
            files={selectedFiles}
            sessionId={sessionId}
            onNavigateToPayment={handleNavigateToPayment}
          />
        </div>
      )}
    </div>
  )
}

export default FileTransferPage
