import { supabase } from '../../lib/supabase';
import { NormalizedTransaction } from '../documentPipeline/types';

export interface ExpenseRule {
  id: string;
  keyword: string;
  department: string | null;
  category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  vendor: string | null;
  payment_mode: string | null;
  gst_status: string | null;
  purchased_by: string | null;
  approved_by: string | null;
  notes: string | null;
  priority: number;
}

export class ExpenseRuleEngine {
  /**
   * Fetches all active rules from the database ordered by priority ASC
   */
  static async fetchActiveRules(): Promise<ExpenseRule[]> {
    const { data, error } = await supabase
      .from('expense_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }); // Stable tie-breaker

    if (error) {
      console.error('Error fetching expense rules:', error);
      return [];
    }

    return data as ExpenseRule[];
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
    // Use (^|\W) and (?=\W|$) to support matching characters safely.
    const regex = new RegExp(`(^|\\W)${escaped}((?=\\W)|$)`, 'i');
    
    return regex.test(description.toLowerCase());
  }

  /**
   * Applies the matching rule to a single transaction
   */
  static applyExpenseRules(transaction: NormalizedTransaction, rules: ExpenseRule[]): NormalizedTransaction {
    const result = { ...transaction };
    
    // Safety check - we search the transaction description (notes/reference/narration)
    const desc = (result.notes || '').toLowerCase();

    // Find the first matching rule based on keyword
    // Rules are already sorted by priority ASC from the DB query
    const matchedRule = rules.find(rule => this.matchesKeyword(desc, rule.keyword));

    if (matchedRule) {
      // Only populate fields if they don't already exist on the normalized transaction
      result.main_category = result.main_category || matchedRule.department || undefined;
      result.sub_category1 = result.sub_category1 || matchedRule.category || undefined;
      result.sub_category2 = result.sub_category2 || matchedRule.sub_category1 || undefined;
      result.sub_category3 = result.sub_category3 || matchedRule.sub_category2 || undefined;
      result.vendor = result.vendor || matchedRule.vendor || undefined;
      result.payment_mode = result.payment_mode || matchedRule.payment_mode || undefined;
      result.gst_status = result.gst_status || matchedRule.gst_status || undefined;
      result.purchased_by = result.purchased_by || matchedRule.purchased_by || undefined;
      result.approved_by = result.approved_by || matchedRule.approved_by || undefined;
      
      // Never overwrite the actual parsed transaction notes, only populate if empty
      result.notes = result.notes || matchedRule.notes || undefined;
    } else {
      // Fallback behavior
      result.main_category = result.main_category || 'Uncategorized';
      result.sub_category1 = result.sub_category1 || undefined;
      result.sub_category2 = result.sub_category2 || undefined;
      result.sub_category3 = result.sub_category3 || undefined;
      result.vendor = result.vendor || 'ICICI Bank Transaction';
    }

    return result;
  }
}
