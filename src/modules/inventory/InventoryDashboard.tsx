import { useState, useEffect, useMemo } from 'react';
import { Boxes, Factory, Zap, ArrowUpCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { inventoryService } from '../../services/inventoryService';

export const InventoryDashboard = () => {
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [inventoryIn, setInventoryIn] = useState<any[]>([]);
  const [productionBatches, setProductionBatches] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [rm, b, pb, fg] = await Promise.all([
          inventoryService.getMaterials(),
          inventoryService.getBatches(),
          inventoryService.getProductionBatches(),
          inventoryService.getFinishedGoods()
        ]);
        
        const recentBatches = [...b].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
        
        setRawMaterials(rm);
        setBatches(b);
        setInventoryIn(recentBatches);
        setProductionBatches(pb);
        setFinishedGoods(fg);



      } catch (err) {
        console.error('Failed to load dashboard data locally', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // --- MEMOIZED CALCULATIONS ---
  const activeRmBatches = useMemo(() => batches.filter(b => b.status === 'Active' || b.status === 'Low Stock'), [batches]);
  const totalRmStockKg = useMemo(() => activeRmBatches.reduce((acc, b) => acc + (b.available_quantity || 0), 0), [activeRmBatches]);
  const totalRmValue = useMemo(() => activeRmBatches.reduce((acc, b) => acc + ((b.available_quantity || 0) * (b.price_per_kg || 0)), 0), [activeRmBatches]);
  const lowStockCount = useMemo(() => batches.filter(b => b.status === 'Low Stock').length, [batches]);
  
  const totalProdBatches = useMemo(() => productionBatches.length, [productionBatches]);
  const inProgressProdBatches = useMemo(() => productionBatches.filter(b => b.status === 'In Progress').length, [productionBatches]);
  const completedProdBatches = useMemo(() => productionBatches.filter(b => b.status === 'Complete' || b.status === 'Saved').length, [productionBatches]);
  const finishedGoodsUnits = useMemo(() => finishedGoods.reduce((acc, item) => acc + (item.units || 0), 0), [finishedGoods]);
  const totalProducedUnits = useMemo(() => productionBatches.reduce((acc, item) => acc + (item.produced_units || 0), 0), [productionBatches]);
  
  const efficiency = useMemo(() => totalProducedUnits > 0 ? Math.round((finishedGoodsUnits / totalProducedUnits) * 100) : 0, [totalProducedUnits, finishedGoodsUnits]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
            <div className="text-3xl font-bold text-white">{activeRmBatches.length}</div>
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
                  const batchCount = batches.filter(b => b.inventory_in_id === item.id).length;
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(item.date_received).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-white">{item.material_name}</td>
                      <td className="px-4 py-3">{item.vendor_name}</td>
                      <td className="px-4 py-3 font-medium text-blue-400">{item.quantity_received} KG</td>
                      <td className="px-4 py-3">{batchCount}</td>
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
              <strong className="text-white font-medium">{activeRmBatches.length}</strong>
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
              <strong className={`font-medium ${efficiency >= 100 ? 'text-emerald-500' : 'text-orange-500'}`}>{efficiency}%</strong>
            </li>
          </ul>
        </Card>
      </div>



    </div>
  );
};
