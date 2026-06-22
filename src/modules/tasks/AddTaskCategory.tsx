import React, { useState, useEffect } from 'react';
import { useTaskCategories } from '../../hooks/tasks/useTaskCategories';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

type ViewMode = 'main' | 'sub1' | 'sub2' | 'sub3' | 'list' | 'default';

export const AddTaskCategory: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const { 
    mainOptions,
    mainCategory, subCategory1, subCategory2,
    handleSub1Change, handleSub2Change,
    masterData, setMainCategory
  } = useTaskCategories();

  // Dynamic inputs for creating new categories
  const [inputs, setInputs] = useState<string[]>(['']);
  
interface CategoryRow {
  id: string;
  category?: string;
  sub_category?: string;
  sub_sub_category?: string;
  sub_sub_sub_category?: string;
  status?: string;
}

  // For the View List mode
  const [hierarchyData, setHierarchyData] = useState<CategoryRow[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [categoryToArchive, setCategoryToArchive] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addInput = () => {
    setInputs([...inputs, '']);
  };

  const updateInput = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const removeInput = (index: number) => {
    const newInputs = [...inputs];
    newInputs.splice(index, 1);
    setInputs(newInputs);
  };

  const handleSaveMain = async () => {
    const validInputs = inputs.filter(i => i.trim() !== '');
    if (validInputs.length === 0) return toast.error('Enter at least one main category');
    
    setIsLoading(true);
    try {
      for (const val of validInputs) {
        await supabase.from('task_categories').insert([{ category: val.trim(), status: 'active' }]);
      }
      toast.error('Main Categories saved!');
      setViewMode('default');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSub1 = async () => {
    if (!mainCategory) return toast.error('Select a Main Category');
    const validInputs = inputs.filter(i => i.trim() !== '');
    if (validInputs.length === 0) return toast.error('Enter at least one Sub Category 1');
    
    setIsLoading(true);
    try {
      for (const val of validInputs) {
        await supabase.from('task_categories').insert([{ 
          category: mainCategory, 
          sub_category: val.trim(), 
          status: 'active' 
        }]);
      }
      toast.error('Sub Categories saved!');
      setViewMode('default');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSub2 = async () => {
    if (!subCategory1) return toast.error('Select Sub Category 1');
    const validInputs = inputs.filter(i => i.trim() !== '');
    if (validInputs.length === 0) return toast.error('Enter at least one Sub Category 2');
    
    setIsLoading(true);
    try {
      // Find parent main category for this sub1
      const { data } = await supabase.from('task_categories').select('category').eq('sub_category', subCategory1).limit(1);
      const mainCat = data?.[0]?.category;
      if (!mainCat) return toast.error('Could not resolve Main Category');

      for (const val of validInputs) {
        await supabase.from('task_categories').insert([{ 
          category: mainCat, 
          sub_category: subCategory1, 
          sub_sub_category: val.trim(),
          status: 'active' 
        }]);
      }
      toast.error('Sub Categories 2 saved!');
      setViewMode('default');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSub3 = async () => {
    if (!subCategory2) return toast.error('Select Sub Category 2');
    const validInputs = inputs.filter(i => i.trim() !== '');
    if (validInputs.length === 0) return toast.error('Enter at least one Sub Category 3');
    
    setIsLoading(true);
    try {
      // Find parent main and sub1 for this sub2
      const { data } = await supabase.from('task_categories').select('category, sub_category').eq('sub_sub_category', subCategory2).limit(1);
      const mainCat = data?.[0]?.category;
      const sub1Cat = data?.[0]?.sub_category;
      if (!mainCat || !sub1Cat) return toast.error('Could not resolve parent categories');

      for (const val of validInputs) {
        await supabase.from('task_categories').insert([{ 
          category: mainCat, 
          sub_category: sub1Cat, 
          sub_sub_category: subCategory2,
          sub_sub_sub_category: val.trim(),
          status: 'active' 
        }]);
      }
      toast.error('Sub Categories 3 saved!');
      setViewMode('default');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryList = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('task_categories').select('*').eq('status', 'active');
      setHierarchyData(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = (id: string) => {
    setCategoryToArchive(id);
    setIsConfirmOpen(true);
  };

  const executeArchive = async () => {
    if (!categoryToArchive) return;
    try {
      await supabase.from('task_categories').update({ status: 'archived' }).eq('id', categoryToArchive);
      loadCategoryList();
      setIsConfirmOpen(false);
      setCategoryToArchive(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (viewMode === 'list') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCategoryList();
    } else if (viewMode !== 'default') {
      setInputs(['']);
      setMainCategory('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // All unique sub1s across all mains (needed for Sub2 form)
  const allSub1s = Array.from(new Set(Object.values(masterData.sub1).flat())).sort();
  // All unique sub2s across all sub1s (needed for Sub3 form)
  const allSub2s = Array.from(new Set(Object.values(masterData.sub2).flat())).sort();

  const renderInputs = (placeholder: string) => (
    <div className="flex flex-col gap-3 w-full">
      {inputs.map((val, index) => (
        <div key={index} className="flex gap-2">
          <input 
            type="text" 
            className="w-full bg-transparent border border-border text-main rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
            placeholder={placeholder}
            value={val}
            onChange={(e) => updateInput(index, e.target.value)}
          />
          {index > 0 && (
            <button onClick={() => removeInput(index)} className="px-3 py-2 bg-red-50 text-red-500 rounded-lg">✕</button>
          )}
        </div>
      ))}
      <button onClick={addInput} className="w-full py-2 mt-2 text-sm border border-dashed border-border rounded-lg text-muted hover:text-main">
        + Add Another
      </button>
    </div>
  );

  return (
    <Card className="w-full max-w-5xl mx-auto flex flex-col gap-6 animate-in">
      {/* Top Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        <button onClick={() => setViewMode('main')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'main' ? 'bg-primary text-white' : 'bg-card-alt text-main hover:bg-border'}`}>+ Add Main Category</button>
        <button onClick={() => setViewMode('sub1')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'sub1' ? 'bg-primary text-white' : 'bg-card-alt text-main hover:bg-border'}`}>+ Add Sub Category 1</button>
        <button onClick={() => setViewMode('sub2')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'sub2' ? 'bg-primary text-white' : 'bg-card-alt text-main hover:bg-border'}`}>+ Add Sub Category 2</button>
        <button onClick={() => setViewMode('sub3')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'sub3' ? 'bg-primary text-white' : 'bg-card-alt text-main hover:bg-border'}`}>+ Add Sub Category 3</button>
        <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ml-auto ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>View Categories</button>
      </div>

      {viewMode === 'default' && (
        <div className="text-center p-16 text-muted">
          <div className="text-4xl mb-4">🗂️</div>
          <h3 className="text-lg font-semibold text-main mb-2">Category Management</h3>
          <p>Select an option from the menu above to add or view categories.</p>
        </div>
      )}

      {viewMode === 'main' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-main">Add Main Category</h3>
          {renderInputs('Enter Category Name')}
          <Button onClick={handleSaveMain} disabled={isLoading} className="self-end mt-4">Save Main Categories</Button>
        </div>
      )}

      {viewMode === 'sub1' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-main">Add Sub Category 1</h3>
          <select 
            className="w-full bg-transparent border border-border text-main rounded-lg px-4 py-2 mb-2 focus:outline-none focus:border-primary"
            value={mainCategory} onChange={(e) => setMainCategory(e.target.value)}
          >
            <option value="">Select Main Category</option>
            {mainOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {renderInputs('Enter Sub Category 1 Name')}
          <Button onClick={handleSaveSub1} disabled={isLoading} className="self-end mt-4">Save Sub Categories</Button>
        </div>
      )}

      {viewMode === 'sub2' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-main">Add Sub Category 2</h3>
          <select 
            className="w-full bg-transparent border border-border text-main rounded-lg px-4 py-2 mb-2 focus:outline-none focus:border-primary"
            value={subCategory1} onChange={(e) => handleSub1Change(e.target.value)}
          >
            <option value="">Select Sub Category 1</option>
            {allSub1s.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {renderInputs('Enter Sub Category 2 Name')}
          <Button onClick={handleSaveSub2} disabled={isLoading} className="self-end mt-4">Save Sub Categories 2</Button>
        </div>
      )}

      {viewMode === 'sub3' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-main">Add Sub Category 3</h3>
          <select 
            className="w-full bg-transparent border border-border text-main rounded-lg px-4 py-2 mb-2 focus:outline-none focus:border-primary"
            value={subCategory2} onChange={(e) => handleSub2Change(e.target.value)}
          >
            <option value="">Select Sub Category 2</option>
            {allSub2s.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {renderInputs('Enter Sub Category 3 Name')}
          <Button onClick={handleSaveSub3} disabled={isLoading} className="self-end mt-4">Save Sub Categories 3</Button>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-main">Task Category Hierarchy</h3>
            <button onClick={loadCategoryList} className="text-xs text-primary hover:underline">Refresh</button>
          </div>
          
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left text-sm text-main">
              <thead className="bg-card-alt border-b border-border text-muted uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Main Category</th>
                  <th className="px-4 py-3 font-semibold">Sub Category 1</th>
                  <th className="px-4 py-3 font-semibold">Sub Category 2</th>
                  <th className="px-4 py-3 font-semibold">Sub Category 3</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hierarchyData.map(row => (
                  <tr key={row.id} className="hover:bg-card-alt/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-main">{row.category || '-'}</td>
                    <td className="px-4 py-3 text-muted">{row.sub_category || '-'}</td>
                    <td className="px-4 py-3 text-muted">{row.sub_sub_category || '-'}</td>
                    <td className="px-4 py-3 text-muted">{row.sub_sub_sub_category || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleArchive(row.id)} className="text-red-500 hover:text-red-700 font-medium">Archive</button>
                    </td>
                  </tr>
                ))}
                {hierarchyData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted">No categories found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Category"
        message="Are you sure you want to archive this category?"
        confirmText="Archive"
        onConfirm={executeArchive}
        onClose={() => {
          setIsConfirmOpen(false);
          setCategoryToArchive(null);
        }}
      />
    </Card>
  );
};
