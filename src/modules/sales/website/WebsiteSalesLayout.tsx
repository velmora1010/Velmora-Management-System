import React from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  UploadCloud, 
  FolderOpen,
  BarChart3 
} from 'lucide-react';
import { WebsiteDashboard } from './WebsiteDashboard';
import { WebsiteUpload } from './WebsiteUpload';
import { WebsiteFiles } from './WebsiteFiles';
import { WebsiteAnalytics } from './WebsiteAnalytics';
import { WebsiteSalesDateRangeProvider } from './context/WebsiteSalesDateRangeContext';

export const WebsiteSalesLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', path: '/sales/website/dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Orders', path: '/sales/website/upload', icon: UploadCloud },
    { id: 'files', label: 'Files', path: '/sales/website/files', icon: FolderOpen },
    { id: 'analytics', label: 'Analytics', path: '/sales/website/analytics', icon: BarChart3 }
  ];

  // Active tab matching
  const currentPath = location.pathname;
  const activeTabId = tabs.find(t => 
    currentPath.startsWith(t.path) || (t.id === 'dashboard' && currentPath === '/sales/website')
  )?.id || 'dashboard';

  return (
    <WebsiteSalesDateRangeProvider>
      <div className="w-full max-w-[1650px] mx-auto space-y-5 p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 pb-16">
        {/* COMPACT SINGLE-ROW MODULE HEADER */}
        <div className="flex items-center justify-between gap-4 py-1 pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/sales')}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-all cursor-pointer flex items-center justify-center"
              title="Back to Sales"
              aria-label="Back to Sales"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white tracking-tight">Website Sales</h1>
              <span className="text-sm text-slate-400 font-medium border-l border-slate-700/80 pl-3">
                Direct Channel
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/sales')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-slate-700/80 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={15} /> Back to Sales
          </button>
        </div>

        {/* TOP NAVIGATION TABS (DASHBOARD | UPLOAD ORDERS | FILES | ANALYTICS) */}
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`flex items-center gap-2.5 h-[42px] px-5 sm:px-6 rounded-xl text-sm transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20 border border-indigo-500'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium'
                }`}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT ROUTER */}
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<WebsiteDashboard />} />
          <Route path="upload" element={<WebsiteUpload />} />
          <Route path="files" element={<WebsiteFiles />} />
          <Route path="raw-data" element={<Navigate to="/sales/website/files?view=raw" replace />} />
          <Route path="updated-data" element={<Navigate to="/sales/website/files?view=updated" replace />} />
          <Route path="analytics" element={<WebsiteAnalytics />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </div>
    </WebsiteSalesDateRangeProvider>
  );
};
