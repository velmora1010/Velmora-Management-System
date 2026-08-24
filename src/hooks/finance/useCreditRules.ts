import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { CreditRule } from '../../utils/rules/CreditRuleEngine';

export const useCreditRules = () => {
  const [rules, setRules] = useState<CreditRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('credit_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fix TS typing matching exactly
      const parsedData = (data || []).map(r => ({
        id: r.id,
        keyword: r.keyword,
        main_category: r.main_category,
        sub_category1: r.sub_category1,
        sub_category2: r.sub_category2,
        source: r.source,
        payment_mode: r.payment_mode,
        priority: r.priority,
        is_active: r.is_active
      }));
      setRules(parsedData as any[]);
    } catch (e) {
      console.error('Failed to fetch credit rules:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const saveRule = async (id: string | null, payload: Partial<CreditRule> & { is_active?: boolean }) => {
    const dbPayload = {
      keyword: payload.keyword,
      main_category: payload.main_category || null,
      sub_category1: payload.sub_category1 || null,
      sub_category2: payload.sub_category2 || null,
      source: payload.source || null,
      payment_mode: payload.payment_mode || null,
      priority: payload.priority ?? 100,
      is_active: payload.is_active ?? true
    };
    
    if (id) {
      await supabase.from('credit_rules').update(dbPayload).eq('id', id);
    } else {
      await supabase.from('credit_rules').insert([dbPayload]);
    }
    
    await fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from('credit_rules').delete().eq('id', id);
    await fetchRules();
  };
  
  const toggleRuleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('credit_rules').update({ is_active: !currentStatus }).eq('id', id);
    await fetchRules();
  };

  return {
    rules,
    isLoading,
    fetchRules,
    saveRule,
    deleteRule,
    toggleRuleActive
  };
};
