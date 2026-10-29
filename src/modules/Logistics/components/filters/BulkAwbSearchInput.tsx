import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Layers, Check, AlertCircle } from 'lucide-react';

interface BulkAwbSearchInputProps {
  searchMode: 'awb' | 'order' | 'customer' | 'all';
  onSearchModeChange: (mode: 'awb' | 'order' | 'customer' | 'all') => void;
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
  bulkAwbs: string[];
  onBulkAwbsChange: (awbs: string[]) => void;
}

const SEARCH_MODES = [
  { id: 'awb', label: 'AWB', placeholder: 'Search upto 100 AWBs' },
  { id: 'order', label: 'Order ID', placeholder: 'Search Order ID...' },
  { id: 'customer', label: 'Customer', placeholder: 'Search Name or Phone...' },
  { id: 'all', label: 'All', placeholder: 'Search all fields...' }
] as const;

export const BulkAwbSearchInput: React.FC<BulkAwbSearchInputProps> = ({
  searchMode,
  onSearchModeChange,
  searchTerm,
  onSearchTermChange,
  bulkAwbs,
  onBulkAwbsChange
}) => {
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const bulkModalRef = useRef<HTMLDivElement>(null);

  // Close mode menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeOpen(false);
      }
      if (bulkModalRef.current && !bulkModalRef.current.contains(e.target as Node)) {
        setIsBulkModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // When bulkModal opens, populate with existing AWBs
  useEffect(() => {
    if (isBulkModalOpen) {
      setBulkInputText(bulkAwbs.join('\n'));
    }
  }, [isBulkModalOpen, bulkAwbs]);

  // Parse bulk text into sanitized unique array (max 100)
  const parsedAwbs = useMemo(() => {
    if (!bulkInputText.trim()) return [];
    const items = bulkInputText
      .split(/[\r\n,;\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    // Deduplicate
    const unique = Array.from(new Set(items));
    return unique.slice(0, 100);
  }, [bulkInputText]);

  // Handle pasting in main input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Check if pasted multiple AWBs (contains newline, comma, or whitespace separated string with multiple tokens)
    if (searchMode === 'awb' && (val.includes('\n') || val.includes(',') || val.includes(';'))) {
      const items = val
        .split(/[\r\n,;\t]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      const unique = Array.from(new Set(items)).slice(0, 100);
      if (unique.length > 1) {
        onBulkAwbsChange(unique);
        onSearchTermChange('');
        return;
      }
    }
    onSearchTermChange(val);
  };

  const currentModeObj = SEARCH_MODES.find(m => m.id === searchMode) || SEARCH_MODES[0];

  const handleApplyBulk = () => {
    onBulkAwbsChange(parsedAwbs);
    if (parsedAwbs.length > 0) {
      onSearchTermChange('');
    }
    setIsBulkModalOpen(false);
  };

  const handleClearBulk = () => {
    onBulkAwbsChange([]);
    setBulkInputText('');
  };

  return (
    <div className="relative flex items-center h-9 bg-[#0e1626] border border-slate-800 rounded-xl focus-within:border-purple-500 transition-all shadow-sm">
      
      {/* Mode Selector Dropdown */}
      <div className="relative shrink-0" ref={modeMenuRef}>
        <button
          type="button"
          onClick={() => setIsModeOpen(prev => !prev)}
          className="h-9 px-3 flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#0b1220] rounded-l-xl border-r border-slate-800 cursor-pointer transition-colors"
        >
          <span>{currentModeObj.label}</span>
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${isModeOpen ? 'rotate-180' : ''}`} />
        </button>

        {isModeOpen && (
          <div className="absolute left-0 mt-1 w-36 bg-[#0e1626] border border-slate-700/80 rounded-xl shadow-xl z-50 py-1 flex flex-col animate-in fade-in zoom-in-95 duration-100">
            {SEARCH_MODES.map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onSearchModeChange(mode.id);
                  setIsModeOpen(false);
                }}
                className={`text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between hover:bg-slate-800 transition-colors ${
                  searchMode === mode.id ? 'text-purple-400 font-bold bg-purple-950/30' : 'text-slate-300'
                }`}
              >
                <span>{mode.label}</span>
                {searchMode === mode.id && <Check size={12} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk AWB Badge (if bulk AWBs are active) */}
      {searchMode === 'awb' && bulkAwbs.length > 0 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 ml-1.5 rounded-lg bg-purple-950/70 border border-purple-700/70 text-purple-200 text-xs shrink-0">
          <Layers size={12} className="text-purple-400" />
          <span className="font-semibold">{bulkAwbs.length} AWBs</span>
          <button
            type="button"
            onClick={handleClearBulk}
            className="hover:text-white ml-0.5"
            title="Clear bulk AWBs"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      {/* Main Text Input */}
      <div className="relative flex-1 flex items-center min-w-0">
        <Search size={14} className="absolute left-2.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          placeholder={bulkAwbs.length > 0 ? 'Filtering by selected AWBs...' : currentModeObj.placeholder}
          disabled={bulkAwbs.length > 0}
          className="w-full h-8 pl-8 pr-8 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchTermChange('')}
            className="absolute right-2 text-slate-500 hover:text-slate-300"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Bulk AWB Popover Button (Available in AWB mode) */}
      {searchMode === 'awb' && (
        <div className="relative shrink-0 pr-1.5" ref={bulkModalRef}>
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(prev => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition-colors"
            title="Open bulk AWB search (up to 100)"
          >
            <Layers size={14} />
          </button>

          {/* Bulk AWB Modal Popover */}
          {isBulkModalOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl z-50 p-3.5 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers size={14} className="text-purple-400" /> Bulk AWB Search
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-purple-300">
                  {parsedAwbs.length} / 100 AWBs
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight">
                Paste or enter up to 100 AWBs separated by newlines, commas, or spaces.
              </p>

              <textarea
                value={bulkInputText}
                onChange={e => setBulkInputText(e.target.value)}
                placeholder="Paste AWBs here, e.g.:&#10;57251410036492&#10;57251410036493&#10;57251410036494"
                rows={6}
                className="w-full p-2.5 bg-[#0b1220] border border-slate-700/80 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 custom-scrollbar resize-none"
                autoFocus
              />

              {parsedAwbs.length >= 100 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <AlertCircle size={12} />
                  <span>Maximum 100 AWBs limit reached</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleClearBulk}
                  className="text-xs text-slate-400 hover:text-white px-1.5 py-1"
                >
                  Clear
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="h-7 px-2.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBulk}
                    className="h-7 px-3 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors cursor-pointer"
                  >
                    Apply {parsedAwbs.length > 0 ? `(${parsedAwbs.length})` : ''}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
