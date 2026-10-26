import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Tag, 
  CreditCard, 
  AlertTriangle, 
  Package, 
  Trash2,
  Mail,
  Truck,
  ExternalLink,
  Calendar,
  Clock,
  DollarSign,
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Check,
  ShieldAlert,
  ShoppingBag
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteFullOrderDetails } from '../types';
import { formatPhoneNumber, formatSalesDateDisplay } from '../websiteSalesUtils';
import { websiteSalesService } from '../websiteSalesService';
import toast from 'react-hot-toast';

interface OrderDetailsModalProps {
  order: WebsiteConsolidatedOrder | null;
  onClose: () => void;
  onOrderDeleted?: (orderId: string) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  onClose, 
  onOrderDeleted 
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fullDetails, setFullDetails] = useState<WebsiteFullOrderDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(true);

  useEffect(() => {
    if (!order) {
      setFullDetails(null);
      return;
    }

    let isMounted = true;
    setLoadingDetails(true);

    websiteSalesService.getFullOrderDetails(order.order_id)
      .then(res => {
        if (isMounted) {
          setFullDetails(res);
          setLoadingDetails(false);
        }
      })
      .catch(err => {
        console.warn('Could not fetch deep order metadata:', err);
        if (isMounted) {
          setLoadingDetails(false);
        }
      });

    return () => { isMounted = false; };
  }, [order?.order_id]);

  if (!order) return null;

  const displayPhone = formatPhoneNumber(order.phone);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDelete = async () => {
    if (!order) return;

    const hasAwb = !!(fullDetails?.logistics?.awb_number || order.awb_number);
    const isDispatchedOrDelivered = 
      hasAwb || 
      (order.fulfillment_status && ['fulfilled', 'shipped', 'delivered'].includes(order.fulfillment_status.toLowerCase()));

    let confirmMsg = `Are you sure you want to permanently delete order #${order.order_id}? This will automatically remove it from Sales and Logistics.`;

    if (isDispatchedOrDelivered) {
      confirmMsg = `⚠️ WARNING: Order #${order.order_id} has already been dispatched/fulfilled with courier tracking.\n\nDeleting this order will remove it from all active operational Logistics views, counts, and Analytics.\n\nAre you sure you want to permanently delete this order?`;
    }

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    const toastId = toast.loading(`Deleting order #${order.order_id}...`);
    try {
      await websiteSalesService.deleteSalesOrder(order.order_id);
      toast.success(`Order #${order.order_id} successfully deleted from Sales & Logistics!`, { id: toastId });
      onOrderDeleted?.(order.order_id);
      onClose();
    } catch (err: any) {
      toast.error(`Failed to delete order: ${err.message}`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const shippingAddr = fullDetails?.shippingAddress || {
    name: order.customer_name,
    street: order.address,
    city: order.city,
    state: order.state,
    pincode: order.pincode,
    country: 'India',
    phone: order.phone
  };

  const billingAddr = fullDetails?.billingAddress || shippingAddr;
  const items = fullDetails?.items && fullDetails.items.length > 0 
    ? fullDetails.items 
    : (order.items && order.items.length > 0 
        ? order.items.map(it => ({
            id: it.id,
            product_name: it.product_name,
            sku: '-',
            quantity: it.quantity,
            unit_price: it.unit_price != null ? it.unit_price : undefined,
            line_total: it.line_total != null ? it.line_total : undefined
          }))
        : [{
            id: 'item-1',
            product_name: order.product_name || order.order_formatted || 'Standard Item',
            sku: '-',
            quantity: order.total_quantity || 1,
            unit_price: order.price,
            line_total: order.price
          }]
      );

  const financials = fullDetails?.financials || {
    subtotal: order.price,
    discount_amount: 0,
    discount_code: order.offer,
    shipping_charges: 0,
    taxes: 0,
    total: order.price,
    advance_paid: order.advance_paid || 0,
    remaining_cod: order.remaining_payable || (order.payment_mode === 'PREPAID' ? 0 : order.price),
    refunded_amount: 0,
    payment_method: order.source_payment_method || order.payment_mode,
    financial_status: order.financial_status || (order.payment_mode === 'PREPAID' ? 'paid' : 'pending')
  };

  const logistics = fullDetails?.logistics || {
    status: order.fulfillment_status || 'Unfulfilled',
    courier: order.courier,
    awb_number: order.awb_number,
    tracking_url: order.awb_number && order.courier?.toLowerCase().includes('delhivery') 
      ? `https://www.delhivery.com/track/package/${order.awb_number}` 
      : undefined
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <ShoppingBag size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Order #{order.order_id}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                  Website Sales
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  order.payment_mode === 'PREPAID'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : order.payment_mode === 'PARTIAL COD'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {order.payment_mode}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar size={12} className="text-slate-500" />
                  {formatSalesDateDisplay(order.order_date)}
                </span>
                {order.batch_file_name && (
                  <span className="flex items-center gap-1 text-slate-400">
                    • <FileSpreadsheet size={12} className="text-slate-500" />
                    {order.batch_file_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(order.order_id, 'Order ID')}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy Order ID"
            >
              {copiedField === 'Order ID' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">

          {/* TOP SUMMARY GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Order Value</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                ₹{Math.round(financials.total).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {financials.financial_status ? `Status: ${financials.financial_status.toUpperCase()}` : 'Gross placed value'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Advance Collected</span>
              <span className="text-lg font-bold font-mono text-cyan-300">
                ₹{Math.round(financials.advance_paid).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {order.payment_mode === 'PREPAID' ? '100% Prepaid' : 'Partial payment'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Remaining COD</span>
              <span className="text-lg font-bold font-mono text-pink-400">
                ₹{Math.round(financials.remaining_cod).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {financials.remaining_cod > 0 ? 'Pending on delivery' : 'No balance due'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Units</span>
              <span className="text-lg font-bold font-mono text-purple-300">
                {order.total_quantity || 1}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {items.length} {items.length === 1 ? 'line item' : 'distinct items'}
              </span>
            </div>
          </div>

          {/* TWO-COLUMN LAYOUT: CUSTOMER & ADDRESS (LEFT) + LOGISTICS & FULFILLMENT (RIGHT) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* LEFT: CUSTOMER & SHIPPING ADDRESS */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <User size={13} className="text-cyan-400" /> Customer Information
                </span>
                {fullDetails?.email && (
                  <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1 truncate max-w-[180px]">
                    <Mail size={12} className="text-indigo-400 shrink-0" />
                    {fullDetails.email}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">{order.customer_name || 'N/A'}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-slate-300 font-semibold flex items-center gap-1">
                      <Phone size={12} className="text-emerald-400" /> {displayPhone || 'N/A'}
                    </span>
                    {displayPhone && (
                      <button
                        onClick={() => handleCopy(order.phone, 'Phone')}
                        className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                        title="Copy Phone"
                      >
                        {copiedField === 'Phone' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[10px] flex items-center gap-1">
                    <MapPin size={11} className="text-amber-400" /> Shipping Destination:
                  </span>
                  <p className="leading-relaxed">
                    {shippingAddr.street && shippingAddr.street !== '-' ? shippingAddr.street : order.address || 'Address not specified'}
                  </p>
                  <p className="font-mono text-slate-400">
                    {[shippingAddr.city, shippingAddr.state].filter(s => s && s !== '-').join(', ')} 
                    {shippingAddr.pincode && shippingAddr.pincode !== '-' ? ` - ${shippingAddr.pincode}` : ''}
                  </p>
                </div>

                {/* Billing Address if different */}
                {billingAddr.street && billingAddr.street !== shippingAddr.street && (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">Billing Address:</span>
                    <p className="leading-relaxed">{billingAddr.street}</p>
                    <p className="font-mono text-slate-500">
                      {[billingAddr.city, billingAddr.state].filter(s => s && s !== '-').join(', ')} - {billingAddr.pincode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: LOGISTICS & SHIPMENT DETAILS */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <Truck size={13} className="text-purple-400" /> Fulfillment & Logistics
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  (logistics.status || order.fulfillment_status || '').toLowerCase().includes('deliv')
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : (logistics.status || order.fulfillment_status || '').toLowerCase().includes('transit') || (logistics.status || order.fulfillment_status || '').toLowerCase().includes('dispatch')
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {logistics.status || order.fulfillment_status || 'Unfulfilled'}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Courier Partner</span>
                    <span className="font-bold text-slate-200 text-xs mt-0.5 block truncate">
                      {logistics.courier || order.courier || 'Pending Allocation'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">AWB / Tracking #</span>
                    {logistics.awb_number || order.awb_number ? (
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-mono font-bold text-indigo-300 text-xs">
                          {logistics.awb_number || order.awb_number}
                        </span>
                        {logistics.tracking_url && (
                          <a
                            href={logistics.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                            title="Open courier tracking link"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-xs mt-0.5 block">Not manifested yet</span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Order Date:</span>
                    <span className="font-mono text-slate-200">{formatSalesDateDisplay(order.order_date)}</span>
                  </div>
                  {order.original_order_date && order.original_order_date !== order.order_date && (
                    <div className="flex justify-between text-slate-500">
                      <span>Source Timestamp:</span>
                      <span className="font-mono truncate max-w-[200px]">{order.original_order_date}</span>
                    </div>
                  )}
                  {logistics.manifested_date && (
                    <div className="flex justify-between text-slate-400">
                      <span>Manifested Date:</span>
                      <span className="font-mono text-cyan-300">{formatSalesDateDisplay(logistics.manifested_date)}</span>
                    </div>
                  )}
                  {logistics.delivered_date && (
                    <div className="flex justify-between text-slate-400">
                      <span>Delivered Date:</span>
                      <span className="font-mono text-emerald-400">{formatSalesDateDisplay(logistics.delivered_date)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ORDER ITEMS TABLE */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <Package size={13} className="text-pink-400" /> Order Items ({items.length})
              </span>
              {order.offer && order.offer !== 'No Offer' && (
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold font-mono">
                  Applied Offer: {order.offer}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[10px] uppercase font-bold text-slate-400">
                    <th className="py-2 pr-3">Product Name</th>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 pl-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-900/50">
                      <td className="py-2.5 pr-3 font-sans text-slate-200 font-medium">
                        {it.product_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {it.sku && it.sku !== '-' ? it.sku : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {it.unit_price != null ? `₹${Math.round(it.unit_price).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-cyan-300">
                        × {it.quantity}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-bold text-emerald-400">
                        {it.line_total != null ? `₹${Math.round(it.line_total).toLocaleString('en-IN')}` : `₹${Math.round(order.price).toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINANCIAL BREAKDOWN */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider border-b border-slate-800/80 pb-2">
              <DollarSign size={13} className="text-emerald-400" /> Payment & Financial Breakdown
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Gross Order Subtotal:</span>
                  <span className="font-mono text-slate-200">₹{Math.round(financials.subtotal).toLocaleString('en-IN')}</span>
                </div>
                {financials.discount_amount > 0 && (
                  <div className="flex justify-between text-pink-400">
                    <span>Discounts ({financials.discount_code || 'Offer'}):</span>
                    <span className="font-mono">-₹{Math.round(financials.discount_amount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {financials.shipping_charges > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Shipping Charges:</span>
                    <span className="font-mono text-slate-200">₹{Math.round(financials.shipping_charges).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {financials.taxes > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Taxes & Duties:</span>
                    <span className="font-mono text-slate-200">₹{Math.round(financials.taxes).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
                  <span>Net Placed Total:</span>
                  <span className="font-mono text-emerald-400 text-sm">₹{Math.round(financials.total).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Payment Gateway / Method:</span>
                  <span className="font-bold text-slate-200">{order.source_payment_method || order.payment_mode}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Payment Classification:</span>
                  <span className={`font-bold ${
                    order.payment_mode === 'PREPAID' ? 'text-emerald-400' :
                    order.payment_mode === 'PARTIAL COD' ? 'text-purple-400' : 'text-amber-400'
                  }`}>
                    {order.payment_mode}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Advance Received:</span>
                  <span className="font-mono text-emerald-400 font-bold">₹{Math.round(financials.advance_paid).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Outstanding COD:</span>
                  <span className="font-mono text-pink-400 font-bold">
                    {order.payment_mode === 'PREPAID' ? '₹0' : `₹${Math.round(financials.remaining_cod).toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AUDIT TIMELINE (WHERE AVAILABLE) */}
          {fullDetails?.timeline && fullDetails.timeline.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider border-b border-slate-800/80 pb-2">
                <Clock size={13} className="text-cyan-400" /> Order Lifecycle Timeline
              </span>
              <div className="space-y-3 pl-2">
                {fullDetails.timeline.map((event, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1 shrink-0 ring-4 ring-indigo-500/20" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-xs">{event.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{event.timestamp}</span>
                      </div>
                      {event.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONFLICTS OR ANOMALIES */}
          {order.data_conflict && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2.5">
              <AlertTriangle size={16} className="shrink-0" />
              <div>
                <span className="font-bold block">Spreadsheet Inconsistency Detected:</span>
                <span>{order.conflict_details || 'Multiple conflicting rows found during consolidation.'}</span>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold text-xs rounded-xl border border-red-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>{isDeleting ? 'Deleting...' : 'Delete Order'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
