import React from 'react';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

interface AnalyticsSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedValue: T;
  onChange: (val: T) => void;
  activeColorClass?: string;
  ariaLabel?: string;
}

export function AnalyticsSegmentedControl<T extends string = string>({
  options,
  selectedValue,
  onChange,
  activeColorClass = 'bg-purple-600 text-white shadow-sm',
  ariaLabel = 'Segmented Control'
}: AnalyticsSegmentedControlProps<T>) {
  return (
    <div 
      role="group" 
      aria-label={ariaLabel}
      className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto no-scrollbar max-w-full"
    >
      {options.map(opt => {
        const isActive = selectedValue === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
              isActive
                ? `${activeColorClass} font-extrabold`
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
