import fs from 'fs';

const productListFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productListContent = fs.readFileSync(productListFile, 'utf8');

const filterRegex = /const filteredBarcodes = productSubTab === 'PACKED'[\s\S]*?productBarcodes\.filter\(b => \{/;

const newFilterLogic = `const filteredBarcodes = productSubTab === 'PACKED' 
    ? ((inventoryService as any).getProductsReleasedToCombo?.() || []).filter((b: any) => {
        if (b.status === 'PACKED_IN_COMBO') return false;

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
        
        const activeDraft = (inventoryService as any).getActiveComboDrafts().find((d: any) => d.comboDraftId === selectedDraftId || d.id === selectedDraftId);
        
        if (activeDraft && activeDraft.requiredItems) {
           if (!activeDraft.requiredItems[pCode]) return false;
        }

        const matchesSearch = !searchTerm || 
          [b.sourceBarcode, b.barcodeNumber, b.barcode, b.productName, pCode]
            .some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));
            
        return matchesSearch;
      }).map((b: any) => ({
         ...b,
         barcode_no: b.sourceBarcode || b.barcodeNumber || b.barcode,
         product_code: (b.productCode || b.product_code || (b.productName?.toLowerCase().includes("liquid a") ? "1B" : "")),
         product_name: b.productName || b.materialName,
         currentStage: b.status || 'PRODUCT_OUT'
      }))
    : productBarcodes.filter(b => {`;

if (productListContent.match(filterRegex)) {
  productListContent = productListContent.replace(filterRegex, newFilterLogic);
  fs.writeFileSync(productListFile, productListContent);
  console.log("Successfully updated filteredBarcodes logic");
} else {
  // If the regex doesn't match, it means productSubTab === 'PACKED' isn't split yet!
  const oldFilterRegex = /const filteredBarcodes = productBarcodes\.filter\(b => \{/;
  
  if (productListContent.match(oldFilterRegex)) {
    productListContent = productListContent.replace(oldFilterRegex, newFilterLogic);
    fs.writeFileSync(productListFile, productListContent);
    console.log("Successfully split filteredBarcodes logic");
  } else {
    console.log("Could not find filteredBarcodes logic");
  }
}
