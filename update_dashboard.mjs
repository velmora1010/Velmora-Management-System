import fs from 'fs';

const dashboardFile = 'src/modules/inventory/combos/CombosDashboard.tsx';
let dashboardContent = fs.readFileSync(dashboardFile, 'utf8');

// Replace comboBatches with comboBoxes in state and load
dashboardContent = dashboardContent.replace(
  /const \[comboBatches, setComboBatches\] = useState<any\[\]>\(\[\]\);/,
  'const [comboBoxes, setComboBoxes] = useState<any[]>([]);\n  const [boxDetailsModalOpen, setBoxDetailsModalOpen] = useState(false);\n  const [selectedBox, setSelectedBox] = useState<any>(null);'
);

dashboardContent = dashboardContent.replace(
  /inventoryService\.getComboBatches\(\)/,
  '(inventoryService as any).getComboBoxes()'
);

dashboardContent = dashboardContent.replace(
  /setComboBatches\(sorted\);/,
  'setComboBoxes(sorted);'
);

// Replace activeBatches and totalCombos
dashboardContent = dashboardContent.replace(
  /const activeBatches = comboBatches\.filter\(b => b\.status !== 'DELETED'\);/,
  'const activeBatches = comboBoxes || [];'
);

// Total combos becomes total boxes
dashboardContent = dashboardContent.replace(
  /const comboUnits = activeBatches\.reduce\(\(sum, b\) => sum \+ \(b\.total_units \|\| 0\), 0\);/,
  'const comboUnits = activeBatches.length;'
);

// Recent Batches
dashboardContent = dashboardContent.replace(
  /const filteredBatches = comboBatches\.filter\(b => \{[\s\S]*?\}\);\s*const recentBatches = filteredBatches\.slice\(0, 5\);/,
  `const recentBoxes = (comboBoxes || []).slice(0, 8);`
);

// Replace the UI section "Recent Combo Batches" with "Recent Combo Boxes"
const oldSectionRegex = /<h2 style=\{\{ fontSize: '18px'[\s\S]*?(?=\{\/\* CONFIRMATION MODAL \*\/)/;

const newSection = `<h2 style={{ fontSize: '18px', color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={18} color="#64748b" /> Recent Combo Boxes
      </h2>

      {comboBoxes.length === 0 ? (
        <div style={{ background: '#111827', border: '1px dashed #334155', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <Boxes size={48} color="#475569" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '18px' }}>No Combo Boxes Yet</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Create combo boxes to start packing.</p>
          <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => navigate('/inventory/combos/create')}>
            Generate Combo Boxes
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {recentBoxes.map((box: any, i: number) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={box.comboBoxBarcode}
              className="page-card hover-lift"
              style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '24px', cursor: 'pointer' }}
              onClick={() => { setSelectedBox(box); setBoxDetailsModalOpen(true); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '18px', fontWeight: 700 }}>{box.comboName}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{box.comboBoxBarcode}</div>
                </div>
                <div style={{ padding: '4px 8px', background: box.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : box.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: box.status === 'READY' ? '#34d399' : box.status === 'PARTIAL' ? '#f59e0b' : '#60a5fa', fontSize: '11px', fontWeight: 800, borderRadius: '8px', border: \`1px solid \${box.status === 'READY' ? 'rgba(16, 185, 129, 0.2)' : box.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}\` }}>
                   {box.status}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Packed</div>
                  <div style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>{box.packedItems?.length || 0} items</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontSize: '13px', fontWeight: 600 }}>
                  View Details <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* BOX DETAILS MODAL */}
      {boxDetailsModalOpen && selectedBox && (
         <div className="modal-overlay" onClick={() => setBoxDetailsModalOpen(false)}>
           <div 
             className="modal-content" 
             style={{ width: '600px', maxWidth: '90vw', background: 'rgba(17, 24, 39, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid #374151', borderRadius: '24px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }} 
             onClick={e => e.stopPropagation()}
           >
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'white' }}>{selectedBox.comboName}</h2>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedBox.comboBoxBarcode}</div>
                </div>
                <div style={{ padding: '8px 16px', borderRadius: '12px', fontWeight: 800, background: selectedBox.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : selectedBox.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedBox.status === 'READY' ? '#34d399' : selectedBox.status === 'PARTIAL' ? '#f59e0b' : '#60a5fa' }}>
                   {selectedBox.status}
                </div>
             </div>

             <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Created Date</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{new Date(selectedBox.createdAt).toLocaleString()}</span>
                </div>
                {selectedBox.packedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Packed Date</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{new Date(selectedBox.packedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedBox.packedBy && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Packed By</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{selectedBox.packedBy}</span>
                  </div>
                )}
             </div>

             <h3 style={{ fontSize: '16px', color: 'white', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Products Inside</h3>
             
             {selectedBox.packedItems.length === 0 ? (
               <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px' }}>
                 No products packed inside this box.
               </div>
             ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 {selectedBox.packedItems.map((item: any, idx: number) => {
                    const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();
                    return (
                      <div key={idx} style={{ padding: '16px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{item.productName || item.product_name || code}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>Barcode: {item.sourceBarcode || item.barcodeNumber || item.barcode}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', color: '#cbd5e1', fontSize: '12px', fontWeight: 600 }}>
                          Qty: {item.quantity || 1}
                        </div>
                      </div>
                    )
                 })}
               </div>
             )}
             
             <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
               <button 
                 onClick={() => setBoxDetailsModalOpen(false)}
                 style={{ padding: '12px 24px', background: '#334155', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
               >
                 Close Details
               </button>
             </div>
           </div>
         </div>
      )}

      `;

if (dashboardContent.match(oldSectionRegex)) {
  dashboardContent = dashboardContent.replace(oldSectionRegex, newSection);
} else {
  console.log("Regex didn't match.");
}

// Add the X close button to CreateCombo.tsx modal
fs.writeFileSync(dashboardFile, dashboardContent);
console.log("Successfully rebuilt CombosDashboard.tsx");
