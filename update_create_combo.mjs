import fs from 'fs';

const createComboFile = 'src/modules/inventory/combos/CreateCombo.tsx';
let createComboContent = fs.readFileSync(createComboFile, 'utf8');

// I need to overhaul CreateCombo.tsx. 
// It's a large file. I will write a custom script to replace it entirely because the structure is changing completely from Drafts to Combo Boxes list + packing UI.

const newCreateComboContent = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, Search, Box, Trash2, ArrowRight, ArrowLeft, Barcode, CheckCircle2, Activity, Play, Zap } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import { useNavigate } from 'react-router-dom';
import { PREDEFINED_COMBOS } from './CombosDashboard';

export const CreateCombo = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);
  const [comboBoxes, setComboBoxes] = useState<any[]>([]);
  
  const [predefinedPacks, setPredefinedPacks] = useState<Record<string, number>>({});
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPacks, setCustomPacks] = useState<string>('');
  const [customQuantities, setCustomQuantities] = useState<Record<string, string>>({});
  const products = ['1B', '1Y', '1P', '1S'];

  const [activeBoxToPack, setActiveBoxToPack] = useState<any>(null);
  const [scanMessage, setScanMessage] = useState<{type: 'success' | 'error' | 'warning', text: string} | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [activeStock, boxes] = await Promise.all([
        inventoryService.getComboStockBalance(),
        (inventoryService as any).getComboBoxes()
      ]);
      setFinishedGoods(activeStock);
      setComboBoxes((boxes || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleGenerateBoxes = async () => {
    let finalPacksNum = 0;
    let finalName = '';
    let finalReqs: Record<string, number> = {};
    let comboId = '';

    const activePredefined = Object.keys(predefinedPacks).find(k => predefinedPacks[k] > 0);
    
    if (activePredefined) {
       const combo = PREDEFINED_COMBOS.find(c => c.id === activePredefined);
       if (!combo) return;
       finalPacksNum = predefinedPacks[activePredefined];
       finalName = combo.name;
       finalReqs = combo.requirements;
       comboId = combo.id;
    } else if (isCustomOpen) {
       finalPacksNum = parseInt(customPacks) || 0;
       products.forEach(p => {
         const q = parseInt(customQuantities[p]) || 0;
         if (q > 0) finalReqs[p] = q;
       });
       if (finalPacksNum <= 0 || Object.keys(finalReqs).length === 0) return;
       finalName = customName || 'Custom Combo';
       comboId = 'CUSTOM';
    } else {
       return;
    }

    const shortDateStr = new Date().toLocaleDateString('en-GB').replace(/\\//g, '');
    const newBoxes = [];
    
    for (let i = 0; i < finalPacksNum; i++) {
       const boxSerial = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
       const boxBarcodeNo = \`CB-\${comboId.replace(/[^A-Z0-9]/g, '')}-\${shortDateStr}-\${boxSerial}\`;
       
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
    }

    for (const box of newBoxes) {
      await (inventoryService as any).saveComboBox(box);
    }
    
    setPredefinedPacks({});
    setCustomPacks('');
    setCustomQuantities({});
    
    await loadData();
    alert(\`Successfully generated \${finalPacksNum} Combo Box Barcodes.\`);
  };

  const handleScan = async (decodedText: string) => {
    if (isProcessingScan || !activeBoxToPack) return;
    setIsProcessingScan(true);
    setScanMessage(null);

    try {
      const scannedCode = String(decodedText || "").trim().replace(/\\s+/g, "").toUpperCase();
      
      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: scannedCode,
        department: "PRODUCT",
        scanAction: "PACK",
        payload: {
          comboBoxBarcode: activeBoxToPack.comboBoxBarcode
        }
      });
      
      const boxes = await (inventoryService as any).getComboBoxes();
      const updatedBox = boxes.find((b: any) => b.comboBoxBarcode === activeBoxToPack.comboBoxBarcode);
      if (updatedBox) {
         setActiveBoxToPack(updatedBox);
      }
      setComboBoxes(boxes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setScanMessage({ type: 'success', text: result.message || 'Product packed successfully.' });

    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message || 'Scan error occurred' });
    } finally {
      setIsProcessingScan(false);
    }
  };

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
          handleScan(buffer);
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

  if (activeBoxToPack) {
    return (
      <div style={{ padding: '32px', animation: 'fadeIn 0.3s ease-out', maxWidth: '800px', margin: '0 auto' }}>
        <button 
          onClick={() => setActiveBoxToPack(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px', padding: 0 }}
        >
          <ArrowLeft size={18} /> Back to Combo Boxes
        </button>

        <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <div style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{activeBoxToPack.comboName}</div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 800 }}>Pack Combo Box</h2>
              <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '16px', marginTop: '4px' }}>{activeBoxToPack.comboBoxBarcode}</div>
            </div>
            <div style={{ padding: '8px 16px', background: activeBoxToPack.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : activeBoxToPack.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: activeBoxToPack.status === 'READY' ? '#34d399' : activeBoxToPack.status === 'PARTIAL' ? '#f59e0b' : '#60a5fa', borderRadius: '12px', fontWeight: 800, border: \`1px solid \${activeBoxToPack.status === 'READY' ? 'rgba(16, 185, 129, 0.3)' : activeBoxToPack.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}\` }}>
              {activeBoxToPack.status}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {activeBoxToPack.requiredItems.map((req: any) => {
              const packedCount = activeBoxToPack.packedItems.filter((p: any) => normalizeProductCode(p) === req.productCode).length;
              const isComplete = packedCount >= req.requiredQty;
              return (
                <div key={req.productCode} style={{ background: isComplete ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.6)', border: \`1px solid \${isComplete ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.8)'}\`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
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
          </div>

          <AnimatePresence>
            {scanMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: '16px', borderRadius: '12px', background: scanMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : scanMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: scanMessage.type === 'error' ? '#ef4444' : scanMessage.type === 'warning' ? '#f59e0b' : '#10b981', border: \`1px solid \${scanMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : scanMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}\`, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}
              >
                {scanMessage.type === 'error' ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                {scanMessage.text}
              </motion.div>
            )}
          </AnimatePresence>

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
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'white', fontWeight: 800, margin: '0 0 8px 0' }}>Combo Boxes</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create combo box barcodes and pack products into them.</p>
      </div>

      <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '24px', padding: '32px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', color: 'white', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Layers size={24} color="#3b82f6" /> Generate Combo Boxes
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {PREDEFINED_COMBOS.map(combo => (
             <div 
               key={combo.id}
               onClick={() => {
                 setPredefinedPacks({ [combo.id]: (predefinedPacks[combo.id] || 0) + 1 });
                 setIsCustomOpen(false);
               }}
               style={{ background: predefinedPacks[combo.id] ? 'rgba(59, 130, 246, 0.1)' : '#0f172a', border: \`1px solid \${predefinedPacks[combo.id] ? '#3b82f6' : '#334155'}\`, borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '12px' }}
             >
               <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>{combo.name}</h3>
               <div style={{ display: 'flex', gap: '8px' }}>
                 {Object.keys(combo.requirements).map(k => (
                   <span key={k} style={{ padding: '4px 8px', background: '#1e293b', borderRadius: '6px', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{combo.requirements[k]}x {k}</span>
                 ))}
               </div>
               {predefinedPacks[combo.id] > 0 && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto' }}>
                    <input 
                      type="number" min="1" 
                      value={predefinedPacks[combo.id]} 
                      onChange={e => setPredefinedPacks({ [combo.id]: parseInt(e.target.value) || 0 })}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '80px', padding: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', outline: 'none' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>boxes</span>
                 </div>
               )}
             </div>
          ))}
        </div>

        <button 
          onClick={handleGenerateBoxes}
          disabled={!Object.values(predefinedPacks).some(v => v > 0) && (!isCustomOpen || !customPacks)}
          style={{ padding: '14px 28px', background: Object.values(predefinedPacks).some(v => v > 0) || (isCustomOpen && customPacks) ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e293b', color: Object.values(predefinedPacks).some(v => v > 0) || (isCustomOpen && customPacks) ? 'white' : '#64748b', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '16px', cursor: Object.values(predefinedPacks).some(v => v > 0) || (isCustomOpen && customPacks) ? 'pointer' : 'not-allowed', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Box size={20} /> Generate Box Barcodes
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', color: 'white', margin: 0 }}>Active Combo Boxes</h2>
        <div style={{ padding: '4px 12px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '20px', fontWeight: 800, fontSize: '14px' }}>{comboBoxes.filter(b => b.status !== 'READY').length} Active</div>
      </div>

      {comboBoxes.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', background: '#1e293b', borderRadius: '24px', border: '1px dashed #334155' }}>
          <Box size={48} color="#475569" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>No Combo Boxes</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Generate combo box barcodes above to start packing.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {comboBoxes.filter(b => b.status !== 'READY').map(box => (
             <div key={box.comboBoxBarcode} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                 <div>
                   <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '18px' }}>{box.comboName}</h3>
                   <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '14px' }}>{box.comboBoxBarcode}</div>
                 </div>
                 <div style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: box.status === 'EMPTY' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: box.status === 'EMPTY' ? '#60a5fa' : '#f59e0b' }}>
                   {box.status}
                 </div>
               </div>

               <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                 {box.requiredItems.map((req: any) => {
                   const packed = box.packedItems.filter((p: any) => normalizeProductCode(p) === req.productCode).length;
                   return (
                     <div key={req.productCode} style={{ background: '#0f172a', padding: '6px 12px', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px', color: packed >= req.requiredQty ? '#34d399' : 'var(--text-muted)', fontWeight: 600 }}>
                       {req.productCode}: {packed}/{req.requiredQty}
                     </div>
                   );
                 })}
               </div>

               <button 
                 onClick={() => setActiveBoxToPack(box)}
                 style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 'auto' }}
               >
                 <Plus size={16} /> Add Product
               </button>
             </div>
          ))}
        </div>
      )}
    </div>
  );
};
\`;

fs.writeFileSync(createComboFile, newCreateComboContent);
console.log("Successfully rebuilt CreateCombo.tsx with BOX-FIRST workflow");
