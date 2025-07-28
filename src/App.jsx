"use client"

import { useState } from "react"
import HomePage from "./components/HomePage"
import FileTransferPage from "./components/FileTransferPage"
import "./App.css"

function App() {
  const [currentPage, setCurrentPage] = useState("home")

  const goToFileTransfer = () => {
    setCurrentPage("fileTransfer")
  }

  const goToHome = () => {
    setCurrentPage("home")
  }

  return (
    <div className="app">
      {currentPage === "home" && <HomePage onGetStarted={goToFileTransfer} />}
      {currentPage === "fileTransfer" && <FileTransferPage onGoHome={goToHome} />}
    </div>
  )
}

export default App
