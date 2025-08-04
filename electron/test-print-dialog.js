const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Test the print dialog functionality
async function testPrintDialog() {
  try {
    console.log('🧪 Testing print dialog functionality...');
    
    // Test with a sample PDF file
    const testPdfPath = path.join('C:', 'Users', 'msrih', 'Downloads', 'eastIT', 'files', 'ea1gv3hasll', 'letter to director-1.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      console.log('❌ Test PDF not found:', testPdfPath);
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
    testWindow.webContents.print({
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
    
    console.log('✅ Print dialog opened successfully');
    
    // Keep window open for testing
    setTimeout(() => {
      if (!testWindow.isDestroyed()) {
        testWindow.close();
        console.log('🪟 Test window closed');
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  app.whenReady().then(() => {
    testPrintDialog();
  });
}

module.exports = { testPrintDialog }; 