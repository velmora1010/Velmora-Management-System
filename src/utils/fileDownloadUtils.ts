/**
 * fileDownloadUtils.ts
 * Reliable utility to download files (audio, video, documents) securely in browser environments.
 * Uses blob fetching where CORS allows, and gracefully falls back to anchor download.
 */

export const sanitizeFileName = (name: string): string => {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
};

export const downloadMediaFile = async (url: string, suggestedFilename?: string): Promise<void> => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('No valid download URL provided');
  }

  const cleanUrl = url.trim();

  // Determine an initial filename if suggestedFilename is not provided
  let filename = suggestedFilename?.trim() || '';
  if (!filename) {
    try {
      const urlObj = new URL(cleanUrl);
      const pathname = urlObj.pathname;
      const lastPart = pathname.split('/').pop();
      if (lastPart) {
        filename = decodeURIComponent(lastPart);
      }
    } catch {
      filename = 'download';
    }
  }

  if (!filename) {
    filename = 'download';
  }

  // If filename lacks an extension, attempt to extract and append it from URL path
  if (!filename.includes('.')) {
    try {
      const urlObj = new URL(cleanUrl);
      const pathname = urlObj.pathname.split('?')[0];
      const dotIndex = pathname.lastIndexOf('.');
      if (dotIndex !== -1 && dotIndex > pathname.lastIndexOf('/')) {
        const ext = pathname.substring(dotIndex);
        if (ext && ext.length <= 6) {
          filename += ext;
        }
      }
    } catch {
      // ignore
    }
  }

  filename = sanitizeFileName(filename);

  try {
    const response = await fetch(cleanUrl, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 2000);
  } catch (err) {
    console.warn('Direct blob fetch failed, falling back to direct anchor download:', err);
    const link = document.createElement('a');
    link.href = cleanUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
