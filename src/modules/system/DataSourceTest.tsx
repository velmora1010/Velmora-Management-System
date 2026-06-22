import React, { useState, useEffect } from 'react';
import { Server, Activity, Database, Cloud } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { inventoryService } from '../../services/inventoryService';

export const DataSourceTest = () => {
  const [mode, setMode] = useState<'local' | 'supabase' | 'hybrid'>('hybrid');
  const [isTesting, setIsTesting] = useState(false);
  const [counts, setCounts] = useState<{
    rawMaterials?: number;
    products?: number;
    comboBoxes?: number;
    qcBarcodes?: number;
  } | null>(null);

  useEffect(() => {
    // @ts-ignore
    setMode(inventoryService.getDataSourceMode());
  }, []);

  const handleModeChange = (newMode: 'local' | 'supabase' | 'hybrid') => {
    setMode(newMode);
    // @ts-ignore
    inventoryService.setDataSourceMode(newMode);
  };

  const runTest = async () => {
    setIsTesting(true);
    try {
      // @ts-ignore
      const rm = await inventoryService.getRawMaterialBarcodesHybrid();
      // @ts-ignore
      const prod = await inventoryService.getProductBarcodesHybrid();
      // @ts-ignore
      const combo = await inventoryService.getComboBoxesHybrid();
      // @ts-ignore
      const qc = await inventoryService.getQCBarcodesHybrid();

      setCounts({
        rawMaterials: rm.length,
        products: prod.length,
        comboBoxes: combo.length,
        qcBarcodes: qc.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="p-6 mt-8 border border-blue-500/30 bg-blue-500/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
          <Activity size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Data Source Settings (Phase 2 Test)</h2>
          <p className="text-muted text-sm">Configure read sources and test async getters.</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-white mb-3">Active Data Source:</h3>
        <div className="flex gap-4">
          <button
            onClick={() => handleModeChange('local')}
            className={`flex-1 py-2 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-colors ${
              mode === 'local' ? 'bg-blue-600 text-white border-blue-500' : 'bg-black/20 text-slate-400 border-border hover:bg-white/5'
            }`}
          >
            <Database size={16} /> Local
          </button>
          <button
            onClick={() => handleModeChange('hybrid')}
            className={`flex-1 py-2 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-colors ${
              mode === 'hybrid' ? 'bg-blue-600 text-white border-blue-500' : 'bg-black/20 text-slate-400 border-border hover:bg-white/5'
            }`}
          >
            <Server size={16} /> Hybrid
          </button>
          <button
            onClick={() => handleModeChange('supabase')}
            className={`flex-1 py-2 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-colors ${
              mode === 'supabase' ? 'bg-blue-600 text-white border-blue-500' : 'bg-black/20 text-slate-400 border-border hover:bg-white/5'
            }`}
          >
            <Cloud size={16} /> Supabase
          </button>
        </div>
      </div>

      <button
        onClick={runTest}
        disabled={isTesting}
        className="w-full bg-card hover:bg-white/5 border border-blue-500/50 text-blue-400 font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
      >
        {isTesting ? 'Fetching Data...' : 'Test Async Read Connections'}
      </button>

      {counts && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/20 p-3 rounded-lg border border-border">
            <div className="text-xs text-muted uppercase font-bold">Raw Materials</div>
            <div className="text-xl text-white font-mono">{counts.rawMaterials}</div>
          </div>
          <div className="bg-black/20 p-3 rounded-lg border border-border">
            <div className="text-xs text-muted uppercase font-bold">Products</div>
            <div className="text-xl text-white font-mono">{counts.products}</div>
          </div>
          <div className="bg-black/20 p-3 rounded-lg border border-border">
            <div className="text-xs text-muted uppercase font-bold">Combo Boxes</div>
            <div className="text-xl text-white font-mono">{counts.comboBoxes}</div>
          </div>
          <div className="bg-black/20 p-3 rounded-lg border border-border">
            <div className="text-xs text-muted uppercase font-bold">QC Barcodes</div>
            <div className="text-xl text-white font-mono">{counts.qcBarcodes}</div>
          </div>
        </div>
      )}
    </Card>
  );
};
