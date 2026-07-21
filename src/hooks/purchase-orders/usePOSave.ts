import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import type { POHeaderPayload, POProductPayload, POFormState, POUIState } from '../../types';
import type { PurchaseOrderDocumentProps } from '../../services/pdf/pdfTemplates';
import type { POValidation } from './usePOValidation';
import { useAuth } from '../useAuth';
import { useAuditLogger } from '../useAuditLogger';

export const usePOSave = (
  formState: POFormState,
  setFormState: React.Dispatch<React.SetStateAction<POFormState>>,
  setUIState: React.Dispatch<React.SetStateAction<POUIState>>,
  subtotal: number,
  gstTotal: number,
  validation: POValidation,
  generatePONumber: () => Promise<string>
) => {
  const { user } = useAuth();
  const { logAction } = useAuditLogger();

  const prepareHeaderPayload = useCallback((): POHeaderPayload => {
    return {
      po_number: formState.poNumber,
      vendor_id: formState.vendorId,
      vendor_name: formState.vendorName,
      category: formState.mainCategory || null,
      sub_category_1: formState.subCategory1 || null,
      sub_category_2: formState.subCategory2 || null,
      sub_category_3: null,
      subtotal,
      gst_total: gstTotal,
      created_at: new Date().toISOString(),
      payment_mode: null,
      initiated_by: null,
      approved_by: null,
      delivery_address: null,
      expected_delivery_date: null,
      shipping_charges: 0,
      terms_conditions: '',
      created_by: user?.id || null,
    };
  }, [formState, subtotal, gstTotal, user?.id]);

  const prepareProductPayloads = useCallback((purchaseOrderId: string): POProductPayload[] => {
    return formState.products.map((row) => {
      const qty = Number(row.quantity) || 0;
      const price = Number(row.price) || 0;
      const gstPercent = Number(row.gst_percent) || 0;
      
      const gstAmount = (qty * price * gstPercent) / 100;
      const totalAmt = (qty * price) + gstAmount;

      return {
        purchase_order_id: purchaseOrderId,
        product_name: row.product_name,
        moq: row.moq,
        batch_size: row.batch_size,
        quantity: qty,
        unit_price: price,
        gst: gstPercent,
        total_amount: Number(totalAmt.toFixed(2)),
        used_in: row.used_in,
      };
    }).filter((row) => row.quantity > 0 && row.unit_price > 0);
  }, [formState.products]);

  const savePurchaseOrder = useCallback(async (): Promise<void> => {
    if (!validation.isValid) {
      setUIState((prev: POUIState) => ({ ...prev, saveError: validation.errors[0] }));
      return;
    }

    if (formState.products.length === 0) {
      setUIState((prev: POUIState) => ({ ...prev, saveError: 'Cannot save a Purchase Order without products.' }));
      return;
    }

    setUIState((prev: POUIState) => ({
      ...prev,
      isSaving: true,
      saveError: '',
      saveSuccess: false,
    }));

    try {
      const headerPayload = prepareHeaderPayload();

      const { data: headerData, error: headerErr } = await supabase
        .from(SUPABASE_TABLES.purchaseOrders)
        .insert([headerPayload])
        .select('id')
        .single();

      if (headerErr || !headerData?.id) {
        throw headerErr || new Error('Failed to retrieve PO ID after insert.');
      }

      const purchaseOrderId = headerData.id;
      const productPayloads = prepareProductPayloads(purchaseOrderId);
      
      if (productPayloads.length === 0) {
        throw new Error('No valid products to insert. Quantities must be greater than 0.');
      }

      const { error: productsErr } = await supabase
        .from(SUPABASE_TABLES.purchaseOrderProducts)
        .insert(productPayloads);

      if (productsErr) {
        throw productsErr;
      }

      const pdfSnapshot: PurchaseOrderDocumentProps = {
        poNumber: headerPayload.po_number,
        createdAt: headerPayload.created_at || new Date().toISOString(),
        vendorName: headerPayload.vendor_name,
        products: productPayloads,
        subtotal: headerPayload.subtotal,
        gstTotal: headerPayload.gst_total,
        grandTotal: headerPayload.subtotal + headerPayload.gst_total,
        termsConditions: formState.termsConditions,
      };

      setUIState((prev: POUIState) => ({ 
        ...prev, 
        saveSuccess: true,
        lastSavedPO: pdfSnapshot 
      }));

      await generatePONumber();
      
      // Fire-and-forget audit log
      logAction('CREATE', SUPABASE_TABLES.purchaseOrders, purchaseOrderId, {
        po_number: headerPayload.po_number,
        subtotal: headerPayload.subtotal,
        vendor_name: headerPayload.vendor_name
      });

      setFormState((prev: POFormState) => ({
        ...prev,
        vendorId: '',
        vendorName: '',
        mainCategory: '',
        subCategory1: '',
        subCategory2: '',
        selectedProductNames: [],
        products: [],
      }));

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown network error occurred';
      setUIState((prev: POUIState) => ({ ...prev, saveError: `Failed to save Purchase Order: ${message}` }));
    } finally {
      setUIState((prev: POUIState) => ({ ...prev, isSaving: false }));
    }
  }, [validation, formState.products.length, formState.termsConditions, prepareHeaderPayload, prepareProductPayloads, generatePONumber, setUIState, setFormState, logAction]);

  const updatePurchaseOrder = useCallback(async (poId: string): Promise<boolean> => {
    if (!validation.isValid) {
      setUIState((prev: POUIState) => ({ ...prev, saveError: validation.errors[0] }));
      return false;
    }

    if (formState.products.length === 0) {
      setUIState((prev: POUIState) => ({ ...prev, saveError: 'Cannot save a Purchase Order without products.' }));
      return false;
    }

    setUIState((prev: POUIState) => ({
      ...prev,
      isSaving: true,
      saveError: '',
      saveSuccess: false,
    }));

    try {
      const headerPayload = prepareHeaderPayload();
      
      const { error: headerErr } = await supabase
        .from(SUPABASE_TABLES.purchaseOrders)
        .update({
          po_number: headerPayload.po_number,
          vendor_id: headerPayload.vendor_id,
          vendor_name: headerPayload.vendor_name,
          category: headerPayload.category,
          sub_category_1: headerPayload.sub_category_1,
          sub_category_2: headerPayload.sub_category_2,
          subtotal: headerPayload.subtotal,
          gst_total: headerPayload.gst_total,
          payment_mode: headerPayload.payment_mode,
          initiated_by: headerPayload.initiated_by,
          approved_by: headerPayload.approved_by,
          delivery_address: headerPayload.delivery_address,
          expected_delivery_date: headerPayload.expected_delivery_date,
          shipping_charges: headerPayload.shipping_charges,
          terms_conditions: headerPayload.terms_conditions,
        })
        .eq('id', poId);

      if (headerErr) throw headerErr;

      // Delete existing products snapshot
      const { error: deleteErr } = await supabase
        .from('purchase_order_products_rows')
        .delete()
        .eq('purchase_order_id', poId);

      if (deleteErr) throw deleteErr;

      // Re-insert products
      const productPayloads = prepareProductPayloads(poId);
      const { error: productsErr } = await supabase
        .from('purchase_order_products_rows')
        .insert(productPayloads);

      if (productsErr) throw productsErr;

      setUIState((prev: POUIState) => ({
        ...prev,
        isSaving: false,
        saveSuccess: true,
      }));

      // Fire-and-forget audit log
      logAction('UPDATE', SUPABASE_TABLES.purchaseOrders, poId, {
        po_number: headerPayload.po_number,
        subtotal: headerPayload.subtotal,
        vendor_name: headerPayload.vendor_name
      });

      return true;
    } catch (err: unknown) {
      console.error('Failed to update PO:', err);
      const message = err instanceof Error ? err.message : 'Unknown network error occurred';
      setUIState((prev: POUIState) => ({ 
        ...prev, 
        isSaving: false,
        saveError: `Failed to update Purchase Order: ${message}` 
      }));
      return false;
    }
  }, [validation, formState, prepareHeaderPayload, prepareProductPayloads, setUIState, logAction]);

  return { savePurchaseOrder, updatePurchaseOrder };
};
