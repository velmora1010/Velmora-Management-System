import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface OptionItem {
  label: string;
  value: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: OptionItem[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select items...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredVals = filteredOptions.map(o => o.value);
    const combined = Array.from(new Set([...selectedValues, ...allFilteredVals]));
    onChange(combined);
  };

  const handleClearAll = () => {
    const filteredValsSet = new Set(filteredOptions.map(o => o.value));
    onChange(selectedValues.filter(v => !filteredValsSet.has(v)));
  };

  const getSummaryText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const match = options.find(o => o.value === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    return `${selectedValues.length} selected`;
  };

  return (
    <div ref={dropdownRef} className="relative w-full text-xs">
      {/* DROPDOWN LABEL */}
      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
        {label}
        {selectedValues.length > 0 && (
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
            {selectedValues.length}
          </span>
        )}
      </label>

      {/* CONTROL BUTTON */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[40px] px-3 bg-slate-950 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-slate-900 text-slate-600'
            : selectedValues.length > 0
              ? 'border-indigo-500/60 bg-indigo-950/20 text-white shadow-sm'
              : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
        }`}
      >
        <span className="truncate pr-2">{getSummaryText()}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180 text-indigo-400' : 'text-slate-500'}`} />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150 max-h-[320px] flex flex-col">
          {/* SEARCH HEADER */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/90 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* SELECT ALL / CLEAR ALL ACTION BAR */}
            <div className="flex items-center justify-between px-1 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* SCROLLABLE OPTIONS LIST */}
          <div className="overflow-y-auto p-1 divide-y divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-[11px]">No options match search</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-indigo-600/20 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
