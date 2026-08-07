import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Download, 
  FileSpreadsheet, 
  AlertTriangle, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  X,
  CreditCard
} from 'lucide-react';
import type { WebsiteConsolidatedOrder, WebsiteSalesFilterState } from './types';
import { websiteSalesService } from './websiteSalesService';
import { exportOrdersToCSV, exportOrdersToXLSX } from './websiteSalesUtils';

interface WebsiteUpdatedDataProps {
  selectedBatchId?: string;
}

export const WebsiteUpdatedData: React.FC<WebsiteUpdatedDataProps> = ({ selectedBatchId }) => {
  const [orders, setOrders] = useState<WebsiteConsolidatedOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [filters, setFilters] = useState<WebsiteSalesFilterState>({
    searchQuery: '',
    batchId: selectedBatchId || '',
    state: '',
    city: '',
    product: '',
    offer: '',
    paymentMode: '',
    dateRange: 'all'
  });

  // Sync batchId filter when prop changes
  useEffect(() => {
    setFilters(f => ({ ...f, batchId: selectedBatchId || '' }));
  }, [selectedBatchId]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<WebsiteConsolidatedOrder | null>(null);

  useEffect(() => {
    loadData();
  }, [filters, selectedBatchId]);

  const loadData = async () => {
    if (!selectedBatchId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const activeFilters = { ...filters, batchId: selectedBatchId };
    const fetchedOrders = await websiteSalesService.getConsolidatedOrders(activeFilters);
    setOrders(fetchedOrders);
    setLoading(false);
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      batchId: selectedBatchId || '',
      state: '',
      city: '',
      product: '',
      offer: '',
      paymentMode: '',
      dateRange: 'all'
    });
    setCurrentPage(1);
  };

  // Derive unique lists for dropdown filters
  const uniqueStates = Array.from(new Set(orders.map(o => o.state).filter(Boolean))).sort();

  // Pagination Math
  const totalOrders = orders.length;
  const totalPages = Math.ceil(totalOrders / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedOrders = orders.slice(startIndex, startIndex + pageSize);

  if (!selectedBatchId) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <Database size={40} className="text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-300">No Uploaded File Selected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Please select an uploaded file from the Upload File or Files tab before viewing its consolidated orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* HEADER ROW WITH SEARCH & EXPORT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Database size={20} className="text-emerald-400" />
            Consolidated Updated Data View
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            14 business columns showing PREPAID, PARTIAL COD, COD status, remaining receivable amounts, and 10-digit phone numbers.
          </p>
        </div>

        {/* SEARCH & EXPORTS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={e => {
                setFilters({ ...filters, searchQuery: e.target.value });
                setCurrentPage(1);
              }}
              placeholder="Search by Order ID, Name, Phone..."
              className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 w-[240px]"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters({ ...filters, searchQuery: '' })}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportOrdersToCSV(orders)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => exportOrdersToXLSX(orders)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* State Filter */}
          <select
            value={filters.state}
            onChange={e => {
              setFilters({ ...filters, state: e.target.value });
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 outline-none focus:border-cyan-400"
          >
            <option value="">All States</option>
            {uniqueStates.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Payment Mode Filter */}
          <select
            value={filters.paymentMode}
            onChange={e => {
              setFilters({ ...filters, paymentMode: e.target.value });
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 outline-none focus:border-cyan-400"
          >
            <option value="">All Payment Modes</option>
            <option value="PREPAID">PREPAID</option>
            <option value="PARTIAL COD">PARTIAL COD</option>
            <option value="COD">COD</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span>Total Orders: <strong className="text-white">{orders.length}</strong></span>
          {(filters.state || filters.paymentMode || filters.searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-cyan-400 hover:underline cursor-pointer font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* MAIN DATA TABLE (14 COLUMNS: Order ID, Name, State, City, Pincode, Order, Product Name, Qty, Offer, Price, Payment Mode, Remaining COD, Phone, Details) */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading updated order data...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Database size={36} className="text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No Orders Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No updated data is available for the selected file or matches your filter criteria.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 min-w-[1380px]">
              <thead className="bg-slate-950/90 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800 h-[48px]">
                <tr>
                  <th className="py-3 px-3.5 w-[110px]">Order ID</th>
                  <th className="py-3 px-3.5 w-[140px]">Customer Name</th>
                  <th className="py-3 px-3.5 w-[110px]">State</th>
                  <th className="py-3 px-3.5 w-[110px]">City</th>
                  <th className="py-3 px-3.5 w-[90px]">Pincode</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Order</th>
                  <th className="py-3 px-3.5 min-w-[160px]">Product Name</th>
                  <th className="py-3 px-3.5 w-[80px] text-center">Quantity</th>
                  <th className="py-3 px-3.5 w-[110px]">Offer</th>
                  <th className="py-3 px-3.5 w-[100px]">Price</th>
                  <th className="py-3 px-3.5 w-[130px] text-center">Payment Mode</th>
                  <th className="py-3 px-3.5 w-[120px] text-right">Remaining COD</th>
                  <th className="py-3 px-3.5 w-[120px]">Phone</th>
                  <th className="py-3 px-2 w-[65px] text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {paginatedOrders.map((o) => (
                  <tr key={o.id} className="h-[54px] hover:bg-slate-800/40 transition-colors">
                    {/* 1. ORDER ID */}
                    <td className="py-3 px-3.5 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{o.order_id}</span>
                        {o.data_conflict && (
                          <span title={o.conflict_details || 'Data conflict detected'}>
                            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. CUSTOMER NAME */}
                    <td className="py-3 px-3.5 font-medium text-slate-200 truncate max-w-[140px]" title={o.customer_name}>
                      {o.customer_name}
                    </td>

                    {/* 3. STATE */}
                    <td className="py-3 px-3.5 font-medium text-slate-300 truncate max-w-[110px]" title={o.state}>
                      {o.state}
                    </td>

                    {/* 4. CITY */}
                    <td className="py-3 px-3.5 text-slate-300 truncate max-w-[110px]" title={o.city}>
                      {o.city}
                    </td>

                    {/* 5. PINCODE */}
                    <td className="py-3 px-3.5 font-mono text-slate-400 whitespace-nowrap">
                      {o.pincode}
                    </td>

                    {/* 6. ORDER */}
                    <td className="py-3 px-3.5 font-mono font-semibold text-cyan-300 truncate max-w-[220px]" title={o.order_formatted}>
                      {o.order_formatted}
                    </td>

                    {/* 7. PRODUCT NAME */}
                    <td className="py-3 px-3.5 text-cyan-400 font-medium truncate max-w-[180px]" title={o.product_name}>
                      {o.product_name}
                    </td>

                    {/* 8. QUANTITY */}
                    <td className="py-3 px-3.5 font-mono font-bold text-white text-center">
                      {o.total_quantity}
                    </td>

                    {/* 9. OFFER */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {o.offer && o.offer !== 'No Offer' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {o.offer}
                        </span>
                      ) : (
                        <span className="text-slate-500">No Offer</span>
                      )}
                    </td>

                    {/* 10. PRICE */}
                    <td className="py-3 px-3.5 font-mono font-bold text-emerald-400 whitespace-nowrap">
                      ₹{o.price.toLocaleString()}
                    </td>

                    {/* 11. PAYMENT MODE BADGE */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      {o.payment_mode === 'PREPAID' ? (
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          PREPAID
                        </span>
                      ) : o.payment_mode === 'PARTIAL COD' ? (
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          PARTIAL COD
                        </span>
                      ) : o.payment_mode === 'COD' ? (
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          COD
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          UNKNOWN
                        </span>
                      )}
                    </td>

                    {/* 12. REMAINING COD AMOUNT */}
                    <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                      {o.payment_mode === 'PARTIAL COD' ? (
                        <span className="text-purple-300">
                          ₹{(o.remaining_payable ?? 0).toLocaleString()}
                        </span>
                      ) : o.payment_mode === 'COD' ? (
                        <span className="text-amber-300">
                          ₹{(o.remaining_payable ?? o.price).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* 13. PHONE (Normalized 10-digit) */}
                    <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {o.phone}
                    </td>

                    {/* 14. DETAILS ACTION (Centered Icon Only) */}
                    <td className="py-3 px-2 text-center whitespace-nowrap w-[65px]">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(o)}
                        title="View Details"
                        aria-label="View Order Details"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        {totalOrders > 0 && (
          <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 h-[56px]">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white outline-none font-semibold cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="pl-2">
                Showing {startIndex + 1}–{Math.min(startIndex + pageSize, totalOrders)} of {totalOrders} orders
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 font-semibold text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg text-white transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Order #{selectedOrder.order_id}</h3>
                <p className="text-xs text-slate-400">Consolidated Order & Payment Breakdown</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Customer Name</span>
                  <span className="font-semibold text-white">{selectedOrder.customer_name}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Normalized Phone</span>
                  <span className="font-mono text-cyan-300 font-bold">{selectedOrder.phone}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Shipping Location</span>
                <div className="flex items-center gap-3 text-slate-400 pt-1 font-mono">
                  <span>State: <strong className="text-slate-200 font-sans">{selectedOrder.state}</strong></span>
                  <span>•</span>
                  <span>City: <strong className="text-slate-200 font-sans">{selectedOrder.city}</strong></span>
                  <span>•</span>
                  <span>Pincode: <strong className="text-slate-200">{selectedOrder.pincode}</strong></span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Line Items</span>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-1 font-mono">
                    {selectedOrder.items.map(it => (
                      <div key={it.id} className="flex justify-between text-slate-200">
                        <span>{it.product_name}</span>
                        <span className="font-bold text-cyan-300">× {it.quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-cyan-300">{selectedOrder.order_formatted}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Payment Mode</span>
                  <span className="font-bold text-emerald-300 flex items-center gap-1">
                    <CreditCard size={12} /> {selectedOrder.payment_mode}
                  </span>
                  {selectedOrder.source_payment_mode && (
                    <span className="text-[10px] text-slate-500 block truncate">({selectedOrder.source_payment_mode})</span>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Advance Paid</span>
                  <span className="font-mono font-bold text-emerald-400">₹{(selectedOrder.advance_paid ?? 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Remaining Payable</span>
                  <span className="font-mono font-bold text-purple-300">
                    {selectedOrder.payment_mode === 'PREPAID' ? '-' : `₹${(selectedOrder.remaining_payable ?? selectedOrder.price).toLocaleString()}`}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Final Order Price</span>
                  <span className="font-mono font-bold text-emerald-300 text-sm">₹{selectedOrder.price.toLocaleString()}</span>
                </div>
              </div>

              {selectedOrder.payment_classification_reason && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300 block mb-0.5">Classification Reason:</span>
                  <span>{selectedOrder.payment_classification_reason}</span>
                </div>
              )}

              {selectedOrder.data_conflict && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{selectedOrder.conflict_details || 'Conflict detected across raw rows'}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
