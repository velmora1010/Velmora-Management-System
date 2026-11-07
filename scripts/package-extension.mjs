import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

const ROOT_DIR = process.cwd();
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');
const PUBLIC_DOWNLOADS_DIR = path.join(ROOT_DIR, 'public', 'downloads');
const RELEASE_CONFIG_PATH = path.join(
  ROOT_DIR,
  'src',
  'modules',
  'marketing',
  'rnd',
  'config',
  'extensionReleaseConfig.ts'
);

const PACKAGE_ROOT_FOLDER = 'Velmora-Instagram-Companion';

// Security patterns that must NEVER appear inside packaged extension files
const FORBIDDEN_SECRET_PATTERNS = [
  { name: 'Supabase Service Role Key', regex: /SUPABASE_SERVICE_ROLE_KEY/i },
  { name: 'JWT / Service Token (eyJ...)', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Hardcoded Secret Assignment', regex: /(api_secret|client_secret|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/i }
];

// Excluded development / OS / temporary files
const EXCLUDED_PATTERNS = [
  /^\.git/i,
  /node_modules/i,
  /\.test\.[jt]sx?$/i,
  /\.spec\.[jt]sx?$/i,
  /\.DS_Store$/i,
  /Thumbs\.db$/i,
  /\.map$/i,
  /\.log$/i,
  /\.tmp$/i,
  /\.env/i
];

function collectExtensionFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (EXCLUDED_PATTERNS.some((re) => re.test(entry.name) || re.test(relPath))) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...collectExtensionFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push({ fullPath, relPath });
    }
  }

  return files;
}

function validateExtensionAndSecurity(manifest, files) {
  if (manifest.manifest_version !== 3) {
    throw new Error(`Invalid manifest_version: expected 3, got ${manifest.manifest_version}`);
  }
  if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(`Invalid manifest version: ${manifest.version}`);
  }

  const referencedFiles = new Set(['manifest.json']);
  if (manifest.background?.service_worker) {
    referencedFiles.add(manifest.background.service_worker);
  }
  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      for (const jsFile of cs.js || []) referencedFiles.add(jsFile);
      for (const cssFile of cs.css || []) referencedFiles.add(cssFile);
    }
  }
  if (manifest.action?.default_popup) {
    referencedFiles.add(manifest.action.default_popup);
  }
  if (manifest.icons) {
    for (const iconPath of Object.values(manifest.icons)) {
      referencedFiles.add(String(iconPath));
    }
  }

  const packagedSet = new Set(files.map((f) => f.relPath));
  for (const reqFile of referencedFiles) {
    if (!packagedSet.has(reqFile)) {
      throw new Error(`Manifest references missing production file: ${reqFile}`);
    }
  }

  // Verify version synchronization with background.js
  const bgFile = files.find((f) => f.relPath === manifest.background?.service_worker);
  if (!bgFile) {
    throw new Error('Background service worker file not found in extension files.');
  }
  const bgContent = fs.readFileSync(bgFile.fullPath, 'utf8');
  const versionMatch = bgContent.match(/const\s+EXTENSION_VERSION\s*=\s*["']([^"']+)["']/);
  if (!versionMatch) {
    throw new Error('EXTENSION_VERSION constant not found in background.js');
  }
  if (versionMatch[1] !== manifest.version) {
    throw new Error(
      `Version mismatch: manifest.json is "${manifest.version}" but background.js EXTENSION_VERSION is "${versionMatch[1]}"`
    );
  }

  // Scan all files for forbidden secrets/credentials
  for (const file of files) {
    const content = fs.readFileSync(file.fullPath, 'utf8');
    for (const rule of FORBIDDEN_SECRET_PATTERNS) {
      if (rule.regex.test(content)) {
        throw new Error(`Security check failed: ${rule.name} detected in extension/${file.relPath}`);
      }
    }
  }
}

function generateReadmeTxt(version) {
  return `===============================================================================
VELMORA INSTAGRAM COMPANION — CHROME EXTENSION & SETUP PACKAGE (v${version})
===============================================================================

WHAT IS INSIDE THIS ZIP?
------------------------
  Velmora-Instagram-Companion/
    |-- extension/              <-- SELECT THIS FOLDER IN CHROME "LOAD UNPACKED"
    |     |-- manifest.json
    |     |-- src/
    |           |-- background.js
    |           |-- content-app.js
    |-- SETUP-GUIDE.pdf         <-- Illustrated step-by-step installation guide
    |-- README.txt              <-- Quick instructions & troubleshooting (this file)

-------------------------------------------------------------------------------
QUICK INSTALLATION STEPS (GOOGLE CHROME)
-------------------------------------------------------------------------------

STEP 1: EXTRACT (UNZIP) THIS ARCHIVE FIRST
  - Right-click the downloaded "Velmora-Instagram-Companion-v${version}.zip" file.
  - Click "Extract All..." (Windows) or double-click (Mac) to unzip it to a
    permanent folder on your computer (for example: Documents or Desktop).
  - IMPORTANT: Do NOT delete or move the extracted folder after installing,
    because Chrome loads the extension directly from that folder.

STEP 2: OPEN CHROME EXTENSIONS
  - Open Google Chrome.
  - In the top address bar, type:
      chrome://extensions
    and press Enter.

STEP 3: ENABLE DEVELOPER MODE
  - Look at the top-right corner of the chrome://extensions page.
  - Switch the "Developer mode" toggle to ON.

STEP 4: LOAD THE UNPACKED EXTENSION FOLDER
  - Click the "Load unpacked" button in the top-left corner.
  - Open the extracted "Velmora-Instagram-Companion" folder.
  - Click the inner "extension" folder (the folder that contains manifest.json)
    and click "Select Folder".

STEP 5: CONFIRM & PIN THE EXTENSION
  - Confirm that "Velmora Influencer R&D" (Version ${version}) appears in your
    extensions list and its blue toggle switch is ON.
  - Click the puzzle-piece (Extensions) icon in the top-right Chrome toolbar
    and click the Pin icon next to "Velmora Influencer R&D".

STEP 6: CONNECT TO VELMORA & START RESEARCH
  - Open the Velmora Management System in Chrome (refresh the tab with F5 if
    it was already open).
  - Go to Marketing -> Influencer R&D.
  - Click "Check Connection" in the top-right corner.
  - Verify that:
      1) "Chrome Extension" shows "Connected" (Version ${version})
      2) "Instagram Session" shows "Session Detected"
         (If it says "Login Required", click "Open Instagram" and log in.)

-------------------------------------------------------------------------------
HOW TO USE THE INSTAGRAM COMPANION WINDOW & GLOBAL MINIPLAYER
-------------------------------------------------------------------------------
  - When you start a research batch, the extension opens a dedicated
    "Instagram Companion Window" to scroll creator Reels automatically.
  - Keep the Instagram Companion window OPEN and UNMINIMIZED while research
    is running.
  - If the Companion window is minimized or completely covered by another
    window, scraping will automatically pause ("Paused — Instagram Companion
    window appears to be covered") so no profiles fail. Simply bring the
    Companion window back to the front to resume automatically.
  - You can switch to any other Velmora department (Sales, Logistics, Finance,
    Inventory, etc.) at any time — the Global MiniPlayer stays visible in the
    bottom-right corner of Velmora so you can monitor, pause, or stop the batch.

-------------------------------------------------------------------------------
TROUBLESHOOTING COMMON ERRORS
-------------------------------------------------------------------------------

1. ERROR: "Manifest file is missing or unreadable"
   CAUSE: You selected the outer "Velmora-Instagram-Companion" folder or tried
          to load from inside the unextracted .zip file.
   FIX:   Extract the .zip file first, open "Velmora-Instagram-Companion", and
          select the inner "extension" folder.

2. PROBLEM: Velmora says Chrome Extension "Not Detected"
   CAUSE: The Velmora tab was opened before the extension was installed, or the
          extension toggle is switched off.
   FIX:   1) Go to chrome://extensions and verify "Velmora Influencer R&D" is ON.
          2) Refresh the Velmora tab (press F5).
          3) Click the "Check Connection" button in Influencer R&D.

3. PROBLEM: Instagram Session shows "Login Required" or "Not Available"
   CAUSE: You are not logged into Instagram in this Chrome profile.
   FIX:   Click "Open Instagram" (or visit https://www.instagram.com), sign in
          to your work Instagram account, return to Velmora, and click
          "Check Connection".

4. PROBLEM: Batch says "Paused — Instagram Companion window appears to be covered"
   CAUSE: Chrome throttles background rendering when the Companion window is
          minimized or completely hidden behind another maximized window.
   FIX:   Click the Instagram Companion window on your taskbar to bring it to
          the front. Research will resume automatically within 2-3 seconds.

===============================================================================
Velmora Management System — Internal Distribution Package (v${version})
===============================================================================
`;
}

function drawBrowserIllustration(doc, x, y, w, h, title, urlText, drawBody) {
  // Outer window frame
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Top browser chrome bar
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(x, y, w, 7, 2, 2, 'F');
  doc.rect(x, y + 4, w, 3, 'F');

  // Window traffic dots
  doc.setFillColor(239, 68, 68);
  doc.circle(x + 3.5, y + 3.5, 1, 'F');
  doc.setFillColor(245, 158, 11);
  doc.circle(x + 6.5, y + 3.5, 1, 'F');
  doc.setFillColor(16, 185, 129);
  doc.circle(x + 9.5, y + 3.5, 1, 'F');

  // Tab title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(241, 245, 249);
  doc.text(title, x + 13, y + 4.5);

  // URL bar
  const urlBarX = w < 85 ? x + 42 : x + 48;
  const urlBarW = w - (urlBarX - x) - 3;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(urlBarX, y + 1.4, urlBarW, 4.2, 1, 1, 'F');
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(147, 197, 253);
  doc.text(urlText, urlBarX + 2, y + 4.3);

  // Content area callback
  drawBody(x, y + 7, w, h - 7);
}

function drawStepBadge(doc, x, y, num, title) {
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(x, y, 16, 6.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`STEP ${num}`, x + 8, y + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x + 19, y + 4.8);
}

function addPageFooter(doc, pageNum, totalPages, version) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 12, pageW - 14, pageH - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Velmora Management System • Instagram Companion Chrome Extension Setup Guide (v${version})`, 14, pageH - 7.5);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 14, pageH - 7.5, { align: 'right' });
}

function generateSetupGuidePdf(version) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const totalPages = 4;

  // =========================================================================
  // PAGE 1: COVER HEADER + STEPS 1 TO 4
  // =========================================================================
  doc.setFillColor(11, 17, 26);
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setFillColor(37, 99, 235);
  doc.roundedRect(14, 8, 42, 5.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`OFFICIAL SETUP GUIDE • v${version}`, 35, 11.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(248, 250, 252);
  doc.text('Velmora Instagram Companion Extension', 14, 21.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Step-by-step installation, connection verification, Companion window usage, and troubleshooting.', 14, 28);
  doc.text('Designed for Google Chrome • No technical experience required (Time needed: ~2 minutes).', 14, 33.5);

  // Quick Package Overview Box
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(147, 197, 253);
  doc.roundedRect(14, 43, pageW - 28, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 64, 175);
  doc.text('What is inside your downloaded ZIP file?', 18, 48.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('1. extension/  — The Chrome Extension folder you will select in Chrome (contains manifest.json & src/).', 18, 53.5);
  doc.text('2. SETUP-GUIDE.pdf  — This illustrated setup guide.     3. README.txt  — Quick text checklist & troubleshooting.', 18, 58);

  // --- STEP 1 ---
  let y = 66;
  drawStepBadge(doc, 14, y, 1, 'Download the ZIP File from Velmora');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Sign in to Velmora and open Marketing -> Influencer R&D.', 14, y + 11.5);
  doc.text('2. At the top-right of the page, click the "Download Extension + Setup Guide" button.', 14, y + 16);
  doc.text(`3. Your browser will download one file named: Velmora-Instagram-Companion-v${version}.zip`, 14, y + 20.5);

  drawBrowserIllustration(doc, 14, y + 23, pageW - 28, 24, 'Velmora R&D', 'https://velmora.vercel.app/marketing?tab=influencer-rnd', (bx, by, bw, bh) => {
    doc.setFillColor(17, 24, 39);
    doc.rect(bx, by, bw, bh, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(241, 245, 249);
    doc.text('Influencer Research & Development', bx + 5, by + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Package v${version} Ready`, bx + 5, by + 12);

    // Highlighted Download Button
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(bx + bw - 68, by + 4, 63, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text('Download Extension + Setup Guide', bx + bw - 36.5, by + 9.5, { align: 'center' });
  });

  // --- STEP 2 ---
  y = 119;
  drawStepBadge(doc, 14, y, 2, 'Extract (Unzip) the Downloaded ZIP File');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`1. Open your computer's Downloads folder and find Velmora-Instagram-Companion-v${version}.zip.`, 14, y + 11.5);
  doc.text('2. Right-click the ZIP file and click "Extract All..." (Windows) or double-click it (Mac).', 14, y + 16);
  doc.text('3. IMPORTANT: Always unzip first! Do not delete the extracted folder after installing.', 14, y + 20.5);

  // Folder extraction illustration
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y + 23, pageW - 28, 24, 2, 2, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Extracted Folder Structure:', 18, y + 29);
  doc.text('Velmora-Instagram-Companion/', 22, y + 34);
  doc.setTextColor(37, 99, 235);
  doc.text('  |-- extension/          <-- YOU WILL SELECT THIS INNER FOLDER IN STEP 6', 22, y + 38.5);
  doc.setTextColor(71, 85, 105);
  doc.text('  |     |-- manifest.json & src/ (background.js, content-app.js)', 22, y + 42.5);
  doc.text('  |-- SETUP-GUIDE.pdf     |-- README.txt', 22, y + 46);

  // --- STEP 3 & STEP 4 ---
  y = 172;
  drawStepBadge(doc, 14, y, 3, 'Open chrome://extensions in Google Chrome');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Open Google Chrome on your computer.', 14, y + 11.5);
  doc.text('2. Click the address bar at the very top, type  chrome://extensions  and press Enter.', 14, y + 16);

  y = 194;
  drawStepBadge(doc, 14, y, 4, 'Turn ON "Developer mode" (Top-Right Corner)');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Look at the top-right corner of the Extensions page.', 14, y + 11.5);
  doc.text('2. Click the "Developer mode" switch so it turns BLUE (ON). Three new buttons will appear on the left.', 14, y + 16);

  drawBrowserIllustration(doc, 14, y + 19, pageW - 28, 36, 'Extensions', 'chrome://extensions', (bx, by, bw, bh) => {
    // Chrome extensions blue/dark header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(bx, by, bw, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Extensions', bx + 5, by + 6.5);

    // Developer mode toggle (top right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(226, 232, 240);
    doc.text('Developer mode', bx + bw - 38, by + 6.3);
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(bx + bw - 16, by + 3.2, 10, 4.5, 2.2, 2.2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(bx + bw - 8.2, by + 5.45, 1.8, 'F');

    // Sub-bar with Load unpacked
    doc.setFillColor(241, 245, 249);
    doc.rect(bx, by + 10, bw, bh - 10, 'F');
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(bx + 5, by + 14, 28, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('Load unpacked', bx + 19, by + 19, { align: 'center' });

    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(bx + 36, by + 14, 28, 8, 1.5, 1.5, 'D');
    doc.setTextColor(71, 85, 105);
    doc.text('Pack extension', bx + 50, by + 19, { align: 'center' });

    doc.roundedRect(bx + 67, by + 14, 18, 8, 1.5, 1.5, 'D');
    doc.text('Update', bx + 76, by + 19, { align: 'center' });
  });

  addPageFooter(doc, 1, totalPages, version);

  // =========================================================================
  // PAGE 2: STEPS 5 TO 8 (LOADING, CONFIRMING & PINNING THE EXTENSION)
  // =========================================================================
  doc.addPage();
  y = 16;

  drawStepBadge(doc, 14, y, 5, 'Click the "Load unpacked" Button');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. After enabling Developer mode, click the "Load unpacked" button in the top-left corner.', 14, y + 11.5);
  doc.text('2. A file selection window will open on your screen.', 14, y + 16);

  y = 40;
  drawStepBadge(doc, 14, y, 6, 'Select the Extracted "extension" Folder');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. In the folder picker window, open the extracted "Velmora-Instagram-Companion" folder.', 14, y + 11.5);
  doc.text('2. Click once on the inner "extension" folder and click "Select Folder".', 14, y + 16);

  // Common mistake callout box
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(14, y + 20, pageW - 28, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(185, 28, 28);
  doc.text('IMPORTANT: Select the inner "extension" folder — NOT the outer "Velmora-Instagram-Companion" folder!', 18, y + 25.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(127, 29, 29);
  doc.text('The "extension" folder is the one that directly contains manifest.json. Selecting the outer folder causes a manifest error.', 18, y + 30.8);

  // Folder picker illustration
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(14, y + 37, pageW - 28, 27, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Select the extension directory — Dialog Preview:', 18, y + 43);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text('Downloads > Velmora-Instagram-Companion >', 18, y + 48.5);
  doc.setFillColor(219, 234, 254);
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(22, y + 51, 95, 6.5, 1, 1, 'FD');
  doc.setFont('courier', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text('[Folder] extension   (Selected)', 25, y + 55.5);

  doc.setFillColor(37, 99, 235);
  doc.roundedRect(pageW - 48, y + 53, 30, 7.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Select Folder', pageW - 33, y + 58, { align: 'center' });

  // --- STEP 7 ---
  y = 112;
  drawStepBadge(doc, 14, y, 7, 'Confirm That the Extension is Installed & Enabled');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`1. Verify you now see the card titled "Velmora Influencer R&D" with version "${version}".`, 14, y + 11.5);
  doc.text('2. Make sure the toggle switch in the bottom-right of the card is switched ON (blue).', 14, y + 16);

  // Installed Extension Card Illustration
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y + 19, 110, 32, 2, 2, 'FD');
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(18, y + 23, 10, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('V', 23, y + 29.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Velmora Influencer R&D   ${version}`, 32, y + 26.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Companion extension for Velmora Influencer Research & Development', 32, y + 31.5);
  doc.setTextColor(37, 99, 235);
  doc.text('Inspect views: service worker (Active)', 32, y + 36.5);

  // Bottom of card: Details / Remove / Blue ON toggle
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(18, y + 41, 18, 6.5, 1, 1, 'D');
  doc.roundedRect(39, y + 41, 18, 6.5, 1, 1, 'D');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Details', 27, y + 45.2, { align: 'center' });
  doc.text('Remove', 48, y + 45.2, { align: 'center' });
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(108, y + 42, 11, 5, 2.5, 2.5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(116.5, y + 44.5, 1.9, 'F');

  // --- STEP 8 ---
  y = 171;
  drawStepBadge(doc, 14, y, 8, 'Pin the Extension to Your Chrome Toolbar');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Click the Puzzle Piece icon (Extensions) at the top-right corner of Chrome next to the address bar.', 14, y + 11.5);
  doc.text('2. Find "Velmora Influencer R&D" in the dropdown list and click the Pin icon so it turns blue.', 14, y + 16);

  // Pin dropdown illustration
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, y + 20, pageW - 28, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Chrome Toolbar Extensions Menu:', 18, y + 27);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(18, y + 30, 95, 7, 1, 1, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Velmora Influencer R&D', 22, y + 34.8);
  doc.setFillColor(219, 234, 254);
  doc.roundedRect(92, y + 31.2, 18, 4.6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(29, 78, 216);
  doc.text('PINNED', 101, y + 34.4, { align: 'center' });

  // --- STEP 9 & STEP 10 ---
  y = 219;
  drawStepBadge(doc, 14, y, 9, 'Open Velmora Management System & Refresh');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Return to your Velmora Management System browser tab (or open it in Google Chrome).', 14, y + 11.5);
  doc.text('2. Press F5 (or click the browser Reload button) once so the page connects to the newly installed extension.', 14, y + 16);

  y = 242;
  drawStepBadge(doc, 14, y, 10, 'Navigate to Influencer R&D');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. From the left sidebar in Velmora, click Marketing, then open the Influencer R&D module.', 14, y + 11.5);

  addPageFooter(doc, 2, totalPages, version);

  // =========================================================================
  // PAGE 3: STEPS 11 & 12 (CHECKING CONNECTION & COMPANION WINDOW WORKFLOW)
  // =========================================================================
  doc.addPage();
  y = 16;

  drawStepBadge(doc, 14, y, 11, 'Check Extension & Instagram Session Connection');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Click the "Check Connection" button in the top-right corner of Influencer R&D.', 14, y + 11.5);
  doc.text(`2. Confirm the "Chrome Extension" card shows a green "Connected" badge and "Version ${version}".`, 14, y + 16);
  doc.text('3. Confirm the "Instagram Session" card shows "Session Detected".', 14, y + 20.5);
  doc.text('   (If it shows "Login Required" or "Not Available", click "Open Instagram", log in, and click "Check Connection".)', 14, y + 25);

  // Status Cards Illustration
  doc.setFillColor(17, 24, 39);
  doc.roundedRect(14, y + 28, (pageW - 32) / 2, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(241, 245, 249);
  doc.text('Chrome Extension', 19, y + 35.5);
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(68, y + 31.8, 22, 5, 2.5, 2.5, 'F');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Connected', 79, y + 35.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('Connected to Velmora R&D browser extension.', 19, y + 42);
  doc.setFont('courier', 'normal');
  doc.text(`Version ${version}`, 19, y + 49);

  const rightCardX = 14 + (pageW - 32) / 2 + 4;
  doc.setFillColor(17, 24, 39);
  doc.roundedRect(rightCardX, y + 28, (pageW - 32) / 2, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(241, 245, 249);
  doc.text('Instagram Session', rightCardX + 5, y + 35.5);
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(rightCardX + 49, y + 31.8, 27, 5, 2.5, 2.5, 'F');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Session Detected', rightCardX + 62.5, y + 35.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('Your Instagram browser session is authenticated.', rightCardX + 5, y + 42);

  // --- STEP 12 ---
  y = 78;
  drawStepBadge(doc, 14, y, 12, 'Using the Instagram Companion Window & Global MiniPlayer');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Upload your Influencer Excel sheet (.xlsx) and click "Start Research".', 14, y + 11.5);
  doc.text('2. The extension automatically opens a separate "Instagram Companion Window" to scroll Reels and read views.', 14, y + 16);
  doc.text('3. Keep the Companion window OPEN and UNMINIMIZED while research runs.', 14, y + 20.5);
  doc.text('4. If the Companion window gets minimized or covered by another window, Velmora safely auto-pauses and shows:', 14, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('   "Paused — Instagram Companion window appears to be covered. Bring it to the front to continue."', 14, y + 29.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('   Simply click the Companion window to bring it to the front — scraping resumes automatically in 2–3 seconds!', 14, y + 34);
  doc.text('5. You can freely navigate to Sales, Logistics, Finance, or any other department during a batch. The Global', 14, y + 38.5);
  doc.text('   MiniPlayer stays visible in the bottom-right corner so you can monitor progress, pause, or stop at any time.', 14, y + 43);

  // Side-by-side Companion Window + Velmora Global MiniPlayer Diagram
  drawBrowserIllustration(doc, 14, y + 47, 102, 46, 'Velmora Dashboard (Any Dept)', 'https://velmora.vercel.app/sales', (bx, by, bw, bh) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(bx, by, bw, bh, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Work in Sales / Logistics / Finance...', bx + 4, by + 7);

    // Floating Global MiniPlayer inside Velmora
    doc.setFillColor(11, 17, 26);
    doc.setDrawColor(59, 130, 246);
    doc.roundedRect(bx + bw - 54, by + bh - 25, 51, 22, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(241, 245, 249);
    doc.text('Influencer R&D • Global Player', bx + bw - 51, by + bh - 20);
    doc.setFontSize(6);
    doc.setTextColor(96, 165, 250);
    doc.text('HIS002 @creator • 2/5 (40%)', bx + bw - 51, by + bh - 14.5);
    doc.setFillColor(37, 99, 235);
    doc.rect(bx + bw - 51, by + bh - 11.5, 24, 2, 'F');
    doc.setFontSize(5.5);
    doc.setTextColor(16, 185, 129);
    doc.text('Done: 1 | Partial: 0 | Fail: 0', bx + bw - 51, by + bh - 6);
  });

  drawBrowserIllustration(doc, 120, y + 47, 76, 46, 'IG Companion', 'instagram.com/creator/reels', (bx, by, bw, bh) => {
    doc.setFillColor(24, 24, 27);
    doc.rect(bx, by, bw, bh, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(244, 244, 245);
    doc.text('@creator • Reels Grid', bx + 4, by + 6.5);

    // 3x2 Reel Grid Tiles
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        doc.setFillColor(39, 39, 42);
        doc.setDrawColor(63, 63, 70);
        doc.roundedRect(bx + 4 + c * 23, by + 9.5 + r * 13, 21, 11, 1, 1, 'FD');
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(56, 189, 248);
        doc.text(`${((r * 3 + c + 1) * 14.2).toFixed(1)}K`, bx + 6 + c * 23, by + 18.5 + r * 13);
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(16, 185, 129);
    doc.text('Keep Open & Unminimized', bx + 4, by + bh - 2.5);
  });

  // Golden Rules Summary Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(134, 239, 172);
  doc.roundedRect(14, 208, pageW - 28, 38, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text('3 Golden Rules for Smooth Instagram R&D Scraping', 18, 215);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(20, 83, 45);
  doc.text('• Rule 1: Keep the Instagram Companion window OPEN and UNMINIMIZED while a batch is running.', 18, 222);
  doc.text('• Rule 2: If the batch auto-pauses because the Companion window was covered, just click the Companion window to bring', 18, 228);
  doc.text('          it back to the front. Do not close it — the batch will automatically resume from where it paused.', 18, 232.5);
  doc.text('• Rule 3: To hide the MiniPlayer UI without stopping research, click "X". Only click "Stop Session" if you want to cancel.', 18, 239);

  addPageFooter(doc, 3, totalPages, version);

  // =========================================================================
  // PAGE 4: SECTION 13 — TROUBLESHOOTING GUIDE
  // =========================================================================
  doc.addPage();
  y = 16;

  drawStepBadge(doc, 14, y, 13, 'Troubleshooting Common Installation & Connection Issues');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('If you run into any issue during setup or daily scraping, follow the step-by-step fix below:', 14, y + 11.5);

  const troubleshootingItems = [
    {
      issue: '1. Error: "Manifest file is missing or unreadable" when clicking Load unpacked',
      cause: 'You either selected the outer "Velmora-Instagram-Companion" folder instead of the inner "extension" folder, or tried to load directly from inside the unextracted .zip file.',
      fix: '1) Right-click the .zip file and click "Extract All..." first.\n2) In Chrome -> Load unpacked, open "Velmora-Instagram-Companion" and select the inner "extension" folder (which contains manifest.json).'
    },
    {
      issue: '2. Chrome Extension card in Velmora says "Not Detected" or "Connection Error"',
      cause: 'The Velmora browser tab was opened before installing the extension, or the extension is switched OFF in chrome://extensions.',
      fix: '1) Open chrome://extensions and verify "Velmora Influencer R&D" is present and its blue toggle is ON.\n2) Return to the Velmora tab and press F5 (Refresh).\n3) Click the "Check Connection" button in Influencer R&D.'
    },
    {
      issue: '3. Instagram Session card says "Login Required" or "Not Available"',
      cause: 'Chrome is not currently logged into an active Instagram account.',
      fix: '1) Click the "Open Instagram" button on the Instagram Session card (or open https://www.instagram.com).\n2) Log in with your work Instagram account.\n3) Return to Velmora and click "Check Connection" — it will switch to "Session Detected".'
    },
    {
      issue: '4. MiniPlayer says "Paused — Instagram Companion window appears to be covered"',
      cause: 'Chrome pauses background page scrolling when the Companion window is minimized or completely covered by another window.',
      fix: '1) Look at your taskbar and click the Instagram Companion Chrome window to bring it to the front.\n2) Keep it visible on part of your screen. The batch will automatically confirm visibility and resume within 2–3 seconds.'
    },
    {
      issue: '5. A profile failed after 15 minutes with "companion_window_inactive_timeout"',
      cause: 'The Instagram Companion window remained minimized or completely covered for more than 15 continuous minutes.',
      fix: '1) Bring the Companion window to the front so the remaining profiles finish.\n2) Once the batch finishes, click "Retry Failed / Remaining" in the MiniPlayer or dashboard to re-run only the failed profile.'
    },
    {
      issue: '6. How to update when a new Extension version is released in Velmora',
      cause: 'Your installed extension version is older than the version shown next to the Download button.',
      fix: '1) Click "Download Extension + Setup Guide" in Velmora and extract the new ZIP.\n2) Open chrome://extensions, click "Remove" on the old Velmora extension, then click "Load unpacked" and select the new "extension" folder.'
    }
  ];

  let ty = 33;
  for (const item of troubleshootingItems) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, ty, pageW - 28, 36, 2, 2, 'FD');

    doc.setFillColor(30, 41, 59);
    doc.roundedRect(14, ty, pageW - 28, 7.5, 2, 2, 'F');
    doc.rect(14, ty + 4, pageW - 28, 3.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(248, 250, 252);
    doc.text(item.issue, 18, ty + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('Why it happens:', 18, ty + 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const causeLines = doc.splitTextToSize(item.cause, pageW - 60);
    doc.text(causeLines, 42, ty + 12.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text('How to fix it:', 18, ty + 22);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const fixLines = doc.splitTextToSize(item.fix, pageW - 60);
    doc.text(fixLines, 42, ty + 22);

    ty += 39.5;
  }

  addPageFooter(doc, 4, totalPages, version);

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

function writeReleaseConfigTs(manifest, zipFilename, zipSizeBytes, sha256Hex) {
  const content = `// AUTO-GENERATED BY scripts/package-extension.mjs — DO NOT EDIT MANUALLY
// Synchronized with extension/manifest.json (v${manifest.version})

export interface ExtensionReleaseMetadata {
  name: string;
  version: string;
  zipFilename: string;
  downloadUrl: string;
  latestDownloadUrl: string;
  setupGuidePdfUrl: string;
  packageRootFolder: string;
  extensionSubfolder: string;
  sizeBytes: number;
  sha256: string;
}

export const EXTENSION_RELEASE_METADATA: ExtensionReleaseMetadata = {
  name: ${JSON.stringify(manifest.name)},
  version: ${JSON.stringify(manifest.version)},
  zipFilename: ${JSON.stringify(zipFilename)},
  downloadUrl: ${JSON.stringify(`/downloads/${zipFilename}`)},
  latestDownloadUrl: '/downloads/Velmora-Instagram-Companion-latest.zip',
  setupGuidePdfUrl: '/downloads/SETUP-GUIDE.pdf',
  packageRootFolder: ${JSON.stringify(PACKAGE_ROOT_FOLDER)},
  extensionSubfolder: 'extension',
  sizeBytes: ${zipSizeBytes},
  sha256: ${JSON.stringify(sha256Hex)},
};
`;

  fs.mkdirSync(path.dirname(RELEASE_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(RELEASE_CONFIG_PATH, content, 'utf8');
}

async function buildExtensionPackage() {
  console.log('=== Packaging Velmora Instagram Companion Chrome Extension ===');

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Extension manifest not found at ${MANIFEST_PATH}`);
  }

  const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const version = manifest.version;

  const extensionFiles = collectExtensionFiles(EXTENSION_DIR);
  validateExtensionAndSecurity(manifest, extensionFiles);
  console.log(`  [1/5] Validated extension v${version} (${extensionFiles.length} production files, 0 secrets exposed).`);

  // Generate SETUP-GUIDE.pdf and README.txt
  const pdfBuffer = generateSetupGuidePdf(version);
  const readmeText = generateReadmeTxt(version);
  console.log(`  [2/5] Generated SETUP-GUIDE.pdf (${pdfBuffer.length} bytes) and README.txt (${readmeText.length} bytes).`);

  // Create ZIP structure:
  // Velmora-Instagram-Companion/
  //   extension/
  //     manifest.json
  //     src/background.js
  //     src/content-app.js
  //   SETUP-GUIDE.pdf
  //   README.txt
  const zip = new JSZip();
  const rootFolder = zip.folder(PACKAGE_ROOT_FOLDER);
  const extFolder = rootFolder.folder('extension');

  for (const file of extensionFiles) {
    const fileBuf = fs.readFileSync(file.fullPath);
    extFolder.file(file.relPath, fileBuf);
  }

  rootFolder.file('SETUP-GUIDE.pdf', pdfBuffer);
  rootFolder.file('README.txt', readmeText);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  fs.mkdirSync(PUBLIC_DOWNLOADS_DIR, { recursive: true });

  const zipFilename = `Velmora-Instagram-Companion-v${version}.zip`;
  const versionedZipPath = path.join(PUBLIC_DOWNLOADS_DIR, zipFilename);
  const latestZipPath = path.join(PUBLIC_DOWNLOADS_DIR, 'Velmora-Instagram-Companion-latest.zip');
  const standalonePdfPath = path.join(PUBLIC_DOWNLOADS_DIR, 'SETUP-GUIDE.pdf');

  fs.writeFileSync(versionedZipPath, zipBuffer);
  fs.writeFileSync(latestZipPath, zipBuffer);
  fs.writeFileSync(standalonePdfPath, pdfBuffer);

  const sha256Hex = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  console.log(`  [3/5] Wrote ${versionedZipPath} (${zipBuffer.length} bytes, SHA-256: ${sha256Hex.slice(0, 16)}...).`);
  console.log(`  [4/5] Wrote ${standalonePdfPath} and ${latestZipPath}.`);

  writeReleaseConfigTs(manifest, zipFilename, zipBuffer.length, sha256Hex);
  console.log(`  [5/5] Synchronized release metadata at ${RELEASE_CONFIG_PATH}.`);
  console.log('=== Extension Packaging Complete ===');
}

buildExtensionPackage().catch((err) => {
  console.error('Extension packaging failed:', err);
  process.exit(1);
});
