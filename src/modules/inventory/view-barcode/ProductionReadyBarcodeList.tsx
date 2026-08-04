import { useEffect, useState } from 'react';
import { 
  QrCode, 
  Search, 
  Filter, 
  Package, 
  Sparkles, 
  Trash2, 
  Download, 
  Printer, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Copy 
} from 'lucide-react';
import Barcode from 'react-barcode';
import toast from 'react-hot-toast';
import { 
  productionReadyBatchService, 
  ProductionReadyBatchRow 
} from '../../../services/productionReadyBatchService';
import { barcodeService } from '../../../services/barcodeService';
import { BarcodePreview } from '../../../components/ui/BarcodePreview';

const ProductionReadyBarcodeList = () => {
  const [batches, setBatches] = useState<ProductionReadyBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [cancelModalBatch, setCancelModalBatch] = useState<ProductionReadyBatchRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [personName, setPersonName] = useState('');

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const data = await productionReadyBatchService.getProductionReadyBatches({
        status: statusFilter,
        productCode: productFilter,
        search: searchQuery,
      });
      setBatches(data);
    } catch (err: any) {
      toast.error('Failed to load production-ready batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [statusFilter, productFilter, searchQuery]);

  const handleCancelPack = async () => {
    if (!cancelModalBatch) return;
    if (!personName.trim()) {
      toast.error('Please enter your name to cancel this pack.');
      return;
    }

    setCancelling(true);
    try {
      await productionReadyBatchService.cancelProductionReadyBatch(cancelModalBatch.id, personName.trim());
      toast.success(`Pack ${cancelModalBatch.barcode} cancelled and quantity returned to loose inventory.`);
      setCancelModalBatch(null);
      setPersonName('');
      fetchBatches();
    } catch (err: any) {
      toast.error(`Cancellation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setCancelling(false);
    }
  };

  const downloadLabel = (barcodeStr: string) => {
    const wrapper = document.getElementById(`barcode-${barcodeStr}`);
    const svg = wrapper?.querySelector('svg');
    if (svg) {
      barcodeService.downloadSVG(svg as SVGSVGElement, `Barcode-${barcodeStr}.svg`);
    } else if (wrapper) {
      barcodeService.downloadPNG(wrapper, `Barcode-${barcodeStr}.png`);
    }
  };

  const copyBarcode = (str: string) => {
    navigator.clipboard.writeText(str);
    toast.success(`Copied ${str} to clipboard!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> READY</span>;
      case 'RESERVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"><Clock size={12} /> RESERVED</span>;
      case 'ISSUED_TO_PRODUCTION':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1"><Layers size={12} /> ISSUED</span>;
      case 'CONSUMED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"><Package size={12} /> CONSUMED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1"><XCircle size={12} /> CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-500/20 text-gray-300 border border-gray-500/30">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* TITLE & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Sparkles className="text-cyan-400" size={24} />
            Production-Ready Material Batches
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            View, search, print labels, and manage status for prepared raw material packs.
          </p>
        </div>
        <button
          onClick={fetchBatches}
          className="h-10 px-4 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl transition-all cursor-pointer font-medium text-sm self-start md:self-auto"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh List
        </button>
      </div>

      {/* FILTER CONTROLS */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by barcode, scan code, material name, or product..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all font-medium text-sm"
          />
        </div>

        {/* FILTERS ROW */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/10">
          {/* STATUS FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Status:</span>
            {['ALL', 'READY', 'RESERVED', 'ISSUED_TO_PRODUCTION', 'CONSUMED', 'CANCELLED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-black/30 border border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* PRODUCT FILTERS */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Product:</span>
            {[
              { code: 'ALL', label: 'All Products' },
              { code: '1B', label: 'Blue Detergent' },
              { code: '1Y', label: 'Yellow Dish Wash' },
              { code: '1P', label: 'Pink Comfort' },
            ].map(p => (
              <button
                key={p.code}
                onClick={() => setProductFilter(p.code)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  productFilter === p.code
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-black/30 border border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CARDS GRID */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 space-y-3">
          <RefreshCw size={28} className="animate-spin mx-auto text-cyan-400" />
          <p className="text-sm font-medium">Loading production-ready batch packs...</p>
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-white/10 text-center space-y-3">
          <Package size={36} className="mx-auto text-gray-500" />
          <h3 className="text-lg font-bold text-white">No Production-Ready Batches Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            No batch packs match the current status or product filters. Prepare new packs from the Raw Material Intake workflow.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {batches.map(b => (
            <div
              key={b.id}
              className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-xl transition-all hover:border-cyan-500/40 hover:-translate-y-1"
            >
              {/* Standardized White Barcode Preview Box at Top */}
              <div id={`barcode-${b.barcode}`}>
                <BarcodePreview 
                  record={b} 
                  statusText={b.status === 'READY' ? 'INCOMING' : String(b.status)} 
                  statusBg={b.status === 'READY' || (b.status as string) === 'INCOMING' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(16, 185, 129, 0.1)'} 
                  statusColor={b.status === 'READY' || (b.status as string) === 'INCOMING' ? '#64748b' : '#10b981'} 
                />
              </div>

              <div className="p-5 flex-1 space-y-4 pt-3">
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(b.status || b.current_stage || 'INCOMING')}
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                    {b.product_code} ({b.product_name})
                  </span>
                </div>

                {/* Material Name */}
                <div>
                  <h3 className="text-base font-bold text-white leading-tight truncate" title={b.material_name}>
                    {b.material_name}
                  </h3>
                  <div className="text-xs text-gray-400 mt-1 font-mono">{b.barcode}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Pack #{b.prepared_batch_no} • {b.product_units_per_batch} Units / Batch</div>
                </div>

                {/* Quantity & Prepared By Info */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Quantity</span>
                    <span className="font-extrabold text-white font-mono">{((b.quantity_grams || 0) / 1000).toFixed(3)} KG</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Prepared By</span>
                    <span className="font-semibold text-gray-300 truncate block">{b.prepared_by || 'Staff'}</span>
                  </div>
                </div>
              </div>

              {/* CARD ACTIONS FOOTER */}
              <div className="p-3 border-t border-white/10 bg-black/50 flex items-center justify-between gap-2">
                <button
                  onClick={() => barcodeService.downloadBarcodeOnlyLabel(b, 'PRODUCTION_READY')}
                  className="flex-1 h-9 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Download size={13} /> Label
                </button>
                <button
                  onClick={() => copyBarcode(b.barcode)}
                  className="h-9 px-2.5 flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg text-xs cursor-pointer"
                  title="Copy Barcode"
                >
                  <Copy size={13} />
                </button>
                {b.status === 'READY' && (
                  <button
                    onClick={() => setCancelModalBatch(b)}
                    className="h-9 px-2.5 flex items-center justify-center bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold cursor-pointer border border-rose-500/30"
                    title="Cancel Pack & Return Stock"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalBatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Cancel Production Pack</h3>
                <p className="text-xs text-gray-400">Return stock quantity back to loose inventory</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-xs space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">Barcode:</span> <strong className="font-mono text-cyan-300">{cancelModalBatch.barcode}</strong></div>
              <div className="flex justify-between"><span className="text-gray-400">Material:</span> <strong className="text-white">{cancelModalBatch.material_name}</strong></div>
              <div className="flex justify-between"><span className="text-gray-400">Quantity Return:</span> <strong className="text-emerald-400 font-mono">{((cancelModalBatch.quantity_grams || 0) / 1000).toFixed(3)} KG</strong></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">Your Name (Required for Stock Audit)</label>
              <input
                type="text"
                placeholder="Enter person name..."
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                className="w-full h-10 px-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCancelModalBatch(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelPack}
                disabled={cancelling}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Pack Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionReadyBarcodeList;
