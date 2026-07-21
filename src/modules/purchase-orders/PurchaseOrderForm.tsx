import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePurchaseOrder } from '../../hooks/usePurchaseOrder';
import { VendorSelector } from '../../components/procurement/VendorSelector';
import { PurchaseCategorySelector } from '../../components/procurement/PurchaseCategorySelector';
import { ProductMultiSelect } from '../../components/finance/ProductMultiSelect';
import { ProcurementProductTable } from '../../components/procurement/ProcurementProductTable';
import { ProcurementTotalsCard } from '../../components/procurement/ProcurementTotalsCard';
import { Card } from '../../components/ui/Card';
import type { Vendor } from '../../types';
import { supabase } from '../../lib/supabase';

export const PurchaseOrderForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const editPoId = searchParams.get('edit') || '';
  const viewPoId = searchParams.get('view') || '';
  const poId = editPoId || viewPoId;
  const isViewMode = !!viewPoId;

  // ── Central state engine ──
  const po = usePurchaseOrder();

  // Load PO if editing/viewing
  useEffect(() => {
    if (poId) {
      po.loadPurchaseOrder(poId);
    }
  }, [poId]);

  // Load Departments and Sections
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [sub2Options, setSub2Options] = useState<string[]>([]);
  const [sub3Options, setSub3Options] = useState<string[]>([]);

  useEffect(() => {
    const loadDeptsAndSections = async () => {
      const { data: depts } = await departmentService.getAllDepartments();
      if (depts) setDepartments(depts.filter(d => (d as any).status !== 'archived'));
      const { data: secs } = await departmentService.getAllSections();
      if (secs) setSections(secs.filter(s => (s as any).status !== 'archived'));
    };
    loadDeptsAndSections();
  }, []);

  const currentDeptId = po.formState.mainCategory;
  const currentSectionId = po.formState.subCategory1;
  const currentSub2 = po.formState.subCategory2;

  // Filtered sections for the selected department
  const filteredSections = useMemo(() => {
    if (!currentDeptId) return [];
    return sections.filter(s => String(s.department_id) === String(currentDeptId));
  }, [sections, currentDeptId]);

  // Fetch sub2 options from Vendor_Category
  useEffect(() => {
    let mounted = true;
    const fetchSub2 = async () => {
      if (!currentDeptId || !currentSectionId) {
        if (mounted) setSub2Options([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('Vendor_Category')
          .select('sub_sub_category')
          .eq('category', currentDeptId)
          .eq('sub_category', currentSectionId)
          .eq('status', 'active');
        if (!error && data && mounted) {
          const unique = Array.from(new Set(data.map(d => d.sub_sub_category).filter(Boolean))) as string[];
          setSub2Options(unique);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSub2();
    return () => { mounted = false; };
  }, [currentDeptId, currentSectionId]);

  // Fetch sub3 options from Vendor_Category
  useEffect(() => {
    let mounted = true;
    const fetchSub3 = async () => {
      if (!currentDeptId || !currentSectionId || !currentSub2) {
        if (mounted) setSub3Options([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('Vendor_Category')
          .select('sub_sub_sub_category')
          .eq('category', currentDeptId)
          .eq('sub_category', currentSectionId)
          .eq('sub_sub_category', currentSub2)
          .eq('status', 'active');
        if (!error && data && mounted) {
          const unique = Array.from(new Set(data.map(d => d.sub_sub_sub_category).filter(Boolean))) as string[];
          setSub3Options(unique.sort());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSub3();
    return () => { mounted = false; };
  }, [currentDeptId, currentSectionId, currentSub2]);

  // ── Generate PO number on mount (only for Add Mode) ──
  useEffect(() => {
    if (!poId) {
      po.generatePONumber();
    }
  }, [poId]);

  // ── Event Handlers ──
  const onVendorChange = (vendorId: string, vendorData?: Vendor) => {
    po.handleVendorChange(vendorId, vendorData || null);
  };

  const onMainCategoryChange = (val: string) => {
    po.handleMainCategoryChange(val);
    po.updateField('subCategory1', '');
    po.updateField('subCategory2', '');
  };

  const onSub1Change = (val: string) => {
    po.handleSub1Change(val);
    po.updateField('subCategory2', '');
  };

  const onSub2Change = (val: string) => {
    po.handleSub2Change(val);
  };

  const onProductSelection = (selectedNames: string[]) => {
    po.handleProductSelection(selectedNames);
  };

  const selectClass = "w-full bg-slate-900 border-2 border-slate-700 text-slate-200 rounded-lg px-4 py-2 text-base transition-colors focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed";

  // Option list maps for the cascades
  const mappedDepts = useMemo(() => {
    return departments.map(d => ({ id: String(d.id), name: d.department_name }));
  }, [departments]);

  const mappedSections = useMemo(() => {
    return filteredSections.map(s => ({ id: String(s.id), name: s.section_name }));
  }, [filteredSections]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6 text-slate-200 animate-in">
      {/* ── FORM HEADER: Title + PO Number + Date ── */}
      <Card className="w-full !p-6 bg-slate-800 border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 m-0">
              {isViewMode ? 'View Purchase Order' : editPoId ? 'Edit Purchase Order' : 'Purchase Order Form'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {isViewMode ? 'Viewing finalized purchase order details.' : 'Create and manage purchase orders.'}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
              <div className="text-[11px] uppercase text-slate-400 font-semibold mb-0.5">PO Number</div>
              <div className="text-sm font-bold text-slate-100 font-mono">
                {po.uiState.isLoadingPONumber ? 'Loading...' : po.formState.poNumber}
              </div>
            </div>
            <div className="bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
              <div className="text-[11px] uppercase text-slate-400 font-semibold mb-0.5">Date</div>
              <div className="text-sm font-bold text-slate-100">
                {po.formState.date}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── SPLIT LAYOUT: Buyer Details + Vendor/Category Form ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Buyer Details (static) */}
        <Card className="lg:col-span-1 !p-8 flex flex-col gap-5 bg-slate-900/50 border-slate-700">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider border-b border-slate-700 pb-2">
            BUYER DETAILS
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase mb-1">Company Name</div>
            <div className="text-sm font-semibold text-slate-200">VELMORA CONSUMER PRODUCTS LLP</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase mb-1">GSTIN</div>
            <div className="text-sm font-medium text-slate-200 font-mono">33ABBFV8530C1ZG</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase mb-1">Address</div>
            <div className="text-[13px] text-slate-300 leading-relaxed">
              No. 4/1, East Street,<br />
              Punjailakkapuram,<br />
              Erode, Tamil Nadu - 638002
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase mb-1">Contact</div>
            <div className="text-sm text-slate-200">97517 22100</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase mb-1">Email</div>
            <div className="text-sm text-slate-200">velmora1010@gmail.com</div>
          </div>
        </Card>

        {/* RIGHT: Vendor Selection + Categories */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Vendor Selection */}
          <Card className="!p-6 bg-slate-800 border-slate-700">
            <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
              VENDOR DETAILS
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-400 ml-1">Vendor Name <span className="text-red-500">*</span></label>
              <VendorSelector
                value={po.formState.vendorId}
                onChange={onVendorChange}
                disabled={isViewMode}
              />
            </div>
          </Card>

          {/* Purchase Categories */}
          <Card className="!p-6 bg-slate-800 border-slate-700">
            <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
              PURCHASE CATEGORIES
            </div>
            <div className="flex flex-col gap-5">
              <PurchaseCategorySelector
                mainCategory={po.formState.mainCategory}
                subCategory1={po.formState.subCategory1}
                subCategory2={po.formState.subCategory2}
                mainOptions={mappedDepts}
                sub1Options={mappedSections}
                sub2Options={sub2Options}
                handleMainChange={onMainCategoryChange}
                handleSub1Change={onSub1Change}
                handleSub2Change={onSub2Change}
                disabled={isViewMode}
              />

              {/* Sub Category 3 — Product Multi-Select */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-400 ml-1">Sub Category 3 (Product Selection)</label>
                <ProductMultiSelect
                  options={sub3Options}
                  selectedValues={po.formState.selectedProductNames}
                  onChange={onProductSelection}
                  placeholder={
                    !po.formState.subCategory2
                      ? 'Select Sub Category 2 First'
                      : sub3Options.length === 0
                        ? 'No products available for this category'
                        : 'Select Products'
                  }
                  disabled={isViewMode || !po.formState.subCategory2 || sub3Options.length === 0}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── PRODUCT TABLE ── */}
      <Card className="!p-6 bg-slate-800 border-slate-700">
        <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-5 border-b border-slate-700 pb-2">
          PRODUCT DETAILS
        </div>
        <ProcurementProductTable
          products={po.formState.products}
          onFieldChange={po.handleProductFieldChange}
          onRemove={po.handleRemoveProduct}
          disabled={isViewMode}
        />
      </Card>

      {/* ── TOTALS CARD ── */}
      <ProcurementTotalsCard
        subtotal={po.subtotal}
        gstTotal={po.gstTotal}
        grandTotal={po.grandTotal}
      />

      {/* ── DELIVERY + PAYMENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Details */}
        <Card className="!p-6 bg-slate-800 border-slate-700">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
            DELIVERY DETAILS
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-400 ml-1">Delivery Address</label>
              <textarea
                className="w-full bg-slate-900 border-2 border-slate-700 text-slate-200 rounded-lg px-4 py-2 text-sm transition-colors focus:border-purple-500 focus:outline-none resize-none disabled:opacity-50"
                rows={3}
                placeholder="Enter delivery address"
                value={po.formState.deliveryAddress}
                onChange={(e) => po.updateField('deliveryAddress', e.target.value)}
                disabled={isViewMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-400 ml-1">Expected Delivery Date</label>
              <input
                type="date"
                className={selectClass}
                value={po.formState.expectedDeliveryDate}
                onChange={(e) => po.updateField('expectedDeliveryDate', e.target.value)}
                disabled={isViewMode}
              />
            </div>
          </div>
        </Card>

        {/* Payment Terms */}
        <Card className="!p-6 bg-slate-800 border-slate-700">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
            PAYMENT TERMS
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-400 ml-1">Payment Mode</label>
              <select
                className={selectClass}
                value={po.formState.paymentMode}
                onChange={(e) => po.updateField('paymentMode', e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select Payment Mode</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-400 ml-1">Initiated By</label>
              <select
                className={selectClass}
                value={po.formState.initiatedBy}
                onChange={(e) => po.updateField('initiatedBy', e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select Initiator</option>
                <option value="Arjun Kumar">Arjun Kumar</option>
                <option value="Priya Sharma">Priya Sharma</option>
                <option value="Vignesh R">Vignesh R</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-400 ml-1">Approved By</label>
              <select
                className={selectClass}
                value={po.formState.approvedBy}
                onChange={(e) => po.updateField('approvedBy', e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select Approver</option>
                <option value="CEO">CEO</option>
                <option value="Finance Manager">Finance Manager</option>
                <option value="Operations Head">Operations Head</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* ── TERMS & CONDITIONS ── */}
      <Card className="!p-6 bg-slate-800 border-slate-700">
        <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
          TERMS &amp; CONDITIONS
        </div>
        <ol className="list-decimal pl-5 text-sm text-slate-300 leading-relaxed flex flex-col gap-2">
          <li>Products supplied must match approved samples and agreed specifications.</li>
          <li>Any damaged or defective goods may be rejected.</li>
          <li>Delivery delays must be informed in advance.</li>
          <li>GST invoice must be provided along with goods.</li>
          <li>Packaging should be secure and suitable for transportation.</li>
        </ol>
      </Card>

      {/* ── AUTHORIZED SIGNATURES ── */}
      <Card className="!p-6 bg-slate-800 border-slate-700">
        <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-5 border-b border-slate-700 pb-2">
          AUTHORISED SIGNATURES
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Authorised Signature (Buyer)</div>
            <div className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Authorised Signature (Vendor)</div>
            <div className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg" />
          </div>
        </div>
        <div className="mt-6 text-center text-sm text-slate-400">
          Authorised By:<br />
          <strong className="text-slate-200">VELMORA CONSUMER PRODUCTS LLP</strong>
        </div>
      </Card>

      {/* ── ACTION BUTTONS & STATUS ── */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Error Display */}
        {po.uiState.saveError && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
            {po.uiState.saveError}
          </div>
        )}

        {/* Success Display */}
        {po.uiState.saveSuccess && po.uiState.lastSavedPO && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 transition-all duration-300">
            <span className="text-sm">
              Purchase Order saved successfully!
            </span>
            <button
              type="button"
              onClick={async () => {
                const { exportPurchaseOrderPDF } = await import('../../services/pdf/generatePurchaseOrderPDF');
                exportPurchaseOrderPDF(po.uiState.lastSavedPO!);
              }}
              className="bg-white text-green-600 border border-green-500 hover:bg-green-50 font-semibold py-2 px-6 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Export PDF
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end mt-4 gap-3">
          <button
            type="button"
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            onClick={() => window.history.back()}
          >
            {isViewMode ? 'Go Back' : 'Cancel'}
          </button>
          {!isViewMode && (
            <button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={editPoId ? () => po.updatePurchaseOrder(editPoId) : po.savePurchaseOrder}
              disabled={po.uiState.isSaving || !po.formState.vendorId || po.formState.products.length === 0}
            >
              {po.uiState.isSaving ? 'Saving Order...' : (editPoId ? 'Update Purchase Order' : 'Save Purchase Order')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
