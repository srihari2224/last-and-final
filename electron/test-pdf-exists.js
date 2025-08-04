const fs = require('fs');
const path = require('path');

// Test if PDF files exist and are accessible
function testPdfFiles() {
  console.log('🧪 Testing PDF file accessibility...');
  
  const baseDir = path.join('C:', 'Users', 'msrih', 'Downloads', 'eastIT', 'files');
  console.log('📁 Base directory:', baseDir);
  
  if (!fs.existsSync(baseDir)) {
    console.log('❌ Base directory does not exist');
    return;
  }
  
  const sessions = fs.readdirSync(baseDir);
  console.log('📂 Found sessions:', sessions);
  
  for (const session of sessions) {
    const sessionDir = path.join(baseDir, session);
    console.log(`\n📁 Checking session: ${session}`);
    
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      console.log(`📄 Files in ${session}:`, files);
      
      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        const stats = fs.statSync(filePath);
        const isPdf = file.toLowerCase().endsWith('.pdf');
        
        console.log(`  📄 ${file} (${isPdf ? 'PDF' : 'Other'}) - ${stats.size} bytes`);
        
        if (isPdf) {
          console.log(`    ✅ PDF file accessible: ${filePath}`);
        }
      }
    }
  }
}

// Run the test
testPdfFiles(); 