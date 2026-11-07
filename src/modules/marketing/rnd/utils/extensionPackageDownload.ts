import { EXTENSION_RELEASE_METADATA, ExtensionReleaseMetadata } from '../config/extensionReleaseConfig';

export interface ExtensionDownloadResult {
  success: boolean;
  filename: string;
  version: string;
  sizeBytes?: number;
  message: string;
}

/**
 * Verifies that an ArrayBuffer begins with the standard ZIP local file header signature (PK\x03\x04).
 * Prevents accidentally saving an SPA HTML fallback page as a .zip file.
 */
export function isValidZipBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 22) return false;
  const view = new Uint8Array(buffer, 0, 4);
  return view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04;
}

/**
 * Downloads the ready-made production Velmora Instagram Companion ZIP package
 * (containing extension/, SETUP-GUIDE.pdf, and README.txt) with a single click.
 */
export async function downloadExtensionPackage(
  metadata: ExtensionReleaseMetadata = EXTENSION_RELEASE_METADATA,
  customFetch: typeof fetch = fetch
): Promise<ExtensionDownloadResult> {
  try {
    let response = await customFetch(metadata.downloadUrl, {
      method: 'GET',
      cache: 'no-cache'
    });

    if (!response.ok && metadata.latestDownloadUrl && metadata.latestDownloadUrl !== metadata.downloadUrl) {
      response = await customFetch(metadata.latestDownloadUrl, {
        method: 'GET',
        cache: 'no-cache'
      });
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status} while fetching ${metadata.zipFilename}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!isValidZipBuffer(arrayBuffer)) {
      throw new Error('Downloaded file is not a valid ZIP archive. Please verify the deployment static assets.');
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([arrayBuffer], { type: 'application/zip' });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = objectUrl;
      anchor.download = metadata.zipFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 5000);
    }

    return {
      success: true,
      filename: metadata.zipFilename,
      version: metadata.version,
      sizeBytes: arrayBuffer.byteLength,
      message: `Downloaded ${metadata.zipFilename} (v${metadata.version}). Extract the ZIP and select the "extension" folder in chrome://extensions (Developer mode -> Load unpacked).`
    };
  } catch (err: any) {
    return {
      success: false,
      filename: metadata.zipFilename,
      version: metadata.version,
      message: err?.message || 'Failed to download the extension package. Please try again.'
    };
  }
}
