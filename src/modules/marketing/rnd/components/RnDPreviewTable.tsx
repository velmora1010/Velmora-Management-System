import React, { useState, useMemo } from 'react';
import { ResearchJob, ResearchInputProfile, ProfileResearchResult } from '../types/rndTypes';
import { extractDirectCategory } from '../utils/rndExportService';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  Play,
  AlertCircle,
  Activity,
  Loader2,
  Info,
  X
} from 'lucide-react';

/* =========================================================================
   3 & 4. Input File Card (with Replace File, Run Diagnostic, Start Research)
          & Processed / Ready / Warnings / Invalid / Duplicates Summary Cards
   ========================================================================= */
export interface RnDInputFileSummaryProps {
  job: ResearchJob;
  onReplaceFile: () => void;
  onStartResearch: () => void;
  onRunDiagnostic?: () => void;
  isEngineConnected: boolean;
  isDiagnosing?: boolean;
  isBatchRunning?: boolean;
}

export const RnDInputFileSummary: React.FC<RnDInputFileSummaryProps> = ({
  job,
  onReplaceFile,
  onStartResearch,
  onRunDiagnostic,
  isEngineConnected,
  isDiagnosing,
  isBatchRunning
}) => {
  return (
    <div className="w-full flex flex-col gap-4 animate-fade-in">
      {/* 3. Input File Card with File Details & Action Group */}
      <div className="bg-[#171F2B] p-4 sm:p-5 rounded-xl border border-[#293548] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: File details & Readiness Status */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="p-2.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-xl border border-[#3B82F6]/20 shrink-0 mt-0.5 sm:mt-0">
            <FileSpreadsheet size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-[#F1F5F9] font-bold text-sm sm:text-base truncate max-w-xs sm:max-w-md lg:max-w-lg" title={job.fileName}>
                {job.fileName}
              </h3>
              {job.status === 'invalid' ? (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                  Unable to prepare run
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  Research Run Ready ({job.readyProfiles} eligible)
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              {job.status === 'invalid' ? (
                <span>Input File · No valid profiles ready for research. Please resolve invalid rows.</span>
              ) : (
                <span>Input File · {job.totalProfiles} total profile{job.totalProfiles !== 1 ? 's' : ''} loaded ({job.readyProfiles} validated & ready for automated scraping)</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions (Replace File, Run Reel Diagnostic, Start Research) */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-auto">
          {/* Replace File */}
          <button
            type="button"
            onClick={onReplaceFile}
            disabled={isBatchRunning}
            className={`px-3.5 py-2 rounded-lg transition-colors border flex items-center gap-2 text-xs font-medium ${
              isBatchRunning
                ? 'bg-[#111827] text-[#64748B] border-[#293548] cursor-not-allowed opacity-60'
                : 'bg-[#111827] hover:bg-[#1C2636] text-[#F1F5F9] border-[#293548]'
            }`}
          >
            <RefreshCw size={13} className={isBatchRunning ? 'animate-spin' : ''} />
            <span>Replace File</span>
          </button>

          {/* Run Reel Diagnostic (secondary) */}
          {onRunDiagnostic && (
            <button
              type="button"
              onClick={onRunDiagnostic}
              disabled={isDiagnosing || !isEngineConnected || isBatchRunning}
              className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-2 text-xs transition-colors border ${
                isDiagnosing || !isEngineConnected || isBatchRunning
                  ? 'bg-[#111827] text-[#64748B] border-[#293548] cursor-not-allowed opacity-60'
                  : 'bg-[#111827] hover:bg-[#1A2332] text-[#3B82F6] border-[#3B82F6]/30 hover:border-[#3B82F6]/60'
              }`}
            >
              <Activity size={14} className={isDiagnosing ? 'animate-spin' : ''} />
              <span>{isDiagnosing ? 'Diagnosing...' : 'Run Reel Diagnostic'}</span>
            </button>
          )}

          {/* Start Research (primary blue action) */}
          <button
            type="button"
            onClick={onStartResearch}
            disabled={job.status === 'invalid' || !isEngineConnected || isDiagnosing || isBatchRunning}
            className={`px-5 py-2 rounded-lg font-semibold flex items-center gap-2 text-xs sm:text-sm transition-all shadow-sm ${
              job.status === 'invalid' || !isEngineConnected || isDiagnosing || isBatchRunning
                ? 'bg-[#111827] text-[#64748B] border border-[#293548] cursor-not-allowed opacity-60'
                : 'bg-[#3B82F6] hover:bg-blue-600 text-white shadow-blue-500/25 active:scale-[0.98]'
            }`}
          >
            {isBatchRunning ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Researching...</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-current" />
                <span>Start Research</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Processed / Ready / Warnings / Invalid / Duplicates Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-[#171F2B] p-3.5 sm:p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center gap-1">
          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Processed</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#F1F5F9]">{job.totalProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-3.5 sm:p-4 rounded-xl border border-[#10B981]/25 shadow-sm flex flex-col justify-center gap-1">
          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Ready</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#10B981]">{job.readyProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-3.5 sm:p-4 rounded-xl border border-[#F59E0B]/25 shadow-sm flex flex-col justify-center gap-1">
          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Warnings</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#F59E0B]">{job.warningProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-3.5 sm:p-4 rounded-xl border border-[#EF4444]/25 shadow-sm flex flex-col justify-center gap-1">
          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Invalid</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#EF4444]">{job.invalidProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-3.5 sm:p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center gap-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Duplicates</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#94A3B8]">{job.duplicateProfiles}</span>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   Profile Queue Table (Standalone queue, no duplicate action panels)
   ========================================================================= */
interface RnDPreviewTableProps {
  job: ResearchJob;
  researchResults?: Record<string, ProfileResearchResult>;
  onSelectProfile?: (profile: ResearchInputProfile) => void;
  selectedProfileCode?: string | null;
}

export const RnDPreviewTable: React.FC<RnDPreviewTableProps> = ({
  job,
  researchResults = {},
  onSelectProfile,
  selectedProfileCode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState<ResearchInputProfile | null>(null);

  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return job.profiles;
    const term = searchTerm.toLowerCase();
    return job.profiles.filter(p =>
      p.influencerCode.toLowerCase().includes(term) ||
      p.username.toLowerCase().includes(term) ||
      (p.name && p.name.toLowerCase().includes(term))
    );
  }, [job.profiles, searchTerm]);

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 size={16} className="text-[#10B981]" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-[#F59E0B]" />;
      case 'invalid':
        return <XCircle size={16} className="text-[#EF4444]" />;
      default:
        return null;
    }
  };

  const getRowCategory = (p: ResearchInputProfile): string => {
    const res = researchResults[p.influencerCode] || (p.researchResult as ProfileResearchResult | undefined);
    return extractDirectCategory(p, res);
  };

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in">
      {/* Profile Queue Table */}
      <div className="bg-[#171F2B] rounded-xl border border-[#293548] shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-[#293548] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-[#F1F5F9]">Profile Queue</h3>
            <span className="text-xs font-mono font-medium text-[#64748B] bg-[#111827] px-2 py-0.5 rounded border border-[#293548]">
              {filteredProfiles.length} {filteredProfiles.length === 1 ? 'profile' : 'profiles'}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={14} />
            <input
              type="text"
              placeholder="Search by code, username, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111827] border border-[#293548] rounded-lg pl-9 pr-8 py-1.5 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F1F5F9]"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#141A22] text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-[#293548]">
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Username</th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    <div className="relative group inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Category threshold information"
                        title="Category is based on at least 7 non-pinned Reels meeting the tier threshold. Average Views is calculated separately; viral outliers alone do not qualify a higher tier."
                        className="text-[#64748B] hover:text-[#3B82F6] focus:text-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 rounded cursor-help"
                      >
                        <Info size={13} />
                      </button>
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-0 top-full mt-1 hidden group-hover:block group-focus-within:block z-50 w-72 p-2.5 text-xs font-normal normal-case leading-relaxed bg-[#111827] text-[#F1F5F9] rounded-lg border border-[#293548] shadow-2xl"
                      >
                        Category is based on at least 7 non-pinned Reels meeting the tier threshold. Average Views is calculated separately; viral outliers alone do not qualify a higher tier.
                      </div>
                    </div>
                  </div>
                </th>
                <th className="px-5 py-3.5">Row</th>
                <th className="px-5 py-3.5">Validation</th>
                <th className="px-5 py-3.5">Research</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#293548]/40">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((p, i) => {
                  const rowCat = getRowCategory(p);
                  const isSelected = selectedProfileCode === p.influencerCode;
                  return (
                    <tr
                      key={`${p.influencerCode}-${i}`}
                      className={`hover:bg-[#1D2736]/60 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#3B82F6]/10 border-l-2 border-l-[#3B82F6]' : ''
                      }`}
                      onClick={() => {
                        onSelectProfile?.(p);
                        setSelectedRow(p);
                      }}
                    >
                      <td className="px-5 py-3">{renderStatusIcon(p.validationStatus)}</td>
                      <td className="px-5 py-3 font-semibold text-[#F1F5F9] font-mono">{p.influencerCode || '—'}</td>
                      <td className="px-5 py-3 text-[#F1F5F9]">@{p.username || '—'}</td>
                      <td className="px-5 py-3 text-[#94A3B8]">{p.name || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[#3B82F6] font-semibold">{rowCat || '—'}</td>
                      <td className="px-5 py-3 text-[#94A3B8] font-mono">{p.rowNumber}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          p.validationStatus === 'ready' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25' :
                          p.validationStatus === 'warning' ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/25' :
                          'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/25'
                        }`}>
                          {p.validationStatus === 'ready' ? 'Ready' : p.validationStatus === 'warning' ? 'Warning' : 'Invalid'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#94A3B8]">
                        {p.researchStatus === 'completed' ? (
                          <span className="text-[#10B981] font-medium flex items-center gap-1.5"><CheckCircle2 size={13}/> Completed</span>
                        ) : p.researchStatus === 'partial' || p.researchStatus === 'reels_not_enough' ? (
                          <span className="text-[#F59E0B] font-medium flex items-center gap-1.5"><AlertTriangle size={13}/> Partial</span>
                        ) : p.researchStatus === 'failed' ? (
                          <span className="text-[#EF4444] font-medium flex items-center gap-1.5"><AlertCircle size={13}/> Failed</span>
                        ) : p.researchStatus === 'running' ? (
                          <span className="text-[#3B82F6] font-medium flex items-center gap-1.5">
                            <Loader2 size={13} className="animate-spin" /> Running...
                          </span>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-[#64748B]">
                    No profiles found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Validation Details Modal / Inline View */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#171F2B] border border-[#293548] rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-[#F1F5F9] mb-4 flex items-center gap-2">
              {renderStatusIcon(selectedRow.validationStatus)}
              <span>Validation Details</span>
            </h3>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-[#94A3B8]">Row Number:</div>
                <div className="text-[#F1F5F9] font-medium font-mono">{selectedRow.rowNumber}</div>

                <div className="text-[#94A3B8]">Code:</div>
                <div className="text-[#F1F5F9] font-medium font-mono">{selectedRow.influencerCode || '—'}</div>

                <div className="text-[#94A3B8]">Username:</div>
                <div className="text-[#F1F5F9] font-medium">@{selectedRow.username || '—'}</div>

                <div className="text-[#94A3B8]">Category:</div>
                <div className="text-[#3B82F6] font-mono font-semibold">{getRowCategory(selectedRow) || '—'}</div>
              </div>

              {selectedRow.researchStatus && (
                <div className="bg-[#111827] rounded-lg p-2.5 border border-[#293548] flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8]">Research Status:</span>
                  <span className={`font-semibold capitalize flex items-center gap-1.5 ${
                    selectedRow.researchStatus === 'completed' ? 'text-[#10B981]' :
                    selectedRow.researchStatus === 'partial' || selectedRow.researchStatus === 'reels_not_enough' ? 'text-[#F59E0B]' :
                    selectedRow.researchStatus === 'failed' ? 'text-[#EF4444]' : 'text-[#3B82F6]'
                  }`}>
                    {selectedRow.researchStatus === 'completed' && <CheckCircle2 size={13} />}
                    {selectedRow.researchStatus === 'partial' && <AlertTriangle size={13} />}
                    {selectedRow.researchStatus === 'failed' && <AlertCircle size={13} />}
                    {selectedRow.researchStatus}
                  </span>
                </div>
              )}

              <div className="bg-[#111827] rounded-lg p-3.5 border border-[#293548]">
                <h4 className="text-xs font-semibold text-[#F1F5F9] mb-2">Messages</h4>
                {selectedRow.validationMessages.length > 0 ? (
                  <ul className="space-y-1">
                    {selectedRow.validationMessages.map((msg, i) => (
                      <li key={i} className="text-xs text-[#94A3B8] flex items-start gap-1.5">
                        <span className="text-[#64748B] mt-0.5">•</span>
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#94A3B8]">Profile is fully valid and ready.</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedRow(null)}
              className="w-full px-4 py-2 bg-[#111827] hover:bg-[#1A2332] text-[#F1F5F9] rounded-lg transition-colors border border-[#293548] text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
