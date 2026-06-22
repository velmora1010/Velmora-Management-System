import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface FinanceCategoryRow {
  id: string;
  main: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  status: string;
}

export const useFinanceCategories = () => {
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('Loading finance_categories_rows...');
      const { data: fetchResult, error } = await supabase
        .from('finance_categories_rows')
        .select('*')
        .neq('status', 'archived')
        .order('main')
        .order('sub1')
        .order('sub2');
      
      let data = fetchResult;
      if (error) {
        console.error('finance_categories_rows fetch error:', error.message);
        const fallback = localStorage.getItem('finance_categories');
        if (fallback) data = JSON.parse(fallback);
        else throw error;
      }
      
      console.log('Loaded finance_categories_rows:', data?.length);
      if (!error && data) {
        setCategories(data.map(r => ({
          id: r.id,
          main: r.main,
          sub1: r.sub1,
          sub2: r.sub2,
          sub3: r.sub_sub_sub_category || r.sub3,
          status: r.status
        })));
      }
    } catch (e) {
      console.error('Failed to fetch finance categories:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  // Derived options for UI forms
  const uniqueMains = Array.from(new Set(categories.map(c => c.main).filter(Boolean))) as string[];
  const uniqueSub1 = Array.from(new Set(categories.map(c => c.sub1).filter(Boolean))) as string[];
  const uniqueSub2 = Array.from(new Set(categories.map(c => c.sub2).filter(Boolean))) as string[];

  // Helper: Cascade Update
  const cascadeUpdates = async (oldRow: FinanceCategoryRow, newCat: Partial<FinanceCategoryRow>) => {
    try {
      if (oldRow.main && newCat.main && oldRow.main !== newCat.main) {
        await supabase.from('finance_categories_rows').update({ main: newCat.main }).eq('main', oldRow.main);
      }
      if (oldRow.sub1 && newCat.sub1 && oldRow.sub1 !== newCat.sub1) {
        await supabase.from('finance_categories_rows').update({ sub1: newCat.sub1 }).eq('main', oldRow.main).eq('sub1', oldRow.sub1);
      }
      if (oldRow.sub2 && newCat.sub2 && oldRow.sub2 !== newCat.sub2) {
        await supabase.from('finance_categories_rows').update({ sub2: newCat.sub2 }).eq('main', oldRow.main).eq('sub1', oldRow.sub1).eq('sub2', oldRow.sub2);
      }
    } catch (e) {
      console.error('Cascade update failed', e);
    }
  };

  // Add/Update single row (for edit mode)
  const saveCategoryRow = async (id: string | null, payload: Partial<FinanceCategoryRow>) => {
    const dbPayload = {
      main: payload.main || null,
      sub1: payload.sub1 || null,
      sub2: payload.sub2 || null,
      sub_sub_sub_category: payload.sub3 || null,
      status: 'active'
    };
    
    if (id) {
      const oldRow = categories.find(c => c.id === id);
      await supabase.from('finance_categories_rows').update(dbPayload).eq('id', id);
      if (oldRow) await cascadeUpdates(oldRow, payload);
    } else {
      await supabase.from('finance_categories_rows').insert([dbPayload]);
    }
  };

  // Batch Saves for Add Another workflow
  const addMainCategories = async (names: string[]) => {
    const payloads = names.map(n => ({ main: n, status: 'active' }));
    await supabase.from('finance_categories_rows').insert(payloads);
    await fetchCategories();
  };

  const addSub1Categories = async (main: string, names: string[]) => {
    const payloads = names.map(n => ({ main, sub1: n, status: 'active' }));
    await supabase.from('finance_categories_rows').insert(payloads);
    await fetchCategories();
  };

  const addSub2Categories = async (sub1: string, names: string[]) => {
    const ref = categories.find(c => c.sub1 === sub1);
    const main = ref ? ref.main : null;
    const payloads = names.map(n => ({ main, sub1, sub2: n, status: 'active' }));
    await supabase.from('finance_categories_rows').insert(payloads);
    await fetchCategories();
  };

  const addSub3Categories = async (sub2: string, names: string[]) => {
    const ref = categories.find(c => c.sub2 === sub2);
    const main = ref ? ref.main : null;
    const sub1 = ref ? ref.sub1 : null;
    const payloads = names.map(n => ({ main, sub1, sub2, sub_sub_sub_category: n, status: 'active' }));
    await supabase.from('finance_categories_rows').insert(payloads);
    await fetchCategories();
  };

  const archiveCategory = async (id: string) => {
    await supabase.from('finance_categories_rows').update({ status: 'archived' }).eq('id', id);
    await fetchCategories();
  };

  return {
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
  };
};
