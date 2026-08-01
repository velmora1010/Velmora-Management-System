import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useIntakeContext } from './IntakeContext';
import Barcode from 'react-barcode';
import { Printer, Download, Save, CheckCircle2, QrCode, Package } from 'lucide-react';
import { inventoryService } from '../../../../services/inventoryService';
import toast from 'react-hot-toast';
import { barcodeService } from '../../../../services/barcodeService';

const IntakeStep3_Barcode = () => {
  const navigate = useNavigate();
  const { selectedMaterial, formData, batches, setSavedBatchIds, setFormData, setBatches, setSelectedMaterial } = useIntakeContext();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  if (!selectedMaterial || batches.length === 0) {
    return <Navigate to="/inventory/raw-material/intake" replace />;
  }

  const targetQty = Number(formData.quantity_received) || 0;
  const baseAmount = targetQty * (Number(formData.price_per_kg) || 0);
  const gstAmount = baseAmount * ((Number(formData.gst_percent) || 0) / 100);
  const totalAmount = baseAmount + gstAmount;

  const isPackaging = selectedMaterial.category?.toLowerCase().includes('packaging') || 
                      selectedMaterial.id?.startsWith('pack-') || 
                      ['Bottle', 'Cap', 'Blue Brand Sticker', 'Yellow Brand Sticker', 'Pink Brand Sticker', 'Sponge Brand Sticker', 'WAD Seal', 'Shrink Wrap', 'Bubble Wrap', '1B Carton Box', '2B Carton Box', '3B Carton Box', '4B Carton Box', '6B Carton Box', 'Transparent Tape', 'Address Rolls', 'Barcode Sticker', 'Barcode Roll', 'Ink Roll'].includes(selectedMaterial.name);

  const getPackagingCodePrefix = (matName: string) => {
    const n = matName.toLowerCase();
    if (n.includes('bottle')) return 'PKG-BTL';
    if (n.includes('cap')) return 'PKG-CAP';
    if (n.includes('transparent tape') || n.includes('tape')) return 'PKG-TAPE';
    if (n.includes('address roll') || n.includes('address')) return 'PKG-ADDR';
    if (n.includes('barcode sticker') || n.includes('barcode roll')) return 'PKG-BSTK';
    if (n.includes('ink roll') || n.includes('ink')) return 'PKG-INK';
    if (n.includes('sticker')) return 'PKG-BST';
    if (n.includes('wad')) return 'PKG-WAD';
    if (n.includes('shrink')) return 'PKG-SHR';
    if (n.includes('bubble')) return 'PKG-BUB';
    if (n.includes('1b carton')) return 'PKG-1BBOX';
    if (n.includes('2b carton')) return 'PKG-2BBOX';
    if (n.includes('3b carton')) return 'PKG-3BBOX';
    if (n.includes('4b carton')) return 'PKG-4BBOX';
    if (n.includes('6b carton')) return 'PKG-6BBOX';
    if (n.includes('carton')) return 'PKG-BOX';
    return 'PKG-MAT';
  };

  const dateYYMMDD = new Date().toISOString().slice(2,10).replace(/-/g,'');

  const previewBatches = batches.map(b => {
    let serialNumber = (b as any).serialNumber;
    if (!serialNumber) {
      if (isPackaging) {
        const pkgPrefix = getPackagingCodePrefix(selectedMaterial.name);
        serialNumber = `${pkgPrefix}-${dateYYMMDD}-${String(b.batch_no || 1).padStart(3, '0')}`;
      } else {
        const productCode = selectedMaterial.name.substring(0, 4).toUpperCase();
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        serialNumber = `${productCode}-${b.quantity}-${randomCode}`;
      }
    }
    return { ...b, serialNumber };
  });

  const handleSaveBarcode = async () => {
    if (isSaving) return;

    // 1. Safe numeric parsers and validations
    const parsedQty = Number(formData.quantity_received);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error("Quantity Received must be a valid number greater than zero.");
      return;
    }

    const parsedPrice = Number(formData.price_per_kg);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Price Per Unit must be a valid non-negative number.");
      return;
    }

    const parsedGst = Number(formData.gst_percent);
    if (isNaN(parsedGst) || parsedGst < 0) {
      toast.error("GST percentage must be a valid non-negative number.");
      return;
    }

    // 2. Trimming text fields
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

    // 3. Date in Supabase-compatible ISO format
    let isoDateReceived = new Date().toISOString();
    if (formData.date_received) {
      try {
        isoDateReceived = new Date(formData.date_received).toISOString();
      } catch (e) {
        console.error("Invalid date format, using current time", e);
      }
    }

    setIsSaving(true);
    try {
      if (isPackaging) {
        const existingPkg = await (inventoryService as any).getPackagingBarcodes();
        const existingSerials = new Set(existingPkg.map((eb: any) => eb.barcode || eb.serial_number));
        const newBatches = previewBatches.filter(b => !existingSerials.has(b.serialNumber));

        if (newBatches.length > 0) {
          const baseAmount = parsedQty * parsedPrice;
          const gstAmount = baseAmount * (parsedGst / 100);
          const totalAmount = baseAmount + gstAmount;

          const inventoryInRecord = {
            packaging_name: selectedMaterial.name,
            packaging_category: selectedMaterial.category || 'Primary Packaging',
            quantity_received: parsedQty,
            vendor_name: trimmedVendor,
            po_reference: trimmedPo,
            price_per_unit: parsedPrice,
            gst_percent: parsedGst,
            base_amount: baseAmount,
            gst_amount: gstAmount,
            total_amount: totalAmount,
            date_received: isoDateReceived,
            notes: trimmedNotes
          };

          const finalBatches = newBatches.map(b => ({
            id: crypto.randomUUID(),
            barcode: b.serialNumber,
            serial_number: b.serialNumber,
            packaging_name: selectedMaterial.name,
            packaging_category: selectedMaterial.category || 'Primary Packaging',
            batch_no: String(b.batch_no || 1),
            vendor: trimmedVendor,
            vendor_name: trimmedVendor,
            po_reference: trimmedPo,
            quantity: Number(b.quantity),
            unit: selectedMaterial.unit || 'PCS',
            price_per_unit: parsedPrice,
            gst_percent: parsedGst,
            scanning_person_name: trimmedPerson,
            notes: trimmedNotes,
            received_date: isoDateReceived,
            created_at: new Date().toISOString(),
            current_stage: 'Incoming'
          }));

          const savedIds = await (inventoryService as any).savePackagingIntake(inventoryInRecord, finalBatches);
          setSavedBatchIds(savedIds as any);
        }
      } else {
        const existingBatches = await inventoryService.getBatches();
        const existingSerials = new Set(existingBatches.map(eb => eb.serial_number));
        
        const newBatches = previewBatches.filter(b => !existingSerials.has(b.serialNumber));
        
        if (newBatches.length > 0) {
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
            date_received: isoDateReceived,
            notes: trimmedNotes
          };

          const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');

          const finalBatches = newBatches.map(b => {
            const productCode = selectedMaterial.name.substring(0, 4).toUpperCase();
            const batchId = `MAT-${dateStr}-${productCode}-${String(b.batch_no).padStart(3, '0')}`;
            const batchValue = Number(b.quantity) * parsedPrice * (1 + (parsedGst / 100));
            const qrDataPayload = b.serialNumber;

            return {
              id: crypto.randomUUID(),
              batch_id: batchId, 
              serial_number: b.serialNumber,
              barcode: b.serialNumber,
              material_id: selectedMaterial.id,
              material_name: selectedMaterial.name,
              batch_no: b.batch_no, 
              quantity: Number(b.quantity), 
              unit: 'kg', 
              vendor: trimmedVendor, 
              vendor_name: trimmedVendor, 
              po_reference: trimmedPo,
              price_per_kg: parsedPrice, 
              gst_percent: parsedGst,
              batch_value: batchValue,
              barcode_data: qrDataPayload,
              status: 'Active',
              inventory_room_saved: false,
              barcode_status: 'Not Scanned',
              scanning_person_name: trimmedPerson,
              scanningPersonName: trimmedPerson,
              notes: trimmedNotes,
              received_date: isoDateReceived,
              date_received: isoDateReceived,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              current_stage: 'Incoming'
            };
          });

          const savedIds = await inventoryService.saveRawMaterialIntake(inventoryInRecord, finalBatches);
          setSavedBatchIds(savedIds as any);
        }
      }
      
      setIsSaved(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
    } catch (err: any) {
      console.error("Save barcode error:", err);
      toast.error(`Failed to save barcode: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReceiveAnother = () => {
    setSelectedMaterial(null);
    setFormData({ quantity_received: '', vendor_name: '', po_reference: '', price_per_kg: '', gst_percent: '18', notes: '', date_received: new Date().toISOString().slice(0,10), scanningPersonName: '' });
    setBatches([]);
    navigate('/inventory/raw-material');
  };

  const downloadQR = (serial: string) => {
    const wrapper = document.getElementById(`barcode-${serial}`);
    const svg = wrapper?.querySelector('svg');
    if (svg) {
      barcodeService.downloadSVG(svg as SVGSVGElement, `Barcode-${serial}.svg`);
    } else if (wrapper) {
      barcodeService.downloadPNG(wrapper, `Barcode-${serial}.png`);
    }
  };

  const handleDownloadAll = () => {
    previewBatches.forEach(b => downloadQR(b.serialNumber));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {showToast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-right-8 duration-300">
          <CheckCircle2 size={24} />
          <div className="flex flex-col">
            <span className="font-bold">Barcodes Saved!</span>
            <span className="text-sm text-emerald-100">Batches successfully recorded to inventory.</span>
          </div>
        </div>
      )}

      <div className="border-b border-border pb-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <QrCode className="text-primary" size={24} />
            Step 3: Generate Barcodes
          </h1>
          <p className="text-muted-foreground mt-2">Print or download labels for the newly split batches.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="h-10 px-4 flex items-center gap-2 bg-surface hover:bg-surface-soft border border-border text-white rounded-lg transition-all"
          >
            <Printer size={16} /> Print All
          </button>
          <button 
            onClick={handleDownloadAll}
            className="h-10 px-4 flex items-center gap-2 bg-surface hover:bg-surface-soft border border-border text-white rounded-lg transition-all"
          >
            <Download size={16} /> Download All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print-grid">
        {previewBatches.map((b) => (
          <div key={b.id} className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-xl print-label transition-transform hover:-translate-y-1 hover:shadow-primary/5">
            <div className="p-6 flex-1 flex flex-col">
              {/* Barcode SVG Container */}
              <div className="bg-white p-4 rounded-xl flex justify-center mb-6 shadow-inner" id={`barcode-${b.serialNumber}`}>
                <Barcode 
                  value={b.serialNumber} 
                  width={1.5}
                  height={50}
                  displayValue={false}
                  margin={0}
                  background="#ffffff"
                  lineColor="#000000"
                />
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-white mb-1 truncate" title={selectedMaterial.name}>
                  {selectedMaterial.name}
                </h3>
                <div className="text-primary font-mono font-bold tracking-wider bg-primary/10 px-3 py-1 rounded-md inline-block">
                  {b.serialNumber}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
                <div className="bg-surface-soft p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Quantity</p>
                  <p className="text-sm font-bold text-white">{b.quantity} KG</p>
                </div>
                <div className="bg-surface-soft p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Batch No</p>
                  <p className="text-sm font-bold text-white">#{b.batch_no}</p>
                </div>
                <div className="bg-surface-soft p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Vendor</p>
                  <p className="text-sm font-bold text-white truncate" title={formData.vendor_name}>{formData.vendor_name}</p>
                </div>
                <div className="bg-surface-soft p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Date</p>
                  <p className="text-sm font-bold text-white">{formData.date_received || new Date().toISOString().slice(0,10)}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-background/50 no-print">
              <button 
                onClick={() => downloadQR(b.serialNumber)}
                className="w-full h-10 flex items-center justify-center gap-2 bg-surface border border-border hover:bg-surface-soft text-white rounded-lg transition-all text-sm font-medium"
              >
                <Download size={16} /> Download Label
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-border">
        {!isSaved ? (
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <button 
                onClick={() => navigate('/inventory/dashboard')}
                className="h-11 px-4 text-sm bg-transparent hover:bg-surface border border-border text-gray-300 font-medium rounded-lg transition-all"
              >
                Home
              </button>
              <button 
                onClick={() => navigate('/inventory/raw-material/intake/split-batches')}
                className="h-11 px-4 text-sm bg-transparent hover:bg-surface border border-border text-gray-300 font-medium rounded-lg transition-all"
              >
                Back
              </button>
            </div>
            <button 
              onClick={handleSaveBarcode}
              disabled={isSaving}
              className="h-11 px-8 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : 'Save Barcode'}
            </button>
          </div>
        ) : (
          <div className="flex justify-center items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={handleReceiveAnother}
              className="h-12 px-6 flex items-center gap-2 bg-surface hover:bg-surface-soft border border-border text-white font-medium rounded-xl transition-all"
            >
              <Package size={18} /> Receive Another Material
            </button>
            {/* Requirement 2: Navigate to /inventory/view-barcode/list */}
            <button 
              onClick={() => navigate('/inventory/view-barcode/list')}
              className="h-12 px-8 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-900/20 transition-all"
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
