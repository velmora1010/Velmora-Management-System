import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, Clock, Eye, CheckCircle2, X, Edit, FileText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { CustomerTicket } from '../../types/customer-tickets';
import { customerTicketsService } from '../../services/customerTicketsService';
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

  // Modal States
  const [viewingTicket, setViewingTicket] = useState<CustomerTicket | null>(null);
  const [resolvingTicket, setResolvingTicket] = useState<CustomerTicket | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.awbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.phoneNumber.includes(searchTerm);
      
    const matchesStatus = statusFilter ? ticket.status === statusFilter : true;
    const matchesIssue = issueFilter ? ticket.issueType === issueFilter : true;

    return matchesSearch && matchesStatus && matchesIssue;
  });

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

  const handleConfirmResolve = async () => {
    if (!resolvingTicket) return;
    if (!resolutionNotes.trim()) {
      setValidationError('Please enter resolution notes before resolving this ticket.');
      return;
    }

    try {
      setIsSubmitting(true);
      await customerTicketsService.updateTicket(resolvingTicket.id!, {
        status: 'Resolved',
        resolutionNotes: resolutionNotes.trim(),
        resolvedAt: new Date().toISOString()
      });
      toast.success(`Ticket ${resolvingTicket.ticketId} marked as Resolved`);
      setResolvingTicket(null);
      setResolutionNotes('');
      setValidationError('');
      if (onTicketUpdated) {
        onTicketUpdated();
      }
    } catch (err: any) {
      toast.error('Failed to resolve ticket: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResolveModal = (ticket: CustomerTicket) => {
    setResolvingTicket(ticket);
    setResolutionNotes(ticket.resolutionNotes || '');
    setValidationError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-muted text-sm mt-1">{subtitle}</p>
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Search by Name, Order ID, AWB, Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-white focus:border-primary outline-none"
          />
        </div>
        
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-4 py-2 text-white focus:border-primary outline-none"
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

          <select
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-4 py-2 text-white focus:border-primary outline-none"
          >
            <option value="">All Issues</option>
            <option value="Transport Issue">Transport Issue</option>
            <option value="Delivery Delay">Delivery Delay</option>
            <option value="Damaged Product">Damaged Product</option>
            <option value="Replacement">Replacement</option>
            <option value="Refund">Refund</option>
            <option value="Wrong Product">Wrong Product</option>
            <option value="Missing Product">Missing Product</option>
            <option value="RTO Issue">RTO Issue</option>
            <option value="Customer Not Responding">Customer Not Responding</option>
            <option value="Other">Other</option>
          </select>
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
                      <p className="text-muted mb-1">Customer</p>
                      <p className="text-white font-medium">{ticket.customerName}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-1">Order ID</p>
                      <p className="text-white font-medium">{ticket.orderId}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-1">Issue</p>
                      <p className="text-white font-medium">{ticket.issueType}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-1">Days Open</p>
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
                    <p className="text-xs text-muted">Order ID</p>
                    <p className="text-white font-medium">{viewingTicket.orderId}</p>
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
                <div>
                  <p className="text-xs text-muted mb-1">Issue Type: <span className="text-white font-semibold">{viewingTicket.issueType}</span></p>
                  <div className="bg-background p-3.5 rounded-xl border border-border text-white whitespace-pre-wrap leading-relaxed">
                    {viewingTicket.issueDescription}
                  </div>
                </div>
              </div>

              {(viewingTicket.internalNotes || viewingTicket.resolutionNotes) && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Notes History</h4>
                  {viewingTicket.internalNotes && (
                    <div>
                      <p className="text-xs text-muted mb-1">Internal Notes</p>
                      <div className="bg-background/80 p-3 rounded-xl border border-border text-slate-300">
                        {viewingTicket.internalNotes}
                      </div>
                    </div>
                  )}
                  {viewingTicket.resolutionNotes && (
                    <div>
                      <p className="text-xs text-emerald-400 mb-1 font-semibold">Resolution Notes</p>
                      <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30 text-emerald-200">
                        {viewingTicket.resolutionNotes}
                      </div>
                    </div>
                  )}
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> Resolved
                </button>
              )}
              <button
                onClick={() => setViewingTicket(null)}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION NOTES INPUT MODAL */}
      {resolvingTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={22} />
                <h3 className="text-lg font-bold text-white">Resolve Ticket - {resolvingTicket.ticketId}</h3>
              </div>
              <button 
                onClick={() => setResolvingTicket(null)}
                className="p-1 rounded-lg text-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted">
              Please provide resolution notes detailing how this issue was resolved before marking it as completed.
            </p>

            <div>
              <label className="block text-sm font-semibold text-white mb-1.5">
                Resolution Notes <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => {
                  setResolutionNotes(e.target.value);
                  if (e.target.value.trim()) setValidationError('');
                }}
                rows={4}
                placeholder="Describe resolution (e.g., replacement item dispatched via AWB123, refund issued, transport delay settled with courier)..."
                className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors text-sm"
              />
              {validationError && (
                <p className="text-rose-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle size={13} /> {validationError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setResolvingTicket(null)}
                className="px-4 py-2 rounded-xl border border-border text-white hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmResolve}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
