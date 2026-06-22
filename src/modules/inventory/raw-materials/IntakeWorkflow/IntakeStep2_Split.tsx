import { useNavigate, Navigate } from 'react-router-dom';
import { useIntakeContext } from './IntakeContext';
import { Trash2, Plus, AlertTriangle, CheckCircle2, SplitSquareHorizontal } from 'lucide-react';

const IntakeStep2_Split = () => {
  const navigate = useNavigate();
  const { selectedMaterial, formData, batches, setBatches } = useIntakeContext();

  if (!selectedMaterial) {
    return <Navigate to="/inventory/raw-material/intake" replace />;
  }

  const targetQty = Number(formData.quantity_received) || 0;
  const totalBatchQty = batches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  const diff = targetQty - totalBatchQty;
  const isExact = Math.abs(diff) < 0.01;

  const handleAutoSplit = () => {
    let containerSize = targetQty;
    const match = selectedMaterial.description?.match(/(\d+)kg/i);
    if (match && match[1]) {
      containerSize = Number(match[1]);
    }

    if (containerSize > 0 && containerSize < targetQty) {
      const count = Math.ceil(targetQty / containerSize);
      let currentTotal = 0;
      const newBatches = Array.from({ length: count }).map((_, i) => {
        let qty = containerSize;
        if (i === count - 1) {
          qty = Number((targetQty - currentTotal).toFixed(2));
        }
        currentTotal += qty;
        return { id: crypto.randomUUID(), batch_no: i + 1, quantity: qty };
      });
      setBatches(newBatches);
    } else {
      setBatches([{ id: crypto.randomUUID(), batch_no: 1, quantity: targetQty }]);
    }
  };

  const updateBatch = (id: string, field: 'batch_no' | 'quantity', value: string) => {
    setBatches(batches.map(b => b.id === id ? { ...b, [field]: Number(value) } : b));
  };
  
  const addBatchRow = () => {
    const nextNo = batches.length > 0 ? Math.max(...batches.map(b => b.batch_no)) + 1 : 1;
    let defaultQty = 0;
    if (diff > 0) defaultQty = Number(diff.toFixed(2));
    setBatches([...batches, { id: crypto.randomUUID(), batch_no: nextNo, quantity: defaultQty }]);
  };

  const deleteBatchRow = (id: string) => {
    if (batches.length > 1) {
      setBatches(batches.filter(b => b.id !== id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <SplitSquareHorizontal className="text-primary" size={24} />
          Step 2: Split Batches
        </h1>
        <p className="text-muted-foreground mt-2">Divide the received quantity into individual batches for barcode generation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-surface shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white">Define Batches</h2>
              <button 
                onClick={handleAutoSplit}
                className="h-9 px-4 text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg transition-colors font-medium"
              >
                Auto Split
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">Batch #</th>
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">Quantity (KG)</th>
                    <th className="pb-3 text-sm font-semibold text-muted-foreground w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map((b) => (
                    <tr key={b.id} className="group">
                      <td className="py-4 pr-4">
                        <input 
                          type="number" min="1" 
                          value={b.batch_no} 
                          onChange={e => updateBatch(b.id, 'batch_no', e.target.value)} 
                          className="w-full h-10 px-3 bg-background border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                      </td>
                      <td className="py-4 pr-4">
                        <input 
                          type="number" step="0.1" 
                          value={b.quantity} 
                          onChange={e => updateBatch(b.id, 'quantity', e.target.value)} 
                          className="w-full h-10 px-3 bg-background border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                      </td>
                      <td className="py-4 text-center">
                        <button 
                          onClick={() => deleteBatchRow(b.id)} 
                          disabled={batches.length <= 1}
                          className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button 
              onClick={addBatchRow}
              className="mt-4 w-full h-11 border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center gap-2 transition-all font-medium"
            >
              <Plus size={18} /> Add Batch Row
            </button>

            <div className={`mt-8 p-4 rounded-xl border flex items-start gap-4 transition-colors ${
              isExact 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                : diff < 0 
                  ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            }`}>
              {isExact ? <CheckCircle2 className="mt-0.5 shrink-0" size={24} /> : <AlertTriangle className="mt-0.5 shrink-0" size={24} />}
              <div>
                <h4 className="font-bold text-lg leading-none">
                  Total Allocated: {totalBatchQty.toFixed(2)} / {targetQty} KG
                </h4>
                {!isExact && diff > 0 && (
                  <p className="text-sm mt-1 opacity-90">Remaining to allocate: <strong>{diff.toFixed(2)} KG</strong></p>
                )}
                {!isExact && diff < 0 && (
                  <p className="text-sm mt-1 opacity-90">Over-allocated by: <strong>{Math.abs(diff).toFixed(2)} KG</strong></p>
                )}
                {isExact && (
                  <p className="text-sm mt-1 opacity-90">Quantities perfectly matched. Ready to generate barcodes.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/inventory/dashboard')}
                  className="h-10 px-4 text-sm bg-transparent hover:bg-surface border border-border text-gray-300 font-medium rounded-lg transition-all"
                >
                  Home
                </button>
                <button 
                  onClick={() => navigate('/inventory/raw-material')}
                  className="h-10 px-4 text-sm bg-transparent hover:bg-surface border border-border text-gray-300 font-medium rounded-lg transition-all"
                >
                  Back
                </button>
              </div>
              
              <button 
                onClick={() => navigate('/inventory/raw-material/intake/generate-barcode')}
                disabled={!isExact}
                className="h-11 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                Next → Generate Barcode
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 p-6 rounded-2xl border border-border bg-surface/50 shadow-xl backdrop-blur-xl">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-bold mb-6 pb-4 border-b border-border">Summary</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Material</p>
                <p className="text-base font-medium text-white">{selectedMaterial.name}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Received</p>
                <p className="text-2xl font-bold text-primary">{targetQty} KG</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Vendor</p>
                <p className="text-sm font-medium text-gray-300">{formData.vendor_name || '--'}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">PO Reference</p>
                <p className="text-sm font-medium text-gray-300">{formData.po_reference || '--'}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Standard Container</p>
                <p className="text-sm font-medium text-gray-300">{selectedMaterial.description || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntakeStep2_Split;
