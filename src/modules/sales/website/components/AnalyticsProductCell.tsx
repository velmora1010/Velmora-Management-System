import React, { useState, useMemo } from 'react';
import type { WebsiteConsolidatedOrder, WebsiteOrderItem } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AnalyticsProductCellProps {
  order?: WebsiteConsolidatedOrder;
  orderFormatted?: string;
  productName?: string;
  items?: WebsiteOrderItem[];
  totalQuantity?: number;
  maxInitialDisplay?: number;
  compact?: boolean;
}

interface ParsedItem {
  name: string;
  quantity: number;
}

export const AnalyticsProductCell: React.FC<AnalyticsProductCellProps> = ({
  order,
  orderFormatted,
  productName,
  items,
  totalQuantity,
  maxInitialDisplay,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const initialLimit = maxInitialDisplay !== undefined ? maxInitialDisplay : (compact ? 1 : 2);

  const parsedItems: ParsedItem[] = useMemo(() => {
    // 1. If explicit items exist, use them
    const actualItems = order?.items || items;
    if (actualItems && actualItems.length > 0) {
      return actualItems.map(it => ({
        name: it.product_name || 'Product',
        quantity: it.quantity || 1
      }));
    }

    // 2. Parse from order_formatted string e.g. "DIY Detergent Liquid × 1 | DIY Dishwash Liquid × 2"
    const rawFormatted = order?.order_formatted || orderFormatted || '';
    if (rawFormatted.trim()) {
      const parts = rawFormatted.split(/\s*\|\s*/);
      const parsed: ParsedItem[] = [];
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(.*?)(?:\s*[×xX*]\s*(\d+))?$/);
        if (match) {
          const name = (match[1] || trimmed).trim();
          const qty = match[2] ? parseInt(match[2], 10) : 1;
          parsed.push({ name, quantity: isNaN(qty) ? 1 : qty });
        } else {
          parsed.push({ name: trimmed, quantity: 1 });
        }
      }
      if (parsed.length > 0) return parsed;
    }

    // 3. Fallback to product_name
    const rawProd = order?.product_name || productName || 'N/A';
    const fallbackQty = order?.total_quantity ?? totalQuantity ?? 1;
    if (rawProd.includes(',')) {
      return rawProd.split(',').map(s => ({
        name: s.trim(),
        quantity: 1
      }));
    }

    return [{ name: rawProd, quantity: fallbackQty }];
  }, [order, orderFormatted, productName, items, totalQuantity]);

  if (parsedItems.length === 0) {
    return <span className="text-slate-500 italic text-[11px]">—</span>;
  }

  const visibleItems = expanded ? parsedItems : parsedItems.slice(0, initialLimit);
  const hiddenCount = parsedItems.length - initialLimit;

  return (
    <div className={`flex flex-col ${compact ? 'gap-0.5 py-0.5 min-w-[190px] max-w-[320px]' : 'gap-1 py-1 min-w-[220px] max-w-[380px]'}`}>
      <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}>
        {visibleItems.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-1.5 leading-tight">
            <span className="font-sans font-medium text-cyan-300 text-[11px] whitespace-normal break-words">
              {item.name}
            </span>
            <span className="shrink-0 px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 font-mono text-[9px] font-bold">
              × {item.quantity}
            </span>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="self-start text-[9px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 mt-0.5 cursor-pointer bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={10} />
            </>
          ) : (
            <>
              +{hiddenCount} more {hiddenCount === 1 ? 'item' : 'items'} <ChevronDown size={10} />
            </>
          )}
        </button>
      )}
    </div>
  );
};
