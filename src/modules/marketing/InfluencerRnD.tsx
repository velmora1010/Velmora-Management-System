import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserSearch, Globe, Camera, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { rndExtensionService } from './rnd/services/rndExtensionService';
import { ExtensionConnectionState, InstagramSessionState } from './rnd/types/extensionTypes';
import { ResearchJob } from './rnd/types/rndTypes';
import { RnDUploadArea } from './rnd/components/RnDUploadArea';
import { RnDPreviewTable } from './rnd/components/RnDPreviewTable';
import { parseInfluencerExcel } from './rnd/utils/excelParser';

interface InfluencerRnDProps {
  onBack: () => void;
}

export const InfluencerRnD: React.FC<InfluencerRnDProps> = ({ onBack }) => {
  const [extState, setExtState] = useState<ExtensionConnectionState>('CONNECTING');
  const [igState, setIgState] = useState<InstagramSessionState>('CHECKING');
  const [extVersion, setExtVersion] = useState<string | undefined>();
  
  const [currentJob, setCurrentJob] = useState<ResearchJob | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [researchMessage, setResearchMessage] = useState<string | null>(null);

  const checkStatus = async (mounted: { current: boolean }) => {
    // 1. Check Extension
    const status = await rndExtensionService.getExtensionStatus();
    
    if (!mounted.current) return;
    
    if (!status.connected) {
      setExtState('NOT_DETECTED');
      setIgState('NOT_AVAILABLE');
      setExtVersion(undefined);
      return;
    }

    setExtState('CONNECTED');
    setExtVersion(status.version);

    // 2. Check Instagram Session if Extension is connected
    const igResult = await rndExtensionService.checkInstagramSession();
    if (!mounted.current) return;

    if (igResult.error) {
      setIgState('NOT_AVAILABLE');
    } else if (igResult.available) {
      if (igResult.session === 'detected') {
        setIgState('SESSION_DETECTED');
      } else {
        setIgState('LOGIN_REQUIRED');
      }
    } else {
      setIgState('NOT_AVAILABLE');
    }
  };

  useEffect(() => {
    const mounted = { current: true };

    checkStatus(mounted);
    // Re-check periodically
    const interval = setInterval(() => checkStatus(mounted), 5000);

    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, []);

  const handleManualCheck = () => {
    setExtState('CONNECTING');
    setIgState('CHECKING');
    checkStatus({ current: true });
  };

  const handleOpenInstagram = () => {
    window.open('https://www.instagram.com', '_blank');
  };

  const handleFileSelect = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setResearchMessage(null);
    
    try {
      const job = await parseInfluencerExcel(file);
      setCurrentJob(job);
    } catch (err: any) {
      setParseError(err.message || 'An error occurred while parsing the file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleStartResearch = () => {
    setResearchMessage("Research engine is not available yet.");
    setTimeout(() => setResearchMessage(null), 5000);
  };

  const isEngineConnected = extState === 'CONNECTED' && igState === 'SESSION_DETECTED';

  return (
    <div className="p-6 text-slate-200">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
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
        
        <button 
          onClick={handleManualCheck}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition-colors border border-slate-700"
        >
          Check Connection
        </button>
      </div>
      
      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-6xl mx-auto">
        {/* Extension Status Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700/50 rounded-lg text-slate-300">
                  <Globe size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-200">Chrome Extension</h3>
              </div>
              {extState === 'CONNECTING' && (
                <span className="text-sm text-slate-400 animate-pulse">Checking...</span>
              )}
              {extState === 'CONNECTED' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={16} /> Connected
                </span>
              )}
              {extState === 'NOT_DETECTED' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded-full">
                  <XCircle size={16} /> Not Detected
                </span>
              )}
              {extState === 'ERROR' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
                  <AlertCircle size={16} /> Connection Error
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mb-2">
              {extState === 'CONNECTED' 
                ? 'Connected to Velmora R&D browser extension.' 
                : 'Velmora Influencer R&D extension is not connected. Please ensure the extension is installed and enabled in your browser.'}
            </p>
          </div>
          {extVersion && (
            <div className="text-xs text-slate-500 mt-2">
              Version {extVersion}
            </div>
          )}
        </div>

        {/* Instagram Status Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700/50 rounded-lg text-slate-300">
                  <Camera size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-200">Instagram</h3>
              </div>
              {igState === 'CHECKING' && (
                <span className="text-sm text-slate-400 animate-pulse">Waiting...</span>
              )}
              {igState === 'SESSION_DETECTED' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={16} /> Session Detected
                </span>
              )}
              {igState === 'LOGIN_REQUIRED' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                  <AlertCircle size={16} /> Login Required
                </span>
              )}
              {igState === 'NOT_AVAILABLE' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded-full">
                  <XCircle size={16} /> Not Available
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              {igState === 'SESSION_DETECTED' 
                ? 'Your Instagram browser session appears authenticated.' 
                : igState === 'LOGIN_REQUIRED' 
                  ? 'An Instagram tab was found, but login is required.' 
                  : igState === 'NOT_AVAILABLE'
                    ? 'Instagram tab is not open or extension cannot reach it.'
                    : 'Waiting for Chrome extension connection...'}
            </p>
          </div>
          
          {(igState === 'LOGIN_REQUIRED' || igState === 'NOT_AVAILABLE') && extState === 'CONNECTED' && (
            <div className="mt-4">
              <button 
                onClick={handleOpenInstagram}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors border border-slate-600"
              >
                Open Instagram
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-bold text-slate-100 mb-6">New Research Run</h2>
        
        {!currentJob && (
          <div className="bg-[#1e2536] p-8 rounded-xl border border-slate-700 shadow-sm">
            {isParsing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-300 font-medium">Parsing Excel file...</p>
              </div>
            ) : (
              <RnDUploadArea onFileSelect={handleFileSelect} />
            )}
            
            {parseError && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {currentJob && (
          <div className="flex flex-col gap-4">
            {researchMessage && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center justify-center font-medium animate-fade-in">
                {researchMessage}
              </div>
            )}
            <RnDPreviewTable 
              job={currentJob} 
              onReplaceFile={() => setCurrentJob(null)} 
              onStartResearch={handleStartResearch}
              isEngineConnected={isEngineConnected}
            />
          </div>
        )}
      </div>

    </div>
  );
};
