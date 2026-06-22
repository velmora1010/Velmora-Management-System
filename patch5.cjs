const fs = require('fs');
const file = 'src/modules/inventory/view-barcode/ProductBarcodeList.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add useLocation import
content = content.replace("import { useNavigate, useLocation } from 'react-router-dom';", ""); // in case it was there
content = content.replace("import { motion, AnimatePresence } from 'framer-motion';", "import { motion, AnimatePresence } from 'framer-motion';\nimport { useLocation } from 'react-router-dom';");

// 2. Add useLocation hook inside component
content = content.replace(
  "export default function ProductBarcodeList({ onBack }: ProductBarcodeListProps) {",
  "export default function ProductBarcodeList({ onBack }: ProductBarcodeListProps) {\n  const location = useLocation();\n"
);

// 3. Update initial searchTerm based on location.state
content = content.replace(
  "const [searchTerm, setSearchTerm] = useState('');",
  "const [searchTerm, setSearchTerm] = useState<string>(((location.state as any)?.filterBatchNo ? `MB${(location.state as any).filterBatchNo}` : ''));"
);

// 4. Update handleScan logic
const oldHandleScan = `    if (found) {
      await inventoryService.updateProductBarcodeStatus(found.barcode_no, 'SCANNED');
      setScanModal({ open: true, barcode: { ...found, scan_status: 'SCANNED' } });
      await fetchBarcodes();
    } else {`;

const newHandleScan = `    if (found) {
      await inventoryService.updateProductBarcodeStatus(found.barcode_no, 'SCANNED');
      
      // Attempt to verify and pass micro batch
      const wasPassedNow = await (inventoryService as any).verifyAndCompleteMicroBatchScan(found.micro_batch_id);
      if (wasPassedNow) {
         // optional: add toast or alert for micro batch passed
         console.log("Micro batch passed successfully!");
      }

      setScanModal({ open: true, barcode: { ...found, scan_status: 'SCANNED' } });
      await fetchBarcodes();
    } else {`;

content = content.replace(oldHandleScan, newHandleScan);

fs.writeFileSync(file, content);
console.log('Updated ProductBarcodeList.tsx');
