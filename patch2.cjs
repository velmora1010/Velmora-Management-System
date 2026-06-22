const fs = require('fs');
const file = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add ProductBarcodeList import
const importProduct = `import ProductBarcodeList from './ProductBarcodeList';\n`;
if (!content.includes('import ProductBarcodeList')) {
  content = content.replace("import { useState, useEffect, useRef } from 'react';", "import { useState, useEffect, useRef } from 'react';\n" + importProduct);
}

// 2. Change activeTab state type
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'RAW_MATERIAL' | 'COMBO' | null>((location.state as any)?.activeTab || null);",
  "const [activeTab, setActiveTab] = useState<'RAW_MATERIAL' | 'COMBO' | 'PRODUCT' | null>((location.state as any)?.activeTab || null);"
);

// 3. Add Product card to the landing grid
const productCard = `
          <motion.div 
            whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(236, 72, 153, 0.2)' }}
            onClick={() => setActiveTab('PRODUCT')}
            style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #ec4899', borderRadius: '24px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #ec4899, #f472b6)' }} />
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={40} color="#ec4899" />
            </div>
            <div>
              <h2 style={{ fontSize: '24px', color: 'white', margin: '0 0 8px 0', fontWeight: 800 }}>Product</h2>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px' }}>View and scan finished product bottle barcodes.</p>
            </div>
          </motion.div>
`;

if (!content.includes("setActiveTab('PRODUCT')")) {
  const comboCardIndex = content.indexOf("<motion.div \n            whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(139, 92, 246, 0.2)' }}");
  if (comboCardIndex !== -1) {
    content = content.slice(0, comboCardIndex) + productCard + content.slice(comboCardIndex);
  }
}

// 4. Update the null checks and inject <ProductBarcodeList />
// Replace global occurrences of `{activeTab !== null && (` with `{activeTab !== null && activeTab !== 'PRODUCT' && (`
content = content.replaceAll(
  "{activeTab !== null && (",
  "{activeTab !== null && activeTab !== 'PRODUCT' && ("
);

// Inject <ProductBarcodeList />
// The easiest place is right before the second {activeTab !== null && activeTab !== 'PRODUCT' && ( which renders the universal scanner
// We can just add it before the first one (the back button area)
const injectionPoint = `{activeTab !== null && activeTab !== 'PRODUCT' && (`;
const renderProduct = `      {activeTab === 'PRODUCT' && <ProductBarcodeList onBack={() => setActiveTab(null)} />}\n\n      `;
content = content.replace(injectionPoint, renderProduct + injectionPoint);

fs.writeFileSync(file, content);
console.log('Updated ViewBarcodeList.tsx');
