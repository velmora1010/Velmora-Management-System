import React, { useState, useEffect } from 'react';
import { workflowAutomationService } from '../../services/workflowAutomationService';
import type { AutomationRule, AutomationExecutionLog } from '../../types/automation';
import { AUTOMATION_EVENTS } from '../../types/automation';
import { Zap, CheckCircle2, AlertTriangle, RefreshCw, Activity, ShieldCheck, Play } from 'lucide-react';
import toast from 'react-hot-toast';

export const WorkflowAutomation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationExecutionLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const fetchedRules = await workflowAutomationService.getRules();
      setRules(fetchedRules);

      const execData = await workflowAutomationService.getExecutionLogs(1, 15);
      setLogs(execData.logs);
      setTotalCount(execData.totalCount);
    } catch (err) {
      console.error('Failed to load automation data:', err);
      toast.error('Failed to load workflow automation.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRule = async (ruleId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_enabled: nextStatus } : r));
    const success = await workflowAutomationService.toggleRule(ruleId, nextStatus);
    if (success) {
      toast.success(`Rule ${nextStatus ? 'enabled' : 'disabled'}`);
    } else {
      toast.error('Failed to update rule status');
      loadData();
    }
  };

  const handleSimulateEvent = (eventType: keyof typeof AUTOMATION_EVENTS) => {
    workflowAutomationService.emitEvent(AUTOMATION_EVENTS[eventType], {
      recordId: 'DEMO-999',
      recordName: 'Sample Record Item',
      module: 'system',
      details: { simulation: true }
    });
    toast.success(`Simulated event: ${eventType}`);
    setTimeout(() => loadData(), 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500" size={24} />
            <h2 className="text-xl font-bold text-main">Workflow Automation Engine</h2>
          </div>
          <p className="text-muted text-sm">Automated business event processing, action chains, and execution logging.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'rules' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={16} />
            Automation Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity size={16} />
            Execution Logs ({totalCount})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16 text-muted gap-2">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading automation rules...</span>
        </div>
      ) : activeTab === 'rules' ? (
        /* Automation Rules List */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Configured Event Trigger Rules</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">Simulate Event:</span>
              <button
                onClick={() => handleSimulateEvent('QC_FAILED')}
                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg flex items-center gap-1 font-mono"
              >
                <Play size={10} /> QC_FAILED
              </button>
              <button
                onClick={() => handleSimulateEvent('PO_APPROVED')}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center gap-1 font-mono"
              >
                <Play size={10} /> PO_APPROVED
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-5 bg-card border rounded-xl space-y-3 transition-all ${
                  rule.is_enabled ? 'border-border shadow-sm' : 'border-border/40 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-main text-sm">{rule.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {rule.event_type}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{rule.description}</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={rule.is_enabled}
                    onChange={() => handleToggleRule(rule.id, rule.is_enabled)}
                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer shrink-0 mt-1"
                  />
                </div>

                {/* Actions Chain */}
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Action Chain:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.actions.map((act, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        {idx + 1}. {act.type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Execution Logs Inspector */
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-muted space-y-2">
              <Activity size={32} className="mx-auto opacity-40" />
              <p className="text-sm font-medium">No execution log entries recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-border uppercase tracking-wider text-muted font-semibold">
                    <th className="px-4 py-3.5">Execution Time</th>
                    <th className="px-4 py-3.5">Event Type</th>
                    <th className="px-4 py-3.5">Rule Name</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-400">
                        {log.event_type}
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-main">
                        {log.rule_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.is_success
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {log.is_success ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                          {log.is_success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 font-sans">
                        {log.error_message || log.failed_action ? (
                          <span className="text-rose-400 text-[11px] font-mono">{log.failed_action}: {log.error_message}</span>
                        ) : (
                          <span className="text-slate-500">All actions executed cleanly</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
