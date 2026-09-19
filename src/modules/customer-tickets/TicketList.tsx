import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Clock, Eye, CheckCircle2, X, Edit, FileText, Calendar as CalendarIcon, Download, Upload, Trash2, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { CustomerTicket, CustomIssueTypeRecord } from '../../types/customer-tickets';
import { customerTicketsService, downloadFileBlob } from '../../services/customerTicketsService';
import { DEFAULT_ISSUE_TYPES, getSubIssueLabel } from '../../config/ticketConfig';
import { DateRangePickerModal, DateRange } from '../../components/ui/DateRangePickerModal';
import { ConfirmResolutionModal } from './ConfirmResolutionModal';
import toast from 'react-hot-toast';

interface TicketListProps {
  tickets: CustomerTicket[];
  title: string;
  subtitle: string;
  emptyMessage: string;
  onTicketUpdated?: () => void;
}

export const TicketList: React.FC<TicketListProps> = ({ 
  tickets, 
  title, 
  subtitle, 
  emptyMessage,
  onTicketUpdated 
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Custom Categories
  const [customIssueTypes, setCustomIssueTypes] = useState<CustomIssueTypeRecord[]>([]);

  // Modal States
  const [viewingTicket, setViewingTicket] = useState<CustomerTicket | null>(null);
  const [resolvingTicket, setResolvingTicket] = useState<CustomerTicket | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    loadCustomCategories();
  }, []);

  const loadCustomCategories = async () => {
    const { customIssueTypes: cTypes } = await customerTicketsService.getCustomCategories();
    setCustomIssueTypes(cTypes);
  };

  // Combine Issue Types (Defaults + Custom, deduplicated case-insensitively and null-safe)
  const availableIssueTypes: string[] = [...DEFAULT_ISSUE_TYPES];
  customIssueTypes.forEach(c => {
    if (c?.name && !availableIssueTypes.some(d => d && d.toLowerCase() === c.name.toLowerCase())) {
      availableIssueTypes.push(c.name);
    }
  });

  // Centralized null-safe string normalizer for searching
  const safeStr = (val: any): string => (val ?? '').toString().toLowerCase().trim();

  const filteredTickets = tickets.filter(ticket => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q || (
      safeStr(ticket.ticketId).includes(q) ||
      safeStr(ticket.customerName).includes(q) ||
      safeStr(ticket.orderId).includes(q) ||
      safeStr(ticket.awbNumber).includes(q) ||
      safeStr(ticket.phoneNumber).includes(q) ||
      safeStr(ticket.courierPartner).includes(q) ||
      safeStr(ticket.platform).includes(q) ||
      safeStr(ticket.subIssue).includes(q) ||
      safeStr(ticket.issueType).includes(q) ||
      safeStr(ticket.issueDescription).includes(q) ||
      safeStr(ticket.state).includes(q) ||
      safeStr(ticket.city).includes(q)
    );
      
    const matchesStatus = statusFilter ? ticket.status === statusFilter : true;
    const matchesIssue = issueFilter ? ticket.issueType === issueFilter : true;

    // Date Range Match
    let matchesDate = true;
    if (dateRange && dateRange.startDate) {
      const ticketTime = new Date(ticket.createdAt).getTime();
      const startTime = dateRange.startDate.getTime();
      const endTime = dateRange.endDate ? dateRange.endDate.getTime() : startTime;
      matchesDate = ticketTime >= startTime && ticketTime <= endTime;
    }

    return matchesSearch && matchesStatus && matchesIssue && matchesDate;
  });

  const formatAmount = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(Number(val))) return null;
    const num = Number(val);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Open': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'In Progress': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Waiting for Customer': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Waiting for Courier': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Replacement Processing': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Refund Processing': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Resolved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'Urgent': return 'bg-red-500 text-white';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-black';
      case 'Low': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const isOverdue = (ticket: CustomerTicket) => {
    if (ticket.status === 'Resolved') return false;
    const createdDate = new Date(ticket.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
  };

  const getDaysOpen = (ticket: CustomerTicket) => {
    const end = ticket.resolvedAt ? new Date(ticket.resolvedAt) : new Date();
    const start = new Date(ticket.createdAt);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleDownloadQr = async (ticket: CustomerTicket) => {
    if (!ticket.qrImageUrl) {
      toast.error('No QR image available for download.');
      return;
    }
    try {
      toast.loading('Downloading QR code...', { id: 'qr-download' });
      let ext = 'png';
      try {
        const cleanUrl = ticket.qrImageUrl.split('?')[0];
        const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
        if (match && match[1]) {
          ext = match[1].toLowerCase();
        }
      } catch (e) {
        ext = 'png';
      }
      const filename = `Ticket_${ticket.ticketId}_QR.${ext}`;
      await downloadFileBlob(ticket.qrImageUrl, filename);
      toast.success('QR Code downloaded', { id: 'qr-download' });
    } catch (err: any) {
      toast.error('Failed to download QR code: ' + (err.message || 'Error'), { id: 'qr-download' });
    }
  };

  const handleDownloadPaymentProof = async (ticket: CustomerTicket) => {
    if (!ticket.paymentProofUrl) {
      toast.error('No payment proof available for download.');
      return;
    }
    try {
      toast.loading('Downloading payment proof...', { id: 'pdf-download' });
      const filename = ticket.paymentProofName || `Ticket_${ticket.ticketId}_Payment_Proof.pdf`;
      await downloadFileBlob(ticket.paymentProofUrl, filename);
      toast.success('Payment proof downloaded', { id: 'pdf-download' });
    } catch (err: any) {
      toast.error('Failed to download payment proof: ' + (err.message || 'Error'), { id: 'pdf-download' });
    }
  };

  const openResolveModal = (ticket: CustomerTicket) => {
    setResolvingTicket(ticket);
    setResolutionNotes(ticket.resolutionNotes || '');
    setPaymentFile(null);
    setValidationError('');
    setShowConfirmDialog(false);
  };

  const handlePaymentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdfMime = file.type === 'application/pdf';
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      setValidationError('Invalid file format. Payment Proof must be a PDF file (.pdf).');
      toast.error('Only PDF files are allowed for payment proof.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setValidationError('File size exceeds 15MB limit. Please select a smaller PDF.');
      toast.error('File size exceeds 15MB limit.');
      return;
    }

    setPaymentFile(file);
    setValidationError('');
  };

  const handleRemovePaymentFile = () => {
    setPaymentFile(null);
  };

  const handleProceedToConfirm = () => {
    if (!paymentFile) {
      setValidationError('Payment Proof (PDF) is mandatory to resolve a ticket.');
      toast.error('Payment Proof (PDF) is required.');
      return;
    }
    if (!resolutionNotes.trim()) {
      setValidationError('Short Description is mandatory to resolve a ticket.');
      toast.error('Short Description is required.');
      return;
    }
    setValidationError('');
    setShowConfirmDialog(true);
  };

  const handleConfirmResolve = async () => {
    if (!resolvingTicket) return;
    if (!paymentFile) {
      setValidationError('Payment Proof (PDF) is mandatory.');
      setShowConfirmDialog(false);
      return;
    }
    if (!resolutionNotes.trim()) {
      setValidationError('Short Description is mandatory.');
      setShowConfirmDialog(false);
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading('Uploading payment proof...', { id: 'resolve-ticket-toast' });
      
      const uploadRes = await customerTicketsService.uploadTicketPaymentProof(paymentFile);
      
      toast.loading('Saving resolution...', { id: 'resolve-ticket-toast' });
      await customerTicketsService.updateTicket(resolvingTicket.id!, {
        status: 'Resolved',
        paymentProofUrl: uploadRes.publicUrl,
        paymentProofName: uploadRes.fileName,
        resolutionNotes: resolutionNotes.trim(),
        resolvedAt: new Date().toISOString()
      });

      toast.success(`Ticket ${resolvingTicket.ticketId} marked as Resolved!`, { id: 'resolve-ticket-toast' });
      setResolvingTicket(null);
      setPaymentFile(null);
      setResolutionNotes('');
      setValidationError('');
      setShowConfirmDialog(false);
      if (onTicketUpdated) {
        onTicketUpdated();
      }
    } catch (err: any) {
      toast.error('Failed to resolve ticket: ' + (err.message || 'Unknown error'), { id: 'resolve-ticket-toast' });
      // Keep ticket open and modal open so user can fix and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for Date Filter Button Badge
  const getDateFilterLabel = (): string => {
    if (!dateRange || !dateRange.startDate) return 'Date Range';
    if (dateRange.label) return dateRange.label;
    
    const start = dateRange.startDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!dateRange.endDate || dateRange.startDate.toDateString() === dateRange.endDate.toDateString()) {
      return start;
    }
    const end = dateRange.endDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${start} – ${end}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-muted text-sm mt-1">{subtitle}</p>
        </div>
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Search by Name, Order ID, AWB, Phone, Sub-Issue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:border-primary outline-none"
          />
        </div>
        
        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-4 py-2 text-white text-sm focus:border-primary outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Waiting for Customer">Waiting for Customer</option>
            <option value="Waiting for Courier">Waiting for Courier</option>
            <option value="Replacement Processing">Replacement Processing</option>
            <option value="Refund Processing">Refund Processing</option>
            <option value="Resolved">Resolved</option>
          </select>

          {/* Issue Filter */}
          <select
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-4 py-2 text-white text-sm focus:border-primary outline-none"
          >
            <option value="">All Issues</option>
            {availableIssueTypes.map((issue) => (
              <option key={issue} value={issue}>{issue}</option>
            ))}
          </select>

          {/* Date Range Filter Button */}
          {dateRange ? (
            <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 text-primary font-semibold text-sm">
              <CalendarIcon size={16} />
              <span>{getDateFilterLabel()}</span>
              <button
                type="button"
                onClick={() => setDateRange(null)}
                className="ml-1 text-primary/70 hover:text-white transition-colors"
                title="Clear Date Filter"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="bg-background border border-border rounded-xl px-4 py-2 text-slate-300 hover:text-white hover:border-primary/50 transition-colors text-sm flex items-center gap-2"
            >
              <CalendarIcon size={16} className="text-muted" />
              <span>Date Range</span>
            </button>
          )}
        </div>
      </Card>

      <div className="grid gap-4">
        {filteredTickets.length === 0 ? (
          <Card className="p-12 text-center flex flex-col items-center text-muted">
            <AlertCircle size={48} className="mb-4 opacity-50" />
            <p>{emptyMessage}</p>
          </Card>
        ) : (
          filteredTickets.map(ticket => (
            <Card 
              key={ticket.id} 
              className="p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-white text-lg">{ticket.ticketId}</span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority} Priority
                    </span>
                    {isOverdue(ticket) && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <Clock size={12} /> Overdue
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted text-xs mb-1">Customer</p>
                      <p className="text-white font-medium">{ticket.customerName}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Order ID</p>
                      <p className="text-white font-medium">{ticket.orderId}</p>
                      {ticket.amount !== undefined && ticket.amount !== null && (
                        <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                          {formatAmount(ticket.amount)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Issue</p>
                      <p className="text-white font-medium">{ticket.issueType}</p>
                      {ticket.subIssue && (
                        <p className="text-xs text-primary font-medium mt-0.5">{ticket.subIssue}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-1">Days Open</p>
                      <p className="text-white font-medium">{getDaysOpen(ticket)} Days</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between lg:items-end border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 gap-3">
                  <div className="flex items-center lg:items-end justify-between lg:flex-col text-sm w-full lg:w-auto">
                    <div>
                      <p className="text-muted text-xs lg:text-right">Created: <span className="text-white font-medium">{new Date(ticket.createdAt).toLocaleDateString()}</span></p>
                    </div>
                    <div>
                      <p className="text-muted text-xs lg:text-right">Courier: <span className="text-white font-medium">{ticket.courierPartner || 'N/A'}</span></p>
                    </div>
                    <div>
                      <p className="text-muted text-xs lg:text-right">Platform: <span className="text-white font-medium">{ticket.platform || 'Not specified'}</span></p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button
                      onClick={() => setViewingTicket(ticket)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Eye size={14} /> View
                    </button>

                    {ticket.status !== 'Resolved' && (
                      <button
                        onClick={() => openResolveModal(ticket)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-xs font-semibold flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> Resolved
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-card border border-border text-muted hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold flex items-center gap-1.5"
                      title="Edit Ticket Details"
                    >
                      <Edit size={14} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* VIEW TICKET DETAILS MODAL */}
      {viewingTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" size={22} />
                <div>
                  <h3 className="text-xl font-bold text-white">Ticket Details - {viewingTicket.ticketId}</h3>
                  <p className="text-xs text-muted">Logged on {new Date(viewingTicket.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingTicket(null)}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-background/50 p-4 rounded-xl border border-border/50">
                <div>
                  <p className="text-xs text-muted mb-1">Status</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusColor(viewingTicket.status)}`}>
                    {viewingTicket.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Priority</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(viewingTicket.priority)}`}>
                    {viewingTicket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Days Open</p>
                  <p className="text-white font-semibold">{getDaysOpen(viewingTicket)} Days</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Customer & Order Info</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted">Customer Name</p>
                    <p className="text-white font-medium">{viewingTicket.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Phone Number</p>
                    <p className="text-white font-medium">{viewingTicket.phoneNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Platform</p>
                    <p className="text-white font-medium">{viewingTicket.platform || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Order ID</p>
                    <p className="text-white font-medium">{viewingTicket.orderId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Amount</p>
                    <p className="text-white font-medium">
                      {viewingTicket.amount !== undefined && viewingTicket.amount !== null
                        ? formatAmount(viewingTicket.amount)
                        : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Order Date</p>
                    <p className="text-white font-medium">{viewingTicket.orderDate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">AWB Number</p>
                    <p className="text-white font-medium">{viewingTicket.awbNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Courier Partner</p>
                    <p className="text-white font-medium">{viewingTicket.courierPartner || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">State</p>
                    <p className="text-white font-medium">{viewingTicket.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">City</p>
                    <p className="text-white font-medium">{viewingTicket.city || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border/50">
                <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Issue Description</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2 bg-background/40 p-3 rounded-xl border border-border/40">
                  <div>
                    <p className="text-xs text-muted mb-0.5">Issue Type</p>
                    <p className="text-white font-semibold">{viewingTicket.issueType}</p>
                  </div>
                  {viewingTicket.subIssue && (
                    <div>
                      <p className="text-xs text-muted mb-0.5">{getSubIssueLabel(viewingTicket.issueType)}</p>
                      <p className="text-primary font-semibold">{viewingTicket.subIssue}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Description</p>
                  <div className="bg-background p-3.5 rounded-xl border border-border text-white whitespace-pre-wrap leading-relaxed text-sm">
                    {viewingTicket.issueDescription}
                  </div>
                </div>
              </div>

              {/* Customer QR Image Section */}
              <div className="space-y-3 pt-3 border-t border-border/50">
                <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Customer QR Image</h4>
                {viewingTicket.qrImageUrl ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-background/40 p-3.5 rounded-xl border border-border/40">
                    <div 
                      className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-black cursor-pointer group relative shadow-md hover:border-primary/60 transition-all shrink-0"
                      onClick={() => setEnlargedImageUrl(viewingTicket.qrImageUrl!)}
                      title="Click to enlarge"
                    >
                      <img 
                        src={viewingTicket.qrImageUrl} 
                        alt="Customer QR Code" 
                        className="w-full h-full object-contain p-1" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-semibold text-white">
                        Enlarge
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted">Click thumbnail to view full size QR code</p>
                      <button
                        type="button"
                        onClick={() => handleDownloadQr(viewingTicket)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition-colors cursor-pointer"
                        title="Download Customer QR Code Image"
                      >
                        <Download size={14} />
                        <span>Download QR</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-background/40 px-3.5 py-2.5 rounded-xl border border-border/40 text-muted text-xs italic inline-flex items-center gap-2">
                    QR not available
                  </div>
                )}
              </div>

              {/* RESOLUTION DETAILS FOR RESOLVED TICKETS */}
              {viewingTicket.status === 'Resolved' && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={18} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Resolution Details</h4>
                  </div>
                  
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted mb-1">Resolved On</p>
                        <p className="text-emerald-300 font-semibold text-sm">
                          {viewingTicket.resolvedAt ? new Date(viewingTicket.resolvedAt).toLocaleString() : 'Recorded as Resolved'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-1">Payment Proof</p>
                        {viewingTicket.paymentProofUrl ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadPaymentProof(viewingTicket)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                            title="Download Payment Proof PDF"
                          >
                            <FileText size={14} />
                            <span>Download Payment PDF</span>
                            <Download size={13} />
                          </button>
                        ) : (
                          <p className="text-muted text-xs italic">No payment PDF attached</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted mb-1">Short Description</p>
                      <div className="bg-background/80 p-3 rounded-xl border border-emerald-500/20 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                        {viewingTicket.resolutionNotes || 'No description provided'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Internal Notes */}
              {viewingTicket.internalNotes && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Internal Notes</h4>
                  <div className="bg-background/80 p-3 rounded-xl border border-border text-slate-300">
                    {viewingTicket.internalNotes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end gap-3 bg-card/50 rounded-b-2xl">
              {viewingTicket.status !== 'Resolved' && (
                <button
                  onClick={() => {
                    const ticketToResolve = viewingTicket;
                    setViewingTicket(null);
                    openResolveModal(ticketToResolve);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} /> Resolved
                </button>
              )}
              <button
                onClick={() => setViewingTicket(null)}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION DETAILS FORM (STEP 1) */}
      {resolvingTicket && !showConfirmDialog && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <CheckCircle2 size={22} />
                <div>
                  <h3 className="text-lg font-bold text-white">Resolve Ticket - {resolvingTicket.ticketId}</h3>
                  <p className="text-xs text-muted">Customer: {resolvingTicket.customerName} (Order #{resolvingTicket.orderId})</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setResolvingTicket(null);
                  setPaymentFile(null);
                  setValidationError('');
                }}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Payment Proof Field (PDF Only) */}
              <div>
                <label className="block text-sm font-semibold text-white mb-1.5 flex items-center justify-between">
                  <span>Payment Proof (PDF) <span className="text-rose-400">*</span></span>
                  <span className="text-[11px] text-muted font-normal">PDF only (Max 15MB)</span>
                </label>

                {!paymentFile ? (
                  <div>
                    <input
                      type="file"
                      id="ticket-resolve-pdf-file"
                      accept="application/pdf,.pdf"
                      onChange={handlePaymentFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="ticket-resolve-pdf-file"
                      className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-border hover:border-emerald-500/60 bg-background/60 hover:bg-emerald-500/5 rounded-xl py-5 px-4 text-center cursor-pointer transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                        <Upload size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">Upload Payment PDF</p>
                        <p className="text-[11px] text-muted mt-0.5">Select official payment confirmation or receipt</p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-background/80 p-3 rounded-xl border border-emerald-500/30">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate" title={paymentFile.name}>
                        {paymentFile.name}
                      </p>
                      <p className="text-[11px] text-muted">
                        {(paymentFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="ticket-resolve-pdf-file-change"
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> Change
                      </label>
                      <input
                        type="file"
                        id="ticket-resolve-pdf-file-change"
                        accept="application/pdf,.pdf"
                        onChange={handlePaymentFileSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePaymentFile}
                        className="text-xs font-semibold text-rose-400 hover:underline flex items-center gap-1 ml-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-sm font-semibold text-white mb-1.5">
                  Short Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => {
                    setResolutionNotes(e.target.value);
                    if (e.target.value.trim()) setValidationError('');
                  }}
                  rows={3}
                  placeholder="Concise resolution note (e.g., Replacement dispatched via Delhivery, Refund of ₹479 credited to customer UPI)..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors text-sm"
                />
              </div>

              {validationError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setResolvingTicket(null);
                  setPaymentFile(null);
                  setValidationError('');
                }}
                className="px-4 py-2 rounded-xl border border-border text-muted hover:text-white hover:bg-white/5 transition-colors text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                Next: Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM TICKET RESOLUTION EXPANDED MODAL (STEP 2) */}
      {resolvingTicket && showConfirmDialog && (
        <ConfirmResolutionModal
          ticket={resolvingTicket}
          paymentFile={paymentFile}
          resolutionNotes={resolutionNotes}
          isSubmitting={isSubmitting}
          onBackToEdit={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmResolve}
          onClose={() => {
            setResolvingTicket(null);
            setPaymentFile(null);
            setResolutionNotes('');
            setShowConfirmDialog(false);
          }}
        />
      )}

      {/* DATE RANGE PICKER MODAL */}
      {showDatePicker && (
        <DateRangePickerModal
          initialRange={dateRange}
          onClose={() => setShowDatePicker(false)}
          onApply={(range) => {
            setDateRange(range);
            setShowDatePicker(false);
          }}
        />
      )}

      {/* ENLARGED QR IMAGE LIGHTBOX MODAL */}
      {enlargedImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          onClick={() => setEnlargedImageUrl(null)}
        >
          <div 
            className="relative max-w-3xl max-h-[90vh] bg-card border border-border rounded-2xl p-2 shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEnlargedImageUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 border border-slate-600 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg z-10"
              title="Close"
            >
              <X size={18} />
            </button>
            <img 
              src={enlargedImageUrl} 
              alt="Customer QR Code Full Size" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
