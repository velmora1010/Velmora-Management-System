import fs from 'fs';

// 1. Update ViewBarcodeList.tsx
const viewFile = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let viewContent = fs.readFileSync(viewFile, 'utf8');

const oldScanBlock = /let scanAction = 'IN';\s*if \(activeTab === 'RAW_MATERIAL'\) scanAction = \(rawMaterialSubTab === 'OUT'\) \? 'OUT' : 'IN';\s*if \(activeTab === 'COMBO'\) scanAction = \(comboSubTab === 'OUT'\) \? 'OUT' : 'IN';/;

const newScanBlock = `let scanAction = 'IN';
        if (activeTab === 'RAW_MATERIAL') {
          scanAction = rawMaterialSubTab === 'ALL' ? 'IN' : rawMaterialSubTab === 'IN' ? 'OUT' : 'VIEW';
        } else if (activeTab === 'COMBO') {
          scanAction = comboSubTab === 'ALL' ? 'IN' : comboSubTab === 'IN' ? 'OUT' : 'VIEW';
        }
        
        if (scanAction === 'VIEW') {
           setScanModal({ type: 'error' as any, barcode: null, scannedCode: code, message: 'Cannot perform scan actions from this tab. Please use ALL to scan IN or Inventory IN to scan OUT.' } as any);
           setIsProcessingScan(false);
           return;
        }`;

if (viewContent.match(oldScanBlock)) {
  viewContent = viewContent.replace(oldScanBlock, newScanBlock);
  fs.writeFileSync(viewFile, viewContent);
  console.log('Fixed ViewBarcodeList.tsx scanAction mapping');
} else {
  console.log('Could not find oldScanBlock in ViewBarcodeList.tsx');
}

// 2. Update ProductBarcodeList.tsx
const productFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productContent = fs.readFileSync(productFile, 'utf8');

// In ProductBarcodeList, let's see how scanAction is computed currently.
// It might just be hardcoded or missing entirely. Let me do a flexible regex search.
// We need to insert `let scanAction = ...` right before `const result = await inventoryService.processBarcodeScan({`
const productScanBlock = /const result = await inventoryService\.processBarcodeScan\(\{\s*barcodeNumber: cleanCode,\s*department: 'PRODUCT',\s*(?:scanAction:[^,]+,)?\s*payload: \{ selectedComboDraftId: selectedDraftId \}\s*\}\);/;

const newProductScanBlock = `let scanAction = 'IN';
      if (productSubTab === 'ALL') scanAction = 'IN';
      else if (productSubTab === 'IN') scanAction = 'OUT';
      else if (productSubTab === 'PACKED') scanAction = 'PACK';
      else scanAction = 'VIEW';

      if (scanAction === 'VIEW') {
         setScanModal({ type: 'error' as any, barcode: null, scannedCode: cleanCode, message: 'Already released to combo. Cannot perform scan action here.' } as any);
         setIsProcessingScan(false);
         return;
      }
      if (scanAction === 'PACK' && !selectedDraftId) {
         setScanModal({ type: 'error' as any, barcode: null, scannedCode: cleanCode, message: 'Please select a Combo to Pack before scanning.' } as any);
         setIsProcessingScan(false);
         return;
      }

      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: cleanCode,
        department: 'PRODUCT',
        scanAction: scanAction as any,
        payload: { selectedComboDraftId: selectedDraftId }
      });`;

// Wait, the regex might be slightly off. Let me just replace the processBarcodeScan call block inside ProductBarcodeList.tsx
// Let me use a more robust regex or just check if the file contains the block.
if (productContent.includes("department: 'PRODUCT',") && productContent.includes("processBarcodeScan(")) {
  productContent = productContent.replace(/const result = await inventoryService\.processBarcodeScan\(\{\s*barcodeNumber: cleanCode,\s*department: 'PRODUCT'[\s\S]*?\}\);/m, newProductScanBlock);
  fs.writeFileSync(productFile, productContent);
  console.log('Fixed ProductBarcodeList.tsx scanAction mapping');
} else {
  console.log('Could not find processBarcodeScan call in ProductBarcodeList.tsx');
}
