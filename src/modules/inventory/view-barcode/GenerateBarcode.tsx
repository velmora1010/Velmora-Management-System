import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download, Search, QrCode, Copy } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const GenerateBarcode = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('Newest');

  useEffect(() => {
    const fetchDropdownData = async () => {
      setLoading(true);
      try {
        const [b, m] = await Promise.all([
          inventoryService.getBatches(),
          inventoryService.getMaterials()
        ]);
        setBatches(b);
        setMaterials(m);
      } catch (err) {
        console.error('Failed to load generate barcode dropdowns locally', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDropdownData();
  }, []);

  const materialMap = new Map(materials.map((m: any) => [m.id, m]));
  const uniqueMaterials = Array.from(new Set(materials.map(m => m.name)));

  let filteredBatches = batches.filter((b: any) => {
    const mat = materialMap.get(b.material_id);
    const searchString = `${b.batch_id} ${b.vendor_name} ${mat?.name}`.toLowerCase();
    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    const matchesMaterial = materialFilter === 'All' || mat?.name === materialFilter;
    
    return matchesSearch && matchesMaterial;
  });

  if (sortOrder === 'Quantity High-Low') {
    filteredBatches.sort((a, b) => b.original_quantity - a.original_quantity);
  } else if (sortOrder === 'Quantity Low-High') {
    filteredBatches.sort((a, b) => a.original_quantity - b.original_quantity);
  } else {
    // Newest
    filteredBatches.sort((a, b) => new Date(b.created_at || 0).getTime() > new Date(a.created_at || 0).getTime() ? -1 : 1);
  }
  
  const downloadQR = (batchId: string) => {
    const svg = document.getElementById(`qr-${batchId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR-${batchId}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const printQR = (batchId: string) => {
    const w = window.open();
    w?.document.write(`
      <html>
        <head><title>Print QR</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
          <img src="${document.getElementById(`qr-${batchId}`)?.querySelector('canvas')?.toDataURL() || ''}" />
        </body>
      </html>
    `);
    setTimeout(() => w?.print(), 500);
  };

  const getCategoryColor = (cat: string) => {
    if (!cat) return '#3b82f6';
    const l = cat.toLowerCase();
    if (l.includes('surfactant')) return '#3b82f6'; // Blue
    if (l.includes('conditioning')) return '#10b981'; // Green
    if (l.includes('preservative')) return '#ec4899'; // Pink
    if (l.includes('color')) return '#a855f7'; // Purple
    if (l.includes('fragrance')) return '#f59e0b'; // Amber
    if (l.includes('water')) return '#06b6d4'; // Cyan
    return '#3b82f6';
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading QR codes...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ paddingBottom: '64px' }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 20px;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
        }
      `}</style>

      {/* HEADER */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: '0 0 8px 0', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <QrCode size={28} style={{ color: '#3b82f6' }} />
            Generate QR Codes
          </h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>Generate and manage QR labels for raw material batches.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 16px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(8px)' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Total QR Codes</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{batches.length}</span>
          </div>
          <div style={{ padding: '8px 16px', background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(8px)' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Visible QR Codes</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{filteredBatches.length}</span>
          </div>
          <button 
            onClick={() => window.print()}
            style={{ padding: '8px 16px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(255,255,255,0.1)' }}
          >
            <Printer size={16} /> Print Visible
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="no-print" style={{ position: 'sticky', top: '0', zIndex: 20, background: 'rgba(7, 11, 18, 0.95)', backdropFilter: 'blur(12px)', padding: '16px 0', borderBottom: '1px solid #263244', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input 
            type="text" 
            placeholder="Search batch, material, vendor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '44px', paddingRight: '16px', height: '44px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#263244'}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={materialFilter} 
            onChange={(e) => setMaterialFilter(e.target.value)}
            style={{ height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="All">All Materials</option>
            {uniqueMaterials.map((m: any) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #263244', background: '#111827', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="Newest">Newest First</option>
            <option value="Quantity High-Low">Quantity: High to Low</option>
            <option value="Quantity Low-High">Quantity: Low to High</option>
          </select>
        </div>
      </div>

      {/* QR GRID */}
      <div id="print-area" className="print-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {filteredBatches.map((b) => {
          const material = materialMap.get(b.material_id);
          const accentColor = getCategoryColor(material?.category);
          const generatedBarcode = `MAT-${new Date(b.created_at || Date.now()).toISOString().split('T')[0].replace(/-/g, '')}-${material?.code || 'XX'}-${b.batch_number || '001'}`;

          return (
            <motion.div 
              whileHover={{ y: -4 }}
              key={b.id} 
              className="print-card"
              style={{ 
                background: '#111827', 
                borderRadius: '18px', 
                border: '1px solid #263244', 
                borderLeft: `4px solid ${accentColor}`,
                overflow: 'hidden',
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 10px 30px -5px ${accentColor}40`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.2)'}
            >
              {/* Top Section */}
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <QRCodeSVG id={`qr-${b.batch_id}`} value={JSON.stringify({ batchId: b.batch_id, productId: b.material_id })} size={140} level="H" includeMargin={false} />
                </div>
                
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Material Name</div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: 'white', fontWeight: 800 }}>{material?.name || 'Unknown Material'}</h3>
                  
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Batch ID</div>
                  <div style={{ fontSize: '14px', color: 'white', fontWeight: 600, marginBottom: '12px' }}>#{b.batch_id}</div>

                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Barcode Number</div>
                  <div style={{ fontSize: '13px', color: accentColor, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{generatedBarcode}</div>
                </div>
              </div>

              {/* Middle Section */}
              <div style={{ padding: '20px', display: 'flex', gap: '12px', borderBottom: '1px solid #1e293b', background: '#070b12' }}>
                <div style={{ flex: 1, padding: '10px', background: '#111827', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Quantity</div>
                  <div style={{ fontSize: '14px', color: 'white', fontWeight: 700 }}>{b.original_quantity} KG</div>
                </div>
                <div style={{ flex: 1, padding: '10px', background: '#111827', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Vendor</div>
                  <div style={{ fontSize: '14px', color: 'white', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.vendor_name || '-'}</div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="no-print" style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => downloadQR(b.batch_id)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'transparent', border: '1px solid #263244', color: 'white', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Download size={14} /> Download
                </button>
                <button 
                  onClick={() => printQR(b.batch_id)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#1e293b', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                  onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
                >
                  <Printer size={14} /> Print
                </button>
                <button 
                  onClick={() => { navigator.clipboard.writeText(generatedBarcode); toast.success('Copied!'); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredBatches.length === 0 && (
        <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#111827', padding: '24px', borderRadius: '50%', border: '1px solid #263244' }}>
            <QrCode size={48} color="#64748b" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '20px' }}>No QR Codes Found</h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px' }}>Try changing your search or filters.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default GenerateBarcode;
