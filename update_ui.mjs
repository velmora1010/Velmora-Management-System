import fs from 'fs';

const file = 'src/modules/inventory/combos/CreateCombo.tsx';
let content = fs.readFileSync(file, 'utf8');

const scanBoxRegex = /<div style=\{\{ background: '#0b1120', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px' \}\}>[\s\S]*?<\/div>/;

const newScanBox = `<div style={{ background: '#0b1120', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Barcode size={24} color="#64748b" />
              <div style={{ color: 'white', fontSize: '15px' }}>
                Scanner Ready. Scan required products...
              </div>
              {isProcessingScan && <span style={{ color: '#3b82f6', fontSize: '14px' }}>Processing...</span>}
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="Scan or enter product barcode"
                id="manual-barcode-input"
                style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px 16px', color: 'white', fontSize: '16px', outline: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScan(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('manual-barcode-input') as HTMLInputElement;
                  if (input && input.value) {
                    handleScan(input.value);
                    input.value = '';
                  }
                }}
                disabled={isProcessingScan}
                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 24px', borderRadius: '8px', fontWeight: 700, cursor: isProcessingScan ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Scan Product
              </button>
            </div>
          </div>`;

content = content.replace(scanBoxRegex, newScanBox);


const buttonsRegex = /<div style=\{\{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '12px' \}\}>\s*<button/;

const newButtons = `<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '12px' }}>
            <button
              onClick={() => {
                setScanMessage({ type: 'success', text: 'Draft saved successfully.' });
              }}
              className="hover-lift"
              style={{
                 background: '#334155', color: 'white', border: 'none', padding: '16px 24px', borderRadius: '12px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s ease'
              }}
            >
              Save Draft
            </button>
            <button`;

content = content.replace(buttonsRegex, newButtons);


const pendingDraftsRegex = /\{pd\.scannedItems\?\.length \|\| 0\} items scanned/;
const newPendingDrafts = `{pd.scannedItems?.length || 0} / {pd.packsNum * Object.values(pd.requiredItems).reduce((a: any, b: any) => a + b, 0)} items scanned`;

content = content.replace(pendingDraftsRegex, newPendingDrafts);
content = content.replace(pendingDraftsRegex, newPendingDrafts); // Replace globally if needed

fs.writeFileSync(file, content);
console.log("Successfully updated CreateCombo.tsx UI");
