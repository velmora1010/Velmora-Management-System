import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { CategoryMasterData } from '../../types';

export const useTaskCategories = (initialMain?: string, initialSub1?: string, initialSub2?: string) => {
  const [mainCategory, setMainCategory] = useState<string>(initialMain || '');
  const [subCategory1, setSubCategory1] = useState<string>(initialSub1 || '');
  const [subCategory2, setSubCategory2] = useState<string>(initialSub2 || '');
  const [isLoading, setIsLoading] = useState(true);

  const [masterData, setMasterData] = useState<CategoryMasterData>({
    mains: [],
    sub1: {},
    sub2: {},
    sub3: {},
  });

  useEffect(() => {
    const loadCategories = async () => {
      setIsLoading(true);
      try {
        console.log(`Loading task_categories_rows...`);
        const { data: fetchResult, error } = await supabase
          .from('task_categories_rows')
          .select('*')
          .eq('status', 'active');

        let data = fetchResult;

        if (error) {
          console.error('task_categories_rows fetch error:', error.message);
          const fallback = localStorage.getItem('task_categories');
          if (fallback) data = JSON.parse(fallback);
          else throw error;
        }

        if (!data || data.length === 0) {
          return;
        }

        console.log(`Loaded task_categories_rows:`, data.length);
        const mains = [...new Set(data.map((c: any) => c.main as string).filter(Boolean))].sort();

        const sub1: Record<string, string[]> = {};
        const sub2: Record<string, string[]> = {};
        const sub3: Record<string, string[]> = {};

        data.forEach((c) => {
          const main = c.main as string;
          const s1 = c.sub1 as string | null;
          const s2 = c.sub2 as string | null;
          const s3 = (c.sub_sub_sub_category || c.sub3) as string | null;

          if (main && s1) {
            if (!sub1[main]) sub1[main] = [];
            if (!sub1[main].includes(s1)) sub1[main].push(s1);
          }

          if (s1 && s2) {
            if (!sub2[s1]) sub2[s1] = [];
            if (!sub2[s1].includes(s2)) sub2[s1].push(s2);
          }

          if (s2 && s3) {
            if (!sub3[s2]) sub3[s2] = [];
            if (!sub3[s2].includes(s3)) sub3[s2].push(s3);
          }
        });

        Object.values(sub1).forEach(arr => arr.sort());
        Object.values(sub2).forEach(arr => arr.sort());
        Object.values(sub3).forEach(arr => arr.sort());

        setMasterData({ mains, sub1, sub2, sub3 });
      } catch (e) {
        console.error('Error loading task categories:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  const mainOptions = useMemo(() => masterData.mains, [masterData]);

  const sub1Options = useMemo(() => {
    if (!mainCategory || !masterData.sub1[mainCategory]) return [];
    return masterData.sub1[mainCategory];
  }, [mainCategory, masterData]);

  const sub2Options = useMemo(() => {
    if (!subCategory1 || !masterData.sub2[subCategory1]) return [];
    return masterData.sub2[subCategory1];
  }, [subCategory1, masterData]);

  const sub3Options = useMemo(() => {
    if (!subCategory2 || !masterData.sub3[subCategory2]) return [];
    return masterData.sub3[subCategory2];
  }, [subCategory2, masterData]);

  const handleMainChange = useCallback((value: string) => {
    setMainCategory(value);
    setSubCategory1('');
    setSubCategory2('');
  }, []);

  const handleSub1Change = useCallback((value: string) => {
    setSubCategory1(value);
    setSubCategory2('');
  }, []);

  const handleSub2Change = useCallback((value: string) => {
    setSubCategory2(value);
  }, []);

  return {
    mainCategory,
    subCategory1,
    subCategory2,
    mainOptions,
    sub1Options,
    sub2Options,
    sub3Options,
    handleMainChange,
    handleSub1Change,
    handleSub2Change,
    setMainCategory,
    setSubCategory1,
    setSubCategory2,
    isLoading,
    masterData,
  };
};
