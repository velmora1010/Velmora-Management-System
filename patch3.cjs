const fs = require('fs');
const file = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove scanBuffer and its useEffect
content = content.replace(/const \[scanBuffer, setScanBuffer\] = useState\(''\);\n/g, '');
// 2. Remove toastMsg as it was only used for scanning
// Wait, toastMsg is used for scanning success. I will leave it, it's harmless or I can remove it if needed.

// 3. Remove useEffect that handles scanning
const useEffectScanRegex = /useEffect\(\(\) => \{\n\s+if \(\!pendingBarcodeMB \|\| \!productionBatch \|\| pendingBarcodesList\.length === 0\) \{[\s\S]*?\}, \[pendingBarcodeMB, scanBuffer, productionBatch, pendingBarcodesList\]\);/g;
content = content.replace(useEffectScanRegex, '');

// 4. Remove handleBarcodeScanSuccess
const handleBarcodeScanSuccessRegex = /const handleBarcodeScanSuccess = async \([\s\S]*?await fetchData\(\);\n  \};/g;
content = content.replace(handleBarcodeScanSuccessRegex, '');

// 5. Add handleSaveBarcode and remove handleCancelBarcode clearing scanBuffer
const newHandleSaveBarcode = `  const handleSaveBarcode = async (mb: any) => {
    if (!productionBatch) return;

    const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
    const finalBarcodes = pendingBarcodesList.map((b, i) => ({
      id: crypto.randomUUID(),
      type: 'PRODUCT_UNIT',
      production_batch_id: productionBatch.id,
      micro_batch_id: mb.id,
      product_code: productCode,
      product_name: productionBatch.product_name,
      mb_no: mb.micro_batch_no,
      unit_no: i + 1,
      barcode_no: b.no,
      scan_status: 'PENDING',
      status: 'READY',
      created_at: new Date().toISOString(),
      scanned_at: null
    }));
    await inventoryService.saveProductBarcodes(finalBarcodes);

    await inventoryService.updateMicroBatch(mb.id, {
      status: 'AWAITING_SCAN',
    });

    setPendingBarcodeMB(null);
    setPendingBarcodesList([]);

    navigate('/inventory/view-barcode', {
      state: {
        activeTab: 'PRODUCT',
        filterBatchNo: mb.micro_batch_no,
        filterProductId: productionBatch.id,
        filterProductCode: productCode
      }
    });
  };`;

content = content.replace(
  /const handleCancelBarcode = \(\) => \{\n\s+setPendingBarcodeMB\(null\);\n\s+setPendingBarcodesList\(\[\]\);\n\s+setScanBuffer\(''\);\n\s+\};/,
  `const handleCancelBarcode = () => {\n    setPendingBarcodeMB(null);\n    setPendingBarcodesList([]);\n  };\n\n${newHandleSaveBarcode}`
);

// 6. Update UI: remove "Scanned: x/y" counter, remove individual item scan status, add Save Barcode button
content = content.replace(
  /<span style=\{\{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 \}\}>\n\s+Scanned: <span style=\{\{ color: 'white' \}\}>\{pendingBarcodesList\.filter\(b => b\.scanned\)\.length\} \/ \{pendingBarcodesList\.length\}<\/span>\n\s+<\/span>/,
  ''
);

// Update map render to just show pending, no scanned coloring
const listMapRegex = /\{pendingBarcodesList\.map\(\(bc, idx\) => \([\s\S]*?\}\)\}/;
const newListMap = `{pendingBarcodesList.map((bc, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ background: 'white', padding: '4px', borderRadius: '4px' }}>
                                    <Barcode value={bc.no} width={1} height={20} fontSize={10} margin={0} displayValue={false} />
                                  </div>
                                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'white' }}>{bc.no}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>PENDING</span>
                                </div>
                              </div>
                            ))}`;
content = content.replace(listMapRegex, newListMap);

// Add Save Barcode button
const buttonsRegex = /<button \n\s+className="btn hover-lift" \n\s+style=\{\{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 \}\} \n\s+onClick=\{handleCancelBarcode\}\n\s+>\n\s+Cancel\n\s+<\/button>/;
const newButtons = `<button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} 
                            onClick={handleCancelBarcode}
                          >
                            Cancel
                          </button>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                            onClick={() => handleSaveBarcode(mb)}
                          >
                            <CheckCircle2 size={16} /> Save Barcode
                          </button>`;
content = content.replace(buttonsRegex, newButtons);

// Remove setScanBuffer usage anywhere else
content = content.replace(/setScanBuffer\(''\);/g, '');

fs.writeFileSync(file, content);
console.log('Updated ProductionBatchDetail.tsx');
