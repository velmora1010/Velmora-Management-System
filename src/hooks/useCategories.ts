import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CategoryMasterData } from '../types';

/**
 * useCategories — Fetches category master data from Supabase (finance_categories table)
 * and provides cascading dropdown state management.
 *
 * This replaces the Vanilla JS `SharedCategoryService` and `_financeCatGlobals`.
 * Source of truth: script.js SharedCategoryService (lines 16-193)
 */
export const useCategories = (initialMain?: string, initialSub1?: string, initialSub2?: string) => {
  const [mainCategory, setMainCategory] = useState<string>(initialMain || '');
  const [subCategory1, setSubCategory1] = useState<string>(initialSub1 || '');
  const [subCategory2, setSubCategory2] = useState<string>(initialSub2 || '');
  const [isLoading, setIsLoading] = useState(true);

  // Master Data — mirrors _financeCatGlobals structure exactly
  const [masterData, setMasterData] = useState<CategoryMasterData>({
    mains: [],
    sub1: {},
    sub2: {},
    sub3: {},
  });

  // ── Fetch master data from Supabase on mount ──
  useEffect(() => {
    const isMounted = { current: true };
    const loadCategories = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('finance_categories')
          .select('*')
          .eq('status', 'active');

        if (error) {
          console.error('Finance categories Supabase error:', error);
          throw error;
        }

        if (!isMounted.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!data || (data as any[]).length === 0) {
          setMasterData({ mains: [], sub1: {}, sub2: {}, sub3: {} });
          setIsLoading(false);
          return;
        }

        // Build the exact same structure as _financeCatGlobals
        // Matches: script.js SharedCategoryService methods
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData = data as any[];
        const uniqueMains = Array.from(new Set(rawData.map(d => d.main as string).filter(Boolean))).sort();

        const sub1: Record<string, string[]> = {};
        const sub2: Record<string, string[]> = {};
        const sub3: Record<string, string[]> = {};

        rawData.forEach(row => {
          const main = row.main as string;
          const s1 = row.sub1 as string | null;
          const s2 = row.sub2 as string | null;
          const s3 = (row.sub_sub_sub_category || row.sub3) as string | null;

          // Build sub1 map: main -> [sub1 values]
          if (main && s1) {
            if (!sub1[main]) sub1[main] = [];
            if (!sub1[main].includes(s1)) sub1[main].push(s1);
          }

          // Build sub2 map: sub1 -> [sub2 values]
          if (s1 && s2) {
            if (!sub2[s1]) sub2[s1] = [];
            if (!sub2[s1].includes(s2)) sub2[s1].push(s2);
          }

          // Build sub3 map: sub2 -> [sub3 values]
          if (s2 && s3) {
            if (!sub3[s2]) sub3[s2] = [];
            if (!sub3[s2].includes(s3)) sub3[s2].push(s3);
          }
        });

        // Sort all arrays
        Object.values(sub1).forEach(arr => arr.sort());
        Object.values(sub2).forEach(arr => arr.sort());
        Object.values(sub3).forEach(arr => arr.sort());

        if (isMounted.current) {
          setMasterData({ mains: uniqueMains, sub1, sub2, sub3 });
        }
      } catch (e) {
        console.error('Error loading finance categories:', e);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    loadCategories();
    return () => { isMounted.current = false; };
  }, []);

  // ── Derived options based on current selections (Cascading Logic) ──
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

  // ── Handlers to enforce cascading reset ──
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
    // Current Selections
    mainCategory,
    subCategory1,
    subCategory2,

    // Options for Select Dropdowns
    mainOptions,
    sub1Options,
    sub2Options,
    sub3Options,

    // Change Handlers
    handleMainChange,
    handleSub1Change,
    handleSub2Change,

    // Raw Setters (use cautiously to prevent cascading breaks)
    setMainCategory,
    setSubCategory1,
    setSubCategory2,

    // Loading state
    isLoading,

    // Raw master data (for PO product lookup)
    masterData,
  };
};
