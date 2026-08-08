import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { WebsiteRawOrderRow, WebsiteUploadBatch } from './types';
import { websiteSalesService } from './websiteSalesService';

interface WebsiteRawDataProps {
  selectedBatchId?: string;
}

export const WebsiteRawData: React.FC<WebsiteRawDataProps> = ({ selectedBatchId }) => {
  const [batch, setBatch] = useState<WebsiteUploadBatch | null>(null);
  const [rawRows, setRawRows] = useState<WebsiteRawOrderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState<WebsiteRawOrderRow | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  useEffect(() => {
    loadData();
  }, [selectedBatchId]);

  // Reset page to 1 when search or batch changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBatchId]);

  const loadData = async () => {
    if (!selectedBatchId) {
      setRawRows([]);
      setBatch(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const bList = await websiteSalesService.getUploadBatches();
    const foundBatch = bList.find(b => b.id === selectedBatchId) || null;
    setBatch(foundBatch);

    const rows = await websiteSalesService.getRawOrderRows(selectedBatchId);
    setRawRows(rows);
    setLoading(false);
  };

  const filteredRows = rawRows.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    const orderIdMatch = r.order_id?.toLowerCase().includes(q);
    const nameMatch = r.customer_name?.toLowerCase().includes(q);
    const prodMatch = r.product_name?.toLowerCase().includes(q);
    return orderIdMatch || nameMatch || prodMatch;
  });

  const totalRowsCount = filteredRows.length;
  const totalPages = Math.ceil(totalRowsCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  if (!selectedBatchId) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <FileText size={40} className="text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-300">No Uploaded File Selected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Please select an uploaded file from the Upload File tab before viewing its raw audit data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER & SOURCE ROWS BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Raw Data Audit</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Source Rows
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Unmodified source spreadsheet rows preserved for verification, troubleshooting, and audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* STATS OVERVIEW FOR SELECTED BATCH */}
      {batch && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Uploaded File</span>
            <span className="text-sm font-bold text-white truncate block">{batch.file_name}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Source Rows</span>
            <span className="text-base font-extrabold text-cyan-300 block">{batch.total_source_rows}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase block">Valid Rows</span>
            <span className="text-base font-extrabold text-emerald-300 block">{batch.valid_rows}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase block">Duplicate Order IDs</span>
            <span className="text-base font-extrabold text-amber-300 block">{batch.duplicate_order_count}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Upload Date</span>
            <span className="text-xs font-semibold text-slate-300 block mt-1">
              {new Date(batch.uploaded_at).toLocaleString('en-GB')}
            </span>
          </div>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Raw Data by Order ID, Customer Name, or Product..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-purple-400"
          />
        </div>
        <span className="text-xs text-slate-400">
          Showing <strong>{startIndex + 1}–{Math.min(startIndex + pageSize, totalRowsCount)}</strong> of <strong>{totalRowsCount.toLocaleString()}</strong> source rows
        </span>
      </div>

      {/* RAW DATA TABLE */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading raw audit rows for selected file...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileSpreadsheet size={36} className="text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No Raw Data Available</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No raw data is available for the selected file or matches your search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Row #</th>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Qty</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Raw JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{r.row_number}</td>
                    <td className="py-3 px-4 font-mono font-bold text-white">{r.order_id || '-'}</td>
                    <td className="py-3 px-4">{r.customer_name || '-'}</td>
                    <td className="py-3 px-4 text-cyan-300 font-medium">{r.product_name || '-'}</td>
                    <td className="py-3 px-4 font-mono font-bold">{r.quantity || '1'}</td>
                    <td className="py-3 px-4 font-mono">{r.price ? `₹${r.price}` : '-'}</td>
                    <td className="py-3 px-4 font-mono">{r.payment_mode || '-'}</td>
                    <td className="py-3 px-4">
                      {r.validation_status === 'VALID' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 size={10} /> VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          <AlertTriangle size={10} /> INVALID
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedRow(r)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAGINATION FOOTER */}
      {filteredRows.length > 0 && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-slate-400 font-medium">
            Showing <span className="font-bold text-white">{startIndex + 1}–{Math.min(startIndex + pageSize, totalRowsCount)}</span> of <span className="font-bold text-white">{totalRowsCount.toLocaleString()}</span> source rows
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 text-slate-300 border border-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 py-1 font-mono font-bold text-slate-300 bg-slate-950 border border-slate-800 rounded-xl">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 text-slate-300 border border-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>

            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs outline-none cursor-pointer"
            >
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={250}>250 per page</option>
              <option value={500}>500 per page</option>
            </select>
          </div>
        </div>
      )}

      {/* RAW JSON ROW INSPECTOR MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-purple-400" />
                  Raw Source Row #{selectedRow.row_number}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Order ID: <strong className="text-white font-mono">{selectedRow.order_id || 'N/A'}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Original Spreadsheet Values</label>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-purple-300 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedRow.raw_data, null, 2)}
                </div>
              </div>

              {selectedRow.validation_errors && selectedRow.validation_errors.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <strong className="block font-bold">Validation Warnings:</strong>
                  {selectedRow.validation_errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 text-right">
              <button
                onClick={() => setSelectedRow(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
