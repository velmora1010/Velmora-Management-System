import fs from 'fs';

const file = 'src/services/localInventoryService.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /\} else if \(scanAction === 'PACK'\) \{\s*if \(currentStage === 'PRODUCT_OUT'\) \{[\s\S]*?throw new Error\('Must be released to Inventory OUT before packing\.'\);\s*\}\s*\}/g;

const newLogic = `} else if (scanAction === 'PACK') {
        if (currentStage === 'PACKED_IN_COMBO') throw new Error('This product is already packed in this combo.');
        if (currentStage !== 'PRODUCT_OUT') throw new Error('This product is not released to Combo yet.');

        const comboDraftId = payload?.selectedComboDraftId || record.reservedDraftId;
        if (!comboDraftId) throw new Error('Please select a combo draft/box before packing.');

        const drafts = this.getList('combo_drafts');
        const draftIndex = drafts.findIndex((d: any) => d.comboDraftId === comboDraftId);
        if (draftIndex === -1) throw new Error('Combo draft not found.');
        const activeDraft = drafts[draftIndex];

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

        const pCode = normalizeProductCode(record);

        const reqQty = activeDraft.requiredItems[pCode] || 0;
        if (!reqQty) throw new Error('This product is not required for this combo.');

        const targetQty = reqQty * activeDraft.packsNum;
        const currentScanned = activeDraft.scannedItems.filter((item: any) => normalizeProductCode(item) === pCode).length;

        if (currentScanned >= targetQty) {
          throw new Error('Required quantity already completed.');
        }

        const mBar = getMasterBarcode(record);
        if (activeDraft.scannedItems.find((item: any) => getMasterBarcode(item) === mBar)) {
          throw new Error('This product is already packed in this combo.');
        }

        const released = this.getProductsReleasedToCombo();
        const relIdx = released.findIndex((r: any) => getMasterBarcode(r) === mBar || getMasterBarcode(r) === scannedCode);
        if (relIdx === -1) {
           throw new Error('This product is not released to Combo yet.');
        }
        
        released[relIdx].status = 'PACKED_IN_COMBO';
        this.saveList('product_released_to_combo', released);

        nextStage = 'PACKED_IN_COMBO';
        record.packedComboId = comboDraftId;
        
        activeDraft.scannedItems.push(record);
        drafts[draftIndex] = activeDraft;
        this.saveList('combo_drafts', drafts);

        successMessage = \`Product packed inside Combo \${comboDraftId}.\`;
      }`;

if (content.match(regex)) {
  content = content.replace(regex, newLogic);
  fs.writeFileSync(file, content);
  console.log("Updated PACK logic in localInventoryService");
} else {
  console.log("Could not find PACK logic");
}
