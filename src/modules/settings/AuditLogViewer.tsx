import React, { useState, useEffect, useCallback } from 'react';
import { auditService } from '../../services/auditService';
import type { AuditLogRecord, AuditFilters, AuditAction } from '../../types/audit';
import { ALL_MODULES } from '../../config/rbacDefaults';
import { AUDIT_ACTIONS } from '../../types/audit';
import { Search, Calendar, ChevronLeft, ChevronRight, Eye, Shield, RefreshCw, X, Database } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log for Diff Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: AuditFilters = {
        search: search.trim() || undefined,
        module: selectedModule || undefined,
        action: selectedAction || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const result = await auditService.getAuditLogs(filters, page, pageSize);
      setLogs(result.data);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedModule, selectedAction, startDate, endDate, page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedModule('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeColor = (action: AuditAction) => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'UPDATE': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DELETE':
      case 'ARCHIVE': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'APPROVE': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'REJECT': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'LOGIN':
      case 'LOGOUT': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="text-purple-500" size={24} />
            <h2 className="text-xl font-bold text-main">System Audit Trail</h2>
          </div>
          <p className="text-muted text-sm">Immutable records of all business data mutations, user actions, and system events.</p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh Logs
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Text Search */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              placeholder="Search user, email, or record..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-main focus:outline-none focus:border-purple-500"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          </div>

          {/* Module Filter */}
          <select
            value={selectedModule}
            onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 text-main rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500 capitalize"
          >
            <option value="">All Modules</option>
            {ALL_MODULES.map(m => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 text-main rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="">All Actions</option>
            {Object.values(AUDIT_ACTIONS).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700 transition-colors"
          >
            Reset Filters
          </button>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Calendar size={14} /> Date Range:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Audit Logs Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center items-center py-16 text-muted gap-2">
            <RefreshCw className="animate-spin" size={20} />
            <span>Loading audit log entries...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted space-y-2">
            <Shield size={32} className="mx-auto opacity-40" />
            <p className="text-sm font-medium">No audit logs matching filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border uppercase tracking-wider text-muted font-semibold">
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Module</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Record ID / Type</th>
                  <th className="px-4 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors font-mono">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-sans font-semibold text-main">
                        {log.metadata?.user_name || log.metadata?.user_email || 'System'}
                      </div>
                      {log.metadata?.user_role && (
                        <span className="text-[10px] text-indigo-400 font-sans font-medium">{log.metadata.user_role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize font-sans text-slate-300">
                      {String(log.module).replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-[150px]">
                      {log.record_id || log.record_type || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs transition-colors border border-slate-700"
                      >
                        <Eye size={12} /> View Diff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-900/40 border-t border-border text-xs text-muted">
          <div>
            Showing <span className="font-semibold text-main">{logs.length}</span> of <span className="font-semibold text-main">{totalCount}</span> log entries
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-slate-900 border border-slate-700 text-main rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={15}>15 per page</option>
              <option value={30}>30 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-slate-900/60">
              <div className="space-y-0.5">
                <h3 className="font-bold text-main flex items-center gap-2">
                  <span>Audit Entry #{selectedLog.id.slice(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </h3>
                <p className="text-xs text-muted font-mono">{new Date(selectedLog.timestamp).toLocaleString()} • Module: {selectedLog.module}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
              
              {/* Metadata Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800 text-slate-300">
                <div><span className="text-slate-500 block">User:</span> {selectedLog.metadata?.user_name || 'System'}</div>
                <div><span className="text-slate-500 block">Email:</span> {selectedLog.metadata?.user_email || '-'}</div>
                <div><span className="text-slate-500 block">Role:</span> {selectedLog.metadata?.user_role || '-'}</div>
                <div><span className="text-slate-500 block">Record Type:</span> {selectedLog.record_type || '-'}</div>
                <div className="col-span-2 truncate"><span className="text-slate-500 block">Record ID:</span> {selectedLog.record_id || '-'}</div>
              </div>

              {/* Side-by-Side Data Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Previous Data */}
                <div className="space-y-1.5">
                  <span className="font-sans font-semibold text-amber-400 flex items-center gap-1">
                    Previous State Data
                  </span>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
                    {selectedLog.previous_data ? JSON.stringify(selectedLog.previous_data, null, 2) : 'null (No previous state)'}
                  </pre>
                </div>

                {/* New Data */}
                <div className="space-y-1.5">
                  <span className="font-sans font-semibold text-emerald-400 flex items-center gap-1">
                    New State Data
                  </span>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
                    {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : 'null (No new payload)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-900/40 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
