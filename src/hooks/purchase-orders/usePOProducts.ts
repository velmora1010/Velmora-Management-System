import { useCallback } from 'react';
import type { Vendor, POProductRow, POFormState } from '../../types';

export const usePOProducts = (
  setFormState: React.Dispatch<React.SetStateAction<POFormState>>,
  selectedVendor: Vendor | null
) => {
  const handleProductSelection = useCallback((selectedNames: string[]) => {
    const vendorProducts = selectedVendor?.products;

    const newRows: POProductRow[] = selectedNames.map(name => {
      let moq = '';
      let batchSize = '';
      let price = 0;
      let gstPercent = 0;
      let usedIn = '';
      let hasVendorData = false;

      if (vendorProducts && Array.isArray(vendorProducts)) {
        const match = vendorProducts.find(p => p.product_name === name);
        if (match) {
          hasVendorData = true;
          moq = match.moq || '';
          batchSize = match.batch_size || '';
          price = match.price_per_unit || match.price || 0;
          gstPercent = parseFloat(String(match.gst || match.gst_percent || 0)) || 0;
          usedIn = match.used_in || '';
        }
      }

      return {
        product_name: name,
        moq,
        batch_size: batchSize,
        quantity: 0,
        price,
        gst_percent: gstPercent,
        total_amount: 0,
        used_in: usedIn,
        hasVendorData,
      };
    });

    setFormState((prev: POFormState) => ({
      ...prev,
      selectedProductNames: selectedNames,
      products: newRows,
    }));
  }, [selectedVendor, setFormState]);

  const handleProductFieldChange = useCallback((index: number, field: keyof POProductRow, value: string | number) => {
    setFormState((prev: POFormState) => {
      const newProducts = [...prev.products];
      if (field === 'quantity' || field === 'price' || field === 'gst_percent') {
        const numVal = typeof value === 'string' ? parseFloat(value) : value;
        newProducts[index] = { ...newProducts[index], [field]: isNaN(numVal) ? 0 : numVal };
      } else {
        newProducts[index] = { ...newProducts[index], [field]: value as never };
      }
      return { ...prev, products: newProducts };
    });
  }, [setFormState]);

  const handleRemoveProduct = useCallback((index: number) => {
    setFormState((prev: POFormState) => {
      const newProducts = prev.products.filter((_, i) => i !== index);
      const newSelectedNames = newProducts.map((p) => p.product_name);
      return {
        ...prev,
        products: newProducts,
        selectedProductNames: newSelectedNames,
      };
    });
  }, [setFormState]);

  return { handleProductSelection, handleProductFieldChange, handleRemoveProduct };
};
