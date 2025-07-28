"use client"

import { useState, useEffect } from "react"
import QRCode from "qrcode"
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3"

// Configure AWS SDK

const FILE_STORAGE_BUCKET = import.meta.env.VITE_FILE_STORAGE_BUCKET

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

    // Replace with your actual S3 static website URL
    const staticWebsiteUrl = "http://nitc.s3-website.ap-south-1.amazonaws.com/"
    const qrUrl = `${staticWebsiteUrl}scan.html?session=${newSessionId}`

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
    fetchFilesFromS3(newSessionId)

    // Poll for files every 3 seconds
    const interval = setInterval(() => {
      fetchFilesFromS3(newSessionId)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const fetchFilesFromS3 = async (sessionId) => {
    try {
      setLoading(true)
      console.log(`🔍 Fetching files for session: ${sessionId}`)

      // List objects in S3 bucket with session prefix
      const params = {
        Bucket: FILE_STORAGE_BUCKET,
        Prefix: `${sessionId}/`, // Only get files for this session
      }

      const command = new ListObjectsV2Command(params)
      const data = await s3.send(command)
      console.log("📁 S3 Response:", data)

      if (data.Contents && data.Contents.length > 0) {
        // Convert S3 objects to file objects
        const fileList = data.Contents.map((item) => {
          // Extract original filename (remove timestamp prefix)
          const originalName = item.Key.split("/").pop().replace(/^\d+-/, "")

          return {
            key: item.Key,
            name: originalName,
            size: item.Size,
            uploadTime: item.LastModified,
            url: `https://${FILE_STORAGE_BUCKET}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${item.Key}`,
          }
        })

        // Sort by upload time (newest first)
        fileList.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime))

        setFiles(fileList)
        console.log(`✅ Found ${fileList.length} files:`, fileList)
      } else {
        setFiles([])
        console.log("📭 No files found for this session")
      }

      setLastChecked(new Date())
    } catch (error) {
      console.error("❌ Error fetching files from S3:", error)
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
      const params = {
        Bucket: FILE_STORAGE_BUCKET,
        Key: fileKey,
      }

      const command = new DeleteObjectCommand(params)
      await s3.send(command)
      console.log(`🗑️ Deleted file: ${fileName}`)

      // Refresh file list
      fetchFilesFromS3(sessionId)
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
                onClick={() => fetchFilesFromS3(sessionId)}
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
                      s3://{FILE_STORAGE_BUCKET}/{sessionId}/
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
