import React, { useState, useMemo } from 'react';
import { ResearchJob, ResearchInputProfile, ProfileResearchResult } from '../types/rndTypes';
import { RnDExportButton } from './RnDExportButton';
import { extractDirectCategory } from '../utils/rndExportService';
import { Search, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, RefreshCw, Play, AlertCircle, Activity, Loader2 } from 'lucide-react';

interface RnDPreviewTableProps {
  job: ResearchJob;
  researchResults?: Record<string, ProfileResearchResult>;
  onReplaceFile: () => void;
  onStartResearch: () => void;
  onRunDiagnostic?: () => void;
  isEngineConnected: boolean;
  isDiagnosing?: boolean;
  isBatchRunning?: boolean;
  onSelectProfile?: (profile: ResearchInputProfile) => void;
  selectedProfileCode?: string | null;
}

export const RnDPreviewTable: React.FC<RnDPreviewTableProps> = ({ 
  job,
  researchResults = {},
  onReplaceFile,
  onStartResearch,
  onRunDiagnostic,
  isEngineConnected,
  isDiagnosing,
  isBatchRunning,
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
      {/* Top Bar: File Info & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#171F2B] p-4 rounded-xl border border-[#293548] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded-lg">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="text-[#F1F5F9] font-semibold text-sm sm:text-base">{job.fileName}</h3>
            <p className="text-xs text-[#94A3B8]">Ready to prepare research run</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <RnDExportButton
            job={job}
            researchResults={researchResults}
            isBatchRunning={isBatchRunning}
            size="sm"
          />
          <button
            onClick={onReplaceFile}
            disabled={isBatchRunning}
            className={`px-3.5 py-1.5 rounded-lg transition-colors border flex items-center gap-2 text-xs font-medium ${
              isBatchRunning
                ? 'bg-[#111827] text-[#64748B] border-[#293548] cursor-not-allowed opacity-60'
                : 'bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] border-[#293548]'
            }`}
          >
            <RefreshCw size={14} />
            <span>Replace File</span>
          </button>
        </div>
      </div>

      {/* Validation Summary Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#171F2B] p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Processed</span>
          <span className="text-2xl font-bold text-[#F1F5F9]">{job.totalProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Ready</span>
          <span className="text-2xl font-bold text-[#10B981]">{job.readyProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Warnings</span>
          <span className="text-2xl font-bold text-[#F59E0B]">{job.warningProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Invalid</span>
          <span className="text-2xl font-bold text-[#EF4444]">{job.invalidProfiles}</span>
        </div>
        <div className="bg-[#171F2B] p-4 rounded-xl border border-[#293548] shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Duplicates</span>
          <span className="text-2xl font-bold text-[#94A3B8]">{job.duplicateProfiles}</span>
        </div>
      </div>

      {/* Start Research Action Area */}
      <div className="bg-[#171F2B] p-5 rounded-xl border border-[#293548] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {job.status === 'invalid' ? (
            <>
              <h3 className="text-base font-bold text-[#EF4444]">Unable to prepare research run</h3>
              <p className="text-xs text-[#94A3B8]">There are no valid profiles ready for research. Please fix the errors.</p>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-[#10B981]">Research Run Ready</h3>
              <p className="text-xs text-[#94A3B8]">{job.readyProfiles} profiles ready for research.</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {onRunDiagnostic && (
            <button
              onClick={onRunDiagnostic}
              disabled={isDiagnosing || !isEngineConnected || isBatchRunning}
              className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-2 text-xs transition-colors border ${
                isDiagnosing || !isEngineConnected || isBatchRunning
                  ? 'bg-[#111827] text-[#64748B] border-[#293548] cursor-not-allowed opacity-60'
                  : 'bg-[#171F2B] hover:bg-[#1D2736] text-[#3B82F6] border-[#3B82F6]/30'
              }`}
            >
              <Activity size={15} />
              <span>{isDiagnosing ? 'Diagnosing...' : 'Run Reel Diagnostic'}</span>
            </button>
          )}
          <RnDExportButton
            job={job}
            researchResults={researchResults}
            isBatchRunning={isBatchRunning}
          />
          <button
            onClick={onStartResearch}
            disabled={job.status === 'invalid' || !isEngineConnected || isDiagnosing || isBatchRunning}
            className={`px-5 py-2 rounded-lg font-medium flex items-center gap-2 text-sm transition-colors shadow-sm ${
              job.status === 'invalid' || !isEngineConnected || isDiagnosing || isBatchRunning
                ? 'bg-[#111827] text-[#64748B] border border-[#293548] cursor-not-allowed opacity-60'
                : 'bg-[#3B82F6] hover:bg-blue-600 text-white shadow-blue-500/20'
            }`}
          >
            {isBatchRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Researching...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Start Research</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Profile Queue Table */}
      <div className="bg-[#171F2B] rounded-xl border border-[#293548] shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#293548] flex flex-col sm:flex-row justify-between items-center gap-3">
          <h3 className="text-base font-semibold text-[#F1F5F9]">Profile Queue</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={15} />
            <input
              type="text"
              placeholder="Search profile or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111827] border border-[#293548] rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#141A22] text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-[#293548]">
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Username</th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Row</th>
                <th className="px-5 py-3.5">Validation</th>
                <th className="px-5 py-3.5">Research</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#293548]/50">
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
                      <td className="px-5 py-3 font-medium text-[#F1F5F9] font-mono">{p.influencerCode || '—'}</td>
                      <td className="px-5 py-3 text-[#F1F5F9]">@{p.username || '—'}</td>
                      <td className="px-5 py-3 text-[#94A3B8]">{p.name || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[#3B82F6] font-semibold">{rowCat || '—'}</td>
                      <td className="px-5 py-3 text-[#94A3B8]">{p.rowNumber}</td>
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
                          <span className="text-[#10B981] font-medium flex items-center gap-1"><CheckCircle2 size={13}/> Completed</span>
                        ) : p.researchStatus === 'partial' || p.researchStatus === 'reels_not_enough' ? (
                          <span className="text-[#F59E0B] font-medium flex items-center gap-1"><AlertTriangle size={13}/> Partial</span>
                        ) : p.researchStatus === 'failed' ? (
                          <span className="text-[#EF4444] font-medium flex items-center gap-1"><AlertCircle size={13}/> Failed</span>
                        ) : p.researchStatus === 'running' ? (
                          <span className="text-[#3B82F6] font-medium flex items-center gap-1.5">
                            <Loader2 size={13} className="animate-spin" /> Running...
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[#64748B]">
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
                <div className="text-[#F1F5F9] font-medium">{selectedRow.rowNumber}</div>
                
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
                  <span className={`font-semibold capitalize flex items-center gap-1 ${
                    selectedRow.researchStatus === 'completed' ? 'text-[#10B981]' :
                    selectedRow.researchStatus === 'partial' || selectedRow.researchStatus === 'reels_not_enough' ? 'text-[#F59E0B]' :
                    selectedRow.researchStatus === 'failed' ? 'text-[#EF4444]' : 'text-[#3B82F6]'
                  }`}>
                    {selectedRow.researchStatus === 'completed' && <CheckCircle2 size={12} />}
                    {selectedRow.researchStatus === 'partial' && <AlertTriangle size={12} />}
                    {selectedRow.researchStatus === 'failed' && <AlertCircle size={12} />}
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
              className="w-full px-4 py-2 bg-[#171F2B] hover:bg-[#1D2736] text-[#F1F5F9] rounded-lg transition-colors border border-[#293548] text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
