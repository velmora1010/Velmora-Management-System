import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FolderOpen, 
  FileSpreadsheet, 
  ArrowRight,
  ArrowLeft, 
  FileText, 
  Database,
  RefreshCw
} from 'lucide-react';
import type { WebsiteUploadBatch } from './types';
import { websiteSalesService } from './websiteSalesService';
import { WebsiteRawData } from './WebsiteRawData';
import { WebsiteUpdatedData } from './WebsiteUpdatedData';
import toast from 'react-hot-toast';

export const WebsiteFiles: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [batches, setBatches] = useState<WebsiteUploadBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reprocessing, setReprocessing] = useState<boolean>(false);

  const fileIdParam = searchParams.get('fileId');
  const viewParam = searchParams.get('view') || 'raw';

  const [selectedFileId, setSelectedFileId] = useState<string | null>(fileIdParam);
  const [selectedFileView, setSelectedFileView] = useState<'raw' | 'updated'>(
    viewParam === 'updated' ? 'updated' : 'raw'
  );

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    const list = await websiteSalesService.getUploadBatches();
    setBatches(list);
    setLoading(false);
  };

  const handleOpenFile = (id: string) => {
    setSelectedFileId(id);
    setSelectedFileView('raw');
    setSearchParams({ fileId: id, view: 'raw' });
  };

  const handleCloseFile = () => {
    setSelectedFileId(null);
    setSearchParams({});
  };

  const handleViewChange = (view: 'raw' | 'updated') => {
    setSelectedFileView(view);
    if (selectedFileId) {
      setSearchParams({ fileId: selectedFileId, view });
    }
  };

  const handleReprocessFile = async () => {
    if (!selectedFileId) return;
    setReprocessing(true);
    try {
      await websiteSalesService.reprocessUploadBatch(selectedFileId);
      toast.success('File reprocessed successfully! Customer Name and State mappings updated.');
      await loadBatches();
    } catch (err: any) {
      console.error('Reprocess error:', err);
      toast.error('Failed to reprocess file.');
    } finally {
      setReprocessing(false);
    }
  };

  const openedFile = batches.find(b => b.id === selectedFileId);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <FolderOpen className="text-indigo-400" size={24} />
          Website Sales Files
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Select any uploaded website order spreadsheet to view its Raw Data audit rows or Updated Data consolidated orders.
        </p>
      </div>

      {/* CASE 1: NO FILE IS OPENED -> SHOW UPLOADED FILES TABLE WITH ACTIONS COLUMN */}
      {!selectedFileId && (
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading files from Supabase...</div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileSpreadsheet size={36} className="text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No Uploaded Files Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No website order files have been uploaded yet. Use the Upload Orders tab to import files.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800 h-[46px]">
                  <tr>
                    <th className="py-3 px-5">File Name</th>
                    <th className="py-3 px-5">Order Date</th>
                    <th className="py-3 px-5">Upload Date</th>
                    <th className="py-3 px-5">Source Rows</th>
                    <th className="py-3 px-5">Unique Orders</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batches.map(b => (
                    <tr key={b.id} className="h-[54px] hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white flex items-center gap-2.5">
                        <FileSpreadsheet size={16} className="text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[280px]" title={b.file_name}>{b.file_name}</span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-cyan-300 whitespace-nowrap">
                        {b.order_date_range || b.order_date || '-'}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 whitespace-nowrap">
                        {new Date(b.uploaded_at).toLocaleString('en-GB')}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-cyan-300">{b.total_source_rows}</td>
                      <td className="py-3.5 px-5 font-mono font-bold text-emerald-300">{b.total_unique_orders}</td>
                      <td className="py-3.5 px-5">
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenFile(b.id)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        >
                          Open File <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CASE 2: FILE IS OPENED -> SHOW SELECTED FILE HEADER & RAW / UPDATED DATA TABS */}
      {selectedFileId && openedFile && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* SELECTED FILE HEADER */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">{openedFile.file_name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>Order Date: <strong className="text-cyan-300">{openedFile.order_date_range || openedFile.order_date || '-'}</strong></span>
                  <span>•</span>
                  <span>Uploaded: <strong className="text-slate-300">{new Date(openedFile.uploaded_at).toLocaleString('en-GB')}</strong></span>
                  <span>•</span>
                  <span>Source Rows: <strong className="text-cyan-300">{openedFile.total_source_rows}</strong></span>
                  <span>•</span>
                  <span>Unique Orders: <strong className="text-emerald-300">{openedFile.total_unique_orders}</strong></span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {openedFile.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                disabled={reprocessing}
                onClick={handleReprocessFile}
                className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl border border-indigo-500/60 transition-colors cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
                title="Re-read raw rows and rebuild consolidated data with updated mappings"
              >
                <RefreshCw size={14} className={reprocessing ? 'animate-spin' : ''} />
                {reprocessing ? 'Reprocessing...' : 'Reprocess File'}
              </button>

              <button
                onClick={handleCloseFile}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft size={15} /> Back to Files
              </button>
            </div>
          </div>

          {/* TWO TABS: RAW DATA | UPDATED DATA */}
          <div className="flex items-center gap-3 py-1 border-b border-slate-800/80 pb-3">
            <button
              onClick={() => handleViewChange('raw')}
              className={`flex items-center gap-2.5 h-[42px] px-6 rounded-xl text-sm transition-all cursor-pointer shrink-0 ${
                selectedFileView === 'raw'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20 border border-indigo-500'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white font-medium'
              }`}
            >
              <FileText size={17} />
              <span>Raw Data</span>
            </button>

            <button
              onClick={() => handleViewChange('updated')}
              className={`flex items-center gap-2.5 h-[42px] px-6 rounded-xl text-sm transition-all cursor-pointer shrink-0 ${
                selectedFileView === 'updated'
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20 border border-indigo-500'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white font-medium'
              }`}
            >
              <Database size={17} />
              <span>Updated Data</span>
            </button>
          </div>

          {/* TAB CONTENT VIEWS */}
          {selectedFileView === 'raw' && (
            <WebsiteRawData selectedBatchId={selectedFileId} />
          )}

          {selectedFileView === 'updated' && (
            <WebsiteUpdatedData selectedBatchId={selectedFileId} />
          )}
        </div>
      )}
    </div>
  );
};
