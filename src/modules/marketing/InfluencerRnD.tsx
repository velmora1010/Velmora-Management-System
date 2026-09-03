import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserSearch, Globe, Camera, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { rndExtensionService } from './rnd/services/rndExtensionService';
import { ExtensionConnectionState, InstagramSessionState } from './rnd/types/extensionTypes';

interface InfluencerRnDProps {
  onBack: () => void;
}

export const InfluencerRnD: React.FC<InfluencerRnDProps> = ({ onBack }) => {
  const [extState, setExtState] = useState<ExtensionConnectionState>('checking');
  const [igState, setIgState] = useState<InstagramSessionState>('checking');

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      // 1. Check Extension
      const isConnected = await rndExtensionService.ping();
      
      if (!mounted) return;
      
      if (!isConnected) {
        setExtState('not_detected');
        setIgState('unavailable');
        return;
      }

      setExtState('connected');

      // 2. Check Instagram Session if Extension is connected
      const igResult = await rndExtensionService.checkInstagramLogin();
      if (!mounted) return;

      if (igResult.error) {
        setIgState('unavailable');
      } else if (igResult.loggedIn) {
        setIgState('detected');
      } else {
        setIgState('login_required');
      }
    };

    checkStatus();
    // Re-check periodically
    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-6 text-slate-200">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <UserSearch size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Influencer Research & Development</h2>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        {/* Extension Status Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700/50 rounded-lg text-slate-300">
                <Globe size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Chrome Extension</h3>
            </div>
            {extState === 'checking' && (
              <span className="text-sm text-slate-400 animate-pulse">Checking...</span>
            )}
            {extState === 'connected' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={16} /> Connected
              </span>
            )}
            {extState === 'not_detected' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded-full">
                <XCircle size={16} /> Not Detected
              </span>
            )}
            {extState === 'error' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
                <AlertCircle size={16} /> Connection Error
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {extState === 'connected' 
              ? 'Extension is actively communicating with Velmora.' 
              : 'Velmora Influencer R&D extension is not connected. Please ensure the extension is installed and enabled in your browser.'}
          </p>
        </div>

        {/* Instagram Status Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700/50 rounded-lg text-slate-300">
                <Camera size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Instagram</h3>
            </div>
            {igState === 'checking' && (
              <span className="text-sm text-slate-400 animate-pulse">Checking...</span>
            )}
            {igState === 'detected' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={16} /> Session Detected
              </span>
            )}
            {igState === 'login_required' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <AlertCircle size={16} /> Login Required
              </span>
            )}
            {igState === 'unavailable' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded-full">
                <XCircle size={16} /> Not Available
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {igState === 'detected' 
              ? 'An authenticated Instagram session was found. Ready for research.' 
              : igState === 'login_required' 
                ? 'Please open Instagram in a new tab and log in manually.' 
                : 'Waiting for Chrome extension connection...'}
          </p>
        </div>
      </div>
    </div>
  );
};
