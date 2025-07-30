"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./FileTransferPage.css"
import sessionIcon from "../assets/session.svg"
import storageIcon from "../assets/storage.svg"
import wifiIcon from "../assets/wifi.svg"

const FileTransferPage = () => {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showFiles, setShowFiles] = useState(false)

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
    window.addEventListener('online', handleOnlineStatus)
    window.addEventListener('offline', handleOnlineStatus)

    // Real-time clock update
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Polling for files
    const interval = setInterval(() => {
      fetchFilesFromBackend(newSessionId)
    }, 3000000)

    return () => {
      clearInterval(interval)
      clearInterval(timeInterval)
      window.removeEventListener('online', handleOnlineStatus)
      window.removeEventListener('offline', handleOnlineStatus)
    }
  }, [])

  const fetchFilesFromBackend = async (sessionId) => {
    try {
      setLoading(true)
      console.log(`🔍 Fetching files for session: ${sessionId}`)

      // Call backend API to get files
      const response = await fetch(`https://upload-backend-api.vercel.app/api/list-files?session=${sessionId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("📁 Backend Response:", data)

      if (data.files && data.files.length > 0) {
        setFiles(data.files)
        console.log(`✅ Found ${data.files.length} files:`, data.files)
      } else {
        setFiles([])
        console.log("📭 No files found for this session")
      }
    } catch (error) {
      console.error("❌ Error fetching files from backend:", error)
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
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const handleStorageBoxClick = () => {
    if (!showFiles) {
      setShowFiles(true)
      fetchFilesFromBackend(sessionId)
    }
    // If showFiles is true, do nothing - only refresh button should work
  }

  return (
    <div className="file-transfer-page">
      <div className="navbar">
        <div className="nav-content">
          <div className="nav-title">File Transfer</div>
          <div className="nav-status">
            <div className="wifi-status">
              <img src={wifiIcon} alt="WiFi" className="wifi-icon" />
              <span className={`status-text ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="time-display">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="qr-section">
          <h2>Scan QR Code to Upload Files</h2>
          <div className="qr-container">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code for file upload" className="qr-code" />
            ) : (
              <div className="qr-placeholder">Generating QR Code...</div>
            )}
          </div>
          <div className="session-info">
            <img src={sessionIcon} alt="Session" className="session-icon" />
            <span className="session-id">{sessionId}</span>
          </div>
        </div>

        <div className="storage-section">
          <div className={`storage-box ${showFiles ? 'files-mode' : ''}`} onClick={handleStorageBoxClick}>
            {!showFiles ? (
              <div className="storage-box-blur">
                <img src={storageIcon} alt="Storage" className="storage-icon" />
                <span className="storage-text">Storage</span>
              </div>
            ) : (
              <div className="files-display" onClick={(e) => e.stopPropagation()}>
                <div className="files-header">
                  <h3 className="files-title">Files</h3>
                  <button 
                    className="refresh-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchFilesFromBackend(sessionId);
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
                  <div className="files-list">
                    {files.map((file, index) => (
                      <div key={index} className="file-item">
                        <div className="file-info">
                          <h4>{file.name}</h4>
                          <p>{formatFileSize(file.size)}</p>
                          <p>{new Date(file.uploadTime).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileTransferPage