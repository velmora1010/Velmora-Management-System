import { useState, useEffect } from 'react';
import { Database, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import {
  getLocalCounts,
  getSupabaseCounts,
  migrateRawMaterials,
  migrateProducts,
  migrateComboBoxes,
  migrateQCBarcodes
} from '../../services/migrationService';
import type { MigrationReport } from '../../services/migrationService';

export const DataMigration = () => {
  const [localCounts, setLocalCounts] = useState({ rawMaterials: 0, products: 0, comboBoxes: 0, qcBarcodes: 0 });
  const [supaCounts, setSupaCounts] = useState({ rawMaterials: 0, products: 0, comboBoxes: 0, qcBarcodes: 0 });
  const [isMigrating, setIsMigrating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [report, setReport] = useState<{
    rawMaterials?: MigrationReport;
    products?: MigrationReport;
    comboBoxes?: MigrationReport;
    qcBarcodes?: MigrationReport;
  } | null>(null);

  const fetchCounts = async () => {
    setLocalCounts(getLocalCounts());
    try {
      const supa = await getSupabaseCounts();
      setSupaCounts(supa);
    } catch (err) {
      console.error('Failed to fetch Supabase counts', err);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setReport(null);
    try {
      setProgressMsg('Migrating Raw Materials...');
      const rmReport = await migrateRawMaterials();
      
      setProgressMsg('Migrating Products...');
      const pReport = await migrateProducts();
      
      setProgressMsg('Migrating Combo Boxes...');
      const cbReport = await migrateComboBoxes();
      
      setProgressMsg('Migrating QC Barcodes...');
      const qcReport = await migrateQCBarcodes();
      
      setReport({
        rawMaterials: rmReport,
        products: pReport,
        comboBoxes: cbReport,
        qcBarcodes: qcReport
      });
      setProgressMsg('Migration Complete!');
      await fetchCounts();
    } catch (err) {
      console.error(err);
      setProgressMsg('Migration Failed. Check console.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card className="p-6 mt-8 border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Supabase Data Migration (Phase 1)</h2>
          <p className="text-muted text-sm">Copy local storage inventory data to Supabase safely.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Raw Materials', local: localCounts.rawMaterials, supa: supaCounts.rawMaterials },
          { label: 'Products', local: localCounts.products, supa: supaCounts.products },
          { label: 'Combo Boxes', local: localCounts.comboBoxes, supa: supaCounts.comboBoxes },
          { label: 'QC Barcodes', local: localCounts.qcBarcodes, supa: supaCounts.qcBarcodes },
        ].map((stat, i) => (
          <div key={i} className="bg-black/20 p-4 rounded-xl border border-border">
            <div className="text-xs text-muted uppercase font-bold mb-2">{stat.label}</div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Local: <span className="text-white font-mono">{stat.local}</span></span>
              <span className="text-emerald-400">Supa: <span className="font-mono">{stat.supa}</span></span>
            </div>
          </div>
        ))}
      </div>

      {!report && !isMigrating && (
        <button
          onClick={handleMigrate}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
        >
          <ArrowRight size={18} /> Migrate to Supabase
        </button>
      )}

      {isMigrating && (
        <div className="flex items-center justify-center gap-3 py-4 text-emerald-400 font-medium">
          <Loader2 className="animate-spin" size={20} />
          <span>{progressMsg}</span>
        </div>
      )}

      {report && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg border-b border-emerald-500/20 pb-2">
            <CheckCircle2 /> Migration Complete
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Raw Materials', rep: report.rawMaterials },
              { label: 'Products', rep: report.products },
              { label: 'Combo Boxes', rep: report.comboBoxes },
              { label: 'QC Barcodes', rep: report.qcBarcodes },
            ].map((col, i) => (
              <div key={i} className="bg-black/20 p-3 rounded-lg text-sm border border-border">
                <div className="font-bold text-white mb-2">{col.label}</div>
                <div className="text-emerald-400">Migrated: {col.rep?.migrated}</div>
                <div className="text-yellow-500">Skipped: {col.rep?.skipped}</div>
                <div className={col.rep?.failed ? 'text-red-400' : 'text-slate-500'}>
                  Failed: {col.rep?.failed}
                </div>
              </div>
            ))}
          </div>

          {Object.values(report).some(r => r?.failed > 0) && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle size={16} /> Error Details
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {report.rawMaterials?.errors.map((e, i) => <li key={`rm-${i}`}>{e}</li>)}
                {report.products?.errors.map((e, i) => <li key={`p-${i}`}>{e}</li>)}
                {report.comboBoxes?.errors.map((e, i) => <li key={`cb-${i}`}>{e}</li>)}
                {report.qcBarcodes?.errors.map((e, i) => <li key={`qc-${i}`}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
