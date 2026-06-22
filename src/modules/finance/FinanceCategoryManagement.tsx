import { useState } from 'react';
import { Trash2, Edit2, Search } from 'lucide-react';
import { useFinanceCategories, type FinanceCategoryRow } from '../../hooks/finance/useFinanceCategories';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

type ActiveTab = 'main' | 'sub1' | 'sub2' | 'sub3' | 'list' | 'default';

export const FinanceCategoryManagement = () => {
  const {
    categories,
    isLoading,
    uniqueMains,
    uniqueSub1,
    uniqueSub2,
    fetchCategories,
    saveCategoryRow,
    addMainCategories,
    addSub1Categories,
    addSub2Categories,
    addSub3Categories,
    archiveCategory
  } = useFinanceCategories();

  const [activeTab, setActiveTab] = useState<ActiveTab>('default');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit mode
  const [editId, setEditId] = useState<string | null>(null);

  // Form selections
  const [selectedMain, setSelectedMain] = useState('');
  const [selectedSub1, setSelectedSub1] = useState('');
  const [selectedSub2, setSelectedSub2] = useState('');

  // Dynamic inputs arrays
  const [mainInputs, setMainInputs] = useState<string[]>(['']);
  const [sub1Inputs, setSub1Inputs] = useState<string[]>(['']);
  const [sub2Inputs, setSub2Inputs] = useState<string[]>(['']);
  const [sub3Inputs, setSub3Inputs] = useState<string[]>(['']);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // --- Handlers for Input Arrays ---
  const updateInput = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter(prev => {
      const newArr = [...prev];
      newArr[index] = value;
      return newArr;
    });
  };

  const addInput = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => [...prev, '']);
  };

  // --- Navigation & State Reset ---
  const handleTabSwitch = (tab: ActiveTab) => {
    setEditId(null);
    setActiveTab(tab);
    // Reset forms
    setMainInputs(['']);
    setSub1Inputs(['']);
    setSub2Inputs(['']);
    setSub3Inputs(['']);
    setSelectedMain('');
    setSelectedSub1('');
    setSelectedSub2('');
    
    if (tab === 'list') fetchCategories();
  };

  // --- Edit Flow ---
  const handleEdit = (cat: FinanceCategoryRow) => {
    setEditId(cat.id);
    if (cat.sub2 && cat.sub2 !== '-') {
      handleTabSwitch('sub2');
      setEditId(cat.id); // restore after switch
      setSelectedSub1(cat.sub1 || '');
      setSub2Inputs([cat.sub2]);
    } else if (cat.sub1 && cat.sub1 !== '-') {
      handleTabSwitch('sub1');
      setEditId(cat.id);
      setSelectedMain(cat.main || '');
      setSub1Inputs([cat.sub1]);
    } else {
      handleTabSwitch('main');
      setEditId(cat.id);
      setMainInputs([cat.main || '']);
    }
  };

  // --- Save Handlers ---
  const handleSaveMain = async () => {
    const valid = mainInputs.map(v => v.trim()).filter(Boolean);
    if (valid.length === 0) return toast.error('Please enter at least one name.');
    
    setIsSubmitting(true);
    if (editId) {
      await saveCategoryRow(editId, { main: valid[0] });
    } else {
      await addMainCategories(valid);
    }
    setIsSubmitting(false);
    handleTabSwitch('default');
  };

  const handleSaveSub1 = async () => {
    if (!selectedMain) return toast.error('Select Main Category!');
    const valid = sub1Inputs.map(v => v.trim()).filter(Boolean);
    if (valid.length === 0) return toast.error('Please enter at least one name.');
    
    setIsSubmitting(true);
    if (editId) {
      await saveCategoryRow(editId, { main: selectedMain, sub1: valid[0] });
    } else {
      await addSub1Categories(selectedMain, valid);
    }
    setIsSubmitting(false);
    handleTabSwitch('default');
  };

  const handleSaveSub2 = async () => {
    if (!selectedSub1) return toast.error('Select Sub Category 1!');
    const valid = sub2Inputs.map(v => v.trim()).filter(Boolean);
    if (valid.length === 0) return toast.error('Please enter at least one name.');

    setIsSubmitting(true);
    if (editId) {
      const ref = categories.find(c => c.sub1 === selectedSub1);
      await saveCategoryRow(editId, { main: ref?.main || null, sub1: selectedSub1, sub2: valid[0] });
    } else {
      await addSub2Categories(selectedSub1, valid);
    }
    setIsSubmitting(false);
    handleTabSwitch('default');
  };

  const handleSaveSub3 = async () => {
    if (!selectedSub2) return toast.error('Select Sub Category 2!');
    const valid = sub3Inputs.map(v => v.trim()).filter(Boolean);
    if (valid.length === 0) return toast.error('Please enter at least one name.');

    setIsSubmitting(true);
    if (editId) {
      const ref = categories.find(c => c.sub2 === selectedSub2);
      await saveCategoryRow(editId, { main: ref?.main || null, sub1: ref?.sub1 || null, sub2: selectedSub2, sub3: valid[0] });
    } else {
      await addSub3Categories(selectedSub2, valid);
    }
    setIsSubmitting(false);
    handleTabSwitch('default');
  };

  const handleDelete = (id: string) => {
    setCategoryToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (categoryToDelete) {
      await archiveCategory(categoryToDelete);
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = categories.filter(c => {
    const q = searchQuery.toLowerCase();
    return (c.main?.toLowerCase().includes(q) || c.sub1?.toLowerCase().includes(q) || c.sub2?.toLowerCase().includes(q) || c.sub3?.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full fade-in">
      {/* Header section matching Old Vanilla design exactly */}
      <h2 className="text-2xl font-bold text-main tracking-tight mb-4">Finance Categories</h2>
      
      <div className="flex flex-wrap gap-2.5 mb-8">
        <button onClick={() => handleTabSwitch('main')} className="bg-primary text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/20 hover:brightness-110 transition-all">+ Add Finance Category</button>
        <button onClick={() => handleTabSwitch('sub1')} className="bg-primary text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/20 hover:brightness-110 transition-all">+ Add Sub Category 1</button>
        <button onClick={() => handleTabSwitch('sub2')} className="bg-primary text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/20 hover:brightness-110 transition-all">+ Add Sub Category 2</button>
        <button onClick={() => handleTabSwitch('sub3')} className="bg-primary text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/20 hover:brightness-110 transition-all">+ Add Sub Category 3</button>
        <button onClick={() => handleTabSwitch('list')} className="bg-card border border-border/50 text-main px-4 py-2.5 rounded-xl font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-all">View Saved Category</button>
      </div>

      <div className="flex-1">
        {/* Default State */}
        {activeTab === 'default' && (
          <div className="flex flex-col items-center justify-center py-20 bg-card border border-border/50 rounded-2xl shadow-sm text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-main mb-2">Finance Categories</h3>
            <p className="text-muted">Select an action above to manage finance categories.</p>
          </div>
        )}

        {/* Form: Main Category */}
        {activeTab === 'main' && (
          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm max-w-2xl">
            <div className="text-lg font-semibold text-main mb-6 border-b border-border/50 pb-4">
              {editId ? 'Edit Finance Main Category' : 'Add Finance Main Category'}
            </div>
            <div className="space-y-3 mb-4">
              {mainInputs.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder="Enter Category Name"
                  value={val}
                  onChange={(e) => updateInput(setMainInputs, i, e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                />
              ))}
            </div>
            {!editId && (
              <button type="button" onClick={() => addInput(setMainInputs)} className="text-sm font-medium text-main bg-background border border-border px-4 py-2 rounded-xl mb-8 hover:bg-black/5 transition-colors">
                + Add Another
              </button>
            )}
            <div className="flex justify-end">
              <button onClick={handleSaveMain} disabled={isSubmitting} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Saving...' : 'Save Categories'}
              </button>
            </div>
          </div>
        )}

        {/* Form: Sub Category 1 */}
        {activeTab === 'sub1' && (
          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm max-w-2xl">
            <div className="text-lg font-semibold text-main mb-6 border-b border-border/50 pb-4">
              {editId ? 'Edit Finance Sub Category 1' : 'Add Finance Sub Category 1'}
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-main mb-1.5 block">Select Main Category</label>
              <select value={selectedMain} onChange={e => setSelectedMain(e.target.value)} className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors">
                <option value="">Select Main Category</option>
                {uniqueMains.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-3 mb-4">
              {sub1Inputs.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder="Enter Sub Category 1 Name"
                  value={val}
                  onChange={(e) => updateInput(setSub1Inputs, i, e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                />
              ))}
            </div>
            {!editId && (
              <button type="button" onClick={() => addInput(setSub1Inputs)} className="text-sm font-medium text-main bg-background border border-border px-4 py-2 rounded-xl mb-8 hover:bg-black/5 transition-colors">
                + Add Another
              </button>
            )}
            <div className="flex justify-end">
              <button onClick={handleSaveSub1} disabled={isSubmitting} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Saving...' : 'Save Sub Categories'}
              </button>
            </div>
          </div>
        )}

        {/* Form: Sub Category 2 */}
        {activeTab === 'sub2' && (
          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm max-w-2xl">
            <div className="text-lg font-semibold text-main mb-6 border-b border-border/50 pb-4">
              {editId ? 'Edit Finance Sub Category 2' : 'Add Finance Sub Category 2'}
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-main mb-1.5 block">Select Sub Category 1</label>
              <select value={selectedSub1} onChange={e => setSelectedSub1(e.target.value)} className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors">
                <option value="">Select Sub Category 1</option>
                {uniqueSub1.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-3 mb-4">
              {sub2Inputs.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder="Enter Sub Category 2 Name"
                  value={val}
                  onChange={(e) => updateInput(setSub2Inputs, i, e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                />
              ))}
            </div>
            {!editId && (
              <button type="button" onClick={() => addInput(setSub2Inputs)} className="text-sm font-medium text-main bg-background border border-border px-4 py-2 rounded-xl mb-8 hover:bg-black/5 transition-colors">
                + Add Another
              </button>
            )}
            <div className="flex justify-end">
              <button onClick={handleSaveSub2} disabled={isSubmitting} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Saving...' : 'Save Sub Categories'}
              </button>
            </div>
          </div>
        )}

        {/* Form: Sub Category 3 */}
        {activeTab === 'sub3' && (
          <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm max-w-2xl">
            <div className="text-lg font-semibold text-main mb-6 border-b border-border/50 pb-4">
              {editId ? 'Edit Finance Sub Category 3' : 'Add Finance Sub Category 3'}
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-main mb-1.5 block">Select Sub Category 2</label>
              <select value={selectedSub2} onChange={e => setSelectedSub2(e.target.value)} className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors">
                <option value="">Select Sub Category 2</option>
                {uniqueSub2.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-3 mb-4">
              {sub3Inputs.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder="Enter Sub Category 3 Name"
                  value={val}
                  onChange={(e) => updateInput(setSub3Inputs, i, e.target.value)}
                  className="w-full bg-background border border-border text-main text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary transition-colors"
                />
              ))}
            </div>
            {!editId && (
              <button type="button" onClick={() => addInput(setSub3Inputs)} className="text-sm font-medium text-main bg-background border border-border px-4 py-2 rounded-xl mb-8 hover:bg-black/5 transition-colors">
                + Add Another
              </button>
            )}
            <div className="flex justify-end">
              <button onClick={handleSaveSub3} disabled={isSubmitting} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Saving...' : 'Save Sub Categories'}
              </button>
            </div>
          </div>
        )}

        {/* List View */}
        {activeTab === 'list' && (
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm flex flex-col h-[calc(100vh-250px)]">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <div className="font-semibold text-main">Saved Finance Categories</div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-background border border-border text-main text-sm rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <button onClick={() => fetchCategories()} className="text-sm font-medium text-main bg-background border border-border px-4 py-2 rounded-xl hover:bg-black/5 transition-colors">
                  Refresh
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-b-2 border-primary rounded-full"></div></div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center p-12 text-muted">No categories found.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/5 dark:bg-white/5 border-b border-border/50 text-muted sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-medium">Main Category</th>
                      <th className="px-6 py-4 font-medium">Sub Category 1</th>
                      <th className="px-6 py-4 font-medium">Sub Category 2</th>
                      <th className="px-6 py-4 font-medium">Sub Category 3</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredCategories.map(cat => (
                      <tr key={cat.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-main">{cat.main || '-'}</td>
                        <td className="px-6 py-4 text-main">{cat.sub1 || '-'}</td>
                        <td className="px-6 py-4 text-main">{cat.sub2 || '-'}</td>
                        <td className="px-6 py-4 text-main">{cat.sub3 || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(cat)} className="p-2 text-muted hover:text-primary rounded-lg transition-colors"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(cat.id)} className="p-2 text-muted hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Category"
        message="Are you sure you want to archive this finance category? This cannot be undone."
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
