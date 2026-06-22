import fs from 'fs';

// 1. Update localInventoryService.ts
const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const activeDraftsLogic = `
  getActiveComboDrafts() {
    // Migrate old format if needed
    let drafts = JSON.parse(localStorage.getItem("combo_drafts") || "[]");
    let migrated = false;
    
    drafts = drafts.map((d: any) => {
      if (d.id && !d.comboDraftId) { d.comboDraftId = d.id; migrated = true; }
      if (d.combo_name && !d.comboName) { d.comboName = d.combo_name; migrated = true; }
      return d;
    });

    if (migrated) {
      localStorage.setItem("combo_drafts", JSON.stringify(drafts));
    }

    return drafts.filter((draft: any) =>
      draft.status === "DRAFT" || !draft.status
    );
  }

  async getComboDrafts() {`;

serviceContent = serviceContent.replace('async getComboDrafts() {', activeDraftsLogic);
fs.writeFileSync(serviceFile, serviceContent);


// 2. Update ProductBarcodeList.tsx
const productListFile = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let productListContent = fs.readFileSync(productListFile, 'utf8');

// Replace the comboDrafts state with activeDrafts fetch
// We don't need to fetch it async inside fetchBarcodes anymore, but let's just use it directly in the render or state.

const dropDownRegex = /<select[\s\S]*?<\/select>/;

const newDropdown = `<select 
                 value={selectedDraftId} onChange={e => setSelectedDraftId(e.target.value)}
                 style={{ height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.5)', background: '#1e293b', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer', flex: 1 }}
               >
                 <option value="">-- Select Combo Draft --</option>
                 {(inventoryService as any).getActiveComboDrafts().map((draft: any) => {
                   const req = draft.totalRequired || draft.requiredQty || (draft.packsNum && draft.requiredItems ? draft.packsNum * Object.values(draft.requiredItems).reduce((a: any, b: any) => a + b, 0) : 0);
                   return (
                     <option key={draft.comboDraftId || draft.id} value={draft.comboDraftId || draft.id}>
                       {draft.comboName || draft.combo_name} - {draft.comboDraftId || draft.id} ({draft.scannedItems?.length || 0}/{req})
                     </option>
                   );
                 })}
               </select>`;

if (productListContent.match(dropDownRegex)) {
  productListContent = productListContent.replace(dropDownRegex, newDropdown);
  fs.writeFileSync(productListFile, productListContent);
  console.log("Successfully updated ProductBarcodeList.tsx");
} else {
  console.log("Could not find dropdown regex");
}
