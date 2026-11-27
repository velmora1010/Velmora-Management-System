import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  UploadCloud, 
  BarChart3,
  ShoppingBag,
  RotateCcw,
  History as HistoryIcon,
  Bot,
  Truck,
  X
} from 'lucide-react';
import { WebsiteDashboard } from './WebsiteDashboard';
import { WebsiteOrders } from './WebsiteOrders';
import { WebsiteUpload } from './WebsiteUpload';
import { WebsiteFiles } from './WebsiteFiles';
import { WebsiteAnalytics } from './WebsiteAnalytics';
import { SalesHistoryView } from './components/SalesHistoryView';
import { RtoReturnsHistoryView } from './components/RtoReturnsHistoryView';
import { WebsiteSalesDateRangeProvider } from './context/WebsiteSalesDateRangeContext';
import { WebsiteOrderFilesModal } from './components/WebsiteOrderFilesModal';
import { WebsiteUploadChoiceModal } from './components/WebsiteUploadChoiceModal';
import { DelhiveryUploadModal } from './components/DelhiveryUploadModal';
import { DedicatedCourierUploadModal } from './components/DedicatedCourierUploadModal';
import { stCourierBotQueue, StCourierBotJobState } from './services/stCourierBotService';

export const WebsiteSalesLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDelhiveryModalOpen, setIsDelhiveryModalOpen] = useState(false);
  const [isAmazonModalOpen, setIsAmazonModalOpen] = useState(false);
  const [isSTCourierModalOpen, setIsSTCourierModalOpen] = useState(false);
  const [isIndiaPostModalOpen, setIsIndiaPostModalOpen] = useState(false);
  const [isSTBotOpen, setIsSTBotOpen] = useState(false);
  const [botJobState, setBotJobState] = useState<StCourierBotJobState | null>(null);
  const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);

  // Subscribe to background ST Courier auto-tracking queue
  useEffect(() => {
    return stCourierBotQueue.subscribe(state => {
      setBotJobState(state);
    });
  }, []);

  // Required 3-tab navigation: Dashboard, Orders, Analytics
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', path: '/sales/website/dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', path: '/sales/website/orders', icon: ShoppingBag },
    { id: 'analytics', label: 'Analytics', path: '/sales/website/analytics', icon: BarChart3 },
    { id: 'history', label: 'History', path: '/sales/website/history', icon: HistoryIcon }
  ];

  // Global listener to open upload selector modal or BOT from dashboard or anywhere in website sales
  useEffect(() => {
    const handleOpenModal = () => setIsChoiceModalOpen(true);
    const handleOpenBot = () => setIsSTBotOpen(true);
    window.addEventListener('velmora:open_website_upload_modal', handleOpenModal);
    window.addEventListener('velmora:open_st_courier_bot', handleOpenBot);
    return () => {
      window.removeEventListener('velmora:open_website_upload_modal', handleOpenModal);
      window.removeEventListener('velmora:open_st_courier_bot', handleOpenBot);
    };
  }, []);

  // Active tab matching
  const currentPath = location.pathname;
  const activeTabId = tabs.find(t => 
    currentPath.startsWith(t.path) || (t.id === 'dashboard' && currentPath === '/sales/website')
  )?.id || 'dashboard';

  return (
    <WebsiteSalesDateRangeProvider>
      <div className="w-full max-w-[1650px] mx-auto space-y-5 p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 pb-16">
        {/* COMPACT SINGLE-ROW MODULE HEADER: Website Sales on left, Back to Sales on right */}
        <div className="flex items-center justify-between gap-4 py-1 pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/sales')}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-all cursor-pointer flex items-center justify-center shrink-0"
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

        {/* NAVIGATION ROW (LEFT: TABS | RIGHT: UPLOAD BUTTON) */}
        <div className="flex items-center justify-between gap-3 py-1">
          {/* Left: Dashboard, Orders, and Analytics navigation tabs */}
          <div className="flex items-center gap-3 overflow-x-auto">
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

          {/* Right: Purple Upload button aligned horizontally with tabs */}
          <div className="ml-auto flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsChoiceModalOpen(true)}
              className="h-[42px] px-4 sm:px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-600/30 border border-purple-400/30 transition-all flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
              title="Upload Website Order Files"
            >
              <UploadCloud size={17} className="text-purple-100" />
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* TAB CONTENT ROUTER */}
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<WebsiteDashboard />} />
          <Route path="orders" element={<WebsiteOrders />} />
          <Route path="upload" element={<WebsiteUpload />} />
          <Route path="files" element={<WebsiteFiles />} />
          <Route path="raw-data" element={<Navigate to="/sales/website/files?view=raw" replace />} />
          <Route path="updated-data" element={<Navigate to="/sales/website/files?view=updated" replace />} />
          <Route path="analytics" element={<WebsiteAnalytics />} />
          <Route path="history" element={<SalesHistoryView />} />
          <Route path="rto-returns" element={<Navigate to="/sales/website/history" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>

        {/* UPLOAD FORMAT SELECTION MODAL */}
        <WebsiteUploadChoiceModal
          isOpen={isChoiceModalOpen}
          onClose={() => setIsChoiceModalOpen(false)}
          onChooseShopify={() => setIsUploadModalOpen(true)}
          onChooseDelhivery={() => setIsDelhiveryModalOpen(true)}
          onChooseAmazonShipping={() => setIsAmazonModalOpen(true)}
          onChooseSTCourier={() => setIsSTCourierModalOpen(true)}
          onChooseIndiaPost={() => setIsIndiaPostModalOpen(true)}
        />

        {/* DELHIVERY ONE DEDICATED UPLOAD MODAL */}
        <DelhiveryUploadModal
          isOpen={isDelhiveryModalOpen}
          onClose={() => setIsDelhiveryModalOpen(false)}
          onBackToSourceSelect={() => {
            setIsDelhiveryModalOpen(false);
            setIsChoiceModalOpen(true);
          }}
          onImportSuccess={() => {
            window.dispatchEvent(new CustomEvent('velmora:website_sales_updated'));
            window.dispatchEvent(new CustomEvent('velmora:logistics_updated'));
          }}
        />

        {/* AMAZON SHIPPING DEDICATED UPLOAD MODAL */}
        <DedicatedCourierUploadModal
          isOpen={isAmazonModalOpen}
          courierType="amazon_shipping"
          onClose={() => setIsAmazonModalOpen(false)}
          onBackToSourceSelect={() => {
            setIsAmazonModalOpen(false);
            setIsChoiceModalOpen(true);
          }}
          onImportSuccess={() => {
            window.dispatchEvent(new CustomEvent('velmora:website_sales_updated'));
            window.dispatchEvent(new CustomEvent('velmora:logistics_updated'));
          }}
        />

        {/* ST COURIER DEDICATED UPLOAD MODAL */}
        <DedicatedCourierUploadModal
          isOpen={isSTCourierModalOpen}
          courierType="st_courier"
          onClose={() => setIsSTCourierModalOpen(false)}
          onBackToSourceSelect={() => {
            setIsSTCourierModalOpen(false);
            setIsChoiceModalOpen(true);
          }}
          onImportSuccess={() => {
            window.dispatchEvent(new CustomEvent('velmora:website_sales_updated'));
            window.dispatchEvent(new CustomEvent('velmora:logistics_updated'));
          }}
        />

        {/* INDIA POST DEDICATED UPLOAD MODAL */}
        <DedicatedCourierUploadModal
          isOpen={isIndiaPostModalOpen}
          courierType="india_post"
          onClose={() => setIsIndiaPostModalOpen(false)}
          onBackToSourceSelect={() => {
            setIsIndiaPostModalOpen(false);
            setIsChoiceModalOpen(true);
          }}
          onImportSuccess={() => {
            window.dispatchEvent(new CustomEvent('velmora:website_sales_updated'));
            window.dispatchEvent(new CustomEvent('velmora:logistics_updated'));
          }}
        />

        {/* SHOPIFY ORDER FILES MODAL */}
        <WebsiteOrderFilesModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onBackToSourceSelect={() => {
            setIsUploadModalOpen(false);
            setIsChoiceModalOpen(true);
          }}
          onUploadSuccess={(orderDate) => {
            window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', { detail: { orderDate } }));
            if (activeTabId === 'orders') {
              // Stay on orders tab with refreshed data
            } else {
              navigate(`/sales/website/dashboard?date=${orderDate}`);
            }
          }}
        />

        {/* NON-BLOCKING FLOATING ST COURIER AUTO-TRACKING BANNER */}
        {botJobState &&
          botJobState.totalToTrack > 0 &&
          botJobState.status !== 'CANCELLED' &&
          botJobState.jobId !== dismissedJobId && (
            <div className="fixed bottom-6 right-6 z-40 max-w-sm sm:max-w-md w-full bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl backdrop-blur-md p-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Truck size={18} className={botJobState.status === 'RUNNING' ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">ST Courier Auto-Tracking</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        botJobState.status === 'RUNNING'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {botJobState.status === 'RUNNING' ? 'Live Tracking' : 'Sync Complete'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {botJobState.status === 'RUNNING'
                        ? `Checking ${botJobState.processedCount} of ${botJobState.totalToTrack} shipments...`
                        : `${botJobState.processedCount} shipments tracked & saved (${botJobState.deliveredCount || botJobState.newDeliveredCount || 0} delivered, ${botJobState.rtoCount || botJobState.newRtoCount || 0} RTO)`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDismissedJobId(botJobState.jobId)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Dismiss banner"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="mt-3 space-y-1.5">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((botJobState.processedCount / botJobState.totalToTrack) * 100))}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {Math.round((botJobState.processedCount / botJobState.totalToTrack) * 100)}% complete
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedJobId(botJobState.jobId)}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </WebsiteSalesDateRangeProvider>
  );
};
