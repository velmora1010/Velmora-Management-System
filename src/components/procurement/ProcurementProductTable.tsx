import React from 'react';
import { calculateRowTotal } from '../../utils/calculations';
import { formatIndianCurrency } from '../../utils/calculations';
import type { POProductRow } from '../../types';
import { Trash2 } from 'lucide-react';

interface ProcurementProductTableProps {
  products: POProductRow[];
  onFieldChange: (index: number, field: keyof POProductRow, value: string | number) => void;
  onRemove: (index: number) => void;
  readonly?: boolean;
}

/**
 * ProcurementProductTable — Renders PO product rows with editable fields.
 * All calculations come from src/utils/calculations.ts ONLY.
 * This component ONLY renders and emits events — no business logic.
 *
 * Layout matches: index.html lines 1350-1368 (PO product table)
 */
export const ProcurementProductTable: React.FC<ProcurementProductTableProps> = React.memo(({
  products, onFieldChange, onRemove, readonly = false
}) => {
  if (products.length === 0) {
    return (
      <div className="w-full text-center py-8 text-muted bg-black/5 dark:bg-white/5 rounded-lg border-2 border-dashed border-border">
        Select a vendor and products to populate the procurement table.
      </div>
    );
  }

  const inputClass = "w-full bg-transparent border border-border rounded px-2 py-1 text-sm focus:border-primary focus:outline-none transition-colors";
  const readonlyInputClass = "w-full bg-black/5 dark:bg-white/5 border border-border rounded px-2 py-1 text-sm cursor-not-allowed opacity-75";

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border shadow-velmora">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-black/5 dark:bg-white/5 border-b border-border">
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-10">S.No</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider">Product Description</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-20">MOQ</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-24">Batch Size</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-20">Qty</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-28">Unit Price (₹)</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-20">GST (%)</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-28 text-right">Total (₹)</th>
            <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider w-28">Used In</th>
            {!readonly && <th className="px-3 py-3 font-semibold text-main text-xs uppercase tracking-wider text-center w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => {
            // Pure calculation engine — matches purchase-order.js calculatePurchaseOrderRow
            const { totalAmount } = calculateRowTotal(product.quantity, product.price, product.gst_percent);
            const isVendorLocked = product.hasVendorData;

            return (
              <tr key={`${product.product_name}-${idx}`} className="border-b border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                {/* S.No */}
                <td className="px-3 py-3 text-muted font-semibold text-sm">{idx + 1}</td>

                {/* Product Description */}
                <td className="px-3 py-3">
                  <input
                    type="text"
                    className={isVendorLocked ? readonlyInputClass : inputClass}
                    value={product.product_name}
                    onChange={(e) => onFieldChange(idx, 'product_name', e.target.value)}
                    readOnly={isVendorLocked || readonly}
                    placeholder="Enter product description..."
                  />
                </td>

                {/* MOQ */}
                <td className="px-3 py-3">
                  <input
                    type="text"
                    className={isVendorLocked ? readonlyInputClass : inputClass}
                    value={product.moq}
                    onChange={(e) => onFieldChange(idx, 'moq', e.target.value)}
                    readOnly={isVendorLocked || readonly}
                    placeholder="MOQ"
                  />
                </td>

                {/* Batch Size */}
                <td className="px-3 py-3">
                  <input
                    type="text"
                    className={isVendorLocked ? readonlyInputClass : inputClass}
                    value={product.batch_size}
                    onChange={(e) => onFieldChange(idx, 'batch_size', e.target.value)}
                    readOnly={isVendorLocked || readonly}
                    placeholder="Batch"
                  />
                </td>

                {/* Quantity — always editable (matches Vanilla: qty is never readonly) */}
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={product.quantity || ''}
                    onChange={(e) => onFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    disabled={readonly}
                    placeholder="0"
                  />
                </td>

                {/* Unit Price */}
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={isVendorLocked ? readonlyInputClass : inputClass}
                    value={product.price || ''}
                    onChange={(e) => onFieldChange(idx, 'price', parseFloat(e.target.value) || 0)}
                    readOnly={isVendorLocked || readonly}
                    placeholder="0.00"
                  />
                </td>

                {/* GST % */}
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={isVendorLocked ? readonlyInputClass : inputClass}
                    value={product.gst_percent || ''}
                    onChange={(e) => onFieldChange(idx, 'gst_percent', parseFloat(e.target.value) || 0)}
                    readOnly={isVendorLocked || readonly}
                    placeholder="0"
                  />
                </td>

                {/* Total Amount (calculated, never editable) */}
                <td className="px-3 py-3 text-right font-bold text-main text-sm">
                  {formatIndianCurrency(totalAmount)}
                </td>

                {/* Used In */}
                <td className="px-3 py-3">
                  <input
                    type="text"
                    className={isVendorLocked ? readonlyInputClass : inputClass}
                    value={product.used_in}
                    onChange={(e) => onFieldChange(idx, 'used_in', e.target.value)}
                    readOnly={isVendorLocked || readonly}
                    placeholder="Used In"
                  />
                </td>

                {/* Remove Action */}
                {!readonly && (
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="text-muted hover:text-red-500 transition-colors p-1"
                      title="Remove Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
