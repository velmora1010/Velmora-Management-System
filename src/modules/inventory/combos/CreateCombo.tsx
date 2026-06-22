import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Box, Trash2, ArrowLeft, Barcode, CheckCircle2, X } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import toast from 'react-hot-toast';
import ReactBarcode from 'react-barcode';
export const PREDEFINED_COMBOS: any[] = [
  { id: '1B', name: '1B Combo', requirements: { '1B': 1 } },
  { id: '1Y', name: '1Y Combo', requirements: { '1Y': 1 } },
  { id: '1P', name: '1P Combo', requirements: { '1P': 1 } },
  { id: '1S', name: '1S Combo', requirements: { '1S': 1 } },
  { id: '1B_1Y', name: '1B + 1Y', requirements: { '1B': 1, '1Y': 1 } },
  { id: '2B', name: 'Double 1B', requirements: { '1B': 2 } },
  { id: '2Y', name: 'Double 1Y', requirements: { '1Y': 2 } },
  { id: '1B_1P', name: '1B + 1P', requirements: { '1B': 1, '1P': 1 } },
  { id: '1B_1Y_1P', name: '1B + 1Y + 1P', requirements: { '1B': 1, '1Y': 1, '1P': 1 } },
  { id: 'FULL_SET', name: 'Full Complete', requirements: { '1B': 1, '1Y': 1, '1P': 1, '1S': 1 } }
];

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

export const CreateCombo = () => {
  const [comboBoxes, setComboBoxes] = useState<any[]>([]);
  const [previewBoxes, setPreviewBoxes] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({ '1B': 0, '1Y': 0, '1P': 0, '1S': 0 });
  
  const [predefinedPacks, setPredefinedPacks] = useState<Record<string, number>>({});
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customPacks, setCustomPacks] = useState<string>('');
  const [customQuantities, setCustomQuantities] = useState<Record<string, string>>({});
  
  const [packProductModal, setPackProductModal] = useState<{product: any, addedBy: string} | null>(null);
  const products = ['1B', '1Y', '1P', '1S'];
  const [generatedByMap, setGeneratedByMap] = useState<Record<string, string>>({});

  const [activeBoxToPack, setActiveBoxToPack] = useState<any>(null);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [scanMessage, setScanMessage] = useState<{type: 'success' | 'error' | 'warning', text: string} | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state && location.state.packBox) {
       const box = comboBoxes.find(b => b.comboBoxBarcode === location.state.packBox);
       if (box) setActiveBoxToPack(box);
    }
  }, [location.state, comboBoxes]);

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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeBoxToPack) {
      fetchAvailableProducts(activeBoxToPack);
    }
  }, [activeBoxToPack]);

  const fetchAvailableProducts = async (box: any) => {
    if (!box) return;
    try {
      const allProducts = await (inventoryService as any).getProductBarcodes();
      const matching = allProducts.filter((p: any) => {
         if (p.currentStage !== "PRODUCT_OUT") return false;
         if (p.packedComboBoxBarcode) return false;
         const pCode = normalizeProductCode(p);
         if (!pCode) return false;
         return box.requiredItems.some((req: any) => req.productCode === pCode);
      });
      setAvailableProducts(matching);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    try {
      const [boxes, stockMap] = await Promise.all([
        (inventoryService as any).getComboBoxes(),
        (inventoryService as any).getComboAvailableProductStock()
      ]);
      setComboBoxes((boxes || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setStockMap(stockMap || {});
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateBoxes = async () => {
    let multiplier = 0;
    let finalName = '';
    let finalReqs: Record<string, number> = {};
    let comboId = '';

    const activePredefined = Object.keys(predefinedPacks).find(k => predefinedPacks[k] > 0);
    
    if (activePredefined) {
       const combo = PREDEFINED_COMBOS.find((c: any) => c.id === activePredefined);
       if (!combo) return;
       multiplier = predefinedPacks[activePredefined];
       finalName = combo.name;
       
       Object.keys(combo.requirements).forEach(k => {
         finalReqs[k] = combo.requirements[k] * multiplier;
       });
       comboId = combo.id;
    } else if (isCustomOpen) {
       multiplier = parseInt(customPacks) || 0;
       products.forEach(p => {
         const q = parseInt(customQuantities[p]) || 0;
         if (q > 0) finalReqs[p] = q * multiplier;
       });
       if (multiplier <= 0 || Object.keys(finalReqs).length === 0) return;
       finalName = 'Custom Combo';
       comboId = 'CUSTOM';
    } else {
       return;
    }

    const shortDateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '');
    const newBoxes: any[] = [];
    
    // Always generate ONLY 1 box barcode
    const boxSerial = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const boxBarcodeNo = `CB-${comboId.replace(/[^A-Z0-9]/g, '')}-${shortDateStr}-${boxSerial}`;
    
    const requiredItemsArr = Object.keys(finalReqs).map(code => ({
      productCode: code,
      requiredQty: finalReqs[code]
    }));

    newBoxes.push({
      comboBoxBarcode: boxBarcodeNo,
      comboId,
      comboName: finalName,
      requiredItems: requiredItemsArr,
      packedItems: [],
      status: 'EMPTY',
      createdAt: new Date().toISOString(),
      packedBy: '',
      packedAt: null
    });

    setPreviewBoxes(prev => [...prev, ...newBoxes.map(b => ({ ...b, status: 'NOT SAVED' }))]);
    
    setPredefinedPacks({});
    setCustomPacks('');
    setCustomQuantities({});
    
    toast.success(`Successfully generated 1 preview Combo Box Barcode.`);
  };

  const handleSavePreviewBox = async (box: any) => {
    const generatedBy = generatedByMap[box.comboBoxBarcode];
    if (!generatedBy?.trim()) {
      toast.error('Please enter Generated By before continuing.');
      return;
    }

    const boxToSave = { 
      ...box, 
      displayBarcode: box.comboBoxBarcode,
      barcodeNumber: box.comboBoxBarcode,
      barcode: box.comboBoxBarcode,
      code: box.comboBoxBarcode,
      currentStage: "READY_FOR_FIRST_SCAN",
      status: 'EMPTY',
      savedAt: new Date().toISOString(),
      generatedBy: generatedBy.trim(),
      generatedAt: new Date().toISOString()
    };
    await (inventoryService as any).saveComboBox(boxToSave);
    setPreviewBoxes(prev => prev.map(b => b.comboBoxBarcode === box.comboBoxBarcode ? { ...b, status: 'SAVED / EMPTY', isSaved: true } : b));
    await loadData();
    toast.success('Combo box barcode saved');
  };

  // @ts-ignore
  const handleAddProductFromPreview = async (box: any) => {
    const generatedBy = generatedByMap[box.comboBoxBarcode];
    if (!generatedBy?.trim()) {
      toast.error('Please enter Generated By before continuing.');
      return;
    }

    const boxToSave = { 
      ...box, 
      displayBarcode: box.comboBoxBarcode,
      barcodeNumber: box.comboBoxBarcode,
      barcode: box.comboBoxBarcode,
      code: box.comboBoxBarcode,
      currentStage: "READY_FOR_FIRST_SCAN",
      status: 'EMPTY',
      savedAt: new Date().toISOString(),
      generatedBy: generatedBy.trim(),
      generatedAt: new Date().toISOString()
    };
    await (inventoryService as any).saveComboBox(boxToSave);
    setPreviewBoxes(prev => prev.filter(b => b.comboBoxBarcode !== box.comboBoxBarcode));
    await loadData();
    toast.success('Combo box barcode automatically saved');
    setActiveBoxToPack(boxToSave);
  };

  const handleScanRef = useRef<any>(null);

  const handleScan = async (decodedText: string) => {
    if (isProcessingScan || !activeBoxToPack) return;
    setIsProcessingScan(true);
    setScanMessage(null);

    try {
      const scannedCode = String(decodedText || "").trim().replace(/\s+/g, "").toUpperCase();
      
      const allProducts = await (inventoryService as any).getProductBarcodes();
      const product = allProducts.find((p: any) => (p.displayBarcode || p.barcodeNumber || p.barcode || p.code || p.serial_number || p.barcode_no || p.batchNo || p.id || "").toString().trim().toUpperCase().replace(/\s+/g, "") === scannedCode);

      if (!product) {
        setScanMessage({ type: 'error', text: 'Product not found.' });
        toast.error('Product not found.');
        return;
      }

      setPackProductModal({ product, addedBy: '' });

    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message || 'Scan error occurred' });
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleConfirmPackProduct = async () => {
    if (!packProductModal || !packProductModal.addedBy.trim() || !activeBoxToPack) return;
    setIsProcessingScan(true);
    try {
      const product = packProductModal.product;
      const scannedCode = (product.displayBarcode || product.barcodeNumber || product.barcode || product.code || product.serial_number || product.barcode_no || product.batchNo || product.id || "").toString().trim().toUpperCase().replace(/\s+/g, "");
      
      const result = await (inventoryService as any).packProductIntoComboBox({
        comboBoxBarcode: activeBoxToPack.comboBoxBarcode,
        productBarcode: scannedCode,
        addedBy: packProductModal.addedBy.trim()
      });

      if (result.success) {
        const boxes = await (inventoryService as any).getComboBoxes();
        setComboBoxes(boxes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setActiveBoxToPack(result.comboBox);
        setScannerInput('');
        setScanMessage({ type: 'success', text: result.message || 'Product packed successfully.' });
        toast.success("Product added to combo box");
        setPackProductModal(null);
      } else {
        setScanMessage({ type: 'error', text: result.message || 'Failed to pack product' });
        toast.error(result.message || 'Failed to pack product');
      }

    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message || 'Scan error occurred' });
    } finally {
      setIsProcessingScan(false);
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 50);
    }
  };

  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  const handleRemoveProduct = async (productBarcode: string) => {
    try {
      if (!activeBoxToPack) return;
      await (inventoryService as any).removeProductFromBox(activeBoxToPack.comboBoxBarcode, productBarcode);
      const boxes = await (inventoryService as any).getComboBoxes();
      const updatedBox = boxes.find((b: any) => b.comboBoxBarcode === activeBoxToPack.comboBoxBarcode);
      if (updatedBox) {
         setActiveBoxToPack(updatedBox);
      }
      setComboBoxes(boxes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setScanMessage({ type: 'success', text: 'Product removed from box successfully.' });
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message || 'Failed to remove product' });
    }
  };

  // Keyboard Scanner Listener
  useEffect(() => {
    let buffer = '';
    let timeout: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeBoxToPack) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (buffer) {
          e.preventDefault();
          handleScanRef.current(buffer);
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
  }, [activeBoxToPack]);

  const [scannerInput, setScannerInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);

  if (activeBoxToPack) {
    return (
      <div style={{ padding: '32px', animation: 'fadeIn 0.3s ease-out', maxWidth: '800px', margin: '0 auto' }}>
        <button 
          onClick={() => setActiveBoxToPack(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px', padding: 0 }}
        >
          <ArrowLeft size={18} /> Back to Combo Boxes
        </button>

        <div style={{}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <div style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{activeBoxToPack.comboName}</div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 800 }}>Pack Combo Box</h2>
              <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '16px', marginTop: '4px' }}>{activeBoxToPack.comboBoxBarcode}</div>
              {activeBoxToPack.generatedBy && (
                <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px', fontWeight: 600 }}>
                  Generated By: <span style={{ color: 'white' }}>{activeBoxToPack.generatedBy}</span>
                </div>
              )}
              {activeBoxToPack.addedBy && (
                <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px', fontWeight: 600 }}>
                  Added By: <span style={{ color: 'white' }}>{activeBoxToPack.addedBy}</span>
                </div>
              )}
            </div>
            <div style={{ padding: '8px 16px', background: activeBoxToPack.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : activeBoxToPack.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: activeBoxToPack.status === 'READY' ? '#34d399' : activeBoxToPack.status === 'PARTIAL' ? '#f59e0b' : '#60a5fa', borderRadius: '12px', fontWeight: 800, border: `1px solid ${activeBoxToPack.status === 'READY' ? 'rgba(16, 185, 129, 0.3)' : activeBoxToPack.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` }}>
              {activeBoxToPack.status}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {activeBoxToPack.requiredItems.map((req: any) => {
              const packedCount = activeBoxToPack.packedItems.filter((p: any) => normalizeProductCode(p) === req.productCode).length;
              const isComplete = packedCount >= req.requiredQty;
              return (
                <div key={req.productCode} style={{ background: isComplete ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.6)', border: `1px solid ${isComplete ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.8)'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: isComplete ? '#34d399' : 'white', marginBottom: '4px' }}>{req.productCode}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>{packedCount} / {req.requiredQty} Packed</div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#0f172a', padding: '24px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Barcode size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Scan Product Barcode</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>Scan finished product labels to pack</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                ref={scannerInputRef}
                autoFocus
                value={scannerInput}
                onChange={e => setScannerInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && scannerInput) {
                     handleScan(scannerInput);
                     setScannerInput('');
                  }
                }}
                disabled={activeBoxToPack.status === 'READY'}
                placeholder="Scan or enter product barcode"
                style={{ flex: 1, height: '48px', padding: '0 16px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', outline: 'none', fontSize: '16px' }}
              />
              <button 
                onClick={() => {
                  if (scannerInput) {
                    handleScan(scannerInput);
                    setScannerInput('');
                  }
                }}
                disabled={!scannerInput || activeBoxToPack.status === 'READY'}
                style={{ height: '48px', padding: '0 24px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, cursor: scannerInput && activeBoxToPack.status !== 'READY' ? 'pointer' : 'not-allowed', opacity: scannerInput && activeBoxToPack.status !== 'READY' ? 1 : 0.5 }}
              >
                Scan Product
              </button>
            </div>
            <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Click input box and scan product barcode. Press Enter or click Scan Product.
            </p>
          </div>

          <AnimatePresence>
            {scanMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: '16px', borderRadius: '12px', background: scanMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : scanMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: scanMessage.type === 'error' ? '#ef4444' : scanMessage.type === 'warning' ? '#f59e0b' : '#10b981', border: `1px solid ${scanMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : scanMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}
              >
                {scanMessage.type === 'error' ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                {scanMessage.text}
              </motion.div>
            )}
          </AnimatePresence>

          <h3 style={{ fontSize: '16px', color: 'white', marginBottom: '16px' }}>Available Products for this Box</h3>
          {availableProducts.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px dashed #334155', marginBottom: '32px' }}>
              No available products found. Please ensure products are released to Combo first (Inventory OUT).
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {availableProducts.map((item: any, idx: number) => {
                const displayBarcode = (item.displayBarcode || item.barcodeNumber || item.barcode || item.code || item.serial_number || item.barcode_no || item.batchNo || item.id || "").toString().trim().toUpperCase().replace(/\s+/g, "");
                const pCode = normalizeProductCode(item);
                const theme = getProductTheme(pCode);
                return (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: '#1e293b', border: `1px solid ${theme.border}`, borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ background: 'white', padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', position: 'relative' }}>
                      <ReactBarcode value={displayBarcode} width={1.8} height={60} fontSize={14} margin={0} displayValue={false} />
                    </div>
                    
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'white', margin: '0 0 4px 0' }}>{item.productName || item.product_name || pCode}</h3>
                          <p style={{ color: theme.color, fontSize: '13px', fontFamily: 'monospace', margin: 0 }}>{displayBarcode}</p>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          SCAN FOR COMBO
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleScan(displayBarcode)}
                        disabled={activeBoxToPack.status === 'READY'}
                        style={{ height: '40px', background: theme.color, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: activeBoxToPack.status === 'READY' ? 'not-allowed' : 'pointer', opacity: activeBoxToPack.status === 'READY' ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Plus size={16} /> Add to Box
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <h3 style={{ fontSize: '16px', color: 'white', marginBottom: '16px' }}>Packed Products</h3>
          {activeBoxToPack.packedItems.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px dashed #334155' }}>
              No products packed yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeBoxToPack.packedItems.map((item: any, idx: number) => {
                const pCode = normalizeProductCode(item);
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {pCode}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600, marginBottom: '2px' }}>{item.productName || item.product_name || pCode}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>{item.sourceBarcode || item.barcodeNumber || item.barcode}</div>
                      </div>
                    </div>
                    {activeBoxToPack.status !== 'READY' && (
                      <button 
                        onClick={() => handleRemoveProduct(item.sourceBarcode || item.barcodeNumber || item.barcode)}
                        style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button 
              onClick={() => setActiveBoxToPack(null)}
              style={{ padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Packed Combo
            </button>
          </div>
        </div>

        <AnimatePresence>
          {packProductModal && activeBoxToPack && (
            <div className="modal-overlay" onClick={() => setPackProductModal(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="modal-content" style={{ width: '450px', padding: 0, background: '#0b1120', border: '1px solid #1e293b' }} onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 800 }}>Confirm Product Packing</h2>
                  <button onClick={() => setPackProductModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20}/></button>
                </div>

                <div style={{ padding: '24px' }}>
                  <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Product Name</span>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{packProductModal.product.productName || packProductModal.product.product_name || normalizeProductCode(packProductModal.product)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Product Code</span>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{normalizeProductCode(packProductModal.product)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Product Barcode</span>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', fontFamily: 'monospace' }}>{(packProductModal.product.displayBarcode || packProductModal.product.barcodeNumber || packProductModal.product.barcode || packProductModal.product.code || packProductModal.product.serial_number || packProductModal.product.barcode_no || packProductModal.product.batchNo || packProductModal.product.id || "").toString().trim().toUpperCase().replace(/\s+/g, "")}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Combo Box Barcode</span>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', fontFamily: 'monospace' }}>{activeBoxToPack.comboBoxBarcode}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Required Combo</span>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{activeBoxToPack.comboName}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>Added By <span style={{color: '#ef4444'}}>*</span></label>
                    <input type="text" value={packProductModal.addedBy} onChange={e => setPackProductModal({...packProductModal, addedBy: e.target.value})} 
                          autoFocus placeholder="Enter your name"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && packProductModal.addedBy.trim()) {
                              handleConfirmPackProduct();
                            }
                          }}
                          className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full" />
                  </div>
                </div>

                <div style={{ padding: '24px', display: 'flex', gap: '16px', background: '#070b12', borderTop: '1px solid #1e293b' }}>
                  <button onClick={() => setPackProductModal(null)} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'transparent', border: '1px solid #263244', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <button onClick={handleConfirmPackProduct} disabled={!packProductModal.addedBy.trim()} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: !packProductModal.addedBy.trim() ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', cursor: !packProductModal.addedBy.trim() ? 'not-allowed' : 'pointer', fontWeight: 700 }}>Confirm</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const getComboMaxCount = (combo: any) => {
    let max = Infinity;
    Object.keys(combo.requirements).forEach(code => {
      const required = combo.requirements[code];
      const available = stockMap[code] || 0;
      const possible = Math.floor(available / required);
      if (possible < max) {
        max = possible;
      }
    });
    return max === Infinity ? 0 : max;
  };

  const handleCardClick = (comboId: string, maxBoxes: number) => {
    if (maxBoxes === 0) return;
    if (!predefinedPacks[comboId]) {
      setPredefinedPacks({ [comboId]: 1 });
      setIsCustomOpen(false);
    }
  };

  const handleDecrement = (comboId: string) => {
    const currentVal = predefinedPacks[comboId] || 0;
    if (currentVal <= 1) {
      setPredefinedPacks({});
    } else {
      setPredefinedPacks({ [comboId]: currentVal - 1 });
    }
  };

  const handleIncrement = (comboId: string, maxBoxes: number) => {
    const currentVal = predefinedPacks[comboId] || 0;
    if (currentVal >= maxBoxes) {
      setScanMessage({ type: 'error', text: 'Not enough products available for this combo' });
      setTimeout(() => setScanMessage(null), 3000);
      return;
    }
    setPredefinedPacks({ [comboId]: currentVal + 1 });
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        .combo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .combo-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .combo-grid {
            grid-template-columns: 1fr;
          }
        }
        .combo-card {
          min-height: 120px;
          padding: 14px;
          border-radius: 14px;
          background: #0f172a;
          border: 1px solid #1e293b;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .combo-card.selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6, 0 0 16px rgba(59, 130, 246, 0.3);
        }
        .combo-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .combo-stepper {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 22px;
        }
        .active-combo-boxes {
          margin-top: 28px;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: 'white', fontWeight: 800 }}>Create Combo</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Configure quantities and generate combo box barcodes.</p>
        </div>
      </div>

      <div className="combo-grid" style={{ marginBottom: '24px' }}>
           {PREDEFINED_COMBOS.map((combo: any) => {
             const isSelected = !!predefinedPacks[combo.id];
             const qty = predefinedPacks[combo.id] || 0;
             const maxCount = getComboMaxCount(combo);
             
             const mainType = Object.keys(combo.requirements)[0];
             let iconColor = '#3b82f6';
             if (mainType === '1Y') iconColor = '#facc15';
             if (mainType === '1P') iconColor = '#f472b6';
             if (mainType === '1S') iconColor = '#94a3b8';
             if (combo.id === 'FULL_SET') iconColor = '#a855f7';
             
             return (
               <div 
                 key={combo.id}
                 onClick={() => handleCardClick(combo.id, maxCount)}
                 className={`combo-card hover-lift ${isSelected ? 'selected' : ''}`}
                 style={{
                   ...(!isSelected ? { boxShadow: `0 4px 20px -5px ${iconColor}20` } : {}),
                   opacity: maxCount === 0 ? 0.6 : 1,
                   cursor: maxCount === 0 ? 'not-allowed' : 'pointer'
                 }}
               >
                 <div>
                   <div className="combo-card-header">
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: iconColor, boxShadow: `0 0 8px ${iconColor}` }}></div>
                       <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: 700 }}>{combo.name}</h3>
                     </div>
                     <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
                       Max: <span style={{ color: maxCount > 0 ? '#4ade80' : '#f87171', fontWeight: 800 }}>{maxCount}</span>
                     </span>
                   </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {Object.keys(combo.requirements).map(k => {
                        let bg = '#1e293b';
                        let fg = '#cbd5e1';
                        if (k === '1B') { bg = 'rgba(59, 130, 246, 0.2)'; fg = '#93c5fd'; }
                        else if (k === '1Y') { bg = 'rgba(234, 179, 8, 0.2)'; fg = '#fde047'; }
                        else if (k === '1P') { bg = 'rgba(236, 72, 153, 0.2)'; fg = '#f9a8d4'; }
                        else if (k === '1S') { bg = 'rgba(100, 116, 139, 0.2)'; fg = '#cbd5e1'; }
                        return (
                          <span key={k} style={{ padding: '3px 6px', background: bg, borderRadius: '5px', fontSize: '11px', color: fg, fontWeight: 700 }}>
                            {k} x {combo.requirements[k]}
                          </span>
                        );
                      })}
                    </div>
                 </div>
                 
                 <div className="combo-stepper">
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleDecrement(combo.id);
                     }}
                     disabled={qty <= 0}
                     style={{ 
                       width: '28px', 
                       height: '28px', 
                       borderRadius: '6px', 
                       border: '1px solid #475569', 
                       background: '#334155', 
                       color: 'white', 
                       cursor: qty > 0 ? 'pointer' : 'not-allowed', 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'center', 
                       fontWeight: 'bold', 
                       fontSize: '14px', 
                       opacity: qty > 0 ? 1 : 0.5,
                       outline: 'none',
                       transition: 'all 0.2s'
                     }}
                   >
                     <Minus size={12} />
                   </button>
                   <span style={{ color: 'white', fontWeight: 800, minWidth: '16px', textAlign: 'center', fontSize: '18px' }}>
                     {qty}
                   </span>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleIncrement(combo.id, maxCount);
                     }}
                     disabled={qty >= maxCount || maxCount === 0}
                     style={{ 
                       width: '28px', 
                       height: '28px', 
                       borderRadius: '6px', 
                       border: '1px solid #475569', 
                       background: '#334155', 
                       color: 'white', 
                       cursor: (qty >= maxCount || maxCount === 0) ? 'not-allowed' : 'pointer', 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'center', 
                       fontWeight: 'bold', 
                       fontSize: '14px', 
                       opacity: (qty >= maxCount || maxCount === 0) ? 0.5 : 1,
                       outline: 'none',
                       transition: 'all 0.2s'
                     }}
                   >
                     <Plus size={12} />
                   </button>
                 </div>
               </div>
             );
          })}
        </div>

        {(() => {
          const isGenerateEnabled = Object.values(predefinedPacks).some(v => v > 0) || (isCustomOpen && parseInt(customPacks) > 0);
          return (
            <button 
              onClick={handleGenerateBoxes}
              disabled={!isGenerateEnabled}
              style={{ padding: '14px 28px', background: isGenerateEnabled ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e293b', color: isGenerateEnabled ? 'white' : '#64748b', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '16px', cursor: isGenerateEnabled ? 'pointer' : 'not-allowed', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Box size={20} /> Generate Box Barcodes
            </button>
          );
        })()}

      {previewBoxes.length > 0 && (
        <div className="preview-combo-boxes" style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', color: 'white', margin: 0 }}>Generated Combo Box Barcodes</h2>
            <div style={{ padding: '4px 12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '20px', fontWeight: 800, fontSize: '14px' }}>Preview</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {previewBoxes.map(box => (
               <div key={box.comboBoxBarcode} style={{ background: '#111827', border: '1px solid #f59e0b', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div>
                     <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '18px', fontWeight: 700 }}>{box.comboName}</h3>
                     <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '14px' }}>{box.comboBoxBarcode}</div>
                   </div>
                   <div style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                     {box.status}
                   </div>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'center', background: 'white', padding: '16px', borderRadius: '8px' }}>
                   <ReactBarcode value={box.comboBoxBarcode} width={1.5} height={50} displayValue={false} margin={0} background="transparent" />
                 </div>

                 <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                   {box.requiredItems.map((req: any) => (
                     <div key={req.productCode} style={{ background: '#0f172a', padding: '6px 12px', borderRadius: '8px', border: '1px solid #263244', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                       {req.productCode}: 0/{req.requiredQty}
                     </div>
                   ))}
                 </div>

                 <div style={{ marginTop: 'auto' }}>
                   <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Generated By <span style={{color: '#ef4444'}}>*</span></label>
                   <input 
                     type="text" 
                     value={generatedByMap[box.comboBoxBarcode] || ''} 
                     onChange={e => setGeneratedByMap(prev => ({...prev, [box.comboBoxBarcode]: e.target.value}))} 
                     placeholder="Enter your name" 
                     disabled={box.isSaved}
                     style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '14px', outline: 'none', opacity: box.isSaved ? 0.6 : 1 }} 
                   />
                 </div>

                 {generatedByMap[box.comboBoxBarcode]?.trim() && !box.isSaved && (
                   <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                     <button 
                       onClick={() => handleSavePreviewBox(box)}
                       style={{ flex: 1, padding: '12px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                     >
                       Save Barcode
                     </button>
                   </div>
                 )}

                 {box.isSaved && (
                   <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                     <button 
                       onClick={() => navigate('/inventory/view-barcode/combo')}
                       style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid #334155', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                     >
                       View Barcode
                     </button>
                     <button 
                       onClick={() => {
                         const savedBox = comboBoxes.find(b => b.comboBoxBarcode === box.comboBoxBarcode) || box;
                         setActiveBoxToPack(savedBox);
                       }}
                       style={{ flex: 1, padding: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                     >
                       <Plus size={16} /> Add Product
                     </button>
                   </div>
                 )}
               </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
