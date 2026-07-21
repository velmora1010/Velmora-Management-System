import React, { useState, useEffect } from 'react';
import { LogisticsDashboard } from './LogisticsDashboard';
import { ImportOrders } from './ImportOrders';
import { OrderData } from './OrderData';
import { TrackingStatus } from './TrackingStatus';
import { LogisticsAnalytics } from './LogisticsAnalytics';
import { CodTrash } from './CodTrash';
import { Database, FileSpreadsheet, Recycle, Truck, LayoutDashboard, BarChart3 } from 'lucide-react';

export const LogisticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'data' | 'tracking' | 'analytics' | 'trash'>('dashboard');
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  // Handle live date-time formatted like "22 Jun 2025 • 10:45 AM"
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      const formatted = now.toLocaleString('en-US', options);
      // Clean formatting: e.g. "30 Jun 2026, 03:45 PM" -> "30 Jun 2026 • 03:45 PM"
      const cleaned = formatted
        .replace(/,/g, '')
        .replace(/(\d{4})\s/, '$1 • ');
      
      setCurrentTime(cleaned);
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleNavigateTab = (tabId: 'import' | 'data' | 'tracking' | 'trash', fileId?: number | null) => {
    if (fileId !== undefined) {
      setSelectedFileId(fileId);
    } else {
      setSelectedFileId(null);
    }
    setActiveTab(tabId);
  };



  return (
    <div className="flex flex-col gap-6 w-full px-6 lg:px-8 mx-auto h-[calc(100vh-80px)] lg:h-[calc(100vh-120px)] animate-in fade-in duration-300 overflow-hidden">
      
      {/* Title Header with live DateTime */}
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h1 className="text-[42px] font-black text-white tracking-tight leading-tight">Logistics</h1>
          <p className="text-muted text-xs mt-1">Manage and track all your orders and shipments in one place.</p>
        </div>
        
        {/* Right Date Info */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-400 font-semibold shadow-inner">
          <span className="w-2 h-2 rounded-full bg-primary/80 animate-pulse"></span>
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Redesigned Tab Navigation Pill Container */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-1.5 rounded-2xl shrink-0 flex items-center overflow-x-auto custom-scrollbar shadow-lg">
        <div className="flex items-center gap-1.5">
          {/* Dashboard (Group 1) */}
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedFileId(null);
            }}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          {/* Divider */}
          <div className="w-[1px] h-5 bg-slate-800 shrink-0 mx-1"></div>

          {/* Group 2: Operations */}
          <button
            onClick={() => {
              setActiveTab('import');
            }}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === 'import'
                ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <FileSpreadsheet size={16} />
            <span>Import Orders</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('data');
              setSelectedFileId(null);
            }}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === 'data'
                ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Database size={16} />
            <span>Order Data</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('tracking');
              setSelectedFileId(null);
            }}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === 'tracking'
                ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Truck size={16} />
            <span>Tracking Status</span>
          </button>

          {/* Divider */}
          <div className="w-[1px] h-5 bg-slate-800 shrink-0 mx-1"></div>

          {/* Group 3: Reporting & Maintenance */}
          <button
            onClick={() => {
              setActiveTab('analytics');
              setSelectedFileId(null);
            }}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <BarChart3 size={16} />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('trash');
              setSelectedFileId(null);
            }}
            className={`flex items-center gap-2 py-2 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 whitespace-nowrap ${
              activeTab === 'trash'
                ? 'text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Recycle size={16} />
            <span>COD Restore</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-transparent flex flex-col overflow-hidden">
        {activeTab === 'dashboard' && <LogisticsDashboard onNavigateTab={handleNavigateTab} />}
        {activeTab === 'import' && <ImportOrders initialFileId={selectedFileId} />}
        {activeTab === 'data' && <OrderData />}
        {activeTab === 'tracking' && <TrackingStatus />}
        {activeTab === 'analytics' && <LogisticsAnalytics />}
        {activeTab === 'trash' && <CodTrash />}
      </div>
    </div>
  );
};
