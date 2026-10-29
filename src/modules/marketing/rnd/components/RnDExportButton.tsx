import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Check, Loader2 } from 'lucide-react';
import { ResearchJob, ProfileResearchResult } from '../types/rndTypes';
import { exportToExcel, exportToCsv } from '../utils/rndExportService';

interface RnDExportButtonProps {
  job: ResearchJob | null;
  researchResults: Record<string, ProfileResearchResult>;
  isBatchRunning?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const RnDExportButton: React.FC<RnDExportButtonProps> = ({
  job,
  researchResults,
  isBatchRunning = false,
  className = '',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const resultsCount = Object.keys(researchResults).length;
  const hasResults = resultsCount > 0;
  const isDisabled = !job || job.profiles.length === 0 || !hasResults || isBatchRunning;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (isDisabled || !job) return;
    setIsOpen(false);

    try {
      if (format === 'xlsx') {
        exportToExcel(job.profiles, researchResults);
      } else {
        exportToCsv(job.profiles, researchResults);
      }
      setDownloadSuccess(format.toUpperCase());
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const getButtonTitle = () => {
    if (!job || job.profiles.length === 0) return 'Upload a file to enable export';
    if (isBatchRunning) return 'Export will be available after batch research finishes';
    if (!hasResults) return 'No research results available yet. Start research first.';
    return `Export results for ${job.profiles.length} profile${job.profiles.length !== 1 ? 's' : ''} (${resultsCount} researched)`;
  };

  const isSmall = size === 'sm';

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !isDisabled && setIsOpen(prev => !prev)}
        disabled={isDisabled}
        title={getButtonTitle()}
        className={`rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm ${
          isSmall ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        } ${
          isDisabled
            ? 'bg-[#111827] text-[#64748B] border border-[#293548] cursor-not-allowed opacity-60'
            : 'bg-[#10B981] hover:bg-emerald-600 text-white border border-emerald-500/40 shadow-sm shadow-emerald-900/20'
        }`}
      >
        {isBatchRunning ? (
          <Loader2 size={isSmall ? 14 : 16} className="animate-spin" />
        ) : downloadSuccess ? (
          <Check size={isSmall ? 14 : 16} className="text-emerald-200" />
        ) : (
          <Download size={isSmall ? 14 : 16} />
        )}
        <span>
          {isBatchRunning
            ? 'Researching...'
            : downloadSuccess
              ? `Exported ${downloadSuccess}`
              : 'Export Results'}
        </span>
        {!isDisabled && (
          <ChevronDown
            size={isSmall ? 12 : 14}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#171F2B] border border-[#293548] rounded-xl shadow-2xl py-2 z-50 animate-fade-in">
          <div className="px-3 py-1.5 border-b border-[#293548]/60 mb-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Export {job?.profiles.length || 0} Profiles ({resultsCount} Researched)
            </span>
          </div>

          <button
            onClick={() => handleExport('xlsx')}
            className="w-full px-3 py-2.5 flex items-start gap-3 hover:bg-[#1D2736] transition-colors text-left group"
          >
            <div className="p-2 rounded-lg bg-[#10B981]/10 text-[#10B981] group-hover:bg-[#10B981]/20 transition-colors mt-0.5 border border-[#10B981]/20">
              <FileSpreadsheet size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#F1F5F9] group-hover:text-[#10B981] transition-colors">
                Download Excel (.xlsx)
              </span>
              <span className="text-[11px] text-[#94A3B8] leading-snug">
                Formatted workbook with frozen headers &amp; auto-filters
              </span>
            </div>
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="w-full px-3 py-2.5 flex items-start gap-3 hover:bg-[#1D2736] transition-colors text-left group border-t border-[#293548]/40"
          >
            <div className="p-2 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] group-hover:bg-[#3B82F6]/20 transition-colors mt-0.5 border border-[#3B82F6]/20">
              <FileText size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#F1F5F9] group-hover:text-[#3B82F6] transition-colors">
                Download CSV (.csv)
              </span>
              <span className="text-[11px] text-[#94A3B8] leading-snug">
                Standard UTF-8 comma-separated text file
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
