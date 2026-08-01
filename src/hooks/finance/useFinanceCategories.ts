import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export interface FinanceCategoryRow {
  id: string;
  main: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  status: string;
}

export const useFinanceCategories = () => {
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('Loading Finance Categories from Supabase...');
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.financeCategories)
        .select('*')
        .neq('status', 'archived')
        .order('main')
        .order('sub1')
        .order('sub2');

      if (error) throw error;
      
      if (data) {
        setCategories(data.map(r => ({
          id: r.id,
          main: r.main,
          sub1: r.sub1,
          sub2: r.sub2,
          sub3: r.sub3,
          sub4: r.sub_sub_sub_category,
          status: r.status
        })));
      }
    } catch (e) {
      console.error('Failed to fetch finance categories from Supabase:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Derived options for UI
  const uniqueMains = Array.from(new Set(categories.map(c => c.main).filter(Boolean))) as string[];
  const uniqueSub1 = Array.from(new Set(categories.map(c => c.sub1).filter(Boolean))) as string[];
  const uniqueSub2 = Array.from(new Set(categories.map(c => c.sub2).filter(Boolean))) as string[];
  const uniqueSub3 = Array.from(new Set(categories.map(c => c.sub3).filter(Boolean))) as string[];

  // ID-based cascade updates
  const cascadeUpdates = async (oldRow: FinanceCategoryRow, newCat: Partial<FinanceCategoryRow>) => {
    const promises: Promise<any>[] = [];

    categories.forEach(row => {
      let needsUpdate = false;
      const payload: any = {};

      if (oldRow.main && newCat.main && oldRow.main !== newCat.main && row.main === oldRow.main) {
        payload.main = newCat.main;
        needsUpdate = true;
      }
      if (oldRow.sub1 && newCat.sub1 && oldRow.sub1 !== newCat.sub1 && row.main === oldRow.main && row.sub1 === oldRow.sub1) {
        payload.sub1 = newCat.sub1;
        needsUpdate = true;
      }
      if (oldRow.sub2 && newCat.sub2 && oldRow.sub2 !== newCat.sub2 && row.main === oldRow.main && row.sub1 === oldRow.sub1 && row.sub2 === oldRow.sub2) {
        payload.sub2 = newCat.sub2;
        needsUpdate = true;
      }
      if (oldRow.sub3 && newCat.sub3 && oldRow.sub3 !== newCat.sub3 && row.main === oldRow.main && row.sub1 === oldRow.sub1 && row.sub2 === oldRow.sub2 && row.sub3 === oldRow.sub3) {
        payload.sub3 = newCat.sub3;
        needsUpdate = true;
      }

      // Do not update the exact row being edited by saveCategoryRow (it is updated independently)
      if (needsUpdate && row.id !== oldRow.id) {
        promises.push(
          Promise.resolve(supabase.from(SUPABASE_TABLES.financeCategories).update(payload).eq('id', row.id))
        );
      }
    });

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  const saveCategoryRow = async (id: string | null, payload: Partial<FinanceCategoryRow>) => {
    const dbPayload = {
      main: payload.main || null,
      sub1: payload.sub1 || null,
      sub2: payload.sub2 || null,
      sub3: payload.sub3 || null,
      sub_sub_sub_category: payload.sub4 || null,
      status: 'active'
    };
    
    if (id) {
      const oldRow = categories.find(c => c.id === id);
      await supabase.from(SUPABASE_TABLES.financeCategories).update(dbPayload).eq('id', id);
      if (oldRow) {
        await cascadeUpdates(oldRow, payload);
      }
    } else {
      await supabase.from(SUPABASE_TABLES.financeCategories).insert([dbPayload]);
    }
    
    await fetchCategories(); // Auto refresh
  };

  const archiveCategory = async (id: string) => {
    await supabase.from(SUPABASE_TABLES.financeCategories).update({ status: 'archived' }).eq('id', id);
    await fetchCategories();
  };

  return {
    categories,
    isLoading,
    uniqueMains,
    uniqueSub1,
    uniqueSub2,
    uniqueSub3,
    fetchCategories,
    saveCategoryRow,
    archiveCategory
  };
};
