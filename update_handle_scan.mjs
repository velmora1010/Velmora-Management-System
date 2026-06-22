import fs from 'fs';

const file = 'src/modules/inventory/combos/CreateCombo.tsx';
let content = fs.readFileSync(file, 'utf8');

const scanRegex = /const handleScan = async \(decodedText: string\) => \{[\s\S]*?setIsProcessingScan\(false\);\s*\}\s*\};/g;

const newScanLogic = `const handleScan = async (decodedText: string) => {
    if (isProcessingScan || !draft) return;
    setIsProcessingScan(true);
    setScanMessage(null);

    try {
      const scannedCode = normalizeCode(decodedText);
      
      const result = await inventoryService.processBarcodeScan({
        barcodeNumber: scannedCode,
        department: "PRODUCT",
        scanAction: "PACK",
        payload: {
          selectedComboDraftId: draft.comboDraftId
        }
      });
      
      const drafts = await inventoryService.getComboDrafts();
      const updatedDraft = drafts.find((d: any) => d.comboDraftId === draft.comboDraftId);
      if (updatedDraft) {
         setDraft(updatedDraft);
      }
      setPendingDrafts((drafts || []).filter((d: any) => d.status === 'DRAFT'));
      setScanMessage({ type: 'success', text: result.message || 'Product packed successfully.' });

    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message || 'Scan error occurred' });
    } finally {
      setIsProcessingScan(false);
    }
  };`;

if (content.match(scanRegex)) {
  content = content.replace(scanRegex, newScanLogic);
  fs.writeFileSync(file, content);
  console.log("Updated handleScan in CreateCombo");
} else {
  console.log("Could not find handleScan");
}
