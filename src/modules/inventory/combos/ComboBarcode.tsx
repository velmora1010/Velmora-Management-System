import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Download, Save, Layers, ArrowLeft } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import toast from 'react-hot-toast';

export const ComboBarcode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const batches = await inventoryService.getComboBatches();
      const currentBatch = batches.find((b: any) => b.id === id);
      setBatch(currentBatch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!batch || isSaving) return;
    setIsSaving(true);
    try {
      const barcodeData = {
        batch_id: batch.id,
        combo_name: batch.combo_name,
        total_units: batch.total_units,
        barcode: `${batch.batch_id}-BAR`,
        type: 'COMBO_PACK'
      };
      
      await inventoryService.saveComboBarcode(barcodeData);
      
      // Navigate to inventory
      navigate('/inventory/combos/inventory');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save barcode');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!batch) return <div style={{ padding: '48px', textAlign: 'center', color: '#ef4444' }}>Batch not found.</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <button 
        className="btn btn-secondary hover-lift" 
        style={{ marginBottom: '24px', padding: '8px 16px', fontSize: '14px', borderRadius: '12px', background: 'var(--surface-soft)', color: 'var(--text-primary)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '8px' }} 
        onClick={() => navigate('/inventory/combos/dashboard')}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: 'white', fontWeight: 800 }}>Combo Barcode</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Generate and print labels for combo packages.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        {/* Label Preview */}
        <div 
          style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '32px', 
            width: '100%', 
            maxWidth: '450px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            color: 'black'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
            <div style={{ background: '#3b82f6', color: 'white', padding: '8px', borderRadius: '8px' }}>
              <Layers size={24} />
            </div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>VELMORA COMBO</h2>
          </div>

          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>{batch.combo_name}</div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>ID: {batch.batch_id}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Quantity</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{batch.total_units} PACKS</div>
            </div>
            <div style={{ width: '2px', background: '#e2e8f0' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Date</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {new Date(batch.created_at).toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>

          {/* Fake Barcode Graphic */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '100%', height: '80px', 
              background: 'repeating-linear-gradient(90deg, #000, #000 3px, transparent 3px, transparent 6px, #000 6px, #000 12px, transparent 12px, transparent 14px)',
              borderRadius: '4px'
            }} />
            <div style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 800, letterSpacing: '2px', color: '#334155' }}>
              {batch.batch_id}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button 
            className="btn btn-secondary hover-lift" 
            style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', color: 'white', border: '1px solid var(--border)' }}
            onClick={() => window.print()}
          >
            <Printer size={18} /> Print Label
          </button>
          <button 
            className="btn btn-secondary hover-lift" 
            style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', color: 'white', border: '1px solid var(--border)' }}
            onClick={() => toast.success('Download starting...')}
          >
            <Download size={18} /> Download
          </button>
          <button 
            className="btn btn-primary hover-lift shadow-glow" 
            style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={isSaving}
            onClick={handleSave}
          >
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Combo Barcode'}
          </button>
        </div>
      </div>
    </div>
  );
};
