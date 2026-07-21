import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, Plus, X, Tag, Archive, Loader2, AlertCircle, Edit2, Eye, FolderHeart } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import { departmentService } from '../../../services/departmentService';
import { useDepartmentSelection } from '../../../hooks/tasks/useDepartmentSelection';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import type { Department, DepartmentSection } from '../../../types';

export const RawMaterials = () => {
  const [viewMode, setViewMode] = useState<'materials' | 'categories'>('materials');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Material form state
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState({ 
    name: '', 
    unit: 'KG', 
    category: '', 
    description: '', 
    hsn_code: '', 
    color_code: '#2563eb' 
  });

  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Mappings
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);

  // Cascading Selection Hook
  const {
    departments: deptOptions,
    sections: sectOptions,
    selectedDeptId,
    selectedSectionId,
    setSelectedSectionId,
    handleDepartmentChange,
    isDeptsLoading,
    isSectionsLoading,
    deptsError,
    sectionsError
  } = useDepartmentSelection('', '');

  // Category Edit Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const {
    selectedDeptId: catDeptId,
    selectedSectionId: catSectId,
    setSelectedSectionId: setCatSectId,
    handleDepartmentChange: handleCatDeptChange,
    departments: catDeptOptions,
    sections: catSectOptions
  } = useDepartmentSelection('', '');

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

  const loadMappingsAndCategories = async () => {
    try {
      const { data: depts } = await departmentService.getAllDepartments();
      if (depts) setDepartments(depts);
      
      const { data: secs } = await departmentService.getAllSections();
      if (secs) setSections(secs);

      // Load or initialize categories mapping in localStorage
      let localCats = localStorage.getItem('inventory_categories');
      if (!localCats) {
        // Seed initial categories from default materials
        const initialCats = [
          { id: 'cat-1', category: 'Surfactant', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-2', category: 'Thickener', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-3', category: 'Base', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-4', category: 'Conditioning Agent', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-5', category: 'Preservative', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-6', category: 'Colorant', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-7', category: 'Solvent', department_id: '', section_id: '', status: 'active' },
          { id: 'cat-8', category: 'Fragrance', department_id: '', section_id: '', status: 'active' },
        ];
        localStorage.setItem('inventory_categories', JSON.stringify(initialCats));
        localCats = JSON.stringify(initialCats);
      }
      setInventoryCategories(JSON.parse(localCats));
    } catch (err) {
      console.error('Failed to load mappings:', err);
    }
  };

  useEffect(() => {
    fetchMaterials();
    loadMappingsAndCategories();
  }, []);

  const getDeptName = (id: string | null) => {
    if (!id) return '-';
    const match = departments.find(d => String(d.id) === String(id));
    return match ? match.department_name : String(id);
  };

  const getSectionName = (id: string | null) => {
    if (!id) return '-';
    const match = sections.find(s => String(s.id) === String(id));
    return match ? match.section_name : String(id);
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter((m: any) => {
      const q = searchTerm.toLowerCase();
      const nameMatch = m.name.toLowerCase().includes(q);
      const catMatch = m.category && m.category.toLowerCase().includes(q);
      const deptMatch = getDeptName(m.department_id).toLowerCase().includes(q);
      const sectMatch = getSectionName(m.section_id).toLowerCase().includes(q);
      return nameMatch || catMatch || deptMatch || sectMatch;
    });
  }, [materials, searchTerm, departments, sections]);

  const totalCategoriesCount = useMemo(() => {
    return new Set(materials.map((m: any) => m.category).filter(Boolean)).size;
  }, [materials]);

  const isFormValid = newMaterial.name.trim() !== '' && newMaterial.category.trim() !== '' && newMaterial.unit.trim() !== '' && selectedDeptId && selectedSectionId;

  // Handle auto-populating department/section from selected category
  const handleCategoryChange = (catName: string) => {
    setNewMaterial(prev => ({ ...prev, category: catName }));
    const mapping = inventoryCategories.find(c => c.category === catName && c.status === 'active');
    if (mapping) {
      if (mapping.department_id) {
        handleDepartmentChange(mapping.department_id);
        if (mapping.section_id) {
          // Allow some time for sections list to load, then select section
          setTimeout(() => {
            setSelectedSectionId(mapping.section_id);
          }, 150);
        }
      }
    }
  };

  const handleOpenAddModal = () => {
    setSelectedMaterialId(null);
    setNewMaterial({ name: '', unit: 'KG', category: '', description: '', hsn_code: '', color_code: '#2563eb' });
    handleDepartmentChange('');
    setSelectedSectionId('');
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMaterialId(material.id);
    setNewMaterial({
      name: material.name || '',
      unit: material.unit || 'KG',
      category: material.category || '',
      description: material.description || '',
      hsn_code: material.hsn_code || '',
      color_code: material.color_code || '#2563eb'
    });
    handleDepartmentChange(material.department_id || '');
    // Wait for sections to load before setting section ID
    setTimeout(() => {
      setSelectedSectionId(material.section_id || '');
    }, 150);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (material: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMaterialId(material.id);
    setNewMaterial({
      name: material.name || '',
      unit: material.unit || 'KG',
      category: material.category || '',
      description: material.description || '',
      hsn_code: material.hsn_code || '',
      color_code: material.color_code || '#2563eb'
    });
    handleDepartmentChange(material.department_id || '');
    setTimeout(() => {
      setSelectedSectionId(material.section_id || '');
    }, 150);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'view') return;
    if (!isFormValid || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        ...newMaterial,
        department_id: selectedDeptId,
        section_id: selectedSectionId,
        created_at: new Date().toISOString()
      };

      if (modalMode === 'edit' && selectedMaterialId) {
        await inventoryService.updateMaterial(selectedMaterialId, payload);
        toast.success("Material updated successfully");
      } else {
        await inventoryService.saveMaterial(payload);
        toast.success("Material created successfully");
      }
      
      setIsModalOpen(false);
      await fetchMaterials();
    } catch (error) {
      console.error("Error saving material:", error);
      toast.error("Failed to save material");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Category management ---
  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    handleCatDeptChange(cat.department_id || '');
    setTimeout(() => {
      setCatSectId(cat.section_id || '');
    }, 150);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategoryMapping = () => {
    if (!editingCategory) return;
    const updated = inventoryCategories.map(c => {
      if (c.id === editingCategory.id) {
        return { ...c, department_id: catDeptId, section_id: catSectId };
      }
      return c;
    });
    localStorage.setItem('inventory_categories', JSON.stringify(updated));
    setInventoryCategories(updated);
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    toast.success("Category link updated successfully");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-200">
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
          <div className="flex flex-col p-3 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Materials</span>
            <span className="text-2xl font-bold text-white">{materials.length}</span>
          </div>
          <div className="flex flex-col p-3 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</span>
            <span className="text-2xl font-bold text-white">{totalCategoriesCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button 
          onClick={() => setViewMode('materials')} 
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${viewMode === 'materials' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
        >
          Raw Materials List
        </button>
        <button 
          onClick={() => setViewMode('categories')} 
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${viewMode === 'categories' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
        >
          Inventory Categories
        </button>
      </div>

      {viewMode === 'materials' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-border">
            <div className="relative w-full sm:max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search raw materials, categories, departments..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full h-11 pl-10 pr-4 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <button 
              className="w-full sm:w-auto h-11 px-5 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
              onClick={handleOpenAddModal}
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
                  <div key={material.id} className="group flex flex-col p-5 rounded-2xl border border-slate-700 hover:border-primary/50 transition-all duration-300" style={{ background: 'var(--card)' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                        <Archive size={20} className="text-primary" />
                      </div>
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-900 border border-slate-700 text-gray-300">
                        {material.unit}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{material.name}</h3>
                    
                    <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-2">
                      <Tag size={14} />
                      <span>Category: {material.category}</span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 mb-4 border-t border-slate-700/50 pt-2">
                      <div><strong>Dept:</strong> {getDeptName(material.department_id)}</div>
                      <div><strong>Section:</strong> {getSectionName(material.section_id)}</div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-700/50 flex gap-2">
                      <button 
                        onClick={(e) => handleOpenViewModal(material, e)}
                        className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button 
                        onClick={(e) => handleOpenEditModal(material, e)}
                        className="flex-1 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-900/50 rounded-lg text-indigo-400 text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredMaterials?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 px-4 border border-dashed border-border rounded-2xl bg-surface/30">
                  <div className="p-4 rounded-full bg-slate-900 border border-slate-700 mb-4">
                    <AlertCircle size={32} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No raw materials found</h3>
                  <p className="text-muted-foreground text-center max-w-sm mb-6">
                    You haven't added any raw materials matching your search criteria.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {viewMode === 'categories' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-700 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">Category Name</th>
                <th className="px-6 py-4">Linked Department</th>
                <th className="px-6 py-4">Linked Section</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-750">
              {inventoryCategories.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-750/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{cat.category}</td>
                  <td className="px-6 py-4">{getDeptName(cat.department_id)}</td>
                  <td className="px-6 py-4">{getSectionName(cat.section_id)}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleOpenEditCategory(cat)} 
                      className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <Edit2 size={16} /> Link Dept/Sect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-900/50">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {modalMode === 'view' ? 'View Material' : modalMode === 'edit' ? 'Edit Material' : 'Add New Material'}
                </h2>
                <p className="text-sm text-slate-400 mt-1">Enter the details for the new inventory material.</p>
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
            <form onSubmit={handleAddOrUpdate} className="p-6 text-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Material Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={newMaterial.name} 
                    onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} 
                    placeholder="e.g. SLES Paste 70%" 
                    className="h-11 px-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    disabled={isSubmitting || modalMode === 'view'}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select 
                    required 
                    value={newMaterial.category} 
                    onChange={e => handleCategoryChange(e.target.value)} 
                    className="h-11 px-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSubmitting || modalMode === 'view'}
                  >
                    <option value="">Select Category</option>
                    {inventoryCategories.map(c => (
                      <option key={c.id} value={c.category}>{c.category}</option>
                    ))}
                  </select>
                </div>

                {/* Department Dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Department *
                  </label>
                  <select 
                    required 
                    value={selectedDeptId} 
                    onChange={e => handleDepartmentChange(e.target.value)} 
                    className="h-11 px-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSubmitting || isDeptsLoading || modalMode === 'view'}
                  >
                    <option value="">{isDeptsLoading ? 'Loading departments...' : 'Select Department'}</option>
                    {deptOptions.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </div>

                {/* Section Dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Section *
                  </label>
                  <select 
                    required 
                    value={selectedSectionId} 
                    onChange={e => setSelectedSectionId(e.target.value)} 
                    className="h-11 px-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSubmitting || !selectedDeptId || isSectionsLoading || modalMode === 'view'}
                  >
                    <option value="">
                      {!selectedDeptId 
                        ? 'Select department first' 
                        : isSectionsLoading 
                        ? 'Loading sections...' 
                        : sectOptions.length === 0 
                        ? 'No sections' 
                        : 'Select Section'
                      }
                    </option>
                    {sectOptions.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.section_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Default Unit <span className="text-red-500">*</span>
                  </label>
                  <select 
                    required
                    value={newMaterial.unit} 
                    onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}
                    className="h-11 px-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none"
                    disabled={isSubmitting || modalMode === 'view'}
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
                    className="h-11 px-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    disabled={isSubmitting || modalMode === 'view'}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">
                  Description
                </label>
                <textarea 
                  value={newMaterial.description} 
                  onChange={e => setNewMaterial({...newMaterial, description: e.target.value})} 
                  placeholder="Enter detailed material description..." 
                  className="min-h-[100px] p-3 bg-slate-900 border border-slate-750 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  disabled={isSubmitting || modalMode === 'view'}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-700">
                <button 
                  type="button" 
                  className="w-full sm:w-auto h-11 px-6 bg-transparent hover:bg-slate-800 border border-slate-700 text-gray-300 font-medium rounded-lg transition-all" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                {modalMode !== 'view' && (
                  <button 
                    type="submit" 
                    className={`w-full sm:w-auto h-11 px-6 flex items-center justify-center gap-2 font-medium rounded-lg shadow-lg transition-all ${
                      !isFormValid || isSubmitting 
                        ? 'bg-slate-700 text-gray-500 cursor-not-allowed shadow-none' 
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-900/20'
                    }`}
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Save Material'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Link Modal */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200 bg-slate-800 text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-900/50">
              <h2 className="text-lg font-bold text-white">Link Category: {editingCategory.category}</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Department</label>
                <select 
                  value={catDeptId} 
                  onChange={e => handleCatDeptChange(e.target.value)} 
                  className="h-11 px-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">Select Department</option>
                  {catDeptOptions.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.department_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Section</label>
                <select 
                  value={catSectId} 
                  onChange={e => setCatSectId(e.target.value)} 
                  disabled={!catDeptId}
                  className="h-11 px-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">Select Section</option>
                  {catSectOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.section_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button 
                  onClick={() => setIsCategoryModalOpen(false)} 
                  className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-750"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCategoryMapping} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium"
                >
                  Save Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawMaterials;
