import { useState, useEffect } from 'react';
import { Package, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { inventoryService } from '../../../services/inventoryService';

const StockManagement = () => {
  const [activeTab, setActiveTab] = useState<'stock' | 'batches'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      try {
        const [rm, b] = await Promise.all([
          inventoryService.getMaterials(),
          inventoryService.getBatches()
        ]);
        setRawMaterials(rm);
        setBatches(b);
      } catch (err) {
        console.error('Failed to load stock management data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStockData();
  }, []);

  if (loading) return <div>Loading...</div>;
  
  const materialMap = new Map(rawMaterials.map((m: any) => [m.id, m]));

  const currentStock = rawMaterials.map((material: any) => {
    const matBatches = batches.filter((b: any) => b.material_id === material.id && b.status !== 'Completed');
    const totalAvail = matBatches.reduce((acc: number, curr: any) => acc + curr.available_quantity, 0);
    const totalOrig = matBatches.reduce((acc: number, curr: any) => acc + curr.original_quantity, 0);
    const totalValue = matBatches.reduce((acc: number, curr: any) => acc + (curr.available_quantity * curr.price_per_kg), 0);
    return { ...material, totalAvail, totalOrig, totalValue, batchCount: matBatches.length };
  }).filter((s: any) => s.totalAvail > 0);

  const totalStockValue = currentStock.reduce((acc: number, curr: any) => acc + curr.totalValue, 0);
  const totalStockKg = currentStock.reduce((acc: number, curr: any) => acc + curr.totalAvail, 0);
  const activeBatchCount = batches.filter((b: any) => b.status === 'Active' || b.status === 'Low Stock').length;

  const exportExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Active': return 'badge-success';
      case 'Low Stock': return 'badge-warning';
      case 'Completed': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  const filteredBatches = batches.filter((b: any) => {
    const mat = materialMap.get(b.material_id);
    const searchString = `${b.batch_id} ${b.vendor_name} ${mat?.name}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Stock & Batches</h1>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '24px' }}>
        <div className="page-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Total Global Stock</span>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{totalStockKg.toLocaleString()} <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>KG</span></div>
        </div>
        
        <div className="page-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Total Inventory Value</span>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>₹{totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>

        <div className="page-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--surface-soft)', borderColor: 'var(--primary)' }}>
          <span style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Active Batch Nodes</span>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>{activeBatchCount}</div>
        </div>
      </div>

      <div className="page-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-soft)', padding: '4px', borderRadius: '8px' }}>
            <button 
              style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'stock' ? 'var(--surface)' : 'transparent', color: activeTab === 'stock' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: activeTab === 'stock' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              onClick={() => setActiveTab('stock')}
            >
              Current Stock Overview
            </button>
            <button 
              style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: activeTab === 'batches' ? 'var(--surface)' : 'transparent', color: activeTab === 'batches' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: activeTab === 'batches' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              onClick={() => setActiveTab('batches')}
            >
              Batch Management
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            {activeTab === 'batches' && (
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search Batches..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '36px', height: '36px' }} />
              </div>
            )}
            <button className="btn btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '13px' }} onClick={() => exportExcel(activeTab === 'stock' ? currentStock : batches, activeTab === 'stock' ? 'Stock_Report' : 'Batch_Report')}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="table-responsive">
          {activeTab === 'stock' && (
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Total Available</th>
                  <th>Original Capacity</th>
                  <th>Active Batches</th>
                  <th style={{ textAlign: 'right' }}>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {currentStock.map((item: any) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--surface-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16}/></div>
                      {item.name}
                    </td>
                    <td><span className="badge badge-neutral">{item.category}</span></td>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{item.totalAvail.toFixed(2)} {item.unit}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.totalOrig.toFixed(2)} {item.unit}</td>
                    <td>{item.batchCount}</td>
                    <td style={{ fontWeight: 'bold', textAlign: 'right' }}>₹{item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {currentStock.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>No stock currently available in the warehouse.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'batches' && (
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Material</th>
                  <th>Vendor</th>
                  <th>Original Qty</th>
                  <th>Available Qty</th>
                  <th style={{ textAlign: 'right' }}>Price Per KG</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((b: any) => {
                  const material = materialMap.get(b.material_id);
                  const isDepleted = b.available_quantity === 0;
                  return (
                    <tr key={b.id} style={{ opacity: isDepleted ? 0.6 : 1, background: isDepleted ? 'var(--bg)' : 'transparent' }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>{b.batch_id}</td>
                      <td style={{ fontWeight: 'bold' }}>{material?.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.vendor_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{b.original_quantity.toFixed(2)}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{b.available_quantity.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{b.price_per_kg.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}><span className={`badge ${getStatusBadge(b.status)}`}>{b.status}</span></td>
                    </tr>
                  );
                })}
                {filteredBatches.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>No batches match the search criteria.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockManagement;
