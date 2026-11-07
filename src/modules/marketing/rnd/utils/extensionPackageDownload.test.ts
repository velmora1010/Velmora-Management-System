import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import JSZip from 'jszip';
import { EXTENSION_RELEASE_METADATA } from '../config/extensionReleaseConfig';
import { downloadExtensionPackage, isValidZipBuffer } from './extensionPackageDownload';

async function runTests() {
  console.log('=== TEST SUITE: Chrome Extension + Setup Guide Packaging & Download ===');

  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, 'extension', 'manifest.json');
  const bgPath = path.join(rootDir, 'extension', 'src', 'background.js');
  const zipPath = path.join(rootDir, 'public', 'downloads', EXTENSION_RELEASE_METADATA.zipFilename);
  const latestZipPath = path.join(rootDir, 'public', 'downloads', 'Velmora-Instagram-Companion-latest.zip');
  const pdfPath = path.join(rootDir, 'public', 'downloads', 'SETUP-GUIDE.pdf');
  const influencerRnDPath = path.join(rootDir, 'src', 'modules', 'marketing', 'InfluencerRnD.tsx');
  const vercelJsonPath = path.join(rootDir, 'vercel.json');

  // Test 1: UI Button, Loading State, Feedback & Version Sync in InfluencerRnD.tsx
  {
    console.log('[Test 1] Verifying UI button, loading state, feedback banner, and version synchronization...');
    const rndSource = fs.readFileSync(influencerRnDPath, 'utf8');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const bgSource = fs.readFileSync(bgPath, 'utf8');

    assert.ok(rndSource.includes('Download Extension + Setup Guide'), 'InfluencerRnD.tsx must display "Download Extension + Setup Guide" button label');
    assert.ok(rndSource.includes('data-testid="download-extension-setup-guide-btn"'), 'Download button must have test id');
    assert.ok(rndSource.includes('<Download size={14} />'), 'Download button must render the Download icon');
    assert.ok(rndSource.includes('Preparing Download...'), 'Download button must provide a loading state');
    assert.ok(rndSource.includes('data-testid="extension-download-feedback"'), 'InfluencerRnD.tsx must show a success/error message banner after download');
    assert.ok(rndSource.includes('data-testid="extension-release-version-badge"'), 'InfluencerRnD.tsx must display the synchronized extension version badge');

    assert.strictEqual(EXTENSION_RELEASE_METADATA.version, manifest.version, 'Release metadata version must match extension/manifest.json');
    assert.ok(bgSource.includes(`const EXTENSION_VERSION = "${manifest.version}"`), 'background.js EXTENSION_VERSION must match manifest.json');
    assert.strictEqual(
      EXTENSION_RELEASE_METADATA.zipFilename,
      `Velmora-Instagram-Companion-v${manifest.version}.zip`,
      'ZIP filename must include synchronized version'
    );
    console.log(`  -> UI button and version sync (v${manifest.version}) verified.`);
  }

  // Test 2: Single-Click Download Helper & Binary ZIP Validation
  {
    console.log('[Test 2] Verifying single-click download behavior and ZIP magic-byte safeguard...');
    const realZipBuffer = fs.readFileSync(zipPath);
    const realArrayBuffer = realZipBuffer.buffer.slice(
      realZipBuffer.byteOffset,
      realZipBuffer.byteOffset + realZipBuffer.byteLength
    );

    assert.strictEqual(isValidZipBuffer(realArrayBuffer), true, 'Real packaged ZIP must pass isValidZipBuffer');

    // Ensure HTML fallback (e.g. SPA index.html) is rejected
    const fakeHtmlBuffer = Buffer.from('<!doctype html><html><body>Not a zip</body></html>', 'utf8');
    const fakeArrayBuffer = fakeHtmlBuffer.buffer.slice(
      fakeHtmlBuffer.byteOffset,
      fakeHtmlBuffer.byteOffset + fakeHtmlBuffer.byteLength
    );
    assert.strictEqual(isValidZipBuffer(fakeArrayBuffer), false, 'HTML fallback buffer must be rejected by isValidZipBuffer');

    let fetchCount = 0;
    let requestedUrl = '';
    const mockFetch: any = async (url: string) => {
      fetchCount++;
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => realArrayBuffer
      };
    };

    const result = await downloadExtensionPackage(EXTENSION_RELEASE_METADATA, mockFetch);
    assert.strictEqual(fetchCount, 1, 'One click must trigger exactly one download request');
    assert.strictEqual(requestedUrl, `/downloads/${EXTENSION_RELEASE_METADATA.zipFilename}`);
    assert.strictEqual(result.success, true, 'Download must succeed for valid ZIP');
    assert.strictEqual(result.filename, EXTENSION_RELEASE_METADATA.zipFilename);
    assert.strictEqual(result.sizeBytes, realZipBuffer.length);
    console.log(`  -> Single-click download verified (${result.filename}, ${result.sizeBytes} bytes).`);
  }

  // Test 3: ZIP Archive Structure, SETUP-GUIDE.pdf, README.txt & Security Validation
  {
    console.log('[Test 3] Validating ZIP contents, folder structure, SETUP-GUIDE.pdf, README.txt, and security...');
    assert.ok(fs.existsSync(zipPath), `Versioned ZIP must exist at ${zipPath}`);
    assert.ok(fs.existsSync(latestZipPath), `Latest alias ZIP must exist at ${latestZipPath}`);
    assert.ok(fs.existsSync(pdfPath), `Standalone SETUP-GUIDE.pdf must exist at ${pdfPath}`);

    const zipBuf = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBuf);
    const entryNames = Object.keys(zip.files).filter((k) => !zip.files[k].dir);

    const requiredEntries = [
      'Velmora-Instagram-Companion/extension/manifest.json',
      'Velmora-Instagram-Companion/extension/src/background.js',
      'Velmora-Instagram-Companion/extension/src/content-app.js',
      'Velmora-Instagram-Companion/SETUP-GUIDE.pdf',
      'Velmora-Instagram-Companion/README.txt'
    ];

    for (const reqEntry of requiredEntries) {
      assert.ok(entryNames.includes(reqEntry), `ZIP must contain ${reqEntry}`);
    }

    // Verify no dev/test/git/node_modules files leaked into the ZIP
    for (const entry of entryNames) {
      assert.ok(!entry.includes('node_modules'), `ZIP must not contain node_modules: ${entry}`);
      assert.ok(!entry.includes('.git'), `ZIP must not contain .git files: ${entry}`);
      assert.ok(!entry.includes('.env'), `ZIP must not contain .env files: ${entry}`);
      assert.ok(!/\.test\.[jt]sx?$/.test(entry), `ZIP must not contain test files: ${entry}`);
    }

    // Validate SETUP-GUIDE.pdf inside ZIP
    const pdfInZip = await zip.file('Velmora-Instagram-Companion/SETUP-GUIDE.pdf')!.async('nodebuffer');
    assert.strictEqual(pdfInZip.subarray(0, 5).toString('ascii'), '%PDF-', 'SETUP-GUIDE.pdf inside ZIP must be a valid PDF binary');
    assert.ok(pdfInZip.length > 50000, 'SETUP-GUIDE.pdf must contain full multi-page illustrated guide');

    // Validate README.txt inside ZIP
    const readmeInZip = await zip.file('Velmora-Instagram-Companion/README.txt')!.async('string');
    assert.ok(readmeInZip.includes('chrome://extensions'), 'README.txt must include chrome://extensions instructions');
    assert.ok(readmeInZip.includes('Developer mode'), 'README.txt must include Developer mode instructions');
    assert.ok(readmeInZip.includes('Load unpacked'), 'README.txt must include Load unpacked instructions');
    assert.ok(readmeInZip.includes('TROUBLESHOOTING'), 'README.txt must include troubleshooting section');

    console.log(`  -> ZIP structure validated (${entryNames.length} files, valid PDF & README, 0 dev/secret files).`);
  }

  // Test 4: Extract ZIP & Simulate Chrome "Load unpacked" + Companion Handshake
  {
    console.log('[Test 4] Simulating ZIP extraction, Chrome "Load unpacked", and Velmora connection handshake...');
    const tmpExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'velmora-ext-test-'));
    try {
      const zipBuf = fs.readFileSync(zipPath);
      const zip = await JSZip.loadAsync(zipBuf);

      for (const [relPath, entry] of Object.entries(zip.files)) {
        const destPath = path.join(tmpExtractDir, relPath);
        if (entry.dir) {
          fs.mkdirSync(destPath, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          const content = await entry.async('nodebuffer');
          fs.writeFileSync(destPath, content);
        }
      }

      const unpackedExtDir = path.join(tmpExtractDir, 'Velmora-Instagram-Companion', 'extension');
      const unpackedManifestPath = path.join(unpackedExtDir, 'manifest.json');
      assert.ok(fs.existsSync(unpackedManifestPath), 'Extracted extension/manifest.json must exist');

      const unpackedManifest = JSON.parse(fs.readFileSync(unpackedManifestPath, 'utf8'));
      assert.strictEqual(unpackedManifest.manifest_version, 3, 'Extracted manifest must be Manifest V3');

      // Confirm all manifest-referenced files exist inside the extracted `extension` directory
      const swPath = path.join(unpackedExtDir, unpackedManifest.background.service_worker);
      assert.ok(fs.existsSync(swPath), `Service worker must exist at ${swPath}`);

      for (const cs of unpackedManifest.content_scripts) {
        for (const jsRel of cs.js) {
          const csFullPath = path.join(unpackedExtDir, jsRel);
          assert.ok(fs.existsSync(csFullPath), `Content script must exist at ${csFullPath}`);
        }
      }

      // Execute extracted background.js in a sandbox and verify GET_EXTENSION_STATUS -> PONG
      let onMessageListener: any = null;
      const sandbox: any = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        setTimeout,
        clearTimeout,
        Date,
        Math,
        Promise,
        JSON,
        Set,
        Map,
        Array,
        Object,
        Number,
        String,
        Boolean,
        RegExp,
        Error,
        chrome: {
          runtime: {
            onMessage: {
              addListener: (fn: any) => {
                onMessageListener = fn;
              }
            },
            sendMessage: () => Promise.resolve()
          },
          windows: {
            onRemoved: { addListener: () => {} }
          },
          tabs: {
            onRemoved: { addListener: () => {} },
            onReplaced: { addListener: () => {} }
          },
          cookies: {
            getAll: async () => [{ name: 'sessionid', value: 'mock_session' }]
          }
        }
      };

      const extractedBgCode = fs.readFileSync(swPath, 'utf8');
      vm.runInNewContext(extractedBgCode, sandbox);
      assert.ok(typeof onMessageListener === 'function', 'Extracted background.js must register chrome.runtime.onMessage listener');

      let pongResponse: any = null;
      onMessageListener({ type: 'GET_EXTENSION_STATUS' }, {}, (res: any) => {
        pongResponse = res;
      });
      assert.ok(pongResponse, 'Extracted background.js must respond to GET_EXTENSION_STATUS');
      assert.strictEqual(pongResponse.type, 'PONG');
      assert.strictEqual(pongResponse.extensionVersion, unpackedManifest.version);
      console.log(`  -> Extracted extension loaded cleanly and responded with PONG (v${pongResponse.extensionVersion}).`);
    } finally {
      fs.rmSync(tmpExtractDir, { recursive: true, force: true });
    }
  }

  // Test 5: Vercel Static Route Protection Verification
  {
    console.log('[Test 5] Verifying vercel.json static asset route protection for /downloads/*...');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    const rewrites = vercelConfig.rewrites || [];
    const spaFallback = rewrites[rewrites.length - 1];
    assert.ok(
      spaFallback.source.includes('downloads/'),
      'vercel.json catch-all rewrite must exclude downloads/ so ZIP and PDF are served as binary static files'
    );
    console.log('  -> vercel.json static download route verified.');
  }

  // Test 6: Two-Level Header & Second-Level Operational Action Toolbar Verification
  {
    console.log('[Test 6] Verifying two-level Main Header vs. Second-Level Action Toolbar layout in InfluencerRnD.tsx...');
    const rndSource = fs.readFileSync(influencerRnDPath, 'utf8');

    const mainHeaderStart = rndSource.indexOf('data-testid="rnd-main-header"');
    const actionToolbarStart = rndSource.indexOf('data-testid="rnd-action-toolbar"');
    const feedbackBannerStart = rndSource.indexOf('extensionDownloadStatus &&');

    assert.ok(mainHeaderStart !== -1, 'Main header must exist with data-testid="rnd-main-header"');
    assert.ok(actionToolbarStart !== -1, 'Second-level action toolbar must exist with data-testid="rnd-action-toolbar"');
    assert.ok(mainHeaderStart < actionToolbarStart, 'Main header must appear above the second-level action toolbar');

    const mainHeaderSlice = rndSource.slice(mainHeaderStart, actionToolbarStart);
    const actionToolbarSlice = rndSource.slice(actionToolbarStart, feedbackBannerStart);

    // Main Header checks
    assert.ok(mainHeaderSlice.includes('Influencer Research & Development'), 'Main header must contain page title');
    assert.ok(mainHeaderSlice.includes('data-testid="download-extension-setup-guide-btn"'), 'Main header must contain Download Extension + Setup Guide button');
    assert.ok(mainHeaderSlice.includes('data-testid="extension-release-version-badge"'), 'Main header must contain extension version badge');
    assert.ok(mainHeaderSlice.includes('data-testid="rnd-analytics-btn"'), 'Main header must contain Analytics button');
    assert.ok(!mainHeaderSlice.includes('<RnDExportButton'), 'Main header must NOT contain Export Results button');
    assert.ok(!mainHeaderSlice.includes('data-testid="rnd-open-miniplayer-btn"'), 'Main header must NOT contain Open Mini Player button');
    assert.ok(!mainHeaderSlice.includes('data-testid="rnd-check-connection-btn"'), 'Main header must NOT contain Check Connection button');

    // Second-Level Action Toolbar checks & order
    const exportIdx = actionToolbarSlice.indexOf('<RnDExportButton');
    const miniPlayerIdx = actionToolbarSlice.indexOf('data-testid="rnd-open-miniplayer-btn"');
    const checkConnIdx = actionToolbarSlice.indexOf('data-testid="rnd-check-connection-btn"');

    assert.ok(exportIdx !== -1, 'Second-level toolbar must contain Export Results (RnDExportButton)');
    assert.ok(miniPlayerIdx !== -1, 'Second-level toolbar must contain Open Mini Player button');
    assert.ok(checkConnIdx !== -1, 'Second-level toolbar must contain Check Connection button');
    assert.ok(exportIdx < miniPlayerIdx && miniPlayerIdx < checkConnIdx, 'Toolbar controls must be ordered: Export Results | Open Mini Player | Check Connection');
    assert.ok(!actionToolbarSlice.includes('data-testid="rnd-analytics-btn"'), 'Second-level toolbar must NOT duplicate Analytics button');
    assert.ok(!actionToolbarSlice.includes('data-testid="download-extension-setup-guide-btn"'), 'Second-level toolbar must NOT duplicate Download Extension button');

    console.log('  -> Two-level header and action toolbar separation & ordering verified.');
  }

  console.log('PASS: All Chrome Extension + Setup Guide packaging and download tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
