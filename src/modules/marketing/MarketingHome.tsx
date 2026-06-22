import React, { useState } from 'react';
import { Megaphone, Database, Video } from 'lucide-react';
import { InfluencerDashboard } from './InfluencerDashboard';
import { InfluenceDatabase } from './InfluenceDatabase';

type MarketingView = 'home' | 'influencer-dashboard' | 'own-content' | 'influence-db';

export const MarketingHome: React.FC = () => {
  const [currentView, setCurrentView] = useState<MarketingView>('home');

  const renderView = () => {
    switch (currentView) {
      case 'influencer-dashboard':
        return <InfluencerDashboard onBack={() => setCurrentView('home')} />;
      case 'own-content':
        return (
          <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
            <Video size={48} className="mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2 text-slate-200">Own Content</h3>
            <p>Content management system coming soon.</p>
            <button 
              onClick={() => setCurrentView('home')}
              className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Back to Marketing
            </button>
          </div>
        );
      case 'influence-db':
        return <InfluenceDatabase onBack={() => setCurrentView('home')} />;
      case 'home':
      default:
        return (
          <div className="animate-fade-in p-6">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Megaphone size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-100">Marketing</h1>
                  <p className="text-slate-400">Manage influencer campaigns and content</p>
                </div>
              </div>
              <button 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                onClick={() => {}}
              >
                Task
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Option Cards matching the old UI module-cards-grid */}
              
              <button
                onClick={() => setCurrentView('influencer-dashboard')}
                className="flex flex-col items-center justify-center p-8 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Megaphone size={32} />
                </div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">Justmixx Influencers</h3>
                <p className="text-slate-400 text-center text-sm">Manage influencer marketing campaigns</p>
              </button>

              <button
                onClick={() => setCurrentView('own-content')}
                className="flex flex-col items-center justify-center p-8 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Video size={32} />
                </div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">Own Content</h3>
                <p className="text-slate-400 text-center text-sm">Manage internal content creation</p>
              </button>

              <button
                onClick={() => setCurrentView('influence-db')}
                className="flex flex-col items-center justify-center p-8 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Database size={32} />
                </div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">Influence Data Base</h3>
                <p className="text-slate-400 text-center text-sm">Database of all registered influencers</p>
              </button>

            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full text-slate-200">
      {renderView()}
    </div>
  );
};
