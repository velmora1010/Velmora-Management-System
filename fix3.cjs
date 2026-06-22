const fs = require('fs');
const file = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace Chunk 1
content = content.replace(
  "  const [pendingBarcodeMB, setPendingBarcodeMB] = useState<any>(null);\n  const [scanBuffer, setScanBuffer] = useState('');",
  "  const [pendingBarcodeMB, setPendingBarcodeMB] = useState<any>(null);\n  const [pendingBarcodesList, setPendingBarcodesList] = useState<{ no: string, scanned: boolean }[]>([]);\n  const [scanBuffer, setScanBuffer] = useState('');"
);

// Replace Chunk 2
const chunk2old = `  useEffect(() => {
    if (!pendingBarcodeMB || !productionBatch) {
      setScanBuffer('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        
        const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
        const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,'');
        const expectedBarcode = \`PROD-\${productCode}-MB\${pendingBarcodeMB.micro_batch_no}-\${dateStr}-001\`;

        if (scanBuffer === expectedBarcode) {
          setToastMsg({ type: 'success', text: 'Barcode scanned successfully' });
          setTimeout(() => setToastMsg(null), 3000);
          handleBarcodeScanSuccess(pendingBarcodeMB);
        } else {
          setToastMsg({ type: 'error', text: 'Wrong barcode scanned' });
          setTimeout(() => setToastMsg(null), 3000);
        }
        setScanBuffer('');
      } else if (e.key.length === 1) {
        setScanBuffer(prev => prev + e.key.toUpperCase()); // Emulate caps if needed
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingBarcodeMB, scanBuffer, productionBatch]);`;

const chunk2new = `  useEffect(() => {
    if (!pendingBarcodeMB || !productionBatch || pendingBarcodesList.length === 0) {
      setScanBuffer('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        
        const scannedCode = scanBuffer;
        const idx = pendingBarcodesList.findIndex(b => b.no === scannedCode);
        
        if (idx !== -1) {
          if (pendingBarcodesList[idx].scanned) {
            setToastMsg({ type: 'error', text: 'Already scanned' });
          } else {
            const newList = [...pendingBarcodesList];
            newList[idx].scanned = true;
            setPendingBarcodesList(newList);
            setToastMsg({ type: 'success', text: 'Barcode scanned successfully' });
            
            const scannedCount = newList.filter(b => b.scanned).length;
            if (scannedCount === pendingBarcodesList.length) {
              handleBarcodeScanSuccess(pendingBarcodeMB, newList);
            }
          }
        } else {
          setToastMsg({ type: 'error', text: 'Wrong barcode scanned' });
        }
        
        setTimeout(() => setToastMsg(null), 3000);
        setScanBuffer('');
      } else if (e.key.length === 1) {
        setScanBuffer(prev => prev + e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingBarcodeMB, scanBuffer, productionBatch, pendingBarcodesList]);`;

content = content.replace(chunk2old, chunk2new);

// Replace Chunk 3
const chunk3old = `  const handlePassQCClick = (mb: any) => {
    setPendingBarcodeMB(mb);
  };

  const handleCancelBarcode = () => {
    setPendingBarcodeMB(null);
  };`;

const chunk3new = `  const handlePassQCClick = (mb: any) => {
    setPendingBarcodeMB(mb);
    if (productionBatch) {
      const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,'');
      
      const list = [];
      for (let i = 1; i <= mb.units; i++) {
        const serial = i.toString().padStart(3, '0');
        list.push({
          no: \`PROD-\${productCode}-MB\${mb.micro_batch_no}-\${dateStr}-\${serial}\`,
          scanned: false
        });
      }
      setPendingBarcodesList(list);
    }
  };

  const handleCancelBarcode = () => {
    setPendingBarcodeMB(null);
    setPendingBarcodesList([]);
    setScanBuffer('');
  };`;

content = content.replace(chunk3old, chunk3new);

// Replace Chunk 4
const chunk4old = `  const handleBarcodeScanSuccess = async (mb: any) => {
    if (!productionBatch) return;
    
    const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,''); // e.g. 260609
    
    await inventoryService.updateMicroBatch(mb.id, {
      status: 'Passed',
      barcode_data: \`PROD-\${productCode}-MB\${mb.micro_batch_no}-\${dateStr}-001\`,
      barcode_saved: true,
      completed_at: new Date().toISOString()
    });

    const completedCount = productionBatch.completed_micro_batches + 1;
    const isNowComplete = completedCount === productionBatch.total_micro_batches;
    
    if (isNowComplete) {
      const finalBarcodes = [];
      const totalUnits = productionBatch.total_units || 0;
      
      for (let i = 1; i <= totalUnits; i++) {
        const unitSerial = i.toString().padStart(4, '0');
        finalBarcodes.push({
          id: crypto.randomUUID(),
          type: 'PRODUCT_UNIT',
          production_batch_id: productionBatch.id,
          product_code: productCode,
          product_name: productionBatch.product_name,
          unit_no: i,
          barcode_no: \`PROD-\${productCode}-\${dateStr}-\${unitSerial}\`,
          status: 'READY',
          created_at: new Date().toISOString()
        });
      }
      
      if (finalBarcodes.length > 0) {
        await inventoryService.saveProductBarcodes(finalBarcodes);
      }

      const fg = await inventoryService.getFinishedGoods();
      const existingFg = fg.find((f: any) => f.production_batch_id === productionBatch.id && f.total_units === totalUnits);
      
      if (!existingFg) {
        await inventoryService.saveFinishedGood({
          product_code: productCode,
          product_name: productionBatch.product_name,
          production_batch_id: productionBatch.id,
          total_units: totalUnits,
          available_units: totalUnits,
          used_units: 0,
          status: 'READY',
          scanned_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      }
      
      await inventoryService.updateProductionBatch(productionBatch.id, {
        completed_micro_batches: completedCount,
        produced_units: totalUnits,
        inventory_units: totalUnits,
        status: 'Complete'
      });
    } else {
      await inventoryService.updateProductionBatch(productionBatch.id, {
        completed_micro_batches: completedCount,
        produced_units: productionBatch.produced_units + mb.units,
      });
    }
    
    setPendingBarcodeMB(null);
    await fetchData();
  };`;

const chunk4new = `  const handleBarcodeScanSuccess = async (mb: any, scannedList: { no: string, scanned: boolean }[]) => {
    if (!productionBatch) return;
    
    const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';

    await inventoryService.updateMicroBatch(mb.id, {
      status: 'Passed',
      barcode_saved: true,
      completed_at: new Date().toISOString()
    });

    const completedCount = productionBatch.completed_micro_batches + 1;
    const isNowComplete = completedCount === productionBatch.total_micro_batches;

    const finalBarcodes = scannedList.map((b, i) => ({
      id: crypto.randomUUID(),
      type: 'PRODUCT_UNIT',
      production_batch_id: productionBatch.id,
      micro_batch_id: mb.id,
      product_code: productCode,
      product_name: productionBatch.product_name,
      mb_no: mb.micro_batch_no,
      unit_no: i + 1,
      barcode_no: b.no,
      scan_status: 'SCANNED',
      status: 'READY',
      created_at: new Date().toISOString(),
      scanned_at: new Date().toISOString()
    }));
    await inventoryService.saveProductBarcodes(finalBarcodes);

    await inventoryService.saveFinishedGood({
      product_code: productCode,
      product_name: productionBatch.product_name,
      production_batch_id: productionBatch.id,
      micro_batch_id: mb.id,
      total_units: mb.units,
      available_units: mb.units,
      used_units: 0,
      status: 'READY',
      scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    if (isNowComplete) {
      await inventoryService.updateProductionBatch(productionBatch.id, {
        completed_micro_batches: completedCount,
        produced_units: productionBatch.produced_units + mb.units,
        inventory_units: (productionBatch.inventory_units || 0) + mb.units,
        status: 'Complete'
      });
    } else {
      await inventoryService.updateProductionBatch(productionBatch.id, {
        completed_micro_batches: completedCount,
        produced_units: productionBatch.produced_units + mb.units,
        inventory_units: (productionBatch.inventory_units || 0) + mb.units,
      });
    }
    
    setPendingBarcodeMB(null);
    setPendingBarcodesList([]);
    await fetchData();
  };`;

content = content.replace(chunk4old, chunk4new);

// Replace Chunk 5 (UI)
const chunk5old = `                    {pendingBarcodeMB?.id === mb.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>Barcode Ready - Scan to Confirm</span>
                        
                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', margin: '8px 0' }}>
                          <Barcode 
                            value={\`PROD-\${getProductDisplayName(productionBatch.product_name) || 'XX'}-MB\${mb.micro_batch_no}-\${new Date().toISOString().slice(2,10).replace(/-/g,'')}-001\`}
                            width={1.5}
                            height={40}
                            fontSize={14}
                            margin={0}
                            displayValue={true}
                          />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} 
                            onClick={handleCancelBarcode}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}`;

const chunk5new = `                    {pendingBarcodeMB?.id === mb.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch', width: '100%', marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>Barcode Ready - Scan to Confirm</span>
                          <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                            Scanned: <span style={{ color: 'white' }}>{pendingBarcodesList.filter(b => b.scanned).length} / {pendingBarcodesList.length}</span>
                          </span>
                        </div>
                        
                        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #1e293b' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pendingBarcodesList.map((bc, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: bc.scanned ? 'rgba(16, 185, 129, 0.1)' : '#1e293b', borderRadius: '8px', border: \`1px solid \${bc.scanned ? 'rgba(16, 185, 129, 0.3)' : '#334155'}\` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ background: 'white', padding: '4px', borderRadius: '4px' }}>
                                    <Barcode value={bc.no} width={1} height={20} fontSize={10} margin={0} displayValue={false} />
                                  </div>
                                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: bc.scanned ? '#10b981' : 'white' }}>{bc.no}</span>
                                </div>
                                <div>
                                  {bc.scanned ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}><CheckCircle2 size={14} /> SCANNED</span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>PENDING</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} 
                            onClick={handleCancelBarcode}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}`;

content = content.replace(chunk5old, chunk5new);

fs.writeFileSync(file, content);
console.log("File updated successfully");
