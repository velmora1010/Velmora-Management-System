import fs from 'fs';

const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update filteredProducts
const prodFilterRegex = /const filteredProducts = finishedGoods\.filter\(\(item: any\) => \{[\s\S]*?return matchSearch && matchTab;\n  \}\);/s;
const newProdFilter = `const filteredProducts = finishedGoods.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (prodSubTab === 'ALL') matchTab = true;
    if (prodSubTab === 'IN') matchTab = ['PRODUCT_IN', 'PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);
    if (prodSubTab === 'OUT') matchTab = ['PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);

    const matchSearch = safeText(item.product_name).includes(q) || 
      safeText(item.product_code).includes(q) ||
      safeText(item.barcode_no).includes(q);
      
    return matchSearch && matchTab;
  }).sort((a,b) => new Date(b.created_at || b.stock_in_at).getTime() - new Date(a.created_at || a.stock_in_at).getTime());`;
content = content.replace(prodFilterRegex, newProdFilter);

// 2. Update filteredCombos
const comboFilterRegex = /const filteredCombos = allComboBarcodes\.filter\(\(item: any\) => \{[\s\S]*?return matchSearch && matchTab;\n  \}\);/s;
const newComboFilter = `const filteredCombos = allComboBarcodes.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (comboSubTab === 'ALL') matchTab = true;
    if (comboSubTab === 'IN') matchTab = ['COMBO_IN', 'COMBO_OUT', 'READY_FOR_DISPATCH'].includes(stage);
    if (comboSubTab === 'OUT') matchTab = ['COMBO_OUT', 'READY_FOR_DISPATCH'].includes(stage);

    const matchSearch = safeText(item.combo_name).includes(q) || 
      safeText(item.barcode_no).includes(q);
      
    return matchSearch && matchTab;
  }).sort((a,b) => new Date(b.created_at || b.stock_in_at).getTime() - new Date(a.created_at || a.stock_in_at).getTime());`;
content = content.replace(comboFilterRegex, newComboFilter);

// 3. Update filteredRaw
const rawFilterRegex = /const filteredRaw = scannedRawBatches\.filter\(\(item: any\) => \{[\s\S]*?return matchSearch && matchTab;\n  \}\);/s;
const newRawFilter = `const filteredRaw = rawBatches.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (rawSubTab === 'ALL') matchTab = true;
    if (rawSubTab === 'IN') matchTab = ['RAW_MATERIAL_IN', 'RAW_MATERIAL_OUT'].includes(stage);
    if (rawSubTab === 'OUT') matchTab = ['RAW_MATERIAL_OUT'].includes(stage);

    const matchSearch = safeText(item.material_name).includes(q) || 
      safeText(item.vendor_name).includes(q) ||
      safeText(item.po_reference).includes(q) ||
      safeText(item.serial_number).includes(q) ||
      safeText(item.batch_number).includes(q);
      
    return matchSearch && matchTab;
  }).sort((a,b) => new Date(b.created_at || b.stock_in_at).getTime() - new Date(a.created_at || a.stock_in_at).getTime());`;
content = content.replace(rawFilterRegex, newRawFilter);

// 4. Update Raw Material Badge
const rawBadgeRegex = /\{row\.currentStage === 'RAW_MATERIAL_OUT' \? \([\s\S]*?Stock In\s*<\/span>\s*\)\}/s;
const newRawBadge = `{row.currentStage === 'RAW_MATERIAL_OUT' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY OUT
                          </span>
                        ) : row.currentStage === 'RAW_MATERIAL_IN' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY IN
                          </span>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            NOT SCANNED
                          </span>
                        )}`;
content = content.replace(rawBadgeRegex, newRawBadge);

// 5. Update Product Badge
const prodBadgeRegex = /\{row\.currentStage === 'PRODUCT_OUT' \? \([\s\S]*?Stock In\s*<\/span>\s*\)\}/s;
const newProdBadge = `{row.currentStage === 'PRODUCT_OUT' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY OUT
                          </span>
                        ) : row.currentStage === 'PACKED_IN_COMBO' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            PACKED IN COMBO
                          </span>
                        ) : row.currentStage === 'PRODUCT_IN' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY IN
                          </span>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            NOT SCANNED
                          </span>
                        )}`;
content = content.replace(prodBadgeRegex, newProdBadge);

fs.writeFileSync(file, content);
console.log('Filters and Badges updated.');
