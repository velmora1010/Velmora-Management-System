import React, { useEffect } from 'react';
import { usePurchaseOrder } from '../../hooks/usePurchaseOrder';
import { useCategories } from '../../hooks/useCategories';
import { VendorSelector } from '../../components/procurement/VendorSelector';
import { PurchaseCategorySelector } from '../../components/procurement/PurchaseCategorySelector';
import { ProductMultiSelect } from '../../components/finance/ProductMultiSelect';
import { ProcurementProductTable } from '../../components/procurement/ProcurementProductTable';
import { ProcurementTotalsCard } from '../../components/procurement/ProcurementTotalsCard';
import { Card } from '../../components/ui/Card';
import type { Vendor } from '../../types';

/**
 * PurchaseOrderForm — Main Purchase Order form page.
 *
 * Architecture:
 *   - usePurchaseOrder() is the SINGLE SOURCE OF TRUTH for all state.
 *   - useCategories() provides master category data from Supabase.
 *   - This component ONLY renders and emits events.
 *   - NO business logic, NO inline calculations, NO local state duplication.
 *
 * Layout matches: index.html lines 1240-1488 (PO form structure)
 */
export const PurchaseOrderForm: React.FC = () => {
  // ── Central state engine ──
  const po = usePurchaseOrder();

  // ── Category master data from Supabase ──
  const categories = useCategories();

  // Destructure stable setters for use in effects (prevents render loops)
  const { setMainCategory, setSubCategory1, setSubCategory2 } = categories;
  const { mainCategory: catMain, subCategory1: catSub1, subCategory2: catSub2 } = categories;

  // ── Generate PO number on mount ──
  useEffect(() => {
    po.generatePONumber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════
  // SYNCHRONIZATION: When hook's formState categories change
  // (e.g. via vendor auto-select), sync the useCategories
  // selectors so cascading options refresh correctly.
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (po.formState.mainCategory !== catMain) {
      setMainCategory(po.formState.mainCategory);
    }
  }, [po.formState.mainCategory, catMain, setMainCategory]);

  useEffect(() => {
    if (po.formState.subCategory1 !== catSub1) {
      setSubCategory1(po.formState.subCategory1);
    }
  }, [po.formState.subCategory1, catSub1, setSubCategory1]);

  useEffect(() => {
    if (po.formState.subCategory2 !== catSub2) {
      setSubCategory2(po.formState.subCategory2);
    }
  }, [po.formState.subCategory2, catSub2, setSubCategory2]);

  // ═══════════════════════════════════════════════════════
  // EVENT HANDLERS — bridge between UI components and hook
  // ═══════════════════════════════════════════════════════

  const onVendorChange = (vendorId: string, vendorData?: Vendor) => {
    po.handleVendorChange(vendorId, vendorData || null);
  };

  const onMainCategoryChange = (val: string) => {
    po.handleMainCategoryChange(val);
    setMainCategory(val);
    setSubCategory1('');
    setSubCategory2('');
  };

  const onSub1Change = (val: string) => {
    po.handleSub1Change(val);
    setSubCategory1(val);
    setSubCategory2('');
  };

  const onSub2Change = (val: string) => {
    po.handleSub2Change(val);
    setSubCategory2(val);
  };

  const onProductSelection = (selectedNames: string[]) => {
    po.handleProductSelection(selectedNames);
  };

  // ── Format date for header display (DD/MM/YYYY) ──
  const formatDisplayDate = (isoDate: string): string => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  const selectClass = "w-full bg-transparent border-2 border-border text-main rounded-lg px-4 py-2 text-base transition-colors focus:outline-none focus:border-primary";

  // ═══════════════════════════════════════════════════════
  // RENDER
  // Layout matches: index.html PO form structure
  // ═══════════════════════════════════════════════════════

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* ── FORM HEADER: Title + PO Number + Date ── */}
      <Card className="w-full !p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-main m-0">Purchase Order Form</h2>
            <p className="text-sm text-muted mt-1">Create and manage purchase orders.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-black/5 dark:bg-white/5 px-3 py-2 rounded-lg border border-border">
              <div className="text-[11px] uppercase text-muted font-semibold mb-0.5">PO Number</div>
              <div className="text-sm font-bold text-main">
                {po.uiState.isLoadingPONumber ? 'Loading...' : po.formState.poNumber}
              </div>
            </div>
            <div className="bg-black/5 dark:bg-white/5 px-3 py-2 rounded-lg border border-border">
              <div className="text-[11px] uppercase text-muted font-semibold mb-0.5">Date</div>
              <div className="text-sm font-bold text-main">{formatDisplayDate(po.formState.date)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── SPLIT LAYOUT: Buyer Details + Vendor/Category Form ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Buyer Details (static) — matches index.html lines 1263-1290 */}
        <Card className="lg:col-span-1 !p-8 flex flex-col gap-5 bg-black/5 dark:bg-white/5">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wider border-b border-border pb-2">
            BUYER DETAILS
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase mb-1">Company Name</div>
            <div className="text-sm font-semibold text-main">VELMORA CONSUMER PRODUCTS LLP</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase mb-1">GSTIN</div>
            <div className="text-sm font-medium text-main font-mono">33ABBFV8530C1ZG</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase mb-1">Address</div>
            <div className="text-[13px] text-main leading-relaxed">
              No. 4/1, East Street,<br />
              Punjailakkapuram,<br />
              Erode, Tamil Nadu - 638002
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase mb-1">Contact</div>
            <div className="text-sm text-main">97517 22100</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase mb-1">Email</div>
            <div className="text-sm text-main">velmora1010@gmail.com</div>
          </div>
        </Card>

        {/* RIGHT: Vendor Selection + Categories ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Vendor Selection — matches index.html lines 1294-1304 */}
          <Card className="!p-6">
            <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">
              VENDOR DETAILS
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-muted ml-1">Vendor Name <span className="text-red-500">*</span></label>
              <VendorSelector
                value={po.formState.vendorId}
                onChange={onVendorChange}
              />
            </div>
          </Card>

          {/* Purchase Categories — matches index.html lines 1306-1341 */}
          <Card className="!p-6">
            <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">
              PURCHASE CATEGORIES
            </div>
            <div className="flex flex-col gap-5">
              <PurchaseCategorySelector
                mainCategory={po.formState.mainCategory}
                subCategory1={po.formState.subCategory1}
                subCategory2={po.formState.subCategory2}
                mainOptions={categories.mainOptions}
                sub1Options={categories.sub1Options}
                sub2Options={categories.sub2Options}
                handleMainChange={onMainCategoryChange}
                handleSub1Change={onSub1Change}
                handleSub2Change={onSub2Change}
              />

              {/* Sub Category 3 — Product Multi-Select */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-muted ml-1">Sub Category 3 (Product Selection)</label>
                <ProductMultiSelect
                  options={categories.sub3Options}
                  selectedValues={po.formState.selectedProductNames}
                  onChange={onProductSelection}
                  placeholder={
                    !po.formState.subCategory2
                      ? 'Select Sub Category 2 First'
                      : categories.sub3Options.length === 0
                        ? 'No products available for this category'
                        : 'Select Products'
                  }
                  disabled={!po.formState.subCategory2 || categories.sub3Options.length === 0}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── PRODUCT TABLE — matches index.html lines 1344-1386 ── */}
      <Card className="!p-6">
        <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-5 border-b border-border pb-2">
          PRODUCT DETAILS
        </div>
        <ProcurementProductTable
          products={po.formState.products}
          onFieldChange={po.handleProductFieldChange}
          onRemove={po.handleRemoveProduct}
        />
      </Card>

      {/* ── TOTALS CARD ── */}
      <ProcurementTotalsCard
        subtotal={po.subtotal}
        gstTotal={po.gstTotal}
        grandTotal={po.grandTotal}
      />

      {/* ── DELIVERY + PAYMENT GRID — matches index.html lines 1388-1434 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Details */}
        <Card className="!p-6">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">
            DELIVERY DETAILS
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-muted ml-1">Delivery Address</label>
              <textarea
                className="w-full bg-transparent border-2 border-border text-main rounded-lg px-4 py-2 text-sm transition-colors focus:outline-none focus:border-primary resize-none"
                rows={3}
                placeholder="Enter delivery address"
                value={po.formState.deliveryAddress}
                onChange={(e) => po.updateField('deliveryAddress', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-muted ml-1">Expected Delivery Date</label>
              <input
                type="date"
                className={selectClass}
                value={po.formState.expectedDeliveryDate}
                onChange={(e) => po.updateField('expectedDeliveryDate', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Payment Terms */}
        <Card className="!p-6">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">
            PAYMENT TERMS
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-muted ml-1">Payment Mode</label>
              <select
                className={selectClass}
                value={po.formState.paymentMode}
                onChange={(e) => po.updateField('paymentMode', e.target.value)}
              >
                <option value="">Select Payment Mode</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-muted ml-1">Initiated By</label>
              <select
                className={selectClass}
                value={po.formState.initiatedBy}
                onChange={(e) => po.updateField('initiatedBy', e.target.value)}
              >
                <option value="">Select Initiator</option>
                <option value="Arjun Kumar">Arjun Kumar</option>
                <option value="Priya Sharma">Priya Sharma</option>
                <option value="Vignesh R">Vignesh R</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-muted ml-1">Approved By</label>
              <select
                className={selectClass}
                value={po.formState.approvedBy}
                onChange={(e) => po.updateField('approvedBy', e.target.value)}
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

      {/* ── TERMS & CONDITIONS — matches index.html lines 1436-1447 ── */}
      <Card className="!p-6">
        <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">
          TERMS &amp; CONDITIONS
        </div>
        <ol className="list-decimal pl-5 text-sm text-main leading-relaxed flex flex-col gap-2">
          <li>Products supplied must match approved samples and agreed specifications.</li>
          <li>Any damaged or defective goods may be rejected.</li>
          <li>Delivery delays must be informed in advance.</li>
          <li>GST invoice must be provided along with goods.</li>
          <li>Packaging should be secure and suitable for transportation.</li>
        </ol>
      </Card>

      {/* ── SIGNATURE SECTION — matches index.html lines 1449-1479 ── */}
      <Card className="!p-6">
        <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-5 border-b border-border pb-2">
          AUTHORISED SIGNATURES
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide">Authorised Signature (Buyer)</div>
            <div className="w-full h-24 border-2 border-dashed border-border rounded-lg" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide">Authorised Signature (Vendor)</div>
            <div className="w-full h-24 border-2 border-dashed border-border rounded-lg" />
          </div>
        </div>
        <div className="mt-6 text-center text-sm text-muted">
          Authorised By:<br />
          <strong className="text-main">VELMORA CONSUMER PRODUCTS LLP</strong>
        </div>
        <div className="grid grid-cols-3 gap-6 mt-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Name:</span>
            <div className="flex-1 border-b border-border" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Designation:</span>
            <div className="flex-1 border-b border-border" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Date:</span>
            <div className="flex-1 border-b border-border" />
          </div>
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

        {/* Success Display & Export Options */}
        {po.uiState.saveSuccess && po.uiState.lastSavedPO && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 transition-all duration-300">
            <span className="text-sm">
              Purchase Order saved successfully! A new PO number has been generated.
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

        {/* Save Button */}
        <div className="flex justify-end mt-4">
          <button
            type="button"
            className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-8 rounded-lg shadow-velmora transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={po.savePurchaseOrder}
            disabled={po.uiState.isSaving || !po.formState.vendorId || po.formState.products.length === 0}
          >
            {po.uiState.isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving Order...
              </>
            ) : (
              'Save Purchase Order'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
