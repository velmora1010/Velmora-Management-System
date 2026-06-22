import fs from 'fs';
const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// We need to add filteredProducts and filteredCombos
const summaryCalcsRegex = /const q = safeText\(searchTerm\);/;
const extraFiltersCode = `const q = safeText(searchTerm);

  const filteredProducts = finishedGoods.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (prodSubTab === 'IN') matchTab = stage === 'PRODUCT_IN';
    if (prodSubTab === 'OUT') matchTab = stage === 'PRODUCT_OUT';

    const matchSearch = safeText(item.product_name).includes(q) || 
      safeText(item.product_code).includes(q) ||
      safeText(item.barcode_no).includes(q);
      
    return matchSearch && matchTab;
  });

  const filteredCombos = allComboBarcodes.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (comboSubTab === 'IN') matchTab = stage === 'COMBO_IN';
    if (comboSubTab === 'OUT') matchTab = stage === 'COMBO_OUT';

    const matchSearch = safeText(item.combo_name).includes(q) || 
      safeText(item.barcode_no).includes(q);
      
    return matchSearch && matchTab;
  });`;

content = content.replace(summaryCalcsRegex, extraFiltersCode);

// Now for product UI
const productUIRegex = /\{activeTab === 'product' && \(\s*<div style=\{\{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba\(0,0,0,0\.1\)' \}\}>\s*<div className="table-responsive">/;
const productUICode = `{activeTab === 'product' && (
        <>
          <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div className="table-responsive">`;

content = content.replace(productUIRegex, productUICode);

const productTableEndRegex = /<\/table>\s*<\/div>\s*<\/div>\s*\)}/;
const productTableEndCode = `</table>
          </div>
        </div>

        <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #263244', display: 'flex', gap: '8px' }}>
            <button onClick={() => setProdSubTab('ALL')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: prodSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: prodSubTab === 'ALL' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>All</button>
            <button onClick={() => setProdSubTab('IN')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: prodSubTab === 'IN' ? '#10b981' : 'transparent', color: prodSubTab === 'IN' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory IN</button>
            <button onClick={() => setProdSubTab('OUT')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: prodSubTab === 'OUT' ? '#f59e0b' : 'transparent', color: prodSubTab === 'OUT' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory OUT</button>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                <tr>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Date</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Barcode</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Product</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Stage</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>No barcodes found.</td></tr>
                ) : (
                  filteredProducts.map((row: any, idx: number) => (
                    <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)' }} className="hover-bg">
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.barcode_no}</td>
                      <td style={{ padding: '16px 20px', color: 'white', fontWeight: 700, borderBottom: '1px solid #1e293b' }}>{row.product_name}</td>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.currentStage || 'READY'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}`;

content = content.replace(productTableEndRegex, productTableEndCode);

// Now for Combo UI
const comboUIRegex = /<div style=\{\{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba\(0,0,0,0\.1\)' \}\}>\s*<div className="table-responsive">/g;

// I'll replace the combo table with a two-part UI just like product.
// Wait, regex might match the previous one if I'm not careful. Since I already replaced the product one, it should only match the combo one.
const comboUICode = `<div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div className="table-responsive">`;
content = content.replace(comboUIRegex, comboUICode);

const comboTableEndRegex = /<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)}/g;
const comboTableEndCode = `</table>
            </div>
          </div>

          <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #263244', display: 'flex', gap: '8px' }}>
              <button onClick={() => setComboSubTab('ALL')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: comboSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: comboSubTab === 'ALL' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>All</button>
              <button onClick={() => setComboSubTab('IN')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: comboSubTab === 'IN' ? '#10b981' : 'transparent', color: comboSubTab === 'IN' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory IN</button>
              <button onClick={() => setComboSubTab('OUT')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: comboSubTab === 'OUT' ? '#f59e0b' : 'transparent', color: comboSubTab === 'OUT' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory OUT</button>
            </div>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Barcode</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Combo Name</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCombos.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>No combo barcodes found.</td></tr>
                  ) : (
                    filteredCombos.map((row: any, idx: number) => (
                      <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)' }} className="hover-bg">
                        <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.barcode_no}</td>
                        <td style={{ padding: '16px 20px', color: 'white', fontWeight: 700, borderBottom: '1px solid #1e293b' }}>{row.combo_name}</td>
                        <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.currentStage || 'READY'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}`;
      
content = content.replace(comboTableEndRegex, comboTableEndCode);

fs.writeFileSync(file, content);
console.log('Fixed product and combo UI');
