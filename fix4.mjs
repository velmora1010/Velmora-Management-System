import fs from 'fs';
const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '4px' \}\}>\s*<span style=\{\{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' \}\}>Value<\/span>\s*<span style=\{\{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' \}\}>₹\{card\.amount\.toLocaleString\(undefined, \{ maximumFractionDigits: 0 \}\)\}<\/span>\s*<\/div>\s*<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' \}\}>\s*<span style=\{\{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' \}\}>Batches<\/span>\s*<span style=\{\{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' \}\}>\{card\.totalBatches\}<\/span>\s*<\/div>\s*<\/div>\s*<th style=\{\{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0\.5px' \}\}>Status<\/th>\s*<th style=\{\{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0\.5px' \}\}>Action<\/th>/;

const correctCode = `                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Value</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>₹{card.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Batches</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{card.totalBatches}</span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

          <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {/* RAW MATERIAL TAB */}
        {activeTab === 'raw_material' && (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid #263244', display: 'flex', gap: '8px' }}>
              <button onClick={() => setRawSubTab('ALL')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: rawSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: rawSubTab === 'ALL' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>All</button>
              <button onClick={() => setRawSubTab('IN')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: rawSubTab === 'IN' ? '#10b981' : 'transparent', color: rawSubTab === 'IN' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory IN</button>
              <button onClick={() => setRawSubTab('OUT')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: rawSubTab === 'OUT' ? '#f59e0b' : 'transparent', color: rawSubTab === 'OUT' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory OUT</button>
            </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                <tr>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Date</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Material</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Barcode</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Batch</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Vendor</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Quantity</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Available</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Value</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Action</th>`;

content = content.replace(regex, correctCode);
fs.writeFileSync(file, content);
console.log('Fixed');
