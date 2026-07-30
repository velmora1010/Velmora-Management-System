import { useState, useEffect, useMemo } from 'react';
import { Boxes, Factory, Zap, ArrowUpCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { inventoryService } from '../../services/inventoryService';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export const InventoryDashboard = () => {
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [inventoryIn, setInventoryIn] = useState<any[]>([]);
  const [productionBatches, setProductionBatches] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [rm, bRes, pb, fg] = await Promise.all([
        inventoryService.getMaterials(),
        supabase.from(SUPABASE_TABLES.rawMaterialBarcodes).select('*'),
        inventoryService.getProductionBatches(),
        inventoryService.getFinishedGoods()
      ]);
      
      if (bRes.error) {
        console.error('Supabase query error for raw_material_barcodes:', bRes.error);
        throw new Error(`Failed to load raw material barcodes: ${bRes.error.message}`);
      }

      const b = bRes.data || [];
      setRawMaterials(rm || []);
      setBatches(b);
      setProductionBatches((pb || []).filter((item: any) => item.status !== 'DELETED'));
      setFinishedGoods(fg || []);

      // Sort recent raw material intake batches by received_date then created_at
      const recentBatches = [...b]
        .filter((item: any) => item.current_stage !== 'DELETED' && item.status !== 'DELETED')
        .sort((a: any, b: any) => {
          const dateA = new Date(a.received_date || a.created_at || 0).getTime();
          const dateB = new Date(b.received_date || b.created_at || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 5);

      setInventoryIn(recentBatches);
    } catch (err: any) {
      console.error('Failed to load dashboard data from Supabase', err);
      setErrorMsg(err.message || 'Failed to load inventory dashboard data from Supabase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh when window regains focus or storage/inventory updates
    const handleRefresh = () => fetchDashboardData();
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('storage', handleRefresh);
    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, []);

  // --- MEMOIZED CALCULATIONS FOR RAW MATERIAL SUMMARY ---

  // 1. Filter valid non-deleted raw material barcode records
  const validRawBatches = useMemo(() => {
    const seen = new Set<string>();
    return (batches || []).filter(b => {
      if (!b) return false;
      const isDeleted = b.current_stage === 'DELETED' || b.status === 'DELETED' || b.is_deleted === true;
      if (isDeleted) return false;

      const key = b.barcode || b.id || b.serial_number;
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);

      const qty = Number(b.quantity || b.available_quantity || b.original_quantity || 0);
      return Number.isFinite(qty) && qty > 0;
    });
  }, [batches]);

  // 2. Total Stock in KG (excluding Water and litre-based materials)
  const totalRmStockKg = useMemo(() => {
    return validRawBatches.reduce((acc, b) => {
      const unit = String(b.unit || '').toLowerCase().trim();
      const matName = String(b.material_name || b.materialName || '').toLowerCase().trim();
      const isLitre = unit.startsWith('l') || unit === 'litre' || unit === 'litres' || matName.includes('water');
      if (isLitre) return acc;

      const qty = Number(b.quantity || b.available_quantity || b.original_quantity || 0);
      return acc + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    }, 0);
  }, [validRawBatches]);

  // 3. Total Inventory Value (quantity * price_per_kg)
  const totalRmValue = useMemo(() => {
    return validRawBatches.reduce((acc, b) => {
      const qty = Number(b.quantity || b.available_quantity || b.original_quantity || 0);
      const price = Number(b.price_per_kg || b.price || 0);
      return acc + (Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0 ? qty * price : 0);
    }, 0);
  }, [validRawBatches]);

  // 4. Active Batches Count (unique material + batch_no)
  const activeBatchCount = useMemo(() => {
    const set = new Set<string>();
    validRawBatches.forEach(b => {
      const batchNo = b.batch_no || b.batchNo;
      const matName = b.material_name || b.materialName || '';
      const key = batchNo ? `${matName}_${batchNo}` : (b.id || b.barcode);
      if (key) set.add(key);
    });
    return set.size;
  }, [validRawBatches]);

  // 5. Low Stock Count (materials whose total stock is < 100 KG, each material counted once)
  const lowStockCount = useMemo(() => {
    const materialTotals = new Map<string, number>();
    validRawBatches.forEach(b => {
      const matName = String(b.material_name || b.materialName || '').trim();
      if (!matName) return;
      const qty = Number(b.quantity || b.available_quantity || b.original_quantity || 0);
      if (Number.isFinite(qty) && qty > 0) {
        materialTotals.set(matName, (materialTotals.get(matName) || 0) + qty);
      }
    });

    let count = 0;
    materialTotals.forEach((totalQty) => {
      if (totalQty > 0 && totalQty < 100) {
        count++;
      }
    });
    return count;
  }, [validRawBatches]);

  const totalProdBatches = useMemo(() => productionBatches.length, [productionBatches]);
  const inProgressProdBatches = useMemo(() => productionBatches.filter(b => b.status === 'Prep' || b.status === 'In Progress').length, [productionBatches]);
  const completedProdBatches = useMemo(() => productionBatches.filter(b => b.status === 'Complete' || b.status === 'COMPLETE' || b.status === 'Saved').length, [productionBatches]);
  const finishedGoodsUnits = useMemo(() => finishedGoods.reduce((acc, item) => acc + (item.units || 0), 0), [finishedGoods]);
  const totalProducedUnits = useMemo(() => productionBatches.reduce((acc, item) => acc + (item.produced_units || item.total_units || 0), 0), [productionBatches]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="w-full max-w-7xl mx-auto p-8 text-center space-y-4">
        <div className="text-red-500 font-bold text-lg">Error Loading Dashboard</div>
        <p className="text-muted text-sm">{errorMsg}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/80 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory Dashboard</h1>
          <p className="text-muted text-sm mt-1">Material Management & Production Analytics</p>
        </div>
      </div>

      {/* SECTION 1: RAW MATERIAL SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-500">
          <Boxes size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Raw Material Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 border-t-4 border-t-blue-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Total Stock</span>
            <div className="text-3xl font-bold text-white">{totalRmStockKg.toLocaleString()} <span className="text-sm text-muted">KG</span></div>
          </Card>
          
          <Card className="p-6 border-t-4 border-t-blue-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Inventory Value</span>
            <div className="text-3xl font-bold text-white">₹{totalRmValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </Card>

          <Card className="p-6 border-t-4 border-t-blue-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Active Batches</span>
            <div className="text-3xl font-bold text-white">{activeBatchCount}</div>
          </Card>

          <Card className={`p-6 border-t-4 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 ${lowStockCount > 0 ? 'border-t-red-500 bg-red-500/5' : 'border-t-blue-500'}`}>
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Low Stock</span>
            <div className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-red-500' : 'text-white'}`}>{lowStockCount}</div>
          </Card>
        </div>
      </div>

      {/* SECTION 2: PRODUCTION SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-500">
          <Factory size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Production Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 border-t-4 border-t-emerald-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Total Batches</span>
            <div className="text-3xl font-bold text-white">{totalProdBatches}</div>
          </Card>
          
          <Card className="p-6 border-t-4 border-t-emerald-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">In Progress</span>
            <div className="text-3xl font-bold text-white">{inProgressProdBatches}</div>
          </Card>

          <Card className="p-6 border-t-4 border-t-emerald-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Completed Batches</span>
            <div className="text-3xl font-bold text-white">{completedProdBatches}</div>
          </Card>

          <Card className="p-6 border-t-4 border-t-emerald-500 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300">
            <span className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">Finished Goods</span>
            <div className="text-3xl font-bold text-white">{finishedGoodsUnits.toLocaleString()} <span className="text-sm text-muted">Units</span></div>
          </Card>
        </div>
      </div>

      {/* SECTION 3 & 4: TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT RAW MATERIAL ACTIVITY */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-white mb-4">Recent Raw Material Intake</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted">
              <thead className="text-xs uppercase bg-card/80 text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th>
                  <th className="px-4 py-3 font-semibold">Quantity</th>
                  <th className="px-4 py-3 font-semibold">Batches</th>
                </tr>
              </thead>
              <tbody>
                {inventoryIn.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No recent intake activity</td></tr>
                ) : inventoryIn.map((item) => {
                  const qtyVal = Number(item.quantity || item.original_quantity || 0);
                  const unitVal = String(item.unit || 'KG').toUpperCase();
                  const batchDisplay = item.batch_no || item.batchNo || '1';
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.received_date || item.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-white">{item.material_name || item.materialName || '-'}</td>
                      <td className="px-4 py-3">{item.vendor || item.vendor_name || '-'}</td>
                      <td className="px-4 py-3 font-medium text-blue-400">{qtyVal} {unitVal}</td>
                      <td className="px-4 py-3">{batchDisplay}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* RECENT PRODUCTION ACTIVITY */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-white mb-4">Recent Production Activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-muted">
              <thead className="text-xs uppercase bg-card/80 text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Batch ID</th>
                  <th className="px-4 py-3 font-semibold">Units</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {productionBatches.slice(0,5).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No recent production activity</td></tr>
                ) : productionBatches.slice(0,5).map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.production_batch_id}</td>
                    <td className="px-4 py-3 font-medium text-emerald-400">{item.total_units}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${
                        item.status === 'Complete' || item.status === 'Saved' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : item.status === 'Prep' 
                            ? 'bg-yellow-500/20 text-yellow-400' 
                            : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {item.status === 'Saved' ? 'Saved' : item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* SECTION 5: QUICK INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/0 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-blue-500" />
            <h3 className="text-lg font-bold text-blue-500">Raw Material Status</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex justify-between items-center text-sm">
              <span className="text-muted">Total Material Categories</span>
              <strong className="text-white font-medium">{rawMaterials.length}</strong>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="text-muted">Active Inventory Batches</span>
              <strong className="text-white font-medium">{activeBatchCount}</strong>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="text-muted">Total Capital Tied In Stock</span>
              <strong className="text-white font-medium">₹{totalRmValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            </li>
          </ul>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpCircle size={18} className="text-emerald-500" />
            <h3 className="text-lg font-bold text-emerald-500">Production Status</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex justify-between items-center text-sm">
              <span className="text-muted">Total Produced Units (Lifetime)</span>
              <strong className="text-white font-medium">{totalProducedUnits.toLocaleString()}</strong>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="text-muted">Finished Goods Inventory</span>
              <strong className="text-white font-medium">{finishedGoodsUnits.toLocaleString()}</strong>
            </li>
            <li className="flex justify-between items-center text-sm">
              <span className="text-muted">Production Scanned Efficiency</span>
              <strong className={`font-medium ${totalProducedUnits > 0 && finishedGoodsUnits >= totalProducedUnits ? 'text-emerald-500' : 'text-orange-500'}`}>{totalProducedUnits > 0 ? Math.round((finishedGoodsUnits / totalProducedUnits) * 100) : 0}%</strong>
            </li>
          </ul>
        </Card>
      </div>



    </div>
  );
};
