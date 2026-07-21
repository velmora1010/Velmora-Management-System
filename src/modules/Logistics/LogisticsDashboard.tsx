import React from 'react';
import db from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, Package, Truck, CheckCircle, Eye, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LogisticsDashboardProps {
  onNavigateTab: (tabId: 'import' | 'data' | 'tracking' | 'trash', fileId?: number | null) => void;
}

export const LogisticsDashboard: React.FC<LogisticsDashboardProps> = ({ onNavigateTab }) => {
  // Query all statistics dynamically in a reactive live query
  const stats = useLiveQuery(async () => {
    const importCount = await db.logistics_imports.count();
    const allOrders = await db.logistics_orders.toArray();

    const totalOrders = allOrders.filter(o => o.stage === 'order_data' || o.stage === 'tracking').length;
    const trackingCount = allOrders.filter(o => o.stage === 'tracking').length;
    const deliveredCount = allOrders.filter(o => o.status === 'Delivered').length;

    const recentImports = await db.logistics_imports.reverse().limit(3).toArray();

    return {
      importCount,
      totalOrders,
      trackingCount,
      deliveredCount,
      recentImports
    };
  }, []);

  const handleDeleteImport = async (id: number, fileName: string) => {
    if (confirm(`Are you sure you want to permanently delete import "${fileName}"?`)) {
      try {
        await db.logistics_imports.delete(id);
        toast.success('Spreadsheet import deleted.');
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleExportImport = (item: any) => {
    try {
      const headers = item.headers;
      const rows = item.rows;
      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(val => {
          const str = String(val === undefined || val === null ? '' : val);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', item.fileName.replace(/\.(xlsx|xls)$/i, '.csv'));
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV file export triggered!');
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5 overflow-y-auto max-h-full pr-1 custom-scrollbar pb-6 animate-in fade-in duration-300">
      
      {/* 4 Analytics KPI Cards */}
      <div className="space-y-3.5">
        <h3 className="text-[22px] font-extrabold text-slate-100 tracking-tight">Dashboard Overview</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Imported Files */}
          <div className="bg-slate-900/60 hover:bg-slate-900/85 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between h-32 shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Imported Files</span>
                <div className="text-[36px] font-black text-white leading-none mt-1">{stats?.importCount || 0}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 group-hover:scale-105 transition-transform shrink-0">
                <FileSpreadsheet size={26} />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 block">Total spreadsheets uploaded</span>
          </div>

          {/* Total Orders */}
          <div className="bg-slate-900/60 hover:bg-slate-900/85 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between h-32 shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Orders</span>
                <div className="text-[36px] font-black text-white leading-none mt-1">{(stats?.totalOrders || 0).toLocaleString()}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/10 group-hover:scale-105 transition-transform shrink-0">
                <Package size={26} />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 block">All active imported orders</span>
          </div>

          {/* In Tracking */}
          <div className="bg-slate-900/60 hover:bg-slate-900/85 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between h-32 shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">In Tracking</span>
                <div className="text-[36px] font-black text-white leading-none mt-1">{(stats?.trackingCount || 0).toLocaleString()}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/10 group-hover:scale-105 transition-transform shrink-0">
                <Truck size={26} />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 block">Active tracking list shipments</span>
          </div>

          {/* Delivered */}
          <div className="bg-slate-900/60 hover:bg-slate-900/85 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between h-32 shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Delivered</span>
                <div className="text-[36px] font-black text-white leading-none mt-1">{(stats?.deliveredCount || 0).toLocaleString()}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/10 group-hover:scale-105 transition-transform shrink-0">
                <CheckCircle size={26} />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 block">Successfully completed delivery</span>
          </div>

        </div>
      </div>

      {/* Recent Imports Section */}
      <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[22px] font-extrabold text-slate-100 tracking-tight">Recent Imports</h3>
        </div>

        <div className="overflow-x-auto custom-scrollbar border border-border/5 rounded-xl min-h-[190px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">File Name</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Rows</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Columns</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Imported On</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Imported By</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {stats?.recentImports && stats.recentImports.length > 0 ? (
                stats.recentImports.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-2.5 text-slate-200 font-semibold max-w-xs truncate" title={item.fileName}>
                      {item.fileName}
                    </td>
                    <td className="px-5 py-2.5 text-center text-slate-300 font-mono font-semibold">
                      {(item.rows.length).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-center text-slate-400 font-mono font-semibold">
                      {item.headers.length}
                    </td>
                    <td className="px-5 py-2.5 text-slate-400 font-medium">
                      {item.uploadedAt}
                    </td>
                    <td className="px-5 py-2.5 text-slate-300 font-semibold">
                      Admin
                    </td>
                    <td className="px-5 py-2.5 text-center animate-in fade-in duration-200 bg-transparent">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onNavigateTab('import', item.id)}
                          className="p-1.5 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                          title="View sheet details"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleExportImport(item)}
                          className="p-1.5 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                          title="Export CSV file"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteImport(item.id!, item.fileName)}
                          className="p-1.5 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                          title="Delete sheet import"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileSpreadsheet size={32} className="opacity-30 text-primary" />
                      <p className="text-xs text-slate-400 font-bold">No imports available yet.</p>
                      <p className="text-[10px] text-slate-500 font-normal">Upload your first order sheet to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {stats?.recentImports && stats.recentImports.length > 0 && (
          <button
            onClick={() => onNavigateTab('import', null)}
            className="w-fit self-center px-4 py-1.5 border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all mt-1 shadow-sm"
          >
            View All Imports
          </button>
        )}
      </div>

    </div>
  );
};
