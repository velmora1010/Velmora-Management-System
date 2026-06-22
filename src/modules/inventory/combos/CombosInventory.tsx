import { useState, useEffect } from 'react';
import { inventoryService } from '../../../services/inventoryService';
import { Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export const CombosInventory = () => {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getComboInventory();
      // Sort newest first
      setInventory(data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading combo inventory...</div>;

  const handleDeleteCombo = async () => {
    if (!comboToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await inventoryService.deleteComboBatch(comboToDelete.batch_id);
      setDeleteModalOpen(false);
      setComboToDelete(null);
      await loadData();
      toast.success("Combo Deleted Successfully\n\nFinished goods inventory restored.");
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete combo');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeInventory = inventory.filter(i => i.status !== 'DELETED');

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: 'white', fontWeight: 800 }}>Combo Inventory</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Current stock of bundled combos ready for dispatch.</p>
      </div>

      <div className="page-card" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '20px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0b1120', borderBottom: '1px solid #1e293b' }}>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Batch ID</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Combo Name</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Available Units</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Created Date</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeInventory.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No combos in inventory</td>
              </tr>
            ) : (
              activeInventory.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '16px 24px', color: '#60a5fa', fontFamily: 'monospace' }}>{item.batch_id}</td>
                  <td style={{ padding: '16px 24px', color: 'white', fontWeight: 600 }}>{item.combo_name}</td>
                  <td style={{ padding: '16px 24px', color: 'white', fontWeight: 'bold' }}>{item.units}</td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ padding: '4px 8px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '11px', fontWeight: 800, borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      IN STOCK
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button 
                      className="hover-lift"
                      onClick={() => { setComboToDelete({ ...item, total_units: item.units }); setDeleteModalOpen(true); }}
                      style={{ 
                        width: '32px', height: '32px', borderRadius: '50%', background: '#1e293b', 
                        border: '1px solid #334155', color: '#94a3b8', display: 'inline-flex', 
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.boxShadow = 'none'; }}
                      title="Delete Combo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CONFIRMATION MODAL */}
      {deleteModalOpen && comboToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeleteModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ width: '450px', background: 'rgba(17, 24, 39, 0.8)', backdropFilter: 'blur(16px)', border: '1px solid #374151', borderRadius: '24px', padding: '32px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '24px', color: 'white' }}>Delete Combo Batch</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px' }}>Please confirm you want to delete this combo.</p>

            <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Combo Name</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{comboToDelete.combo_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Batch ID</span>
                <span style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{comboToDelete.batch_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total Packs</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{comboToDelete.total_units}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Created Date</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{new Date(comboToDelete.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Status</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{comboToDelete.status || 'READY'}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '24px' }}>
              <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Warning:</div>
              <div style={{ color: '#fca5a5', fontSize: '14px', lineHeight: '1.5' }}>
                Deleting this combo will:<br/><br/>
                • Remove combo inventory<br/>
                • Restore consumed finished goods<br/>
                • Mark combo batch as deleted<br/><br/>
                This action can be reversed later by administrators.
              </div>
            </div>

            {deleteError && (
              <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '24px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn hover-lift" 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', border: '1px solid #334155', color: 'white', fontWeight: 600 }}
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn hover-lift" 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleDeleteCombo}
                disabled={isDeleting}
              >
                <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Combo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
