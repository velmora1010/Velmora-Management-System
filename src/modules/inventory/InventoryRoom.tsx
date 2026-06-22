import { useState, useEffect, Component } from 'react';
import { PackageCheck, Boxes, ClipboardCheck, Truck, Search, Database, Eye, Download, X, CheckCircle, AlertCircle, Filter, ArrowLeft, Beaker, Archive } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryService } from '../../services/inventoryService';

const safeText = (value: any) => String(value ?? '').toLowerCase();

const InventoryRoom = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'landing' | 'raw_material' | 'product' | 'combo'>('landing');
  const [rawSubTab, setRawSubTab] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [prodSubTab, setProdSubTab] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [comboSubTab, setComboSubTab] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  const [rawBatches, setRawBatches] = useState<any[]>([]);
  const [productionBatches, setProductionBatches] = useState<any[]>([]);

  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);
  const [allProductBarcodes, setAllProductBarcodes] = useState<any[]>([]);
  const [comboBatches, setComboBatches] = useState<any[]>([]);
  const [comboInventory, setComboInventory] = useState<any[]>([]);
  const [allComboBarcodes, setAllComboBarcodes] = useState<any[]>([]);
  
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingProd, setLoadingProd] = useState(true);

  const location = useLocation();
  const newlyScannedBarcode = location.state?.newlyScannedBarcode;

  const [highlightedBarcode, setHighlightedBarcode] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState<any>(null);

  useEffect(() => {
    if (newlyScannedBarcode && rawBatches.length > 0) {
      const batch = rawBatches.find(b => b.serial_number === newlyScannedBarcode);
      if (batch) {
        setHighlightedBarcode(newlyScannedBarcode);
        setShowToast(true);
        setToastData(batch);

        setTimeout(() => {
          const el = document.getElementById(`inventory-row-${newlyScannedBarcode}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        const timer = setTimeout(() => {
          setHighlightedBarcode(null);
          setShowToast(false);
          window.history.replaceState({}, document.title);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [newlyScannedBarcode, rawBatches]);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingBatches(true);
      setLoadingProd(true);
      try {
        const [rb, pb, fg, cb, ci, allCombo, allProducts] = await Promise.all([
          inventoryService.getBatches(),
          inventoryService.getProductionBatches(),
          inventoryService.getFinishedGoods(),
          inventoryService.getComboBatches(),
          inventoryService.getComboInventory(),
          inventoryService.getAllComboBarcodes(),
          (inventoryService as any).getProductBarcodes()
        ]);
        
        setRawBatches(rb);
        setProductionBatches(pb);
        setFinishedGoods(fg);
        setComboBatches(cb);
        setComboInventory(ci);
        setAllComboBarcodes(allCombo);
        setAllProductBarcodes(allProducts);
      } catch (err) {
        console.error('Failed to load inventory room data', err);
      } finally {
        setLoadingBatches(false);
        setLoadingProd(false);
      }
    };
    
    fetchData();
  }, []);

  if (loadingBatches || loadingProd) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 'bold' }}>Loading Inventory Data...</div>;
  }

  // Filter raw batches that have been scanned into inventory
  const scannedRawBatches = rawBatches.filter(b => {
    const stage = b.currentStage || 'READY_FOR_FIRST_SCAN';
    return stage === 'RAW_MATERIAL_IN' || stage === 'RAW_MATERIAL_OUT';
  }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Summary Calcs
  const totalRawMaterialKG = scannedRawBatches.filter(b => b.status !== 'Depleted').reduce((acc, b) => acc + (b.available_quantity || 0), 0);
  const rawMaterialValue = scannedRawBatches.filter(b => b.status !== 'Depleted').reduce((acc, b) => acc + (b.batch_value || 0), 0);
  const totalProductionUnits = productionBatches.reduce((acc, b) => acc + (b.total_units || 0), 0);
  const finishedGoodsAvailable = finishedGoods.filter(f => f.status === 'In Stock').reduce((acc, f) => acc + (f.units || 0), 0);
  const totalBatchesCount = scannedRawBatches.length + productionBatches.length;
  const readyForDispatch = finishedGoodsAvailable;

  const q = safeText(searchTerm);

  const filteredProducts = allProductBarcodes.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (prodSubTab === 'ALL') matchTab = true;
    if (prodSubTab === 'IN') matchTab = ['PRODUCT_IN', 'PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);
    if (prodSubTab === 'OUT') matchTab = ['PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);

    const matchSearch = safeText(item.product_name).includes(q) || 
      safeText(item.product_code).includes(q) ||
      safeText(item.barcode_no).includes(q);
      
    return matchSearch && matchTab;
  }).sort((a,b) => new Date(b.created_at || b.stock_in_at).getTime() - new Date(a.created_at || a.stock_in_at).getTime());

  const filteredCombos = allComboBarcodes.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (comboSubTab === 'ALL') matchTab = true;
    if (comboSubTab === 'IN') matchTab = ['COMBO_IN', 'COMBO_OUT', 'READY_FOR_DISPATCH'].includes(stage);
    if (comboSubTab === 'OUT') matchTab = ['COMBO_OUT', 'READY_FOR_DISPATCH'].includes(stage);

    const matchSearch = safeText(item.combo_name).includes(q) || 
      safeText(item.barcode_no).includes(q);
      
    return matchSearch && matchTab;
  }).sort((a,b) => new Date(b.created_at || b.stock_in_at).getTime() - new Date(a.created_at || a.stock_in_at).getTime());

  const filteredRaw = rawBatches.filter((item: any) => {
    const stage = item.currentStage || 'READY_FOR_FIRST_SCAN';
    let matchTab = true;
    if (rawSubTab === 'ALL') matchTab = true;
    if (rawSubTab === 'IN') matchTab = ['RAW_MATERIAL_IN', 'RAW_MATERIAL_OUT'].includes(stage);
    if (rawSubTab === 'OUT') matchTab = ['RAW_MATERIAL_OUT'].includes(stage);

    const matchSearch = safeText(item.material_name).includes(q) || 
      safeText(item.vendor_name).includes(q) ||
      safeText(item.po_reference).includes(q) ||
      safeText(item.serial_number).includes(q) ||
      safeText(item.batch_number).includes(q);
      
    return matchSearch && matchTab;
  }).sort((a,b) => new Date(b.created_at || b.stock_in_at).getTime() - new Date(a.created_at || a.stock_in_at).getTime());

  const getProductStats = (code: string, name: string) => {
    const pb = productionBatches.filter(b => b.product_name === code || b.product_name === name);
    const fg = finishedGoods.filter(f => f.product_name === code || f.product_name === name || f.product_code === code || f.recipe_id === code);
    
    const pbAvailable = pb.reduce((sum, item) => sum + (Number(item.produced_units) || 0), 0);
    const fgAvailable = fg.reduce((sum, item) => sum + (Number(item.units) || Number(item.quantity) || 0), 0);
    const pbProduced = pb.reduce((sum, item) => sum + (Number(item.total_units) || Number(item.produced_units) || 0), 0);
    
    const availableUnits = pbAvailable + fgAvailable;
    const producedUnits = pbProduced;
    const usedInCombos = producedUnits - availableUnits > 0 ? producedUnits - availableUnits : 0;
    const batchCount = pb.length + fg.length;
    
    return { code, name, availableUnits, producedUnits, usedInCombos, batchCount, status: availableUnits > 0 ? 'In Stock' : 'Out of Stock' };
  };

  const productStats = [
    getProductStats('1B', 'Blue Detergent'),
    getProductStats('1Y', 'Yellow Dishwash'),
    getProductStats('1P', 'Pink Conditioner'),
    getProductStats('1S', 'Sponge')
  ].filter(p => safeText(p.name).includes(q) || safeText(p.code).includes(q));

  const totalComboBatches = comboBatches.length;
  const totalComboUnits = comboBatches.reduce((acc, b) => acc + (Number(b.total_units) || 0), 0);
  const readyCombos = comboInventory.filter(ci => ci.status !== 'DELETED').reduce((acc, ci) => acc + (Number(ci.units) || 0), 0);
  const filteredComboBatches = comboBatches.filter((cb: any) => 
    safeText(cb.combo_name).includes(q) || 
    safeText(cb.id).includes(q) ||
    safeText(cb.batch_number).includes(q)
  ).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const defaultMaterials = [
    'SLES Paste', 'CAPB', 'Salt', 'AOS', 'Fragrance - Lemon Blast',
    'Fragrance - White Flower', 'Fragrance - Milk Saffron', 'Comfort Base',
    'Sodium Benzoate', 'Phenoxy Ethanol', 'N-Cap', 'Yellow Colour',
    'Blue Colour', 'Violet Colour', 'Water'
  ];

  const overviewCards = defaultMaterials.map(mat => {
    const batches = scannedRawBatches.filter(b => b.material_name === mat);
    const totalBatches = batches.length;
    const totalKG = batches.reduce((sum, b) => sum + (b.original_quantity || 0), 0);
    const availableKG = batches.reduce((sum, b) => sum + (b.available_quantity ?? b.original_quantity ?? 0), 0);
    const usedKG = totalKG - availableKG;
    const amount = batches.reduce((sum, b) => sum + (b.batch_value || ((b.original_quantity || 0) * (b.price_per_kg || 0))), 0);
    
    let shortCode = mat.substring(0, 3).toUpperCase();
    let category = 'Additive';
    let catColor = '#64748b';
    
    if (mat.includes('SLES') || mat.includes('AOS')) { category = 'Surfactant'; catColor = '#3b82f6'; }
    else if (mat.includes('CAPB') || mat.includes('Comfort')) { category = 'Conditioning'; catColor = '#10b981'; }
    else if (mat.includes('Sodium') || mat.includes('Phenoxy') || mat.includes('N-Cap')) { category = 'Preservative'; catColor = '#ec4899'; }
    else if (mat.includes('Fragrance')) { category = 'Fragrance'; catColor = '#f59e0b'; }
    else if (mat.includes('Colour') || mat.includes('Color')) { category = 'Color'; catColor = '#a855f7'; }
    else if (mat.includes('Water') || mat.includes('Salt')) { category = 'Base/Solvent'; catColor = '#06b6d4'; }

    if (mat.includes('SLES')) shortCode = '1B, 1Y';
    if (mat.includes('CAPB')) shortCode = '2C';
    if (mat.includes('Salt')) shortCode = '3S';
    if (mat.includes('AOS')) shortCode = '4A';
    if (mat.includes('Lemon')) shortCode = 'FL';
    if (mat.includes('White')) shortCode = 'FW';
    if (mat.includes('Saffron')) shortCode = 'FM';
    if (mat.includes('Comfort')) shortCode = 'CB';

    return { name: mat, totalKG, availableKG, usedKG, amount, totalBatches, accentColor: catColor, accentBg: `${catColor}15`, shortCode, category };
  });

  const filteredOverviewCards = q ? overviewCards.filter(card => safeText(card.name).includes(q) || safeText(card.shortCode).includes(q)) : overviewCards;

  const lowStockAlerts = overviewCards.filter(c => c.availableKG > 0 && c.availableKG < 20); // Dummy minimum level

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ paddingBottom: '64px', maxWidth: '1400px', margin: '0 auto' }}
    >
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: '0 0 8px 0', color: 'white' }}>Warehouse Analytics</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Central overview of raw material stock, production stock, finished goods, and inventory records.</p>
        </div>
      </div>

      {/* TOP KPI SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', overflowX: 'hidden', paddingBottom: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Total Raw Material', value: `${totalRawMaterialKG.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG`, icon: <Database size={14} />, color: '#8b5cf6' },
          { label: 'Raw Material Value', value: `₹${rawMaterialValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: <ClipboardCheck size={14} />, color: '#3b82f6' },
          { label: 'Production Units', value: totalProductionUnits.toLocaleString(), icon: <Boxes size={14} />, color: '#f97316' },
          { label: 'Finished Goods', value: finishedGoodsAvailable.toLocaleString(), icon: <PackageCheck size={14} />, color: '#10b981' },
          { label: 'Total Batches', value: totalBatchesCount.toLocaleString(), icon: <Boxes size={14} />, color: '#64748b' },
          { label: 'Ready for Dispatch', value: readyForDispatch.toLocaleString(), icon: <Truck size={14} />, color: '#eab308' },
        ].map((kpi, idx) => (
          <div key={idx} className="hover-lift" style={{ 
            height: '110px', background: 'rgba(17, 24, 39, 0.7)', borderRadius: '12px', padding: '16px 20px', 
            border: '1px solid #263244', borderTop: `2px solid ${kpi.color}`, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: kpi.color }}>
              {kpi.icon}
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'white', lineHeight: '1' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      
      
      {activeTab === 'landing' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', padding: '24px 0' }}>
          <div 
            onClick={() => setActiveTab('raw_material')}
            className="hover-lift"
            style={{ background: 'rgba(17, 24, 39, 0.8)', border: '1px solid #334155', borderRadius: '16px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'all 0.3s', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.2)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Beaker size={32} color="#3b82f6" />
            </div>
            <h2 style={{ color: 'white', fontSize: '24px', margin: '0 0 12px 0' }}>Raw Material</h2>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>Shows raw material storage bins, stock availability, and incoming batches.</p>
          </div>

          <div 
            onClick={() => setActiveTab('product')}
            className="hover-lift"
            style={{ background: 'rgba(17, 24, 39, 0.8)', border: '1px solid #334155', borderRadius: '16px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'all 0.3s', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.2)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Boxes size={32} color="#10b981" />
            </div>
            <h2 style={{ color: 'white', fontSize: '24px', margin: '0 0 12px 0' }}>Product</h2>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>Shows finished product stock levels, units produced, and batch counts.</p>
          </div>

          <div 
            onClick={() => setActiveTab('combo')}
            className="hover-lift"
            style={{ background: 'rgba(17, 24, 39, 0.8)', border: '1px solid #334155', borderRadius: '16px', padding: '32px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'all 0.3s', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.2)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Archive size={32} color="#8b5cf6" />
            </div>
            <h2 style={{ color: 'white', fontSize: '24px', margin: '0 0 12px 0' }}>Combo</h2>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>Shows combo inventory details, active combo boxes, and ready combos.</p>
          </div>
        </div>
      ) : (
        <>
          {/* SEARCH AND TABS TOOLBAR */}
          <div style={{ position: 'sticky', top: '0px', zIndex: 10, background: '#070b12', padding: '16px 0', borderBottom: '1px solid #263244', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                className="btn hover-lift" 
                style={{ 
                  border: '1px solid #263244', 
                  background: '#111827', 
                  color: '#94a3b8',
                  fontWeight: 600,
                  padding: '10px 20px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActiveTab('landing')}
              >
                <ArrowLeft size={18} />
                Back to Inventory Room
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '320px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input 
                  type="text" 
                  placeholder="Global Search..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '12px', border: '1px solid #263244', background: '#111827', color: 'white', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <button className="btn hover-lift" style={{ padding: '12px', borderRadius: '12px', background: '#111827', border: '1px solid #263244', color: '#94a3b8' }}>
                <Filter size={18} />
              </button>
              <button className="btn hover-lift" style={{ padding: '12px', borderRadius: '12px', background: '#111827', border: '1px solid #263244', color: '#94a3b8' }}>
                <Download size={18} />
              </button>
            </div>
          </div>
{activeTab === 'raw_material' && (
        <>
          {lowStockAlerts.length > 0 && (
        <div style={{ marginBottom: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '0 16px', height: '60px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>Low Stock Materials</span>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', flex: 1, scrollbarWidth: 'none', alignItems: 'center' }}>
            {lowStockAlerts.map(alert => (
              <div key={alert.name} style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '4px 10px', borderRadius: '4px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'white', fontWeight: 500 }}>{alert.name}</span>
                <span style={{ color: '#fca5a5' }}>•</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{alert.availableKG.toFixed(1)} KG Left</span>
              </div>
            ))}
          </div>
          <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>View Details →</span>
        </div>
      )}

      {/* RAW MATERIAL OVERVIEW SECTION */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '20px', margin: '0 0 4px 0', color: 'white' }}>Raw Material Storage</h2>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Real-time bin-level tracking of formulation ingredients.</p>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredOverviewCards.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: '#94a3b8', background: '#111827', borderRadius: '12px', border: '1px solid #263244' }}>
              <Database size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              No records found.<br/><span style={{ fontSize: '13px' }}>Try another material name, vendor, barcode, or PO number.</span>
            </div>
          ) : (
            filteredOverviewCards.map(card => (
              <div key={card.name} className="hover-lift" style={{ 
                padding: '20px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '16px',
                background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(38, 50, 68, 0.8)', position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 16px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: card.accentColor }} />
                
                {/* TOP ROW: Icon, Name/Code, Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '44px', height: '44px', background: `linear-gradient(135deg, ${card.accentBg}, rgba(0,0,0,0))`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${card.accentBg}` }}>
                      <Database size={22} color={card.accentColor} />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'white', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{card.name}</h3>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Code: {card.shortCode}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: card.accentColor, background: card.accentBg, padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    {card.category}
                  </div>
                </div>

                {/* MIDDLE ROW: Available & Used */}
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Available</span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{card.availableKG.toFixed(1)} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>KG</span></span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Used</span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{card.usedKG.toFixed(1)} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>KG</span></span>
                  </div>
                </div>

                {/* BOTTOM ROW: Value & Batches */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Value</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>₹{card.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Batches</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{card.totalBatches}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      </>
      )}

      <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        {/* RAW MATERIAL TAB */}
        {activeTab === 'raw_material' && (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid #263244', display: 'flex', gap: '8px' }}>
              <button onClick={() => setRawSubTab('ALL')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: rawSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: rawSubTab === 'ALL' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>All</button>
              <button onClick={() => setRawSubTab('IN')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: rawSubTab === 'IN' ? '#10b981' : 'transparent', color: rawSubTab === 'IN' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory IN</button>
              <button onClick={() => setRawSubTab('OUT')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: rawSubTab === 'OUT' ? '#f59e0b' : 'transparent', color: rawSubTab === 'OUT' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory OUT</button>
            </div>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Material</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Barcode</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Batch</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Vendor</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Receiver</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Quantity</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Available</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Value</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Action</th>
                  </tr>
                </thead>
              <tbody>
                {filteredRaw.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>No records found.</td></tr>
                ) : (
                  filteredRaw.map((row, idx) => (
                    <tr 
                      key={row.id} 
                      id={`inventory-row-${row.serial_number}`}
                      style={{ 
                        background: highlightedBarcode === row.serial_number ? 'rgba(16, 185, 129, 0.1)' : (idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)'),
                        transition: 'all 0.2s ease',
                      }}
                      className="hover-bg"
                    >
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{new Date(row.stock_in_at || row.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: 'white', borderBottom: '1px solid #1e293b' }}>{row.material_name}</td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.serial_number}</td>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.batch_number}</td>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.vendor_name || '--'}</td>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.inventoryOutPersonName || row.inventoryInPersonName || row.scanningPersonName || '--'}</td>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.original_quantity} KG</td>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#10b981', borderBottom: '1px solid #1e293b' }}>{row.available_quantity?.toFixed(1) ?? row.original_quantity} KG</td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: 'white', borderBottom: '1px solid #1e293b' }}>₹{row.batch_value?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 0}</td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                        {(() => {
                          const badge = getRawBadge(row.currentStage, rawSubTab);
                          return (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {badge.text}
                            </span>
                          );
                        })()}
                        {highlightedBarcode === row.serial_number && (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{ display: 'inline-block', marginLeft: '8px', padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, background: '#10b981', color: 'white', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }}
                          >
                            NEW ENTRY
                          </motion.span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                        <button className="btn hover-lift" style={{ padding: '6px 12px', borderRadius: '8px', background: '#1e293b', border: 'none', color: 'white' }} onClick={() => setSelectedBatch(row)}>
                          <Eye size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {activeTab === 'product' && (
        <>
          <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                <tr>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Product Code</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Product Name</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Available Units</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Produced Units</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Used in Combos</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Batch Count</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((row, idx) => (
                  <tr key={row.code} className="hover-bg" style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.code}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: 'white', borderBottom: '1px solid #1e293b' }}>{row.name}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 800, color: '#10b981', borderBottom: '1px solid #1e293b' }}>{row.availableUnits}</td>
                    <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.producedUnits}</td>
                    <td style={{ padding: '16px 20px', color: '#f97316', fontWeight: 700, borderBottom: '1px solid #1e293b' }}>{row.usedInCombos}</td>
                    <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.batchCount}</td>
                    <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                      <span style={{ 
                        padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: row.status === 'In Stock' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: row.status === 'In Stock' ? '#10b981' : '#ef4444'
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #263244', display: 'flex', gap: '8px' }}>
            <button onClick={() => setProdSubTab('ALL')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: prodSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: prodSubTab === 'ALL' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>All</button>
            <button onClick={() => setProdSubTab('IN')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: prodSubTab === 'IN' ? '#10b981' : 'transparent', color: prodSubTab === 'IN' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory IN</button>
            <button onClick={() => setProdSubTab('OUT')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: prodSubTab === 'OUT' ? '#f59e0b' : 'transparent', color: prodSubTab === 'OUT' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory OUT</button>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                <tr>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Date</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Barcode</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Product</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Stage</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>No barcodes found.</td></tr>
                ) : (
                  filteredProducts.map((row: any, idx: number) => (
                    <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)' }} className="hover-bg">
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.barcode_no}</td>
                      <td style={{ padding: '16px 20px', color: 'white', fontWeight: 700, borderBottom: '1px solid #1e293b' }}>{row.product_name}</td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                        {(() => {
                          const badge = getComboBadge(row.currentStage, comboSubTab);
                          return (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {badge.text}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {activeTab === 'combo' && (
        <div style={{ paddingBottom: '24px' }}>
          {/* KPI Cards for Combo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(17, 24, 39, 0.7)', padding: '24px', borderRadius: '16px', border: '1px solid #263244', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><Boxes size={16} color="#8b5cf6" /> Total Combo Batches</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{totalComboBatches}</div>
            </div>
            <div style={{ background: 'rgba(17, 24, 39, 0.7)', padding: '24px', borderRadius: '16px', border: '1px solid #263244', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><PackageCheck size={16} color="#3b82f6" /> Total Combo Units</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{totalComboUnits}</div>
            </div>
            <div style={{ background: 'rgba(17, 24, 39, 0.7)', padding: '24px', borderRadius: '16px', border: '1px solid #263244', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} color="#10b981" /> Ready Combos</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981' }}>{readyCombos}</div>
            </div>
          </div>
          
          <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Created Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Batch ID</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Combo Name</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Available Units</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComboBatches.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>No combo records found.</td></tr>
                  ) : (
                    filteredComboBatches.map((row: any, idx: number) => {
                      const statusStr = (row.status || 'READY').toUpperCase();
                      const statusColor = statusStr === 'READY' ? '#10b981' : '#f59e0b';
                      const statusBg = statusStr === 'READY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)';
                      return (
                        <tr key={row.id} className="hover-bg" style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)' }}>
                          <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.id}</td>
                          <td style={{ padding: '16px 20px', fontWeight: 700, color: 'white', borderBottom: '1px solid #1e293b' }}>{row.combo_name}</td>
                          <td style={{ padding: '16px 20px', fontWeight: 800, color: '#10b981', borderBottom: '1px solid #1e293b' }}>{row.total_units}</td>
                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                            <span style={{ 
                              padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                              background: statusBg,
                              color: statusColor
                            }}>
                              {statusStr}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                            <button className="btn hover-lift" style={{ padding: '6px 12px', borderRadius: '8px', background: '#1e293b', border: 'none', color: 'white' }}>
                              <Eye size={16}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #263244', display: 'flex', gap: '8px' }}>
              <button onClick={() => setComboSubTab('ALL')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: comboSubTab === 'ALL' ? '#3b82f6' : 'transparent', color: comboSubTab === 'ALL' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>All</button>
              <button onClick={() => setComboSubTab('IN')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: comboSubTab === 'IN' ? '#10b981' : 'transparent', color: comboSubTab === 'IN' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory IN</button>
              <button onClick={() => setComboSubTab('OUT')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: comboSubTab === 'OUT' ? '#f59e0b' : 'transparent', color: comboSubTab === 'OUT' ? 'white' : '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>Inventory OUT</button>
            </div>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b' }}>
                  <tr>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Barcode</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Combo Name</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>IN Person</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>OUT Person</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #334155', textTransform: 'uppercase', fontSize: '12px' }}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCombos.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>No combo barcodes found.</td></tr>
                  ) : (
                    filteredCombos.map((row: any, idx: number) => (
                      <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)' }} className="hover-bg">
                        <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#60a5fa', borderBottom: '1px solid #1e293b' }}>{row.barcode_no}</td>
                        <td style={{ padding: '16px 20px', color: 'white', fontWeight: 700, borderBottom: '1px solid #1e293b' }}>{row.combo_name}</td>
                        <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.comboInventoryInPersonName || '-'}</td>
                        <td style={{ padding: '16px 20px', color: '#cbd5e1', borderBottom: '1px solid #1e293b' }}>{row.comboInventoryOutPersonName || '-'}</td>
                        <td style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                        {(() => {
                          const badge = getComboBadge(row.currentStage, comboSubTab);
                          return (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {badge.text}
                            </span>
                          );
                        })()}
                      </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {showToast && toastData && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
              background: 'var(--surface)', border: '1px solid #10b981', borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2), 0 0 15px rgba(16, 185, 129, 0.2)',
              padding: '16px', minWidth: '320px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ background: '#d1fae5', color: '#10b981', padding: '8px', borderRadius: '50%' }}>
                <CheckCircle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#10b981' }}>Inventory Updated Successfully</h3>
            </div>
            <div style={{ background: 'var(--surface-soft)', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Barcode:</span> <strong>{toastData.serial_number}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Material:</span> <strong>{toastData.material_name}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Quantity:</span> <strong>{toastData.original_quantity} KG</strong></div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500 }}>
              Added to Inventory Ledger
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      {selectedBatch && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay" 
          onClick={() => setSelectedBatch(null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="modal-content" 
            style={{ width: '600px', maxWidth: '95%', background: '#111827', border: '1px solid #263244', borderRadius: '24px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Database size={20} color="#3b82f6" /> Raw Material Stock Details</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setSelectedBatch(null)}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Material Name</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 700, color: 'white' }}>{selectedBatch.material_name}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Barcode Number</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, fontFamily: 'monospace', color: '#60a5fa' }}>{selectedBatch.serial_number}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Batch ID</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 500, fontFamily: 'monospace', fontSize: '12px', color: '#cbd5e1' }}>{selectedBatch.batch_id}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Batch Number</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, color: 'white' }}>{selectedBatch.batch_number}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Quantity KG</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, color: 'white' }}>{selectedBatch.original_quantity} KG</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Available KG</label>
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', fontWeight: 800, color: selectedBatch.available_quantity > 0 ? '#10b981' : '#ef4444' }}>
                  {selectedBatch.available_quantity ?? selectedBatch.original_quantity} KG
                </div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Vendor</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, color: 'white' }}>{selectedBatch.vendor_name || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>PO Reference</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, color: 'white' }}>{selectedBatch.po_reference || '--'}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Received Date</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 500, color: '#cbd5e1' }}>{new Date(selectedBatch.created_at).toISOString().slice(0,10)}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Stock In Date</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 500, color: '#cbd5e1' }}>{selectedBatch.stock_in_at ? new Date(selectedBatch.stock_in_at).toISOString().slice(0,10) : new Date(selectedBatch.created_at).toISOString().slice(0,10)}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Price Per KG</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, color: 'white' }}>₹{selectedBatch.price_per_kg || 0}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>GST %</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 600, color: 'white' }}>{selectedBatch.gst_percent || 0}%</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Batch Value</label>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '10px', fontWeight: 800, color: 'white' }}>₹{selectedBatch.batch_value?.toFixed(2) || 0}</div>
              </div>
              <div className="form-group">
                <label style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '10px', 
                  fontWeight: 800, 
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  border: `1px solid rgba(16, 185, 129, 0.3)`,
                  textTransform: 'uppercase'
                }}>
                  Stock In
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button className="btn hover-lift" style={{ padding: '12px 32px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600 }} onClick={() => setSelectedBatch(null)}>
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
        </>
      )}
    </motion.div>
  );
};

class ErrorBoundary extends Component<{children: React.ReactNode}, { hasError: boolean }> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Something went wrong while loading Inventory Room.</h2>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Clear Search</button>
        </div>
      );
    }
    return this.props.children;
  }
}


const getRawBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'RAW_MATERIAL_IN') return { text: 'SCANNED IN', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED OUT', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
  } else if (tab === 'IN') {
    if (stage === 'RAW_MATERIAL_IN') return { text: 'SCAN TO OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'OUT') {
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

const getComboBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'COMBO_IN') return { text: 'SCANNED IN', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    if (stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'SCANNED OUT', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
  } else if (tab === 'IN') {
    if (stage === 'COMBO_IN') return { text: 'SCAN TO OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'SCANNED OUT', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'OUT') {
    if (stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'SCANNED OUT', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

export default function InventoryRoomWrapper() {
  return (
    <ErrorBoundary>
      <InventoryRoom />
    </ErrorBoundary>
  );
}
