import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Barcode as BarcodeIcon, Printer, Download, Eye, Copy, Trash2, CheckCircle2, Clock, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import html2canvas from 'html2canvas';
import { inventoryService } from '../../../services/inventoryService';
import { barcodeService } from '../../../services/barcodeService';

interface PackagingBarcodeListProps {
  onBack: () => void;
}

const getBadgeInfo = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'Incoming' || stage === 'READY_FOR_FIRST_SCAN' || !stage) {
      return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    }
    if (stage === 'PACKAGING_IN' || stage === 'RAW_MATERIAL_IN') {
      return { text: 'SCANNED IN', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    }
    if (stage === 'PACKAGING_OUT' || stage === 'RAW_MATERIAL_OUT') {
      return { text: 'SCANNED OUT', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
    }
  } else if (tab === 'IN') {
    if (stage === 'PACKAGING_IN' || stage === 'RAW_MATERIAL_IN') {
      return { text: 'SCAN TO OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    }
    if (stage === 'PACKAGING_OUT' || stage === 'RAW_MATERIAL_OUT') {
      return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    }
  } else if (tab === 'OUT') {
    if (stage === 'PACKAGING_OUT' || stage === 'RAW_MATERIAL_OUT') {
      return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    }
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

export const PackagingBarcodeList = ({ onBack }: PackagingBarcodeListProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Main Tabs & Filters
  const [subTab, setSubTab] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('All');

  // Modals & Selections
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [scannerValue, setScannerValue] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanPersonName, setScanPersonName] = useState('');

  const [pendingScan, setPendingScan] = useState<{ code: string; action: 'IN' | 'OUT'; record: any } | null>(null);
  const [deleteModal, setDeleteModal] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hidden label print/download target
  const barcodeDownloadRef = useRef<HTMLDivElement>(null);
  const [downloadTarget, setDownloadTarget] = useState<any>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const fetchPackagingBarcodes = async () => {
    setLoading(true);
    try {
      const data = await (inventoryService as any).getPackagingBarcodes();
      setItems(data || []);
    } catch (err) {
      console.error('Failed to load packaging barcodes', err);
      toast.error('Failed to load packaging barcodes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackagingBarcodes().then(() => {
      setTimeout(() => scannerInputRef.current?.focus(), 150);
    });
  }, []);

  // Lock scroll when detail modal open
  useEffect(() => {
    if (selectedItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedItem]);

  // Normalize barcode lookup
  const normalizeCode = (val: any) => String(val || '').trim().toLowerCase();

  const handleScan = (codeToScan: string) => {
    const cleanCode = normalizeCode(codeToScan);
    if (!cleanCode) return;
    setIsProcessingScan(true);

    const record = items.find((item) => {
      const barcodeStr = normalizeCode(item.barcode || item.serial_number);
      const scanCodeStr = normalizeCode(item.scan_code || item.scanCode);
      return barcodeStr === cleanCode || scanCodeStr === cleanCode;
    });

    if (!record) {
      toast.error(`Packaging barcode "${codeToScan}" not found.`);
      setScannerValue('');
      setIsProcessingScan(false);
      return;
    }

    const currentStage = record.current_stage || record.currentStage || 'Incoming';

    if (currentStage === 'PACKAGING_OUT' || currentStage === 'DISPATCHED') {
      setSelectedItem(record);
      toast.success('Barcode already scanned OUT.');
      setScannerValue('');
      setIsProcessingScan(false);
      return;
    }

    if (currentStage === 'PACKAGING_IN') {
      setPendingScan({ code: cleanCode, action: 'OUT', record });
    } else {
      setPendingScan({ code: cleanCode, action: 'IN', record });
    }
    setIsProcessingScan(false);
  };

  const handleConfirmScan = async () => {
    if (!pendingScan || !scanPersonName.trim()) return;
    setIsProcessingScan(true);

    try {
      const { action, record } = pendingScan;
      const nowIso = new Date().toISOString();
      const updates: any = {};

      if (action === 'IN') {
        updates.current_stage = 'PACKAGING_IN';
        updates.inventory_in_person = scanPersonName.trim();
        updates.inventory_in_at = nowIso;
      } else {
        updates.current_stage = 'PACKAGING_OUT';
        updates.inventory_out_person = scanPersonName.trim();
        updates.inventory_out_at = nowIso;
      }

      await (inventoryService as any).updatePackagingBarcode(record.id || record.barcode, updates);
      toast.success(`Packaging Barcode scanned ${action} successfully!`);

      setPendingScan(null);
      setScanPersonName('');
      setScannerValue('');
      await fetchPackagingBarcodes();
    } catch (err: any) {
      console.error('Scan error:', err);
      toast.error(`Scan processing failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      await (inventoryService as any).deletePackagingBarcode(deleteModal.id || deleteModal.barcode);
      toast.success('Packaging barcode deleted');
      setDeleteModal(null);
      await fetchPackagingBarcodes();
    } catch (err: any) {
      toast.error('Failed to delete barcode: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadLabel = async (item: any) => {
    const scanCode = item.scan_code || item.scanCode || barcodeService.deriveScanCode(item.barcode || item.serial_number, 'PACKAGING') || item.barcode || item.serial_number;
    setDownloadTarget({ ...item, scanCode });

    setTimeout(async () => {
      if (!barcodeDownloadRef.current) return;
      try {
        const canvas = await html2canvas(barcodeDownloadRef.current, {
          backgroundColor: '#ffffff',
          scale: 4, // 4x resolution for 300+ DPI crisp black/white rendering
          useCORS: true,
          logging: false
        });
        const link = document.createElement('a');
        link.download = `${scanCode}_Label.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      } catch (err) {
        console.error('Failed to download barcode label', err);
        toast.error('Failed to download label');
      } finally {
        setDownloadTarget(null);
      }
    }, 100);
  };

  const handlePrintLabel = (item: any) => {
    const scanCode = item.scan_code || item.scanCode || barcodeService.deriveScanCode(item.barcode || item.serial_number, 'PACKAGING') || item.barcode || item.serial_number;
    setDownloadTarget({ ...item, scanCode });

    setTimeout(() => {
      const svgEl = barcodeDownloadRef.current?.querySelector('svg');
      const svgMarkup = svgEl ? svgEl.outerHTML : undefined;

      barcodeService.printLabel({
        barcode: item.barcode || item.serial_number,
        scanCode: scanCode,
        moduleType: 'PACKAGING',
        svgMarkup: svgMarkup
      });

      setDownloadTarget(null);
    }, 50);
  };

  // Metrics Calculation
  const todayStr = new Date().toISOString().split('T')[0];
  const scannedTodayCount = items.filter(item => {
    const inDate = item.inventory_in_at ? item.inventory_in_at.split('T')[0] : '';
    const outDate = item.inventory_out_at ? item.inventory_out_at.split('T')[0] : '';
    return inDate === todayStr || outDate === todayStr;
  }).length;

  const pendingScanCount = items.filter(item => {
    const stage = item.current_stage || item.currentStage || 'Incoming';
    return stage === 'Incoming' || stage === 'READY_FOR_FIRST_SCAN';
  }).length;

  const getCategoryRecordCount = (cat: string) => {
    const target = cat.toLowerCase();
    if (target === 'all') return items.length;
    return items.filter((i: any) => {
      const c = (i.packaging_category || i.category || '').toLowerCase();
      if (target === 'inventory packaging') return c === 'inventory packaging' || c === 'inventory';
      return c === target;
    }).length;
  };

  // Filtered List calculation
  const filteredItems = items.filter((item: any) => {
    const name = (item.packaging_name || item.material_name || '').toLowerCase();
    const category = (item.packaging_category || item.category || '').toLowerCase();
    const barcode = (item.barcode || item.serial_number || '').toLowerCase();
    const scanCode = (item.scan_code || item.scanCode || '').toLowerCase();
    const vendor = (item.vendor || item.vendor_name || '').toLowerCase();
    const poRef = (item.po_reference || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = name.includes(search) || barcode.includes(search) || scanCode.includes(search) || vendor.includes(search) || poRef.includes(search);

    let matchesSubTab = true;
    const stage = item.current_stage || item.currentStage || 'Incoming';
    if (subTab === 'IN') matchesSubTab = ['PACKAGING_IN', 'PACKAGING_OUT'].includes(stage);
    if (subTab === 'OUT') matchesSubTab = stage === 'PACKAGING_OUT';

    let matchesFilter = true;
    if (materialFilter !== 'All') {
      const targetFilter = materialFilter.toLowerCase();
      if (['primary packaging', 'secondary packaging', 'tertiary packaging', 'inventory packaging'].includes(targetFilter)) {
        if (targetFilter === 'inventory packaging') {
          matchesFilter = category === 'inventory packaging' || category === 'inventory';
        } else {
          matchesFilter = category === targetFilter;
        }
      } else if (targetFilter === 'bottle') {
        matchesFilter = name.includes('bottle');
      } else if (targetFilter === 'cap') {
        matchesFilter = name.includes('cap');
      } else if (targetFilter === 'brand stickers') {
        matchesFilter = name.includes('sticker') && !name.includes('barcode sticker');
      } else if (targetFilter === 'wad seal') {
        matchesFilter = name.includes('wad');
      } else if (targetFilter === 'shrink wrap') {
        matchesFilter = name.includes('shrink');
      } else if (targetFilter === 'bubble wrap') {
        matchesFilter = name.includes('bubble');
      } else if (targetFilter === 'carton boxes') {
        matchesFilter = name.includes('carton') || name.includes('box');
      } else if (targetFilter === 'transparent tape') {
        matchesFilter = name.includes('transparent tape') || name.includes('tape');
      } else if (targetFilter === 'address rolls') {
        matchesFilter = name.includes('address');
      } else if (targetFilter === 'barcode roll' || targetFilter === 'barcode sticker') {
        matchesFilter = name.includes('barcode roll') || name.includes('barcode sticker') || name.includes('barcode');
      } else if (targetFilter === 'ink roll') {
        matchesFilter = name.includes('ink');
      } else {
        matchesFilter = name === targetFilter || category === targetFilter;
      }
    }

    return matchesSearch && matchesSubTab && matchesFilter;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBack}
          className="btn hover-lift"
          style={{ padding: '10px 16px', borderRadius: '12px', background: '#1e293b', color: 'white', border: '1px solid #263244', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} /> Back to View Barcode
        </button>
        <h1 style={{ fontSize: '28px', margin: 0, color: 'white', fontWeight: 700 }}>Packaging Material Barcodes</h1>
      </div>

      {/* UNIVERSAL PACKAGING SCANNER BOX */}
      <div style={{ background: 'rgba(17, 24, 39, 0.8)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarcodeIcon size={20} style={{ color: '#3b82f6' }} />
          <span style={{ fontWeight: 700, color: 'white', fontSize: '16px' }}>Scan Packaging Material Barcode</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            ref={scannerInputRef}
            type="text"
            placeholder="Scan or enter packaging material barcode number"
            value={scannerValue}
            onChange={(e) => setScannerValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(e.currentTarget.value); }}
            style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#070b12', color: 'white', fontSize: '15px', outline: 'none' }}
          />
          <button
            onClick={() => handleScan(scannerValue)}
            disabled={isProcessingScan}
            style={{ height: '48px', fontWeight: 700, padding: '0 24px', borderRadius: '10px', background: 'linear-gradient(to right, #2563eb, #3b82f6)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Trigger Scan
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS (3 CARDS) */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '12px', flex: 1 }}>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={12}/> Scanned Today
          </span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: '1' }}>{scannedTodayCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '12px', flex: 1 }}>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={12}/> Pending Scan
          </span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: '1' }}>{pendingScanCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '12px', flex: 1 }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarcodeIcon size={12}/> Total Barcodes
          </span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: 'white', lineHeight: '1' }}>{items.length}</span>
        </div>
      </div>

      {/* MAIN TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(17, 24, 39, 0.6)', padding: '8px', borderRadius: '16px', border: '1px solid rgba(38, 50, 68, 0.8)', overflowX: 'auto' }}>
        <button
          onClick={() => setSubTab('ALL')}
          style={{ padding: '10px 24px', borderRadius: '10px', background: subTab === 'ALL' ? '#3b82f6' : 'transparent', color: subTab === 'ALL' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          All Packaging Materials
        </button>
        <button
          onClick={() => setSubTab('IN')}
          style={{ padding: '10px 24px', borderRadius: '10px', background: subTab === 'IN' ? '#3b82f6' : 'transparent', color: subTab === 'IN' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Inventory IN Barcodes
        </button>
        <button
          onClick={() => setSubTab('OUT')}
          style={{ padding: '10px 24px', borderRadius: '10px', background: subTab === 'OUT' ? '#3b82f6' : 'transparent', color: subTab === 'OUT' ? 'white' : '#94a3b8', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Inventory OUT Barcodes
        </button>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search packaging material, vendor, barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '44px', paddingRight: '16px', height: '44px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', outline: 'none' }}
          />
        </div>
        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          style={{ height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', outline: 'none' }}
        >
          <option value="All">All Packaging Materials ({items.length})</option>
          <option value="Primary Packaging">Primary Packaging ({getCategoryRecordCount('Primary Packaging')})</option>
          <option value="Secondary Packaging">Secondary Packaging ({getCategoryRecordCount('Secondary Packaging')})</option>
          <option value="Tertiary Packaging">Tertiary Packaging ({getCategoryRecordCount('Tertiary Packaging')})</option>
          <option value="Inventory Packaging">Inventory Packaging ({getCategoryRecordCount('Inventory Packaging')})</option>
          <option value="Bottle">Bottle</option>
          <option value="Cap">Cap</option>
          <option value="Brand Stickers">Brand Stickers</option>
          <option value="WAD Seal">WAD Seal</option>
          <option value="Shrink Wrap">Shrink Wrap</option>
          <option value="Bubble Wrap">Bubble Wrap</option>
          <option value="Carton Boxes">Carton Boxes</option>
          <option value="Transparent Tape">Transparent Tape</option>
          <option value="Address Rolls">Address Rolls</option>
          <option value="Barcode Roll">Barcode Roll</option>
          <option value="Ink Roll">Ink Roll</option>
        </select>
      </div>

      {/* PACKAGING BARCODES GRID */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading packaging barcodes...</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #263244', borderRadius: '16px' }}>
          No packaging barcodes found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredItems.map((b: any) => {
            const stage = b.current_stage || b.currentStage || 'Incoming';
            const badgeInfo = getBadgeInfo(stage, subTab);
            const displayBarcode = (b.barcode || b.serial_number || b.barcodeNumber || b.id || "").toString().trim().toUpperCase().replace(/\s+/g, "");

            return (
              <div key={b.id || displayBarcode} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: `1px solid ${badgeInfo.color}40`, overflow: 'hidden' }}>
                {/* White Barcode Preview Container with Status Pill */}
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div id={`view-barcode-${displayBarcode}`}>
                    <Barcode value={displayBarcode} width={1.5} height={50} displayValue={false} margin={0} />
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: badgeInfo.bg, color: badgeInfo.color, width: '100%' }}>
                    {badgeInfo.text}
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'white', fontWeight: 700 }}>
                      {b.packaging_name || b.material_name}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {displayBarcode}
                    </div>
                  </div>

                  {/* Dark Information Panel */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#070b12', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Quantity</span>
                      <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>
                        {b.quantity !== undefined && b.quantity !== null ? b.quantity : 0} {String(b.unit || 'PCS').toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Vendor</span>
                      <span style={{ fontSize: '13px', color: 'white', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.vendor || b.vendor_name || '-'}
                      </span>
                    </div>
                    {b.inventory_in_person && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>Scanned IN By</span>
                        <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700 }}>
                          {b.inventory_in_person}
                        </span>
                      </div>
                    )}
                    {b.inventory_out_person && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>Scanned OUT By</span>
                        <span style={{ fontSize: '13px', color: '#f43f5e', fontWeight: 700 }}>
                          {b.inventory_out_person}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons Grid */}
                <div style={{ padding: '16px', borderTop: '1px solid #1e293b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#111827' }}>
                  <button
                    onClick={() => setSelectedItem(b)}
                    className="btn hover-lift"
                    style={{ padding: '8px', background: 'transparent', border: '1px solid #263244', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Eye size={14}/> Details
                  </button>
                  <button
                    onClick={() => handleDownloadLabel(b)}
                    className="btn hover-lift"
                    style={{ padding: '8px', background: 'transparent', border: '1px solid #263244', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Download size={14}/> Label
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(displayBarcode); toast.success('Copied!'); }}
                    className="btn hover-lift"
                    style={{ padding: '8px', background: '#1e293b', border: 'none', color: 'white', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Copy size={14}/> Copy
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteModal(b); }}
                    style={{ padding: '8px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                  >
                    <Trash2 size={14}/> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SCAN IN/OUT CONFIRMATION MODAL */}
      {pendingScan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', width: '100%', maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarcodeIcon size={20} style={{ color: '#3b82f6' }} />
                Scan {pendingScan.action} - {pendingScan.record.packaging_name || pendingScan.record.material_name}
              </h3>
              <button onClick={() => setPendingScan(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
              <div style={{ padding: '12px', background: '#070b12', borderRadius: '10px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Barcode:</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white' }}>{pendingScan.record.barcode || pendingScan.record.serial_number}</div>
                <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>Qty: {pendingScan.record.quantity} {pendingScan.record.unit || 'PCS'}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                  Scanning Person Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter your name"
                  value={scanPersonName}
                  onChange={(e) => setScanPersonName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmScan(); }}
                  style={{ height: '44px', padding: '0 12px', borderRadius: '10px', background: '#070b12', border: '1px solid #263244', color: 'white', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setPendingScan(null)}
                style={{ padding: '10px 18px', borderRadius: '10px', background: '#1e293b', color: '#cbd5e1', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScan}
                disabled={!scanPersonName.trim() || isProcessingScan}
                style={{ padding: '10px 20px', borderRadius: '10px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: !scanPersonName.trim() || isProcessingScan ? 0.5 : 1 }}
              >
                Confirm Scan {pendingScan.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: 0 }}>{selectedItem.packaging_name || selectedItem.material_name}</h2>
                <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>{selectedItem.packaging_category || selectedItem.category || 'Packaging Material'}</span>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Barcode SVG/Canvas Preview */}
            <div style={{ padding: '24px', background: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <Barcode value={selectedItem.barcode || selectedItem.serial_number} width={1.8} height={60} displayValue={true} />
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Barcode Number</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>{selectedItem.barcode || selectedItem.serial_number || '-'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Quantity & Unit</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.quantity || 0} {selectedItem.unit || 'PCS'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Vendor Name</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.vendor || selectedItem.vendor_name || '-'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Batch Number</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.batch_no || '-'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>PO Reference / Bill No</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.po_reference || '-'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Received Date</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.received_date ? new Date(selectedItem.received_date).toLocaleDateString() : '-'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Scanning Person</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.scanning_person_name || '-'}</span>
              </div>
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Category</span>
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>{selectedItem.packaging_category || selectedItem.category || '-'}</span>
              </div>
            </div>

            {/* Audit Panel */}
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginTop: 0, marginBottom: '12px' }}>Scan History Audit</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#10b981', fontWeight: 700, display: 'block' }}>Inventory IN</span>
                  <div style={{ color: 'white' }}>Person: {selectedItem.inventory_in_person || '-'}</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Date: {selectedItem.inventory_in_at ? new Date(selectedItem.inventory_in_at).toLocaleString() : '-'}</div>
                </div>
                <div>
                  <span style={{ color: '#f43f5e', fontWeight: 700, display: 'block' }}>Inventory OUT</span>
                  <div style={{ color: 'white' }}>Person: {selectedItem.inventory_out_person || '-'}</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Date: {selectedItem.inventory_out_at ? new Date(selectedItem.inventory_out_at).toLocaleString() : '-'}</div>
                </div>
              </div>
            </div>

            {selectedItem.notes && (
              <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Notes</span>
                <p style={{ fontSize: '13px', color: 'white', margin: 0 }}>{selectedItem.notes}</p>
              </div>
            )}

            {/* Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => handleDownloadLabel(selectedItem)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={16} /> Label</button>
              <button onClick={() => handlePrintLabel(selectedItem)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Printer size={16} /> Print</button>
              <button onClick={() => setSelectedItem(null)} style={{ padding: '10px 20px', background: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '12px' }}>
              <AlertCircle size={24} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', margin: 0 }}>Delete Packaging Barcode</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 0 20px 0' }}>
              Are you sure you want to delete barcode <strong style={{ color: 'white', fontFamily: 'monospace' }}>{deleteModal.barcode || deleteModal.serial_number}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setDeleteModal(null)}
                style={{ padding: '8px 16px', borderRadius: '10px', background: '#1e293b', color: '#cbd5e1', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                style={{ padding: '8px 16px', borderRadius: '10px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Barcode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN 34mm x 20mm BARCODE-ONLY LABEL TEMPLATE FOR DOWNLOAD */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div
          ref={barcodeDownloadRef}
          style={{
            width: '340px',
            height: '200px',
            background: '#ffffff',
            padding: '12px 16px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            margin: 0
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Barcode
              value={downloadTarget?.scanCode || downloadTarget?.scan_code || downloadTarget?.barcode || 'PKG000'}
              width={2.2}
              height={90}
              displayValue={false}
              margin={0}
              background="#ffffff"
              lineColor="#000000"
            />
          </div>
          <div style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#000000',
            letterSpacing: '2px',
            marginTop: '8px',
            lineHeight: '1'
          }}>
            {downloadTarget?.scanCode || downloadTarget?.scan_code || downloadTarget?.barcode || 'PKG000'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
