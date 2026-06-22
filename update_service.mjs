import fs from 'fs';

const serviceFile = 'src/services/localInventoryService.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

// 1. Add getComboBoxes, saveComboBox, getComboBoxById
const comboBoxesLogic = `
  // ---- COMBO BOXES ----
  
  async getComboBoxes() {
    return this.getList('combo_boxes');
  }

  async saveComboBox(box: any) {
    const list = this.getList('combo_boxes');
    const existingIndex = list.findIndex(b => b.comboBoxBarcode === box.comboBoxBarcode);
    if (existingIndex > -1) {
      list[existingIndex] = { ...list[existingIndex], ...box };
    } else {
      list.push(box);
    }
    this.saveList('combo_boxes', list);
  }

  async removeProductFromBox(comboBoxBarcode: string, productBarcode: string) {
    const boxes = this.getList('combo_boxes');
    const boxIndex = boxes.findIndex(b => b.comboBoxBarcode === comboBoxBarcode);
    if (boxIndex === -1) throw new Error('Combo box not found');
    
    const box = boxes[boxIndex];
    if (box.status === 'READY') throw new Error('Cannot remove products from a READY combo box');
    
    const productIndex = box.packedItems.findIndex((item: any) => 
      this.normalizeBarcode(item.sourceBarcode || item.barcodeNumber || item.barcode) === this.normalizeBarcode(productBarcode)
    );
    
    if (productIndex === -1) throw new Error('Product not found in this combo box');
    
    const removedProduct = box.packedItems.splice(productIndex, 1)[0];
    
    // Update box status
    if (box.packedItems.length === 0) {
      box.status = 'EMPTY';
    } else {
      box.status = 'PARTIAL';
    }
    
    boxes[boxIndex] = box;
    this.saveList('combo_boxes', boxes);
    
    // Restore product status
    const mBar = this.normalizeBarcode(productBarcode);
    const released = this.getProductsReleasedToCombo();
    const relIdx = released.findIndex((r: any) => this.normalizeBarcode(r.sourceBarcode || r.barcodeNumber || r.barcode) === mBar);
    
    if (relIdx > -1) {
      released[relIdx].status = 'PRODUCT_OUT'; // Restore status
      this.saveList('product_released_to_combo', released);
    }
    
    // Attempt to update original product barcode
    const allProducts = [
      ...this.getList('finished_product_barcodes'),
      ...this.getList('finished_goods'),
      ...this.getList('product_barcodes'),
      ...this.getList('production_micro_batches')
    ];
    let foundProdList = '';
    
    let prodRec = this.getList('finished_product_barcodes').find(p => this.normalizeBarcode(p.barcode_no || p.barcodeNumber) === mBar);
    if (prodRec) foundProdList = 'finished_product_barcodes';
    
    if (!prodRec) {
      prodRec = this.getList('product_barcodes').find(p => this.normalizeBarcode(p.barcode_no || p.barcodeNumber) === mBar);
      if (prodRec) foundProdList = 'product_barcodes';
    }
    
    if (prodRec && foundProdList) {
       prodRec.currentStage = 'PRODUCT_OUT';
       delete prodRec.packedComboBoxBarcode;
       const list = this.getList(foundProdList);
       const idx = list.findIndex(p => this.normalizeBarcode(p.barcode_no || p.barcodeNumber) === mBar);
       if (idx > -1) {
         list[idx] = prodRec;
         this.saveList(foundProdList, list);
       }
    }
    
    return box;
  }
`;

serviceContent = serviceContent.replace('// ---- COMBOS ----', comboBoxesLogic + '\\n  // ---- COMBOS ----');


const oldPackRegex = /\} else if \\(scanAction === 'PACK'\\) \\{[\\s\\S]*?(?=\\} else if \\(department === 'COMBO'\\) \\{|\\}\\n\\s*if \\(!record\\) \\{)/;

const newPackLogic = `} else if (scanAction === 'PACK') {
        const mBar = getMasterBarcode(record);
        
        if (currentStage === 'PACKED_IN_COMBO') throw new Error('This product is already packed in a combo.');
        if (currentStage !== 'PRODUCT_OUT') throw new Error('This product is not released to Combo yet.');

        const comboBoxBarcode = payload?.comboBoxBarcode || explicitComboDraftId;
        if (!comboBoxBarcode) throw new Error('Please specify a combo box barcode before packing.');

        const boxes = this.getList('combo_boxes');
        const boxIndex = boxes.findIndex((b: any) => b.comboBoxBarcode === comboBoxBarcode);
        if (boxIndex === -1) throw new Error('Combo box not found.');
        const activeBox = boxes[boxIndex];

        if (activeBox.status === 'READY') throw new Error('This combo box is already fully packed.');

        if (activeBox.packedItems.find((item: any) => getMasterBarcode(item) === mBar)) {
          throw new Error('This product is already packed in this combo box.');
        }

        const released = this.getProductsReleasedToCombo();
        const relIdx = released.findIndex((r: any) => getMasterBarcode(r) === mBar || getMasterBarcode(r) === scannedCode);
        if (relIdx === -1) {
           throw new Error('This product is not released to Combo yet.');
        }

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

        const pCode = normalizeProductCode(record) || normalizeProductCode(released[relIdx]);
        
        let requiredMatch = activeBox.requiredItems.find((req: any) => req.productCode === pCode);
        
        if (!requiredMatch) {
           throw new Error(\`Wrong product. This combo requires: \${activeBox.requiredItems.map((r:any) => r.productCode).join(' + ')}.\`);
        }
        
        // Count already packed of this type
        const alreadyPackedOfThisType = activeBox.packedItems.filter((p:any) => normalizeProductCode(p) === pCode).length;
        if (alreadyPackedOfThisType >= requiredMatch.requiredQty) {
           throw new Error(\`Box already has enough \${pCode} (\${alreadyPackedOfThisType}/\${requiredMatch.requiredQty}).\`);
        }
        
        released[relIdx].status = 'PACKED_IN_COMBO';
        this.saveList('product_released_to_combo', released);

        nextStage = 'PACKED_IN_COMBO';
        record.packedComboBoxBarcode = comboBoxBarcode;
        
        record.packedAt = now;
        record.packedBy = userId;
        activeBox.packedItems.push(record);
        
        // Check if fully packed
        let isReady = true;
        activeBox.requiredItems.forEach((req: any) => {
           const count = activeBox.packedItems.filter((p:any) => normalizeProductCode(p) === req.productCode).length;
           if (count < req.requiredQty) isReady = false;
        });
        
        activeBox.status = isReady ? 'READY' : 'PARTIAL';
        
        boxes[boxIndex] = activeBox;
        this.saveList('combo_boxes', boxes);

        successMessage = \`Product \${pCode} packed into Box \${comboBoxBarcode}.\`;
      `;

if (serviceContent.match(oldPackRegex)) {
  serviceContent = serviceContent.replace(oldPackRegex, newPackLogic);
} else {
  console.error("Could not find processBarcodeScan PACK regex in localInventoryService.ts");
}

if (!serviceContent.includes('normalizeBarcode(v: any)')) {
  const normLogic = \`
  normalizeBarcode(v: any) {
    return String(v || "").trim().replace(/\\\\s+/g, "").toUpperCase();
  }
\`;
  serviceContent = serviceContent.replace('class LocalInventoryService {', 'class LocalInventoryService {' + normLogic);
}

fs.writeFileSync(serviceFile, serviceContent);
console.log("Successfully updated localInventoryService.ts");
