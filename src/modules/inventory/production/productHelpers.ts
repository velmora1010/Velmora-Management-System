export const getProductDisplayName = (productName: string): string => {
  if (!productName) return '';
  const lower = productName.toLowerCase();
  if (lower.includes('liquid a')) return '1B';
  if (lower.includes('liquid b')) return '1Y';
  if (lower.includes('conditioner')) return '1P';
  if (lower.includes('sponge')) return '1S';
  return productName; // fallback
};

export const getProductSubtext = (productName: string): string => {
  if (!productName) return '';
  const lower = productName.toLowerCase();
  if (lower.includes('liquid a')) return 'Liquid';
  if (lower.includes('liquid b')) return 'Liquid';
  if (lower.includes('conditioner')) return 'Conditioner';
  if (lower.includes('sponge')) return 'Sponge';
  return 'Product'; // fallback
};

export const getProductTheme = (productName: string) => {
  if (!productName) return { color: '#94a3b8', bg: '#1e293b', border: '#334155', glow: 'rgba(148, 163, 184, 0.4)' };
  const lower = productName.toLowerCase();
  if (lower.includes('liquid a')) {
    // 1B - Blue
    return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', icon: 'droplet' };
  }
  if (lower.includes('liquid b')) {
    // 1Y - Yellow
    return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', icon: 'zap' };
  }
  if (lower.includes('conditioner')) {
    // 1P - Pink
    return { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', icon: 'heart' };
  }
  if (lower.includes('sponge')) {
    // 1S - White/Neutral
    return { color: '#f8fafc', bg: 'rgba(248, 250, 252, 0.1)', border: '#f8fafc', glow: 'rgba(248, 250, 252, 0.4)', icon: 'box' };
  }
  return { color: '#94a3b8', bg: '#1e293b', border: '#334155', glow: 'rgba(148, 163, 184, 0.4)', icon: 'box' };
};

export const deriveScanCodeFromBarcode = (barcode: string): string => {
  if (!barcode) return '';
  const str = String(barcode).trim().toUpperCase();

  // If already compact scan code (6-10 alphanumeric characters without hyphens)
  if (/^[A-Z0-9]{6,10}$/.test(str)) {
    return str;
  }

  // Match pattern PROD-1Y-MB1-260730-002
  const match = str.match(/PROD-([A-Z0-9]+)-MB\d+-(\d{6})-(\d+)/i);
  if (match) {
    const pCode = match[1];   // 1Y
    const dateStr = match[2]; // 260730 -> MM is 07 (7), DD is 30 -> 730
    const seq = match[3];     // 002
    const mm = parseInt(dateStr.slice(2, 4), 10);
    const dd = dateStr.slice(4, 6);
    return `${pCode}${mm}${dd}${seq.padStart(3, '0')}`.toUpperCase();
  }

  // Fallback: strip hyphens and take first 10 alphanumeric characters
  return str.replace(/[^A-Z0-9]/g, '').slice(0, 10);
};

export const generateScanCode = (productCode: string, dateStr?: string, sequenceNo?: string | number): string => {
  const pCode = String(productCode || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let mm = 0;
  let dd = '00';
  if (dateStr && dateStr.length >= 6) {
    mm = parseInt(dateStr.slice(2, 4), 10);
    dd = dateStr.slice(4, 6);
  } else {
    const d = new Date();
    mm = d.getMonth() + 1;
    dd = String(d.getDate()).padStart(2, '0');
  }
  const seq = String(sequenceNo || 1).padStart(3, '0');
  return `${pCode}${mm}${dd}${seq}`.toUpperCase();
};
