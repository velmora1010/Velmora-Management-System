const fs = require('fs');

const code = `import { useState, useEffect, useRef } from 'react';
import { inventoryService } from '../../../services/inventoryService';
import { Search, Download, Trash2, CheckCircle, Package, ArrowLeft, RefreshCcw } from 'lucide-react';
import Barcode from 'react-barcode';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

const PRODUCTS = [
  { code: '1B', name: 'Blue Detergent', theme: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' } },
  { code: '1Y', name: 'Yellow Dishwash', theme: { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'rgba(234, 179, 8, 0.2)' } },
  { code: '1P', name: 'Pink Conditioner', theme: { bg: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' } },
  { code: '1S', name: 'Sponge', theme: { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' } }
];

const getProductTheme = (code: string) => {
  const prod = PRODUCTS.find(p => p.code === code);
  return prod ? prod.theme : { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' };
};

const getProductFullName = (code: string) => {
  const prod = PRODUCTS.find(p => p.code === code);
  return prod ? prod.name : code;
};

interface ProductBarcodeListProps {
  onBack: () => void;
}

export default function ProductBarcodeList({ onBack }: ProductBarcodeListProps) {
  const location = useLocation();

  const [productBarcodes, setProductBarcodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(((location.state as any)?.filterProductCode) || null);
  
  const [searchTerm, setSearchTerm] = useState<string>(((location.state as any)?.filterBatchNo ? \`MB\${(location.state as any).filterBatchNo}\` : ''));
  const [statusFilter, setStatusFilter] = useState('All');

  const [scanModal, setScanModal] = useState<{ open: boolean, barcode: any | null }>({ open: false, barcode: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean, barcode: any | null }>({ open: false, barcode: null });
  
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [scannerValue, setScannerValue] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const lastScannedCodeRef = useRef<{code: string, time: number} | null>(null);

  const barcodeDownloadRef = useRef<HTMLDivElement>(null);
  const [downloadTarget, setDownloadTarget] = useState<any>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    fetchBarcodes();
  }, []);

  const fetchBarcodes = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getProductBarcodes();
      setProductBarcodes(data || []);
    } catch (err) {
      console.error('Failed to load product barcodes', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeBarcode = (value: any) => String(value || "").trim().toUpperCase().replace(/\\s+/g, "");

  const handleScan = async (code: string) => {
    if (!code) return;
    if (isProcessingScan) return;
    
    const now = Date.now();
    if (lastScannedCodeRef.current && lastScannedCodeRef.current.code === code) {
      if (now - lastScannedCodeRef.current.time < 2000) return;
    }
    lastScannedCodeRef.current = { code, time: now };
    setIsProcessingScan(true);
    
    const cleanCode = normalizeBarcode(code);
    const found = productBarcodes.find(b => normalizeBarcode(b.barcode_no) === cleanCode);
    
    setScannerValue('');
    scannerInputRef.current?.focus();

    if (found) {
      await inventoryService.updateProductBarcodeStatus(found.barcode_no, 'SCANNED');
      
      // Attempt to verify and pass micro batch
      const wasPassedNow = await (inventoryService as any).verifyAndCompleteMicroBatchScan(found.micro_batch_id);
      if (wasPassedNow) {
         console.log("Micro batch passed successfully!");
      }

      setScanModal({ open: true, barcode: { ...found, scan_status: 'SCANNED' } });
      await fetchBarcodes();
    } else {
      alert('Barcode not found in finished products.');
    }
    
    setIsProcessingScan(false);
  };

  const handleDownloadBarcode = async (barcodeData: any) => {
    setDownloadTarget(barcodeData);
    setTimeout(async () => {
      if (!barcodeDownloadRef.current || !barcodeData) return;
      try {
        const canvas = await html2canvas(barcodeDownloadRef.current, { backgroundColor: '#ffffff', scale: 2 });
        const link = document.createElement('a');
        link.download = \`\${barcodeData.barcode_no}.png\`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Failed to download barcode label', err);
      } finally {
        setDownloadTarget(null);
      }
    }, 100);
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      const productFolder = zip.folder("Product_Barcodes");
      if (!productFolder) return;

      for (const barcodeData of filteredBarcodes) {
        await new Promise<void>(resolve => {
          setDownloadTarget(barcodeData);
          setTimeout(resolve, 150);
        });

        if (barcodeDownloadRef.current) {
          const canvas = await html2canvas(barcodeDownloadRef.current, { backgroundColor: '#ffffff', scale: 2 });
          const imgData = canvas.toDataURL('image/png').split(',')[1];
          const fileName = \`\${barcodeData.barcode_no}.png\`;
          const subFolderName = (barcodeData.product_name || barcodeData.product_code || 'Unknown').replace(/\\s+/g, '_');
          
          productFolder.folder(subFolderName)?.file(fileName, imgData, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = \`All_\${selectedProductCode}_Barcodes.zip\`;
      link.click();
    } catch (err) {
      console.error('Failed to download all barcodes', err);
      alert('Failed to zip and download barcodes.');
    } finally {
      setIsDownloadingAll(false);
      setDownloadTarget(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.barcode) return;
    try {
      await inventoryService.deleteProductBarcode(deleteModal.barcode.barcode_no);
      setProductBarcodes(prev => prev.filter(b => b.barcode_no !== deleteModal.barcode.barcode_no));
      setDeleteModal({ open: false, barcode: null });
    } catch (error) {
      console.error('Failed to delete barcode', error);
      alert('Failed to delete barcode');
    }
  };

  const getProductStats = (code: string) => {
    const codes = productBarcodes.filter(b => b.product_code === code);
    return {
      total: codes.length,
      ready: codes.filter(b => b.status === 'READY' && b.scan_status !== 'SCANNED').length,
      scanned: codes.filter(b => b.scan_status === 'SCANNED').length,
      pending: codes.filter(b => b.scan_status === 'PENDING').length,
    };
  };

  const filteredBarcodes = productBarcodes.filter(b => {
    if (selectedProductCode && b.product_code !== selectedProductCode) return false;
    
    const matchesSearch = !searchTerm || 
      [b.barcode_no, b.product_name, b.product_code, b.batch_no, b.mb_no]
        .some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Ready' && b.status === 'READY' && b.scan_status !== 'SCANNED') ||
      (statusFilter === 'Scanned' && b.scan_status === 'SCANNED') ||
      (statusFilter === 'Pending' && b.scan_status === 'PENDING');

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading product barcodes...</div>;
  }

  if (!selectedProductCode) {
    // -------------------------------------------------------------
    // LANDING: 4 PRODUCT CARDS
    // -------------------------------------------------------------
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <button 
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px', padding: 0 }}
        >
          <ArrowLeft size={18} /> Back to View Barcode Home
        </button>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', color: 'white', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Package size={32} color="#ec4899" /> Product Barcode Sections
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>Select a product to view, search and scan its finished bottle barcodes.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {PRODUCTS.map(prod => {
            const stats = getProductStats(prod.code);
            return (
              <motion.div 
                key={prod.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, boxShadow: \`0 10px 25px \${prod.theme.border}\` }}
                onClick={() => setSelectedProductCode(prod.code)}
                style={{ 
                  background: '#1e293b', 
                  border: \`1px solid \${prod.theme.border}\`, 
                  borderRadius: '20px', 
                  padding: '24px',
                  cursor: 'pointer',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: prod.theme.bg, color: prod.theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                    {prod.code}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 800 }}>{prod.name}</h3>
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Total</span>
                    <span style={{ fontSize: '20px', color: 'white', fontWeight: 800 }}>{stats.total}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Ready</span>
                    <span style={{ fontSize: '20px', color: '#10b981', fontWeight: 800 }}>{stats.ready}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>Scanned</span>
                    <span style={{ fontSize: '20px', color: '#f59e0b', fontWeight: 800 }}>{stats.scanned}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: '#ec4899', fontWeight: 600 }}>Pending</span>
                    <span style={{ fontSize: '20px', color: '#ec4899', fontWeight: 800 }}>{stats.pending}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // LIST VIEW: SINGLE PRODUCT
  // -------------------------------------------------------------
  const selectedTheme = getProductTheme(selectedProductCode);
  const selectedName = getProductFullName(selectedProductCode);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <button 
        onClick={() => {
          setSelectedProductCode(null);
          setSearchTerm('');
          setStatusFilter('All');
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px', padding: 0 }}
      >
        <ArrowLeft size={18} /> Back to Products
      </button>

      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: selectedTheme.bg, color: selectedTheme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
          {selectedProductCode}
        </div>
        <div>
          <h1 style={{ fontSize: '28px', color: 'white', fontWeight: 800, margin: '0 0 4px 0' }}>
            {selectedProductCode} - {selectedName} Barcodes
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>View, search and scan {selectedName} barcodes.</p>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: '24px', borderRadius: '24px', border: \`1px solid \${selectedTheme.border}\`, marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: selectedTheme.bg, padding: '8px', borderRadius: '12px' }}>
            <Search size={24} color={selectedTheme.color} />
          </div>
          <span style={{ fontWeight: 700, color: 'white', fontSize: '18px' }}>Scan Product Barcode</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            ref={scannerInputRef} type="text" placeholder="Scan or enter product bottle barcode"
            value={scannerValue} onChange={(e) => setScannerValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(scannerValue); }}
            style={{ flex: 1, height: '56px', padding: '0 20px', borderRadius: '14px', border: '2px solid #334155', background: '#0f172a', color: 'white', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={(e) => e.target.style.borderColor = selectedTheme.color}
            onBlur={(e) => e.target.style.borderColor = '#334155'}
          />
          <button 
            onClick={() => handleScan(scannerValue)}
            style={{ height: '56px', padding: '0 32px', borderRadius: '14px', background: selectedTheme.color, color: 'white', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: \`0 4px 15px \${selectedTheme.border}\` }}
          >
            Trigger Scan
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', background: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" placeholder="Search barcode or batch..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', height: '44px', padding: '0 16px 0 44px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '14px', outline: 'none' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select 
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer', minWidth: '140px' }}
          >
            <option value="All">All Status</option>
            <option value="Ready">Ready</option>
            <option value="Scanned">Scanned</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <button 
          onClick={handleDownloadAll}
          disabled={isDownloadingAll || filteredBarcodes.length === 0}
          style={{ height: '44px', padding: '0 20px', borderRadius: '10px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: filteredBarcodes.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', opacity: filteredBarcodes.length > 0 ? 1 : 0.5, marginLeft: 'auto' }}
        >
          {isDownloadingAll ? <RefreshCcw size={16} className="animate-spin" /> : <Download size={16} />} 
          {isDownloadingAll ? 'Zipping...' : 'Download All'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {filteredBarcodes.map(item => {
          return (
            <motion.div 
              key={item.barcode_no}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ background: '#1e293b', border: \`1px solid \${selectedTheme.border}\`, borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ background: 'white', padding: '24px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <Barcode value={item.barcode_no} width={1.8} height={60} fontSize={14} margin={0} displayValue={false} />
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: item.scan_status === 'SCANNED' ? '#10b981' : item.scan_status === 'PENDING' ? '#ec4899' : '#3b82f6', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '1px' }}>
                  {item.scan_status === 'SCANNED' ? 'SCANNED' : item.scan_status === 'PENDING' ? 'PENDING' : item.status}
                </div>
              </div>
              
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>{selectedName}</h3>
                  <p style={{ color: selectedTheme.color, fontSize: '14px', fontFamily: 'monospace', margin: 0 }}>{item.barcode_no}</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Batch / MB</span>
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.batch_no || 'N/A'} / MB{item.mb_no || '1'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Quantity</span>
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>1 Unit</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Date</span>
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => setScanModal({ open: true, barcode: item })}
                    style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => handleDownloadBarcode(item)}
                    style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Download
                  </button>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(item.barcode_no); alert('Copied!'); }}
                    style={{ padding: '10px', borderRadius: '10px', background: '#0f172a', color: 'white', border: '1px solid #334155', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Copy
                  </button>
                  <button 
                    onClick={() => setDeleteModal({ open: true, barcode: item })}
                    style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredBarcodes.length === 0 && (
        <div style={{ padding: '64px', textAlign: 'center', background: '#1e293b', borderRadius: '24px', border: '1px dashed #334155' }}>
          <Package size={48} color="#475569" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>No {selectedProductCode} barcodes found.</h3>
          <p style={{ color: '#94a3b8', margin: 0 }}>Create and save product barcodes from Product department first.</p>
        </div>
      )}

      {/* Hidden Download Ref */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div ref={barcodeDownloadRef} style={{ width: '350px', background: 'white', padding: '24px', color: 'black', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <Barcode value={downloadTarget?.barcode_no || 'UNKNOWN'} width={1.8} height={70} displayValue={false} margin={0} />
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px', fontFamily: 'monospace', letterSpacing: '2px' }}>
              {downloadTarget?.barcode_no}
            </div>
          </div>
        </div>
      </div>

      {/* Details Popup */}
      <AnimatePresence>
        {scanModal.open && scanModal.barcode && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setScanModal({ open: false, barcode: null })} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#1e293b', borderRadius: '24px', width: '100%', maxWidth: '500px', position: 'relative', zIndex: 1001, border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.1), transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 800 }}>Product Details</h3>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Scanned Information</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Product Name</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{getProductFullName(scanModal.barcode.product_code)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Product Code</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{scanModal.barcode.product_code}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Batch No</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{scanModal.barcode.batch_no || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Micro Batch</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>MB{scanModal.barcode.mb_no || '1'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Quantity</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>1 Unit</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Status</span>
                    <span style={{ color: scanModal.barcode.scan_status === 'SCANNED' ? '#10b981' : '#3b82f6', fontWeight: 800, fontSize: '14px' }}>
                      {scanModal.barcode.scan_status === 'SCANNED' ? 'SCANNED' : scanModal.barcode.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Created Date</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{new Date(scanModal.barcode.created_at).toLocaleDateString()}</span>
                  </div>
                  {scanModal.barcode.scanned_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Scanned At</span>
                      <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{new Date(scanModal.barcode.scanned_at).toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Production ID</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{scanModal.barcode.production_batch_id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '24px', borderTop: '1px solid #334155', display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => handleDownloadBarcode(scanModal.barcode)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                >
                  Download Barcode
                </button>
                <button 
                  onClick={() => { navigator.clipboard.writeText(scanModal.barcode.barcode_no); alert('Copied!'); }}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#0f172a', color: 'white', border: '1px solid #334155', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                >
                  Copy Barcode
                </button>
                <button 
                  onClick={() => setScanModal({ open: false, barcode: null })}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteModal.open && deleteModal.barcode && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setDeleteModal({ open: false, barcode: null })} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#1e293b', borderRadius: '24px', width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1001, border: '1px solid #334155', overflow: 'hidden', textAlign: 'center', padding: '32px' }}
            >
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                <Trash2 size={32} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 16px 0' }}>Delete Product Barcode?</h2>
              <p style={{ color: '#94a3b8', fontSize: '15px', margin: '0 0 32px 0', lineHeight: 1.6 }}>
                This action permanently removes this barcode label. It will <strong style={{ color: 'white' }}>NOT</strong> deduct inventory quantity.
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => setDeleteModal({ open: false, barcode: null })}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#0f172a', color: 'white', border: '1px solid #334155', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteConfirm}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
`;

fs.writeFileSync('src/modules/inventory/view-barcode/ProductBarcodeList.tsx', code);
