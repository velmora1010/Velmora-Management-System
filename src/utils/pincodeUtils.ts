/**
 * Normalizes a pincode by removing leading apostrophes, trimming whitespace,
 * converting to a plain string, and preserving leading zeros while filtering
 * out any non-numeric characters.
 */
export function normalizePincode(value: any): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/^'+/, "")
    .trim()
    .replace(/[^0-9]/g, "");
}
