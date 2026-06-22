import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Layers, PackageCheck, Boxes, ArrowRight, Activity, Trash2, AlertTriangle, Barcode, Box } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export const CombosDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comboBoxes, setComboBoxes] = useState<any[]>([]);
  const [boxDetailsModalOpen, setBoxDetailsModalOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<any>(null);
  const [barcodes, setBarcodes] = useState<any[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [boxToDelete, setBoxToDelete] = useState<any>(null);
  const [deleteBoxModalOpen, setDeleteBoxModalOpen] = useState(false);

  // Order Allocation State
  

  // Dispatch State
  

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batches, bcs] = await Promise.all([
        (inventoryService as any).getComboBoxes(),
        inventoryService.getAllComboBarcodes()
      ]);
      const sorted = batches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setComboBoxes(sorted);
      setBarcodes(bcs || []);
    } catch (err) {
      console.error('Failed to load combos', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading combo data...</div>;

  const activeBatches = comboBoxes || [];
  const totalCombos = activeBatches.length;
  const comboUnits = activeBatches.length;
  const readyCombos = activeBatches.filter(b => b.status === 'READY' || b.status === 'ACTIVE' || !b.status).length;
  
  const totalBoxBarcodes = barcodes.filter(b => b.type === 'COMBO_BOX').length;
  const totalProductBarcodes = barcodes.filter(b => b.type === 'PRODUCT').length;
  
  const recentBoxes = (comboBoxes || []).slice(0, 8);

  const handleDeleteCombo = async () => {
    if (!comboToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await inventoryService.deleteComboBatch(comboToDelete.id);
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

  const handleSelectAllBoxes = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBoxes(recentBoxes.map((b: any) => b.comboBoxBarcode));
    } else {
      setSelectedBoxes([]);
    }
  };

  const handleSelectOneBox = (barcode: string) => {
    setSelectedBoxes(prev => prev.includes(barcode) ? prev.filter(b => b !== barcode) : [...prev, barcode]);
  };

  const handleDeleteBoxConfirm = async () => {
    if (!boxToDelete) return;
    try {
      await (inventoryService as any).deleteComboBox(boxToDelete.comboBoxBarcode);
      toast.success('Combo box deleted successfully');
      setDeleteBoxModalOpen(false);
      setBoxToDelete(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete combo box');
    }
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      await (inventoryService as any).deleteComboBoxesBulk(selectedBoxes);
      toast.success('Selected combo boxes deleted successfully');
      setIsBulkDeleteOpen(false);
      setSelectedBoxes([]);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete selected combo boxes');
    }
  };

  

  

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: 'white', fontWeight: 800 }}>Combo Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Overview of bundled products and combo manufacturing.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#ef4444' }} /> Show Deleted Combos
          </label>
          <button className="btn btn-primary hover-lift shadow-glow" onClick={() => navigate('/inventory/combos/create')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} /> Create Combo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '32px', gap: '16px' }}>
        <div className="page-card hover-lift" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Combo Batches</div>
            <div style={{ fontSize: '24px', color: 'white', fontWeight: 800 }}>{totalCombos}</div>
          </div>
        </div>

        <div className="page-card hover-lift" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PackageCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Total Units</div>
            <div style={{ fontSize: '24px', color: 'white', fontWeight: 800 }}>{comboUnits}</div>
          </div>
        </div>

        <div className="page-card hover-lift" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Box size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Box Barcodes</div>
            <div style={{ fontSize: '24px', color: 'white', fontWeight: 800 }}>{totalBoxBarcodes}</div>
          </div>
        </div>

        <div className="page-card hover-lift" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Barcode size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Product Barcodes</div>
            <div style={{ fontSize: '24px', color: 'white', fontWeight: 800 }}>{totalProductBarcodes}</div>
          </div>
        </div>

        <div className="page-card hover-lift" style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Ready Combos</div>
            <div style={{ fontSize: '24px', color: 'white', fontWeight: 800 }}>{readyCombos}</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#64748b" /> Recent Combo Boxes
        </h2>
        {recentBoxes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={recentBoxes.length > 0 && selectedBoxes.length === recentBoxes.length}
                onChange={handleSelectAllBoxes}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Select All</span>
            </label>
            {selectedBoxes.length > 0 && (
              <button
                onClick={() => setIsBulkDeleteOpen(true)}
                style={{ height: '36px', padding: '0 16px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Delete Selected ({selectedBoxes.length})
              </button>
            )}
          </div>
        )}
      </div>

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
              style={{ background: '#111827', border: '1px solid #263244', borderRadius: '16px', padding: '24px', cursor: 'pointer', position: 'relative' }}
              onClick={() => { setSelectedBox(box); setBoxDetailsModalOpen(true); }}
            >
              <div style={{ position: 'absolute', top: '24px', left: '24px' }} onClick={e => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={selectedBoxes.includes(box.comboBoxBarcode)}
                  onChange={() => handleSelectOneBox(box.comboBoxBarcode)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingLeft: '32px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '18px', fontWeight: 700 }}>{box.comboName}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{box.comboBoxBarcode}</div>
                </div>
                <div style={{ padding: '4px 8px', background: box.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : box.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: box.status === 'READY' ? '#34d399' : box.status === 'PARTIAL' ? '#f59e0b' : '#60a5fa', fontSize: '11px', fontWeight: 800, borderRadius: '8px', border: `1px solid ${box.status === 'READY' ? 'rgba(16, 185, 129, 0.2)' : box.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}` }}>
                   {box.status}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Packed</div>
                  <div style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>{box.packedItems?.length || 0} items</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setBoxToDelete(box); setDeleteBoxModalOpen(true); }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontSize: '13px', fontWeight: 600 }}>
                    View Details <ArrowRight size={14} />
                  </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Packed By</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{selectedBox.packedBy}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Generated By</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{selectedBox.generatedBy || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Generated At</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{selectedBox.generatedAt ? new Date(selectedBox.generatedAt).toLocaleString() : '-'}</span>
                </div>
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
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace', marginBottom: '4px' }}>Product Code: {code}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>Barcode: {item.displayBarcode || item.sourceBarcode || item.barcodeNumber || item.barcode || item.serial_number || item.barcode_no || '-'}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Micro Batch</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{item.batchNo || item.batch_number || item.microBatch || '-'}</span></div>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Produced By</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{item.producedBy || '-'}</span></div>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Added By</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{item.addedBy || item.packedBy || item.comboAddedBy || '-'}</span></div>
                            <div><span style={{color:'var(--text-muted)', fontSize:'11px', display:'block'}}>Added At</span><span style={{color:'white', fontSize:'12px', fontWeight:600}}>{(item.addedAt || item.packedAt) ? new Date(item.addedAt || item.packedAt).toLocaleString() : '-'}</span></div>
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', color: '#cbd5e1', fontSize: '12px', fontWeight: 600 }}>
                          Qty: {item.quantity || 1}
                        </div>
                      </div>
                    )
                 })}
               </div>
             )}

             <h3 style={{ fontSize: '16px', color: 'white', marginTop: '24px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Inventory History</h3>
             <div style={{ background: '#0f172a', borderRadius: '16px', padding: '20px', border: '1px solid #1e293b' }}>
                <div style={{ marginBottom: '16px' }}>
                   <div style={{ color: 'white', fontWeight: 600, marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedBox.comboInventoryInPersonName ? '#10b981' : '#64748b' }}></span>
                     Inventory IN
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Scanned By</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedBox.comboInventoryInPersonName || '-'}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Date & Time</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedBox.comboInventoryInAt ? new Date(selectedBox.comboInventoryInAt).toLocaleString() : '-'}</span>
                   </div>
                </div>
                <div style={{ paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
                   <div style={{ color: 'white', fontWeight: 600, marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedBox.comboInventoryOutPersonName ? '#ef4444' : '#64748b' }}></span>
                     Inventory OUT
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Scanned By</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedBox.comboInventoryOutPersonName || '-'}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '16px' }}>
                     <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Date & Time</span>
                     <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{selectedBox.comboInventoryOutAt ? new Date(selectedBox.comboInventoryOutAt).toLocaleString() : '-'}</span>
                   </div>
                </div>
             </div>
             
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

      <ConfirmModal
        isOpen={deleteBoxModalOpen}
        title="Delete this combo box?"
        message="This action will permanently remove this combo box. Any packed products will be safely returned to PRODUCT_OUT status so you don't lose them."
        confirmText="Delete"
        onConfirm={handleDeleteBoxConfirm}
        onClose={() => setDeleteBoxModalOpen(false)}
      />

      <ConfirmModal
        isOpen={isBulkDeleteOpen}
        title="Delete Selected Combo Boxes?"
        message={`This action will permanently remove ${selectedBoxes.length} selected combo box(es). All packed products will be returned to stock safely.`}
        confirmText="Delete"
        onConfirm={handleBulkDeleteConfirm}
        onClose={() => setIsBulkDeleteOpen(false)}
      />

    </div>
  );
};
