import { supabase } from '../../lib/supabase';
import { NormalizedTransaction } from '../documentPipeline/types';

export interface CreditRule {
  id: string;
  keyword: string;
  main_category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  source: string | null;
  payment_mode: string | null;
  priority: number;
}

export class CreditRuleEngine {
  /**
   * Fetches all active rules from the database ordered by priority ASC
   */
  static async fetchActiveRules(): Promise<CreditRule[]> {
    const { data, error } = await supabase
      .from('credit_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }); // Stable tie-breaker

    if (error) {
      console.error('Error fetching credit rules:', error);
      return [];
    }

    return data as CreditRule[];
  }

  /**
   * Safely matches a keyword as a distinct phrase or word boundary.
   */
  private static matchesKeyword(description: string, keyword: string | null | undefined): boolean {
    if (!keyword || !description) return false;
    const cleanKeyword = keyword.trim().toLowerCase();
    if (!cleanKeyword) return false;

    // Escape regex special characters
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Ensure the keyword matches as a distinct boundary, not inside another word.
    const regex = new RegExp(`(^|\\W)${escaped}((?=\\W)|$)`, 'i');
    
    return regex.test(description.toLowerCase());
  }

  /**
   * Applies the matching rule to a single credit transaction
   */
  static applyCreditRules(transaction: NormalizedTransaction, rules: CreditRule[]): NormalizedTransaction {
    const result = { ...transaction };
    
    // Search the transaction description (notes for credits)
    const desc = (result.notes || '').toLowerCase();

    // Find the first matching rule based on keyword
    // Rules are already sorted by priority ASC
    const matchedRule = rules.find(rule => this.matchesKeyword(desc, rule.keyword));

    if (matchedRule) {
      result.main_category = result.main_category || matchedRule.main_category || undefined;
      result.sub_category1 = result.sub_category1 || matchedRule.sub_category1 || undefined;
      result.sub_category2 = result.sub_category2 || matchedRule.sub_category2 || undefined;
      result.source = result.source || matchedRule.source || undefined;
      result.payment_mode = result.payment_mode || matchedRule.payment_mode || undefined;
    } else {
      // Fallback behavior
      result.main_category = result.main_category || 'Uncategorized';
    }

    return result;
  }
}
