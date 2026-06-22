import { useState, useEffect, useRef } from 'react';
import ProductBarcodeList from './ProductBarcodeList';

import { inventoryService } from '../../../services/inventoryService';
import { Download, Search, Eye, Copy, AlertTriangle, Printer, Trash2, Box, Boxes, Package, Plus, X, Clock, CheckCircle, Barcode as BarcodeIcon, AlertCircle, History, ArrowLeft } from 'lucide-react';
import Barcode from 'react-barcode';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import toast from 'react-hot-toast';


const normalizeBarcode = (value: any) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[\r\n\t]/g, "");

const getProductTheme = (code: string) => {
  switch (code) {
    case '1B': return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
    case '1Y': return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'rgba(234, 179, 8, 0.2)' };
    case '1P': return { bg: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' };
    default: return { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' };
  }
};

const getProductFullName = (code: string) => {
  switch (code) {
    case '1B': return 'Blue Detergent';
    case '1Y': return 'Yellow Dishwash';
    case '1P': return 'Pink Conditioner';
    case '1S': return 'Sponge';
    default: return code;
  }
};


const getRawBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'RAW_MATERIAL_IN') return { text: 'SCANNED IN', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED OUT', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
  } else if (tab === 'IN') {
    if (stage === 'RAW_MATERIAL_IN') return { text: 'SCAN TO OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'OUT') {
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

const ViewBarcode = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'RAW_MATERIAL' | 'PRODUCT' | 'COMBO' | null>((location.state as any)?.activeTab || null);
  const [rawMaterialSubTab, setRawMaterialSubTab] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [comboSubTab, setComboSubTab] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Raw Material State
  const [batches, setBatches] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  
  const [pendingRawScan, setPendingRawScan] = useState<{code: string, action: 'IN' | 'OUT', record?: any} | null>(null);
  const [pendingComboScan, setPendingComboScan] = useState<{code: string, action: string, record: any} | null>(null);
  const [scanPersonName, setScanPersonName] = useState('');

  const [materialFilter, setMaterialFilter] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  // Combo State
  const [comboBatches, setComboBatches] = useState<any[]>([]);
  const [comboSearchTerm, setComboSearchTerm] = useState('');
  const [comboTypeFilter, setComboTypeFilter] = useState('All Types');
  const [selectedComboBatch, setSelectedComboBatch] = useState<any>(null);
  const [expandedCombos, setExpandedCombos] = useState<Record<string, boolean>>({});
  
  // Shared State
  const [loading, setLoading] = useState(true);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const lastScannedCodeRef = useRef<{code: string, time: number} | null>(null);
  
  // Scanner State
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const barcodeDownloadRef = useRef<HTMLDivElement>(null);
  const [downloadTarget, setDownloadTarget] = useState<any>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState<string | null>(null);

  const handleDownloadAll = async (group: any[], comboName: string, batchId: string) => {
    setIsDownloadingAll(batchId);
    try {
      const zip = new JSZip();
      const productFolder = zip.folder("product-barcodes");
      
      for (const barcodeData of group) {
        await new Promise<void>(resolve => {
          setDownloadTarget(barcodeData);
          setTimeout(resolve, 150);
        });

        if (barcodeDownloadRef.current) {
          const canvas = await html2canvas(barcodeDownloadRef.current, { backgroundColor: '#ffffff', scale: 2 });
          const imgData = canvas.toDataURL('image/png').split(',')[1];
          const fileName = `${barcodeData.barcode_no || barcodeData.serial_number}.png`;
          
          if (barcodeData.type === 'COMBO_BOX') {
            zip.file(fileName, imgData, { base64: true });
          } else if (productFolder) {
            productFolder.file(fileName, imgData, { base64: true });
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${comboName.replace(/\s+/g, '-')}-${batchId}-barcodes.zip`;
      link.click();
    } catch (err) {
      console.error('Failed to download all barcodes', err);
      toast.success('Failed to zip and download barcodes.');
    } finally {
      setIsDownloadingAll(null);
      setDownloadTarget(null);
    }
  };

  const handleDownloadBarcode = async (barcodeData: any) => {
    setDownloadTarget(barcodeData);
    // Wait for state to apply to the hidden ref
    setTimeout(async () => {
      if (!barcodeDownloadRef.current || !barcodeData) return;
      try {
        const canvas = await html2canvas(barcodeDownloadRef.current, { backgroundColor: '#ffffff', scale: 2 });
        const link = document.createElement('a');
        link.download = `${barcodeData.barcode_no || barcodeData.serial_number}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Failed to download barcode label', err);
      } finally {
        setDownloadTarget(null);
      }
    }, 100);
  };
  const [scannerValue, setScannerValue] = useState('');
  const [deleteModal, setDeleteModal] = useState<{
    type: "raw_material" | "combo_product" | "combo_box" | null;
    barcode: any | null;
  }>({ type: null, barcode: null });

  const [isDeleting, setIsDeleting] = useState(false);

  const [scanModal, setScanModal] = useState<{
    type: "confirm" | "already_scanned" | "not_found" | "empty" | "combo_info" | "success" | "error" | null;
    barcode: any | null;
    scannedCode: string;
    message?: string;
  }>({ type: null, barcode: null, scannedCode: '' });

  const batchesRef = useRef(batches);
  const comboBatchesRef = useRef(comboBatches);

  useEffect(() => { batchesRef.current = batches; }, [batches]);
  useEffect(() => { comboBatchesRef.current = comboBatches; }, [comboBatches]);

    const fetchBatches = async () => {
    setLoading(true);
    try {
      // 1. First repair all duplicates persistently
      if ((inventoryService as any).repairDuplicateBarcodes) {
        (inventoryService as any).repairDuplicateBarcodes('inventory_batches');
        (inventoryService as any).repairDuplicateBarcodes('finished_product_barcodes');
        (inventoryService as any).repairDuplicateBarcodes('combo_barcodes');
        
        if ((inventoryService as any).repairBarcodeValues) {
           (inventoryService as any).repairBarcodeValues('inventory_batches');
           (inventoryService as any).repairBarcodeValues('finished_product_barcodes');
           (inventoryService as any).repairBarcodeValues('combo_barcodes');
        }
      }

      // 2. Fetch the newly deduplicated lists
      const [data, combos] = await Promise.all([
        inventoryService.getBarcodes(),
        inventoryService.getAllComboBarcodes()
      ]);
      setBatches(data || []);
      setComboBatches(combos || []);
    } catch (err) {
      console.error('Failed to load barcodes locally', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const passedTab = (location.state as any)?.activeTab;
    if (passedTab === 'COMBO' || passedTab === 'RAW_MATERIAL') {
      setActiveTab(passedTab);
    }
  }, [location.state]);

  useEffect(() => {
    fetchBatches().then(() => {
      setTimeout(() => { scannerInputRef.current?.focus(); }, 100);
    });
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteModal.barcode) return;
    setIsDeleting(true);
    
    const item = deleteModal.barcode;
    const barcodeKey = item.serial_number || item.barcode_no || item.barcodeNo || item.barcode || item.id;
    

    try {
      if (deleteModal.type === 'raw_material') {
        await inventoryService.deleteRawMaterialBarcode(barcodeKey);
        
        // Immediate local state update
        setBatches(prev => prev.filter(b => b.serial_number !== barcodeKey));
        
      } else if (deleteModal.type === 'combo_product') {
        await inventoryService.deleteProductBarcode(barcodeKey);
        
        // Check if this was the last PRODUCT barcode in that combo box
        const remainingProducts = comboBatchesRef.current.filter((b: any) => 
          b.batch_id === item.batch_id && 
          b.type === 'PRODUCT' && 
          (b.barcode_no || b.serial_number || b.id) !== barcodeKey
        );
        
        if (remainingProducts.length === 0 && item.batch_id) {
           await inventoryService.deleteComboBoxBarcode(item.batch_id);
        }
        
      } else if (deleteModal.type === 'combo_box') {
        await inventoryService.deleteComboBoxBarcode(item.batch_id);
      }

      
      // Update UI silently
      await fetchBatches();
      
      setDeleteModal({ type: null, barcode: null });
      
      // Simple Toast
      const toast = document.createElement('div');
      toast.textContent = "Barcode deleted successfully";
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.background = '#10b981';
      toast.style.color = 'white';
      toast.style.padding = '16px 24px';
      fetchBatches();
      
    } catch (error: any) {
      console.error("Delete failed:", error);
      toast.error(error.message || "Failed to delete barcode");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => setDeleteModal({ type: null, barcode: null });


  const handleScanRef = useRef<any>(null);
  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  useEffect(() => {
    if (activeTab !== null) {
      setTimeout(() => scannerInputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  useEffect(() => {
    let buffer = '';
    let timeout: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab === null || activeTab === 'PRODUCT') return;
      if (scanModal.type !== null) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target.id !== 'universal-scanner-input') return;
      if (target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (buffer) {
          e.preventDefault();
          handleScanRef.current && handleScanRef.current(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          buffer = '';
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeout) clearTimeout(timeout);
    };
  }, [activeTab, scanModal.type]);

  // SCANNER LOGIC
  const handleScan = async (code: string) => {
    if (!code) return;
    if (isProcessingScan) return;
    
    const now = Date.now();
    if (lastScannedCodeRef.current && lastScannedCodeRef.current.code === code) {
      if (now - lastScannedCodeRef.current.time < 2000) {
        return;
      }
    }
    
    lastScannedCodeRef.current = { code, time: now };
    setIsProcessingScan(true);
    
    const cleanCode = normalizeBarcode(code);
    if (!cleanCode) {
      setScanModal({ type: 'empty', barcode: null, scannedCode: code });
      setIsProcessingScan(false);
      return;
    }
    
    setScannerValue('');
    scannerInputRef.current?.focus();

    try {
      if (activeTab === 'RAW_MATERIAL' || activeTab === 'COMBO') {
        if (activeTab === 'RAW_MATERIAL') {
           const record = batches.find((item: any) => [item.serial_number, item.batch_number, item.id].map(normalizeBarcode).includes(cleanCode));
           if (!record) {
             setScanModal({ type: 'not_found', barcode: null, scannedCode: code });
             setIsProcessingScan(false);
             return;
           }
           
           if (record.currentStage === 'RAW_MATERIAL_OUT' || record.currentStage === 'DISPATCHED') {
             setSelectedBatch(record);
             setIsProcessingScan(false);
             return;
           } else if (record.currentStage === 'RAW_MATERIAL_IN') {
             setPendingRawScan({ code: cleanCode, action: 'OUT', record });
             setIsProcessingScan(false);
             return;
           } else {
             setPendingRawScan({ code: cleanCode, action: 'IN', record });
             setIsProcessingScan(false);
             return;
           }
        }

        if (activeTab === 'COMBO') {
           // Skip sub-tab scanAction checking and auto-infer behavior
           const record = comboBatches.find((item: any) => [item.comboBoxBarcode, item.barcode_no, item.id].map(normalizeBarcode).includes(cleanCode));
           if (!record) {
             setScanModal({ type: 'not_found', barcode: null, scannedCode: code });
             setIsProcessingScan(false);
             return;
           }
           
           if (record.status === 'EMPTY' || record.status === 'PARTIAL') {
             setSelectedComboBatch({ ...record, _message: 'Add required products before Inventory IN.' });
             setIsProcessingScan(false);
             return;
           } else if (record.currentStage === 'COMBO_OUT' || record.currentStage === 'DISPATCHED') {
             setSelectedComboBatch(record);
             setIsProcessingScan(false);
             return;
           } else if (record.currentStage === 'COMBO_IN') {
             setPendingComboScan({ code: cleanCode, action: 'OUT', record });
             setIsProcessingScan(false);
             return;
           } else {
             // READY_FOR_FIRST_SCAN or READY
             setPendingComboScan({ code: cleanCode, action: 'IN', record });
             setIsProcessingScan(false);
             return;
           }
        }
        

      }
    } catch (error: any) {
      console.error(error);
      if (error.message.includes('not found')) {
        setScanModal({ type: 'not_found', barcode: null, scannedCode: code });
      } else {
        setScanModal({ type: 'error' as any, barcode: null, scannedCode: code, message: error.message } as any);
      }
    } finally {
      setIsProcessingScan(false);
    }
  };

  const closeModal = () => {
    document.body.style.overflow = "auto";
    setScanModal({ type: null, barcode: null, scannedCode: '' });
    setTimeout(() => { scannerInputRef.current?.focus(); }, 100);
  };

  const handleConfirmRawScan = async () => {
    if (!pendingRawScan || !scanPersonName.trim()) return;
    setIsProcessingScan(true);
    
    try {
      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: pendingRawScan.code,
        department: 'RAW_MATERIAL',
        scanAction: pendingRawScan.action as any,
        payload: { personName: scanPersonName.trim() }
      });
      
      setScanModal({ type: 'success' as any, barcode: result.item, scannedCode: pendingRawScan.code, message: result.message } as any);
      fetchBatches();
    } catch (error: any) {
      console.error(error);
      if (error.message.includes('not found')) {
        setScanModal({ type: 'not_found', barcode: null, scannedCode: pendingRawScan.code });
      } else {
        setScanModal({ type: 'error' as any, barcode: null, scannedCode: pendingRawScan.code, message: error.message } as any);
      }
    } finally {
      setIsProcessingScan(false);
      setPendingRawScan(null);
      setScanPersonName('');
    }
  };

  const handleConfirmComboScan = async () => {
    if (!pendingComboScan || !scanPersonName.trim()) return;
    setIsProcessingScan(true);
    
    try {
      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: pendingComboScan.code,
        department: 'COMBO',
        scanAction: pendingComboScan.action as any,
        payload: { personName: scanPersonName.trim() }
      });
      
      setScanModal({ type: 'success' as any, barcode: result.item, scannedCode: pendingComboScan.code, message: result.message } as any);
      fetchBatches();
    } catch (error: any) {
      console.error(error);
      if (error.message.includes('not found')) {
        setScanModal({ type: 'not_found', barcode: null, scannedCode: pendingComboScan.code });
      } else {
        setScanModal({ type: 'error' as any, barcode: null, scannedCode: pendingComboScan.code, message: error.message } as any);
      }
    } finally {
      setIsProcessingScan(false);
      setPendingComboScan(null);
      setScanPersonName('');
    }
  };

  // RAW MATERIAL HELPERS
  
  const uniqueMaterials = Array.from(new Set(batches.map((b: any) => b.material_name)));
  const filteredBatches = batches.filter((b: any) => {
    const matchesSearch = b.material_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.batch_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    const stage = b.currentStage || 'READY_FOR_FIRST_SCAN';
    if (rawMaterialSubTab === 'IN') matchesStatus = ['RAW_MATERIAL_IN', 'RAW_MATERIAL_OUT'].includes(stage);
    if (rawMaterialSubTab === 'OUT') matchesStatus = stage === 'RAW_MATERIAL_OUT';
    
    const matchesMaterial = materialFilter === 'All' || b.material_name === materialFilter;
    return matchesSearch && matchesStatus && matchesMaterial;
  });

  // COMBO HELPERS
  const filteredComboBatches = comboBatches.filter((b: any) => {
    const codeToSearch = b.type === 'COMBO_BOX' ? b.comboBoxBarcode : (b.barcode_no || b.displayBarcode);
    const matchesSearch = 
      codeToSearch?.toLowerCase().includes(comboSearchTerm.toLowerCase()) ||
      b.comboName?.toLowerCase().includes(comboSearchTerm.toLowerCase()) ||
      b.combo_name?.toLowerCase().includes(comboSearchTerm.toLowerCase()) ||
      b.productCode?.toLowerCase().includes(comboSearchTerm.toLowerCase()) ||
      b.product_code?.toLowerCase().includes(comboSearchTerm.toLowerCase());
    
    let matchesType = true;
    if (comboTypeFilter === 'Product Barcode') matchesType = b.type === 'PRODUCT';
    if (comboTypeFilter === 'Combo Box Barcode') matchesType = b.type === 'COMBO_BOX';
    
    let matchesStatus = true;
    const stage = b.currentStage || 'READY_FOR_FIRST_SCAN';
    if (b.type === 'PRODUCT') {
      if (comboSubTab === 'IN') matchesStatus = ['PRODUCT_IN', 'PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);
      if (comboSubTab === 'OUT') matchesStatus = ['PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);
    } else {
      if (comboSubTab === 'IN') matchesStatus = ['COMBO_IN', 'COMBO_OUT', 'DISPATCHED'].includes(stage);
      if (comboSubTab === 'OUT') matchesStatus = ['COMBO_OUT', 'DISPATCHED'].includes(stage);
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  const downloadQR = (serial: string) => {
    const wrapper = document.getElementById(`view-barcode-${serial}`);
    const svg = wrapper?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      if (ctx) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }
      const downloadLink = document.createElement('a'); downloadLink.download = `Barcode-${serial}.png`;
      downloadLink.href = canvas.toDataURL('image/png'); downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handlePrint = (serial: string) => {
    const w = window.open();
    w?.document.write(`
      <html>
        <head><title>Print Barcode</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
          <img src="${document.getElementById(`view-barcode-${serial}`)?.querySelector('canvas')?.toDataURL() || ''}" />
        </body>
      </html>
    `);
    setTimeout(() => w?.print(), 500);
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading saved barcodes...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      
      {activeTab === 'PRODUCT' ? (
        <ProductBarcodeList onBack={() => setActiveTab(null)} />
      ) : (
        <>
          {/* HEADER */}
          <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {activeTab !== null && (
              <button 
                onClick={() => setActiveTab(null)}
                className="btn hover-lift"
                style={{ padding: '10px 16px', borderRadius: '12px', background: '#1e293b', color: 'white', border: '1px solid #263244', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <ArrowLeft size={16} /> Back to View Barcode
              </button>
            )}
            <h1 style={{ fontSize: '28px', margin: 0, color: 'white' }}>{activeTab === 'RAW_MATERIAL' ? 'Raw Material Barcodes' : activeTab === 'COMBO' ? 'Combo Barcodes' : 'View Barcode'}</h1>
          </div>

      {/* SELECTION CARDS */}
      {activeTab === null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <motion.div 
            whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(59, 130, 246, 0.2)' }}
            onClick={() => setActiveTab('RAW_MATERIAL')}
            style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #3b82f6', borderRadius: '24px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={40} color="#3b82f6" />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', color: 'white', margin: '0 0 8px 0', fontWeight: 800 }}>Raw Material</h2>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px' }}>View and scan raw material barcode labels.</p>
            </div>
      
  {/* HIDDEN LABEL FOR DOWNLOAD */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div ref={barcodeDownloadRef} style={{ width: '350px', background: 'white', padding: '24px', color: 'black', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Barcode value={downloadTarget?.barcode_no || downloadTarget?.serial_number || 'UNKNOWN'} width={1.8} height={70} displayValue={false} margin={0} />
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px', fontFamily: 'monospace', letterSpacing: '2px' }}>
              {downloadTarget?.barcode_no || downloadTarget?.serial_number}
            </div>
          </div>
          
          <div style={{ borderTop: '2px dashed #ccc', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
              <strong>Product Name:</strong> <span>{getProductFullName(downloadTarget?.product_code) || downloadTarget?.material_name || downloadTarget?.combo_name || '-'}</span>
            </div>
            {downloadTarget?.product_code && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
                <strong>Product Code:</strong> <span>{downloadTarget?.product_code}</span>
              </div>
            )}
            {downloadTarget?.pack_no && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
                <strong>Pack No:</strong> <span>{downloadTarget?.pack_no}</span>
              </div>
            )}
            {(downloadTarget?.combo_name || downloadTarget?.combo_code) && downloadTarget?.type !== 'COMBO_BOX' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
                <strong>Combo Name:</strong> <span>{downloadTarget?.combo_name || downloadTarget?.combo_code}</span>
              </div>
            )}
            {downloadTarget?.type === 'COMBO_BOX' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
                <strong>Total Packs:</strong> <span>{downloadTarget?.combo_quantity || downloadTarget?.total_packs}</span>
              </div>
            )}
            {downloadTarget?.original_quantity && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: '4px' }}>
                <strong>Quantity:</strong> <span>{downloadTarget?.original_quantity} KG</span>
              </div>
            )}
            {downloadTarget?.created_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Date:</strong> <span>{new Date(downloadTarget.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    
    </motion.div>

          
          <motion.div 
            whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(236, 72, 153, 0.2)' }}
            onClick={() => setActiveTab('PRODUCT')}
            style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #ec4899', borderRadius: '24px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #ec4899, #f472b6)' }} />
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={40} color="#ec4899" />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', color: 'white', margin: '0 0 8px 0', fontWeight: 800 }}>Product</h2>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px' }}>View and scan finished product bottle barcodes.</p>
            </div>
          </motion.div>
<motion.div 
            whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(139, 92, 246, 0.2)' }}
            onClick={() => setActiveTab('COMBO')}
            style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #8b5cf6', borderRadius: '24px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={40} color="#8b5cf6" />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', color: 'white', margin: '0 0 8px 0', fontWeight: 800 }}>Combo</h2>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px' }}>View and scan combo box and combo product barcodes.</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* SCANNER INPUT (Universal) */}
      {activeTab !== null && (
      <div style={{ background: 'rgba(17, 24, 39, 0.8)', padding: '20px', borderRadius: '16px', border: `1px solid ${activeTab === 'RAW_MATERIAL' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`, marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarcodeIcon size={20} style={{ color: activeTab === 'RAW_MATERIAL' ? '#3b82f6' : '#8b5cf6' }} />
          <span style={{ fontWeight: 700, color: 'white', fontSize: '16px' }}>Scan {activeTab === 'RAW_MATERIAL' ? 'Raw Material' : 'Combo'} Barcode</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            id="universal-scanner-input"
            ref={scannerInputRef} type="text" placeholder={`Scan or enter ${activeTab === 'RAW_MATERIAL' ? 'raw material' : 'combo'} barcode number`}
            value={scannerValue} onChange={(e) => setScannerValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(e.currentTarget.value); }}
            style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#070b12', color: 'white', fontSize: '15px', outline: 'none' }}
          />
          <button 
            onClick={() => handleScan(scannerValue)}
            style={{ height: '48px', fontWeight: 700, padding: '0 24px', borderRadius: '10px', background: activeTab === 'RAW_MATERIAL' ? 'linear-gradient(to right, #2563eb, #3b82f6)' : 'linear-gradient(to right, #7c3aed, #8b5cf6)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Trigger Scan
          </button>
        </div>
      </div>
      )}

      {/* ------------------------------------- */}
      {/* RAW MATERIAL SECTION */}
      {/* ------------------------------------- */}
      {activeTab === 'RAW_MATERIAL' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* STATS PANELS */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '12px', flex: 1 }}>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={12}/> Scanned Today</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: '1' }}>
                {batches.filter(b => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const inDate = b.inventoryInAt ? String(b.inventoryInAt).split('T')[0] : null;
                  const outDate = b.inventoryOutAt ? String(b.inventoryOutAt).split('T')[0] : null;
                  return inDate === todayStr || outDate === todayStr;
                }).length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '12px', flex: 1 }}>
              <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={12}/> Pending Scan</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: '1' }}>{batches.filter(b => !b.currentStage || b.currentStage === 'READY_FOR_FIRST_SCAN').length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '12px', flex: 1 }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><BarcodeIcon size={12}/> Total Barcodes</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: '1' }}>{batches.length}</span>
            </div>
          </div>

          {/* SUB-TABS NAVIGATION */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(17, 24, 39, 0.6)', padding: '8px', borderRadius: '16px', border: '1px solid rgba(38, 50, 68, 0.8)', overflowX: 'auto' }}>
            <button onClick={() => setRawMaterialSubTab('ALL')} style={{ padding: '10px 24px', borderRadius: '10px', background: rawMaterialSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: rawMaterialSubTab === 'ALL' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>All Raw Materials</button>
            <button onClick={() => setRawMaterialSubTab('IN')} style={{ padding: '10px 24px', borderRadius: '10px', background: rawMaterialSubTab === 'IN' ? '#3b82f6' : 'transparent', color: rawMaterialSubTab === 'IN' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Inventory IN Barcodes</button>
            <button onClick={() => setRawMaterialSubTab('OUT')} style={{ padding: '10px 24px', borderRadius: '10px', background: rawMaterialSubTab === 'OUT' ? '#3b82f6' : 'transparent', color: rawMaterialSubTab === 'OUT' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Inventory OUT Barcodes</button>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input type="text" placeholder="Search material, vendor, barcode..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '16px', height: '44px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', outline: 'none' }} />
            </div>
            <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} style={{ height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', outline: 'none' }}>
              <option value="All">All Materials</option>
              {uniqueMaterials.map((m: any) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredBatches.map((b: any) => {
              const stage = b.currentStage || 'READY_FOR_FIRST_SCAN';
              const badgeInfo = getRawBadge(stage, rawMaterialSubTab);
              const displayBarcode = (b.displayBarcode || b.barcodeNumber || b.barcode || b.code || b.serial_number || b.barcode_no || b.batchNo || b.id || "").toString().trim().toUpperCase().replace(/\s+/g, "");
              
              return (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: `1px solid ${badgeInfo.color}40`, overflow: 'hidden' }}>
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  
                  <div id={`view-barcode-${displayBarcode}`}>
                    <Barcode value={displayBarcode} width={1.5} height={50} displayValue={false} margin={0} />
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: badgeInfo.bg, color: badgeInfo.color, width: '100%' }}>
                    {badgeInfo.text}
                  </div>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'white' }}>{b.material_name}</h3>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{displayBarcode}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#070b12', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={{ fontSize: '10px', color: '#64748b' }}>Quantity</span><span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{b.original_quantity} KG</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={{ fontSize: '10px', color: '#64748b' }}>Vendor</span><span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{b.vendor_name || '-'}</span></div>
                    {b.inventoryInPersonName && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={{ fontSize: '10px', color: '#64748b' }}>Scanned IN By</span><span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700 }}>{b.inventoryInPersonName}</span></div>
                    )}
                    {b.inventoryOutPersonName && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={{ fontSize: '10px', color: '#64748b' }}>Scanned OUT By</span><span style={{ fontSize: '13px', color: '#f43f5e', fontWeight: 700 }}>{b.inventoryOutPersonName}</span></div>
                    )}
                  </div>
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #1e293b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#111827' }}>
                  <button onClick={() => setSelectedBatch(b)} className="btn hover-lift" style={{ padding: '8px', background: 'transparent', border: '1px solid #263244', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Eye size={14}/> Details</button>
                  <button onClick={() => downloadQR(b.serial_number)} className="btn hover-lift" style={{ padding: '8px', background: 'transparent', border: '1px solid #263244', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Download size={14}/> Label</button>
                  <button onClick={() => { navigator.clipboard.writeText(b.serial_number); toast.success('Copied!'); }} className="btn hover-lift" style={{ padding: '8px', background: '#1e293b', border: 'none', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Copy size={14}/> Copy</button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeleteModal({ type: 'raw_material', barcode: b }); }} 
                    style={{ padding: '8px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                  ><Trash2 size={14}/> Delete</button>
                </div>
              </div>
            )})}
          </div>
        </motion.div>
      )}

      {/* ------------------------------------- */}
      {/* COMBO SECTION */}
      {/* ------------------------------------- */}
      {activeTab === 'COMBO' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* SUB-TABS NAVIGATION */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(17, 24, 39, 0.6)', padding: '8px', borderRadius: '16px', border: '1px solid rgba(38, 50, 68, 0.8)', overflowX: 'auto' }}>
            <button onClick={() => setComboSubTab('ALL')} style={{ padding: '10px 24px', borderRadius: '10px', background: comboSubTab === 'ALL' ? '#8b5cf6' : 'transparent', color: comboSubTab === 'ALL' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>All Combos</button>
            <button onClick={() => setComboSubTab('IN')} style={{ padding: '10px 24px', borderRadius: '10px', background: comboSubTab === 'IN' ? '#8b5cf6' : 'transparent', color: comboSubTab === 'IN' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Inventory IN Barcodes</button>
            <button onClick={() => setComboSubTab('OUT')} style={{ padding: '10px 24px', borderRadius: '10px', background: comboSubTab === 'OUT' ? '#8b5cf6' : 'transparent', color: comboSubTab === 'OUT' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Inventory OUT Barcodes</button>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input type="text" placeholder="Search combo, product code, barcode..." value={comboSearchTerm} onChange={(e) => setComboSearchTerm(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '16px', height: '44px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', outline: 'none' }} />
            </div>
            <select value={comboTypeFilter} onChange={(e) => setComboTypeFilter(e.target.value)} style={{ height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', outline: 'none' }}>
              <option value="All Types">All Types</option>
              <option value="Product Barcode">Product Barcodes</option>
              <option value="Combo Box Barcode">Combo Box Barcodes</option>
            </select>
          </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {(() => {
              const grouped: Record<string, any[]> = {};
              filteredComboBatches.forEach((b: any) => {
                const bid = b.batch_id || b.comboBoxBarcode || 'UNKNOWN';
                if (!grouped[bid]) grouped[bid] = [];
                grouped[bid].push(b);
              });

              return Object.keys(grouped).map(batchId => {
                const group = grouped[batchId];
                const boxBc = group.find((b: any) => b.type === 'COMBO_BOX');
                const prodBcs = group.filter((b: any) => b.type === 'PRODUCT');
                const comboName = boxBc?.comboName || boxBc?.combo_name || prodBcs[0]?.combo_name || 'Unknown Combo';

                const renderActions = (b: any, isBox: boolean) => (
                  <div style={{ padding: '16px', borderTop: '1px solid #1e293b', display: 'flex', gap: '8px', background: '#111827', flexWrap: 'wrap' }}>
                    {(b.status === 'EMPTY' || b.status === 'PARTIAL') && isBox && (
                      <button onClick={() => navigate('/inventory/combos/create', { state: { packBox: b.comboBoxBarcode || b.barcode_no } })} className="btn hover-lift" style={{ flex: '1 1 100%', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderRadius: '8px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Plus size={16}/> Add Product
                      </button>
                    )}
                    <button onClick={() => setSelectedComboBatch(b)} className="btn hover-lift" style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #263244', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Eye size={14}/> Details</button>
                    <button onClick={() => downloadQR(b.comboBoxBarcode || b.barcode_no)} className="btn hover-lift" style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #263244', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Download size={14}/> Label</button>
                    <button onClick={() => { navigator.clipboard.writeText(b.comboBoxBarcode || b.barcode_no); toast.success('Copied!'); }} className="btn hover-lift" style={{ flex: 1, padding: '8px', background: '#1e293b', border: 'none', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Copy size={14}/> Copy</button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeleteModal({ type: isBox ? 'combo_box' : 'combo_product', barcode: b }); }} 
                      style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                    ><Trash2 size={14}/> Delete</button>
                  </div>
                );

                return (
                  <div key={batchId} style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: '16px', overflow: 'hidden' }}>
                    
                    <div style={{ padding: '24px', background: 'linear-gradient(145deg, #1e293b, #0f172a)', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '20px', fontWeight: 800 }}>{comboName}</h2>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace' }}>{batchId}</div>
                      </div>
                    </div>
                    
                    <div style={{ padding: '24px', display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
                      
                      {/* SECTION 1: MAPPED COMBO BARCODE */}
                      {boxBc && (
                        <div style={{ flex: '1 1 400px', maxWidth: '420px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: `1px solid rgba(59, 130, 246, 0.3)`, overflow: 'hidden' }}>
                            <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                              <div id={`view-barcode-${boxBc.comboBoxBarcode}`}>
                                {(() => { const master = (boxBc.displayBarcode || boxBc.barcodeNumber || boxBc.comboBoxBarcode || boxBc.barcode || boxBc.code || boxBc.serial_number || boxBc.barcode_no || boxBc.batchNo || boxBc.id || "").toString().trim().toUpperCase().replace(/\s+/g, ""); return <Barcode value={master} width={1.8} height={60} displayValue={false} margin={0} />; })()}
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '100%' }}>
                                  <Box size={14}/> COMBO BOX
                                </div>
                                {(() => {
                                  let badgeText = '';
                                  let bg = '';
                                  let fg = '';

                                  if (boxBc.status === 'EMPTY' || boxBc.status === 'PARTIAL') {
                                    badgeText = 'ADD PRODUCTS';
                                    bg = 'rgba(239, 68, 68, 0.1)';
                                    fg = '#ef4444';
                                  } else {
                                    badgeText = boxBc.currentStage === 'READY_FOR_FIRST_SCAN' ? 'READY TO SCAN IN' : boxBc.currentStage === 'COMBO_OUT' ? (comboSubTab === 'OUT' ? 'SCANNED OUT' : 'SCANNED OUT') : boxBc.currentStage === 'COMBO_IN' ? (comboSubTab === 'IN' ? 'SCAN TO OUT' : 'SCANNED IN') : 'SCANNED';
                                    bg = boxBc.currentStage === 'READY_FOR_FIRST_SCAN' ? 'rgba(245, 158, 11, 0.1)' : boxBc.currentStage === 'COMBO_OUT' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                                    fg = boxBc.currentStage === 'READY_FOR_FIRST_SCAN' ? '#f59e0b' : boxBc.currentStage === 'COMBO_OUT' ? '#ef4444' : '#10b981';
                                  }

                                  return (
                                    <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', background: bg, color: fg, width: '100%', whiteSpace: 'nowrap' }}>
                                      {badgeText}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            <div style={{ padding: '20px', flex: 1 }}>
                              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'white' }}>{comboName}</h3>
                              <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '16px' }}>{(boxBc.displayBarcode || boxBc.barcodeNumber || boxBc.barcode || boxBc.code || boxBc.serial_number || boxBc.barcode_no || boxBc.batchNo || boxBc.id || "").toString().trim().toUpperCase().replace(/\s+/g, "")}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', background: '#070b12', padding: '12px', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Total Packs</span><span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{boxBc.combo_quantity || boxBc.total_packs} Packs</span></div>
                                {boxBc.generatedBy && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Generated By</span><span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{boxBc.generatedBy}</span></div>
                                )}
                                {boxBc.comboInventoryInPersonName && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '11px', color: '#64748b' }}>IN Person</span><span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{boxBc.comboInventoryInPersonName}</span></div>
                                )}
                                {boxBc.comboInventoryOutPersonName && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '11px', color: '#64748b' }}>OUT Person</span><span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{boxBc.comboInventoryOutPersonName}</span></div>
                                )}
                              </div>
                            </div>
                            {renderActions(boxBc, true)}
                            <button 
                              onClick={() => setExpandedCombos(prev => ({...prev, [batchId]: !prev[batchId]}))}
                              className="hover-lift"
                              style={{ width: '100%', padding: '16px', background: expandedCombos[batchId] ? '#312e81' : '#1e1b4b', border: 'none', borderTop: '1px solid #3730a3', color: '#a5b4fc', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                            >
                              <Package size={16} />
                              {expandedCombos[batchId] ? 'Hide Combo' : 'View Combo'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SECTION 2: PRODUCT BARCODES (RIGHT SIDE PANEL) */}
                      {expandedCombos[batchId] && prodBcs.length > 0 && (
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ flex: '2 1 400px', minWidth: '320px' }}>
                          <div style={{ background: '#070b12', borderRadius: '16px', border: '1px solid #1e293b', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                              <h3 style={{ margin: '0', fontSize: '16px', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Boxes size={18} color="#a78bfa" /> Products Inside Combo
                              </h3>
                              <button 
                                onClick={() => handleDownloadAll(group, comboName, batchId)} 
                                disabled={isDownloadingAll === batchId}
                                className="btn hover-lift" 
                                style={{ padding: '6px 14px', borderRadius: '8px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', cursor: isDownloadingAll === batchId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s', opacity: isDownloadingAll === batchId ? 0.6 : 1 }}
                              >
                                {isDownloadingAll === batchId ? <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #60a5fa', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} /> : <Download size={14} />} 
                                {isDownloadingAll === batchId ? 'Zipping...' : 'Download All'}
                              </button>
                            </div>
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {prodBcs.map((b: any, index: number) => {
                                const theme = getProductTheme(b.product_code);
                                return (
                                  <div key={b.id || b.barcode_no} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827', borderRadius: '12px', border: `1px solid ${theme.border}`, padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: theme.bg, color: theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>{index + 1}</div>
                                      <div>
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'white', fontWeight: 700 }}>{getProductFullName(b.product_code)}</h4>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                                          <span style={{ display: 'flex', gap: '4px' }}>Code: <strong style={{ color: 'white' }}>{b.product_code}</strong></span>
                                          <span style={{ display: 'flex', gap: '4px' }}>Qty: <strong style={{ color: 'white' }}>{b.quantity || 1}</strong></span>
                                          <span style={{ display: 'flex', gap: '4px' }}>Pack: <strong style={{ color: 'white' }}>{b.pack_no}</strong></span>
                                        </div>
                                      </div>
                                    </div>
                                    <button onClick={() => setScanModal({ type: 'combo_info', barcode: b, scannedCode: b.barcode_no })} className="btn hover-lift" style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      <Eye size={14}/> View Barcode
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </motion.div>
      )}

      {/* ------------------------------------- */}
      {/* MODALS */}
      {/* ------------------------------------- */}
      <AnimatePresence>
        {scanModal.type && (
          <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              style={{ background: '#111827', border: '1px solid #263244', borderRadius: '24px', width: '100%', maxWidth: '450px', overflow: 'hidden' }}>
              
              {/* UNIVERSAL SUCCESS MODAL (RAW MATERIAL / COMBO / PRODUCT) */}
              {(scanModal.type === 'confirm' || scanModal.type === 'combo_info') && scanModal.barcode && (() => {
                const isComboBox = scanModal.barcode.type === 'COMBO_BOX';
                const isProduct = scanModal.barcode.type === 'PRODUCT' || (!isComboBox && scanModal.barcode.product_code);
                const isRawMaterial = !isComboBox && !isProduct;
                
                const safeVal = (v: any) => v || '-';

                return (
                <div style={{ animation: 'fadeInScale 0.25s ease-out' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                    <div style={{ margin: '0 auto 16px auto', background: isRawMaterial ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: isRawMaterial ? '#10b981' : '#3b82f6', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={32} /></div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>✅ Barcode Detected</h2>
                    <div style={{ color: '#94a3b8', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                      {isRawMaterial ? 'Raw Material Information' : isComboBox ? 'Combo Box Details' : 'Finished Product Details'}
                    </div>
                  </div>
                  
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
                    
                    {isRawMaterial && (
                      <div style={{ background: 'rgba(17, 24, 39, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', overflow: 'hidden' }}>
                        {/* Header Section: Material & Barcode */}
                        <div style={{ padding: '20px', background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Material Name</span>
                          <div style={{ fontWeight: 800, color: '#3b82f6', fontSize: '18px', marginBottom: '12px' }}>
                            {safeVal(scanModal.barcode.material_name || scanModal.barcode.name || scanModal.barcode.item_name || getProductFullName(scanModal.barcode.material_id) || 'Unknown Material')}
                          </div>
                          
                          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Barcode Number</span>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: '15px' }}>
                            {safeVal(scanModal.barcode.serial_number || scanModal.barcode.barcode_no || scanModal.barcode.batch_id)}
                          </div>
                        </div>

                        {/* Grid Section: Details */}
                        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Available Quantity</span>
                            {(() => {
                              const qty = parseFloat(scanModal.barcode.available_quantity || scanModal.barcode.original_quantity || 0);
                              let badgeColor = '#ef4444'; let badgeBg = 'rgba(239, 68, 68, 0.1)';
                              if (qty >= 20) { badgeColor = '#10b981'; badgeBg = 'rgba(16, 185, 129, 0.1)'; }
                              else if (qty >= 5) { badgeColor = '#f59e0b'; badgeBg = 'rgba(245, 158, 11, 0.1)'; }
                              return <div style={{ fontWeight: 800, color: badgeColor, background: badgeBg, display: 'inline-block', padding: '4px 8px', borderRadius: '6px' }}>{qty} {safeVal(scanModal.barcode.unit || 'KG')}</div>;
                            })()}
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Batch Number</span>
                            <div style={{ fontWeight: 700, color: 'white' }}>{safeVal(scanModal.barcode.batch_number || scanModal.barcode.batch_no || scanModal.barcode.batch_id)}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Vendor</span>
                            <div style={{ fontWeight: 700, color: 'white' }}>{safeVal(scanModal.barcode.vendor_name || scanModal.barcode.vendor)}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Scanning Person</span>
                            <div style={{ fontWeight: 700, color: 'white' }}>{safeVal(scanModal.barcode.scanningPersonName)}</div>
                          </div>
                          {scanModal.barcode.inventoryInPersonName && (
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Scanned IN By</span>
                              <div style={{ fontWeight: 700, color: '#10b981' }}>{scanModal.barcode.inventoryInPersonName}</div>
                            </div>
                          )}
                          {scanModal.barcode.inventoryOutPersonName && (
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Scanned OUT By</span>
                              <div style={{ fontWeight: 700, color: '#f43f5e' }}>{scanModal.barcode.inventoryOutPersonName}</div>
                            </div>
                          )}
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Received Date</span>
                            <div style={{ fontWeight: 700, color: 'white' }}>{(scanModal.barcode.received_date || scanModal.barcode.created_at) ? new Date(scanModal.barcode.received_date || scanModal.barcode.created_at).toLocaleDateString() : '-'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Price / GST</span>
                            <div style={{ fontWeight: 700, color: 'white' }}>
                              {(scanModal.barcode.price || scanModal.barcode.price_per_kg) ? `₹${Number(scanModal.barcode.price || scanModal.barcode.price_per_kg).toFixed(2)}` : '-'}
                              {(scanModal.barcode.gst || scanModal.barcode.gst_percent) ? ` + ${scanModal.barcode.gst || scanModal.barcode.gst_percent}% GST` : ''}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Purchase Ref</span>
                            <div style={{ fontWeight: 700, color: 'white' }}>{safeVal(scanModal.barcode.po_number || scanModal.barcode.purchase_ref || scanModal.barcode.po_reference)}</div>
                          </div>
                          
                          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #1e293b', paddingTop: '16px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Current Status</span>
                            <div style={{ fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
                              ● Available
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {isComboBox && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Combo Name</span><div style={{ fontWeight: 800, color: '#a78bfa', fontSize: '16px' }}>{safeVal(scanModal.barcode.combo_name)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Combo Barcode Number</span><div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: '15px' }}>{safeVal(scanModal.barcode.barcode_no)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Combo Batch ID</span><div style={{ fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>{safeVal(scanModal.barcode.batch_id)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Date Created</span><div style={{ fontWeight: 700, color: 'white' }}>{scanModal.barcode.created_at ? new Date(scanModal.barcode.created_at).toLocaleDateString() : '-'}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Total Items</span><div style={{ fontWeight: 800, color: '#10b981' }}>{safeVal(scanModal.barcode.combo_quantity || scanModal.barcode.total_packs)}</div></div>
                        {scanModal.barcode.generatedBy && (
                          <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Generated By</span>
                            <div style={{ fontWeight: 800, color: 'white', fontSize: '15px' }}>{scanModal.barcode.generatedBy}</div>
                          </div>
                        )}
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Current Location</span>
                          <div style={{ fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
                            ● COMBO
                          </div>
                        </div>
                        
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1', marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>Products Inside</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(() => {
                               const linkedProducts = comboBatchesRef.current.filter((b: any) => b.batch_id === scanModal.barcode.batch_id && b.type === 'PRODUCT');
                               return linkedProducts.length > 0 ? linkedProducts.map((lp: any, idx: number) => (
                                 <div key={lp.barcode_no} style={{ display: 'flex', justifyContent: 'space-between', background: '#111827', padding: '8px 12px', borderRadius: '8px' }}>
                                   <div>
                                     <div style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>{idx + 1}. {getProductFullName(lp.product_code)}</div>
                                     <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>{lp.barcode_no}</div>
                                   </div>
                                   <div style={{ color: '#94a3b8', fontSize: '12px' }}>Qty: {lp.quantity || 1}</div>
                                 </div>
                               )) : <div style={{ color: '#64748b', fontSize: '13px' }}>No products found</div>;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {isProduct && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1', textAlign: 'center' }}>
                          <Barcode value={scanModal.barcode.barcode_no || scanModal.barcode.serial_number} width={1.5} height={50} displayValue={false} margin={0} />
                        </div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Product Name</span><div style={{ fontWeight: 800, color: '#f472b6', fontSize: '16px' }}>{getProductFullName(scanModal.barcode.product_code)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Barcode Number</span><div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: '15px' }}>{safeVal(scanModal.barcode.barcode_no || scanModal.barcode.serial_number)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Batch Size / Quantity</span><div style={{ fontWeight: 700, color: 'white' }}>{safeVal(scanModal.barcode.quantity || 1)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Manufactured Date</span><div style={{ fontWeight: 700, color: 'white' }}>{scanModal.barcode.created_at ? new Date(scanModal.barcode.created_at).toLocaleDateString() : '-'}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Current Status</span>
                          <div style={{ fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
                            ● Available
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ padding: '24px', display: 'flex', gap: '16px', background: '#070b12', borderTop: '1px solid #1e293b' }}>
                    <button onClick={closeModal} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'transparent', border: '1px solid #263244', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                    {!isRawMaterial && (
                      <button onClick={() => handleDownloadBarcode(scanModal.barcode)} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}><Download size={18} /> Download Barcode</button>
                    )}
                    {isRawMaterial && (
                      <button onClick={closeModal} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>Confirm</button>
                    )}
                    {isComboBox && scanModal.barcode.batch_id && (
                      <button onClick={() => { closeModal(); navigate(`/inventory/combos/batch/${scanModal.barcode.batch_id}`); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: '#1e293b', border: 'none', cursor: 'pointer', fontWeight: 700 }}>View Batch</button>
                    )}
                  </div>
                  <style>{`@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
                </div>
              ) })()}

              {/* OTHERS */}
              {scanModal.type === 'not_found' && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto 16px auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={32} /></div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', margin: '0 0 8px 0' }}>Not Found</h2>
                  <p style={{ color: '#94a3b8', margin: '0 0 24px 0' }}>Barcode {scanModal.scannedCode} does not exist in {activeTab === 'RAW_MATERIAL' ? 'Raw Materials' : 'Combos'}.</p>
                  <button onClick={closeModal} style={{ width: '100%', padding: '14px', borderRadius: '12px', color: 'white', background: '#1e293b', border: 'none', cursor: 'pointer' }}>Close</button>
                </div>
              )}
              {scanModal.type === 'already_scanned' && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto 16px auto', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><History size={32} /></div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', margin: '0 0 8px 0' }}>Already Scanned</h2>
                  <button onClick={closeModal} style={{ width: '100%', padding: '14px', borderRadius: '12px', color: 'white', background: '#1e293b', border: 'none', cursor: 'pointer', marginTop: '24px' }}>Close</button>
                </div>
              )}
              {scanModal.type === 'empty' && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', margin: '0 0 8px 0' }}>Empty Scan</h2>
                  <button onClick={closeModal} style={{ width: '100%', padding: '14px', borderRadius: '12px', color: 'white', background: '#1e293b', border: 'none', cursor: 'pointer', marginTop: '24px' }}>Close</button>
                </div>
              )}
              {scanModal.type === 'success' && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto 16px auto', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', margin: '0 0 8px 0' }}>Success</h2>
                  <p style={{ color: '#94a3b8', margin: '0 0 24px 0' }}>{scanModal.message}</p>
                  <button onClick={closeModal} style={{ width: '100%', padding: '14px', borderRadius: '12px', color: 'white', background: '#1e293b', border: 'none', cursor: 'pointer' }}>Close</button>
                </div>
              )}
              {scanModal.type === 'error' && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto 16px auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={32} /></div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444', margin: '0 0 8px 0' }}>Error</h2>
                  <p style={{ color: '#94a3b8', margin: '0 0 24px 0' }}>{scanModal.message}</p>
                  <button onClick={closeModal} style={{ width: '100%', padding: '14px', borderRadius: '12px', color: 'white', background: '#1e293b', border: 'none', cursor: 'pointer' }}>Close</button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* DELETE MODALS */}
        {deleteModal.type && deleteModal.barcode && (
          <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              style={{ background: '#111827', border: '1px solid #ef4444', borderRadius: '24px', width: '100%', maxWidth: '450px', overflow: 'hidden' }}>
              
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                <div style={{ margin: '0 auto 16px auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(239,68,68,0.2)' }}><Trash2 size={32} /></div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>
                  {deleteModal.type === 'raw_material' ? 'Delete Raw Material Barcode' : deleteModal.type === 'combo_product' ? 'Delete Product Barcode' : 'Delete Combo Box'}
                </h2>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {deleteModal.type === 'raw_material' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Barcode</span><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{deleteModal.barcode.serial_number || deleteModal.barcode.barcode_no || deleteModal.barcode.id}</div></div>
                      <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Material</span><div style={{ fontWeight: 700, color: 'white' }}>{deleteModal.barcode.material_name}</div></div>
                      <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Quantity</span><div style={{ fontWeight: 700, color: 'white' }}>{deleteModal.barcode.original_quantity} KG</div></div>
                      <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Batch</span><div style={{ fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deleteModal.barcode.batch_number || 'N/A'}</div></div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', marginTop: '8px' }}>
                      <div style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={16}/> This action will:</div>
                      <ul style={{ margin: 0, paddingLeft: '24px', color: '#fca5a5', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <li>Remove this barcode permanently</li>
                        <li>Remove it from Inventory Room</li>
                        <li>Remove it from Raw Material Storage</li>
                        <li>Remove all linked stock records</li>
                        <li>Update dashboard counts automatically</li>
                      </ul>
                    </div>
                  </>
                )}

                {deleteModal.type === 'combo_product' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                      <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Barcode</span><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{deleteModal.barcode.barcode_no || deleteModal.barcode.serial_number || deleteModal.barcode.id}</div></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Product</span><div style={{ fontWeight: 700, color: 'white' }}>{getProductFullName(deleteModal.barcode.product_code)}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Combo</span><div style={{ fontWeight: 700, color: 'white' }}>{deleteModal.barcode.combo_name || 'Combo'}</div></div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', marginTop: '8px' }}>
                      <div style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={16}/> Warning</div>
                      <div style={{ color: '#fca5a5', fontSize: '13px', lineHeight: '1.5' }}>
                        This will remove only this product barcode from the combo. <br/><br/>
                        If this is the last barcode, the combo box will also be removed automatically.
                      </div>
                    </div>
                  </>
                )}

                {deleteModal.type === 'combo_box' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                      <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Barcode</span><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{deleteModal.barcode.barcode_no || deleteModal.barcode.serial_number || deleteModal.barcode.id}</div></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Combo</span><div style={{ fontWeight: 700, color: 'white' }}>{deleteModal.barcode.combo_name || 'Combo Box'}</div></div>
                        <div style={{ background: '#070b12', padding: '12px', borderRadius: '12px', border: '1px solid #1e293b' }}><span style={{ fontSize: '11px', color: '#64748b' }}>Total Packs</span><div style={{ fontWeight: 700, color: 'white' }}>{deleteModal.barcode.combo_quantity}</div></div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', marginTop: '8px' }}>
                      <div style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={16}/> This will delete:</div>
                      <ul style={{ margin: 0, paddingLeft: '24px', color: '#fca5a5', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <li>Combo Box barcode</li>
                        <li>All linked product barcodes</li>
                        <li>Combo inventory record</li>
                        <li>Combo batch</li>
                        <li style={{ color: '#10b981', fontWeight: 'bold', marginTop: '4px' }}>and restore stock back to Product Inventory.</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
              
              <div style={{ padding: '24px', display: 'flex', gap: '16px', background: '#070b12' }}>
                <button disabled={isDeleting} onClick={cancelDelete} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'transparent', border: '1px solid #263244', cursor: 'pointer' }}>Cancel</button>
                <button disabled={isDeleting} onClick={handleDeleteConfirm} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* CONFIRM RAW MATERIAL SCAN MODAL */}
        {pendingRawScan && pendingRawScan.record && (
          <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              style={{ background: '#111827', border: '1px solid #3b82f6', borderRadius: '24px', width: '100%', maxWidth: '450px', overflow: 'hidden' }}>
              
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>
                  {pendingRawScan.action === 'IN' ? 'Confirm Inventory IN' : 'Confirm Inventory OUT'}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Please provide your name to continue.</p>
              </div>

              {/* MATERIAL DETAILS */}
              <div style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Material Name</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingRawScan.record.material_name || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Barcode Number</span>
                    <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '14px', fontFamily: 'monospace' }}>{pendingRawScan.record.serial_number || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Quantity</span>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: '14px' }}>{pendingRawScan.record.original_quantity || '-'} KG</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Vendor Name</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingRawScan.record.vendor_name || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Batch No</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingRawScan.record.batch_number || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Received Date</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingRawScan.record.created_at ? new Date(pendingRawScan.record.created_at).toLocaleDateString() : '-'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Current Status</span>
                    <div style={{ fontWeight: 700, color: '#34d399', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
                       {pendingRawScan.record.currentStage || 'READY_FOR_FIRST_SCAN'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Scanning Person Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" value={scanPersonName} onChange={e => setScanPersonName(e.target.value)} 
                         autoFocus
                         className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full" />
                </div>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', gap: '16px', background: '#070b12', borderTop: '1px solid #1e293b' }}>
                <button onClick={() => { setPendingRawScan(null); setScanPersonName(''); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'transparent', border: '1px solid #263244', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleConfirmRawScan} disabled={!scanPersonName.trim()} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: !scanPersonName.trim() ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', cursor: !scanPersonName.trim() ? 'not-allowed' : 'pointer', fontWeight: 700 }}>Confirm</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingComboScan && pendingComboScan.record && (
          <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              style={{ background: '#111827', border: '1px solid #3b82f6', borderRadius: '24px', width: '100%', maxWidth: '450px', overflow: 'hidden' }}>
              
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>
                  {pendingComboScan.action === 'IN' ? 'Confirm Combo Inventory IN' : 'Confirm Combo Inventory OUT'}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Please provide your name to continue.</p>
              </div>

              {/* COMBO DETAILS */}
              <div style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Combo Name</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingComboScan.record.comboName || pendingComboScan.record.combo_name || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Combo Box Barcode</span>
                    <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '14px', fontFamily: 'monospace' }}>{pendingComboScan.record.comboBoxBarcode || pendingComboScan.record.barcode_no || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Required Products</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingComboScan.record.requiredItems ? pendingComboScan.record.requiredItems.reduce((acc: any, req: any) => acc + req.requiredQty, 0) : '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Packed Products</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingComboScan.record.packedItems ? pendingComboScan.record.packedItems.length : '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Generated By</span>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: '14px' }}>{pendingComboScan.record.generatedBy || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Current Status</span>
                    <div style={{ fontWeight: 700, color: '#34d399', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
                       {pendingComboScan.record.currentStage || 'READY_FOR_FIRST_SCAN'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Scanning Person Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" value={scanPersonName} onChange={e => setScanPersonName(e.target.value)} 
                         autoFocus
                         className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full" />
                </div>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', gap: '16px', background: '#070b12', borderTop: '1px solid #1e293b' }}>
                <button onClick={() => { setPendingComboScan(null); setScanPersonName(''); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'transparent', border: '1px solid #263244', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleConfirmComboScan} disabled={!scanPersonName.trim()} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: !scanPersonName.trim() ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', cursor: !scanPersonName.trim() ? 'not-allowed' : 'pointer', fontWeight: 700 }}>Confirm</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILS MODALS */}
      {selectedBatch && (
        <div className="modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Barcode Details</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }} onClick={() => setSelectedBatch(null)}><X size={24} /></button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group"><label>Material Name</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.material_name}</div></div>
              <div className="form-group"><label>Barcode Number</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px', fontFamily: 'monospace' }}>{selectedBatch.serial_number}</div></div>
              <div className="form-group"><label>Quantity</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.original_quantity} KG</div></div>
              <div className="form-group"><label>Vendor Name</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.vendor_name || '--'}</div></div>
              <div className="form-group"><label>Batch</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.batch_number || '--'}</div></div>
              <div className="form-group"><label>Received Date</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.created_at ? new Date(selectedBatch.created_at).toLocaleString() : '--'}</div></div>
              {(selectedBatch.inventoryInPersonName || selectedBatch.inventoryInAt) && (
                <div className="form-group"><label>Scanned IN By/At</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.inventoryInPersonName || '--'} <br/><span style={{fontSize: '12px', color: 'var(--text-muted)'}}>{selectedBatch.inventoryInAt ? new Date(selectedBatch.inventoryInAt).toLocaleString() : '--'}</span></div></div>
              )}
              {(selectedBatch.inventoryOutPersonName || selectedBatch.inventoryOutAt) && (
                <div className="form-group"><label>Scanned OUT By/At</label><div style={{ padding: '10px', background: 'var(--surface-soft)', borderRadius: '6px' }}>{selectedBatch.inventoryOutPersonName || '--'} <br/><span style={{fontSize: '12px', color: 'var(--text-muted)'}}>{selectedBatch.inventoryOutAt ? new Date(selectedBatch.inventoryOutAt).toLocaleString() : '--'}</span></div></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn hover-lift" onClick={() => handleDownloadBarcode(selectedBatch)} style={{ padding: '10px 20px', borderRadius: '8px', color: 'white', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}><Download size={16} /> Download Barcode</button>
              <button className="btn btn-primary" onClick={() => handlePrint(selectedBatch.serial_number)}><Printer size={16} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {selectedComboBatch && (
        <div className="modal-overlay" onClick={() => setSelectedComboBatch(null)}>
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%', background: 'rgba(17, 24, 39, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid #374151', borderRadius: '24px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'white' }}>{selectedComboBatch.comboName}</h2>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedComboBatch.comboBoxBarcode}</div>
                </div>
                <div style={{ padding: '8px 16px', borderRadius: '12px', fontWeight: 800, background: selectedComboBatch.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : selectedComboBatch.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedComboBatch.status === 'READY' ? '#34d399' : selectedComboBatch.status === 'PARTIAL' ? '#f59e0b' : '#60a5fa' }}>
                   {selectedComboBatch.status === 'EMPTY' ? 'SCANNED OUT' : selectedComboBatch.status}
                </div>
             </div>


             <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Created Date</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{selectedComboBatch.createdAt ? new Date(selectedComboBatch.createdAt).toLocaleString() : '-'}</span>
                </div>
                {selectedComboBatch.packedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Packed Date</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{new Date(selectedComboBatch.packedAt).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Generated By</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{selectedComboBatch.generatedBy || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Generated At</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{selectedComboBatch.generatedAt ? new Date(selectedComboBatch.generatedAt).toLocaleString() : '-'}</span>
                </div>
             </div>

             <h3 style={{ fontSize: '16px', color: 'white', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Products Inside</h3>
             
             {(!selectedComboBatch.packedItems || selectedComboBatch.packedItems.length === 0) ? (
               <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px' }}>
                 No products packed inside this box.
               </div>
             ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 {selectedComboBatch.packedItems.map((item: any, idx: number) => {
                    const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
                    return (
                      <div key={idx} style={{ padding: '16px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{item.productName || item.product_name || code}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace', marginBottom: '4px' }}>Product Code: {code}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>Barcode: {item.displayBarcode || item.sourceBarcode || item.barcodeNumber || item.barcode || item.serial_number || item.barcode_no || '-'}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Micro Batch</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{item.batchNo || item.batch_number || item.microBatch || '-'}</span></div>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Produced By</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{item.producedBy || '-'}</span></div>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Added By</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{item.addedBy || item.packedBy || item.comboAddedBy || '-'}</span></div>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Added At</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{(item.addedAt || item.packedAt) ? new Date(item.addedAt || item.packedAt).toLocaleString() : '-'}</span></div>
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', color: '#cbd5e1', fontSize: '12px', fontWeight: 600 }}>
                          Qty: {item.quantity || 1}
                        </div>
                      </div>
                    )
                 })}
               </div>
             )}

             <h3 style={{ fontSize: '16px', color: 'white', marginTop: '24px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Inventory History</h3>
             <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b' }}>
                <div style={{ marginBottom: '16px' }}>
                   <div style={{ color: 'white', fontWeight: 600, marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedComboBatch.comboInventoryInPersonName ? '#10b981' : '#64748b' }}></span>
                     Inventory IN
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Scanned By</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedComboBatch.comboInventoryInPersonName || '-'}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Date & Time</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedComboBatch.comboInventoryInAt ? new Date(selectedComboBatch.comboInventoryInAt).toLocaleString() : '-'}</span>
                   </div>
                </div>
                <div style={{ paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
                   <div style={{ color: 'white', fontWeight: 600, marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedComboBatch.comboInventoryOutPersonName ? '#ef4444' : '#64748b' }}></span>
                     Inventory OUT
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Scanned By</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedComboBatch.comboInventoryOutPersonName || '-'}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Date & Time</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedComboBatch.comboInventoryOutAt ? new Date(selectedComboBatch.comboInventoryOutAt).toLocaleString() : '-'}</span>
                   </div>
                </div>
             </div>
             
             <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => downloadQR(selectedComboBatch.barcode_no)} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={16} /> Label</button>
                <button className="btn btn-primary" onClick={() => handlePrint(selectedComboBatch.barcode_no)} style={{ padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Printer size={16} /> Print</button>
                <button onClick={() => setSelectedComboBatch(null)} style={{ padding: '12px 24px', background: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Close Details</button>
             </div>
          </div>
        </div>
      )}
      </>
      )}

    </motion.div>
  );
};

export default ViewBarcode;
