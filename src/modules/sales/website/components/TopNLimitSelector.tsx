import React from 'react';

export interface TopNLimitSelectorProps {
  limit: number | 'all';
  onChange: (limit: number | 'all') => void;
  options?: Array<{ label: string; value: number | 'all' }>;
  className?: string;
  size?: 'sm' | 'md';
}

const DEFAULT_OPTIONS: Array<{ label: string; value: number | 'all' }> = [
  { label: 'Top 10', value: 10 },
  { label: 'Top 50', value: 50 },
  { label: 'Top 100', value: 100 },
  { label: 'All Records', value: 'all' }
];

export const TopNLimitSelector: React.FC<TopNLimitSelectorProps> = ({
  limit,
  onChange,
  options = DEFAULT_OPTIONS,
  className = '',
  size = 'md'
}) => {
  return (
    <div className={`flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 ${className}`}>
      {options.map(opt => {
        const isSelected = limit === opt.value || (opt.value === 'all' && (limit === 0 || limit === 'all'));
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
              isSelected
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            } ${size === 'sm' ? 'text-[11px] px-1.5' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default TopNLimitSelector;
