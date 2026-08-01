import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

interface MultiSelectProps {
  options: string[];
  selectedValues: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  placeholder?: string;
  disabled?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select...",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter(opt => opt.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [options, searchQuery]);

  const handleToggle = (val: string) => {
    onChange(prev =>
      prev.includes(val)
        ? prev.filter(v => v !== val)
        : [...prev, val]
    );
  };

  const handleSelectAll = () => {
    onChange(options);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const removeValue = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(prev => prev.filter(v => v !== val));
  };

  return (
    <div className="relative w-full text-sm" ref={containerRef}>
      <div 
        className={`flex items-center justify-between w-full min-h-[42px] bg-background border border-border text-main rounded-xl px-4 py-2 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus-within:border-primary'} ${isOpen ? 'border-primary' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 mr-2">
          {selectedValues.length === 0 ? (
            <span className="text-muted">{placeholder}</span>
          ) : (
            selectedValues.map(val => (
              <span key={val} className="inline-flex items-center gap-1 bg-black/5 dark:bg-white/10 text-main px-2 py-0.5 rounded-md text-xs font-medium">
                {val}
                <button onClick={(e) => removeValue(val, e)} className="hover:text-primary transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown size={16} className={`text-muted transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1.5 bg-card border border-border/80 rounded-xl shadow-lg max-h-[260px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Search */}
          <div className="p-2 border-b border-border/50 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="w-full bg-background border border-border/50 text-main text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-black/5 dark:bg-white/5 shrink-0">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
              className="text-xs font-medium text-primary hover:brightness-110 transition-all"
            >
              Select All
            </button>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
              className="text-xs font-medium text-muted hover:text-main transition-all"
            >
              Clear All
            </button>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto custom-scrollbar py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted">No options found.</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt} 
                  onClick={(e) => { e.stopPropagation(); handleToggle(opt); }}
                  className="flex items-center px-3 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border mr-2.5 transition-colors ${selectedValues.includes(opt) ? 'bg-primary border-primary text-white' : 'border-border/80 group-hover:border-primary'}`}>
                    {selectedValues.includes(opt) && <Check size={12} />}
                  </div>
                  <span className="text-sm text-main">{opt}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
