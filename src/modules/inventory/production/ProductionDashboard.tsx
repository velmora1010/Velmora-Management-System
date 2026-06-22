import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Archive, QrCode, ClipboardList, Factory, ArrowRight, Trash2, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import { motion } from 'framer-motion';
import { getProductDisplayName, getProductTheme } from './productHelpers';

const ProductionDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'All' | 'In Progress' | 'Complete'>('All');
  
  const [productionBatches, setProductionBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const fetchProductionBatches = async () => {
      setLoading(true);
      try {
        const data = await inventoryService.getProductionBatches();
        // Sort by created_at descending locally
        data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setProductionBatches(data);
      } catch (err) {
        console.error('Failed to load production batches locally', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProductionBatches();
  }, []);
  
  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading production data...</div>;

  const activeBatches = productionBatches.filter((b: any) => b.status !== 'DELETED');
  const inProgressCount = activeBatches.filter((b: any) => b.status === 'Prep' || b.status === 'In Progress').length;
  const completedCount = activeBatches.filter((b: any) => b.status === 'Complete' || b.status === 'COMPLETE' || b.status === 'Saved').length;
  const totalProduced = activeBatches.reduce((sum: number, b: any) => sum + (b.produced_units || 0), 0);
  const inInventory = activeBatches.reduce((sum: number, b: any) => sum + (b.inventory_units || 0), 0);

  const filteredBatches = productionBatches.filter((b: any) => {
    if (!showDeleted && b.status === 'DELETED') return false;
    if (showDeleted && activeTab === 'All') return true;
    if (activeTab === 'All') return b.status !== 'DELETED';
    if (activeTab === 'Complete') return b.status === 'Complete' || b.status === 'COMPLETE' || b.status === 'Saved';
    return b.status === 'Prep' || b.status === 'In Progress';
  });

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await inventoryService.deleteProductionBatch(batchToDelete.id);
      setDeleteModalOpen(false);
      setBatchToDelete(null);
      // Re-fetch batches
      const data = await inventoryService.getProductionBatches();
      data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setProductionBatches(data);
      setToastMessage('Batch deleted successfully');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete batch');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-container"
    >
      {/* PREMIUM HEADER */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', background: 'linear-gradient(to right, #ffffff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Production Dashboard
          </h1>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>
            Manage production lines, batches and micro-batches.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary hover-lift" 
            style={{ color: '#94a3b8', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid #334155', borderRadius: '12px', padding: '10px 20px', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}
            onClick={() => navigate('/inventory/combos/create')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.boxShadow = '0 0 12px rgba(139, 92, 246, 0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <Layers size={18} /> Create Combo
          </button>
          <button 
            className="btn btn-primary hover-lift" 
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: 'none', borderRadius: '12px', padding: '10px 24px', fontWeight: 600, color: 'white', display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)' }} 
            onClick={() => navigate('/inventory/production/new')}
          >
            <Plus size={18} /> Add Batch
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-4" style={{ marginBottom: '40px' }}>
        {[
          { title: 'Batches Done', count: completedCount, icon: <ClipboardList size={24} />, color: '#10b981', desc: 'Successfully completed' },
          { title: 'In Progress', count: inProgressCount, icon: <Factory size={24} />, color: '#f59e0b', desc: 'Currently running' },
          { title: 'Total Produced', count: totalProduced, icon: <Archive size={24} />, color: '#8b5cf6', desc: 'Total units made' },
          { title: 'In Inventory', count: inInventory, icon: <QrCode size={24} />, color: '#3b82f6', desc: 'Stocked in room' }
        ].map((kpi, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="page-card hover-lift" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '20px', 
              padding: '24px', 
              background: '#111827', 
              borderRadius: '20px', 
              border: '1px solid #263244',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'default'
            }}
          >
            {/* Soft Glow Background */}
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: `${kpi.color}15`, filter: 'blur(30px)', borderRadius: '50%' }} />
            
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: `${kpi.color}15`, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${kpi.color}30` }}>
              {kpi.icon}
            </div>
            <div style={{ zIndex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{kpi.title}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', lineHeight: '1.2' }}>{kpi.count}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{kpi.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* PREMIUM TABS & TOGGLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '12px', background: '#111827', padding: '6px', borderRadius: '16px', width: 'fit-content', border: '1px solid #263244' }}>
          {['All', 'In Progress', 'Complete'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{ 
                background: activeTab === tab ? 'linear-gradient(to right, #3b82f6, #8b5cf6)' : 'transparent', 
                border: 'none', 
                padding: '10px 24px', 
                borderRadius: '12px',
                fontSize: '14px', 
                fontWeight: 600, 
                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: activeTab === tab ? '0 4px 12px rgba(139, 92, 246, 0.25)' : 'none'
              }}
            >
              {tab === 'All' ? 'All Batches' : tab}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#ef4444' }} /> Show Deleted Batches
        </label>
      </div>

      <div className="grid grid-2">
        {filteredBatches.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="page-card" 
            style={{ 
              gridColumn: '1 / -1', 
              textAlign: 'center', 
              padding: '64px 20px', 
              background: '#111827', 
              borderRadius: '24px', 
              border: '1px dashed #263244',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px'
            }}
          >
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Factory size={40} opacity={0.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'white', margin: '0 0 8px 0' }}>No production batches yet</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '400px' }}>Start your first production batch to track output and inventory.</p>
            </div>
            <button 
              className="btn btn-primary hover-lift" 
              style={{ marginTop: '16px', background: '#f97316', border: 'none', borderRadius: '12px', padding: '12px 32px', fontWeight: 600, color: 'white' }} 
              onClick={() => navigate('/inventory/production/new')}
            >
              Add Batch
            </button>
          </motion.div>
        ) : (
          filteredBatches.map((batch: any, i) => {
            const progress = batch.total_micro_batches > 0 ? Math.round((batch.completed_micro_batches / batch.total_micro_batches) * 100) : 0;
            const isComplete = batch.status === 'Complete' || batch.status === 'COMPLETE' || batch.status === 'Saved';
            const isDeleted = batch.status === 'DELETED';
            const statusColor = isDeleted ? '#ef4444' : isComplete ? '#10b981' : batch.status === 'Prep' ? '#f59e0b' : '#3b82f6';
            const theme = getProductTheme(batch.product_name);
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={batch.id} 
                className="page-card hover-lift" 
                style={{ 
                  padding: '24px', 
                  background: '#111827', 
                  borderRadius: '20px', 
                  border: '1px solid #263244',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Accent Top Border */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: statusColor, opacity: 0.8 }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <span style={{ padding: '6px 10px', borderRadius: '8px', background: theme.bg, color: theme.color, fontWeight: 800, fontSize: '18px', border: `1px solid ${theme.border}` }}>
                        {getProductDisplayName(batch.product_name)}
                      </span>
                      <span style={{ 
                        fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px',
                        background: `${statusColor}20`, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.5px',
                        border: `1px solid ${statusColor}30`
                      }}>
                        {batch.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: 'var(--surface-soft)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {batch.production_batch_id}
                      </span>
                      <span>•</span>
                      <span>{new Date(batch.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'right', background: 'var(--surface-soft)', padding: '8px 16px', borderRadius: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Batch Size</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{batch.total_units} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Units</span></div>
                    </div>
                    {!isDeleted && (
                      <button 
                        className="hover-lift"
                        onClick={() => { setBatchToDelete(batch); setDeleteModalOpen(true); }}
                        style={{ 
                          width: '36px', height: '36px', borderRadius: '50%', background: '#1e293b', 
                          border: '1px solid #334155', color: '#94a3b8', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' 
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.boxShadow = 'none'; }}
                        title="Delete Batch"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #1f2937' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Micro Batch Progress</span>
                    <span style={{ fontWeight: 'bold', color: 'white' }}>{batch.completed_micro_batches} / {batch.total_micro_batches} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({progress}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#1f2937', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: isComplete ? '#10b981' : 'linear-gradient(to right, #3b82f6, #8b5cf6)', transition: 'width 0.5s ease-out', borderRadius: '4px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Produced</span>
                      <strong style={{ color: 'white', fontSize: '16px' }}>{batch.produced_units}</strong>
                    </div>
                    <div style={{ width: '1px', background: '#263244' }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Inventory</span>
                      <strong style={{ color: 'white', fontSize: '16px' }}>{batch.inventory_units}</strong>
                    </div>
                  </div>
                  <button 
                    className="btn btn-secondary hover-lift" 
                    onClick={() => navigate(`/inventory/production/batch/${batch.id}`)} 
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'white',
                      color: 'black',
                      fontWeight: 600,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    Open <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {deleteModalOpen && batchToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeleteModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ width: '450px', background: 'rgba(17, 24, 39, 0.8)', backdropFilter: 'blur(16px)', border: '1px solid #374151', borderRadius: '24px', padding: '32px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '24px', color: 'white' }}>Delete Production Batch</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px' }}>Please confirm you want to delete this batch.</p>

            <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Batch ID</span>
                <span style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{batchToDelete.production_batch_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Product</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{getProductDisplayName(batchToDelete.product_name)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Batch Size</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{batchToDelete.total_units} Units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Status</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{batchToDelete.status}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '24px' }}>
              <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Warning:</div>
              <div style={{ color: '#fca5a5', fontSize: '14px', lineHeight: '1.5' }}>
                {batchToDelete.status === 'Saved' ? 'Deleting this batch will permanently remove all production records and hide it from the dashboard.' : ''}
                {(batchToDelete.status === 'Prep' || batchToDelete.status === 'In Progress') ? 'Deleting this batch will permanently remove production records and restore allocated raw materials to inventory.' : ''}
                {batchToDelete.status === 'Complete' ? 'Deleting this batch will permanently remove production records and reverse finished goods from the Inventory Room. If units were used in Combos, deletion will be blocked.' : ''}
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
                style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleDeleteBatch}
                disabled={isDeleting}
              >
                <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontWeight: 600,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}
    </motion.div>
  );
};

export default ProductionDashboard;
