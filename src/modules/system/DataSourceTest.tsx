import { useState } from 'react';
import { Server, Database, Cloud, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { 
  migrateRawMaterials, 
  migrateProducts, 
  migrateComboBoxes, 
  migrateQCBarcodes,
  getLocalCounts,
} from '../../services/migrationService';
import type { MigrationReport } from '../../services/migrationService';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

export const DataSourceTest = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [tableStatus, setTableStatus] = useState<Record<string, { connected: boolean; count: number; error?: string }>>({});
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{
    rawMaterials?: MigrationReport;
    products?: MigrationReport;
    comboBoxes?: MigrationReport;
    qcBarcodes?: MigrationReport;
    localCounts?: any;
  } | null>(null);

  const tablesToTest = Object.values(SUPABASE_TABLES);

  const runTest = async () => {
    setIsTesting(true);
    const results: Record<string, { connected: boolean; count: number; error?: string }> = {};

    for (const table of tablesToTest) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          results[table] = { connected: false, count: 0, error: error.message };
        } else {
          results[table] = { connected: true, count: count || 0 };
        }
      } catch (err: any) {
        results[table] = { connected: false, count: 0, error: err.message || String(err) };
      }
    }

    setTableStatus(results);
    setIsTesting(false);
  };

  const handleMigrate = async () => {
    if (!window.confirm("Are you sure you want to migrate data from LocalStorage to Supabase?")) return;
    
    setIsMigrating(true);
    setMigrationResults(null);

    try {
      const localCounts = getLocalCounts();
      const rmReport = await migrateRawMaterials();
      const prodReport = await migrateProducts();
      const comboReport = await migrateComboBoxes();
      const qcReport = await migrateQCBarcodes();

      setMigrationResults({
        localCounts,
        rawMaterials: rmReport,
        products: prodReport,
        comboBoxes: comboReport,
        qcBarcodes: qcReport
      });

      // Refresh table counts after migration
      await runTest();

    } catch (error) {
      console.error("Migration failed:", error);
    } finally {
      setIsMigrating(false);
    }
  };

  const renderMigrationReport = (title: string, localCount: number, report?: MigrationReport) => {
    if (!report) return null;
    return (
      <div className="bg-black/20 p-4 rounded-xl border border-border mt-4">
        <h4 className="font-bold text-white mb-2">{title}</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          <div><span className="text-muted">Local Count:</span> <span className="text-white font-mono">{localCount}</span></div>
          <div><span className="text-muted">Migrated:</span> <span className="text-green-400 font-mono">{report.migrated}</span></div>
          <div><span className="text-muted">Skipped (Dupes):</span> <span className="text-yellow-400 font-mono">{report.skipped}</span></div>
          <div><span className="text-muted">Failed:</span> <span className="text-red-400 font-mono">{report.failed}</span></div>
        </div>
        {report.errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs text-red-400 font-mono max-h-32 overflow-y-auto">
            {report.errors.map((err, i) => (
              <div key={i} className="mb-1 truncate" title={err}>- {err}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-6 mt-8 border border-blue-500/30 bg-blue-500/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Supabase Database Status</h2>
          <p className="text-muted text-sm">Test table connectivity, view counts, errors, and sync LocalStorage data.</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={runTest}
          disabled={isTesting}
          className="flex-1 bg-card hover:bg-white/5 border border-blue-500/50 text-blue-400 font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {isTesting ? <RefreshCw className="animate-spin" size={18} /> : <Server size={18} />}
          {isTesting ? 'Testing Connections...' : 'Test Supabase Tables'}
        </button>

        <button
          onClick={handleMigrate}
          disabled={isMigrating}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {isMigrating ? <RefreshCw className="animate-spin" size={18} /> : <Cloud size={18} />}
          {isMigrating ? 'Migrating Data...' : 'Migrate Local Data to Supabase'}
        </button>
      </div>

      {Object.keys(tableStatus).length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-white mb-3">Table Connection Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tablesToTest.map(table => {
              const status = tableStatus[table];
              return (
                <div key={table} className="bg-black/20 p-3 rounded-lg border border-border flex flex-col justify-between">
                  <div className="text-xs text-muted font-mono mb-2 truncate" title={table}>{table}</div>
                  {status ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {status.connected ? (
                          <span className="flex items-center gap-1 text-xs text-green-400 font-bold"><CheckCircle size={14} /> Connected</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-400 font-bold"><XCircle size={14} /> Failed</span>
                        )}
                      </div>
                      <div className="text-sm text-white flex justify-between">
                        <span>Records:</span>
                        <span className="font-mono">{status.count}</span>
                      </div>
                      {status.error && (
                        <div className="text-[10px] text-red-400 mt-2 truncate font-mono" title={status.error}>
                          {status.error}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted">Waiting...</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {migrationResults && (
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Migration Results</h3>
          {renderMigrationReport('Raw Materials', migrationResults.localCounts.rawMaterials, migrationResults.rawMaterials)}
          {renderMigrationReport('Products', migrationResults.localCounts.products, migrationResults.products)}
          {renderMigrationReport('Combo Boxes', migrationResults.localCounts.comboBoxes, migrationResults.comboBoxes)}
          {renderMigrationReport('QC Barcodes', migrationResults.localCounts.qcBarcodes, migrationResults.qcBarcodes)}
        </div>
      )}
    </Card>
  );
};
