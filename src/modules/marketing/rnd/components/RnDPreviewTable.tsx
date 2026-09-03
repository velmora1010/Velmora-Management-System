import React, { useState, useMemo } from 'react';
import { ResearchJob, ResearchInputProfile } from '../types/rndTypes';
import { Search, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, RefreshCw, Play } from 'lucide-react';

interface RnDPreviewTableProps {
  job: ResearchJob;
  onReplaceFile: () => void;
  onStartResearch: () => void;
  isEngineConnected: boolean;
}

export const RnDPreviewTable: React.FC<RnDPreviewTableProps> = ({ 
  job, 
  onReplaceFile,
  onStartResearch,
  isEngineConnected
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
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400" />;
      case 'invalid':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in">
      {/* Top Bar: File Info & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#1e2536] p-4 rounded-xl border border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="text-slate-200 font-semibold">{job.fileName}</h3>
            <p className="text-sm text-slate-400">Ready to prepare research run</p>
          </div>
        </div>
        <button 
          onClick={onReplaceFile}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 hover:border-slate-600 flex items-center gap-2 text-sm"
        >
          <RefreshCw size={16} />
          Replace File
        </button>
      </div>

      {/* Validation Summary Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1e2536] p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Processed</span>
          <span className="text-2xl font-bold text-white">{job.totalProfiles}</span>
        </div>
        <div className="bg-[#1e2536] p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ready</span>
          <span className="text-2xl font-bold text-emerald-400">{job.readyProfiles}</span>
        </div>
        <div className="bg-[#1e2536] p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Warnings</span>
          <span className="text-2xl font-bold text-amber-400">{job.warningProfiles}</span>
        </div>
        <div className="bg-[#1e2536] p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Invalid</span>
          <span className="text-2xl font-bold text-red-400">{job.invalidProfiles}</span>
        </div>
        <div className="bg-[#1e2536] p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Duplicates</span>
          <span className="text-2xl font-bold text-slate-300">{job.duplicateProfiles}</span>
        </div>
      </div>

      {/* Start Research Action Area */}
      <div className="bg-[#1e2536] p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {job.status === 'invalid' ? (
            <>
              <h3 className="text-lg font-bold text-red-400">Unable to prepare research run</h3>
              <p className="text-sm text-slate-400">There are no valid profiles ready for research. Please fix the errors.</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-emerald-400">Research Run Ready</h3>
              <p className="text-sm text-slate-400">{job.readyProfiles} profiles ready for research.</p>
            </>
          )}
        </div>
        <button
          onClick={onStartResearch}
          disabled={job.status === 'invalid' || !isEngineConnected}
          className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
            job.status === 'invalid' || !isEngineConnected
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Play size={18} />
          Start Research
        </button>
      </div>

      {/* Profile Queue Table */}
      <div className="bg-[#1e2536] rounded-xl border border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-semibold text-slate-200">Profile Queue</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search profile or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Row</th>
                <th className="px-6 py-4">Validation</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((p, i) => (
                  <tr 
                    key={`${p.influencerCode}-${i}`} 
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedRow(p)}
                  >
                    <td className="px-6 py-3">{renderStatusIcon(p.validationStatus)}</td>
                    <td className="px-6 py-3 font-medium text-slate-200">{p.influencerCode || '—'}</td>
                    <td className="px-6 py-3 text-slate-300">{p.username || '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{p.name || '—'}</td>
                    <td className="px-6 py-3 text-slate-500">{p.rowNumber}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        p.validationStatus === 'ready' ? 'bg-emerald-500/10 text-emerald-400' :
                        p.validationStatus === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {p.validationStatus === 'ready' ? 'Ready' : p.validationStatus === 'warning' ? 'Warning' : 'Invalid'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2536] border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              {renderStatusIcon(selectedRow.validationStatus)}
              Validation Details
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-400">Row Number:</div>
                <div className="text-slate-200 font-medium">{selectedRow.rowNumber}</div>
                
                <div className="text-slate-400">Code:</div>
                <div className="text-slate-200 font-medium">{selectedRow.influencerCode || '—'}</div>
                
                <div className="text-slate-400">Username:</div>
                <div className="text-slate-200 font-medium">{selectedRow.username || '—'}</div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Messages</h4>
                {selectedRow.validationMessages.length > 0 ? (
                  <ul className="space-y-1">
                    {selectedRow.validationMessages.map((msg, i) => (
                      <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-slate-500 mt-0.5">•</span>
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Profile is fully valid and ready.</p>
                )}
              </div>
            </div>

            <button 
              onClick={() => setSelectedRow(null)}
              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
