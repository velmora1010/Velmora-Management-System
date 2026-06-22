import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useIntakeContext } from './IntakeContext';
import Barcode from 'react-barcode';
import { Printer, Download, Save, CheckCircle2, QrCode, Package } from 'lucide-react';
import { inventoryService } from '../../../../services/inventoryService';
import toast from 'react-hot-toast';

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

  const productCode = selectedMaterial.name.substring(0, 4).toUpperCase();
  
  const previewBatches = batches.map(b => {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const serialNumber = (b as any).serialNumber || `${productCode}-${b.quantity}-${randomCode}`;
    return { ...b, serialNumber };
  });

  const handleSaveBarcode = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const existingBatches = await inventoryService.getBatches();
      const existingSerials = new Set(existingBatches.map(eb => eb.serial_number));
      
      const newBatches = previewBatches.filter(b => !existingSerials.has(b.serialNumber));
      
      if (newBatches.length > 0) {
        const inventoryInRecord = {
          material_id: selectedMaterial.id, 
          material_name: selectedMaterial.name,
          quantity_received: targetQty,
          vendor_name: formData.vendor_name, 
          po_reference: formData.po_reference,
          price_per_kg: Number(formData.price_per_kg), 
          gst_percent: Number(formData.gst_percent),
          base_amount: baseAmount, 
          gst_amount: gstAmount, 
          total_amount: totalAmount,
          date_received: formData.date_received || new Date().toISOString(),
          notes: formData.notes
        };

        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');

        const finalBatches = newBatches.map(b => {
          const batchId = `MAT-${dateStr}-${productCode}-${String(b.batch_no).padStart(3, '0')}`;
          const batchValue = b.quantity * Number(formData.price_per_kg) * (1 + (Number(formData.gst_percent)/100));
          const qrDataPayload = b.serialNumber;

          if (!selectedMaterial.name || !batchId || !qrDataPayload || b.quantity == null || !formData.vendor_name) {
            throw new Error("Missing required fields for batch generation.");
          }

          return {
            batch_id: batchId, 
            serial_number: b.serialNumber,
            material_id: selectedMaterial.id,
            material_name: selectedMaterial.name,
            batch_number: b.batch_no, 
            original_quantity: b.quantity, 
            available_quantity: b.quantity,
            vendor_name: formData.vendor_name, 
            po_reference: formData.po_reference,
            price_per_kg: Number(formData.price_per_kg), 
            gst_percent: Number(formData.gst_percent),
            batch_value: batchValue,
            barcode_data: qrDataPayload,
            status: 'Active',
            inventory_room_saved: false,
            barcode_status: 'Not Scanned',
            scanningPersonName: formData.scanningPersonName
          };
        });

        const savedIds = await inventoryService.saveRawMaterialIntake(inventoryInRecord, finalBatches);
        setSavedBatchIds(savedIds as any);
      }
      
      setIsSaved(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
    } catch (err: any) {
      console.error("Save barcode local error:", err);
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
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const downloadLink = document.createElement('a');
      downloadLink.download = `Barcode-${serial}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
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
