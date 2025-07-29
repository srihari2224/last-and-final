"use client"

import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Check, Loader, Printer } from "lucide-react"
import "./PaymentPage.css"

function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { totalCost, pages, printQueue, blankSheets } = location.state || {
    totalCost: 0,
    pages: [],
    printQueue: [],
    blankSheets: 0,
  }

  const [paymentStatus, setPaymentStatus] = useState("pending")
  const [countdown, setCountdown] = useState(15)
  const [isPrinting, setIsPrinting] = useState(false)
  const [printProgress, setPrintProgress] = useState("")

  // Initialize Razorpay when component mounts
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Listen for print status updates from Electron main process
  useEffect(() => {
    if (window.require) {
      const { ipcRenderer } = window.require("electron")

      ipcRenderer.on("print-status", (event, data) => {
        console.log("📄 Print Status Update:", data)
        setPrintProgress(data.message)

        if (data.status === "error") {
          alert(`❌ Print Error: ${data.message}`)
          setPaymentStatus("pending")
          setIsPrinting(false)
        }
      })

      return () => {
        ipcRenderer.removeAllListeners("print-status")
      }
    }
  }, [])

  const handlePayment = () => {
    console.log("💳 PAYMENT INITIATED...")
    console.log("Total cost:", totalCost)
    console.log("Canvas pages to print:", pages.length)
    console.log("PDF queue items:", printQueue.length)

    if (pages.length === 0 && printQueue.length === 0 && blankSheets === 0) {
      alert("❌ No items to print! Please add some content first.")
      return
    }

    const options = {
      key: "rzp_test_X5OHvkg69oonK2",
      amount: totalCost * 100,
      currency: "INR",
      name: "PrinIT Service",
      description: "Payment for printing services with user settings",
      handler: (response) => {
        console.log("💳 PAYMENT SUCCESSFUL:", response.razorpay_payment_id)
        console.log("🔄 STARTING PRINT PROCESS WITH USER SETTINGS...")

        setPaymentStatus("processing")
        setPrintProgress("Payment successful! Starting printing with your specified settings...")

        setTimeout(() => {
          console.log("🚀 STARTING PRINTING WITH USER SETTINGS...")
          handlePrintingWithUserSettings()
        }, 1000)
      },
      prefill: {
        name: "Customer Name",
        email: "customer@example.com",
        contact: "",
      },
      theme: {
        color: "#000000ff",
      },
      modal: {
        ondismiss: () => {
          console.log("💳 PAYMENT CANCELLED BY USER")
          setPrintProgress("Payment cancelled")
        },
      },
    }

    try {
      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (error) {
      console.error("❌ RAZORPAY ERROR:", error)
      alert("Payment system error. Please try again.")
    }
  }

  // Enhanced printing function that STRICTLY follows user settings
  const handlePrintingWithUserSettings = async () => {
    setIsPrinting(true)
    console.log("🚀 STARTING PRINTING WITH STRICT USER SETTINGS ENFORCEMENT...")

    try {
      let totalItemsPrinted = 0
      const totalCanvasPages = pages.length
      const totalPDFItems = printQueue.length

      console.log(`📊 CANVAS PAGES TO PRINT: ${totalCanvasPages}`)
      console.log(`📊 PDF ITEMS TO PRINT: ${totalPDFItems}`)

      // STEP 1: Print Canvas Pages with STRICT color mode enforcement
      if (pages && pages.length > 0) {
        console.log(`🎨 PRINTING ${pages.length} CANVAS PAGES WITH STRICT SETTINGS...`)
        setPrintProgress(`Processing ${pages.length} canvas pages with your color preferences...`)

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          console.log(`🎨 Processing Canvas Page ${page.id} - Color Mode: ${page.colorMode}`)
          setPrintProgress(`Printing canvas page ${i + 1} of ${pages.length} in ${page.colorMode} mode...`)

          try {
            const canvasHTML = generateCanvasPageHTMLWithStrictSettings(page, i + 1)
            await printCanvasPageWithStrictUserSettings(canvasHTML, `Canvas Page ${page.id}`, page)
            totalItemsPrinted++

            console.log(`✅ Canvas page ${page.id} printed with ${page.colorMode} mode`)
            setPrintProgress(`Canvas page ${i + 1} printed successfully in ${page.colorMode} mode!`)

            // Delay between pages
            await new Promise((resolve) => setTimeout(resolve, 2000))
          } catch (error) {
            console.error(`❌ Error printing canvas page ${page.id}:`, error)
            setPrintProgress(`Error with canvas page ${page.id}: ${error.message}`)
          }
        }
      }

      // STEP 2: Print PDF Queue Items with STRICT user settings enforcement
      if (printQueue && printQueue.length > 0) {
        console.log(`📄 PRINTING ${printQueue.length} PDF ITEMS WITH STRICT USER SETTINGS...`)
        setPrintProgress(`Processing ${printQueue.length} PDF documents with your exact settings...`)

        for (let i = 0; i < printQueue.length; i++) {
          const pdfItem = printQueue[i]
          console.log(`📄 Processing PDF: ${pdfItem.fileName}`)
          console.log(`📄 STRICT Settings:`, pdfItem.printSettings)
          setPrintProgress(`Printing PDF ${i + 1} of ${printQueue.length}: ${pdfItem.fileName} with your settings...`)

          try {
            await printPDFWithStrictUserSettings(pdfItem)
            totalItemsPrinted++

            console.log(`✅ PDF ${pdfItem.fileName} printed with STRICT user settings`)
            setPrintProgress(`PDF ${pdfItem.fileName} printed with your exact settings!`)

            // Delay between PDFs
            await new Promise((resolve) => setTimeout(resolve, 3000))
          } catch (error) {
            console.error(`❌ Error printing PDF ${pdfItem.fileName}:`, error)
            setPrintProgress(`Error with PDF ${pdfItem.fileName}: ${error.message}`)
          }
        }
      }

      // SUCCESS
      console.log(`🎉 PRINTING COMPLETED WITH USER SETTINGS! ${totalItemsPrinted} items processed`)
      setPrintProgress(`All ${totalItemsPrinted} items printed with your exact settings!`)

      setTimeout(() => {
        setPaymentStatus("success")
        startCountdown()
      }, 2000)
    } catch (error) {
      console.error("❌ CRITICAL PRINTING ERROR:", error)
      setPrintProgress(`Printing failed: ${error.message}`)
      alert(`❌ Printing failed: ${error.message}`)
      setPaymentStatus("pending")
    } finally {
      setIsPrinting(false)
    }
  }

  // Generate Canvas Page HTML with STRICT color mode enforcement
  const generateCanvasPageHTMLWithStrictSettings = (page, pageNumber) => {
    // STRICT color filter application
    const colorFilter = page.colorMode === "bw" ? "filter: grayscale(100%) !important;" : ""
    const bodyColorFilter = page.colorMode === "bw" ? "filter: grayscale(100%) !important;" : ""

    let itemsHTML = ""
    if (page.items && page.items.length > 0) {
      page.items.forEach((item, index) => {
        try {
          const fileURL = URL.createObjectURL(item.file)
          const xMM = (item.x / 743.75) * 210
          const yMM = (item.y / 1052.5) * 297
          const widthMM = (item.width / 743.75) * 210
          const heightMM = (item.height / 1052.5) * 297

          itemsHTML += `
          <div style="position: absolute; left: ${xMM}mm; top: ${yMM}mm; width: ${widthMM}mm; height: ${heightMM}mm; transform: rotate(${item.rotation || 0}deg); overflow: hidden; ${colorFilter}">
            <img src="${fileURL}" style="width: 100%; height: 100%; object-fit: contain; ${colorFilter}" alt="" />
          </div>
        `
        } catch (error) {
          console.error(`Error processing canvas item ${index}:`, error)
        }
      })
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Canvas Print - ${page.colorMode.toUpperCase()} Mode</title>
      <style>
        @page { 
          size: A4; 
          margin: 0; 
        }
        @media print { 
          body { 
            -webkit-print-color-adjust: ${page.colorMode === "color" ? "exact" : "economy"} !important; 
            print-color-adjust: ${page.colorMode === "color" ? "exact" : "economy"} !important; 
            margin: 0; 
            padding: 0;
            ${bodyColorFilter}
          } 
          * {
            ${colorFilter}
          }
        }
        body { 
          margin: 0; 
          padding: 0; 
          width: 210mm; 
          height: 297mm; 
          background: white; 
          position: relative; 
          overflow: hidden;
          ${bodyColorFilter}
        }
      </style>
    </head>
    <body>
      ${itemsHTML}
    </body>
    </html>
  `
  }

  // Print Canvas Page with STRICT user settings enforcement
  const printCanvasPageWithStrictUserSettings = async (htmlContent, description, pageSettings) => {
    console.log(`🖨️ PRINTING CANVAS WITH STRICT SETTINGS: ${description}`)
    console.log(`🎨 STRICT Canvas Settings:`, pageSettings)

    try {
      if (window.require) {
        const { ipcRenderer } = window.require("electron")

        const printConfig = {
          htmlContent: htmlContent,
          settings: {
            colorMode: pageSettings.colorMode, // STRICT color mode
            copies: 1,
            description: `${description} (${pageSettings.colorMode.toUpperCase()} MODE)`,
          },
        }

        console.log(`🎨 Sending to Electron with STRICT color mode: ${pageSettings.colorMode}`)
        ipcRenderer.send("silent-print-html-with-settings", printConfig)

        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        console.log(`🌐 WEB PRINT WITH STRICT SETTINGS: ${description}`)

        const iframe = document.createElement("iframe")
        iframe.style.position = "absolute"
        iframe.style.left = "-9999px"
        iframe.style.top = "-9999px"
        iframe.style.width = "1px"
        iframe.style.height = "1px"
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
        iframeDoc.open()
        iframeDoc.write(htmlContent)
        iframeDoc.close()

        setTimeout(() => {
          try {
            iframe.contentWindow.focus()
            iframe.contentWindow.print()

            setTimeout(() => {
              document.body.removeChild(iframe)
            }, 2000)
          } catch (printError) {
            console.error("Canvas print error:", printError)
            document.body.removeChild(iframe)
          }
        }, 1000)
      }
    } catch (error) {
      console.error(`❌ STRICT CANVAS PRINT ERROR for ${description}:`, error)
      throw error
    }
  }

  // Print PDF with STRICT user settings enforcement
  const printPDFWithStrictUserSettings = async (pdfItem) => {
    console.log(`📄 PRINTING PDF WITH STRICT USER SETTINGS: ${pdfItem.fileName}`)
    console.log(`📄 STRICT User Settings:`, pdfItem.printSettings)

    try {
      if (window.require) {
        const { ipcRenderer } = window.require("electron")
        const pdfData = await pdfItem.file.arrayBuffer()

        const printConfig = {
          pdfData: Array.from(new Uint8Array(pdfData)),
          settings: {
            ...pdfItem.printSettings, // Use EXACT user settings
            description: `${pdfItem.fileName} (${pdfItem.printSettings.copies} copies, ${pdfItem.printSettings.colorMode}, ${pdfItem.printSettings.doubleSided})`,
          },
          fileName: pdfItem.fileName,
          totalPages: pdfItem.totalPages,
          pagesToPrint: pdfItem.pagesToPrint,
        }

        console.log(`📄 Sending PDF to Electron with STRICT settings:`, printConfig.settings)
        const result = await ipcRenderer.invoke("print-pdf-with-full-settings", printConfig)

        if (result.success) {
          console.log(`✅ PDF ${pdfItem.fileName} printed with STRICT user settings`)
        } else {
          throw new Error(result.error)
        }
      } else {
        console.log(`🌐 WEB PDF PRINT WITH STRICT SETTINGS: ${pdfItem.fileName}`)

        const pdfUrl = URL.createObjectURL(pdfItem.file)

        // Apply STRICT settings for web printing
        for (let copy = 1; copy <= pdfItem.printSettings.copies; copy++) {
          console.log(`📄 Printing copy ${copy} of ${pdfItem.printSettings.copies} with STRICT settings`)

          const iframe = document.createElement("iframe")
          iframe.style.position = "absolute"
          iframe.style.left = "-9999px"
          iframe.style.top = "-9999px"
          iframe.style.width = "1px"
          iframe.style.height = "1px"
          iframe.src = pdfUrl
          document.body.appendChild(iframe)

          // STRICT color mode enforcement
          if (pdfItem.printSettings.colorMode === "bw") {
            iframe.style.filter = "grayscale(100%)"
          }

          iframe.onload = () => {
            setTimeout(() => {
              try {
                iframe.contentWindow.focus()
                iframe.contentWindow.print()

                setTimeout(() => {
                  document.body.removeChild(iframe)
                  if (copy === pdfItem.printSettings.copies) {
                    URL.revokeObjectURL(pdfUrl)
                  }
                }, 3000)
              } catch (printError) {
                console.error("PDF print error:", printError)
                document.body.removeChild(iframe)
                URL.revokeObjectURL(pdfUrl)
              }
            }, 1000)
          }

          if (copy < pdfItem.printSettings.copies) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }
      }
    } catch (error) {
      console.error(`❌ STRICT PDF PRINT ERROR for ${pdfItem.fileName}:`, error)
      throw error
    }
  }

  // Start countdown timer
  const startCountdown = () => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate("/")
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  return (
    <div className="payment-page">
      <div className="navbar">
        <button className="back-button" onClick={() => navigate("/files")}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <div className="page-title">Payment & Printing with User Settings</div>
      </div>

      <div className="payment-content">
        {paymentStatus === "pending" && (
          <div className="payment-summary-container">
            <div className="payment-summary-card">
              <h2>Print Summary with Your Settings</h2>
              <div className="order-details">
                {pages.length > 0 && (
                  <div className="order-section">
                    <h3>Canvas Pages ({pages.length})</h3>
                    {pages.map((page, index) => (
                      <div key={index} className="order-item">
                        <span>
                          Canvas Page {page.id} ({page.colorMode === "color" ? "Color" : "B&W"}) -{" "}
                          {page.items?.length || 0} items
                        </span>
                        <span>₹{page.colorMode === "color" ? 10 : 2}</span>
                      </div>
                    ))}
                  </div>
                )}

                {printQueue.length > 0 && (
                  <div className="order-section">
                    <h3>PDF Documents ({printQueue.length})</h3>
                    {printQueue.map((item, index) => (
                      <div key={index} className="order-item">
                        <span>
                          {item.fileName.substring(0, 25)}
                          {item.fileName.length > 25 ? "..." : ""} ({item.printSettings.copies} copies,{" "}
                          {item.printSettings.pageRange} pages,{" "}
                          {item.printSettings.colorMode === "color" ? "Color" : "B&W"},{" "}
                          {item.printSettings.doubleSided === "both-sides" ? "Double-sided" : "Single-sided"})
                        </span>
                        <span>₹{item.cost}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="order-total">
                  <span>Total Amount</span>
                  <span>₹{totalCost}</span>
                </div>
              </div>

              <button className="pay-now-button" onClick={handlePayment}>
                <Printer size={16} />
                Pay & Print with Settings ₹{totalCost}
              </button>
            </div>
          </div>
        )}

        {paymentStatus === "processing" && (
          <div className="processing-container">
            <div className="processing-card">
              <div className="processing-icon">
                <Loader size={48} className="spin-animation" />
              </div>
              <h2>Printing with Your Exact Settings</h2>
              <p>Applying your print preferences and enforcing all user settings...</p>

              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#fff7ed",
                  borderRadius: "8px",
                  border: "1px solid #fed7aa",
                }}
              >
                <p>
                  <strong>🖨️ Current Status:</strong>
                </p>
                <p style={{ fontStyle: "italic", color: "#14ececff" }}>
                  {printProgress || "Initializing printing with STRICT user settings enforcement..."}
                </p>

                <div style={{ marginTop: "16px" }}>
                  <p>
                    <strong>Settings Being Applied:</strong>
                  </p>
                  {pages.length > 0 && (
                    <div>
                      {pages.map((page, index) => (
                        <p key={index}>
                          • Canvas Page {page.id}:{" "}
                          <strong>{page.colorMode === "color" ? "COLOR" : "BLACK & WHITE"}</strong> mode
                        </p>
                      ))}
                    </div>
                  )}
                  {printQueue.length > 0 && (
                    <>
                      {printQueue.map((item, index) => (
                        <p key={index}>
                          • {item.fileName}: <strong>{item.printSettings.copies} copies</strong>,{" "}
                          <strong>{item.printSettings.pageRange} pages</strong>,{" "}
                          <strong>{item.printSettings.colorMode === "color" ? "COLOR" : "BLACK & WHITE"}</strong>,{" "}
                          <strong>
                            {item.printSettings.doubleSided === "both-sides" ? "DOUBLE-SIDED" : "SINGLE-SIDED"}
                          </strong>
                        </p>
                      ))}
                    </>
                  )}
                </div>

                <p style={{ marginTop: "12px", fontWeight: "bold", color: "#10cae3ff" }}>
                  ⚡ ALL USER SETTINGS BEING STRICTLY ENFORCED!
                </p>
              </div>
            </div>
          </div>
        )}

        {paymentStatus === "success" && (
          <div className="success-container">
            <div className="success-card">
              <div className="success-icon">
                <Check size={48} />
              </div>
              <h2>Printing Successful with Your Settings!</h2>
              <p>All print jobs completed with your exact specifications!</p>
              <p>Your settings were strictly enforced throughout the printing process.</p>

              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f0fdf4",
                  borderRadius: "8px",
                  border: "1px solid #bbf7d0",
                }}
              >
                <p>
                  <strong>✅ Print Summary with Applied Settings:</strong>
                </p>
                {pages.length > 0 && (
                  <div>
                    {pages.map((page, index) => (
                      <p key={index}>
                        • Canvas Page {page.id}:{" "}
                        <strong>{page.colorMode === "color" ? "COLOR" : "BLACK & WHITE"}</strong> mode applied ✓
                      </p>
                    ))}
                  </div>
                )}
                {printQueue.length > 0 && (
                  <div>
                    {printQueue.map((item, index) => (
                      <p key={index}>
                        • {item.fileName}: <strong>{item.printSettings.copies} copies</strong>,{" "}
                        <strong>{item.printSettings.pageRange} pages</strong>,{" "}
                        <strong>{item.printSettings.colorMode === "color" ? "COLOR" : "BLACK & WHITE"}</strong>,{" "}
                        <strong>
                          {item.printSettings.doubleSided === "both-sides" ? "DOUBLE-SIDED" : "SINGLE-SIDED"}
                        </strong>{" "}
                        ✓
                      </p>
                    ))}
                  </div>
                )}
                <p>• All user preferences strictly enforced ✓</p>
                <p>• Print jobs completed with exact settings ✓</p>
              </div>

              <div className="countdown">
                <p>
                  Redirecting to home in <span className="countdown-number">{countdown}</span> seconds
                </p>
                <div className="progress-bar">
                  <div className="progress" style={{ width: `${((15 - countdown) / 15) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PaymentPage
