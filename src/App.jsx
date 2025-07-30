import { Routes, Route, Navigate } from "react-router-dom"
import FileTransferPage from "./components/FileTransferPage"
import "./App.css"

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to="/file-transfer" replace />} />
        <Route path="/file-transfer" element={<FileTransferPage />} />
      </Routes>
    </div>
  )
}

export default App
