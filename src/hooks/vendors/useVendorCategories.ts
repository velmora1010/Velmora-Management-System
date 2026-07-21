import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export interface VendorCategoryRow {
  id: string;
  category: string | null;
  sub_category: string | null;
  sub_sub_category: string | null;
  sub_sub_sub_category: string | null;
  status: string;
}

export const useVendorCategories = () => {
  const [categories, setCategories] = useState<VendorCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.vendorCategories)
        .select('*')
        .neq('status', 'archived')
        .order('category')
        .order('sub_category')
        .order('sub_sub_category');
      
      if (!error && data) {
        setCategories(data.map(r => ({
          id: r.id,
          category: r.category,
          sub_category: r.sub_category,
          sub_sub_category: r.sub_sub_category,
          sub_sub_sub_category: r.sub_sub_sub_category,
          status: r.status
        })));
      }
    } catch (e) {
      console.error('Failed to fetch vendor categories:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const saveCategoryRow = async (id: string | null, payload: Partial<VendorCategoryRow>) => {
    const dbPayload = {
      category: payload.category || null,
      sub_category: payload.sub_category || null,
      sub_sub_category: payload.sub_sub_category || null,
      sub_sub_sub_category: payload.sub_sub_sub_category || null,
      status: 'active'
    };
    
    if (id) {
      return await supabase.from(SUPABASE_TABLES.vendorCategories).update(dbPayload).eq('id', id);
    } else {
      return await supabase.from(SUPABASE_TABLES.vendorCategories).insert([dbPayload]);
    }
  };

  const archiveCategory = async (id: string) => {
    const { error } = await supabase
      .from(SUPABASE_TABLES.vendorCategories)
      .update({ status: 'archived' })
      .eq('id', id);
    if (!error) {
      await fetchCategories();
      return true;
    }
    return false;
  };

  return {
    categories,
    isLoading,
    fetchCategories,
    saveCategoryRow,
    archiveCategory
  };
};
