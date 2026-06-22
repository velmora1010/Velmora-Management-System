import { useState, useEffect, useRef } from 'react';
import { CheckCircle, PackageSearch, Download, Search, Package, RefreshCcw, ArrowLeft, AlertTriangle, ArrowRight } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import Barcode from 'react-barcode';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { useLocation, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import toast from 'react-hot-toast';

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

const getProductBadge = (stage: string, tab: string) => {
  const currentStage = stage || 'READY_FOR_FIRST_SCAN';
  
  if (tab === 'ALL') {
    if (currentStage === 'READY_FOR_FIRST_SCAN') return { text: 'SCAN TO IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: 'rgba(100, 116, 139, 0.2)' };
    if (currentStage === 'PRODUCT_IN') return { text: 'SCANNED IN', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'rgba(16, 185, 129, 0.2)' };
    if (currentStage === 'PRODUCT_OUT') return { text: 'SCANNED OUT', bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' };
    if (currentStage === 'PACKED_IN_COMBO') return { text: 'PACKED', bg: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.2)' };
  } else if (tab === 'IN') {
    if (currentStage === 'PRODUCT_IN') return { text: 'SCAN TO OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
    if (currentStage === 'PRODUCT_OUT') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'rgba(16, 185, 129, 0.2)' };
  } else if (tab === 'OUT') {
    if (currentStage === 'PRODUCT_OUT') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'rgba(16, 185, 129, 0.2)' };
  } else if (tab === 'PACKED') {
    return { text: 'SCAN FOR COMBO', bg: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.2)' };
  }
  
  return { text: currentStage.replace(/_/g, ' '), bg: 'rgba(100, 116, 139, 0.1)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.2)' };
};

interface ProductBarcodeListProps {
  onBack: () => void;
}

export default function ProductBarcodeList({ onBack }: ProductBarcodeListProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [productBarcodes, setProductBarcodes] = useState<any[]>([]);
  const [comboBoxes, setComboBoxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPackInlineMessage, setShowPackInlineMessage] = useState(false);
  
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(((location.state as any)?.filterProductCode) || null);
  
  const [searchTerm, setSearchTerm] = useState<string>(((location.state as any)?.filterBatchNo ? `MB${(location.state as any).filterBatchNo}` : ''));
  const [productSubTab, setProductSubTab] = useState<'ALL' | 'IN' | 'OUT' | 'PACKED'>('ALL');
    const [selectedDraftId, setSelectedDraftId] = useState<string>('');

  const [scanModal, setScanModal] = useState<{ open: boolean, barcode: any | null, type?: 'success' | 'warning' | 'error' | 'details', message?: string }>({ open: false, barcode: null });
  const [confirmScanModal, setConfirmScanModal] = useState<{ open: boolean, barcode: any | null, scanAction: string }>({ open: false, barcode: null, scanAction: '' });
  const [personName, setPersonName] = useState('');
  
  const [deleteModal, setDeleteModal] = useState<{ open: boolean, barcode: any | null }>({ open: false, barcode: null });
  const [selectedBarcodes, setSelectedBarcodes] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [scannerValue, setScannerValue] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);


  const barcodeDownloadRef = useRef<HTMLDivElement>(null);
  const [downloadTarget, setDownloadTarget] = useState<any>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    fetchBarcodes();
  }, []);

  const handleScanRef = useRef<any>(null);
  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  useEffect(() => {
    let buffer = '';
    let timeout: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (scanModal.open) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

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
      clearTimeout(timeout);
    };
  }, [scanModal.open]);

  const fetchBarcodes = async () => {
    setLoading(true);
    try {
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
      
      // Auto-repair storage on load
      const repairedRaw = await inventoryService.getProductBarcodes();
      const repaired = Array.isArray(repairedRaw) ? repairedRaw : [];
      localStorage.setItem("finished_product_barcodes", JSON.stringify(repaired));

      const dataRaw = await inventoryService.getProductBarcodes();
      const data = Array.isArray(dataRaw) ? dataRaw : [];
      
      const boxesRaw = await (inventoryService as any).getComboBoxes();
      const loadedBoxes = Array.isArray(boxesRaw) ? boxesRaw : [];
      setComboBoxes(loadedBoxes);

      const transactions = await inventoryService.getInventoryTransactions();
      
      const mappedData = data.map(b => {
        const bTxs = transactions
          .filter(tx => tx.barcodeNumber === b.barcode_no)
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
        
        return {
          ...b,
          currentLocation: bTxs.length > 0 ? bTxs[0].toLocation : 'PRODUCT',
          transactionHistory: bTxs
        };
      });
      
      setProductBarcodes(mappedData || []);
      
      // const drafts = await inventoryService.getComboDrafts();
      // setComboDrafts(drafts.filter((d: any) => d.status === 'Draft' || d.status === 'Processing'));
      
    } catch (err) {
      console.error('Failed to load product barcodes', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeCode = (value: any) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();

  const handleScan = async (decodedText: string) => {
    if (isProcessingScan) return;
    setIsProcessingScan(true);

    try {
      const scannedCode = normalizeCode(decodedText);

      setScannerValue('');
      scannerInputRef.current?.focus();

      if (!scannedCode) {
        setScanModal({ open: true, barcode: null, type: 'error', message: 'Invalid barcode scan' });
        return;
      }

      let payload: any = undefined;

      if (productSubTab === ('ALL' as any) || productSubTab === 'OUT' || productSubTab === ('PACKED' as any)) {
         if (!selectedDraftId && productSubTab === ('PACKED' as any)) {
            setShowPackInlineMessage(true);
            setIsProcessingScan(false);
            return;
         }
         setShowPackInlineMessage(false);
         payload = { comboBoxBarcode: selectedDraftId };
      }

      let scanAction = 'IN';
      if (productSubTab === 'ALL') scanAction = 'IN';
      else if (productSubTab === 'IN') scanAction = 'OUT';
      else if (productSubTab === 'OUT' || productSubTab === ('PACKED' as any)) scanAction = 'PACK';

      if (scanAction === 'PACK' && !selectedDraftId) {
          setShowPackInlineMessage(true);
          setIsProcessingScan(false);
          return;
      }

      if (scanAction === 'IN' || scanAction === 'OUT') {
        const record = productBarcodes.find(b => [b.displayBarcode, b.barcodeNumber, b.barcode, b.code, b.serial_number, b.barcode_no, b.batchNo, b.id].map(x => normalizeCode(x)).includes(scannedCode));
        if (!record) {
           setScanModal({ open: true, barcode: null, type: 'error', message: 'Product barcode not found in local records.' });
           setIsProcessingScan(false);
           return;
        }
        
        const currentStage = record.currentStage;

        if (currentStage === 'PRODUCT_OUT' || record.currentLocation === 'DISPATCHED' || record.currentLocation === 'COMBO' || record.currentLocation === 'RESERVED_FOR_COMBO') {
           setScanModal({ open: true, barcode: record, type: 'details' });
           setIsProcessingScan(false);
           return;
        } else if (currentStage === 'PRODUCT_IN') {
           setConfirmScanModal({ open: true, barcode: record, scanAction: 'OUT' });
           setIsProcessingScan(false);
           return;
        } else {
           // Default to IN for READY_FOR_FIRST_SCAN, missing, undefined, or null
           setConfirmScanModal({ open: true, barcode: record, scanAction: 'IN' });
           setIsProcessingScan(false);
           return;
        }
      }

      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: scannedCode,
        department: 'PRODUCT',
        scanAction: scanAction as any,
        payload
      });
      
      setScanModal({ open: true, barcode: result.item, type: 'success', message: result.message });
      fetchBarcodes();
      
    } catch (err: any) {
      console.error(err);
      setScanModal({ open: true, barcode: null, type: 'error', message: err.message || 'Scan error occurred' });
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleConfirmScan = async () => {
    if (!personName.trim()) {
      toast.error('Scanning Person Name is required.');
      return;
    }
    const { barcode, scanAction } = confirmScanModal;
    if (!barcode) return;
    
    setIsProcessingScan(true);
    try {
      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: barcode.barcodeNumber || barcode.displayBarcode || barcode.barcode_no,
        department: 'PRODUCT',
        scanAction: scanAction as any,
        payload: { personName: personName.trim() }
      });
      
      setConfirmScanModal({ open: false, barcode: null, scanAction: '' });
      setPersonName('');
      setScanModal({ open: true, barcode: result.item, type: 'success', message: result.message });
      fetchBarcodes();
      
      setScannerValue('');
      scannerInputRef.current?.focus();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Scan error occurred');
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleDownloadBarcode = async (barcodeData: any) => {
    setDownloadTarget(barcodeData);
    setTimeout(async () => {
      if (!barcodeDownloadRef.current || !barcodeData) return;
      try {
        const canvas = await html2canvas(barcodeDownloadRef.current, { backgroundColor: '#ffffff', scale: 2 });
        const link = document.createElement('a');
        link.download = `${barcodeData.barcode_no}.png`;
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
          const fileName = `${barcodeData.barcode_no}.png`;
          const subFolderName = (barcodeData.product_name || barcodeData.product_code || 'Unknown').replace(/\s+/g, '_');
          
          productFolder.folder(subFolderName)?.file(fileName, imgData, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `All_${selectedProductCode}_Barcodes.zip`;
      link.click();
    } catch (err) {
      console.error('Failed to download all barcodes', err);
      toast.success('Failed to zip and download barcodes.');
    } finally {
      setIsDownloadingAll(false);
      setDownloadTarget(null);
    }
  };

  const getBarcodeId = (b: any) => (b.displayBarcode || b.barcodeNumber || b.barcode || b.code || b.serial_number || b.barcode_no || b.batchNo || b.id || "").toString().trim().toUpperCase().replace(/\s+/g, "");

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBarcodes(filteredBarcodes.map((b: any) => getBarcodeId(b)));
    } else {
      setSelectedBarcodes([]);
    }
  };

  const handleSelectOne = (barcodeId: string) => {
    setSelectedBarcodes(prev => prev.includes(barcodeId) ? prev.filter(id => id !== barcodeId) : [...prev, barcodeId]);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.barcode) return;
    try {
      const barcodeId = getBarcodeId(deleteModal.barcode);
      if ((inventoryService as any).deleteProductBarcodes) {
        await (inventoryService as any).deleteProductBarcodes([barcodeId]);
      } else {
        await inventoryService.deleteProductBarcode(barcodeId);
      }
      toast.success('Barcode deleted successfully');
      setDeleteModal({ open: false, barcode: null });
      fetchBarcodes();
    } catch (error) {
      console.error('Failed to delete barcode', error);
      toast.error('Failed to delete barcode');
    }
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      if ((inventoryService as any).deleteProductBarcodes) {
        await (inventoryService as any).deleteProductBarcodes(selectedBarcodes);
      } else {
        for (const id of selectedBarcodes) {
          await inventoryService.deleteProductBarcode(id);
        }
      }
      setSelectedBarcodes([]);
      setIsBulkDeleteModalOpen(false);
      toast.success('Selected barcodes deleted successfully');
      fetchBarcodes();
    } catch (error) {
      console.error('Failed to bulk delete barcodes', error);
      toast.error('Failed to delete selected barcodes');
    }
  };

  const getProductStats = (code: string) => {
    const normalizeProductCode = (item: any) => {
      const name = String(item.productName || item.product_name || "").toLowerCase();
      const pCode = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
      if (pCode && ["1B", "1Y", "1P", "1S"].includes(pCode)) return pCode;
      if (name.includes("liquid a") || name.includes("blue") || name.includes("1b")) return "1B";
      if (name.includes("liquid y") || name.includes("yellow") || name.includes("1y")) return "1Y";
      if (name.includes("fabric") || name.includes("pink") || name.includes("1p")) return "1P";
      if (name.includes("sponge") || name.includes("1s")) return "1S";
      return "";
    };

    const codes = productBarcodes.filter(b => normalizeProductCode(b) === code);
    return {
      total: codes.length,
      ready: codes.filter(b => b.currentStage === 'READY_FOR_FIRST_SCAN').length,
      scanned: codes.filter(b => b.currentStage !== 'READY_FOR_FIRST_SCAN').length,
      pending: codes.filter(b => b.currentStage === 'READY_FOR_FIRST_SCAN').length,
    };
  };

  const filteredBarcodes = productSubTab === ('PACKED' as any) 
    ? productBarcodes.filter((b: any) => {
        if (b.currentStage !== 'PRODUCT_OUT' && b.status !== 'PRODUCT_OUT') return false;
        if (b.packedComboBoxBarcode) return false;

        const normalizeProductCode = (item: any) => {
          const name = String(item.productName || item.product_name || "").toLowerCase();
          const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
          if (code) return code;
          if (name.includes("liquid a") || name.includes("blue") || name.includes("1b")) return "1B";
          if (name.includes("liquid y") || name.includes("yellow") || name.includes("1y")) return "1Y";
          if (name.includes("fabric") || name.includes("pink") || name.includes("1p")) return "1P";
          if (name.includes("sponge") || name.includes("1s")) return "1S";
          return "";
        };

        const pCode = normalizeProductCode(b);
        if (selectedProductCode && pCode !== selectedProductCode) return false;
        
        const activeBox = comboBoxes.find((d: any) => d.comboBoxBarcode === selectedDraftId);
        if (activeBox && activeBox.requiredItems) {
           const requiredMatch = activeBox.requiredItems.find((req: any) => req.productCode === pCode);
           if (!requiredMatch) return false;
        }

        const matchesSearch = !searchTerm || 
          [b.sourceBarcode, b.barcodeNumber, b.barcode, b.productName, pCode]
            .some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));
            
        return matchesSearch;
      }).map((b: any) => ({
         ...b,
         barcode_no: b.sourceBarcode || b.barcodeNumber || b.barcode || b.code || b.id,
         product_code: (b.productCode || b.product_code || (b.productName?.toLowerCase().includes("liquid a") ? "1B" : "")),
         product_name: b.productName || b.materialName,
         currentStage: 'PRODUCT_OUT'
      }))
    : productBarcodes.filter(b => {
    if (selectedProductCode && b.productCode !== selectedProductCode && b.product_code !== selectedProductCode) return false;
    
    const matchesSearch = !searchTerm || 
      [b.barcode_no, b.product_name, b.product_code, b.batch_no, b.mb_no]
        .some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesStatus = true;
    const stage = b.currentStage || 'READY_FOR_FIRST_SCAN';
    if (productSubTab === 'IN') matchesStatus = stage === 'PRODUCT_IN';
    if (productSubTab === 'OUT') matchesStatus = stage === 'PRODUCT_OUT';
    if (productSubTab === ('PACKED' as any)) matchesStatus = stage === 'PACKED_IN_COMBO';

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading product barcodes...</div>;
  }

  if (!selectedProductCode) {
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
                whileHover={{ y: -4, boxShadow: `0 10px 25px ${prod.theme.border}` }}
                onClick={() => setSelectedProductCode(prod.code)}
                style={{ 
                  background: '#1e293b', 
                  border: `1px solid ${prod.theme.border}`, 
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

  const selectedTheme = getProductTheme(selectedProductCode);
  const selectedName = getProductFullName(selectedProductCode);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <button 
        onClick={() => {
          setSelectedProductCode(null);
          setSearchTerm('');
          setProductSubTab('ALL');
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

      <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: '24px', borderRadius: '24px', border: `1px solid ${selectedTheme.border}`, marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: selectedTheme.bg, padding: '8px', borderRadius: '12px' }}>
            <Search size={24} color={selectedTheme.color} />
          </div>
          <span style={{ fontWeight: 700, color: 'white', fontSize: '18px' }}>Scan Product Barcode</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            autoFocus
            ref={scannerInputRef} type="text" placeholder="Scan or enter product bottle barcode"
            value={scannerValue} onChange={(e) => setScannerValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(e.currentTarget.value); }}
            style={{ flex: 1, height: '56px', padding: '0 20px', borderRadius: '14px', border: '2px solid #334155', background: '#0f172a', color: 'white', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={(e) => e.target.style.borderColor = selectedTheme.color}
            onBlur={(e) => e.target.style.borderColor = '#334155'}
          />
          <button 
            onClick={() => handleScan(scannerValue)}
            style={{ height: '56px', padding: '0 32px', borderRadius: '14px', background: selectedTheme.color, color: 'white', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: `0 4px 15px ${selectedTheme.border}` }}
          >
            Trigger Scan
          </button>
        </div>
      </div>
      
      {showPackInlineMessage && productSubTab === ('PACKED' as any) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <AlertTriangle size={20} />
             <span style={{ fontWeight: 600 }}>Select combo box or open Add Product page first.</span>
          </div>
          <button 
            onClick={() => navigate('/inventory/combos')} 
            style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            Open Pack Combo Box
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', background: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" placeholder="Search barcode or batch..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', height: '44px', padding: '0 16px 0 44px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '14px', outline: 'none' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '8px', borderRadius: '16px', border: '1px solid rgba(51, 65, 85, 0.8)', overflowX: 'auto', gridColumn: '1 / -1', width: '100%' }}>
          <button onClick={() => { setProductSubTab('ALL'); setSelectedBarcodes([]); }} style={{ padding: '10px 24px', borderRadius: '10px', background: productSubTab === 'ALL' ? selectedTheme.color : 'transparent', color: productSubTab === 'ALL' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>All Products</button>
          <button onClick={() => { setProductSubTab('IN'); setSelectedBarcodes([]); }} style={{ padding: '10px 24px', borderRadius: '10px', background: productSubTab === 'IN' ? selectedTheme.color : 'transparent', color: productSubTab === 'IN' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Inventory IN</button>
          <button onClick={() => { setProductSubTab('OUT'); setSelectedBarcodes([]); }} style={{ padding: '10px 24px', borderRadius: '10px', background: productSubTab === 'OUT' ? selectedTheme.color : 'transparent', color: productSubTab === 'OUT' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Inventory OUT</button>
          <button onClick={() => { setProductSubTab('PACKED'); setSelectedBarcodes([]); }} style={{ padding: '10px 24px', borderRadius: '10px', background: productSubTab === ('PACKED' as any) ? selectedTheme.color : 'transparent', color: productSubTab === ('PACKED' as any) ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Combo Packing</button>
        </div>
        
        {productSubTab === ('PACKED' as any) && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)', width: '100%', display: 'flex', alignItems: 'center', gap: '16px' }}>
               <span style={{ color: '#c084fc', fontWeight: 700 }}>Select Combo to Pack:</span>
               <select 
                 value={selectedDraftId} onChange={e => setSelectedDraftId(e.target.value)}
                 style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.5)', background: '#1e293b', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer', flex: 1 }}
               >
                 <option value="">-- Select Combo Box --</option>
                 {comboBoxes.filter((b: any) => b.status === 'EMPTY' || b.status === 'PARTIAL').map((box: any) => {
                   const req = box.requiredItems ? box.requiredItems.reduce((a: any, b: any) => a + b.requiredQty, 0) : 0;
                   return (
                     <option key={box.comboBoxBarcode} value={box.comboBoxBarcode}>
                       {box.comboBoxBarcode} - {box.comboName} - {box.packedItems?.length || 0}/{req}
                     </option>
                   );
                 })}
               </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={filteredBarcodes.length > 0 && selectedBarcodes.length === filteredBarcodes.length}
              onChange={handleSelectAll}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600 }}>Select All</span>
          </label>
          
          {selectedBarcodes.length > 0 && (
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              style={{ height: '40px', padding: '0 16px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Delete Selected ({selectedBarcodes.length})
            </button>
          )}
        </div>
        
        <button 
          onClick={handleDownloadAll}
          disabled={isDownloadingAll || filteredBarcodes.length === 0}
          style={{ height: '44px', padding: '0 20px', borderRadius: '10px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: filteredBarcodes.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', opacity: filteredBarcodes.length > 0 ? 1 : 0.5 }}
        >
          {isDownloadingAll ? <RefreshCcw size={16} className="animate-spin" /> : <Download size={16} />} 
          {isDownloadingAll ? 'Zipping...' : 'Download All'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {filteredBarcodes.map((item: any) => {
          const displayBarcode = (item.displayBarcode || item.barcodeNumber || item.barcode || item.code || item.serial_number || item.barcode_no || item.batchNo || item.id || "").toString().trim().toUpperCase().replace(/\s+/g, "");
          return (
            <motion.div 
              key={item.barcode_no}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ background: '#1e293b', border: `1px solid ${selectedTheme.border}`, borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ background: 'white', padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', position: 'relative' }}>
                <Barcode value={displayBarcode} width={1.8} height={60} fontSize={14} margin={0} displayValue={false} />
              </div>
              
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>{selectedName}</h3>
                    <p style={{ color: selectedTheme.color, fontSize: '14px', fontFamily: 'monospace', margin: 0 }}>{displayBarcode}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: getProductBadge(item.currentStage, productSubTab).bg, color: getProductBadge(item.currentStage, productSubTab).color, padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', border: `1px solid ${getProductBadge(item.currentStage, productSubTab).border}` }}>
                      {getProductBadge(item.currentStage, productSubTab).text}
                    </div>
                    <input 
                      type="checkbox"
                      checked={selectedBarcodes.includes(displayBarcode)}
                      onChange={() => handleSelectOne(displayBarcode)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                    />
                  </div>
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
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                  </div>
                  {item.inventoryInPersonName && (
                    <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed #1e293b' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Scanned By</span>
                      <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>
                        {item.inventoryOutPersonName ? `${item.inventoryOutPersonName} (OUT)` : `${item.inventoryInPersonName} (IN)`}
                      </span>
                    </div>
                  )}
                </div>                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => setScanModal({ open: true, barcode: item, type: 'details' })}
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
                    onClick={() => { navigator.clipboard.writeText(item.barcode_no); toast.success('Copied!'); }}
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

      <AnimatePresence>
        {scanModal.open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setScanModal({ open: false, barcode: null })} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#1e293b', borderRadius: '24px', width: '100%', maxWidth: '500px', position: 'relative', zIndex: 1001, border: `1px solid ${scanModal.type === 'error' ? '#ef4444' : scanModal.type === 'warning' ? '#eab308' : '#10b981'}`, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(145deg, ${scanModal.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : scanModal.type === 'warning' ? 'rgba(234, 179, 8, 0.1)' : scanModal.type === 'details' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)'}, transparent)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: scanModal.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : scanModal.type === 'warning' ? 'rgba(234, 179, 8, 0.1)' : scanModal.type === 'details' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: scanModal.type === 'error' ? '#ef4444' : scanModal.type === 'warning' ? '#eab308' : scanModal.type === 'details' ? '#3b82f6' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {scanModal.type === 'error' ? <AlertTriangle size={24} /> : scanModal.type === 'warning' ? <AlertTriangle size={24} /> : scanModal.type === 'details' ? <PackageSearch size={24} /> : <CheckCircle size={24} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 800 }}>
                      {scanModal.type === 'error' ? 'Error' : scanModal.type === 'warning' ? 'Already Scanned' : scanModal.type === 'details' ? 'Product Details' : 'Product Barcode Scanned'}
                    </h3>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
                      {scanModal.type === 'error' ? 'Invalid Barcode' : scanModal.type === 'warning' ? 'Duplicate Scan' : scanModal.type === 'details' ? 'Barcode Information' : 'Scan processed successfully'}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {scanModal.message && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', color: scanModal.type === 'error' ? '#fca5a5' : '#fef08a' }}>
                    {scanModal.message}
                  </div>
                )}
                {scanModal.barcode && (
                  <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Product Name</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{getProductFullName(scanModal.barcode.productCode || scanModal.barcode.product_code)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Product Code</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{scanModal.barcode.product_code}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Barcode</span>
                    <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{scanModal.barcode.barcode_no || scanModal.barcode.displayBarcode || scanModal.barcode.barcodeNumber}</span>
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
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Current Location</span>
                    <span style={{ color: scanModal.barcode.currentLocation === 'PRODUCT' ? '#60a5fa' : scanModal.barcode.currentLocation === 'RESERVED_FOR_COMBO' ? '#c084fc' : scanModal.barcode.currentLocation === 'COMBO' ? '#10b981' : scanModal.barcode.currentLocation === 'ORDER_RESERVED' ? '#facc15' : '#94a3b8', fontWeight: 800, fontSize: '14px' }}>
                      {scanModal.barcode.currentLocation}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Created Date</span>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{new Date(scanModal.barcode.created_at || scanModal.barcode.createdAt || new Date()).toLocaleDateString()}</span>
                  </div>
                  {scanModal.barcode.producedBy && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Produced By</span>
                      <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{scanModal.barcode.producedBy}</span>
                    </div>
                  )}
                  {(scanModal.barcode.inventoryInPersonName || scanModal.barcode.inventoryInAt) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #334155' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Scanned IN By/At</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', display: 'block' }}>{scanModal.barcode.inventoryInPersonName || '--'}</span>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{scanModal.barcode.inventoryInAt ? new Date(scanModal.barcode.inventoryInAt).toLocaleString() : '--'}</span>
                      </div>
                    </div>
                  )}
                  {(scanModal.barcode.inventoryOutPersonName || scanModal.barcode.inventoryOutAt) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #334155' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Scanned OUT By/At</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', display: 'block' }}>{scanModal.barcode.inventoryOutPersonName || '--'}</span>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{scanModal.barcode.inventoryOutAt ? new Date(scanModal.barcode.inventoryOutAt).toLocaleString() : '--'}</span>
                      </div>
                    </div>
                  )}
                  {scanModal.barcode.transactionHistory && scanModal.barcode.transactionHistory.length > 0 && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
                      <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Movement History</span>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {scanModal.barcode.transactionHistory.map((tx: any) => (
                          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '6px 8px', borderRadius: '6px' }}>
                            <span style={{ color: 'white' }}>{tx.fromLocation} → {tx.toLocation}</span>
                            <span style={{ color: '#94a3b8' }}>{new Date(tx.createdAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
              <div style={{ padding: '24px', borderTop: '1px solid #334155', display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => handleDownloadBarcode(scanModal.barcode)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                >
                  Download Barcode
                </button>
                <button 
                  onClick={() => { navigator.clipboard.writeText(scanModal.barcode.barcode_no); toast.success('Copied!'); }}
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

        {confirmScanModal.open && confirmScanModal.barcode && (
          <div className="modal-overlay" onClick={() => setConfirmScanModal({ open: false, barcode: null, scanAction: '' })}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ width: '400px', background: '#111827', border: '1px solid #263244', borderRadius: '24px' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <PackageSearch size={24} color="#3b82f6" />
                  {confirmScanModal.scanAction === 'IN' ? 'Confirm Product Inventory IN' : 'Confirm Product Inventory OUT'}
                </h2>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Product Name</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{confirmScanModal.barcode.productName || confirmScanModal.barcode.product_name || confirmScanModal.barcode.productCode}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Product Code</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{confirmScanModal.barcode.productCode || confirmScanModal.barcode.product_code}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Barcode Number</span>
                    <span style={{ fontSize: '14px', color: 'white', fontFamily: 'monospace', fontWeight: 600 }}>{confirmScanModal.barcode.barcode_no || confirmScanModal.barcode.barcodeNumber || confirmScanModal.barcode.displayBarcode}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Batch No</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{confirmScanModal.barcode.batchNo || confirmScanModal.barcode.batch_no || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Micro Batch</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>MB{confirmScanModal.barcode.microBatchNo || confirmScanModal.barcode.mb_no || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Quantity</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{confirmScanModal.barcode.quantity || 1} Unit</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Produced By</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: 600 }}>{confirmScanModal.barcode.producedBy || 'N/A'}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Current Stage</span>
                    <span style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 600 }}>
                      {(!confirmScanModal.barcode.currentStage || confirmScanModal.barcode.currentStage === 'READY_FOR_FIRST_SCAN') ? 'READY TO SCAN IN' : confirmScanModal.barcode.currentStage === 'PRODUCT_IN' ? 'SCANNED IN' : confirmScanModal.barcode.currentStage === 'PRODUCT_OUT' ? 'SCANNED OUT' : confirmScanModal.barcode.currentStage.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Scanning Person Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input 
                    type="text" 
                    value={personName} 
                    onChange={e => setPersonName(e.target.value)} 
                    placeholder="Enter your name" 
                    autoFocus
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '14px', outline: 'none' }} 
                  />
                </div>
              </div>

              <div style={{ padding: '20px 24px', borderTop: '1px solid #1e293b', display: 'flex', gap: '12px', justifyContent: 'flex-end', background: '#0b1120', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
                <button 
                  onClick={() => setConfirmScanModal({ open: false, barcode: null, scanAction: '' })} 
                  style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmScan}
                  disabled={!personName.trim()}
                  style={{ padding: '10px 24px', borderRadius: '10px', background: personName.trim() ? '#3b82f6' : '#1e293b', color: personName.trim() ? 'white' : '#64748b', border: 'none', fontWeight: 600, cursor: personName.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  Confirm <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <ConfirmModal
          isOpen={deleteModal.open}
          title="Delete Product Barcode?"
          message="This action permanently removes this barcode label."
          confirmText="Delete"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModal({ open: false, barcode: null })}
        />

        <ConfirmModal
          isOpen={isBulkDeleteModalOpen}
          title="Delete Selected Barcodes?"
          message={`This action permanently removes ${selectedBarcodes.length} selected barcode(s).`}
          confirmText="Delete"
          onConfirm={handleBulkDeleteConfirm}
          onClose={() => setIsBulkDeleteModalOpen(false)}
        />
      </AnimatePresence>
    </div>
  );
}
