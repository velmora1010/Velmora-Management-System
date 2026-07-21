import React, { useState, useEffect } from 'react';
import { integrationService } from '../../services/integrationService';
import type { IntegrationRecord, IntegrationKey } from '../../types/integration';
import { 
  Plug, CheckCircle2, AlertTriangle, RefreshCw, Settings, 
  ShoppingBag, Share2, BarChart, Globe, MessageSquare, Mail, Truck, CreditCard, Bot, X, Check 
} from 'lucide-react';
import toast from 'react-hot-toast';

export const IntegrationHub: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  // Configuration Modal State
  const [selectedConnector, setSelectedConnector] = useState<IntegrationRecord | null>(null);
  const [modalConfig, setModalConfig] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadIntegrations = async () => {
    setIsLoading(true);
    try {
      const data = await integrationService.getIntegrations();
      setIntegrations(data);
    } catch (e) {
      console.error('Error loading integrations:', e);
      toast.error('Failed to load integration hub.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleToggle = async (key: IntegrationKey, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setIntegrations(prev => prev.map(i => i.key === key ? { ...i, is_enabled: nextStatus } : i));
    const success = await integrationService.toggleIntegration(key, nextStatus);
    if (success) {
      toast.success(`Connector ${nextStatus ? 'enabled' : 'disabled'}`);
    } else {
      toast.error('Failed to toggle connector');
      loadIntegrations();
    }
  };

  const handleTestConnection = async (key: IntegrationKey) => {
    setTestingKey(key);
    try {
      const result = await integrationService.testConnection(key);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      await loadIntegrations();
    } catch (e) {
      toast.error('Diagnostic test failed');
    } finally {
      setTestingKey(null);
    }
  };

  const handleOpenConfig = (connector: IntegrationRecord) => {
    setSelectedConnector(connector);
    setModalConfig({ ...connector.config_data });
  };

  const handleSaveConfig = async () => {
    if (!selectedConnector) return;
    setIsSaving(true);
    try {
      const res = await integrationService.saveIntegration(
        selectedConnector.key,
        selectedConnector.is_enabled,
        modalConfig
      );

      if (res.success) {
        toast.success(`${selectedConnector.name} settings saved!`);
        setSelectedConnector(null);
        await loadIntegrations();
      } else {
        toast.error(res.error || 'Failed to save configuration');
      }
    } catch (e) {
      toast.error('Error saving integration configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const getConnectorIcon = (key: IntegrationKey) => {
    switch (key) {
      case 'shopify': return <ShoppingBag className="text-emerald-400" size={22} />;
      case 'meta': return <Share2 className="text-blue-400" size={22} />;
      case 'google_analytics': return <BarChart className="text-amber-400" size={22} />;
      case 'google_ads': return <Globe className="text-blue-500" size={22} />;
      case 'whatsapp': return <MessageSquare className="text-emerald-500" size={22} />;
      case 'email_smtp': return <Mail className="text-purple-400" size={22} />;
      case 'courier_api': return <Truck className="text-indigo-400" size={22} />;
      case 'razorpay': return <CreditCard className="text-cyan-400" size={22} />;
      case 'openai': return <Bot className="text-purple-500" size={22} />;
      default: return <Plug className="text-slate-400" size={22} />;
    }
  };

  const getStatusBadge = (status: IntegrationRecord['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={10} /> Connected
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle size={10} /> Connection Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Not Connected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Plug className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold text-main">Third-Party Integration Hub</h2>
          </div>
          <p className="text-muted text-sm">Centralized connector status management, credentials, and API sync diagnostic tools.</p>
        </div>

        <button
          onClick={loadIntegrations}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh Status
        </button>
      </div>

      {/* Connectors Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16 text-muted gap-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading third-party connectors...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {integrations.map((connector) => (
            <div
              key={connector.key}
              className={`p-5 bg-card border rounded-xl space-y-4 transition-all shadow-sm ${
                connector.is_enabled ? 'border-border' : 'border-border/40 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    {getConnectorIcon(connector.key)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-main leading-tight">{connector.name}</h3>
                    <div className="mt-1">{getStatusBadge(connector.status)}</div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={connector.is_enabled}
                  onChange={() => handleToggle(connector.key, connector.is_enabled)}
                  className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer shrink-0 mt-1"
                />
              </div>

              {/* Sync Timestamp */}
              <div className="text-[11px] text-muted font-mono flex items-center justify-between pt-1 border-t border-border/40">
                <span>Last Sync:</span>
                <span>{connector.last_sync ? new Date(connector.last_sync).toLocaleString() : 'Never'}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleTestConnection(connector.key)}
                  disabled={testingKey === connector.key}
                  className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={testingKey === connector.key ? 'animate-spin' : ''} />
                  Test Connection
                </button>

                <button
                  onClick={() => handleOpenConfig(connector)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <Settings size={12} /> Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Modal */}
      {selectedConnector && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                {getConnectorIcon(selectedConnector.key)}
                <h3 className="font-bold text-main text-sm">Configure {selectedConnector.name}</h3>
              </div>
              <button
                onClick={() => setSelectedConnector(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <p className="font-sans text-muted text-xs">Manage API credentials and integration endpoints securely.</p>

              {Object.keys(modalConfig).map((fieldKey) => (
                <div key={fieldKey} className="space-y-1">
                  <label className="block text-slate-300 font-sans font-semibold capitalize">
                    {fieldKey.replace(/_/g, ' ')}
                  </label>
                  <input
                    type={fieldKey.includes('secret') || fieldKey.includes('token') || fieldKey.includes('key') ? 'password' : 'text'}
                    value={modalConfig[fieldKey] || ''}
                    onChange={(e) => setModalConfig({ ...modalConfig, [fieldKey]: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-main focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-3 bg-slate-900/40 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setSelectedConnector(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Check size={14} /> Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
