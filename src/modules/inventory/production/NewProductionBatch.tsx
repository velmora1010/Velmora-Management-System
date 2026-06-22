import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Beaker, Factory, AlertTriangle, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { PRODUCTS, calculateRequiredIngredients } from '../../../config/productFormulas';
import { inventoryService } from '../../../services/inventoryService';
import { motion, AnimatePresence } from 'framer-motion';
import { getProductDisplayName, getProductSubtext, getProductTheme } from './productHelpers';
import toast from 'react-hot-toast';

const NewProductionBatch = () => {
  const navigate = useNavigate();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [sizeType, setSizeType] = useState<'Full' | 'Micro' | 'Custom' | null>(null);
  const [customUnits, setCustomUnits] = useState<number>(500);
  const [producedBy, setProducedBy] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const selectedProduct = PRODUCTS.find(p => p.id === selectedProductId);

  // Micro Batch calculations
  const totalUnits = sizeType === 'Full' ? 500 : sizeType === 'Micro' ? 30 : customUnits;
  
  const microBatches = useMemo(() => {
    if (!totalUnits || totalUnits <= 0) return [];
    const count = Math.ceil(totalUnits / 30);
    let currentTotal = 0;
    return Array.from({ length: count }).map((_, i) => {
      let qty = 30;
      if (i === count - 1) {
        qty = totalUnits - currentTotal;
      }
      currentTotal += qty;
      return { no: i + 1, qty };
    });
  }, [totalUnits]);

  // Ingredients calculation
  const requiredIngredients = useMemo(() => {
    if (!selectedProductId || totalUnits <= 0) return null;
    return calculateRequiredIngredients(selectedProductId, totalUnits);
  }, [selectedProductId, totalUnits]);

  // Stock check
  const [ingredientStatus, setIngredientStatus] = useState<any[]>([]);

  useEffect(() => {
    const checkStock = async () => {
      if (!requiredIngredients) {
        setIngredientStatus([]);
        return;
      }
      try {
        const status = await (inventoryService as any).validateIngredientAvailability(requiredIngredients);
        setIngredientStatus(status);
      } catch (err) {
        console.error(err);
      }
    };
    checkStock();
  }, [requiredIngredients]);

  const hasInsufficientStock = ingredientStatus.some((s: any) => !s.sufficient);
  const canStart = selectedProduct && sizeType && !hasInsufficientStock && (requiredIngredients !== null);

  const handleStartBatch = async () => {
    if (!producedBy.trim()) {
      toast.error("Please enter Produced By");
      return;
    }

    if (!canStart || !selectedProduct) return;

    try {
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const prodBatchId = `PROD-${dateStr}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      const dbBatchId = crypto.randomUUID();

      // 0. Deduct Raw Materials (Atomic Transaction Block)
      try {
        await (inventoryService as any).deductRawMaterialsForProduction(requiredIngredients, prodBatchId, selectedProduct.id);
      } catch (err: any) {
        console.error("Deduction failed:", err);
        toast.error("Cannot start batch. Required raw materials are not available.");
        return; // Abort transaction
      }

      // 1. Create Production Batch
      const batchData = {
        id: dbBatchId,
        production_batch_id: prodBatchId,
        product_name: selectedProduct.name,
        total_units: totalUnits,
        batch_type: sizeType === 'Full' ? 'Full Set' : sizeType === 'Micro' ? 'Micro Batch' : 'Custom',
        produced_by: producedBy.trim(),
        notes: notes.trim(),
        status: 'Prep',
        total_micro_batches: microBatches.length,
        completed_micro_batches: 0,
        produced_units: 0,
        inventory_units: 0
      };
      await inventoryService.saveProductionBatch(batchData);

      // 2. Setup Ingredients
      const ingredientsData = requiredIngredients.map((ing: any) => ({
        production_batch_id: prodBatchId,
        material_name: ing.name,
        required_quantity: ing.required_quantity,
        scanned_quantity: 0,
        status: 'Pending',
        available_quantity_at_start: ingredientStatus.find(s => s.name === ing.name)?.available || 0,
      }));
      await inventoryService.saveProductionIngredients(ingredientsData);

      // 3. Setup Micro Batches
      const microBatchesData = microBatches.map(mb => ({
        production_batch_id: prodBatchId,
        micro_batch_no: mb.no,
        units: mb.qty,
        status: 'Waiting'
      }));
      await inventoryService.saveMicroBatches(microBatchesData);

      // Show Success Toast simulation (via alert since no toast present in this context)
      toast.success("Raw materials deducted successfully");
      navigate(`/inventory/production/batch/${dbBatchId}`);;
    } catch (err) {
      console.error("Failed to start batch:", err);
      toast.error("Failed to create production batch.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-container" 
      style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '48px' }}
    >
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <button 
            className="btn btn-secondary hover-lift" 
            style={{ marginBottom: '16px', padding: '6px 16px', fontSize: '13px', height: 'auto', borderRadius: '12px', background: 'var(--surface-soft)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} 
            onClick={() => navigate('/inventory/production')}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '28px', background: 'linear-gradient(to right, #ffffff, #a1a1aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            New Production Batch
          </h1>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '15px' }}>
            Configure product, size, and verify raw materials.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        
        {/* Step 1: Select Product */}
        <div className="page-card" style={{ padding: '24px', background: '#111827', borderRadius: '24px', border: '1px solid #263244' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</div>
            <h2 style={{ fontSize: '20px', margin: 0, color: 'white' }}>Select Product</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>Choose the product you want to manufacture.</p>
          
          <div className="grid grid-4" style={{ gap: '16px' }}>
            {PRODUCTS.map((p: any) => {
              const isSelected = selectedProductId === p.id;
              const theme = getProductTheme(p.name);
              const displayName = getProductDisplayName(p.name);
              const subtext = getProductSubtext(p.name);

              return (
                <motion.div 
                  key={p.id}
                  whileHover={{ y: -4, boxShadow: theme.glow }}
                  onClick={() => setSelectedProductId(p.id)}
                  style={{ 
                    border: isSelected ? `2px solid ${theme.color}` : '1px solid #263244',
                    background: isSelected ? `linear-gradient(#1e293b, #1e293b) padding-box, linear-gradient(135deg, ${theme.color}, transparent) border-box` : 'var(--surface-soft)',
                    padding: '20px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isSelected ? `0 10px 25px -5px ${theme.glow}` : 'none'
                  }}
                >
                  {isSelected && <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: `radial-gradient(circle, ${theme.bg} 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: isSelected ? theme.color : '#1e293b', color: isSelected ? 'white' : theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isSelected ? `0 4px 12px ${theme.glow}` : 'none' }}>
                      {theme.icon === 'droplet' ? <Beaker size={24} /> : <Package size={24} />}
                    </div>
                    {p.formula && (
                      <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '12px', background: theme.bg, color: theme.color, border: `1px solid ${theme.bg}` }}>
                        FORMULA
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: 'white', fontWeight: 800 }}>{displayName}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{subtext}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select Batch Size */}
        <AnimatePresence>
          {selectedProductId && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="page-card" 
              style={{ padding: '24px', background: '#111827', borderRadius: '24px', border: '1px solid #263244', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                <h2 style={{ fontSize: '20px', margin: 0, color: 'white' }}>Select Batch Size</h2>
              </div>

              <div className="grid grid-3" style={{ gap: '16px', marginBottom: '32px' }}>
                {[
                  { id: 'Full', title: 'Full Set', desc: 'Standard 500 units production', units: 500 },
                  { id: 'Micro', title: 'Micro Batch', desc: 'Small 30 units production', units: 30 },
                  { id: 'Custom', title: 'Custom Units', desc: 'Define your own quantity', units: null }
                ].map(opt => {
                  const isSelected = sizeType === opt.id;
                  return (
                    <motion.div 
                      key={opt.id}
                      whileHover={{ y: -2 }}
                      onClick={() => { setSizeType(opt.id as any); if (opt.units) setCustomUnits(opt.units); }}
                      style={{
                        padding: '20px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid #f97316' : '1px solid #263244',
                        background: isSelected ? 'rgba(249, 115, 22, 0.05)' : 'var(--surface-soft)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: '16px', color: isSelected ? '#f97316' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {opt.title}
                        {isSelected && <CheckCircle2 size={18} color="#f97316" />}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </motion.div>
                  );
                })}
              </div>
              
              <AnimatePresence>
                {sizeType === 'Custom' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{ marginBottom: '32px', background: '#0b1120', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937' }}
                  >
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'white' }}>Enter Custom Unit Count:</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={customUnits} 
                      onChange={e => setCustomUnits(Number(e.target.value) || 0)} 
                      style={{ 
                        width: '100%', maxWidth: '300px', padding: '12px 16px', borderRadius: '12px', 
                        border: '1px solid #374151', background: '#111827', color: 'white', 
                        fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' 
                      }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e => e.target.style.borderColor = '#374151'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {sizeType && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ background: '#0b1120', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Factory size={16} color="#94a3b8" /> Micro Batch Breakdown
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: '#1f2937', padding: '4px 10px', borderRadius: '12px' }}>
                      {microBatches.length} Total Batches
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {microBatches.map(mb => (
                      <div 
                        key={mb.no} 
                        style={{ 
                          background: 'linear-gradient(to bottom, #1e293b, #0f172a)', 
                          padding: '8px 16px', 
                          borderRadius: '8px', 
                          border: '1px solid #334155', 
                          fontSize: '13px', 
                          fontWeight: 600,
                          color: '#e2e8f0',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>MB{mb.no}</span>
                        <span>{mb.qty} Units</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Ingredients & Stock Check */}
        <AnimatePresence>
          {sizeType && selectedProduct && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="page-card" 
              style={{ padding: '24px', background: '#111827', borderRadius: '24px', border: '1px solid #263244', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</div>
                <h2 style={{ fontSize: '20px', margin: 0, color: 'white' }}>Ingredient Review</h2>
              </div>
              
              {requiredIngredients === null ? (
                <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(220, 38, 38, 0.1)', color: '#ef4444', borderRadius: '16px', border: '1px dashed rgba(220, 38, 38, 0.3)' }}>
                  <AlertCircle size={40} style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>Formula Not Configured</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#fca5a5' }}>Please configure the formula for {selectedProduct.name} in settings to proceed.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <div style={{ borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', marginBottom: '24px', background: '#0b1120' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ background: '#1e293b', textAlign: 'left' }}>
                          <th style={{ padding: '16px', fontWeight: 600, color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>Ingredient Name</th>
                          <th style={{ padding: '16px', fontWeight: 600, color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>Required (KG)</th>
                          <th style={{ padding: '16px', fontWeight: 600, color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>Available (KG)</th>
                          <th style={{ padding: '16px', fontWeight: 600, color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>Remaining After Batch</th>
                          <th style={{ padding: '16px', fontWeight: 600, color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingredientStatus.map((ing: any, i: any) => (
                          <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '16px', fontWeight: 600, color: 'white' }}>{ing.name}</td>
                            <td style={{ padding: '16px', fontWeight: 'bold', color: '#e2e8f0' }}>{ing.required.toFixed(2)}</td>
                            <td style={{ padding: '16px', color: ing.sufficient ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                              {ing.available.toFixed(2)}
                            </td>
                            <td style={{ padding: '16px' }}>
                              {ing.sufficient ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>
                                  <CheckCircle2 size={14} /> SUFFICIENT
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>
                                  <AlertTriangle size={14} /> SHORTAGE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hasInsufficientStock ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ padding: '20px', background: 'linear-gradient(to right, rgba(220, 38, 38, 0.1), transparent)', color: '#ef4444', borderRadius: '16px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start', border: '1px solid rgba(220, 38, 38, 0.3)' }}
                    >
                      <div style={{ background: 'rgba(220, 38, 38, 0.2)', padding: '8px', borderRadius: '10px' }}>
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>Cannot Start Batch</div>
                        <div style={{ color: '#fca5a5', fontSize: '14px' }}>Material is not available in Inventory Room. Scan barcode first to release stock for production.</div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ padding: '20px', background: 'linear-gradient(to right, rgba(16, 185, 129, 0.1), transparent)', color: '#10b981', borderRadius: '16px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                    >
                      <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '10px' }}>
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Ready for Production</div>
                        <div style={{ color: '#6ee7b7', fontSize: '14px' }}>All required raw materials are safely in inventory.</div>
                      </div>
                    </motion.div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px', background: '#0b1120', padding: '24px', borderRadius: '16px', border: '1px solid #1f2937' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Produced By <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        type="text" 
                        placeholder="Operator Name"
                        value={producedBy} 
                        onChange={e => setProducedBy(e.target.value)} 
                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#334155'}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Notes (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="Add specific instructions or notes"
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#334155'}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid #263244', paddingTop: '24px' }}>
                    <button 
                      className="btn hover-lift" 
                      onClick={() => navigate('/inventory/production')}
                      style={{ padding: '14px 24px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600, fontSize: '15px' }}
                    >
                      Cancel
                    </button>
                    <div style={{ position: 'relative', cursor: !canStart ? 'not-allowed' : 'pointer' }} title={!canStart ? "Scan required raw materials into Inventory Room first" : ""}>
                      <button 
                        type="button"
                        className="btn hover-lift" 
                        style={{ 
                          padding: '14px 32px', 
                          borderRadius: '12px', 
                          background: canStart ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#1e293b', 
                          color: canStart ? 'white' : '#64748b', 
                          border: 'none', 
                          fontWeight: 'bold', 
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          boxShadow: canStart ? '0 4px 12px rgba(249, 115, 22, 0.3)' : 'none',
                          opacity: canStart ? 1 : 0.6,
                          pointerEvents: canStart ? 'auto' : 'none'
                        }}
                        disabled={!canStart} 
                        onClick={handleStartBatch}
                      >
                        <Play size={18} fill="currentColor" /> Start Production Batch
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default NewProductionBatch;
