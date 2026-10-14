import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../../../../services/inventoryService';
import { useIntakeContext } from './IntakeContext';
import { Package, X, ArrowRight, Loader2, Box, Layers, Shield, Boxes, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { PRIMARY_PACKAGING, SECONDARY_PACKAGING, TERTIARY_PACKAGING, INVENTORY_PACKAGING, PackagingMaterial, getPackagingTheme } from '../../../../config/packagingMaterials';
import { getRawMaterialTheme } from '../../../../config/rawMaterialThemes';

const MaterialCard = ({ 
  name, 
  category, 
  badge,
  unit,
  isPackaging = false,
  onClick 
}: { 
  name: string; 
  category?: string; 
  badge?: string;
  unit?: string;
  isPackaging?: boolean;
  onClick: () => void; 
}) => {
  if (isPackaging) {
    const pkgTheme = getPackagingTheme(name, category);
    const displayBadge = badge || 'PACKAGING';
    const displayUnit = unit || 'PCS';

    if (pkgTheme.isGradientBorder) {
      return (
        <div 
          onClick={onClick}
          className="p-[2px] rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-[0_6px_18px_rgba(0,0,0,0.15)] group h-full select-none"
          style={{ background: pkgTheme.borderGradientHex }}
        >
          <div 
            className="w-full h-full p-4 rounded-[14px] flex items-center gap-4 relative overflow-hidden"
            style={{ background: pkgTheme.background }}
          >
            {/* Icon Left */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${pkgTheme.iconBg} transition-transform duration-200 group-hover:scale-105`}>
              <Package size={24} className={pkgTheme.iconColor} />
            </div>
            
            {/* Content Middle */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="font-bold text-[15px] leading-tight text-[#0F172A] truncate mb-1.5">{name}</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${pkgTheme.badgeBg} ${pkgTheme.badgeText}`}>
                  {displayBadge}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-white/80 text-slate-700 border border-slate-200 shadow-2xs">
                  {displayUnit}
                </span>
              </div>
            </div>
            
            {/* Action Right */}
            <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border-2 ${pkgTheme.arrowBorder} ${pkgTheme.arrowColor} ${pkgTheme.arrowHoverBg} ${pkgTheme.arrowHoverColor} transition-all duration-200`}>
              <ArrowRight size={16} className="transform group-hover:translate-x-0.5 transition-transform duration-200" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        onClick={onClick}
        style={{
          background: pkgTheme.background,
          borderColor: pkgTheme.borderColorHex
        }}
        className="group flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-[0_6px_18px_rgba(0,0,0,0.15)] relative overflow-hidden gap-4 h-full select-none"
      >
        {/* Icon Left */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${pkgTheme.iconBg} transition-transform duration-200 group-hover:scale-105`}>
          <Package size={24} className={pkgTheme.iconColor} />
        </div>
        
        {/* Content Middle */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="font-bold text-[15px] leading-tight text-[#0F172A] truncate mb-1.5">{name}</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${pkgTheme.badgeBg} ${pkgTheme.badgeText}`}>
              {displayBadge}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-white/80 text-slate-700 border border-slate-200 shadow-2xs">
              {displayUnit}
            </span>
          </div>
        </div>
        
        {/* Action Right */}
        <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border-2 ${pkgTheme.arrowBorder} ${pkgTheme.arrowColor} ${pkgTheme.arrowHoverBg} ${pkgTheme.arrowHoverColor} transition-all duration-200`}>
          <ArrowRight size={16} className="transform group-hover:translate-x-0.5 transition-transform duration-200" />
        </div>
      </div>
    );
  }

  // Chemical & Active Raw Materials
  const themeConfig = getRawMaterialTheme(name, category);
  const displayBadge = badge || themeConfig?.badge || 'Material';
  const displayUnit = unit || themeConfig?.unit || 'KG';
  const displayBadgeStyle = themeConfig?.badgeStyle || 'bg-[#2563eb] text-white font-bold';

  return (
    <div 
      onClick={onClick}
      style={{ background: themeConfig.theme.background }}
      className={`group flex items-center p-4 rounded-2xl border cursor-pointer 
        ${themeConfig.theme.borderColor} shadow-sm 
        hover:-translate-y-[2px] ${themeConfig.theme.glow} transition-all duration-200
        relative overflow-hidden gap-4 h-full select-none
      `}
    >
      {/* Icon Left */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${themeConfig.theme.iconBg} transition-transform duration-200 group-hover:scale-105`}>
        <Package size={24} className={themeConfig.theme.iconColor} />
      </div>
      
      {/* Content Middle */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="font-bold text-[15px] leading-tight text-[#0f172a] truncate mb-1.5">{name}</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md ${displayBadgeStyle}`}>
            {displayBadge}
          </span>
          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-white/80 text-slate-700 border border-slate-200 shadow-2xs">
            {displayUnit}
          </span>
        </div>
      </div>
      
      {/* Action Right */}
      <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border ${themeConfig.theme.arrowBorder} ${themeConfig.theme.arrowColor} ${themeConfig.theme.arrowHoverBg} ${themeConfig.theme.arrowHoverColor} transition-all duration-200`}>
        <ArrowRight size={16} className="transform group-hover:translate-x-0.5 transition-transform duration-200" />
      </div>
    </div>
  );
};

const PackagingCategoryBlock = ({ 
  title, 
  description,
  icon,
  badgeColor,
  items, 
  onSelect 
}: { 
  title: string; 
  description: string;
  icon: React.ReactNode;
  badgeColor: string;
  items: PackagingMaterial[]; 
  onSelect: (item: any) => void; 
}) => {
  return (
    <div className="space-y-4">
      {/* Sub-category Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-lg font-bold text-white/90 tracking-tight">{title}</h3>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${badgeColor}`}>
              {items.length} Items
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 ml-6">{description}</p>
        </div>
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {items.map((item) => (
          <MaterialCard 
            key={item.id}
            name={item.name}
            category={item.category}
            badge={item.badge}
            unit={item.unit}
            isPackaging={true}
            onClick={() => onSelect({ id: item.id, name: item.name, category: item.category, unit: item.unit })}
          />
        ))}
      </div>
    </div>
  );
};

interface SectionDividerProps {
  color: 'cyan' | 'purple' | 'amber' | 'emerald';
}

const SectionDivider: React.FC<SectionDividerProps> = ({ color }) => {
  const colorMap = {
    cyan: {
      line: 'from-transparent via-cyan-500/35 to-transparent',
      glow: 'shadow-[0_0_12px_rgba(6,182,212,0.35)]',
      border: 'border-cyan-500/40',
      bg: 'bg-[#0b1726]/90 text-cyan-400',
    },
    purple: {
      line: 'from-transparent via-purple-500/35 to-transparent',
      glow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)]',
      border: 'border-purple-500/40',
      bg: 'bg-[#150d26]/90 text-purple-400',
    },
    amber: {
      line: 'from-transparent via-amber-500/35 to-transparent',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]',
      border: 'border-amber-500/40',
      bg: 'bg-[#1f1508]/90 text-amber-400',
    },
    emerald: {
      line: 'from-transparent via-emerald-500/35 to-transparent',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]',
      border: 'border-emerald-500/40',
      bg: 'bg-[#081f17]/90 text-emerald-400',
    },
  };

  const theme = colorMap[color];

  return (
    <div className="relative flex items-center justify-center my-11 py-2 w-full select-none">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className={`w-full h-[1px] bg-gradient-to-r ${theme.line}`} />
      </div>
      <div className={`relative px-3 py-0.5 text-[10px] font-bold tracking-widest uppercase rounded-full border ${theme.border} ${theme.bg} ${theme.glow} flex items-center justify-center backdrop-blur-md`}>
        ◆
      </div>
    </div>
  );
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
      index === self.findIndex(m => (m.name === 'Violet Colour' ? 'Pink Colour' : m.name) === (item.name === 'Violet Colour' ? 'Pink Colour' : item.name))
  );

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    
    // Validate Quantity Received (KG)
    const qty = Number(formData.quantity_received);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantity Received must be a valid number greater than zero.");
      return;
    }

    // Validate Price Per KG
    const price = Number(formData.price_per_kg);
    if (isNaN(price) || price < 0) {
      toast.error("Price Per KG must be a valid non-negative number.");
      return;
    }

    // Validate Vendor Name
    if (!formData.vendor_name.trim()) {
      toast.error("Vendor Name is required.");
      return;
    }

    // Validate PO Reference
    if (!formData.po_reference.trim()) {
      toast.error("PO Reference / Bill No is required.");
      return;
    }

    // Validate Scanning Person Name
    if (!formData.scanningPersonName.trim()) {
      toast.error("Scanning Person Name is required.");
      return;
    }
    
    // Auto-setup batch 1
    setBatches([{ id: crypto.randomUUID(), batch_no: 1, quantity: Number(qty.toFixed(2)) }]);
    
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
              const displayMatName = m.name === 'Violet Colour' ? 'Pink Colour' : m.name;
              return (
                <MaterialCard 
                  key={m.id}
                  name={displayMatName}
                  category={m.category}
                  onClick={() => setSelectedMaterial({ ...m, name: displayMatName })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* PACKAGING RAW MATERIALS SECTION */}
      <div className="mt-12 pt-6 border-t border-[var(--border)]/40">
        {/* Header & Subtitle */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Packaging Raw Materials</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 font-medium">
            Manage bottles, closures, labels, protective materials, and carton boxes.
          </p>
        </div>

        <div className="space-y-10">
          <PackagingCategoryBlock 
            title="Primary Packaging" 
            description="Bottles, caps, and branded product labels."
            icon={<Layers size={18} className="text-cyan-400" />}
            badgeColor="bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
            items={PRIMARY_PACKAGING} 
            onSelect={setSelectedMaterial} 
          />

          <SectionDivider color="cyan" />

          <PackagingCategoryBlock 
            title="Secondary Packaging" 
            description="Sealing and protective wrapping materials."
            icon={<Shield size={18} className="text-purple-400" />}
            badgeColor="bg-purple-500/10 text-purple-400 border-purple-500/20"
            items={SECONDARY_PACKAGING} 
            onSelect={setSelectedMaterial} 
          />

          <SectionDivider color="purple" />

          <PackagingCategoryBlock 
            title="Tertiary Packaging" 
            description="Carton boxes used for grouped dispatch packaging."
            icon={<Boxes size={18} className="text-amber-400" />}
            badgeColor="bg-amber-500/10 text-amber-400 border-amber-500/20"
            items={TERTIARY_PACKAGING} 
            onSelect={setSelectedMaterial} 
          />

          <SectionDivider color="amber" />

          <PackagingCategoryBlock 
            title="Inventory Packaging" 
            description="Materials used for sealing, addressing, barcode labeling, and inventory dispatch preparation."
            icon={<Tag size={18} className="text-emerald-400" />}
            badgeColor="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            items={INVENTORY_PACKAGING} 
            onSelect={setSelectedMaterial} 
          />

          <SectionDivider color="emerald" />
        </div>
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
                <h2 className="text-xl font-bold text-white">
                  {selectedMaterial.id?.startsWith('pack-') || selectedMaterial.category?.toLowerCase().includes('packaging') ? 'Receive Packaging Material' : 'Receive Raw Material'}
                </h2>
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
                  <label className="text-sm font-medium text-gray-300">Quantity Received ({selectedMaterial?.unit || 'KG'}) <span className="text-red-500">*</span></label>
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
                  <label className="text-sm font-medium text-gray-300">Price Per {selectedMaterial?.unit || 'KG'} (₹) <span className="text-red-500">*</span></label>
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
