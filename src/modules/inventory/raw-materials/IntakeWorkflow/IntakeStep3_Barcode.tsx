import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useIntakeContext } from './IntakeContext';
import Barcode from 'react-barcode';
import { Printer, Download, Save, CheckCircle2, QrCode, Package, Sparkles, Copy } from 'lucide-react';
import { inventoryService } from '../../../../services/inventoryService';
import toast from 'react-hot-toast';
import { barcodeService } from '../../../../services/barcodeService';
import { productionReadyBatchService } from '../../../../services/productionReadyBatchService';
import { getMaterialUnit, formatMaterialQuantity } from '../../../../config/productionBatchFormulas';
import { BarcodePreview } from '../../../../components/ui/BarcodePreview';

const IntakeStep3_Barcode = () => {
  const navigate = useNavigate();
  const { 
    selectedMaterial, 
    formData, 
    batches, 
    selectedProduct, 
    setSavedBatchIds, 
    setFormData, 
    setBatches, 
    setSelectedMaterial,
    clearIntakeSession 
  } = useIntakeContext();

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  // Real start sequences fetched from Supabase for PRP & PRL preview cards
  const [prpStartSeq, setPrpStartSeq] = useState<number>(1);
  const [prlStartSeq, setPrlStartSeq] = useState<number>(1);

  if (!selectedMaterial || batches.length === 0) {
    return <Navigate to="/inventory/raw-material/intake" replace />;
  }

  const matUnit = getMaterialUnit(selectedMaterial);
  const targetQty = Number(formData.quantity_received) || 0;
  const isPackaging = selectedMaterial.category?.toLowerCase().includes('packaging') || 
                      selectedMaterial.id?.startsWith('pack-');

  const dateYYMMDD = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const matKey = selectedMaterial.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();

  // Fetch real start sequences from Supabase when selectedProduct changes
  useEffect(() => {
    if (!selectedProduct || !selectedMaterial) return;
    let cancelled = false;
    productionReadyBatchService
      .getNextProductionReadySequence(selectedMaterial.name, selectedProduct.productCode, dateYYMMDD)
      .then(seq => {
        if (!cancelled) setPrpStartSeq(seq);
      })
      .catch(() => {});

    productionReadyBatchService
      .getNextProductionRemainderSequence(selectedMaterial.name, selectedProduct.productCode, dateYYMMDD)
      .then(seq => {
        if (!cancelled) setPrlStartSeq(seq);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedProduct?.productCode, selectedMaterial?.name, dateYYMMDD]);

  const isSet = selectedMaterial.name.toLowerCase().includes('bottle + cap set') || selectedMaterial.name.toLowerCase().includes('set');

  // Preview barcodes — use real DB-sequenced numbers for PRP / PRL packs or Set expansion
  const previewBatches = batches.flatMap((b, idx) => {
    if (isSet) {
      const bottleSerial = `MAT-${dateYYMMDD}-BOTT-${String(b.batch_no).padStart(3, '0')}`;
      const capSerial = `MAT-${dateYYMMDD}-CAP-${String(b.batch_no).padStart(3, '0')}`;
      return [
        {
          ...b,
          id: `bott-${b.id || idx}`,
          material_name: 'Bottle',
          serialNumber: bottleSerial,
          scanCode: barcodeService.deriveScanCode(bottleSerial),
          unit: 'PCS',
          pack_type: 'COMPLETE_PACK',
          is_loose_remainder: false
        },
        {
          ...b,
          id: `cap-${b.id || idx}`,
          material_name: 'Cap',
          serialNumber: capSerial,
          scanCode: barcodeService.deriveScanCode(capSerial),
          unit: 'PCS',
          pack_type: 'COMPLETE_PACK',
          is_loose_remainder: false
        }
      ];
    }

    let serialNumber = (b as any).serialNumber;
    let scanCode = (b as any).scanCode;
    const isLooseRemainder = Boolean((b as any).is_loose_remainder || (b as any).pack_type === 'LOOSE_REMAINDER');
    const packType = isLooseRemainder ? 'LOOSE_REMAINDER' : 'COMPLETE_PACK';

    if (!serialNumber) {
      if (selectedProduct) {
        if (isLooseRemainder) {
          const seqStr = String(prlStartSeq).padStart(3, '0');
          serialNumber = `PRL-${matKey}-${selectedProduct.productCode}-${dateYYMMDD}-${seqStr}`;
        } else {
          const currentSeq = prpStartSeq + idx;
          const seqStr = String(currentSeq).padStart(3, '0');
          serialNumber = `PRP-${matKey}-${selectedProduct.productCode}-${dateYYMMDD}-${seqStr}`;
        }
        scanCode = barcodeService.deriveScanCode(serialNumber);
      } else {
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        serialNumber = `${matKey}-${b.quantity}-${randomCode}`;
        scanCode = serialNumber;
      }
    }

    return [{
      ...b,
      serialNumber,
      scanCode: scanCode || serialNumber,
      material_name: selectedMaterial.name,
      unit: matUnit,
      pack_type: packType,
      is_loose_remainder: isLooseRemainder
    }];
  });

  const handleSaveBarcode = async () => {
    if (isSaving) return;

    const parsedQty = Number(formData.quantity_received);
    const parsedPrice = Number(formData.price_per_kg) || 0;
    const parsedGst = Number(formData.gst_percent) || 18;
    const trimmedVendor = formData.vendor_name.trim();
    const trimmedPo = formData.po_reference.trim();
    const trimmedPerson = formData.scanningPersonName.trim();
    const trimmedNotes = formData.notes.trim();

    if (!trimmedVendor) {
      toast.error("Vendor Name is required.");
      return;
    }
    if (!trimmedPo) {
      toast.error("PO Reference / Bill No is required.");
      return;
    }
    if (!trimmedPerson) {
      toast.error("Scanning Person Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Always record the Inventory-IN event (metadata only — no barcode rows)
      const baseAmount = parsedQty * parsedPrice;
      const gstAmount = baseAmount * (parsedGst / 100);
      const totalAmount = baseAmount + gstAmount;

      const inventoryInRecord = {
        material_id: selectedMaterial.id,
        material_name: selectedMaterial.name,
        quantity_received: parsedQty,
        vendor_name: trimmedVendor,
        po_reference: trimmedPo,
        price_per_kg: parsedPrice,
        gst_percent: parsedGst,
        base_amount: baseAmount,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        date_received: formData.date_received || new Date().toISOString(),
        notes: trimmedNotes
      };

      if (selectedProduct && !isSet) {
        // ── PRODUCTION-READY MODE ──────────────────────────────────────────────
        const invId = crypto.randomUUID();
        await inventoryService.saveRawMaterialIntake(inventoryInRecord, []); // empty batches array

        const preparationGroupId = crypto.randomUUID();
        const matUnit = getMaterialUnit(selectedMaterial);
        const completeCount = previewBatches.filter(x => !x.is_loose_remainder).length;
        const prpBatches = await productionReadyBatchService.prepareProductionReadyBatches({
          materialName: selectedMaterial.name,
          unit: matUnit,
          product: selectedProduct,
          countToPrepare: completeCount,
          requiredGramsPerPack: Math.round(Number(previewBatches[0]?.quantity ?? 0) * 1000),
          intakeQtyKg: parsedQty,
          personName: trimmedPerson,
          preparationGroupId,
          vendorName: trimmedVendor,
          poReference: trimmedPo,
          customBatches: previewBatches
        });

        setSavedBatchIds(prpBatches.map(b => b.id) as any);
      } else {
        // ── NORMAL RAW MATERIAL / PACKAGING MODE ───────────────────────────────
        const finalIntakeBatches = previewBatches.map(b => ({
          id: crypto.randomUUID(),
          batch_id: b.serialNumber || `MAT-${dateYYMMDD}-${matKey}-${String(b.batch_no).padStart(3, '0')}`,
          serial_number: b.serialNumber,
          barcode: b.serialNumber,
          material_id: b.material_name === 'Bottle' ? 'pack-1' : b.material_name === 'Cap' ? 'pack-2' : selectedMaterial.id,
          material_name: b.material_name || selectedMaterial.name,
          packaging_name: b.material_name || selectedMaterial.name,
          batch_no: b.batch_no,
          quantity: Number(b.quantity),
          unit: b.unit || matUnit,
          vendor: trimmedVendor,
          vendor_name: trimmedVendor,
          po_reference: trimmedPo,
          price_per_kg: parsedPrice,
          gst_percent: parsedGst,
          batch_value: Number(b.quantity) * parsedPrice * (1 + (parsedGst / 100)),
          barcode_data: b.serialNumber,
          status: 'Active',
          scanning_person_name: trimmedPerson,
          notes: trimmedNotes,
          date_received: formData.date_received || new Date().toISOString(),
          current_stage: 'Incoming',
          pack_type: b.pack_type || 'COMPLETE_PACK',
          is_loose_remainder: Boolean(b.is_loose_remainder)
        }));

        const savedIds = await inventoryService.saveRawMaterialIntake(inventoryInRecord, finalIntakeBatches);
        if (isPackaging || isSet) {
          await inventoryService.savePackagingMaterialBarcodes(finalIntakeBatches);
        }
        setSavedBatchIds(savedIds as any);
      }

      setIsSaved(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      toast.success("Barcodes successfully saved!");
    } catch (err: any) {
      console.error("Save barcode error:", err);
      toast.error(`Failed to save barcodes: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadLabel = (b: any) => {
    barcodeService.downloadBarcodeOnlyLabel({
      scanCode: b.scanCode || b.serialNumber,
      productName: selectedProduct?.productName,
      materialName: b.material_name || selectedMaterial.name,
      moduleType: 'PRODUCTION_READY'
    });
  };

  const handleDownloadAll = () => {
    const records = previewBatches.map(b => ({
      scanCode: b.scanCode || b.serialNumber,
      fullBarcode: b.serialNumber,
      materialName: b.material_name || selectedMaterial.name,
      productName: selectedProduct?.productName,
      quantity: b.quantity,
      unit: b.unit || matUnit
    }));
    barcodeService.downloadBatchBarcodesZIP(records, 'ProductionReady_Barcodes');
  };

  const handlePrintAll = () => {
    const records = previewBatches.map(b => ({
      scan_code: b.scanCode || b.serialNumber,
      product_name: selectedProduct?.productName,
      material_name: b.material_name || selectedMaterial.name
    }));
    barcodeService.printMultipleBarcodeOnlyLabels(records);
  };

  const copyBarcode = (barcodeStr: string) => {
    navigator.clipboard.writeText(barcodeStr);
    toast.success(`Copied barcode ${barcodeStr} to clipboard!`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {showToast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-right-8 duration-300">
          <CheckCircle2 size={24} />
          <div className="flex flex-col">
            <span className="font-bold">Barcodes Saved!</span>
            <span className="text-sm text-emerald-100">Production-ready batch packs successfully recorded.</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="border-b border-[var(--border)] pb-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <QrCode className="text-cyan-400" size={24} />
            Step 3: Production-Ready Batch Barcodes
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Print or download 34 mm × 20 mm scannable barcode labels for prepared batch packs.
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handlePrintAll}
            className="h-10 px-4 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl transition-all cursor-pointer font-medium text-sm"
          >
            <Printer size={16} /> Print All
          </button>
          <button 
            onClick={handleDownloadAll}
            className="h-10 px-4 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl transition-all cursor-pointer font-medium text-sm"
          >
            <Download size={16} /> Download All
          </button>
        </div>
      </div>

      {/* PREPARED PACK CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print-grid">
        {previewBatches.map((b) => (
          <div key={b.id} className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-xl print-label transition-transform hover:-translate-y-1">
            {/* Standardized White Barcode Preview Box */}
            <div id={`barcode-${b.serialNumber}`}>
              <BarcodePreview 
                scanCode={b.scanCode || b.serialNumber} 
                statusText={b.is_loose_remainder ? "LOOSE REMAINDER" : "INCOMING"} 
                statusBg={b.is_loose_remainder ? "rgba(245, 158, 11, 0.15)" : "rgba(100, 116, 139, 0.1)"} 
                statusColor={b.is_loose_remainder ? "#f59e0b" : "#64748b"} 
              />
            </div>

            <div className="p-5 flex-1 flex flex-col pt-3">
              {/* Pack Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">
                    {b.is_loose_remainder ? 'Remainder Pack' : `Pack #${b.batch_no}`}
                  </span>
                  {b.is_loose_remainder ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      LOOSE REMAINDER
                    </span>
                  ) : selectedProduct ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {selectedProduct.productName}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-base font-bold text-white truncate" title={b.material_name || selectedMaterial.name}>
                  {b.material_name || selectedMaterial.name}
                </h3>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                  <span className="text-gray-400">Pack Quantity:</span>
                  <span className="font-extrabold text-white font-mono">{formatMaterialQuantity(Number(b.quantity) * 1000, b.unit || matUnit)} {b.unit || matUnit}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2 no-print">
              <button 
                onClick={() => handleDownloadLabel(b)}
                className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-xs font-semibold cursor-pointer"
              >
                <Download size={14} /> Download
              </button>
              <button 
                onClick={() => copyBarcode(b.serialNumber)}
                className="h-9 px-3 flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg transition-all text-xs font-semibold cursor-pointer"
                title="Copy Barcode"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="pt-6 border-t border-[var(--border)]">
        {!isSaved ? (
          <div className="flex justify-between items-center">
            <button 
              onClick={() => navigate('/inventory/raw-material/intake/split-batches')}
              className="h-11 px-6 text-sm bg-slate-800 hover:bg-slate-700 border border-white/10 text-gray-300 font-medium rounded-xl transition-all cursor-pointer"
            >
              Back to Preparation
            </button>
            <button 
              onClick={handleSaveBarcode}
              disabled={isSaving}
              className="h-11 px-8 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Save size={18} /> {isSaving ? 'Saving Barcodes...' : 'Save & Confirm Barcodes'}
            </button>
          </div>
        ) : (
          <div className="flex justify-center items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => {
                clearIntakeSession();
                navigate('/inventory/raw-material/intake');
              }}
              className="h-12 px-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-medium rounded-xl transition-all cursor-pointer"
            >
              <Package size={18} /> Receive Another Material
            </button>
            <button 
              onClick={() => navigate('/inventory/view-barcode/list')}
              className="h-12 px-8 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-xl transition-all cursor-pointer"
            >
              <QrCode size={18} /> Go to View Barcode List
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntakeStep3_Barcode;
