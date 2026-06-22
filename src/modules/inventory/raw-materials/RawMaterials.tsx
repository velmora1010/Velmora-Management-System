import { useState, useEffect } from 'react';
import { Package, Search, Plus, X, Tag, Archive, Loader2, AlertCircle } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import toast from 'react-hot-toast';

export const RawMaterials = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'KG', category: '', description: '', hsn_code: '', color_code: '#2563eb' });

  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getMaterials();
      setMaterials(data || []);
      setError(null);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const filteredMaterials = materials.filter((m: any) => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalCategories = new Set(materials.map((m: any) => m.category)).size;

  const isFormValid = newMaterial.name.trim() !== '' && newMaterial.category.trim() !== '' && newMaterial.unit.trim() !== '';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await inventoryService.saveMaterial({
        ...newMaterial,
        created_at: new Date().toISOString()
      });
      
      setIsModalOpen(false);
      setNewMaterial({ name: '', unit: 'KG', category: '', description: '', hsn_code: '', color_code: '#2563eb' });
      await fetchMaterials();
    } catch (error) {
      console.error("Error creating material:", error);
      toast.error("Failed to create material");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-border">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Package className="text-primary" size={28} />
            Raw Materials Master
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Manage all foundational inventory items, material categories, and unit classifications. Create and define new raw materials before stock intake.
          </p>
        </div>
        
        <div className="flex gap-4">
          {/* Stats Cards */}
          <div className="flex flex-col p-3 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Materials</span>
            <span className="text-2xl font-bold text-white">{materials.length}</span>
          </div>
          <div className="flex flex-col p-3 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</span>
            <span className="text-2xl font-bold text-white">{totalCategories}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="relative w-full sm:max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search raw materials..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full h-11 pl-10 pr-4 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <button 
          className="w-full sm:w-auto h-11 px-5 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} /> Add New Material
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-red-500/20 rounded-2xl bg-red-500/10 text-center">
          <AlertCircle size={32} className="text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-red-500 mb-2">Failed to load materials</h3>
          <p className="text-red-400/80 max-w-md">{error.message}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMaterials?.map((material: any) => (
              <div key={material.id} className="group flex flex-col p-5 rounded-2xl border border-border hover:border-primary/50 transition-all duration-300" style={{ background: 'var(--card)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-lg bg-surface border border-border">
                    <Archive size={20} className="text-primary" />
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-surface border border-border text-gray-300">
                    {material.unit}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{material.name}</h3>
                
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                  <Tag size={14} />
                  <span>{material.category}</span>
                </div>

                <div className="mt-auto pt-4 border-t border-border/50 space-y-2 text-sm">
                  {material.hsn_code ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HSN Code</span>
                      <span className="font-mono text-gray-300">{material.hsn_code}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HSN Code</span>
                      <span className="text-gray-600 italic">Not set</span>
                    </div>
                  )}
                  {material.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 mt-2">{material.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredMaterials?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 px-4 border border-dashed border-border rounded-2xl bg-surface/30">
              <div className="p-4 rounded-full bg-surface border border-border mb-4">
                <AlertCircle size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No raw materials found</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-6">
                You haven't added any raw materials matching your search criteria.
              </p>
              <button 
                className="h-10 px-4 flex items-center justify-center gap-2 bg-surface hover:bg-surface-soft border border-border text-white font-medium rounded-lg transition-all"
                onClick={() => {
                  setSearchTerm('');
                  setIsModalOpen(true);
                }}
              >
                <Plus size={16} /> Add First Material
              </button>
            </div>
          )}
        </>
      )}

      {/* Premium Glassmorphism Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface/50">
              <div>
                <h2 className="text-xl font-bold text-white">Add New Material</h2>
                <p className="text-sm text-muted-foreground mt-1">Enter the details for the new inventory material.</p>
              </div>
              <button 
                onClick={() => !isSubmitting && setIsModalOpen(false)} 
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleAdd} className="p-6">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Material Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-1">
                    Material Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={newMaterial.name} 
                    onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} 
                    placeholder="e.g. SLES Paste 70%" 
                    className="h-11 px-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={newMaterial.category} 
                    onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} 
                    placeholder="e.g. Surfactant" 
                    className="h-11 px-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    disabled={isSubmitting}
                  />
                  <span className="text-xs text-muted-foreground">Example: Surfactant, Preservative, Fragrance</span>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-1">
                    Default Unit <span className="text-red-500">*</span>
                  </label>
                  <select 
                    required
                    value={newMaterial.unit} 
                    onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}
                    className="h-11 px-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    disabled={isSubmitting}
                  >
                    <option value="KG">Kilograms (KG)</option>
                    <option value="L">Liters (L)</option>
                    <option value="PCS">Pieces (PCS)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    HSN Code
                  </label>
                  <input 
                    type="text" 
                    value={newMaterial.hsn_code} 
                    onChange={e => setNewMaterial({...newMaterial, hsn_code: e.target.value})} 
                    placeholder="e.g. 3402" 
                    className="h-11 px-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
                    disabled={isSubmitting}
                  />
                  <span className="text-xs text-muted-foreground">Optional GST classification code</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <label className="text-sm font-medium text-gray-300">
                  Description
                </label>
                <textarea 
                  value={newMaterial.description} 
                  onChange={e => setNewMaterial({...newMaterial, description: e.target.value})} 
                  placeholder="Enter detailed material description, handling instructions, or notes..." 
                  className="min-h-[100px] p-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
                  disabled={isSubmitting}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-border">
                <button 
                  type="button" 
                  className="w-full sm:w-auto h-11 px-6 bg-transparent hover:bg-surface border border-border text-gray-300 font-medium rounded-lg transition-all" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`w-full sm:w-auto h-11 px-6 flex items-center justify-center gap-2 font-medium rounded-lg shadow-lg transition-all ${
                    !isFormValid || isSubmitting 
                      ? 'bg-surface border border-border text-gray-500 cursor-not-allowed shadow-none' 
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-900/20'
                  }`}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Material'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawMaterials;
