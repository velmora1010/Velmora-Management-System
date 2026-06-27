import React, { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2, FileJson } from 'lucide-react';
import db from '../../lib/db';
import { Card } from '../../components/ui/Card';
import { motion } from 'framer-motion';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { DataMigration } from './DataMigration';
import { DataSourceTest } from './DataSourceTest';

export const BackupRestore = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'warning'; message: string }>({ type: 'idle', message: '' });
  
  const [pendingRestore, setPendingRestore] = useState<{data: any, summary: any} | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);


  const getFormatDate = () => {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}-${HH}-${mm}`;
  };

  const handleExportBackup = async () => {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key) || '';
        }
      }
      
      // Add Dexie customer_tickets
      const tickets = await db.customer_tickets.toArray();
      if (tickets.length > 0) {
        data['customer_tickets_dexie'] = JSON.stringify(tickets);
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `antigravity-backup-${getFormatDate()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus({ type: 'success', message: 'Backup exported successfully!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Failed to export backup: ' + err.message });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') throw new Error('Invalid file format');
        
        const data = JSON.parse(result);
        if (typeof data !== 'object' || data === null) {
          throw new Error('Invalid backup structure. Expected JSON object.');
        }

        // Pre-flight check
        const txCount = data['inventory_transactions'] ? JSON.parse(data['inventory_transactions']).length : 0;
        const barcodeCount = data['finished_product_barcodes'] ? JSON.parse(data['finished_product_barcodes']).length : 0;
        const comboCount = data['combo_batches'] ? JSON.parse(data['combo_batches']).length : 0;
        const draftsCount = data['combo_drafts'] ? JSON.parse(data['combo_drafts']).length : 0;
        const auditsCount = data['inventory_audit_log'] ? JSON.parse(data['inventory_audit_log']).length : 0;
        const ticketsCount = data['customer_tickets_dexie'] ? JSON.parse(data['customer_tickets_dexie']).length : 0;

        setPendingRestore({
          data,
          summary: {
            Barcodes: barcodeCount,
            Transactions: txCount,
            Drafts: draftsCount,
            Combos: comboCount,
            Audits: auditsCount,
            Tickets: ticketsCount
          }
        });

      } catch (err: any) {
        setStatus({ type: 'error', message: 'Failed to read backup: ' + err.message });
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    setIsConfirmOpen(true);
  };

  const executeRestore = async () => {
    if (!pendingRestore) return;
    
    // Create Temporary Rollback for localstorage
    const rollbackData: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) rollbackData[key] = localStorage.getItem(key) || '';
    }

    try {
      localStorage.clear();
      for (const key of Object.keys(pendingRestore.data)) {
        if (key === 'customer_tickets_dexie') {
          const tickets = JSON.parse(pendingRestore.data[key]);
          await db.customer_tickets.clear();
          await db.customer_tickets.bulkAdd(tickets);
        } else {
          localStorage.setItem(key, pendingRestore.data[key]);
        }
      }

      setStatus({ type: 'success', message: 'Restore Successful! Reloading...' });
      setTimeout(() => window.location.reload(), 1500);

    } catch (err: any) {
      // Rollback!
      localStorage.clear();
      Object.keys(rollbackData).forEach(key => {
        localStorage.setItem(key, rollbackData[key]);
      });
      setStatus({ type: 'error', message: 'Restore failed. Rolled back safely. ' + err.message });
      setPendingRestore(null);
    }
  };



  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
        <p className="text-muted text-sm mt-1">Manage local database snapshots and perform health maintenance.</p>
      </div>

      {status.type !== 'idle' && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
          status.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}>
          {status.type === 'success' ? <CheckCircle2 /> : <AlertTriangle />}
          <span className="font-medium">{status.message}</span>
        </div>
      )}

      {/* PENDING RESTORE MODAL/SECTION */}
      {pendingRestore && (
        <Card className="p-6 border border-purple-500/50 bg-purple-500/10 mb-6">
          <div className="flex items-center gap-2 text-purple-400 mb-4">
            <FileJson size={20} />
            <h3 className="font-bold text-lg">Backup Ready for Restore</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {Object.keys(pendingRestore.summary).map(k => (
              <div key={k} className="bg-black/20 p-3 rounded-lg border border-border">
                <div className="text-xs text-muted uppercase font-bold">{k}</div>
                <div className="text-xl text-white font-mono">{pendingRestore.summary[k]}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <button onClick={confirmRestore} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition-colors">
              Confirm & Restore
            </button>
            <button onClick={() => setPendingRestore(null)} className="bg-card hover:bg-white/5 border border-border text-white font-bold py-2 px-6 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* BACKUP & RESTORE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card/50 border border-border flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
            <Download size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Export Local Backup</h3>
            <p className="text-muted text-sm mt-2">Export all local inventory data as JSON.</p>
          </div>
          <button onClick={handleExportBackup} className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2">
            <Download size={18} /> Backup Database
          </button>
        </Card>

        <Card className="p-6 bg-card/50 border border-border flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Restore Local Backup</h3>
            <p className="text-muted text-sm mt-2">Upload a previously exported JSON backup file.</p>
          </div>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button onClick={handleImportClick} className="mt-auto w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2">
            <Upload size={18} /> Restore Database
          </button>
        </Card>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Restore Backup"
        message="This will replace current local data. Continue?"
        confirmText="Restore"
        onConfirm={executeRestore}
        onClose={() => {
          setIsConfirmOpen(false);
          setPendingRestore(null);
        }}
      />

      {/* SUPABASE DATA MIGRATION SECTION */}
      <DataMigration />

      {/* DATA SOURCE SETTINGS & TEST */}
      <DataSourceTest />
    </motion.div>
  );
};
