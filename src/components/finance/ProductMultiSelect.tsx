import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface ProductMultiSelectProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ProductMultiSelect: React.FC<ProductMultiSelectProps> = React.memo(({
  options,
  selectedValues,
  onChange,
  placeholder = "Select Products...",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleToggle = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const displayText = selectedValues.length === 0 
    ? placeholder 
    : selectedValues.length > 3 
      ? `${selectedValues.length} Selected` 
      : selectedValues.join(', ');

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className={`flex items-center justify-between w-full bg-transparent border-2 border-border text-main rounded-lg px-4 py-2 text-base transition-velmora ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'} ${isOpen ? 'border-primary' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`truncate ${selectedValues.length === 0 ? 'text-muted' : 'text-main'}`}>
          {displayText}
        </span>
        <ChevronDown className="w-5 h-5 text-muted flex-shrink-0" />
      </div>

      {isOpen && !disabled && options.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-sidebar border border-border rounded-lg shadow-velmora max-h-60 overflow-y-auto py-2">
          {options.map(opt => (
            <label key={opt} className="flex items-center px-4 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 mr-3 rounded border-border text-primary focus:ring-primary"
                checked={selectedValues.includes(opt)}
                onChange={() => handleToggle(opt)}
              />
              <span className="text-main">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
});
