import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, CheckCircle2, PackageSearch, Package, ArrowLeft, ShieldCheck, Trash2, Plus, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BarcodeComponent from 'react-barcode';

// @ts-ignore
import { inventoryService } from '../../../services/inventoryService';
import { departmentService } from '../../../services/departmentService';
import { supabase } from '../../../lib/supabase';
import { barcodeService } from '../../../services/barcodeService';

const normalizeCode = (code: any) => String(code || '').trim().toUpperCase().replace(/\s+/g, '');

export const QCBarcodeList = () => {
  const navigate = useNavigate();
  const [qcBarcodes, setQCBarcodes] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'IN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [scannedCode, setScannedCode] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [confirmScanModal, setConfirmScanModal] = useState<{ open: boolean; barcode: any; scanAction: string }>({ open: false, barcode: null, scanAction: '' });
  const [scanModal, setScanModal] = useState<{ open: boolean; barcode: any; type: string; message?: string }>({ open: false, barcode: null, type: '' });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; barcode: any }>({ open: false, barcode: null });

  const [detailsModalKey, setDetailsModalKey] = useState(0);
  const [selectedQC, setSelectedQC] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Department & Section states
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');

  // Manual Add Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addQCBarcode, setAddQCBarcode] = useState('');
  const [addProductName, setAddProductName] = useState('');
  const [addProductCode, setAddProductCode] = useState('');
  const [addBatchId, setAddBatchId] = useState('');
  const [addMicroBatchNo, setAddMicroBatchNo] = useState(1);
  const [addTotalUnits, setAddTotalUnits] = useState(30);
  const [addProducedBy, setAddProducedBy] = useState('');
  const [addDeptId, setAddDeptId] = useState('');
  const [addSectionId, setAddSectionId] = useState('');

  // Manual Edit Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState('');
  const [editQCBarcode, setEditQCBarcode] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editProductCode, setEditProductCode] = useState('');
  const [editBatchId, setEditBatchId] = useState('');
  const [editMicroBatchNo, setEditMicroBatchNo] = useState(1);
  const [editTotalUnits, setEditTotalUnits] = useState(30);
  const [editProducedBy, setEditProducedBy] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editSectionsList, setEditSectionsList] = useState<any[]>([]);

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedQC(null);
    setScannedCode("");
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };
  
  const getDeptName = (id: string | null) => {
    if (!id) return '-';
    const match = departments.find(d => String(d.id) === String(id));
    return match ? match.department_name : String(id);
  };

  const getSectionName = (id: string | null) => {
    if (!id) return '-';
    const match = sections.find(s => String(s.id) === String(id));
    return match ? match.section_name : String(id);
  };

  const filteredSectionsForFilter = useMemo(() => {
    if (selectedDeptFilter === 'all') return [];
    return sections.filter(s => String(s.department_id) === selectedDeptFilter);
  }, [sections, selectedDeptFilter]);

  const addSectionsList = useMemo(() => {
    if (!addDeptId) return [];
    return sections.filter(s => String(s.department_id) === addDeptId);
  }, [sections, addDeptId]);

  const handleAddDeptChange = (deptId: string) => {
    setAddDeptId(deptId);
    setAddSectionId('');
  };

  const handleEditDeptChange = (deptId: string) => {
    setEditDeptId(deptId);
    setEditSectionId('');
    setEditSectionsList(sections.filter(s => String(s.department_id) === deptId));
  };

  // Reset section filter if department filter changes
  useEffect(() => {
    setSelectedSectionFilter('all');
  }, [selectedDeptFilter]);

  const fetchBarcodes = async () => {
    try {
      const allQC = await (inventoryService as any).getQCBarcodes();
      setQCBarcodes(allQC.sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()));
      
      const products = await (inventoryService as any).getProductBarcodes();
      setAllProducts(products);

      const { data: depts } = await departmentService.getAllDepartments();
      if (depts) setDepartments(depts);
      const { data: secs } = await departmentService.getAllSections();
      if (secs) setSections(secs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load QC barcodes');
    }
  };

  useEffect(() => {
    fetchBarcodes();
  }, []);

  const getFilteredBarcodes = () => {
    let filtered = qcBarcodes;
    
    if (activeTab === 'IN') {
      filtered = filtered.filter(b => b.currentStage === 'QC_IN');
    }

    if (selectedDeptFilter !== 'all') {
      filtered = filtered.filter(b => String(b.department_id) === selectedDeptFilter);
    }

    if (selectedSectionFilter !== 'all') {
      filtered = filtered.filter(b => String(b.section_id) === selectedSectionFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b => {
        const resolvedDept = getDeptName(b.department_id).toLowerCase();
        const resolvedSection = getSectionName(b.section_id).toLowerCase();
        return (
          (b.qcBarcode || '').toLowerCase().includes(q) ||
          (b.productName || '').toLowerCase().includes(q) ||
          (b.batchId || '').toLowerCase().includes(q) ||
          (b.productCode || '').toLowerCase().includes(q) ||
          (b.barcodeNumber || '').toLowerCase().includes(q) ||
          resolvedDept.includes(q) ||
          resolvedSection.includes(q)
        );
      });
    }
    return filtered;
  };

  const filteredBarcodes = getFilteredBarcodes();

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scannedCode.trim()) return;
    
    setIsProcessingScan(true);
    try {
      const scanned = normalizeCode(scannedCode);
      const latestQCBarcodes = await (inventoryService as any).getQCBarcodes();

      const qc = latestQCBarcodes.find((item: any) => {
        const values = [
          item.scan_code,
          item.scanCode,
          item.qcBarcode,
          item.qc_barcode,
          item.displayBarcode,
          item.barcodeNumber
        ].map(x => normalizeCode(x));
        return values.includes(scanned) || normalizeCode(barcodeService.deriveScanCode(item.qcBarcode || item.qc_barcode, 'QC')) === scanned;
      });
      
      if (!qc) {
         toast.error("QC barcode not found");
         setIsProcessingScan(false);
         scanInputRef.current?.focus();
         return;
      }
      
      if (qc.currentStage === "QC_IN") {
         setShowDetailsModal(false);
         setIsProcessingScan(false);

         setTimeout(() => {
           setSelectedQC({ ...qc });
           setDetailsModalKey(prev => prev + 1);
           setShowDetailsModal(true);
           setScannedCode("");
           scanInputRef.current?.focus();
         }, 0);
         return;
      }
      
      if (qc.currentStage === "READY_FOR_QC_IN" || !qc.currentStage) {
         setConfirmScanModal({ open: true, barcode: qc, scanAction: 'IN' });
         setScannedCode("");
         setIsProcessingScan(false);
         setTimeout(() => scanInputRef.current?.focus(), 100);
         return;
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Scan error occurred");
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleConfirmScan = async () => {
    const { barcode, scanAction } = confirmScanModal;
    if (!barcode) return;
    
    setIsProcessingScan(true);
    try {
      let updatedBarcode = { ...barcode };
      let successMessage = '';
      
      if (scanAction === 'IN') {
        updatedBarcode = {
          ...barcode,
          currentStage: 'QC_IN',
          qcInAt: new Date().toISOString(),
          qcInPersonName: 'System'
        };
        await (inventoryService as any).updateQCBarcode(updatedBarcode);
        successMessage = 'Moved to Inventory IN';
      }

      setConfirmScanModal({ open: false, barcode: null, scanAction: '' });
      toast.success(successMessage);
      fetchBarcodes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to process scan');
      setConfirmScanModal({ open: false, barcode: null, scanAction: '' });
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.barcode) return;
    try {
      const barcodeValue = deleteModal.barcode.qcBarcode || deleteModal.barcode.displayBarcode || deleteModal.barcode.barcodeNumber || deleteModal.barcode.barcode;
      await (inventoryService as any).deleteQCBarcode(barcodeValue);
      
      setDeleteModal({ open: false, barcode: null });
      
      if (scanModal.open && scanModal.barcode && scanModal.type === 'details') {
        const openedValue = scanModal.barcode.qcBarcode || scanModal.barcode.displayBarcode || scanModal.barcode.barcodeNumber || scanModal.barcode.barcode;
        if (openedValue === barcodeValue) {
          setScanModal({ open: false, barcode: null, type: '' });
        }
      }
      
      toast.success('Quality Check barcode deleted successfully.');
      fetchBarcodes();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete Quality Check barcode');
    }
  };

  const handleAddQCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addQCBarcode.trim() || !addProductName.trim() || !addProductCode.trim()) {
      toast.error("Please fill in barcode, product name and code");
      return;
    }
    if (!addDeptId || !addSectionId) {
      toast.error("Department and Section are required");
      return;
    }
    try {
      const record = {
        id: crypto.randomUUID(),
        qcBarcode: addQCBarcode.trim(),
        displayBarcode: addQCBarcode.trim(),
        barcodeNumber: addQCBarcode.trim(),
        productName: addProductName.trim(),
        productCode: addProductCode.trim(),
        batchId: addBatchId.trim() || null,
        microBatchNo: addMicroBatchNo,
        totalUnits: addTotalUnits,
        productBarcodes: [],
        producedBy: addProducedBy.trim() || null,
        labeledBy: localStorage.getItem('current_user') || 'Warehouse Admin',
        createdAt: new Date().toISOString(),
        currentStage: 'READY_FOR_QC_IN',
        department_id: addDeptId,
        section_id: addSectionId
      };
      await (inventoryService as any).addQCBarcode(record);
      toast.success("Manual QC barcode added successfully");
      setIsAddModalOpen(false);
      // Reset form fields
      setAddQCBarcode('');
      setAddProductName('');
      setAddProductCode('');
      setAddBatchId('');
      setAddMicroBatchNo(1);
      setAddTotalUnits(30);
      setAddProducedBy('');
      setAddDeptId('');
      setAddSectionId('');
      fetchBarcodes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add manual QC barcode");
    }
  };

  const handleEditQCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editQCBarcode.trim() || !editProductName.trim() || !editProductCode.trim()) {
      toast.error("Please fill in barcode, product name and code");
      return;
    }
    if (!editDeptId || !editSectionId) {
      toast.error("Department and Section are required");
      return;
    }
    try {
      const allQC = await (inventoryService as any).getQCBarcodes();
      const targetRecord = allQC.find((item: any) => item.id === editTargetId);
      if (targetRecord) {
        const editPayload = {
          ...targetRecord,
          qcBarcode: editQCBarcode.trim(),
          displayBarcode: editQCBarcode.trim(),
          barcodeNumber: editQCBarcode.trim(),
          barcode: editQCBarcode.trim(),
          productName: editProductName.trim(),
          productCode: editProductCode.trim(),
          batchId: editBatchId.trim() || null,
          microBatchNo: editMicroBatchNo,
          totalUnits: editTotalUnits,
          producedBy: editProducedBy.trim() || null,
          department_id: editDeptId,
          section_id: editSectionId
        };
        await (inventoryService as any).updateQCBarcode(editPayload);
      }
      toast.success("QC barcode details updated successfully");
      setIsEditModalOpen(false);
      fetchBarcodes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update QC barcode");
    }
  };

  const getStageLabel = (stage: string) => {
    if (!stage || stage === 'READY_FOR_QC_IN') return 'READY TO SCAN IN';
    if (stage === 'QC_IN') return 'SCANNED IN';
    return stage.replace(/_/g, ' ');
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-8">
        <div>
          <button onClick={() => navigate('/inventory/dashboard')} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 mb-2 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: '28px', margin: 0, color: 'white' }}>Quality Check Barcodes</h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '15px' }}>
            Manage master QC barcodes for packed micro-batches
          </p>
        </div>
        
        {/* Scanner Form */}
        <div className="w-full md:w-auto">
          <form onSubmit={handleScan} style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <PackageSearch size={20} />
              </div>
              <input 
                ref={scanInputRef}
                type="text" 
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                placeholder="Scan QC Barcode..." 
                autoFocus
                style={{ width: '100%', padding: '14px 16px 14px 48px', borderRadius: '16px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }}
              />
            </div>
            <button 
              type="submit" 
              disabled={isProcessingScan || !scannedCode.trim()}
              style={{ padding: '0 24px', borderRadius: '16px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, cursor: isProcessingScan ? 'not-allowed' : 'pointer', opacity: (isProcessingScan || !scannedCode.trim()) ? 0.7 : 1 }}
            >
              {isProcessingScan ? 'Scanning...' : 'Trigger Scan'}
            </button>
          </form>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'IN'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'all 0.2s',
                background: activeTab === tab ? '#3b82f6' : 'transparent',
                color: activeTab === tab ? 'white' : '#94a3b8',
                border: `1px solid ${activeTab === tab ? '#3b82f6' : '#334155'}`,
                cursor: 'pointer'
              }}
            >
              {tab === 'ALL' ? 'All QC Barcodes' : 'Inventory IN'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            style={{ height: '38px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', padding: '0 12px', fontSize: '14px', outline: 'none' }}
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.department_name}</option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            disabled={selectedDeptFilter === 'all'}
            style={{ height: '38px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', padding: '0 12px', fontSize: '14px', outline: 'none', opacity: selectedDeptFilter === 'all' ? 0.5 : 1 }}
          >
            <option value="all">All Sections</option>
            {filteredSectionsForFilter.map(s => (
              <option key={s.id} value={s.id}>{s.section_name}</option>
            ))}
          </select>

          {/* Manual Add Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          >
            <Plus size={16} /> Add QC Barcode
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input 
          type="text" 
          placeholder="Search QC barcodes, products, batches..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '16px', border: '1px solid #334155', background: '#111827', color: 'white', fontSize: '15px', outline: 'none' }}
        />
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {filteredBarcodes.map((item, index) => (
          <div key={item.id || index} style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ background: 'white', padding: '24px', display: 'flex', justifyContent: 'center', borderBottom: '1px dashed #e2e8f0' }}>
              <BarcodeComponent value={item.qcBarcode || item.barcodeNumber} width={1.8} height={60} fontSize={14} background="transparent" />
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '16px', fontWeight: 700 }}>{item.productName || 'Unknown Product'}</h3>
                  <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: 600 }}>{item.qcBarcode || item.barcodeNumber}</span>
                </div>
                <div style={{ padding: '6px 12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {item.totalUnits || 30} Units
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Batch / MB</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.batchId?.slice(-6) || 'N/A'} / MB{item.microBatchNo || '1'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Product Code</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.productCode || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Produced By</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.producedBy || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Dept & Section</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{getDeptName(item.department_id)} / {getSectionName(item.section_id)}</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 700 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                  {getStageLabel(item.currentStage)}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => setDeleteModal({ open: true, barcode: item })}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <button 
                    onClick={() => {
                      setEditTargetId(item.id);
                      setEditQCBarcode(item.qcBarcode || item.barcodeNumber || '');
                      setEditProductName(item.productName || '');
                      setEditProductCode(item.productCode || '');
                      setEditBatchId(item.batchId || '');
                      setEditMicroBatchNo(item.microBatchNo || 1);
                      setEditTotalUnits(item.totalUnits || 30);
                      setEditProducedBy(item.producedBy || '');
                      setEditDeptId(item.department_id || '');
                      setEditSectionId(item.section_id || '');
                      setEditSectionsList(sections.filter(s => String(s.department_id) === String(item.department_id)));
                      setIsEditModalOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button 
                    onClick={() => {
                      setShowDetailsModal(false);
                      setTimeout(() => {
                        setSelectedQC({ ...item });
                        setDetailsModalKey(prev => prev + 1);
                        setShowDetailsModal(true);
                      }, 0);
                    }}
                    style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid #334155', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>
      
      {filteredBarcodes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px', background: '#1e293b', borderRadius: '24px', border: '1px dashed #334155' }}>
          <ShieldCheck size={48} color="#64748b" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px' }}>No QC Barcodes Found</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Generate micro-batches in Production to see QC master barcodes here.</p>
        </div>
      )}

      <AnimatePresence>
        {/* Modals */}
        {confirmScanModal.open && confirmScanModal.barcode && (
          <div className="modal-overlay" onClick={() => setConfirmScanModal({ open: false, barcode: null, scanAction: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ width: '400px', background: '#111827', border: '1px solid #263244', borderRadius: '24px', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={24} color="#3b82f6" />
                  Move to Inventory IN?
                </h2>
              </div>
              
              <div style={{ padding: '24px' }}>
                <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '15px' }}>
                  Do you want to move this QC barcode to Inventory IN?
                </p>

              </div>

              <div style={{ padding: '20px 24px', borderTop: '1px solid #1e293b', display: 'flex', gap: '12px', justifyContent: 'flex-end', background: '#0b1120' }}>
                <button 
                  onClick={() => { setConfirmScanModal({ open: false, barcode: null, scanAction: '' }); }}
                  style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmScan}
                  disabled={isProcessingScan}
                  style={{ padding: '12px 32px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: isProcessingScan ? 'not-allowed' : 'pointer', opacity: isProcessingScan ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isProcessingScan ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Status / Details Modal */}
        {scanModal.open && (
          <div className="modal-overlay" onClick={() => setScanModal({ open: false, barcode: null, type: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ width: '400px', background: '#111827', border: '1px solid #263244', borderRadius: '24px', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: scanModal.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  {scanModal.type === 'success' ? <CheckCircle2 size={32} color="#10b981" /> : <ShieldCheck size={32} color="#ef4444" />}
                </div>
                <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '20px' }}>{scanModal.type === 'success' ? 'Scan Successful' : 'Scan Failed'}</h2>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px' }}>{scanModal.message}</p>
                {scanModal.barcode && scanModal.type === 'success' && (
                  <div style={{ marginTop: '20px', padding: '16px', background: '#1e293b', borderRadius: '16px', border: '1px solid #334155', textAlign: 'left' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>QC Barcode Scanned</span>
                    <span style={{ fontSize: '15px', color: '#3b82f6', fontWeight: 600, fontFamily: 'monospace' }}>{scanModal.barcode.qcBarcode || scanModal.barcode.barcodeNumber}</span>
                  </div>
                )}
              </div>
              <div style={{ padding: '24px', borderTop: '1px solid #1e293b', background: '#0b1120' }}>
                <button 
                  onClick={handleCloseDetails}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDetailsModal && selectedQC && (
          <div className="modal-overlay" key={`overlay-${detailsModalKey}`} onClick={handleCloseDetails} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div 
              key={detailsModalKey}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ width: '500px', background: '#111827', border: '1px solid #263244', borderRadius: '24px', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
                  <div style={{ padding: '24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ShieldCheck size={24} color="#3b82f6" />
                      Quality Check Barcode Details
                    </h2>
                  </div>
                  <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>QC Barcode</span>
                        <span style={{ fontSize: '16px', color: '#3b82f6', fontFamily: 'monospace', fontWeight: 700 }}>{selectedQC.qcBarcode || selectedQC.barcodeNumber}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Product</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.productName || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Product Code</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.productCode || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Batch ID</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.batchId?.slice(-6) || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Micro Batch</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>MB{selectedQC.microBatchNo || '1'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Total Units</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.totalUnits || 30}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Created Date</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.createdAt ? new Date(selectedQC.createdAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Produced By</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.producedBy || 'N/A'}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Department & Section</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{getDeptName(selectedQC.department_id)} / {getSectionName(selectedQC.section_id)}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Labeled By</span>
                        <span style={{ fontSize: '15px', color: 'white', fontWeight: 600 }}>{selectedQC.labeledBy || 'N/A'}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                      <h3 style={{ color: 'white', fontSize: '16px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowLeft size={16}/> Inventory History</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8', fontSize: '14px' }}>QC IN By/At</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: '14px', display: 'block' }}>{selectedQC.qcInPersonName || '--'}</span>
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{selectedQC.qcInAt ? new Date(selectedQC.qcInAt).toLocaleString() : '--'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                      <h3 style={{ color: 'white', fontSize: '16px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={16}/> Products Inside ({selectedQC.productBarcodes?.length || 0})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155', maxHeight: '400px', overflowY: 'auto' }}>
                        {selectedQC.productBarcodes?.map((code: string, idx: number) => {
                          const prod = allProducts.find(p => [p.displayBarcode, p.barcodeNumber, p.barcode, p.code].map(x => normalizeCode(x)).includes(normalizeCode(code)));
                          return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#64748b', fontSize: '13px', minWidth: '20px', fontWeight: 600 }}>{idx + 1}.</span>
                              <span style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: '14px', fontWeight: 700 }}>{code}</span>
                            </div>
                            {prod ? (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginLeft: '28px', marginTop: '8px', background: '#0b1120', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Product</span>
                                  <span style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>{prod.productName || 'N/A'} ({prod.productCode || 'N/A'})</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Micro Batch</span>
                                  <span style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>MB{prod.microBatchNo || '1'}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Produced By</span>
                                  <span style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>{prod.producedBy || 'N/A'}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Labeled By</span>
                                  <span style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>{prod.labeledBy || 'N/A'}</span>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginLeft: '28px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>Product details not found</div>
                            )}
                          </div>
                        )})}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '24px', borderTop: '1px solid #334155', display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(selectedQC.qcBarcode || selectedQC.barcodeNumber); toast.success('Copied!'); }}
                      style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#0f172a', color: 'white', border: '1px solid #334155', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                    >
                      Copy QC Barcode
                    </button>
                    <button 
                      onClick={handleCloseDetails}
                      style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
            </motion.div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteModal.open && deleteModal.barcode && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#0f172a', width: '100%', maxWidth: '400px', borderRadius: '24px', border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Trash2 size={24} color="#ef4444" />
                  Delete Quality Check Barcode
                </h2>
              </div>
              
              <div style={{ padding: '24px' }}>
                <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '15px', lineHeight: '1.5' }}>
                  Are you sure you want to delete this Quality Check barcode?
                </p>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ color: '#fca5a5', margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                    This action will permanently remove the QC master barcode.<br/>
                    The individual 30 product barcodes will <strong>NOT</strong> be deleted.
                  </p>
                </div>
              </div>

              <div style={{ padding: '24px', borderTop: '1px solid #334155', display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setDeleteModal({ open: false, barcode: null })}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MANUAL ADD INSPECTION MODAL */}
        {isAddModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#0f172a', width: '100%', maxWidth: '500px', borderRadius: '24px', border: '1px solid #334155', overflow: 'hidden' }}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '20px' }}>Add QC Inspection</h2>
              </div>
              <form onSubmit={handleAddQCSubmit} style={{ padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>QC Barcode *</label>
                  <input type="text" value={addQCBarcode} onChange={e => setAddQCBarcode(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} placeholder="e.g. QC-PRODUCT-MB1-DATE" />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Product Name *</label>
                  <input type="text" value={addProductName} onChange={e => setAddProductName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} placeholder="Product Name" />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Product Code *</label>
                  <input type="text" value={addProductCode} onChange={e => setAddProductCode(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} placeholder="Product Code" />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Batch ID</label>
                  <input type="text" value={addBatchId} onChange={e => setAddBatchId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} placeholder="Parent Batch UUID (optional)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Micro Batch No</label>
                    <input type="number" value={addMicroBatchNo} onChange={e => setAddMicroBatchNo(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Total Units</label>
                    <input type="number" value={addTotalUnits} onChange={e => setAddTotalUnits(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Produced By</label>
                  <input type="text" value={addProducedBy} onChange={e => setAddProducedBy(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} placeholder="Operator Name" />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Department *</label>
                  <select value={addDeptId} onChange={e => handleAddDeptChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }}>
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Section *</label>
                  <select value={addSectionId} onChange={e => setAddSectionId(e.target.value)} disabled={!addDeptId} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none', opacity: addDeptId ? 1 : 0.5 }}>
                    <option value="">Select Section</option>
                    {addSectionsList.map(s => (
                      <option key={s.id} value={s.id}>{s.section_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn hover-lift" style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn hover-lift" style={{ padding: '12px 24px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600 }}>Create Inspection</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MANUAL EDIT INSPECTION MODAL */}
        {isEditModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: '#0f172a', width: '100%', maxWidth: '500px', borderRadius: '24px', border: '1px solid #334155', overflow: 'hidden' }}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '20px' }}>Edit QC Inspection</h2>
              </div>
              <form onSubmit={handleEditQCSubmit} style={{ padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>QC Barcode *</label>
                  <input type="text" value={editQCBarcode} onChange={e => setEditQCBarcode(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Product Name *</label>
                  <input type="text" value={editProductName} onChange={e => setEditProductName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Product Code *</label>
                  <input type="text" value={editProductCode} onChange={e => setEditProductCode(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Batch ID</label>
                  <input type="text" value={editBatchId} onChange={e => setEditBatchId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Micro Batch No</label>
                    <input type="number" value={editMicroBatchNo} onChange={e => setEditMicroBatchNo(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Total Units</label>
                    <input type="number" value={editTotalUnits} onChange={e => setEditTotalUnits(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Produced By</label>
                  <input type="text" value={editProducedBy} onChange={e => setEditProducedBy(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Department *</label>
                  <select value={editDeptId} onChange={e => handleEditDeptChange(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none' }}>
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>Section *</label>
                  <select value={editSectionId} onChange={e => setEditSectionId(e.target.value)} disabled={!editDeptId} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: '15px', outline: 'none', opacity: editDeptId ? 1 : 0.5 }}>
                    <option value="">Select Section</option>
                    {editSectionsList.map(s => (
                      <option key={s.id} value={s.id}>{s.section_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn hover-lift" style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn hover-lift" style={{ padding: '12px 24px', borderRadius: '12px', background: '#8b5cf6', color: 'white', border: 'none', fontWeight: 600 }}>Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
