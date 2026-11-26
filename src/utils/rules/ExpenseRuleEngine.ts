import { supabase } from '../../lib/supabase';
import { NormalizedTransaction } from '../documentPipeline/types';

export interface ExpenseRule {
  id: string;
  keyword: string;
  keywords?: string[] | null;
  keyword_signature?: string | null;
  department: string | null;
  category: string | null;
  sub_category1: string | null;
  sub_category2: string | null;
  sub_category3_values?: string[] | null;
  vendor: string | null;
  payment_mode: string | null;
  gst_status: string | null;
  purchased_by: string | null;
  approved_by: string | null;
  notes: string | null;
  priority: number;
  created_at?: string | null;
}

export class ExpenseRuleEngine {
  /**
   * Fetches all active rules from the database ordered by priority ASC, created_at ASC.
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
   * Parses a "/" separated keyword expression into normalized, unique, sorted tokens.
   * Mirrors public.normalize_expense_rule_keywords() in PostgreSQL.
   */
  static parseRuleKeywords(input: string | null | undefined): string[] {
    if (!input) return [];
    const tokens = input
      .split('/')
      .map(part => part.trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(tokens)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * Builds the canonical sorted signature from normalized tokens.
   */
  static getKeywordSignature(tokens: string[]): string {
    return Array.from(new Set(tokens.map(t => t.trim().toLowerCase()).filter(Boolean)))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .join('/');
  }

  /**
   * Normalizes Level 5 category values (trimmed, deduplicated, sorted).
   */
  static normalizeLevel5Values(values: string[] | null | undefined): string[] {
    if (!Array.isArray(values) || values.length === 0) return [];
    return Array.from(new Set(values.map(v => (v || '').trim()).filter(Boolean)))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * Resolves effective tokens for a rule, falling back to parsing rule.keyword for legacy compatibility.
   */
  static getRuleTokens(rule: ExpenseRule): string[] {
    if (Array.isArray(rule.keywords) && rule.keywords.length > 0) {
      const normalized = Array.from(
        new Set(rule.keywords.map(k => (k || '').trim().toLowerCase()).filter(Boolean))
      ).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      if (normalized.length > 0) return normalized;
    }
    return this.parseRuleKeywords(rule.keyword);
  }

  /**
   * Safely matches a single keyword token using word/non-word boundaries,
   * tolerating unexpected whitespace between characters in the narration.
   */
  private static matchesKeyword(description: string, keyword: string | null | undefined): boolean {
    if (!keyword || !description) return false;
    const compact = keyword.trim().toLowerCase().replace(/\s+/g, '');
    if (!compact) return false;

    // Escape each character individually and allow arbitrary whitespace between characters
    const pattern = Array.from(compact)
      .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s*');

    // Ensure the keyword matches as a distinct boundary, not inside another word.
    // Allow digit boundaries adjacent to alphabetic starts/ends (e.g. sles3aos2capb1l, sodiumbenzo ate2).
    const leadingBoundary = /^[a-z]/i.test(compact) ? '(^|\\W|\\d)' : '(^|\\W)';
    const trailingBoundary = /[a-z]$/i.test(compact) ? '((?=\\W|\\d)|$)' : '((?=\\W)|$)';
    const regex = new RegExp(`${leadingBoundary}${pattern}${trailingBoundary}`, 'i');

    return regex.test(description.toLowerCase());
  }

  /**
   * Returns true only when ALL tokens in the rule match the transaction description (AND logic).
   */
  static matchesRule(description: string, rule: ExpenseRule): boolean {
    if (!description) return false;
    const tokens = this.getRuleTokens(rule);
    if (tokens.length === 0) return false;
    return tokens.every(token => this.matchesKeyword(description, token));
  }

  /**
   * Canonical serialization of all 5 category levels for equality/conflict comparison.
   */
  static getCategoryMappingKey(rule: Pick<ExpenseRule, 'department' | 'category' | 'sub_category1' | 'sub_category2' | 'sub_category3_values'>): string {
    return JSON.stringify([
      (rule.department || '').trim(),
      (rule.category || '').trim(),
      (rule.sub_category1 || '').trim(),
      (rule.sub_category2 || '').trim(),
      this.normalizeLevel5Values(rule.sub_category3_values)
    ]);
  }

  /**
   * Applies the highest-specificity, highest-priority matching rule to a single transaction.
   * Flags equally specific & equally prioritized conflicting rules for manual review.
   */
  static applyExpenseRules(transaction: NormalizedTransaction, rules: ExpenseRule[]): NormalizedTransaction {
    const result: NormalizedTransaction = { ...transaction };

    // Search the transaction description (notes/reference/narration) without splitting it on "/"
    const desc = (result.notes || '').toLowerCase();

    const matchedRules = rules.filter(rule => this.matchesRule(desc, rule));

    if (matchedRules.length === 0) {
      // Fallback behavior when no rule matches
      result.main_category = result.main_category || 'Uncategorized';
      result.sub_category1 = result.sub_category1 || undefined;
      result.sub_category2 = result.sub_category2 || undefined;
      result.sub_category3 = result.sub_category3 || undefined;
      result.sub_category3_values = result.sub_category3_values || [];
      result.vendor = result.vendor || 'ICICI Bank Transaction';
      result.matchedRuleId = null;
      return result;
    }

    // Rank by specificity DESC (more keywords wins), then priority ASC, then created_at ASC
    const indexed = matchedRules.map((rule, idx) => ({
      rule,
      idx,
      specificity: this.getRuleTokens(rule).length,
      priority: rule.priority ?? 100,
      createdAtMs: rule.created_at ? Date.parse(rule.created_at) : Number.NaN
    }));

    indexed.sort((a, b) => {
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (!Number.isNaN(a.createdAtMs) && !Number.isNaN(b.createdAtMs) && a.createdAtMs !== b.createdAtMs) {
        return a.createdAtMs - b.createdAtMs;
      }
      return a.idx - b.idx;
    });

    const top = indexed[0];
    const topTier = indexed.filter(
      item => item.specificity === top.specificity && item.priority === top.priority
    );

    const distinctMappings = new Set(topTier.map(item => this.getCategoryMappingKey(item.rule)));

    if (distinctMappings.size > 1) {
      // Ambiguous top-tier conflict: explicitly reset all 5 levels so no AI/partial category leaks
      result.main_category = 'Uncategorized';
      result.sub_category1 = null;
      result.sub_category2 = null;
      result.sub_category3 = null;
      result.sub_category3_values = [];
      result.vendor = result.vendor || 'ICICI Bank Transaction';
      result.ruleConflict = {
        matchedRuleIds: topTier.map(item => item.rule.id),
        matchedKeywords: topTier.map(item => item.rule.keyword),
        reason: `Conflicting automation rules matched (${topTier.map(item => item.rule.keyword).join(' vs ')})`
      };
      result.matchedRuleId = null;
      return result;
    }

    const matchedRule = top.rule;
    const ruleSub3Values = this.normalizeLevel5Values(matchedRule.sub_category3_values);

    // Only populate fields if they don't already exist on the normalized transaction
    result.main_category = result.main_category || matchedRule.department || undefined;
    result.sub_category1 = result.sub_category1 || matchedRule.category || undefined;
    result.sub_category2 = result.sub_category2 || matchedRule.sub_category1 || undefined;
    result.sub_category3 = result.sub_category3 || matchedRule.sub_category2 || undefined;
    result.sub_category3_values =
      result.sub_category3_values && result.sub_category3_values.length > 0
        ? result.sub_category3_values
        : ruleSub3Values;
    result.vendor = result.vendor || matchedRule.vendor || undefined;
    result.payment_mode = result.payment_mode || matchedRule.payment_mode || undefined;
    result.gst_status = result.gst_status || matchedRule.gst_status || undefined;
    result.purchased_by = result.purchased_by || matchedRule.purchased_by || undefined;
    result.approved_by = result.approved_by || matchedRule.approved_by || undefined;

    // Never overwrite the actual parsed transaction notes, only populate if empty
    result.notes = result.notes || matchedRule.notes || undefined;
    result.matchedRuleId = matchedRule.id;

    return result;
  }
}
