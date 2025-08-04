const { ipcRenderer } = require("electron");
const pdfjsLib = require("pdfjs-dist/build/pdf");
require("pdfjs-dist/build/pdf.worker.entry");

const urlParams = new URLSearchParams(window.location.search);
const pdfPath = decodeURIComponent(urlParams.get("file"));
const canvas = document.getElementById("pdf-canvas");
const ctx = canvas.getContext("2d");
const pageInfo = document.getElementById("pageInfo");

let pdfDocument = null;
let currentPage = 1;
let totalPages = 0;

// Load and render PDF
async function loadPDF() {
  try {
    console.log('📄 Loading PDF:', pdfPath);
    
    pdfDocument = await pdfjsLib.getDocument(pdfPath).promise;
    totalPages = pdfDocument.numPages;
    
    console.log(`📄 PDF loaded: ${totalPages} pages`);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Render first page
    await renderPage(1);
    
  } catch (error) {
    console.error('❌ Error loading PDF:', error);
    pageInfo.textContent = 'Error loading PDF';
  }
}

// Render a specific page
async function renderPage(pageNum) {
  try {
    const page = await pdfDocument.getPage(pageNum);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext);
    currentPage = pageNum;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
  } catch (error) {
    console.error('❌ Error rendering page:', error);
  }
}

// Handle print button click
document.getElementById("printBtn").onclick = async () => {
  try {
    const copies = parseInt(document.getElementById("copies").value);
    const range = document.getElementById("range").value;
    const duplex = document.getElementById("duplex").checked;
    const color = document.getElementById("color").checked;

    console.log('🖨️ Print options:', { copies, range, duplex, color });

    // Send to main process for silent printing
    ipcRenderer.send("print-pdf-silent", {
      path: pdfPath,
      options: { 
        copies, 
        range: range || 'all', 
        duplex, 
        color 
      }
    });

    // Show success message
    const printBtn = document.getElementById("printBtn");
    const originalText = printBtn.textContent;
    printBtn.textContent = "✅ Sent to Print Queue";
    printBtn.style.background = "#28a745";
    
    setTimeout(() => {
      printBtn.textContent = originalText;
      printBtn.style.background = "#28a745";
    }, 2000);

  } catch (error) {
    console.error('❌ Error sending print job:', error);
    alert('Error sending print job: ' + error.message);
  }
};

// Handle page navigation
document.addEventListener('keydown', async (e) => {
  if (!pdfDocument) return;
  
  if (e.key === 'ArrowLeft' && currentPage > 1) {
    await renderPage(currentPage - 1);
  } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
    await renderPage(currentPage + 1);
  }
});

// Load PDF when page loads
window.addEventListener('load', loadPDF); 