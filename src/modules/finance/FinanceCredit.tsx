import { useState } from 'react';
import { UploadCredit } from './UploadCredit';

export const FinanceCredit = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'view' | 'upload' | 'analytics'>('view');

  return (
    <div className="flex flex-col h-full fade-in text-slate-200">
      {/* Finance Sub Navigation */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Upload Credit
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'view'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          View Credit
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110'
              : 'bg-card border border-border text-main hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Credit Analytics
        </button>
      </div>

      {/* Main Content Area Placeholder */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activeTab === 'upload' && (
          <UploadCredit onClose={() => setActiveTab('view')} />
        )}

        {activeTab === 'view' && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm mt-4 fade-in">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
              💳
            </div>
            <h3 className="text-xl font-semibold text-main mb-2">View Credit</h3>
            <p className="text-muted max-w-md">
              Credit records and transaction filtering will be available here.
            </p>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm mt-4 fade-in">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
              📊
            </div>
            <h3 className="text-xl font-semibold text-main mb-2">Credit Analytics</h3>
            <p className="text-muted max-w-md">
              Credit analytics and reporting features will be available here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
