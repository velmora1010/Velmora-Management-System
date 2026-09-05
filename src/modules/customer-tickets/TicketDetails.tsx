import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { customerTicketsService } from '../../services/customerTicketsService';
import type { CustomerTicket, TicketStatus, IssueType, TicketPriority, CustomIssueTypeRecord } from '../../types/customer-tickets';
import { DEFAULT_ISSUE_TYPES, getSubOptionsForIssueType, hasSubOptions, getSubIssueLabel } from '../../config/ticketConfig';
import { AddCategoryModal } from './AddCategoryModal';
import toast from 'react-hot-toast';

export const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [status, setStatus] = useState<TicketStatus>('Open');
  const [issueType, setIssueType] = useState<IssueType>('Transport Issue');
  const [subIssue, setSubIssue] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('Low');
  const [internalNotes, setInternalNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Categories State
  const [customIssueTypes, setCustomIssueTypes] = useState<CustomIssueTypeRecord[]>([]);
  const [customSubIssuesMap, setCustomSubIssuesMap] = useState<Record<string, string[]>>({});
  const [customIssueTypeIdMap, setCustomIssueTypeIdMap] = useState<Record<string, number>>({});

  // Add Category Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [modalCategoryType, setModalCategoryType] = useState<'issueType' | 'subIssue'>('issueType');

  const loadCategories = async () => {
    const { customIssueTypes: cTypes, customSubIssues: cSub } = await customerTicketsService.getCustomCategories();
    setCustomIssueTypes(cTypes);

    const subMap: Record<string, string[]> = {};
    const idMap: Record<string, number> = {};

    cTypes.forEach(ct => {
      idMap[ct.name.toLowerCase()] = ct.id;
    });

    cSub.forEach(cs => {
      if (cs.issueTypeName) {
        const key = cs.issueTypeName;
        if (!subMap[key]) subMap[key] = [];
        if (!subMap[key].some(n => n.toLowerCase() === cs.name.toLowerCase())) {
          subMap[key].push(cs.name);
        }
      }
    });

    setCustomSubIssuesMap(subMap);
    setCustomIssueTypeIdMap(idMap);
  };

  useEffect(() => {
    loadCategories();
    if (id) loadTicket(Number(id));
  }, [id]);

  // Compute available Issue Types (Defaults + Custom)
  const availableIssueTypes: string[] = [...DEFAULT_ISSUE_TYPES];
  customIssueTypes.forEach(c => {
    if (!availableIssueTypes.some(d => d.toLowerCase() === c.name.toLowerCase())) {
      availableIssueTypes.push(c.name);
    }
  });

  // Compute available sub-options for current issue type
  const availableSubOptions = getSubOptionsForIssueType(issueType, customSubIssuesMap);

  const handleDelete = async () => {
    if (!ticket) return;
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      setIsSubmitting(true);
      await customerTicketsService.deleteTicket(ticket.id!);
      toast.success('Ticket deleted successfully');
      navigate('/tickets/open');
    } catch (err: any) {
      toast.error('Failed to delete ticket: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadTicket = async (ticketId: number) => {
    const data = await customerTicketsService.getTicketById(ticketId);
    if (data) {
      setTicket(data);
      setStatus(data.status);
      setIssueType(data.issueType || DEFAULT_ISSUE_TYPES[0]);
      setSubIssue(data.subIssue || '');
      setPriority(data.priority || 'Low');
      setInternalNotes(data.internalNotes || '');
      setResolutionNotes(data.resolutionNotes || '');
    }
  };

  const handleIssueTypeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__ADD_ISSUE_TYPE__') {
      setModalCategoryType('issueType');
      setShowAddCategoryModal(true);
      return;
    }

    const newType = value as IssueType;
    setIssueType(newType);
    const validOptions = getSubOptionsForIssueType(newType, customSubIssuesMap);
    const isValidSub = validOptions.some(opt => opt.toLowerCase() === subIssue.toLowerCase());
    if (!isValidSub) {
      setSubIssue('');
    }
  };

  const handleSubIssueSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__ADD_SUB_ISSUE__') {
      setModalCategoryType('subIssue');
      setShowAddCategoryModal(true);
      return;
    }
    setSubIssue(value);
  };

  const handleCategoryAdded = async (addedName: string) => {
    await loadCategories();
    setShowAddCategoryModal(false);

    if (modalCategoryType === 'issueType') {
      setIssueType(addedName);
      setSubIssue('');
    } else {
      setSubIssue(addedName);
    }
  };

  const handleSave = async () => {
    if (!ticket) return;
    
    if (status === 'Resolved' && !resolutionNotes.trim()) {
      toast.error('Resolution Notes are required when resolving a ticket.');
      return;
    }

    if (hasSubOptions(issueType, customSubIssuesMap) && !subIssue.trim()) {
      toast.error(`Please select a ${getSubIssueLabel(issueType).replace('*', '').trim()} option.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await customerTicketsService.updateTicket(ticket.id!, {
        status,
        issueType,
        subIssue,
        priority,
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
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Issue Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-muted text-sm">Issue Type</p>
                  <p className="text-white font-medium">{ticket.issueType}</p>
                </div>
                {ticket.subIssue && (
                  <div>
                    <p className="text-muted text-sm">Resolution / Sub-Issue</p>
                    <p className="text-emerald-400 font-semibold">{ticket.subIssue}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted text-sm">Priority</p>
                  <p className="text-white font-medium">{ticket.priority}</p>
                </div>
              </div>
              <div>
                <p className="text-muted text-sm mb-1">Description</p>
                <p className="text-white whitespace-pre-wrap bg-background p-4 rounded-xl border border-border text-sm">
                  {ticket.issueDescription}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Update Details & Status</h3>
            
            <div className="space-y-4 text-sm">
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
                <label className="block text-sm font-medium text-muted mb-1">Issue Type</label>
                <select 
                  value={issueType}
                  onChange={handleIssueTypeSelect}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                >
                  {availableIssueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option disabled className="text-muted">──────────</option>
                  <option value="__ADD_ISSUE_TYPE__" className="text-primary font-semibold">
                    + Add Issue Type
                  </option>
                </select>
              </div>

              {availableSubOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">{getSubIssueLabel(issueType)}</label>
                  <select 
                    value={subIssue}
                    onChange={handleSubIssueSelect}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                  >
                    <option value="">-- Select Sub-Option --</option>
                    {availableSubOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option disabled className="text-muted">──────────</option>
                    <option value="__ADD_SUB_ISSUE__" className="text-primary font-semibold">
                      + Add Sub-Issue
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Priority</label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
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

              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="w-full bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50 mt-3"
              >
                <Trash2 size={18} /> Delete Ticket
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <AddCategoryModal
          type={modalCategoryType}
          parentIssueType={issueType}
          parentIssueTypeId={customIssueTypeIdMap[issueType.toLowerCase()]}
          existingNames={
            modalCategoryType === 'issueType'
              ? availableIssueTypes
              : availableSubOptions
          }
          onClose={() => setShowAddCategoryModal(false)}
          onSuccess={handleCategoryAdded}
        />
      )}
    </div>
  );
};
