"use client"

const HomePage = ({ onGetStarted }) => {
  return (
    <div className="home-page">
      <div className="container">
        <div className="hero-section">
          <h1 className="main-heading">File Transfer System</h1>
          <p className="subtitle">Share files instantly with QR code scanning</p>
          <button className="get-started-btn" onClick={onGetStarted}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomePage
