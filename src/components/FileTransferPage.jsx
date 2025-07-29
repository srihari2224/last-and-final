"use client"

import { useState, useEffect } from "react"
import QRCode from "qrcode"

const FileTransferPage = ({ onGoHome, onGoToFilePage }) => {
  const [sessionId, setSessionId] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [files, setFiles] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState(new Date())
  const [pollingInterval, setPollingInterval] = useState(30000)

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

    // Cost-effective polling with configurable intervals
    let isUserActive = true;
    let pollingInterval = 30000; // 30 seconds default (cost-effective)
    let lastActivity = Date.now();
    
    // Stop polling when user switches tabs
    document.addEventListener('visibilitychange', () => {
      isUserActive = !document.hidden;
      if (isUserActive) {
        lastActivity = Date.now();
      }
    });
    
    // Track user activity to adjust polling frequency
    const trackActivity = () => {
      lastActivity = Date.now();
      // Use shorter interval when user is actively using the app
      pollingInterval = 10000; // 10 seconds when active
    };
    
    // Add activity listeners
    document.addEventListener('mousemove', trackActivity);
    document.addEventListener('click', trackActivity);
    document.addEventListener('keypress', trackActivity);
    
    // Smart polling with dynamic intervals
    const interval = setInterval(() => {
      if (isUserActive) {
        const timeSinceActivity = Date.now() - lastActivity;
        
        // Use longer intervals when user is inactive (cost-effective)
        let newInterval;
        if (timeSinceActivity > 60000) { // 1 minute of inactivity
          newInterval = 60000; // 1 minute
        } else if (timeSinceActivity > 30000) { // 30 seconds of inactivity
          newInterval = 30000; // 30 seconds
        } else {
          newInterval = 10000; // 10 seconds when active
        }
        
        setPollingInterval(newInterval);
        fetchFilesFromBackend(newSessionId);
      }
    }, pollingInterval);

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

  const endSession = async () => {
    if (!confirm(`Are you sure you want to end this session and delete ALL files? This action cannot be undone.`)) return

    try {
      // Delete all files in the session
      const deletePromises = files.map(file => 
        fetch(`https://upload-backend-api.vercel.app/api/delete-file`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session: sessionId,
            key: file.key
          })
        })
      );

      await Promise.all(deletePromises);
      
      console.log(`🗑️ Ended session: ${sessionId}`);
      alert(`Session ended successfully. All files have been deleted.`);
      
      // Clear files list
      setFiles([]);
    } catch (error) {
      console.error("❌ Error ending session:", error);
      alert("Failed to end session. Please try again.");
    }
  }

  // File selection functions for printing workflow
  const toggleFileSelection = (file) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.key === file.key);
      if (isSelected) {
        return prev.filter(f => f.key !== file.key);
      } else {
        return [...prev, file];
      }
    });
  };

  const selectAllFiles = () => {
    setSelectedFiles([...files]);
  };

  const deselectAllFiles = () => {
    setSelectedFiles([]);
  };

  const handleNextClick = () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to proceed.");
      return;
    }
    
    // Pass selected files and session data to the next page
    onGoToFilePage({
      selectedFiles,
      sessionId,
      allFiles: files
    });
  };

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
              <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                💰 Polling: {pollingInterval / 1000}s intervals 
                {pollingInterval >= 60000 ? " (Low cost)" : pollingInterval >= 30000 ? " (Medium cost)" : " (High cost)"}
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
                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={selectAllFiles}
                        style={{
                          background: "#007bff",
                          color: "#fff",
                          border: "none",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllFiles}
                        style={{
                          background: "#6c757d",
                          color: "#fff",
                          border: "none",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Deselect All
                      </button>
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>
                        Selected: {selectedFiles.length}
                      </span>
                    </div>
                  </div>
                  {files.map((file, index) => {
                    const isSelected = selectedFiles.some(f => f.key === file.key);
                    return (
                      <div 
                        key={index} 
                        className="file-item"
                        style={{
                          border: isSelected ? "2px solid #007bff" : "1px solid #e0e0e0",
                          backgroundColor: isSelected ? "#f8f9ff" : "#fff",
                          cursor: "pointer",
                          padding: "1rem",
                          borderRadius: "8px",
                          marginBottom: "0.5rem",
                        }}
                        onClick={() => toggleFileSelection(file)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFileSelection(file)}
                            style={{ margin: 0 }}
                          />
                          <div className="file-info" style={{ flex: 1 }}>
                            <h4 style={{ margin: "0 0 0.25rem 0" }}>{file.name}</h4>
                            <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.8rem", color: "#666" }}>
                              {formatFileSize(file.size)}
                            </p>
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>
                              {new Date(file.uploadTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {selectedFiles.length > 0 && (
                    <div style={{ 
                      marginTop: "1rem", 
                      padding: "1rem", 
                      background: "#e8f5e8", 
                      borderRadius: "8px",
                      border: "1px solid #28a745"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", color: "#28a745" }}>
                          📁 {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                        </span>
                        <button
                          onClick={handleNextClick}
                          style={{
                            background: "#28a745",
                            color: "#fff",
                            border: "none",
                            padding: "0.75rem 1.5rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "1rem",
                            fontWeight: "bold",
                            boxShadow: "0 2px 4px rgba(40, 167, 69, 0.3)",
                            transition: "all 0.2s ease",
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = "#218838";
                            e.target.style.transform = "translateY(-1px)";
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = "#28a745";
                            e.target.style.transform = "translateY(0)";
                          }}
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
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