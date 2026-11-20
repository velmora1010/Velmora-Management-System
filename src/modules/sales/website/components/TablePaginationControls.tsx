import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface TablePaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  recordLabel?: string;
  className?: string;
}

export const TablePaginationControls: React.FC<TablePaginationControlsProps> = ({
  currentPage,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  recordLabel = 'records',
  className = ''
}) => {
  if (totalRecords <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startRecord = (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalRecords);

  return (
    <div className={`p-3 bg-slate-950/70 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 select-none ${className}`}>
      {/* Left: Showing range & page size */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="text-white font-mono">{startRecord}</strong>–<strong className="text-white font-mono">{endRecord}</strong> of <strong className="text-white font-mono">{totalRecords.toLocaleString('en-IN')}</strong> {recordLabel}
        </span>

        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
          <span className="text-[11px] text-slate-400">Per page:</span>
          <select
            value={pageSize}
            onChange={e => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="h-7 px-2 bg-slate-900 border border-slate-700/80 text-white rounded-lg outline-none cursor-pointer text-xs font-mono focus:border-purple-500"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="Previous Page"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="px-2.5 py-0.5 font-mono text-white text-xs font-bold bg-slate-900/60 rounded border border-slate-800/80">
          Page {safePage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="Next Page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default TablePaginationControls;
