const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const htmlPath = path.join(__dirname, 'GeoCluster_Manual.html');
const pdfPath = path.join(__dirname, 'GeoCluster_Comprehensive_Manual.pdf');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(htmlPath)) {
  console.error('Error: GeoCluster_Manual.html not found!');
  process.exit(1);
}

const tempDir = path.join(os.tmpdir(), 'chrome_pdf_tmp_' + Date.now());
fs.mkdirSync(tempDir, { recursive: true });

console.log('Compiling GeoCluster Comprehensive Manual to PDF via Headless Chrome...');
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
const cmd = `"${chromePath}" --headless=new --no-sandbox --disable-gpu --user-data-dir="${tempDir}" --print-to-pdf="${pdfPath}" "${fileUrl}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  const stats = fs.statSync(pdfPath);
  console.log(`Success! PDF generated at: ${pdfPath}`);
  console.log(`File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  console.error('Failed to generate PDF:', err.message);
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}
