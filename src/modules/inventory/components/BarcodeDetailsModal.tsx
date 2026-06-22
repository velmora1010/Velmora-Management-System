import { useState, useEffect } from 'react';
import { X, Clock, History, FileText, AlertTriangle, Database } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import toast from 'react-hot-toast';

interface BarcodeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: any | null; // { type: 'PRODUCT'|'COMBO'|'DRAFT', data: any, title, subtitle }
}

export const BarcodeDetailsModal = ({ isOpen, onClose, target }: BarcodeDetailsModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'audit'>('details');
  const [location, setLocation] = useState<string>('');
  const [txs, setTxs] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustReason, setAdjustReason] = useState('DAMAGED');

  const role = localStorage.getItem('current_role') || 'Operator';
  const canAdjust = role === 'Admin' || role === 'Supervisor';

  useEffect(() => {
    if (isOpen && target) {
      loadData();
    }
  }, [isOpen, target]);

  const loadData = async () => {
    if (!target) return;
    const barcode = target.data.barcode_no || target.data.batch_id || target.data.comboDraftId;
    
    // Fetch real location
    const loc = await inventoryService.getCurrentLocation(barcode);
    setLocation(loc || (target.type === 'DRAFT' ? 'DRAFT' : 'UNKNOWN'));

    // Fetch transactions
    const h = await inventoryService.getTransactionHistory(barcode);
    setTxs(h || []);

    // Fetch audits
    const a = await inventoryService.getInventoryAuditLogs();
    setAudits((a || []).filter((log: any) => log.barcodeNumber === barcode));
  };

  const handleAdjust = async () => {
    if (!target) return;
    const barcode = target.data.barcode_no || target.data.batch_id;
    if (!barcode) return;
    
    try {
      await inventoryService.createInventoryTransfer({
        barcodeNumber: barcode,
        itemType: target.type,
        itemName: target.data.product_name || target.data.combo_name || 'Item',
        quantity: 1,
        unit: 'Unit',
        fromLocation: location,
        toLocation: adjustReason,
        referenceType: 'MANUAL_ADJUSTMENT',
        referenceId: 'ADJUSTMENT',
        userId: localStorage.getItem('current_user') || 'Admin'
      });
      setIsAdjusting(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!isOpen || !target) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      
      <div style={{ position: 'relative', width: '100%', maxWidth: '800px', maxHeight: '90vh', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(to right, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.5))' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'white' }}>{target.title}</h2>
              <span style={{ 
                padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: target.type === 'PRODUCT' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: target.type === 'PRODUCT' ? '#60a5fa' : '#10b981', border: `1px solid ${target.type === 'PRODUCT' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
              }}>
                {target.type}
              </span>
              <span style={{ 
                padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)'
              }}>
                STAGE: {(target.data.currentStage || 'READY_FOR_FIRST_SCAN').replace(/_/g, ' ')}
              </span>
              <span style={{ 
                padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.2)'
              }}>
                SCANS: {target.data.scanCount || 0}
              </span>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px' }}>{target.subtitle}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', padding: '0 24px' }}>
          {[
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'timeline', label: 'Timeline', icon: History },
            { id: 'audit', label: 'Audit Log', icon: Database }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: 'transparent', border: 'none', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px',
                  color: isActive ? 'white' : '#64748b', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  borderBottom: `2px solid ${isActive ? '#6366f1' : 'transparent'}`, transition: 'all 0.2s'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="custom-scrollbar">
          
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>CREATED AT</div>
                  <div style={{ color: 'white', fontSize: '15px' }}>{new Date(target.data.created_at || target.data.createdAt).toLocaleString()}</div>
                </div>
                {target.type === 'PRODUCT' && (
                  <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>BATCH NO</div>
                    <div style={{ color: 'white', fontSize: '15px' }}>{target.data.batch_no}</div>
                  </div>
                )}
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>INVENTORY IN TIME</div>
                  <div style={{ color: 'white', fontSize: '15px' }}>{txs.find(t => String(t.toLocation).endsWith('_IN')) ? new Date(txs.find(t => String(t.toLocation).endsWith('_IN')).createdAt).toLocaleString() : 'N/A'}</div>
                </div>
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>INVENTORY OUT TIME</div>
                  <div style={{ color: 'white', fontSize: '15px' }}>{txs.find(t => String(t.toLocation).endsWith('_OUT') || String(t.toLocation) === 'PACKED_IN_COMBO') ? new Date(txs.find(t => String(t.toLocation).endsWith('_OUT') || String(t.toLocation) === 'PACKED_IN_COMBO').createdAt).toLocaleString() : 'N/A'}</div>
                </div>
                {target.type === 'PRODUCT' && target.data.reservedDraftId && (
                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                    <div style={{ color: '#c084fc', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>PACKED COMBO ID</div>
                    <div style={{ color: 'white', fontSize: '15px', fontFamily: 'monospace' }}>{target.data.reservedDraftId}</div>
                  </div>
                )}
              </div>

              {/* Adjustment Controls */}
              {target.type !== 'DRAFT' && canAdjust && (
                <div style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    <h3 style={{ margin: 0, color: '#ef4444', fontSize: '16px', fontWeight: 700 }}>Adjust Inventory</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <select 
                      value={adjustReason}
                      onChange={e => setAdjustReason(e.target.value)}
                      style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', color: 'white', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="DAMAGED">Mark as Damaged</option>
                      <option value="LOST">Mark as Lost</option>
                      <option value="EXPIRED">Mark as Expired</option>
                      <option value="ADJUSTMENT">Manual Adjustment</option>
                    </select>
                    <button 
                      onClick={handleAdjust}
                      disabled={isAdjusting}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0 24px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Apply Adjustment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {txs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No movement history found.</div>
              ) : (
                txs.map((tx, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', marginTop: '4px' }} />
                      {idx < txs.length - 1 && <div style={{ flex: 1, width: '2px', background: '#1e293b', margin: '4px 0' }} />}
                    </div>
                    <div style={{ flex: 1, background: '#1e293b', padding: '16px', borderRadius: '12px', marginBottom: idx < txs.length - 1 ? '0' : '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'white', fontWeight: 600 }}>{tx.fromLocation} → {tx.toLocation}</span>
                        <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {new Date(tx.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                        Type: {tx.referenceType} | Ref: {tx.referenceId}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {audits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No audit logs found.</div>
              ) : (
                audits.map((a, idx) => (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{a.action}</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>{a.details}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#c084fc', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>{a.userId}</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>{new Date(a.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}



        </div>
      </div>
    </div>
  );
};
