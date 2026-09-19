import React, { useState } from 'react';
import { AlertTriangle, X, Check, RefreshCw, FileText, Image as ImageIcon, Eye, CheckCircle2, QrCode } from 'lucide-react';
import type { CustomerTicket } from '../../types/customer-tickets';
import { getSubIssueLabel } from '../../config/ticketConfig';

interface ConfirmResolutionModalProps {
  ticket: CustomerTicket;
  paymentFile: File | null;
  resolutionNotes: string;
  isSubmitting: boolean;
  onBackToEdit: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmResolutionModal: React.FC<ConfirmResolutionModalProps> = ({
  ticket,
  paymentFile,
  resolutionNotes,
  isSubmitting,
  onBackToEdit,
  onConfirm,
  onClose
}) => {
  const [enlargedQrUrl, setEnlargedQrUrl] = useState<string | null>(null);

  const displayValue = (value: any, fallback = 'N/A') => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return fallback;
    }
    return String(value).trim();
  };

  const formatAmount = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(Number(val))) return 'N/A';
    const num = Number(val);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  };

  const getDaysOpen = (t: CustomerTicket) => {
    const end = t.resolvedAt ? new Date(t.resolvedAt) : new Date();
    const start = t.createdAt ? new Date(t.createdAt) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'High': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'Medium': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'Low': return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'In Progress': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'Waiting for Customer': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'Waiting for Courier': return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      case 'Replacement Processing': return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
      case 'Refund Processing': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'Resolved': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
    }
  };

  const hasQr = Boolean(ticket.qrImageUrl && ticket.qrImageUrl.trim());

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* FIXED HEADER */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Confirm Ticket Resolution</h3>
              <p className="text-xs text-muted">Please confirm marking this ticket as Resolved.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* INTERNAL SCROLLABLE CONTENT */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-sm">
          {/* SECTION 1: TICKET INFORMATION */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <FileText size={15} />
              <span>Ticket Information</span>
            </div>
            <div className="bg-background/80 border border-border/80 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted mb-1">Ticket ID</p>
                <p className="text-white font-bold text-base tracking-wide">{ticket.ticketId}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Status</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${getStatusBadgeClass(ticket.status)}`}>
                  {displayValue(ticket.status)}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Priority</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${getPriorityBadgeClass(ticket.priority)}`}>
                  {displayValue(ticket.priority)}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Logged On</p>
                <p className="text-white font-medium text-xs sm:text-sm">
                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Days Open</p>
                <p className="text-white font-semibold">{getDaysOpen(ticket)} Days</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Created By / Assigned To</p>
                <p className="text-white font-medium">
                  {displayValue((ticket as any).createdBy || (ticket as any).assignedTo)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Resolution Date</p>
                <p className="text-emerald-400 font-semibold text-xs sm:text-sm flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>Pending Confirmation</span>
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: CUSTOMER INFORMATION */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <span>Customer Information</span>
            </div>
            <div className="bg-background/80 border border-border/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted mb-1">Customer Name</p>
                <p className="text-white font-bold text-sm sm:text-base">{displayValue(ticket.customerName)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Phone Number</p>
                <p className="text-white font-medium">{displayValue(ticket.phoneNumber)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Email</p>
                <p className="text-white font-medium">{displayValue((ticket as any).email)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Platform</p>
                <p className="text-white font-medium">{displayValue(ticket.platform)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">State</p>
                <p className="text-white font-medium">{displayValue(ticket.state)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">City</p>
                <p className="text-white font-medium">{displayValue(ticket.city)}</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-muted mb-1">Address</p>
                <p className="text-white font-medium">{displayValue((ticket as any).address)}</p>
              </div>
            </div>
          </div>

          {/* SECTION 3: ORDER INFORMATION */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <span>Order Information</span>
            </div>
            <div className="bg-background/80 border border-border/80 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted mb-1">Order ID</p>
                <p className="text-white font-bold text-base">{displayValue(ticket.orderId)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Order Amount</p>
                <p className="text-emerald-400 font-bold text-base">{formatAmount(ticket.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Order Date</p>
                <p className="text-white font-medium">{displayValue(ticket.orderDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">AWB Number</p>
                <p className="text-white font-medium font-mono text-xs sm:text-sm">{displayValue(ticket.awbNumber)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Courier Partner</p>
                <p className="text-white font-medium">{displayValue(ticket.courierPartner)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Tracking ID / Link</p>
                <p className="text-white font-medium">
                  {displayValue((ticket as any).trackingId || (ticket as any).trackingUrl || (ticket as any).trackingLink)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted mb-1">Product / Order Details</p>
                <p className="text-white font-medium">
                  {displayValue((ticket as any).productDetails || (ticket as any).orderDetails || (ticket as any).productName)}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: ISSUE INFORMATION */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <span>Issue Information</span>
            </div>
            <div className="bg-background/80 border border-border/80 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted mb-1">Issue Type</p>
                  <p className="text-white font-semibold text-sm">{displayValue(ticket.issueType)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">{getSubIssueLabel(ticket.issueType)} / Resolution Required</p>
                  <p className="text-emerald-400 font-semibold text-sm">{displayValue(ticket.subIssue)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Original Description</p>
                <div className="bg-card/70 border border-border/70 rounded-xl p-3.5 text-white text-sm whitespace-pre-wrap leading-relaxed">
                  {displayValue(ticket.issueDescription)}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: QR INFORMATION */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <QrCode size={15} />
              <span>Customer QR</span>
            </div>
            <div className="bg-background/80 border border-border/80 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {hasQr ? (
                  <div
                    onClick={() => setEnlargedQrUrl(ticket.qrImageUrl!)}
                    className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-black shrink-0 cursor-pointer group relative shadow-sm hover:border-primary/60 transition-all"
                    title="Click to view QR"
                  >
                    <img
                      src={ticket.qrImageUrl!}
                      alt="Customer QR Preview"
                      className="w-full h-full object-contain p-0.5"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-semibold text-white">
                      <Eye size={12} />
                    </div>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-border/60 bg-white/5 flex items-center justify-center text-muted shrink-0">
                    <ImageIcon size={22} className="opacity-40" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">QR Available:</span>
                    {hasQr ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                        Yes
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-semibold">
                        No
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {hasQr ? 'Customer payment QR code is attached to this ticket.' : 'No QR image attached to this ticket.'}
                  </p>
                </div>
              </div>

              {hasQr && (
                <button
                  type="button"
                  onClick={() => setEnlargedQrUrl(ticket.qrImageUrl!)}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border text-slate-300 hover:text-white hover:border-primary/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Eye size={13} />
                  <span>View QR</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION 6: RESOLUTION INFORMATION */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 size={15} />
              <span>Resolution Information</span>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4 space-y-4">
              <div>
                <p className="text-xs text-muted mb-1.5">Payment Proof</p>
                <div className="flex items-center gap-3 bg-background/90 p-3 rounded-xl border border-emerald-500/30">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate" title={paymentFile?.name || 'N/A'}>
                      {paymentFile?.name || 'N/A'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                      <span>File Type: <strong className="text-emerald-300 font-semibold">PDF</strong></span>
                      {paymentFile?.size ? (
                        <>
                          <span>•</span>
                          <span>Size: {(paymentFile.size / 1024).toFixed(1)} KB</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted mb-1.5">Resolution Summary</p>
                <div className="bg-background/90 p-3.5 rounded-xl border border-emerald-500/30 text-emerald-100 text-sm whitespace-pre-wrap leading-relaxed italic">
                  "{displayValue(resolutionNotes)}"
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FIXED FOOTER */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-card shrink-0 gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onBackToEdit}
            className="px-5 py-2.5 rounded-xl border border-border text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            Back to Edit
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Resolving Ticket...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>Confirm Resolution</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Enlarged QR Lightbox */}
      {enlargedQrUrl && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[70] flex items-center justify-center p-4"
          onClick={() => setEnlargedQrUrl(null)}
        >
          <div
            className="relative max-w-lg max-h-[85vh] bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <h4 className="text-sm font-bold text-white">Customer QR Image</h4>
              <button
                type="button"
                onClick={() => setEnlargedQrUrl(null)}
                className="p-1 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={enlargedQrUrl}
              alt="Customer QR Code Full"
              className="max-w-full max-h-[65vh] rounded-xl object-contain mx-auto border border-border bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
