import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { customerTicketsService } from '../../services/customerTicketsService';
import type { CustomerTicket, TicketStatus } from '../../types/customer-tickets';
import toast from 'react-hot-toast';

export const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [status, setStatus] = useState<TicketStatus>('Open');
  const [internalNotes, setInternalNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) loadTicket(Number(id));
  }, [id]);

  const loadTicket = async (ticketId: number) => {
    const data = await customerTicketsService.getTicketById(ticketId);
    if (data) {
      setTicket(data);
      setStatus(data.status);
      setInternalNotes(data.internalNotes || '');
      setResolutionNotes(data.resolutionNotes || '');
    }
  };

  const handleSave = async () => {
    if (!ticket) return;
    
    if (status === 'Resolved' && !resolutionNotes.trim()) {
      toast.error('Resolution Notes are required when resolving a ticket.');
      return;
    }

    try {
      setIsSubmitting(true);
      await customerTicketsService.updateTicket(ticket.id!, {
        status,
        internalNotes,
        resolutionNotes,
        resolvedAt: status === 'Resolved' && ticket.status !== 'Resolved' ? new Date().toISOString() : ticket.resolvedAt
      });
      toast.success('Ticket updated successfully');
      navigate(status === 'Resolved' ? '/tickets/resolved' : '/tickets/open');
    } catch (err: any) {
      toast.error('Failed to update ticket: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ticket) {
    return <div className="p-8 text-center text-muted">Loading ticket...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-muted hover:text-white bg-card border border-border rounded-xl transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Ticket {ticket.ticketId}</h1>
          <p className="text-muted text-sm mt-1">Logged on {new Date(ticket.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Customer & Order Details</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-muted">Customer Name</p>
                <p className="text-white font-medium">{ticket.customerName}</p>
              </div>
              <div>
                <p className="text-muted">Phone Number</p>
                <p className="text-white font-medium">{ticket.phoneNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted">Location</p>
                <p className="text-white font-medium">{[ticket.city, ticket.state].filter(Boolean).join(', ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted">Order ID</p>
                <p className="text-white font-medium">{ticket.orderId}</p>
              </div>
              <div>
                <p className="text-muted">AWB Number</p>
                <p className="text-white font-medium">{ticket.awbNumber}</p>
              </div>
              <div>
                <p className="text-muted">Courier</p>
                <p className="text-white font-medium">{ticket.courierPartner || 'N/A'}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Issue Description</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <p className="text-muted text-sm">Type</p>
                  <p className="text-white font-medium">{ticket.issueType}</p>
                </div>
                <div>
                  <p className="text-muted text-sm">Priority</p>
                  <p className="text-white font-medium">{ticket.priority}</p>
                </div>
              </div>
              <div>
                <p className="text-white whitespace-pre-wrap bg-background p-4 rounded-xl border border-border">
                  {ticket.issueDescription}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Update Status</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Waiting for Customer">Waiting for Customer</option>
                  <option value="Waiting for Courier">Waiting for Courier</option>
                  <option value="Replacement Processing">Replacement Processing</option>
                  <option value="Refund Processing">Refund Processing</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Internal Notes</label>
                <textarea 
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                  placeholder="Private notes..."
                />
              </div>

              {status === 'Resolved' && (
                <div>
                  <label className="block text-sm font-medium text-amber-400 mb-1">Resolution Notes *</label>
                  <textarea 
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    required
                    className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-100 focus:border-amber-400 outline-none"
                    placeholder="How was this resolved?..."
                  />
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSubmitting || (status === 'Resolved' && !resolutionNotes.trim())}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} /> {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
