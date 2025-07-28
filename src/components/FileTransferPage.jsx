"use client"

import { useState, useEffect } from "react"
import QRCode from "qrcode"

const FileTransferPage = ({ onGoHome }) => {
  const [sessionId, setSessionId] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState(new Date())

  useEffect(() => {
    // Generate unique session ID
    const newSessionId = Math.random().toString(36).substring(2, 15)
    setSessionId(newSessionId)

    // Use the S3 domain for scan.html
    const qrUrl = `http://nit-calicut.s3-website.ap-south-1.amazonaws.com/scan.html?session=${newSessionId}`

    console.log("QR Code URL:", qrUrl)

    // Generate QR code
    QRCode.toDataURL(qrUrl, {
      width: 200,
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

    // Smart polling - only when user is active
    let isUserActive = true;
    
    // Stop polling when user switches tabs
    document.addEventListener('visibilitychange', () => {
      isUserActive = !document.hidden;
    });
    
    // Poll for files every 10 seconds (reduced from 3)
    const interval = setInterval(() => {
      if (isUserActive) {
        fetchFilesFromBackend(newSessionId)
      }
    }, 10000) // 10 seconds instead of 3

    return () => clearInterval(interval)
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

      setLastChecked(new Date())
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

  const downloadFile = (fileUrl, fileName) => {
    // Create a temporary link to download the file
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = fileName
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const deleteFile = async (fileKey, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return

    try {
      const response = await fetch(`https://upload-backend-api.vercel.app/api/delete-file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: sessionId,
          key: fileKey
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      console.log(`🗑️ Deleted file: ${fileName}`)

      // Refresh file list
      fetchFilesFromBackend(sessionId)
    } catch (error) {
      console.error("❌ Error deleting file:", error)
      alert("Failed to delete file. Please try again.")
    }
  }

  return (
    <div className="file-transfer-page">
      <div className="container">
        <header className="page-header">
          <button className="back-btn" onClick={onGoHome}>
            ← Back to Home
          </button>
          <h1>File Transfer</h1>
        </header>

        <div className="main-content">
          {/* QR Code Section */}
          <div className="qr-section">
            <h2>Scan QR Code to Upload Files</h2>
            <div className="qr-container">
              {qrCodeUrl ? (
                <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code for file upload" className="qr-code" />
              ) : (
                <div className="qr-placeholder">Generating QR Code...</div>
              )}
            </div>
            <p className="session-info">Session ID: {sessionId}</p>
            <div className="status-info">
              <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
                {window.location.hostname === "localhost"
                  ? "🔧 Local Development Mode"
                  : "🌐 Production Mode - Static Website"}
              </p>
              <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                📡 Last checked: {lastChecked.toLocaleTimeString()}
                {loading && " (Checking...)"}
              </p>
            </div>
          </div>

          {/* Storage Section */}
          <div className="storage-section">
            <div className="storage-header">
              <h2>File Storage</h2>
              <button
                className="refresh-btn"
                onClick={() => fetchFilesFromBackend(sessionId)}
                disabled={loading}
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {loading ? "🔄 Checking..." : "🔄 Refresh"}
              </button>
            </div>

            <div className="storage-box">
              {files.length === 0 ? (
                <div className="no-files">
                  <p>No files uploaded yet</p>
                  <p>Scan the QR code to start uploading</p>
                  <div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#888" }}>
                    <p>📱 Files will be stored in:</p>
                    <p
                      style={{
                        fontFamily: "monospace",
                        background: "#f5f5f5",
                        padding: "0.5rem",
                        borderRadius: "4px",
                      }}
                    >
                      s3://storagenitc/{sessionId}/
                    </p>
                  </div>
                </div>
              ) : (
                <div className="files-grid">
                  <div className="files-header" style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#666" }}>
                    📁 Found {files.length} file{files.length !== 1 ? "s" : ""} in this session
                  </div>
                  {files.map((file, index) => (
                    <div key={index} className="file-item">
                      <div className="file-info">
                        <h4>{file.name}</h4>
                        <p>{formatFileSize(file.size)}</p>
                        <p>{new Date(file.uploadTime).toLocaleString()}</p>
                        <p style={{ fontSize: "0.8rem", color: "#888", fontFamily: "monospace" }}>Key: {file.key}</p>
                      </div>
                      <div className="file-actions">
                        <button className="download-btn" onClick={() => downloadFile(file.url, file.name)}>
                          📥 Download
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => deleteFile(file.key, file.name)}
                          style={{
                            background: "#dc3545",
                            color: "#fff",
                            border: "none",
                            padding: "0.5rem 1rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            marginLeft: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileTransferPage
