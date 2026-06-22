import type { POProductRow } from '../types';

/**
 * Utility functions for standardizing financial calculations across the platform.
 */

/**
 * Formats a number to Indian Rupee currency string format (e.g. ₹1,234.50)
 */
export const formatIndianCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  
  return "₹" + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Parses a currency string back to a float (removes ₹ and commas)
 */
export const parseCurrency = (currencyStr: string): number => {
  if (!currencyStr) return 0;
  const num = parseFloat(currencyStr.replace(/[₹,]/g, ''));
  return isNaN(num) ? 0 : num;
};

/**
 * Row Level Calculations
 */
export const calculateRowSubtotal = (quantity: number, unitPrice: number): number => {
  return quantity * unitPrice;
};

export const calculateRowGST = (subtotal: number, gstPercent: number): number => {
  return (subtotal * gstPercent) / 100;
};

export const calculateRowTotal = (quantity: number, unitPrice: number, gstPercent: number) => {
  const baseAmount = calculateRowSubtotal(quantity, unitPrice);
  const gstAmount = calculateRowGST(baseAmount, gstPercent);
  const totalAmount = baseAmount + gstAmount;

  return {
    baseAmount,
    gstAmount,
    totalAmount
  };
};

export const calculateSubtotal = (rows: POProductRow[]): number => {
  return rows.reduce((sum, row) => sum + calculateRowSubtotal(row.quantity, row.price), 0);
};

export const calculateGSTTotal = (rows: POProductRow[]): number => {
  return rows.reduce((sum, row) => {
    const subtotal = calculateRowSubtotal(row.quantity, row.price);
    return sum + calculateRowGST(subtotal, row.gst_percent);
  }, 0);
};

export const calculateGrandTotal = (rows: POProductRow[]): number => {
  return calculateSubtotal(rows) + calculateGSTTotal(rows);
};

