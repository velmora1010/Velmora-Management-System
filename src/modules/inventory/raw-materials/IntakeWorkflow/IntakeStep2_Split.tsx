import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useIntakeContext } from './IntakeContext';
import { 
  Package, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Sparkles, 
  Minus, 
  Plus, 
  Scale, 
  Droplet 
} from 'lucide-react';
import { 
  getEligibleProductsForMaterial, 
  getMaterialRequirementForProduct, 
  kgToGrams, 
  gramsToKgString, 
  ProductFormulaConfig 
} from '../../../../config/productionBatchFormulas';
import { productionReadyBatchService } from '../../../../services/productionReadyBatchService';

const IntakeStep2_Split = () => {
  const navigate = useNavigate();
  const { 
    selectedMaterial, 
    formData, 
    setBatches, 
    setSelectedProduct, 
    selectedProduct,
    setLooseBalanceGrams,
    setAllocatedGrams,
    setRemainingLooseGrams 
  } = useIntakeContext();

  const [loading, setLoading] = useState(true);
  const [existingLooseGrams, setExistingLooseGrams] = useState(0);
  const [packsToPrepare, setPacksToPrepare] = useState(0);
  const [eligibleProducts, setEligibleProducts] = useState<ProductFormulaConfig[]>([]);

  if (!selectedMaterial) {
    return <Navigate to="/inventory/raw-material/intake" replace />;
  }

  const matName = selectedMaterial.name;
  const isWater = matName.toLowerCase().includes('water');

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      const eligible = getEligibleProductsForMaterial(matName);
      setEligibleProducts(eligible);

      // Select default product if available
      let defaultProd: ProductFormulaConfig | null = null;
      if (eligible.length > 0) {
        defaultProd = eligible[0];
        setSelectedProduct(defaultProd);
      }

      // Fetch existing loose stock balance
      const looseGrams = await productionReadyBatchService.getLooseStockBalanceGrams(matName);
      setExistingLooseGrams(looseGrams);

      // Calculate initial packs if product exists
      if (defaultProd) {
        const req = getMaterialRequirementForProduct(matName, defaultProd.productCode);
        if (req && req.requiredGrams > 0) {
          const intakeGrams = kgToGrams(formData.quantity_received);
          const combined = looseGrams + intakeGrams;
          const maxPacks = Math.floor(combined / req.requiredGrams);
          setPacksToPrepare(maxPacks);
        }
      }
      setLoading(false);
    };

    initData();
  }, [matName]);

  const handleProductChange = (prod: ProductFormulaConfig) => {
    setSelectedProduct(prod);
    const req = getMaterialRequirementForProduct(matName, prod.productCode);
    if (req && req.requiredGrams > 0) {
      const intakeGrams = kgToGrams(formData.quantity_received);
      const combined = existingLooseGrams + intakeGrams;
      const maxPacks = Math.floor(combined / req.requiredGrams);
      setPacksToPrepare(maxPacks);
    }
  };

  const newIntakeGrams = kgToGrams(formData.quantity_received);
  const combinedGrams = existingLooseGrams + newIntakeGrams;

  const currentReq = selectedProduct ? getMaterialRequirementForProduct(matName, selectedProduct.productCode) : null;
  const requiredGramsPerPack = currentReq?.requiredGrams || 0;
  const maxCompletePacks = requiredGramsPerPack > 0 ? Math.floor(combinedGrams / requiredGramsPerPack) : 0;

  const totalAllocatedGrams = packsToPrepare * requiredGramsPerPack;
  const remainingGrams = combinedGrams - totalAllocatedGrams;

  const handleProceed = () => {
    if (isWater) {
      // Bulk intake for water
      setBatches([{ id: crypto.randomUUID(), batch_no: 1, quantity: Number(formData.quantity_received) || 0 }]);
      navigate('/inventory/raw-material/intake/generate-barcode');
      return;
    }

    if (!selectedProduct || packsToPrepare <= 0) {
      return;
    }

    // Populate batches for production ready packs
    const newBatches = Array.from({ length: packsToPrepare }).map((_, i) => ({
      id: crypto.randomUUID(),
      batch_no: i + 1,
      quantity: requiredGramsPerPack / 1000,
    }));

    setBatches(newBatches);
    setLooseBalanceGrams(existingLooseGrams);
    setAllocatedGrams(totalAllocatedGrams);
    setRemainingLooseGrams(remainingGrams);

    navigate('/inventory/raw-material/intake/generate-barcode');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles size={24} className="text-cyan-400" />
            Step 2: Prepare Production-Ready Batches
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Divide incoming raw material stock into product-specific, production-ready batch packs.
          </p>
        </div>
        <div className="px-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl flex items-center gap-3">
          <Package size={20} className="text-cyan-400" />
          <div>
            <div className="text-[10px] text-gray-400 font-medium uppercase">Raw Material</div>
            <div className="text-sm font-bold text-white">{matName}</div>
          </div>
        </div>
      </div>

      {isWater ? (
        /* WATER BULK INTAKE NOTICE */
        <div className="p-8 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
            <Droplet size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-white">Water Bulk Stock Intake</h2>
            <p className="text-sm text-gray-300">
              Water has no fixed batch requirement and is stored as bulk inventory stock. It will not be split into production-ready batch barcodes.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 inline-block text-left font-mono text-sm text-cyan-300">
            Intake Quantity: <strong>{formData.quantity_received} LTR</strong>
          </div>
          <div>
            <button
              onClick={handleProceed}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 mx-auto cursor-pointer"
            >
              Proceed to Barcode Generation <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* PRODUCTION-READY SPLIT FORM */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* MAIN FORM LEFT (2 COLS) */}
          <div className="lg:col-span-2 space-y-6">
            {/* STOCK SUMMARY ROW */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">New Intake</span>
                <span className="text-xl font-extrabold text-white">{gramsToKgString(newIntakeGrams)} <small className="text-xs text-gray-400">KG</small></span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">Loose Balance</span>
                <span className="text-xl font-extrabold text-cyan-300">{gramsToKgString(existingLooseGrams)} <small className="text-xs text-gray-400">KG</small></span>
              </div>
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Combined Stock</span>
                <span className="text-xl font-extrabold text-emerald-300">{gramsToKgString(combinedGrams)} <small className="text-xs text-gray-400">KG</small></span>
              </div>
            </div>

            {/* PRODUCT SELECTOR */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                Select Destination Product
              </label>

              {eligibleProducts.length > 1 ? (
                <div className="grid grid-cols-2 gap-3">
                  {eligibleProducts.map(p => {
                    const isSelected = selectedProduct?.productCode === p.productCode;
                    return (
                      <div
                        key={p.productCode}
                        onClick={() => handleProductChange(p)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-md'
                            : 'bg-black/20 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{p.productName}</span>
                          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">{p.productCode}</span>
                        </div>
                        <span className="text-xs text-gray-400 mt-1 block">{p.unitsPerBatch} Units / Batch</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-base block">{selectedProduct?.productName}</span>
                    <span className="text-xs text-gray-300">{selectedProduct?.unitsPerBatch} Units / Production Batch</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-black/40 px-3 py-1 rounded-lg border border-cyan-500/30">
                    CODE: {selectedProduct?.productCode} (LOCKED)
                  </span>
                </div>
              )}
            </div>

            {/* BATCH COUNT COUNTER */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Number of Packs to Prepare</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    1 pack = {gramsToKgString(requiredGramsPerPack)} KG ({selectedProduct?.productName})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 block uppercase font-medium">Max Complete Packs</span>
                  <span className="text-2xl font-extrabold text-cyan-400">{maxCompletePacks}</span>
                </div>
              </div>

              {maxCompletePacks > 0 ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setPacksToPrepare(Math.max(0, packsToPrepare - 1))}
                    disabled={packsToPrepare <= 0}
                    className="w-12 h-12 rounded-xl bg-slate-800 border border-white/10 text-white font-bold flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus size={20} />
                  </button>

                  <div className="flex-1 text-center bg-black/40 p-3 rounded-xl border border-white/10">
                    <input
                      type="number"
                      min="0"
                      max={maxCompletePacks}
                      value={packsToPrepare}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setPacksToPrepare(Math.min(maxCompletePacks, Math.max(0, val)));
                      }}
                      className="w-full text-center text-3xl font-extrabold text-white bg-transparent border-none outline-none font-mono"
                    />
                    <span className="text-xs text-gray-400 uppercase font-medium">Packs Selected</span>
                  </div>

                  <button
                    onClick={() => setPacksToPrepare(Math.min(maxCompletePacks, packsToPrepare + 1))}
                    disabled={packsToPrepare >= maxCompletePacks}
                    className="w-12 h-12 rounded-xl bg-slate-800 border border-white/10 text-white font-bold flex items-center justify-center hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-2">
                  <AlertCircle size={18} /> Insufficient stock to prepare 1 complete batch pack ({gramsToKgString(requiredGramsPerPack)} KG required). Intake will carry forward as loose stock.
                </div>
              )}
            </div>
          </div>

          {/* ALLOCATION BREAKDOWN RIGHT (1 COL) */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-cyan-950/40 border border-cyan-500/30 shadow-xl space-y-6">
              <h3 className="text-base font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
                <Scale size={18} className="text-cyan-400" />
                Allocation Breakdown
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Packs Prepared:</span>
                  <strong className="text-white font-mono">{packsToPrepare} packs</strong>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Pack Quantity:</span>
                  <strong className="text-white font-mono">{gramsToKgString(requiredGramsPerPack)} KG each</strong>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-white/10 pt-3">
                  <span className="text-cyan-300 font-semibold">Total Allocated:</span>
                  <strong className="text-cyan-300 font-mono text-base">{gramsToKgString(totalAllocatedGrams)} KG</strong>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-white/10 pt-3">
                  <span className="text-emerald-400 font-semibold">Remaining Loose Balance:</span>
                  <strong className="text-emerald-400 font-mono text-base">{gramsToKgString(remainingGrams)} KG</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-300 flex items-start gap-2">
                <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                Remaining loose balance of {gramsToKgString(remainingGrams)} KG will carry forward and automatically add to future intakes.
              </div>

              <button
                onClick={handleProceed}
                disabled={packsToPrepare <= 0 && !isWater}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Generate Barcodes <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntakeStep2_Split;
