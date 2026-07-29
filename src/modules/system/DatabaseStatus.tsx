import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';

export const DatabaseStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastSuccess, setLastSuccess] = useState<string>('Never');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  const checkConnection = async () => {
    setIsTesting(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1);

      if (error) {
        setIsConnected(false);
        setErrorMsg(error.message);
      } else {
        setIsConnected(true);
        setErrorMsg('');
        setLastSuccess(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      setIsConnected(false);
      setErrorMsg(err.message || String(err));
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <Card className="p-6 mt-8 border border-blue-500/30 bg-blue-500/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Database Status</h2>
          <p className="text-muted text-sm">Monitor live Supabase database connectivity and credentials status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-black/20 p-4 rounded-xl border border-border">
          <div className="text-xs text-muted uppercase font-bold mb-2">Connection Status</div>
          <div className="flex items-center gap-2">
            {isConnected === null ? (
              <span className="flex items-center gap-1.5 text-sm text-slate-400 font-medium">
                <RefreshCw className="animate-spin" size={16} /> Checking...
              </span>
            ) : isConnected ? (
              <span className="flex items-center gap-1.5 text-sm text-green-400 font-bold">
                <CheckCircle size={16} /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-red-400 font-bold">
                <XCircle size={16} /> Disconnected
              </span>
            )}
          </div>
        </div>

        <div className="bg-black/20 p-4 rounded-xl border border-border">
          <div className="text-xs text-muted uppercase font-bold mb-2">Last Successful Request</div>
          <div className="text-sm font-semibold text-white">{lastSuccess}</div>
        </div>

        <div className="bg-black/20 p-4 rounded-xl border border-border">
          <div className="text-xs text-muted uppercase font-bold mb-2">Current Environment</div>
          <div className="text-sm font-semibold text-white capitalize">{import.meta.env.MODE}</div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-mono break-all">
          <strong>Connection Error:</strong> {errorMsg}
        </div>
      )}

      <button
        onClick={checkConnection}
        disabled={isTesting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
      >
        {isTesting ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
        {isTesting ? 'Testing Connection...' : 'Retry Connection'}
      </button>
    </Card>
  );
};
