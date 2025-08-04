const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Test PDF print functionality
async function testPdfPrint() {
  try {
    console.log('🧪 Testing PDF print functionality...');
    
    // Test with a sample PDF file
    const testPdfPath = path.join(__dirname, 'files', 'pnzhsovurn', 'JD - SDE-1.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      console.log('❌ Test PDF not found, creating a dummy test...');
      return;
    }
    
    console.log('✅ Test PDF found:', testPdfPath);
    
    // Create a test window
    const testWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // Load the PDF
    await testWindow.loadFile(testPdfPath);
    console.log('✅ PDF loaded successfully');
    
    // Wait for PDF to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to open print dialog
    console.log('🖨️ Opening print dialog...');
    const printResult = await testWindow.webContents.print({
      silent: false,
      printBackground: true,
      color: true,
      margin: {
        marginType: 'printableArea'
      },
      landscape: false,
      pagesPerSheet: 1,
      collate: false,
      copies: 1,
      header: '',
      footer: ''
    });
    
    console.log('✅ Print dialog result:', printResult);
    
    // Keep window open for testing
    setTimeout(() => {
      testWindow.close();
      console.log('🪟 Test window closed');
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  app.whenReady().then(() => {
    testPdfPrint();
  });
}

module.exports = { testPdfPrint }; 