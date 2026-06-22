import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../../../../services/inventoryService';
import { useIntakeContext } from './IntakeContext';
import { Package, X, ArrowRight, Loader2, Box } from 'lucide-react';

const getCategoryStyles = (matName: string, category: string = '') => {
  const name = matName.toLowerCase();
  const cat = category.toLowerCase();

  if (name.includes('sles') || name.includes('capb') || name.includes('aos') || cat.includes('surfactant')) {
    return { bg: 'from-blue-500/10 to-indigo-900/10', border: 'border-blue-500/30', glow: 'hover:shadow-blue-500/20', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', unit: 'KG', badge: 'Surfactant' };
  }
  if (name.includes('salt') || cat.includes('thickener')) {
    return { bg: 'from-slate-400/10 to-slate-800/10', border: 'border-slate-500/30', glow: 'hover:shadow-slate-500/20', iconBg: 'bg-slate-500/20', iconColor: 'text-slate-400', unit: 'KG', badge: 'Thickener' };
  }
  if (name.includes('fragrance') || cat.includes('fragrance')) {
    return { bg: 'from-amber-500/10 to-orange-900/10', border: 'border-amber-500/30', glow: 'hover:shadow-amber-500/20', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400', unit: 'LTR', badge: 'Fragrance' };
  }
  if (name.includes('phenoxy') || name.includes('benzoate') || cat.includes('preservative')) {
    return { bg: 'from-pink-500/10 to-rose-900/10', border: 'border-pink-500/30', glow: 'hover:shadow-pink-500/20', iconBg: 'bg-pink-500/20', iconColor: 'text-pink-400', unit: 'KG', badge: 'Preservative' };
  }
  if (name.includes('colour') || name.includes('color') || cat.includes('colorant')) {
    let colorCode = 'violet';
    if (name.includes('yellow')) colorCode = 'yellow';
    if (name.includes('blue')) colorCode = 'cyan';
    
    if (colorCode === 'yellow') {
      return { bg: 'from-yellow-500/10 to-amber-900/10', border: 'border-yellow-500/30', glow: 'hover:shadow-yellow-500/20', iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', unit: 'KG', badge: 'Colorant' };
    }
    if (colorCode === 'cyan') {
      return { bg: 'from-cyan-500/10 to-blue-900/10', border: 'border-cyan-500/30', glow: 'hover:shadow-cyan-500/20', iconBg: 'bg-cyan-500/20', iconColor: 'text-cyan-400', unit: 'KG', badge: 'Colorant' };
    }
    return { bg: 'from-violet-500/10 to-purple-900/10', border: 'border-violet-500/30', glow: 'hover:shadow-violet-500/20', iconBg: 'bg-violet-500/20', iconColor: 'text-violet-400', unit: 'KG', badge: 'Colorant' };
  }
  if (name.includes('water') || cat.includes('solvent')) {
    return { bg: 'from-cyan-500/10 to-teal-900/10', border: 'border-cyan-500/30', glow: 'hover:shadow-cyan-500/20', iconBg: 'bg-cyan-500/20', iconColor: 'text-cyan-400', unit: 'LTR', badge: 'Solvent' };
  }
  if (name.includes('base') || name.includes('n-cap') || cat.includes('conditioning')) {
    return { bg: 'from-green-500/10 to-emerald-900/10', border: 'border-green-500/30', glow: 'hover:shadow-green-500/20', iconBg: 'bg-green-500/20', iconColor: 'text-green-400', unit: 'KG', badge: 'Base/Conditioning' };
  }

  return { bg: 'from-indigo-500/10 to-violet-900/10', border: 'border-indigo-500/30', glow: 'hover:shadow-indigo-500/20', iconBg: 'bg-indigo-500/20', iconColor: 'text-indigo-400', unit: 'KG', badge: 'Material' };
};

const IntakeStep1_Form = () => {
  const navigate = useNavigate();
  const { selectedMaterial, setSelectedMaterial, formData, setFormData, setBatches } = useIntakeContext();
  
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const data = await inventoryService.getMaterials();
        setRawMaterials(data);
      } catch (err) {
        console.error('Failed to load materials locally', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const uniqueMaterials = rawMaterials.filter(
    (item: any, index: number, self: any[]) =>
      index === self.findIndex(m => m.name === item.name)
  );

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    
    const qty = Number(formData.quantity_received) || 0;
    // Auto-setup batch 1
    setBatches([{ id: crypto.randomUUID(), batch_no: 1, quantity: qty }]);
    
    navigate('/inventory/raw-material/intake/split-batches');
  };

  const baseAmount = (Number(formData.quantity_received) || 0) * (Number(formData.price_per_kg) || 0);
  const gstAmount = baseAmount * ((Number(formData.gst_percent) || 0) / 100);
  const totalAmount = baseAmount + gstAmount;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* SIMPLE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">Raw Material Intake</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] rounded-lg font-medium text-xs">
          <Box size={14} /> 15 Materials
        </div>
      </div>

      <div className="space-y-6">
        {loading && rawMaterials.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <span className="text-muted-foreground">Loading materials from local storage...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {uniqueMaterials.map((m: any) => {
              const styles = getCategoryStyles(m.name, m.category);
              return (
                <div 
                  key={m.id} 
                  onClick={() => setSelectedMaterial(m)}
                  className={`group flex items-center p-4 rounded-xl border transition-all duration-300 cursor-pointer 
                    bg-gradient-to-r ${styles.bg} ${styles.border} 
                    hover:-translate-y-1 hover:shadow-xl ${styles.glow}
                    relative overflow-hidden gap-4 h-full
                  `}
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${styles.iconBg.replace('bg-', 'bg-').replace('/20', '')}`} style={{ opacity: 0.8 }} />
                  
                  {/* Icon Left */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-inner ${styles.iconBg} ring-1 ring-white/10`}>
                    <Package size={24} className={styles.iconColor} />
                  </div>
                  
                  {/* Content Middle */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-bold text-[15px] leading-tight text-white group-hover:text-white transition-colors truncate mb-1.5">{m.name}</h3>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${styles.border} ${styles.iconColor} bg-black/20 backdrop-blur-sm`}>
                        {styles.badge}
                      </span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--surface)]/50 text-[var(--text-muted)] border border-[var(--border)] backdrop-blur-sm">
                        {styles.unit}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Right */}
                  <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[var(--surface-soft)] opacity-60 group-hover:opacity-100 group-hover:bg-white/5 transition-all duration-300 border border-[var(--border)]/50">
                    <ArrowRight size={16} className={`${styles.iconColor} transform group-hover:translate-x-0.5 transition-transform duration-300`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] bg-[var(--surface)]/50">
              <div>
                <h2 className="text-xl font-bold text-white">Receive Raw Material</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Selected Material: <strong className="text-primary font-semibold">{selectedMaterial.name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setSelectedMaterial(null)} 
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleNext} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Quantity Received (KG) <span className="text-red-500">*</span></label>
                  <input 
                    required type="number" step="0.1" min="0.1" 
                    value={formData.quantity_received} 
                    onChange={e => setFormData({...formData, quantity_received: e.target.value})} 
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    autoFocus 
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Vendor Name <span className="text-red-500">*</span></label>
                  <input 
                    required type="text" 
                    value={formData.vendor_name} 
                    onChange={e => setFormData({...formData, vendor_name: e.target.value})} 
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Price Per KG (₹) <span className="text-red-500">*</span></label>
                  <input 
                    required type="number" step="0.01" min="0" 
                    value={formData.price_per_kg} 
                    onChange={e => setFormData({...formData, price_per_kg: e.target.value})} 
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">PO Reference / Bill No <span className="text-red-500">*</span></label>
                  <input 
                    required type="text" 
                    value={formData.po_reference} 
                    onChange={e => setFormData({...formData, po_reference: e.target.value})} 
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">GST % <span className="text-red-500">*</span></label>
                  <select 
                    required 
                    value={formData.gst_percent} 
                    onChange={e => setFormData({...formData, gst_percent: e.target.value})}
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Received Date</label>
                  <input 
                    type="date" 
                    value={formData.date_received} 
                    onChange={e => setFormData({...formData, date_received: e.target.value})} 
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Scanning Person Name <span className="text-red-500">*</span></label>
                  <input 
                    required type="text" 
                    value={formData.scanningPersonName} 
                    onChange={e => setFormData({...formData, scanningPersonName: e.target.value})} 
                    className="h-11 px-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <label className="text-sm font-medium text-gray-300">Notes (Optional)</label>
                <textarea 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Additional receipt notes..."
                  className="min-h-[80px] p-3 bg-background border border-[var(--border)] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
                />
              </div>

              {/* Financial Summary */}
              <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] grid grid-cols-1 sm:grid-cols-3 gap-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 w-1 h-full bg-primary/50" />
                <div className="flex flex-col pl-2">
                  <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Base Amount</span>
                  <span className="text-lg font-semibold text-white">₹{baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col border-l border-[var(--border)] pl-4">
                  <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">GST Amount</span>
                  <span className="text-lg font-semibold text-white">₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col sm:items-end border-l border-[var(--border)] pl-4 sm:border-none sm:pl-0">
                  <span className="text-xs text-primary uppercase tracking-wider font-bold">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border)]">
                <button 
                  type="button" 
                  onClick={() => setSelectedMaterial(null)}
                  className="h-11 px-6 bg-[var(--surface)] hover:bg-[var(--surface-soft)] border border-[var(--border)] text-gray-300 font-medium rounded-xl transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!selectedMaterial}
                  className="h-11 px-6 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntakeStep1_Form;
