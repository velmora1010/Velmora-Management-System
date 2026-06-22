import { useMemo } from 'react';
import type { POProductRow } from '../../types';

export interface POValidation {
  isValid: boolean;
  errors: string[];
}

export const usePOValidation = (vendorId: string, products: POProductRow[]): POValidation => {
  return useMemo(() => {
    const errors: string[] = [];

    if (!vendorId) {
      errors.push('Please select a vendor before saving.');
    }

    if (products.length === 0) {
      errors.push('Please add at least one product row.');
    }

    const hasInvalidRows = products.some(
      row => isNaN(row.quantity) || row.quantity <= 0 || isNaN(row.price)
    );

    if (hasInvalidRows) {
      errors.push('Quantity must be > 0 and Unit Price must exist for all products.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [vendorId, products]);
};
