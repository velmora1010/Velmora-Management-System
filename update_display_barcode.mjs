import fs from 'fs';

// 1. Update ViewBarcodeList.tsx
const viewBarcodeFile = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let viewBarcodeContent = fs.readFileSync(viewBarcodeFile, 'utf8');

const rawMaterialRenderBlock = /<Barcode value=\{b\.serial_number\} width=\{1\.5\} height=\{50\} displayValue=\{false\} margin=\{0\} \/>\s*<\/div>\s*<div style=\{\{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: badgeInfo\.bg, color: badgeInfo\.color, width: '100%' \}\}>\s*\{badgeInfo\.text\}\s*<\/div>\s*<\/div>\s*<div style=\{\{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 \}\}>\s*<div>\s*<h3 style=\{\{ margin: '0 0 4px 0', fontSize: '16px', color: 'white' \}\}>\{b\.material_name\}<\/h3>\s*<div style=\{\{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' \}\}>\{b\.serial_number\}<\/div>/g;

const newRawMaterialRenderBlock = `const displayBarcode = b.barcodeNumber || b.barcode || b.code || b.batchNo || b.serial_number || b.barcode_no || b.id;
                  return (
                  <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: \`1px solid \${badgeInfo.color}40\`, overflow: 'hidden' }}>
                    <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      
                      <div id={\`view-barcode-\${displayBarcode}\`}>
                        <Barcode value={displayBarcode} width={1.5} height={50} displayValue={false} margin={0} />
                      </div>
                      <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: badgeInfo.bg, color: badgeInfo.color, width: '100%' }}>
                        {badgeInfo.text}
                      </div>
                    </div>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'white' }}>{b.material_name}</h3>
                        <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{displayBarcode}</div>`;

// Actually the regex matching can be tricky because of exact whitespace.
// Let's use simpler replacements.

viewBarcodeContent = viewBarcodeContent.replace(
  /<div id=\{\`view-barcode-\$\{b\.serial_number\}\`\}>\s*<Barcode value=\{b\.serial_number\} width=\{1\.5\} height=\{50\} displayValue=\{false\} margin=\{0\} \/>/g,
  `const displayBarcode = b.barcodeNumber || b.barcode || b.code || b.batchNo || b.serial_number || b.barcode_no || b.id;
                  <div id={\`view-barcode-\${displayBarcode}\`}>
                    <Barcode value={displayBarcode} width={1.5} height={50} displayValue={false} margin={0} />`
);

viewBarcodeContent = viewBarcodeContent.replace(
  /<div style=\{\{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' \}\}>\{b\.serial_number\}<\/div>/g,
  `<div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{b.barcodeNumber || b.barcode || b.code || b.batchNo || b.serial_number || b.barcode_no || b.id}</div>`
);

fs.writeFileSync(viewBarcodeFile, viewBarcodeContent);

// 2. Update ProductBarcodeList.tsx
const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productContent = fs.readFileSync(productFile, 'utf8');

productContent = productContent.replace(
  /<Barcode value=\{item\.barcode_no\} width=\{1\.8\} height=\{60\} fontSize=\{14\} margin=\{0\} displayValue=\{false\} \/>/g,
  `{(() => { const displayBarcode = item.barcodeNumber || item.barcode || item.code || item.batchNo || item.serial_number || item.barcode_no || item.id; return <Barcode value={displayBarcode} width={1.8} height={60} fontSize={14} margin={0} displayValue={false} />; })()}`
);

productContent = productContent.replace(
  /<p style=\{\{ color: selectedTheme\.color, fontSize: '14px', fontFamily: 'monospace', margin: 0 \}\}>\{item\.barcode_no\}<\/p>/g,
  `<p style={{ color: selectedTheme.color, fontSize: '14px', fontFamily: 'monospace', margin: 0 }}>{item.barcodeNumber || item.barcode || item.code || item.batchNo || item.serial_number || item.barcode_no || item.id}</p>`
);

fs.writeFileSync(productFile, productContent);

// 3. Update localInventoryService.ts
const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const repairLogic = `
  repairBarcodeValues(collectionKey: string) {
    const list = JSON.parse(localStorage.getItem(collectionKey) || "[]");
    let changed = false;
    
    list.forEach((item: any) => {
      const visibleCode = item.barcodeNumber || item.barcode || item.code || item.batchNo || item.serial_number || item.barcode_no || item.id;
      if (visibleCode && (item.barcodeNumber !== visibleCode || item.barcode !== visibleCode || item.code !== visibleCode || item.serial_number !== visibleCode || item.barcode_no !== visibleCode)) {
        item.barcodeNumber = visibleCode;
        item.barcode = visibleCode;
        item.code = visibleCode;
        item.serial_number = visibleCode;
        item.barcode_no = visibleCode;
        changed = true;
      }
    });
    
    if (changed) {
      localStorage.setItem(collectionKey, JSON.stringify(list));
    }
  }
`;

if (!serviceContent.includes('repairBarcodeValues(')) {
  const initIndex = serviceContent.indexOf('private init()');
  if (initIndex > -1) {
    serviceContent = serviceContent.substring(0, initIndex) + repairLogic + serviceContent.substring(initIndex);
  }
}

fs.writeFileSync(serviceFile, serviceContent);
console.log('UI rendering explicitly aligned with exact display code. Repair logic injected.');
