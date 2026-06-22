import { useNavigate } from 'react-router-dom';
import { useIntakeContext } from './IntakeContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Home, PackagePlus, Boxes } from 'lucide-react';
import db from '../../../../lib/db';

const IntakeStep4_Success = () => {
  const navigate = useNavigate();
  const { clearIntakeSession } = useIntakeContext();

  // Load the most recently added inventory_in record
  const latestInventory = useLiveQuery(async () => {
    const records = await db.inventory_in.orderBy('id').reverse().limit(1).toArray();
    return records[0] || null;
  });

  // Load all batches associated with the latest inventory record
  const savedBatches = useLiveQuery(async () => {
    if (!latestInventory?.id) return [];
    return await db.batches.where('inventory_in_id').equals(latestInventory.id).toArray();
  }, [latestInventory?.id]);

  const handleFinish = (path: string) => {
    clearIntakeSession();
    navigate(path);
  };

  if (latestInventory === undefined || savedBatches === undefined) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading saved records...</div>;
  }

  if (latestInventory === null) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No recent inventory records found.</p>
        <button className="btn btn-primary" onClick={() => handleFinish('/inventory/raw-material')}>Go to Intake</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
      <div className="page-card" style={{ textAlign: 'center', padding: '64px 20px', marginTop: '24px' }}>
        <CheckCircle2 size={64} style={{ color: 'var(--success-text)', margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '28px', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Stock Saved Successfully!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '16px' }}>
          Inventory has been recorded and <b>{savedBatches.length} batches</b> have been generated for <b>{latestInventory.material_name}</b>.
        </p>
        <p style={{ color: 'var(--primary)', marginBottom: '40px', fontSize: '18px', fontWeight: 500 }}>
          Stock saved successfully. Go to Inventory Room to view saved stock.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => handleFinish('/inventory/inventory-room')} style={{ padding: '0 24px', height: '48px' }}>
            <Boxes size={18} /> Go to Inventory Room
          </button>
          <button className="btn btn-secondary" onClick={() => handleFinish('/inventory/raw-material')} style={{ padding: '0 24px', height: '48px' }}>
            <PackagePlus size={18} /> Receive Another Raw Material
          </button>
          <button className="btn btn-secondary" onClick={() => handleFinish('/')} style={{ padding: '0 24px', height: '48px' }}>
            <Home size={18} /> Home
          </button>
        </div>
      </div>

    </div>
  );
};

export default IntakeStep4_Success;
