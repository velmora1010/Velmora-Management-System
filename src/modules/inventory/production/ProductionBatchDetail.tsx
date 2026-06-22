import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle2, PackagePlus, Boxes, ArrowLeft, Package, Check, X, AlertTriangle, Activity, ArrowRight, Barcode } from 'lucide-react';
import ReactBarcode from 'react-barcode';
import { inventoryService } from '../../../services/inventoryService';
import { calculateRequiredIngredients } from '../../../config/productFormulas';
import { motion, AnimatePresence } from 'framer-motion';
import { getProductDisplayName, getProductSubtext, getProductTheme } from './productHelpers';
import toast from 'react-hot-toast';


const normalizeMaterialKey = (name: string) => String(name || "").trim().toLowerCase();

const ProductionBatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanningIngredient, setScanningIngredient] = useState<any>(null);
  const [scanSerialInput, setScanSerialInput] = useState('');
  
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failingMicroBatch, setFailingMicroBatch] = useState<any>(null);
  const [failReason, setFailReason] = useState('Quality issue');
  const [producedBy, setProducedBy] = useState('');

  const [pendingBarcodeMB, setPendingBarcodeMB] = useState<any>(null);
  const [pendingBarcodesList, setPendingBarcodesList] = useState<{ no: string, scanned: boolean }[]>([]);
  const [forceShowMicroBatches, setForceShowMicroBatches] = useState(false);
  const [productionBatch, setProductionBatch] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [microBatches, setMicroBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productionStock, setProductionStock] = useState<any>({});

  const [isRestoring, setIsRestoring] = useState(false);

  

  const fetchData = useCallback(async () => {
    try {
      const allBatches = await inventoryService.getProductionBatches();
      const batch = allBatches.find(b => b.id === id);
      setProductionBatch(batch || null);
      
      if (batch) {
        const prodBatchId = batch.id;
        const [ings, mbs, prodStock] = await Promise.all([
          inventoryService.getProductionIngredients(prodBatchId),
          inventoryService.getMicroBatches(prodBatchId),
          inventoryService.getProductionMaterialStock()
        ]);

        const allBarcodes = await inventoryService.getProductBarcodes();
        const verifiedMbs = [];
        
        for (const mb of mbs) {
          let updatedMb = { ...mb };
          if (mb.status === 'Barcode Saved' || mb.status === 'Passed') {
             const existingForMB = allBarcodes.filter((b: any) => 
               (b.batchId === prodBatchId || b.productId === prodBatchId) && b.microBatchNo === mb.micro_batch_no
             );
             
             if (existingForMB.length < mb.units) {
               updatedMb.status = 'Passed';
               if (mb.status !== 'Passed') {
                 await inventoryService.updateMicroBatch(mb.id, { status: 'Passed' });
               }
             } else {
               updatedMb.status = 'Barcode Saved';
               if (mb.status !== 'Barcode Saved') {
                 await inventoryService.updateMicroBatch(mb.id, { status: 'Barcode Saved' });
               }
             }
          }
          verifiedMbs.push(updatedMb);
        }

        setIngredients(ings);
        setMicroBatches(verifiedMbs);
        setProductionStock(prodStock);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-restore ingredients if missing
  useEffect(() => {
    const restoreIngredients = async () => {
      if (!loading && ingredients.length === 0 && productionBatch && !isRestoring) {
        setIsRestoring(true);
        try {
          const { PRODUCTS } = await import('../../../config/productFormulas');
          const product = PRODUCTS.find(p => p.name === productionBatch.product_name);
          
          if (product) {
            const reqIngs = calculateRequiredIngredients(product.id, productionBatch.total_units);
            if (reqIngs) {
              const records = reqIngs.map((ing: any) => ({
                id: crypto.randomUUID(),
                production_batch_id: productionBatch.id,
                material_name: ing.name,
                required_quantity: ing.required_quantity,
                available_quantity_at_start: 0,
                scanned_quantity: 0,
                status: 'Pending'
              }));
              await inventoryService.saveProductionIngredients(records);
              await fetchData();
            }
          }
        } catch (err) {
          console.error("Auto-restore failed:", err);
        } finally {
          setIsRestoring(false);
        }
      }
    };
    restoreIngredients();
  }, [loading, ingredients.length, productionBatch, isRestoring, fetchData]);

  const handleToggleIngredient = async (ing: any) => {
    const newStatus = ing.status === 'Ready' ? 'Pending' : 'Ready';
    await inventoryService.updateProductionIngredient(ing.id, { status: newStatus });
    await fetchData();
  };

  const handleScanRawMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanningIngredient || !productionBatch) return;

    const allBatches = await inventoryService.getBatches();
    const rawBatch = allBatches.find(b => b.serial_number === scanSerialInput);
    
    if (!rawBatch) {
      toast.error('Error: Batch not found for this serial number.');
      return;
    }

    if (!rawBatch.inventory_room_saved || (rawBatch.barcode_status !== 'Scanned' && rawBatch.status !== 'Scanned') || !rawBatch.scanned_at) {
      toast.error('Error: Material is not available in Inventory Room. Scan barcode first.');
      return;
    }

    if (rawBatch.material_name !== scanningIngredient.material_name) {
      toast.error(`Error: Scanned batch is ${rawBatch.material_name}, but ${scanningIngredient.material_name} is required.`);
      return;
    }

    const requiredLeft = scanningIngredient.required_quantity - scanningIngredient.scanned_quantity;
    
    if (rawBatch.available_quantity <= 0) {
      toast.error('Error: This raw material batch is empty.');
      return;
    }

    const deductQty = Math.min(requiredLeft, rawBatch.available_quantity);
    const newAvailable = rawBatch.available_quantity - deductQty;

    await inventoryService.updateBatch(rawBatch.id, {
      available_quantity: newAvailable,
      status: newAvailable <= 0 ? 'Depleted' : newAvailable < (rawBatch.original_quantity * 0.2) ? 'Low Stock' : 'Active'
    });

    await inventoryService.saveRawMaterialIssue({
      production_batch_id: productionBatch.production_batch_id,
      raw_material_batch_id: rawBatch.serial_number,
      material_name: rawBatch.material_name,
      quantity_issued: deductQty
    });

    const newScanned = scanningIngredient.scanned_quantity + deductQty;
    await inventoryService.updateProductionIngredient(scanningIngredient.id, {
      scanned_quantity: newScanned,
      status: newScanned >= scanningIngredient.required_quantity ? 'Ready' : 'Pending'
    });

    await fetchData();
    setScanSerialInput('');
    if (newScanned >= scanningIngredient.required_quantity) {
      setScanModalOpen(false);
      setScanningIngredient(null);
    } else {
      toast.error(`Partial scan accepted. ${deductQty} KG deducted. Still need ${(scanningIngredient.required_quantity - newScanned).toFixed(2)} KG.`);
    }
  };

  const handleStartMicroBatches = async () => {
    if (!productionBatch) return;

    if (ingredients.length === 0) {
      toast.success("No ingredients found, but micro batch stage started.");
    }

    setForceShowMicroBatches(true);

    try {
      await inventoryService.deductFromProductionMaterialStock(ingredients);
      
      if (microBatches.length === 0 && productionBatch.total_micro_batches > 0) {
        const unitsPerBatch = Math.floor(productionBatch.total_units / productionBatch.total_micro_batches);
        const newMicroBatches = Array.from({ length: productionBatch.total_micro_batches }, (_, i) => ({
          id: crypto.randomUUID(),
          production_batch_id: productionBatch.id,
          micro_batch_no: i + 1,
          units: unitsPerBatch,
          status: 'Waiting'
        }));

        await inventoryService.saveMicroBatches(newMicroBatches);
      }

      await inventoryService.updateProductionBatch(productionBatch.id, { status: 'In Progress' });

      await fetchData();
    } catch (error: any) {
      console.error("Start Micro Batches failed:", error);
      toast.error(error.message || "Failed to start micro batches");
    }
  };

  const handlePassQCClick = async (mb: any) => {
    if (mb.status === 'Waiting') {
      if (!producedBy.trim()) {
        toast.error('Please enter Produced By name before passing this micro batch.');
        return;
      }
      
      try {
        await inventoryService.updateMicroBatch(mb.id, {
          status: 'Passed',
          producedBy: producedBy,
          producedAt: new Date().toISOString()
        });
        
        mb.status = 'Passed';
        mb.producedBy = producedBy;
        mb.producedAt = new Date().toISOString();
        
        await fetchData();
        setProducedBy('');
      } catch (err) {
        toast.error('Failed to pass microbatch');
        return;
      }
    }

    setPendingBarcodeMB(mb);
    if (productionBatch) {
      const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,'');
      
      const list = [];
      for (let i = 1; i <= mb.units; i++) {
        const serial = i.toString().padStart(3, '0');
        list.push({
          no: `PROD-${productCode}-MB${mb.micro_batch_no}-${dateStr}-${serial}`,
          scanned: false
        });
      }
      setPendingBarcodesList(list);
    }
  };

  const handleCancelBarcode = () => {
    setPendingBarcodeMB(null);
    setPendingBarcodesList([]);
  };

  const handleSaveBarcode = async (mb: any) => {
    if (!productionBatch) return;

    const productCode = getProductDisplayName(productionBatch.product_name) || 'XX';
    const finalBarcodes = pendingBarcodesList.map((b: any) => ({
      id: crypto.randomUUID(),
      type: 'PRODUCT',
      productId: productionBatch.id,
      batchId: productionBatch.id,
      productName: productionBatch.product_name,
      productCode: productCode,
      microBatchNo: mb.micro_batch_no,
      barcodeNumber: b.no,
      barcode_no: b.no, 
      displayBarcode: b.no,
      barcode: b.no,
      code: b.no,
      currentStage: 'READY_FOR_FIRST_SCAN',
      quantity: 1,
      unit: 'Unit',
      status: 'NOT_SCANNED', 
      scan_status: 'NOT_SCANNED', 
      comboReady: false,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      scannedAt: null,
      addedToComboAt: null,
      producedBy: mb.producedBy,
      producedAt: mb.producedAt
    }));
    
    try {
      await (inventoryService as any).saveProductBarcodes(finalBarcodes);

      // --- Generate and save master QC barcode ---
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g,'');
      const last4BatchId = String(productionBatch.id).slice(-4);
      const qcBarcodeNo = `QC-${productCode}-MB${mb.micro_batch_no}-${dateStr}-${last4BatchId}`;
      
      const qcRecord = {
        id: crypto.randomUUID(),
        qcBarcode: qcBarcodeNo,
        displayBarcode: qcBarcodeNo,
        barcodeNumber: qcBarcodeNo,
        productName: productionBatch.product_name,
        productCode: productCode,
        batchId: productionBatch.id,
        microBatchNo: mb.micro_batch_no,
        totalUnits: finalBarcodes.length,
        productBarcodes: finalBarcodes.map((b: any) => b.barcodeNumber),
        producedBy: mb.producedBy,
        labeledBy: localStorage.getItem('current_user') || 'Warehouse Admin',
        createdAt: new Date().toISOString(),
        currentStage: 'READY_FOR_QC_IN'
      };

      const savedQC = await (inventoryService as any).addQCBarcode(qcRecord);
      const isQCDuplicate = savedQC?.isDuplicate;
      // -------------------------------------------
      
      const checkAll = await inventoryService.getProductBarcodes();
      const existingForMB = checkAll.filter((item: any) => 
        (item.batchId === productionBatch.id || item.productId === productionBatch.id) && item.microBatchNo === mb.micro_batch_no
      );

      if (existingForMB.length < finalBarcodes.length) {
        toast.error('Barcode save failed. Please try again.');
        return;
      }

      for (const b of finalBarcodes) {
        await inventoryService.createInventoryTransaction({
          barcodeNumber: b.barcodeNumber,
          itemType: 'PRODUCT',
          itemName: b.productName,
          productId: b.productId,
          quantity: 1,
          unit: 'Unit',
          fromLocation: 'PRODUCTION_CONSUMED',
          toLocation: 'PRODUCT',
          transactionType: 'IN',
          referenceType: 'MICRO_BATCH',
          referenceId: mb.id,
        });
      }

      await inventoryService.updateMicroBatch(mb.id, {
        status: 'Barcode Saved',
      });

      if (isQCDuplicate) {
        toast.success('Product barcodes saved. QC barcode already exists.');
      } else {
        toast.success(`${finalBarcodes.length} product barcodes & 1 master QC barcode saved successfully`);
      }

      setPendingBarcodeMB(null);
      setPendingBarcodesList([]);
      
      fetchData(); 
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save barcodes");
    }
  };

  

  const handleFailMicroBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingMicroBatch || !productionBatch) return;

    await inventoryService.updateMicroBatch(failingMicroBatch.id, {
      status: 'Failed',
      failure_reason: failReason,
      completed_at: new Date().toISOString()
    });

    const completedCount = productionBatch.completed_micro_batches + 1;
    await inventoryService.updateProductionBatch(productionBatch.id, {
      completed_micro_batches: completedCount
    });

    await fetchData();
    setFailModalOpen(false);
    setFailingMicroBatch(null);
  };

  const handleFinishProduction = async () => {
    if (!productionBatch) return;
    await inventoryService.updateProductionBatch(productionBatch.id, { status: 'Saved' });
    await fetchData();
  };

  if (!productionBatch) return <div style={{ padding: '48px', textAlign: 'center' }}>Loading...</div>;

  const checkedIngredientsCount = ingredients?.filter((i: any) => {
    const avail = productionStock[normalizeMaterialKey(i.material_name)]?.availableKg || 0;
    return avail >= i.required_quantity;
  }).length || 0;
  const allIngredientsPrepared = ingredients && ingredients.length > 0 && checkedIngredientsCount === ingredients.length;

  let progress = 0;
  if (productionBatch.status === 'Prep') {
    progress = ingredients.length > 0 ? Math.round((checkedIngredientsCount / ingredients.length) * 100) : 0;
  } else {
    progress = productionBatch.total_micro_batches > 0 ? Math.round((productionBatch.completed_micro_batches / productionBatch.total_micro_batches) * 100) : 0;
  }

  const isFullyComplete = productionBatch.status === 'Complete';

  const showMicroBatches = forceShowMicroBatches || productionBatch.status === 'In Progress' || productionBatch.status === 'Complete';

  const passedCount = microBatches.filter(m => m.status === 'Passed' || m.status === 'Barcode Saved').length;
  const failedCount = microBatches.filter(m => m.status === 'Failed').length;
  const waitingCount = microBatches.filter(m => m.status === 'Waiting').length;
  const totalMB = microBatches.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-container" 
      style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '64px' }}
    >
      <button 
        className="btn btn-secondary hover-lift" 
        style={{ marginBottom: '24px', padding: '8px 16px', fontSize: '14px', height: 'auto', borderRadius: '12px', background: 'var(--surface-soft)', color: 'var(--text-primary)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '8px' }} 
        onClick={() => navigate('/inventory/production')}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* HEADER CARD */}
      <div className="page-card" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden', background: '#111827', borderRadius: '24px', border: '1px solid #263244', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: isFullyComplete ? '#10b981' : productionBatch.status === 'Prep' ? '#f59e0b' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
        
        <div style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: `linear-gradient(135deg, ${getProductTheme(productionBatch.product_name).color}, ${getProductTheme(productionBatch.product_name).border})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              <Package size={32} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', color: 'white', fontWeight: 800 }}>{getProductDisplayName(productionBatch.product_name)} <span style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{getProductSubtext(productionBatch.product_name)}</span></h1>
                <span style={{ 
                  fontSize: '11px', fontWeight: 'bold', padding: '4px 12px', borderRadius: '20px',
                  background: isFullyComplete ? 'rgba(16, 185, 129, 0.1)' : productionBatch.status === 'Prep' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                  color: isFullyComplete ? '#10b981' : productionBatch.status === 'Prep' ? '#f59e0b' : '#60a5fa', 
                  textTransform: 'uppercase', border: `1px solid ${isFullyComplete ? 'rgba(16, 185, 129, 0.2)' : productionBatch.status === 'Prep' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                }}>
                  {productionBatch.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '14px', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <QrCode size={16} /> ID: <span style={{ color: 'white', fontWeight: 600 }}>{productionBatch.production_batch_id}</span>
                </span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#475569' }} />
                <span><strong style={{ color: 'white' }}>{productionBatch.total_units}</strong> Total Units</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#475569' }} />
                <span>Created {new Date(productionBatch.created_at || '').toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.5px' }}>Overall Progress</div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: 'white', lineHeight: '1' }}>{progress}<span style={{ fontSize: '20px', color: 'var(--text-muted)', fontWeight: 600 }}>%</span></div>
          </div>
        </div>

        {/* PROGRESS KPI STRIP */}
        <div style={{ background: '#0b1120', padding: '20px 32px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: isFullyComplete ? '#10b981' : 'linear-gradient(to right, #3b82f6, #8b5cf6)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Produced Units</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{productionBatch.produced_units} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {productionBatch.total_units}</span></div>
              </div>
              <div style={{ width: '1px', background: '#263244' }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Inventory Ready</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{productionBatch.inventory_units}</div>
              </div>
              <div style={{ width: '1px', background: '#263244' }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Micro Batches</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{productionBatch.completed_micro_batches} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {productionBatch.total_micro_batches}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ERROR STATES */}
      {!loading && ingredients.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(220, 38, 38, 0.1)', color: '#ef4444', borderRadius: '16px', border: '1px dashed rgba(220, 38, 38, 0.3)', marginBottom: '24px' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontWeight: 600, fontSize: '16px' }}>Ingredients not found. Please recreate this batch.</div>
        </div>
      )}
      
      {isRestoring && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: '#111827', borderRadius: '16px', border: '1px dashed #263244', marginBottom: '24px' }}>
          <Activity size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
          Loading and restoring ingredients...
        </div>
      )}

      {/* PRODUCTION COMPLETE UI */}
      {isFullyComplete && (
        <>
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="page-card" 
            style={{ marginBottom: '24px', textAlign: 'center', padding: '48px 20px', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, #111827 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '24px' }}
          >
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '2px solid rgba(16, 185, 129, 0.4)' }}>
              <Check size={40} strokeWidth={3} />
            </div>
            <h2 style={{ fontSize: '32px', margin: '0 0 12px 0', color: 'white', fontWeight: 800 }}>Production Complete</h2>
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
              All <strong style={{ color: 'white' }}>{productionBatch.total_units}</strong> units have passed quality control and are ready for labeling and inventory transfer.
            </p>
          </motion.div>


          
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button 
              className="btn hover-lift" 
              style={{ padding: '16px 48px', fontSize: '18px', background: 'white', color: 'black', border: 'none', borderRadius: '16px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '12px' }} 
              onClick={handleFinishProduction}
            >
              <Boxes size={20} /> Save Finished Goods to Inventory Room
            </button>
          </div>
        </>
      )}

      {/* FINAL SAVED SUCCESS UI */}
      {productionBatch.status === 'Saved' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="page-card" 
          style={{ textAlign: 'center', padding: '64px 20px', marginTop: '24px', background: '#111827', borderRadius: '24px', border: '1px solid #10b981' }}
        >
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 style={{ fontSize: '32px', margin: '0 0 16px 0', color: 'white', fontWeight: 800 }}>Production Saved Successfully!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '48px', fontSize: '16px', maxWidth: '500px', margin: '0 auto 48px auto' }}>
            The finished goods have been securely logged. You can now view this stock in the Inventory Room.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn hover-lift" onClick={() => navigate('/inventory/inventory-room')} style={{ padding: '14px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Boxes size={18} /> Go to Inventory Room
            </button>
            <button className="btn hover-lift" onClick={() => navigate('/inventory/production/new')} style={{ padding: '14px 28px', background: 'var(--surface-soft)', color: 'white', border: '1px solid #334155', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackagePlus size={18} /> Create Another Batch
            </button>
          </div>
        </motion.div>
      )}

      {/* STAGE 1: PREPARATION */}
      {!isFullyComplete && productionBatch.status !== 'Saved' && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: showMicroBatches ? '#1e293b' : 'linear-gradient(135deg, #f97316, #ea580c)', color: showMicroBatches ? '#64748b' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>1</span>
                Prepare Ingredients
              </h2>
            </div>
            <div style={{ background: '#111827', padding: '6px 16px', borderRadius: '16px', border: '1px solid #263244', fontSize: '13px', fontWeight: 600, color: allIngredientsPrepared ? '#10b981' : 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {allIngredientsPrepared && <CheckCircle2 size={16} color="#10b981" />}
              {checkedIngredientsCount} / {ingredients.length} Ready
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '24px' }}>
            {ingredients.map((ing: any) => {
              const avail = productionStock[normalizeMaterialKey(ing.material_name)]?.availableKg || 0;
              const isReady = avail >= ing.required_quantity;
              return (
                <div key={ing.id} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', 
                  background: isReady ? 'rgba(16, 185, 129, 0.05)' : '#111827', 
                  border: `1px solid ${isReady ? 'rgba(16, 185, 129, 0.3)' : '#263244'}`, 
                  borderRadius: '16px', 
                  opacity: showMicroBatches ? 0.6 : 1,
                  transition: 'all 0.2s',
                  pointerEvents: showMicroBatches ? 'none' : 'auto'
                }}>
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', flex: 1 }}
                    onClick={() => { if (!showMicroBatches) handleToggleIngredient(ing); }}
                  >
                    <div style={{ 
                      width: '28px', height: '28px', borderRadius: '8px', 
                      background: isReady ? '#10b981' : '#1e293b', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                      border: `1px solid ${isReady ? '#10b981' : '#334155'}`
                    }}>
                      {isReady && <Check size={18} strokeWidth={3} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '16px', color: isReady ? 'white' : 'var(--text-primary)', marginBottom: '4px' }}>{ing.material_name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Required: <strong style={{ color: isReady ? '#10b981' : 'white' }}>{ing.required_quantity} KG</strong> | Available: <strong style={{ color: isReady ? '#10b981' : '#ef4444' }}>{avail} KG</strong></div>
                    </div>
                  </div>
                  
                </div>
              );
            })}
          </div>

          {!showMicroBatches && allIngredientsPrepared && ingredients.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}
            >
              <button 
                type="button"
                className="btn hover-lift" 
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', padding: '16px 40px', borderRadius: '16px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 8px 20px rgba(249, 115, 22, 0.3)' }}
                onClick={(e) => {
                  e.preventDefault();
                  handleStartMicroBatches();
                }}
              >
                Start Micro Batches <ArrowRight size={20} />
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* STAGE 2: MICRO BATCHES EXECUTION */}
      {!isFullyComplete && productionBatch.status !== 'Saved' && showMicroBatches && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>2</span>
              Micro Batches Execution
            </h2>
          </div>

          {/* SUMMARY CARDS */}
          <div className="grid grid-4" style={{ gap: '16px', marginBottom: '32px' }}>
            <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #263244' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Total</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{totalMB}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#10b981', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Passed</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{passedCount}</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#ef4444', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Failed</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{failedCount}</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Waiting</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{waitingCount}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {microBatches.sort((a,b) => a.micro_batch_no - b.micro_batch_no).map((mb, index) => {
              const isPrevCompleted = index === 0 || microBatches.find(m => m.micro_batch_no === mb.micro_batch_no - 1)?.status !== 'Waiting';
              const isCurrent = isPrevCompleted && mb.status === 'Waiting';

              return (
                <div 
                  key={mb.id} 
                  style={{ 
                    background: isCurrent ? '#1e293b' : '#111827', 
                    border: `1px solid ${isCurrent ? '#3b82f6' : '#263244'}`,
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    boxShadow: isCurrent ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                    transition: 'all 0.2s',
                    opacity: (!isCurrent && mb.status === 'Waiting') ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: isCurrent ? '#3b82f6' : '#1e293b', color: isCurrent ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}>
                      MB{mb.micro_batch_no}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>Quantity</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{mb.units} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#64748b' }}>units</span></div>
                    </div>
                    {(mb.producedBy || mb.producedAt) && (
                      <div style={{ marginLeft: '16px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Produced By: <span style={{color: 'white', fontWeight: 'bold'}}>{mb.producedBy}</span></div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {mb.status === 'Waiting' && !isCurrent && (
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, padding: '6px 12px', borderRadius: '12px', background: '#0f172a' }}>Waiting for previous</span>
                    )}

                    {mb.status === 'Barcode Saved' && (
                      <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600, padding: '6px 12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={14} /> Barcode Saved
                      </span>
                    )}

                    {mb.status === 'Passed' && pendingBarcodeMB?.id !== mb.id && (
                      <button 
                        className="btn hover-lift" 
                        style={{ padding: '8px 16px', borderRadius: '8px', background: '#f59e0b', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                        onClick={() => handlePassQCClick(mb)}
                      >
                        <Barcode size={16} /> Save Barcode
                      </button>
                    )}
                    
                    {mb.status === 'Waiting' && isCurrent && pendingBarcodeMB?.id !== mb.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Labeled By <span style={{color: '#ef4444'}}>*</span></label>
                          <input 
                            type="text"
                            placeholder="Name"
                            value={producedBy}
                            onChange={e => setProducedBy(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '13px', width: '150px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '10px 24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                            onClick={() => { setFailingMicroBatch(mb); setFailModalOpen(true); }}
                          >
                            <X size={16} /> Fail
                          </button>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '10px 24px', borderRadius: '10px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }} 
                            onClick={() => handlePassQCClick(mb)}
                          >
                            <Check size={16} strokeWidth={3} /> Pass
                          </button>
                        </div>
                      </div>
                    )}

                    {pendingBarcodeMB?.id === mb.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch', width: '100%', marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>Barcode Ready - Review and Save</span>
                        </div>
                        
                        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #1e293b' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pendingBarcodesList.map((bc, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ background: 'white', padding: '4px', borderRadius: '4px' }}>
                                    <ReactBarcode value={bc.no} width={1} height={20} fontSize={10} margin={0} displayValue={false} />
                                  </div>
                                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'white' }}>{bc.no}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>PENDING</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} 
                            onClick={handleCancelBarcode}
                          >
                            Cancel
                          </button>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                            onClick={() => handleSaveBarcode(mb)}
                          >
                            <CheckCircle2 size={16} /> Save Barcode
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button 
              className="btn hover-lift"
              onClick={() => navigate('/inventory/view-barcode/list', { state: { activeTab: 'PRODUCT' } })}
              style={{ padding: '12px 24px', borderRadius: '12px', background: '#3b82f6', color: 'white', fontWeight: 600, border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
            >
              <Barcode size={18} /> View Product Barcode
            </button>
          </div>
        </motion.div>
      )}


      {/* SCAN INGREDIENT MODAL */}
      <AnimatePresence>
      {scanModalOpen && scanningIngredient && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay" 
          onClick={() => setScanModalOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="modal-content" 
            style={{ width: '400px', background: '#111827', border: '1px solid #263244', borderRadius: '24px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><QrCode size={20} color="#3b82f6" /> Scan Material</h2>
              <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }} onClick={() => setScanModalOpen(false)}>&times;</button>
            </div>
            <div style={{ marginBottom: '24px', background: '#0b1120', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Required Material</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '4px 0 8px 0' }}>{scanningIngredient.material_name}</div>
              <div style={{ fontSize: '13px', color: '#e2e8f0' }}>Pending: <strong style={{ color: '#ef4444', fontSize: '15px' }}>{(scanningIngredient.required_quantity - scanningIngredient.scanned_quantity).toFixed(2)} KG</strong></div>
            </div>
            <form onSubmit={handleScanRawMaterialSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Scan Barcode</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="Scan or enter ID..."
                  value={scanSerialInput} 
                  onChange={e => setScanSerialInput(e.target.value)} 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '16px', outline: 'none' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn hover-lift" style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} onClick={() => setScanModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn hover-lift" style={{ padding: '12px 24px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600 }}>Verify & Deduct</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* FAIL MICRO BATCH MODAL */}
      <AnimatePresence>
      {failModalOpen && failingMicroBatch && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay" 
          onClick={() => setFailModalOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="modal-content" 
            style={{ width: '400px', background: '#111827', border: '1px solid #263244', borderRadius: '24px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ color: '#ef4444', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><AlertTriangle size={20} /> Fail MB{failingMicroBatch.micro_batch_no}</h2>
              <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }} onClick={() => setFailModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleFailMicroBatchSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Select Reason</label>
                <select 
                  value={failReason} 
                  onChange={e => setFailReason(e.target.value)} 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }}
                >
                  <option>Quality issue</option>
                  <option>Wrong mixture</option>
                  <option>Packing issue</option>
                  <option>Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn hover-lift" style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} onClick={() => setFailModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn hover-lift" style={{ padding: '12px 24px', borderRadius: '12px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 600 }}>Confirm Fail</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* BARCODE MODAL */}
      

    </motion.div>
    </>
  );
};

export default ProductionBatchDetail;
