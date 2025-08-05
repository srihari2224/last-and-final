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
  const [localFiles, setLocalFiles] = useState([]) // Store local session files

  useEffect(() => {
    // Generate unique session ID
    const newSessionId = Math.random().toString(36).substring(2, 15)
    setSessionId(newSessionId)

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

    // Initial file load
    fetchFilesFromBackend(newSessionId)

    // Online/Offline status
    const handleOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener("online", handleOnlineStatus)
    window.addEventListener("offline", handleOnlineStatus)

    // Real-time clock update
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Polling for files
    const interval = setInterval(() => {
      fetchFilesFromBackend(newSessionId)
    }, 30000)

    return () => {
      clearInterval(interval)
      clearInterval(timeInterval)
      window.removeEventListener("online", handleOnlineStatus)
      window.removeEventListener("offline", handleOnlineStatus)
    }
  }, [])

  const fetchFilesFromBackend = async (sessionId) => {
    try {
      setLoading(true)
      console.log(`🔍 Fetching files for session: ${sessionId}`)

      // Check if we're in Electron and use local files
      if (window.electronAPI) {
        console.log("🔌 Using Electron API for local files")
        try {
          const result = await window.electronAPI.getLocalFiles(sessionId)
          console.log("📁 Electron Local Files Response:", result)

          if (result.files && result.files.length > 0) {
            setFiles(result.files)
            setLocalFiles(result.files) // Store local files separately
            console.log(`✅ Found ${result.files.length} local files via Electron:`, result.files)
            return
          } else {
            console.log("📭 No local files found for this session via Electron")
          }
        } catch (electronError) {
          console.error("❌ Electron API error:", electronError)
        }
      }

      // Get S3 files and download them locally (for Electron) or show them (for web)
      console.log("🌐 Fetching S3 files")

      const s3Response = await fetch(`https://upload-backend-api.vercel.app/api/list-files?session=${sessionId}`)

      if (!s3Response.ok) {
        console.warn("⚠️ Could not fetch S3 files")
        return
      }

      const s3Data = await s3Response.json()
      console.log("📁 S3 Files Response:", s3Data)

      if (s3Data.files && s3Data.files.length > 0) {
        console.log(`📋 Found ${s3Data.files.length} files in S3:`, s3Data.files)

        // If in Electron, download files to local storage
        if (window.electronAPI) {
          console.log("🔌 Downloading S3 files to local storage via Electron")
          try {
            const downloadResult = await window.electronAPI.downloadS3Files(sessionId, s3Data.files)
            console.log("📥 Download result:", downloadResult)

            if (downloadResult.success) {
              // Get the newly downloaded local files
              const localResult = await window.electronAPI.getLocalFiles(sessionId)
              if (localResult.files && localResult.files.length > 0) {
                setFiles(localResult.files)
                setLocalFiles(localResult.files) // Store local files
                console.log(`✅ Found ${localResult.files.length} local files after download:`, localResult.files)
                return
              }
            }
          } catch (downloadError) {
            console.error("❌ Download error:", downloadError)
          }
        }

        // For web or if Electron download failed, show S3 files directly
        console.log("🌐 Showing S3 files directly (web mode)")
        setFiles(s3Data.files)
      } else {
        setFiles([])
        console.log("📭 No files found in S3 for this session")
      }
    } catch (error) {
      console.error("❌ Error fetching files:", error)
    } finally {
      setLoading(false)
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
      fetchFilesFromBackend(sessionId)
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

  // Handle next button click - FIXED TO USE LOCAL FILES
  const handleNext = async () => {
    if (selectedFiles.length > 0) {
      console.log("🔄 Processing selected files for local session folder...")

      // Get the corresponding local files for selected files
      const localSelectedFiles = []

      for (const selectedFile of selectedFiles) {
        // Find the corresponding local file
        const localFile = localFiles.find((lf) => lf.name === selectedFile.name)
        if (localFile) {
          console.log(`✅ Found local file for ${selectedFile.name}:`, localFile.localPath)
          localSelectedFiles.push(localFile)
        } else {
          console.warn(`⚠️ No local file found for ${selectedFile.name}`)
          // Fallback to original file if local not found
          localSelectedFiles.push(selectedFile)
        }
      }

      console.log("📁 Local selected files:", localSelectedFiles)

      // Pass local files to integrated view
      setSelectedFiles(localSelectedFiles)
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
          <div className="nav-title">File Transfer</div>
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
                      fetchFilesFromBackend(sessionId)
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
                  <div className="empty-state">No files found</div>
                ) : (
                  <>
                    <div className="files-list">
                      {files.map((file, index) => {
                        const isPdf = file.name.toLowerCase().endsWith(".pdf")
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
                              </h4>
                              <p>{formatFileSize(file.size)}</p>
                              <p>{new Date(file.uploadTime).toLocaleString()}</p>
                              {!selectionMode && (
                                <p style={{ color: "#1976d2", fontSize: "0.75rem", fontStyle: "italic" }}>
                                  Click to select files for editing
                                </p>
                              )}
                              {file.localPath && (
                                <p style={{ color: "#28a745", fontSize: "0.7rem", fontWeight: "500" }}>
                                  📁 Local: {file.localPath}
                                </p>
                              )}
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

      {/* Integrated FilePage Section - 75% width */}
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
