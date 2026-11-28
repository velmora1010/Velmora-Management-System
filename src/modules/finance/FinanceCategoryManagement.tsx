import { useState, useMemo } from 'react';
import { Trash2, Edit2, Search, X, ChevronRight, ChevronLeft, Plus, Folder, Briefcase, Tags, Layers, Component } from 'lucide-react';
import { useFinanceCategories, type FinanceCategoryRow } from '../../hooks/finance/useFinanceCategories';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import { searchCategoryPaths, type CategorySearchResult } from './services/categorySearchUtils';

export const FinanceCategoryManagement = () => {
  const {
    categories,
    isLoading,
    fetchCategories,
    saveCategoryRow,
    archiveCategory
  } = useFinanceCategories();

  // Selected paths
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [selectedSub1, setSelectedSub1] = useState<string>('');
  const [selectedSub2, setSelectedSub2] = useState<string>('');
  const [selectedSub3, setSelectedSub3] = useState<string>('');

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Mode State
  const [addingTo, setAddingTo] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [newValue, setNewValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Mode State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Delete State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // --- Derived Data ---
  
  // Level 1: Departments (main)
  const departments = useMemo(() => {
    return Array.from(new Set(categories.map(c => c.main).filter(Boolean))) as string[];
  }, [categories]);

  // Level 2: Categories (sub1)
  const currentCategories = useMemo(() => {
    if (!selectedDept) return [];
    const filtered = categories.filter(c => c.main === selectedDept && c.sub1 && c.sub1 !== '-');
    return Array.from(new Set(filtered.map(c => c.sub1))) as string[];
  }, [categories, selectedDept]);

  // Level 3: Sub Category 1 (sub2)
  const currentSub1s = useMemo(() => {
    if (!selectedDept || !selectedCat) return [];
    const filtered = categories.filter(c => c.main === selectedDept && c.sub1 === selectedCat && c.sub2 && c.sub2 !== '-');
    return Array.from(new Set(filtered.map(c => c.sub2))) as string[];
  }, [categories, selectedDept, selectedCat]);

  // Level 4: Sub Category 2 (sub3)
  const currentSub2s = useMemo(() => {
    if (!selectedDept || !selectedCat || !selectedSub1) return [];
    const filtered = categories.filter(c => 
      c.main === selectedDept && c.sub1 === selectedCat && c.sub2 === selectedSub1 && c.sub3 && c.sub3 !== '-'
    );
    return Array.from(new Set(filtered.map(c => c.sub3))) as string[];
  }, [categories, selectedDept, selectedCat, selectedSub1]);

  // Level 5: Sub Category 3 (sub4)
  const currentSub3Rows = useMemo(() => {
    if (!selectedDept || !selectedCat || !selectedSub1 || !selectedSub2) return [];
    return categories.filter(c => 
      c.main === selectedDept && c.sub1 === selectedCat && c.sub2 === selectedSub1 && c.sub3 === selectedSub2 && c.sub4 && c.sub4 !== '-'
    );
  }, [categories, selectedDept, selectedCat, selectedSub1, selectedSub2]);

  const mobileActiveLevel = !selectedDept ? 1 : !selectedCat ? 2 : !selectedSub1 ? 3 : !selectedSub2 ? 4 : 5;


  // --- Selection Handlers ---

  const handleSelectDept = (dept: string) => {
    setSelectedDept(dept);
    setSelectedCat('');
    setSelectedSub1('');
    setSelectedSub2('');
    setSelectedSub3('');
    setAddingTo(null);
  };

  const handleSelectCat = (cat: string) => {
    setSelectedCat(cat);
    setSelectedSub1('');
    setSelectedSub2('');
    setSelectedSub3('');
    setAddingTo(null);
  };

  const handleSelectSub1 = (sub1: string) => {
    setSelectedSub1(sub1);
    setSelectedSub2('');
    setSelectedSub3('');
    setAddingTo(null);
  };

  const handleSelectSub2 = (sub2: string) => {
    setSelectedSub2(sub2);
    setSelectedSub3('');
    setAddingTo(null);
  };

  const searchResults = useMemo(
    () => searchCategoryPaths(categories, searchQuery),
    [categories, searchQuery]
  );

  const handleSelectSearchResult = (result: CategorySearchResult) => {
    setSelectedDept(result.selection.dept);
    setSelectedCat(result.selection.cat);
    setSelectedSub1(result.selection.sub1);
    setSelectedSub2(result.selection.sub2);
    setSelectedSub3(result.selection.sub3);
    setAddingTo(null);
    setEditingId(null);
  };

  // --- Add/Edit Handlers ---

  const handleSaveNew = async () => {
    if (!newValue.trim()) return toast.error('Please enter a name.');
    setIsSubmitting(true);
    try {
      if (addingTo === 1) {
        await saveCategoryRow(null, { main: newValue.trim() });
      } else if (addingTo === 2) {
        await saveCategoryRow(null, { main: selectedDept, sub1: newValue.trim() });
      } else if (addingTo === 3) {
        await saveCategoryRow(null, { main: selectedDept, sub1: selectedCat, sub2: newValue.trim() });
      } else if (addingTo === 4) {
        await saveCategoryRow(null, { main: selectedDept, sub1: selectedCat, sub2: selectedSub1, sub3: newValue.trim() });
      } else if (addingTo === 5) {
        await saveCategoryRow(null, { main: selectedDept, sub1: selectedCat, sub2: selectedSub1, sub3: selectedSub2, sub4: newValue.trim() });
      }
      toast.success('Saved successfully!');
      setNewValue('');
      setAddingTo(null);
      await fetchCategories();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (level: number, oldVal: string) => {
    if (!editValue.trim()) return;
    setIsSubmitting(true);
    try {
      let targetRow: FinanceCategoryRow | undefined;
      
      if (level === 1) targetRow = categories.find(c => c.main === oldVal);
      if (level === 2) targetRow = categories.find(c => c.main === selectedDept && c.sub1 === oldVal);
      if (level === 3) targetRow = categories.find(c => c.main === selectedDept && c.sub1 === selectedCat && c.sub2 === oldVal);
      if (level === 4) targetRow = categories.find(c => c.main === selectedDept && c.sub1 === selectedCat && c.sub2 === selectedSub1 && c.sub3 === oldVal);
      if (level === 5) targetRow = categories.find(c => c.id === editingId);

      if (targetRow) {
        const payload: Partial<FinanceCategoryRow> = {
          main: level === 1 ? editValue.trim() : targetRow.main,
          sub1: level === 2 ? editValue.trim() : targetRow.sub1,
          sub2: level === 3 ? editValue.trim() : targetRow.sub2,
          sub3: level === 4 ? editValue.trim() : targetRow.sub3,
          sub4: level === 5 ? editValue.trim() : targetRow.sub4,
        };
        await saveCategoryRow(targetRow.id, payload);
        toast.success('Updated successfully!');
        
        if (level === 1 && selectedDept === oldVal) setSelectedDept(editValue.trim());
        if (level === 2 && selectedCat === oldVal) setSelectedCat(editValue.trim());
        if (level === 3 && selectedSub1 === oldVal) setSelectedSub1(editValue.trim());
        if (level === 4 && selectedSub2 === oldVal) setSelectedSub2(editValue.trim());
        
        setEditingId(null);
        await fetchCategories();
      }
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrigger = (level: number, val: string, id?: string) => {
    if (id) {
      setCategoryToDelete(id);
      setIsConfirmOpen(true);
    } else {
      toast.error('You can only delete leaf nodes directly.');
    }
  };

  const executeDelete = async () => {
    if (categoryToDelete) {
      await archiveCategory(categoryToDelete);
      setCategoryToDelete(null);
      toast.success('Deleted successfully!');
    }
  };

  // --- Render Helpers ---
  
  const renderColumn = (
    title: string, 
    level: number, 
    items: string[] | FinanceCategoryRow[], 
    selectedItem: string, 
    onSelect: (val: string) => void,
    icon: React.ReactNode,
    isActive: boolean,
    breadcrumbs: string[] = [],
    onBack?: () => void
  ) => {
    return (
      <div className={`w-1/5 md:w-auto shrink-0 flex flex-col h-full border-r border-border/50 transition-all ${isActive ? 'bg-card/50' : 'bg-background/30 opacity-50 md:opacity-50 pointer-events-none md:pointer-events-none'}`}>
        {level > 1 && (
          <div className="md:hidden flex items-center gap-2 p-3 bg-card border-b border-border/50 shrink-0 shadow-sm z-10">
            <button 
              onClick={(e) => { e.stopPropagation(); onBack && onBack(); }}
              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-muted hover:text-main transition-colors pointer-events-auto"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-muted truncate">
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1.5 shrink-0 min-w-0">
                  <span className="truncate max-w-[80px] sm:max-w-[120px] font-medium">{crumb}</span>
                  {idx < breadcrumbs.length - 1 && <ChevronRight size={12} className="opacity-50 shrink-0" />}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4 border-b border-border/50 hidden md:flex items-center gap-2 bg-card shrink-0">
          <div className="text-primary">{icon}</div>
          <h3 className="font-semibold text-main text-sm">{title}</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {items.map((item, idx) => {
            const isRowObj = typeof item === 'object';
            const val = isRowObj ? item.sub4 || '' : item as string;
            const rowId = isRowObj ? item.id : undefined;
            const isSelected = val === selectedItem;
            const isEditing = editingId === (isRowObj ? rowId : `${level}-${val}`);

            return (
              <div 
                key={isRowObj ? rowId : val}
                onClick={() => !isEditing && onSelect(val)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary text-white shadow-md' : 'text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEditSubmit(level, val);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-full bg-background text-main text-sm px-2 py-1 rounded outline-none border border-primary text-black dark:text-white"
                  />
                ) : (
                  <span className="text-sm font-medium truncate pr-2 flex-1">{val}</span>
                )}

                {!isEditing && (
                  <div className={`flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(isRowObj ? rowId! : `${level}-${val}`);
                        setEditValue(val);
                      }}
                      className={`p-1.5 rounded-md transition-colors ${isSelected ? 'hover:bg-white/20' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    {isRowObj && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTrigger(level, val, rowId);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${isSelected ? 'hover:bg-white/20 text-red-200' : 'hover:bg-black/10 dark:hover:bg-white/10 text-red-500'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {!isRowObj && (
                      <ChevronRight size={16} className={isSelected ? 'text-white' : 'text-muted'} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {items.length === 0 && !addingTo && (
            <div className="text-center p-4 text-xs text-muted">No items found.</div>
          )}
          
          {addingTo === level && (
             <div className="px-3 py-2.5">
               <input
                 type="text"
                 autoFocus
                 placeholder="Enter name..."
                 value={newValue}
                 onChange={e => setNewValue(e.target.value)}
                 onKeyDown={e => {
                   if (e.key === 'Enter') handleSaveNew();
                   if (e.key === 'Escape') setAddingTo(null);
                 }}
                 className="w-full bg-background border border-primary text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
               />
               <div className="flex gap-2 mt-2">
                 <button onClick={handleSaveNew} disabled={isSubmitting} className="flex-1 bg-primary text-white text-xs py-1.5 rounded-md font-medium hover:brightness-110">Save</button>
                 <button onClick={() => setAddingTo(null)} className="flex-1 bg-black/10 dark:bg-white/10 text-main text-xs py-1.5 rounded-md font-medium">Cancel</button>
               </div>
             </div>
          )}
        </div>
        
        {addingTo !== level && (
          <div className="p-3 border-t border-border/50 bg-card/50">
            <button 
              onClick={() => { setAddingTo(level as any); setNewValue(''); }}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-primary/50 text-primary hover:bg-primary/5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Add {title}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full fade-in text-slate-200">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-main tracking-tight mb-1">Finance Categories</h2>
          <p className="text-sm text-muted">Manage the 5-level hierarchical category tree</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(prev => {
                const next = !prev;
                if (!next) setSearchQuery('');
                return next;
              });
            }}
            aria-label="Search category paths"
            aria-expanded={isSearchOpen}
            className={`flex items-center gap-2 border px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              isSearchOpen
                ? 'bg-primary/15 border-primary/50 text-primary'
                : 'bg-card border-border/50 text-main hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Search size={16} />
            <span>Search</span>
          </button>
          <button onClick={() => fetchCategories()} className="flex items-center gap-2 bg-card border border-border/50 text-main px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            Refresh Data
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div className="mb-4 bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category paths across Department, Category, Sub Category 1, 2, 3..."
              autoFocus
              className="w-full bg-background/70 border border-border/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
            />
            <button
              type="button"
              onClick={() => {
                if (searchQuery) {
                  setSearchQuery('');
                } else {
                  setIsSearchOpen(false);
                }
              }}
              aria-label={searchQuery ? 'Clear search' : 'Close search'}
              className="absolute right-2.5 p-1.5 rounded-lg text-muted hover:text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {searchQuery.trim() && (
            <div className="mt-3 pt-3 border-t border-border/40">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted py-2 px-1">No matching category paths found</p>
              ) : (
                <>
                  <div className="text-xs text-muted mb-2 px-1">
                    {searchResults.length} matching {searchResults.length === 1 ? 'path' : 'paths'}
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {searchResults.map((result) => (
                      <button
                        key={result.key}
                        type="button"
                        onClick={() => handleSelectSearchResult(result)}
                        className="w-full text-left flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-background/50 hover:bg-primary/10 border border-border/40 hover:border-primary/40 transition-colors group"
                      >
                        <span className="text-sm text-main font-medium group-hover:text-primary transition-colors">
                          {result.displayPath}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {result.matchedLevels.map((level) => (
                            <span
                              key={level}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30"
                            >
                              {level}
                            </span>
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : (
          <div 
            className="flex w-[500%] h-full md:w-full md:grid md:grid-cols-5 md:overflow-x-auto md:min-w-[1000px] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] translate-x-[var(--mobile-offset)] md:translate-x-0"
            style={{ '--mobile-offset': `-${(mobileActiveLevel - 1) * 20}%` } as React.CSSProperties}
          >
            {renderColumn('Department', 1, departments, selectedDept, handleSelectDept, <Briefcase size={16} />, true, [], undefined)}
            {renderColumn('Category', 2, currentCategories, selectedCat, handleSelectCat, <Folder size={16} />, !!selectedDept, [selectedDept], () => setSelectedDept(''))}
            {renderColumn('Sub Category 1', 3, currentSub1s, selectedSub1, handleSelectSub1, <Layers size={16} />, !!selectedCat, [selectedDept, selectedCat], () => setSelectedCat(''))}
            {renderColumn('Sub Category 2', 4, currentSub2s, selectedSub2, handleSelectSub2, <Component size={16} />, !!selectedSub1, [selectedDept, selectedCat, selectedSub1], () => setSelectedSub1(''))}
            {renderColumn('Sub Category 3', 5, currentSub3Rows, selectedSub3, setSelectedSub3, <Tags size={16} />, !!selectedSub2, [selectedDept, selectedCat, selectedSub1, selectedSub2], () => setSelectedSub2(''))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Sub Category 3"
        message="Are you sure you want to archive this leaf category? This cannot be undone."
        confirmText="Archive"
        onConfirm={executeDelete}
        onClose={() => {
          setIsConfirmOpen(false);
          setCategoryToDelete(null);
        }}
      />
    </div>
  );
};
