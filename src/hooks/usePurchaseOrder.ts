import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';
import type { Vendor, POFormState, POUIState } from '../types';

// Sub-hooks for responsibility isolation
import { usePOCalculations } from './purchase-orders/usePOCalculations';
import { usePOValidation } from './purchase-orders/usePOValidation';
import { usePOProducts } from './purchase-orders/usePOProducts';
import { usePOSave } from './purchase-orders/usePOSave';

const DEFAULT_TERMS = `1. Products supplied must match approved samples and agreed specifications.
2. Any damaged or defective goods may be rejected.
3. Delivery delays must be informed in advance.
4. GST invoice must be provided along with goods.
5. Packaging should be secure and suitable for transportation.`;

export const usePurchaseOrder = () => {
  const [formState, setFormState] = useState<POFormState>(() => ({
    poNumber: '',
    date: new Date().toISOString().split('T')[0],
    vendorId: '',
    vendorName: '',
    mainCategory: '',
    subCategory1: '',
    subCategory2: '',
    selectedProductNames: [],
    paymentMode: '',
    initiatedBy: '',
    approvedBy: '',
    deliveryAddress: '',
    expectedDeliveryDate: '',
    shippingCharges: 0,
    products: [],
    termsConditions: DEFAULT_TERMS,
  }));

  const [uiState, setUIState] = useState<POUIState>({
    isSaving: false,
    isLoadingPONumber: false,
    saveError: '',
    saveSuccess: false,
    lastSavedPO: null,
  });

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // 1. Calculations
  const { subtotal, gstTotal, grandTotal, productRowTotals } = usePOCalculations(formState.products);

  // 2. Validation
  const validation = usePOValidation(formState.vendorId, formState.products);

  // 3. Products
  const { handleProductSelection, handleProductFieldChange, handleRemoveProduct } = usePOProducts(setFormState, selectedVendor);

  // PO Number Generation
  const generatePONumber = useCallback(async () => {
    setUIState((prev) => ({ ...prev, isLoadingPONumber: true }));
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    let increment = '001';

    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.purchaseOrders)
        .select('po_number')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].po_number) {
        const lastPO = data[0].po_number;
        const parts = lastPO.split('-');
        if (parts.length === 4 && parts[1] === String(year) && parts[2] === month) {
          const lastInc = parseInt(parts[3], 10);
          if (!isNaN(lastInc)) {
            increment = String(lastInc + 1).padStart(3, '0');
          }
        }
      }
    } catch (e) {
      console.error('Error fetching latest PO number', e);
    }

    const poNumber = `PO-${year}-${month}-${increment}`;
    setFormState((prev) => ({ ...prev, poNumber }));
    setUIState((prev) => ({ ...prev, isLoadingPONumber: false }));

    return poNumber;
  }, []);

  // 4. Save Logic
  const { savePurchaseOrder } = usePOSave(
    formState,
    setFormState,
    setUIState,
    subtotal,
    gstTotal,
    validation,
    generatePONumber
  );

  // Vendor Selection Handler
  const handleVendorChange = useCallback((_vendorId: string, vendor: Vendor | null) => {
    setSelectedVendor(vendor);
    setUIState((prev) => ({ ...prev, saveSuccess: false }));

    if (vendor) {
      setFormState((prev) => ({
        ...prev,
        vendorId: vendor.id,
        vendorName: vendor.vendor_name,
        mainCategory: vendor.vendor_category || '',
        subCategory1: vendor.sub_category || '',
        subCategory2: vendor.sub_sub_category || '',
        selectedProductNames: [],
        products: [],
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        vendorId: '',
        vendorName: '',
        mainCategory: '',
        subCategory1: '',
        subCategory2: '',
        selectedProductNames: [],
        products: [],
      }));
    }
  }, []);

  // Category Selection Handlers
  const handleMainCategoryChange = useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      mainCategory: value,
      subCategory1: '',
      subCategory2: '',
      selectedProductNames: [],
      products: [],
    }));
  }, []);

  const handleSub1Change = useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      subCategory1: value,
      subCategory2: '',
      selectedProductNames: [],
      products: [],
    }));
  }, []);

  const handleSub2Change = useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      subCategory2: value,
      selectedProductNames: [],
      products: [],
    }));
  }, []);

  const setTermsConditions = useCallback((terms: string) => {
    setFormState((prev) => ({ ...prev, termsConditions: terms }));
  }, []);

  const updateField = useCallback(<K extends keyof POFormState>(field: K, value: POFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setUIState(prev => ({ ...prev, saveSuccess: false }));
  }, []);

  const loadPurchaseOrder = useCallback(async (poId: string) => {
    setUIState(prev => ({ ...prev, isLoadingPONumber: true }));
    try {
      const { data: poHeader, error: poHeaderErr } = await supabase
        .from('purchase_orders_rows')
        .select('*')
        .eq('id', poId)
        .single();
      if (poHeaderErr) throw poHeaderErr;

      const { data: poProducts, error: poProductsErr } = await supabase
        .from('purchase_order_products_rows')
        .select('*')
        .eq('purchase_order_id', poId);
      if (poProductsErr) throw poProductsErr;

      if (poHeader) {
        // Fetch matching vendor
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', poHeader.vendor_id)
          .single();
        if (vendorData) {
          setSelectedVendor(vendorData);
        }

        setFormState({
          poNumber: poHeader.po_number || '',
          date: poHeader.created_at ? poHeader.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          vendorId: poHeader.vendor_id || '',
          vendorName: poHeader.vendor_name || '',
          mainCategory: poHeader.category || '',
          subCategory1: poHeader.sub_category_1 || '',
          subCategory2: poHeader.sub_category_2 || '',
          selectedProductNames: poProducts ? poProducts.map((p: any) => p.product_name) : [],
          paymentMode: poHeader.payment_mode || '',
          initiatedBy: poHeader.initiated_by || '',
          approvedBy: poHeader.approved_by || '',
          deliveryAddress: poHeader.delivery_address || '',
          expectedDeliveryDate: poHeader.expected_delivery_date || '',
          shippingCharges: poHeader.shipping_charges || 0,
          products: poProducts ? poProducts.map((p: any) => ({
            product_name: p.product_name || '',
            moq: p.moq || '',
            batch_size: p.batch_size || '',
            quantity: p.quantity || 0,
            price: p.unit_price || 0,
            gst_percent: p.gst || 0,
            used_in: p.used_in || '',
            total_amount: (p.quantity || 0) * (p.unit_price || 0),
            hasVendorData: true,
          })) : [],
          termsConditions: poHeader.terms_conditions || DEFAULT_TERMS,
        });
      }
    } catch (err) {
      console.error('Failed to load purchase order:', err);
    } finally {
      setUIState(prev => ({ ...prev, isLoadingPONumber: false }));
    }
  }, []);

  return {
    formState,
    uiState,
    validation,
    subtotal,
    gstTotal,
    grandTotal,
    productRowTotals,
    generatePONumber,
    handleVendorChange,
    handleMainCategoryChange,
    handleSub1Change,
    handleSub2Change,
    handleProductSelection,
    handleProductFieldChange,
    handleRemoveProduct,
    setTermsConditions,
    updateField,
    savePurchaseOrder,
    updatePurchaseOrder: savePurchaseOrder,
    loadPurchaseOrder,
  };
};
