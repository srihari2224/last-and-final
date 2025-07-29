"use client"

import { useState } from "react"
import HomePage from "./components/HomePage"
import FileTransferPage from "./components/FileTransferPage"
import FilePage from "./components/FilePage"
import "./App.css"

function App() {
  const [currentPage, setCurrentPage] = useState("home")
  const [filePageData, setFilePageData] = useState(null)

  const goToFileTransfer = () => {
    setCurrentPage("fileTransfer")
  }

  const goToHome = () => {
    setCurrentPage("home")
    setFilePageData(null) // Clear file data when going home
  }

  const goToFilePage = (data) => {
    setFilePageData(data) // Store the selected files and session data
    setCurrentPage("filePage")
  }

  const goBackToFileTransfer = () => {
    setCurrentPage("fileTransfer")
  }

  return (
    <div className="app">
      {currentPage === "home" && (
        <HomePage onGetStarted={goToFileTransfer} />
      )}
      
      {currentPage === "fileTransfer" && (
        <FileTransferPage 
          onGoHome={goToHome} 
          onGoToFilePage={goToFilePage}
        />
      )}
      
      {currentPage === "filePage" && (
        <FilePage 
          fileData={filePageData}
          onGoHome={goToHome}
          onGoBack={goBackToFileTransfer}
        />
      )}
    </div>
  )
}

export default App