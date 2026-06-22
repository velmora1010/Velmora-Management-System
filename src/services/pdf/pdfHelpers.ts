/**
 * Formats a number as INR currency without the symbol, just formatting
 * since standard PDF fonts might not support ₹ symbol reliably, or we can just use "Rs."
 */
export const formatCurrencyPDF = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null) return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatDatePDF = (dateString: string | undefined | null): string => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
};
