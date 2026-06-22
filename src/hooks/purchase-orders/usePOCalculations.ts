import { useMemo } from 'react';
import { calculateRowTotal, calculateSubtotal, calculateGSTTotal, calculateGrandTotal } from '../../utils/calculations';
import type { POProductRow } from '../../types';

export const usePOCalculations = (products: POProductRow[]) => {
  const subtotal = useMemo(
    () => calculateSubtotal(products),
    [products]
  );

  const gstTotal = useMemo(
    () => calculateGSTTotal(products),
    [products]
  );

  const grandTotal = useMemo(
    () => calculateGrandTotal(products),
    [products]
  );

  const productRowTotals = useMemo(
    () => products.map(row => calculateRowTotal(row.quantity, row.price, row.gst_percent)),
    [products]
  );

  return { subtotal, gstTotal, grandTotal, productRowTotals };
};
