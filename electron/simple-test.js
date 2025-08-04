const fs = require('fs');
const path = require('path');

console.log('🧪 Simple PDF test...');

// Check the specific session directory
const sessionDir = path.join('C:', 'Users', 'msrih', 'Downloads', 'eastIT', 'files', 'pnzhsovurn');
console.log('📁 Session directory:', sessionDir);

if (fs.existsSync(sessionDir)) {
  console.log('✅ Session directory exists');
  const files = fs.readdirSync(sessionDir);
  console.log('📄 Files found:', files);
  
  for (const file of files) {
    const filePath = path.join(sessionDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  📄 ${file} - ${stats.size} bytes`);
  }
} else {
  console.log('❌ Session directory does not exist');
}

// Also check the other session
const sessionDir2 = path.join('C:', 'Users', 'msrih', 'Downloads', 'eastIT', 'files', 'sa27x5eryx');
console.log('\n📁 Session directory 2:', sessionDir2);

if (fs.existsSync(sessionDir2)) {
  console.log('✅ Session directory 2 exists');
  const files = fs.readdirSync(sessionDir2);
  console.log('📄 Files found:', files);
  
  for (const file of files) {
    const filePath = path.join(sessionDir2, file);
    const stats = fs.statSync(filePath);
    console.log(`  📄 ${file} - ${stats.size} bytes`);
  }
} else {
  console.log('❌ Session directory 2 does not exist');
} 