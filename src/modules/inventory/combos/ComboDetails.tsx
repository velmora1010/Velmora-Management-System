import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, Clock, Info, CheckCircle2, Printer, Download, Boxes, Plus } from 'lucide-react';
import Barcode from 'react-barcode';
import { inventoryService } from '../../../services/inventoryService';
import { getProductDisplayName, getProductTheme } from '../production/productHelpers';

export const ComboDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [barcodes, setBarcodes] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!id) return;
      const [batches, allMovements, allBarcodes] = await Promise.all([
        inventoryService.getComboBatches(),
        inventoryService.getComboMovements(id),
        inventoryService.getComboBarcodes(id)
      ]);
      const currentBatch = batches.find((b: any) => b.id === id);
      setBatch(currentBatch);
      setMovements(allMovements);
      setBarcodes(allBarcodes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading combo details...</div>;
  if (!batch) return <div style={{ padding: '48px', textAlign: 'center', color: '#ef4444' }}>Combo batch not found.</div>;

  // Group barcodes by pack_no
  const packsMap: Record<string, any[]> = {};
  barcodes.forEach(bc => {
    if (!packsMap[bc.pack_no]) packsMap[bc.pack_no] = [];
    packsMap[bc.pack_no].push(bc);
  });

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', paddingBottom: '100px' }}>
      
      {/* SUCCESS HEADER */}
      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <CheckCircle2 size={32} color="#10b981" />
        <div>
          <h2 style={{ margin: 0, color: '#10b981', fontSize: '20px', fontWeight: 800 }}>Combo Created Successfully</h2>
          <p style={{ margin: '4px 0 0 0', color: '#a7f3d0', fontSize: '14px' }}>The finished goods have been securely deducted and labels generated.</p>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          <Printer size={16} /> Print All
        </button>
        <button className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          <Download size={16} /> Download Labels
        </button>
        <button onClick={() => navigate('/inventory/combos/inventory')} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginLeft: 'auto' }}>
          <Boxes size={16} /> Go to Combo Inventory
        </button>
        <button onClick={() => navigate('/inventory/combos/create')} className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          <Plus size={16} /> Create Another Combo
        </button>
      </div>

      {/* HEADER CARD */}
      <div className="page-card" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden', background: '#111827', borderRadius: '24px', border: '1px solid #263244', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
        
        <div style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              <Layers size={32} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', color: 'white', fontWeight: 800 }}>{batch.combo_name}</h1>
                <span style={{ 
                  fontSize: '11px', fontWeight: 'bold', padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  {batch.status || 'READY'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '14px', alignItems: 'center' }}>
                <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{batch.batch_id}</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#475569' }} />
                <span><strong style={{ color: 'white' }}>{batch.total_units}</strong> Total Units</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#475569' }} />
                <span>Created {new Date(batch.created_at).toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div className="page-card" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '20px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={18} color="#60a5fa" /> Products Consumed
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const createdLog = movements.find((m: any) => m.type === 'COMBO_CREATED');
              if (!createdLog || !createdLog.deducted_products) {
                // Fallback for old data structure
                return movements.filter((m: any) => m.type === 'consumed').map((m: any) => {
                  const theme = getProductTheme(m.product_name);
                  const displayName = getProductDisplayName(m.product_name);
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#0b1120', borderRadius: '12px', border: `1px solid #1e293b` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: theme.bg, color: theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Layers size={16} />
                        </div>
                        <span style={{ color: 'white', fontWeight: 600 }}>{displayName}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consumed</div>
                        <div style={{ color: '#ef4444', fontWeight: 'bold' }}>{Math.abs(m.quantity)}</div>
                      </div>
                    </div>
                  );
                });
              }

              return Object.keys(createdLog.deducted_products).map((code) => {
                const theme = getProductTheme(code);
                const displayName = getProductDisplayName(code);
                const qty = createdLog.deducted_products[code];
                return (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#0b1120', borderRadius: '12px', border: `1px solid #1e293b` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: theme.bg, color: theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Layers size={16} />
                      </div>
                      <span style={{ color: 'white', fontWeight: 600 }}>{displayName}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consumed</div>
                      <div style={{ color: '#ef4444', fontWeight: 'bold' }}>{qty}</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="page-card" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '20px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#f59e0b" /> Movement Timeline
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '15px', width: '2px', background: '#1e293b' }} />
            
            {movements.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((m: any, i: number) => {
              let icon = <CheckCircle2 size={16} color="#10b981" />;
              let color = '#10b981';
              let title = 'Combo Batch Created';
              let desc = 'System automatically deducted finished goods and added combo stock.';
              
              if (m.type === 'ORDER_RESERVED') {
                icon = <Layers size={16} color="#3b82f6" />;
                color = '#3b82f6';
                title = `Reserved for Order`;
                desc = `Assigned to Order ID: ${m.referenceId || 'N/A'}`;
              } else if (m.type === 'DISPATCHED') {
                icon = <Boxes size={16} color="#f59e0b" />;
                color = '#f59e0b';
                title = 'Combo Dispatched';
                desc = `Dispatched for Order ID: ${m.referenceId || 'N/A'}`;
              } else if (m.type === 'COMBO_DELETED') {
                icon = <Info size={16} color="#ef4444" />;
                color = '#ef4444';
                title = 'Combo Deleted';
                desc = 'Combo was deleted and finished goods restored.';
              }

              return (
                <div key={m.id || i} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `rgba(${color === '#10b981' ? '16, 185, 129' : color === '#3b82f6' ? '59, 130, 246' : color === '#f59e0b' ? '245, 158, 11' : '239, 68, 68'}, 0.1)`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>{desc}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace' }}>
                      {new Date(m.created_at).toLocaleString('en-GB')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BARCODE LABELS */}
      <h2 style={{ fontSize: '20px', color: 'white', fontWeight: 800, marginBottom: '24px' }}>Generated Barcode Labels</h2>
      
      {(() => {
        const boxBc = barcodes.find((b: any) => b.type === 'COMBO_BOX');
        return boxBc && (
          <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '16px', padding: '32px', marginBottom: '32px', textAlign: 'center', boxShadow: '0 0 20px rgba(59, 130, 246, 0.1)' }}>
            <div style={{ fontSize: '14px', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 800, marginBottom: '16px', letterSpacing: '1px' }}>Master Combo Box Barcode</div>
            <div style={{ background: 'white', display: 'inline-flex', padding: '32px', borderRadius: '12px' }}>
              <Barcode
                value={boxBc.barcode_no}
                format="CODE128"
                width={2}
                height={100}
                displayValue={true}
                fontSize={16}
                margin={16}
                background="#ffffff"
                lineColor="#000000"
              />
            </div>
            <div style={{ marginTop: '24px', color: '#94a3b8', fontSize: '14px' }}>
              Contains {boxBc.combo_quantity} Packs of {boxBc.combo_name}
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {(() => {
          const productBarcodes = barcodes.filter((b: any) => b.type === 'PRODUCT');
          const pMap: Record<string, any[]> = {};
          productBarcodes.forEach((bc: any) => {
            if (!pMap[bc.pack_no]) pMap[bc.pack_no] = [];
            pMap[bc.pack_no].push(bc);
          });
          return Object.keys(pMap).sort().map(packNo => (
            <div key={packNo} style={{ background: '#111827', border: '1px solid #1e293b', padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '1px', background: '#334155' }}></div>
                Pack {parseInt(packNo.replace('P', ''))}
                <div style={{ flex: 1, height: '1px', background: '#334155' }}></div>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '24px' }}>
                {pMap[packNo].map((bc, idx) => {
                  const theme = getProductTheme(bc.product_code);
                  return (
                    <div key={idx} style={{ background: '#0f172a', border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden', height: 'auto', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: theme.bg, padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: theme.color, fontWeight: 700, fontSize: '14px' }}>{bc.product_code} - {getProductDisplayName(bc.product_code)}</span>
                        <span style={{ color: theme.color, fontSize: '12px', fontWeight: 700, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{packNo}</span>
                      </div>
                      <div style={{ background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', minHeight: '150px', minWidth: '380px', overflow: 'visible' }}>
                        <Barcode
                          value={bc.barcode_no}
                          format="CODE128"
                          width={1.6}
                          height={80}
                          displayValue={true}
                          fontSize={12}
                          margin={16}
                          background="#ffffff"
                          lineColor="#000000"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

    </div>
  );
};
