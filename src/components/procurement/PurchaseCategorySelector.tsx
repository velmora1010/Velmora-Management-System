import React from 'react';

interface PurchaseCategorySelectorProps {
  mainCategory: string;
  subCategory1: string;
  subCategory2: string;
  
  mainOptions: { id: string; name: string }[];
  sub1Options: { id: string; name: string }[];
  sub2Options: string[];
  
  handleMainChange: (val: string) => void;
  handleSub1Change: (val: string) => void;
  handleSub2Change: (val: string) => void;
  
  disabled?: boolean;
}

export const PurchaseCategorySelector: React.FC<PurchaseCategorySelectorProps> = ({
  mainCategory, subCategory1, subCategory2,
  mainOptions, sub1Options, sub2Options,
  handleMainChange, handleSub1Change, handleSub2Change,
  disabled = false
}) => {
  const selectClass = "w-full bg-slate-900 border-2 border-slate-700 text-slate-200 rounded-lg px-4 py-2 text-base transition-colors focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-400 ml-1">Department *</label>
        <select 
          className={selectClass} 
          value={mainCategory} 
          onChange={(e) => handleMainChange(e.target.value)}
          disabled={disabled}
          required
        >
          <option value="">Select Department</option>
          {mainOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-400 ml-1">Section *</label>
        <select 
          className={selectClass} 
          value={subCategory1} 
          onChange={(e) => handleSub1Change(e.target.value)}
          disabled={disabled || !mainCategory || sub1Options.length === 0}
          required
        >
          <option value="">Select Section</option>
          {sub1Options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-400 ml-1">Sub Category 2</label>
        <select 
          className={selectClass} 
          value={subCategory2} 
          onChange={(e) => handleSub2Change(e.target.value)}
          disabled={disabled || !subCategory1 || sub2Options.length === 0}
        >
          <option value="">Select Sub Category 2</option>
          {sub2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    </div>
  );
};
