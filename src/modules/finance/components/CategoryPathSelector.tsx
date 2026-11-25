import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { MultiSelect } from '../../../components/ui/MultiSelect';
import {
  type ExpenseCategoryPath,
  normalizePathLevel5Values
} from '../services/expenseCategoryPathUtils';

type CategoryColumn = 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub_sub_sub_category';

interface CategoryFilters {
  main?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
}

const categoryOptionsCache = new Map<string, string[]>();

export function clearCategoryOptionsCache() {
  categoryOptionsCache.clear();
}

export function validateCategoryPathHierarchy(path: ExpenseCategoryPath): {
  valid: boolean;
  error?: string;
} {
  const main = (path.main_category || '').trim();
  const sub1 = (path.sub_category1 || '').trim();
  const sub2 = (path.sub_category2 || '').trim();
  const sub3 = (path.sub_category3 || '').trim();
  const level5 = normalizePathLevel5Values(path.sub_category3_values);

  if (!main) {
    return { valid: false, error: 'Department (Main Category) is required.' };
  }
  if (!sub1) {
    return { valid: false, error: 'Category (Sub Category 1) is required.' };
  }
  if (sub3 && !sub2) {
    return {
      valid: false,
      error: 'Subcategory 2 cannot be selected without Subcategory 1.'
    };
  }
  if (level5.length > 0 && (!sub2 || !sub3)) {
    return {
      valid: false,
      error: 'Level 5 values cannot be selected when parent subcategory levels are missing.'
    };
  }

  return { valid: true };
}

export interface CategoryPathSelectorProps {
  value: ExpenseCategoryPath;
  onChange: (nextPath: ExpenseCategoryPath) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  disabled?: boolean;
  index?: number;
  showHeader?: boolean;
  variant?: 'editor' | 'form';
  isDuplicate?: boolean;
  validationError?: string | null;
  showRuleSelector?: boolean;
  isSelectedRulePath?: boolean;
  onSelectRulePath?: () => void;
}

export const CategoryPathSelector: React.FC<CategoryPathSelectorProps> = ({
  value,
  onChange,
  onRemove,
  canRemove = false,
  disabled = false,
  index = 0,
  showHeader = true,
  variant = 'editor',
  isDuplicate = false,
  validationError = null,
  showRuleSelector = false,
  isSelectedRulePath = false,
  onSelectRulePath
}) => {
  const [mainOptions, setMainOptions] = useState<string[]>([]);
  const [sub1Options, setSub1Options] = useState<string[]>([]);
  const [sub2Options, setSub2Options] = useState<string[]>([]);
  const [sub3Options, setSub3Options] = useState<string[]>([]);
  const [sub4Options, setSub4Options] = useState<string[]>([]);

  const selectedMain = value.main_category || '';
  const selectedSub1 = value.sub_category1 || '';
  const selectedSub2 = value.sub_category2 || '';
  const selectedSub3 = value.sub_category3 || '';
  const selectedSub4Values = normalizePathLevel5Values(value.sub_category3_values);

  const loadOptions = useCallback(
    async (targetCol: CategoryColumn, filters: CategoryFilters): Promise<string[]> => {
      const cacheKey = JSON.stringify({ targetCol, filters });
      const cached = categoryOptionsCache.get(cacheKey);
      if (cached) return cached;

      try {
        let query = supabase
          .from('finance_categories_rows')
          .select(targetCol)
          .eq('status', 'active');

        if (filters.main) query = query.eq('main', filters.main);
        if (filters.sub1) query = query.eq('sub1', filters.sub1);
        if (filters.sub2) query = query.eq('sub2', filters.sub2);
        if (filters.sub3) query = query.eq('sub3', filters.sub3);

        const { data, error } = await query;
        if (error) throw error;

        const unique = Array.from(
          new Set(
            (data || [])
              .map((row: Record<string, unknown>) => String(row[targetCol] || '').trim())
              .filter(Boolean)
          )
        ).sort();

        categoryOptionsCache.set(cacheKey, unique);
        return unique;
      } catch (err) {
        console.error(`Error loading ${targetCol} options:`, err);
        return [];
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    loadOptions('main', {}).then(opts => {
      if (active) setMainOptions(opts);
    });
    return () => {
      active = false;
    };
  }, [loadOptions]);

  useEffect(() => {
    let active = true;
    if (!selectedMain) {
      setSub1Options([]);
      return;
    }
    loadOptions('sub1', { main: selectedMain }).then(opts => {
      if (active) setSub1Options(opts);
    });
    return () => {
      active = false;
    };
  }, [selectedMain, loadOptions]);

  useEffect(() => {
    let active = true;
    if (!selectedMain || !selectedSub1) {
      setSub2Options([]);
      return;
    }
    loadOptions('sub2', { main: selectedMain, sub1: selectedSub1 }).then(opts => {
      if (active) setSub2Options(opts);
    });
    return () => {
      active = false;
    };
  }, [selectedMain, selectedSub1, loadOptions]);

  useEffect(() => {
    let active = true;
    if (!selectedMain || !selectedSub1 || !selectedSub2) {
      setSub3Options([]);
      return;
    }
    loadOptions('sub3', {
      main: selectedMain,
      sub1: selectedSub1,
      sub2: selectedSub2
    }).then(opts => {
      if (active) setSub3Options(opts);
    });
    return () => {
      active = false;
    };
  }, [selectedMain, selectedSub1, selectedSub2, loadOptions]);

  useEffect(() => {
    let active = true;
    if (!selectedMain || !selectedSub1 || !selectedSub2 || !selectedSub3) {
      setSub4Options([]);
      return;
    }
    loadOptions('sub_sub_sub_category', {
      main: selectedMain,
      sub1: selectedSub1,
      sub2: selectedSub2,
      sub3: selectedSub3
    }).then(opts => {
      if (active) setSub4Options(opts);
    });
    return () => {
      active = false;
    };
  }, [selectedMain, selectedSub1, selectedSub2, selectedSub3, loadOptions]);

  const handleMainChange = (nextMain: string) => {
    onChange({
      ...value,
      main_category: nextMain,
      sub_category1: '',
      sub_category2: null,
      sub_category3: null,
      sub_category3_values: []
    });
  };

  const handleSub1Change = (nextSub1: string) => {
    onChange({
      ...value,
      sub_category1: nextSub1,
      sub_category2: null,
      sub_category3: null,
      sub_category3_values: []
    });
  };

  const handleSub2Change = (nextSub2: string) => {
    onChange({
      ...value,
      sub_category2: nextSub2 || null,
      sub_category3: null,
      sub_category3_values: []
    });
  };

  const handleSub3Change = (nextSub3: string) => {
    onChange({
      ...value,
      sub_category3: nextSub3 || null,
      sub_category3_values: []
    });
  };

  const handleLevel5Change: React.Dispatch<React.SetStateAction<string[]>> = (updater) => {
    const current = normalizePathLevel5Values(value.sub_category3_values);
    const next = typeof updater === 'function' ? updater(current) : updater;
    onChange({
      ...value,
      sub_category3_values: normalizePathLevel5Values(next)
    });
  };

  const isForm = variant === 'form';
  const containerClass = isForm
    ? `p-4 rounded-xl border ${
        isDuplicate || validationError
          ? 'bg-red-500/5 border-red-500/40'
          : 'bg-slate-900/60 border-slate-700/70'
      } space-y-3`
    : `p-3 rounded-lg border ${
        isDuplicate || validationError
          ? 'bg-red-500/5 border-red-500/40'
          : 'bg-background/60 border-border'
      } space-y-2.5`;

  const labelClass = isForm
    ? 'block text-xs font-medium text-slate-300 mb-1.5'
    : 'text-[10px] font-bold text-muted uppercase tracking-wider';

  const selectClass = isForm
    ? 'w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
    : 'w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed';

  const renderOptionsWithCurrent = (options: string[], currentValue: string) => {
    if (!currentValue || options.includes(currentValue)) {
      return options;
    }
    return [currentValue, ...options];
  };

  const mergedMainOptions = renderOptionsWithCurrent(mainOptions, selectedMain);
  const mergedSub1Options = renderOptionsWithCurrent(sub1Options, selectedSub1);
  const mergedSub2Options = renderOptionsWithCurrent(sub2Options, selectedSub2);
  const mergedSub3Options = renderOptionsWithCurrent(sub3Options, selectedSub3);
  const mergedSub4Options = Array.from(new Set([...selectedSub4Values, ...sub4Options]));

  const showSub2 = Boolean(selectedMain && selectedSub1 && (mergedSub2Options.length > 0 || selectedSub2));
  const showSub3 = Boolean(showSub2 && selectedSub2 && (mergedSub3Options.length > 0 || selectedSub3));
  const showSub4 = Boolean(showSub3 && selectedSub3 && (mergedSub4Options.length > 0 || selectedSub4Values.length > 0));

  return (
    <div className={containerClass} data-testid={`category-path-selector-${index}`}>
      {showHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={
                isForm
                  ? 'text-xs font-semibold text-slate-200'
                  : 'text-xs font-semibold text-main'
              }
            >
              Category Path {index + 1}
            </span>
            {isDuplicate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                Duplicate Path
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showRuleSelector && onSelectRulePath && (
              <button
                type="button"
                onClick={onSelectRulePath}
                disabled={disabled}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  isSelectedRulePath
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-surface text-muted border-border hover:text-main'
                }`}
                title="Use this category path when saving an automation rule"
              >
                <Sparkles className="w-3 h-3" />
                {isSelectedRulePath ? 'Rule Target' : 'Set as Rule'}
              </button>
            )}

            {canRemove && onRemove && !disabled && (
              <button
                type="button"
                onClick={onRemove}
                className={
                  isForm
                    ? 'inline-flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors'
                    : 'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors'
                }
                title="Remove category path"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      <div className={isForm ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3'}>
        <div className={isForm ? '' : 'space-y-1'}>
          <label className={labelClass}>{isForm ? 'Main Category *' : 'Department *'}</label>
          <select
            value={selectedMain}
            onChange={(e) => handleMainChange(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            <option value="">{isForm ? 'Select Main Category' : 'Select'}</option>
            {mergedMainOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className={isForm ? '' : 'space-y-1'}>
          <label className={labelClass}>{isForm ? 'Sub Category *' : 'Category *'}</label>
          <select
            value={selectedSub1}
            onChange={(e) => handleSub1Change(e.target.value)}
            disabled={disabled || !selectedMain}
            className={selectClass}
          >
            <option value="">{isForm ? 'Select Sub Category' : 'Select'}</option>
            {mergedSub1Options.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {showSub2 && (
          <div className={isForm ? '' : 'space-y-1'}>
            <label className={labelClass}>{isForm ? 'Sub Category 1' : 'Sub Cat 1'}</label>
            <select
              value={selectedSub2}
              onChange={(e) => handleSub2Change(e.target.value)}
              disabled={disabled || !selectedSub1}
              className={selectClass}
            >
              <option value="">{isForm ? 'Select Sub Category 1' : 'Select'}</option>
              {mergedSub2Options.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {showSub3 && (
          <div className={isForm ? '' : 'space-y-1'}>
            <label className={labelClass}>{isForm ? 'Sub Category 2' : 'Sub Cat 2'}</label>
            <select
              value={selectedSub3}
              onChange={(e) => handleSub3Change(e.target.value)}
              disabled={disabled || !selectedSub2}
              className={selectClass}
            >
              <option value="">{isForm ? 'Select Sub Category 2' : 'Select'}</option>
              {mergedSub3Options.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {showSub4 && (
          <div className={isForm ? 'sm:col-span-2' : 'col-span-2 space-y-1'}>
            <label className={labelClass}>{isForm ? 'Sub Category 3' : 'Sub Cat 3'}</label>
            <MultiSelect
              options={mergedSub4Options}
              selectedValues={selectedSub4Values}
              onChange={handleLevel5Change}
              placeholder="Select Sub Category 3"
              disabled={disabled || !selectedSub3}
            />
          </div>
        )}
      </div>

      {validationError && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
