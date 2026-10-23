import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogisticsDashboard } from './LogisticsDashboard';
import { ImportOrders } from './ImportOrders';
import { OrderData } from './OrderData';
import { TrackingStatus } from './TrackingStatus';
import { LogisticsAnalytics } from './LogisticsAnalytics';
import { CodTrash } from './CodTrash';
import { UnifiedLogisticsWorkspace } from './UnifiedLogisticsWorkspace';
import { Database, FileSpreadsheet, Recycle, Truck, LayoutDashboard, BarChart3, Layers } from 'lucide-react';

export const LogisticsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['workspace', 'dashboard', 'import', 'data', 'tracking', 'analytics', 'trash'];
  const activeTab: 'workspace' | 'dashboard' | 'import' | 'data' | 'tracking' | 'analytics' | 'trash' = 
    (tabParam && validTabs.includes(tabParam))
      ? (tabParam as any)
      : 'workspace';

  const setActiveTab = (tab: 'workspace' | 'dashboard' | 'import' | 'data' | 'tracking' | 'analytics' | 'trash') => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'workspace') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams);
  };

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

  // Run startup migration to clean bad temporary status strings stored in database from old runs
  useEffect(() => {
    const migrateTemporaryStatuses = async () => {
      try {
        const { db } = await import('../../lib/db');
        const orders = await db.logistics_orders.toArray();
        const progressWords = ['checking', 'waiting', 'fetching', 'queued', 'retry', 'parsing'];
        
        await db.transaction('rw', db.logistics_orders, async () => {
          for (const order of orders) {
            const status = (order.status || '').trim();
            const statusLower = status.toLowerCase();
            
            const isProgressWord = progressWords.some(word => statusLower.includes(word));
            
            if (isProgressWord) {
              await db.logistics_orders.update(order.id!, {
                status: 'Pending',
                syncState: 'idle'
              });
            }
          }
        });
        console.log('[LOGISTICS MIGRATION] Cleaned up temporary progress status strings.');
      } catch (err) {
        console.error('[LOGISTICS MIGRATION] Failed to clean temporary status strings:', err);
      }
    };
    migrateTemporaryStatuses();
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
    <div className="flex flex-col gap-3.5 w-full px-4 sm:px-6 lg:px-8 mx-auto h-[calc(100vh-75px)] animate-in fade-in duration-200 overflow-hidden">
      
      {/* Title Header with live DateTime matching Image 1 */}
      <div className="flex justify-between items-center shrink-0 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Logistics</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage and track all your orders and shipments in one place.</p>
        </div>
        
        {/* Right Date Info Pill */}
        <div className="hidden sm:flex items-center gap-2 bg-[#0e1626] border border-slate-800/90 px-3.5 py-1.5 rounded-full text-xs text-slate-300 font-medium shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Main Unified Workspace */}
      <div className="flex-1 min-h-0 bg-transparent flex flex-col overflow-hidden">
        <UnifiedLogisticsWorkspace />
      </div>
    </div>
  );
};
