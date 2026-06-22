import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, ScanLine, ArrowRight } from 'lucide-react';
import { getProductTheme } from '../production/productHelpers';

const getProductFullName = (code: string) => {
  switch (code) {
    case '1B': return 'Blue Detergent';
    case '1Y': return 'Yellow Dishwash';
    case '1P': return 'Pink Conditioner';
    case '1S': return 'Sponge';
    default: return code;
  }
};

export const ComboScanner = () => {
  const navigate = useNavigate();
  const [scannedData, setScannedData] = useState<any>(null);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);

  useEffect(() => {
    let buffer = '';
    let timeout: any;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Enter') {
        if (buffer.length > 5) {
          e.preventDefault();
          e.stopPropagation();
          handleScan(buffer);
        }
        buffer = '';
      } else {
        if (e.key.length === 1) {
          buffer += e.key;
          clearTimeout(timeout);
          timeout = setTimeout(() => { buffer = ''; }, 100);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  const normalizeBarcode = (value: any) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[\r\n\t]/g, "");

  const handleScan = (scannedValue: string) => {
    const normalized = normalizeBarcode(scannedValue);
    
    const comboBarcodes = JSON.parse(localStorage.getItem('combo_barcodes') || '[]');
    const generatedBarcodes = JSON.parse(localStorage.getItem('combo_preview_barcodes') || '[]');
    

    const checkMatch = (b: any) => [
      b.barcode_no,
      b.barcodeNo,
      b.barcode,
      b.value,
      b.code,
      b.label_code
    ].some(v => v && normalizeBarcode(v) === normalized);

    const savedMatch = comboBarcodes.find(checkMatch);
    const previewMatch = generatedBarcodes.find(checkMatch);
    
    const match = savedMatch || previewMatch;
    
    
    if (match) {
      const batches = JSON.parse(localStorage.getItem('combo_batches') || '[]');
      const batch = batches.find((b: any) => b.id === match.batch_id);
      
      const movements = JSON.parse(localStorage.getItem('combo_movements') || '[]');
      const batchMovements = movements.filter((m: any) => m.batch_id === match.batch_id);
      
      const includesList = batchMovements.map((m: any) => m.product_name).filter(Boolean);
      const comboIncludes = includesList.join(' + ');

      setScannedData({
        ...match,
        combo_name: match.combo_name || batch?.combo_name || match.combo_code,
        combo_includes: comboIncludes || 'N/A',
        quantity: match.quantity || 1,
        created_at: match.created_at || batch?.created_at || new Date().toISOString(),
        status: savedMatch ? match.status : 'PREVIEW / NOT CONFIRMED'
      });
      setNotFoundCode(null);
    } else {
      setNotFoundCode(scannedValue);
      setScannedData(null);
    }
  };

  if (!scannedData && !notFoundCode) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      padding: '20px', animation: 'fadeIn 0.2s ease'
    }}>
      
      {notFoundCode && (
        <div style={{ background: '#111827', border: '1px solid #ef4444', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <AlertCircle size={32} color="#ef4444" />
          </div>
          <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '24px', fontWeight: 800 }}>Barcode Not Found</h2>
          <p style={{ margin: '0 0 24px 0', color: '#94a3b8', fontSize: '15px' }}>The scanned barcode <strong style={{ color: 'white' }}>{notFoundCode}</strong> does not exist in the combo database.</p>
          <button 
            onClick={() => setNotFoundCode(null)}
            style={{ width: '100%', background: '#1e293b', color: 'white', border: '1px solid #334155', padding: '12px', borderRadius: '12px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}

      {scannedData && (
        <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid #334155', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
          
          {/* HEADER */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: scannedData.type === 'COMBO_BOX' ? 'rgba(59, 130, 246, 0.1)' : getProductTheme(scannedData.product_code).bg, border: `1px solid ${scannedData.type === 'COMBO_BOX' ? 'rgba(59, 130, 246, 0.2)' : getProductTheme(scannedData.product_code).border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ScanLine size={28} color={scannedData.type === 'COMBO_BOX' ? '#3b82f6' : getProductTheme(scannedData.product_code).color} />
              </div>
              <div>
                <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 800 }}>
                  {scannedData.type === 'COMBO_BOX' ? 'Combo Box Details' : 'Combo Barcode Details'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                    {scannedData.type === 'COMBO_BOX' ? 'Full Pack' : getProductFullName(scannedData.product_code)}
                  </span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                    {scannedData.status}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => setScannedData(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
              <X size={24} />
            </button>
          </div>

          {/* BODY */}
          <div style={{ padding: '32px' }}>
            
            <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>Scanned Barcode</div>
              <div style={{ fontSize: '22px', color: '#3b82f6', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '1px' }}>{scannedData.barcode_no}</div>
            </div>

            {scannedData.type === 'COMBO_BOX' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Combo Name</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{scannedData.combo_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pack Quantity</div>
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: '15px' }}>{scannedData.combo_quantity} Packs</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Products Inside</div>
                  <div style={{ background: '#1e293b', borderRadius: '12px', padding: '16px' }}>
                    {scannedData.products_inside && Object.keys(scannedData.products_inside).map(code => (
                      <div key={code} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                        <span style={{ color: 'white' }}>{code} - {getProductFullName(code)}</span>
                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>x {scannedData.products_inside[code]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Combo Batch ID</div>
                  <div style={{ color: '#a78bfa', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{scannedData.batch_id || scannedData.combo_batch_id}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Created Date</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{new Date(scannedData.created_at || scannedData.createdAt || new Date()).toLocaleString('en-GB')}</div>
                </div>
                {scannedData.generatedBy && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Generated By</div>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{scannedData.generatedBy}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Product Code</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{scannedData.product_code}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Product Name</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{getProductFullName(scannedData.product_code)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Combo Name</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{scannedData.combo_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Combo Includes</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{scannedData.combo_includes}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pack No</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{scannedData.pack_no}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Quantity</div>
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: '15px' }}>{scannedData.quantity} Unit(s)</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Combo Batch ID</div>
                  <div style={{ color: '#a78bfa', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{scannedData.batch_id || scannedData.combo_batch_id}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Created Date</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{new Date(scannedData.created_at).toLocaleString('en-GB')}</div>
                </div>
              </div>
            )}

          </div>

          {/* FOOTER */}
          <div style={{ padding: '24px 32px', background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', gap: '16px' }}>
            <button 
              onClick={() => setScannedData(null)}
              style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid #334155', padding: '12px', borderRadius: '12px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
            >
              Close
            </button>
            <button 
              onClick={() => {
                navigate(`/inventory/combos/batch/${scannedData.batch_id}`);
                setScannedData(null);
              }}
              style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 600, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              View Combo Batch <ArrowRight size={18} />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
