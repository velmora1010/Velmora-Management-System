import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Trash2, Image as ImageIcon, RefreshCw, X, Download, Upload, FileText, CheckCircle2, AlertTriangle, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { customerTicketsService, downloadFileBlob } from '../../services/customerTicketsService';
import type { CustomerTicket, TicketStatus, IssueType, TicketPriority, TicketPlatform, CustomIssueTypeRecord } from '../../types/customer-tickets';
import { DEFAULT_ISSUE_TYPES, getSubOptionsForIssueType, hasSubOptions, getSubIssueLabel } from '../../config/ticketConfig';
import { AddCategoryModal } from './AddCategoryModal';
import toast from 'react-hot-toast';

export const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [status, setStatus] = useState<TicketStatus>('Open');
  const [platform, setPlatform] = useState<TicketPlatform | string>('');
  const [issueType, setIssueType] = useState<IssueType>('Transport Issue');
  const [subIssue, setSubIssue] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('Low');
  const [amount, setAmount] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Proof & Resolution Workflow States
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showConfirmResolveDialog, setShowConfirmResolveDialog] = useState(false);
  const [resolveValidationError, setResolveValidationError] = useState('');

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(Number(val))) return 'Not provided';
    const num = Number(val);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  // QR Image State
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);

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
      setPlatform(data.platform || '');
      setIssueType(data.issueType || DEFAULT_ISSUE_TYPES[0]);
      setSubIssue(data.subIssue || '');
      setPriority(data.priority || 'Low');
      setAmount(data.amount !== undefined && data.amount !== null ? String(data.amount) : '');
      setInternalNotes(data.internalNotes || '');
      setResolutionNotes(data.resolutionNotes || '');
      setQrImageUrl(data.qrImageUrl || null);
      setPaymentProofUrl(data.paymentProofUrl || null);
      setPaymentProofName(data.paymentProofName || null);
    }
  };

  const handleDownloadQr = async () => {
    const targetUrl = qrPreviewUrl || qrImageUrl;
    if (!targetUrl || !ticket) return;
    try {
      toast.loading('Downloading QR code...', { id: 'qr-download' });
      let ext = 'png';
      try {
        const cleanUrl = targetUrl.split('?')[0];
        const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
        if (match && match[1]) {
          ext = match[1].toLowerCase();
        }
      } catch (e) {
        ext = 'png';
      }
      const filename = `Ticket_${ticket.ticketId}_QR.${ext}`;
      await downloadFileBlob(targetUrl, filename);
      toast.success('QR Code downloaded', { id: 'qr-download' });
    } catch (err: any) {
      toast.error('Failed to download QR code: ' + (err.message || 'Error'), { id: 'qr-download' });
    }
  };

  const handleDownloadPaymentProof = async () => {
    if (!paymentProofUrl || !ticket) return;
    try {
      toast.loading('Downloading payment proof...', { id: 'pdf-download' });
      const filename = paymentProofName || `Ticket_${ticket.ticketId}_Payment_Proof.pdf`;
      await downloadFileBlob(paymentProofUrl, filename);
      toast.success('Payment proof downloaded', { id: 'pdf-download' });
    } catch (err: any) {
      toast.error('Failed to download payment proof: ' + (err.message || 'Error'), { id: 'pdf-download' });
    }
  };

  const openResolveModal = () => {
    setPaymentFile(null);
    setResolveValidationError('');
    setShowConfirmResolveDialog(false);
    setShowResolveModal(true);
  };

  const handlePaymentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdfMime = file.type === 'application/pdf';
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      setResolveValidationError('Invalid file format. Payment Proof must be a PDF file (.pdf).');
      toast.error('Only PDF files are allowed for payment proof.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setResolveValidationError('File size exceeds 15MB limit. Please select a smaller PDF.');
      toast.error('File size exceeds 15MB limit.');
      return;
    }

    setPaymentFile(file);
    setResolveValidationError('');
  };

  const handleRemovePaymentFile = () => {
    setPaymentFile(null);
  };

  const handleProceedToConfirmResolve = () => {
    if (!paymentFile) {
      setResolveValidationError('Payment Proof (PDF) is mandatory to resolve a ticket.');
      toast.error('Payment Proof (PDF) is required.');
      return;
    }
    if (!resolutionNotes.trim()) {
      setResolveValidationError('Short Description is mandatory to resolve a ticket.');
      toast.error('Short Description is required.');
      return;
    }
    setResolveValidationError('');
    setShowConfirmResolveDialog(true);
  };

  const handleConfirmResolve = async () => {
    if (!ticket) return;
    if (!paymentFile) {
      setResolveValidationError('Payment Proof (PDF) is mandatory.');
      setShowConfirmResolveDialog(false);
      return;
    }
    if (!resolutionNotes.trim()) {
      setResolveValidationError('Short Description is mandatory.');
      setShowConfirmResolveDialog(false);
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading('Uploading payment proof...', { id: 'resolve-toast' });
      const uploadRes = await customerTicketsService.uploadTicketPaymentProof(paymentFile);

      toast.loading('Saving resolution...', { id: 'resolve-toast' });
      await customerTicketsService.updateTicket(ticket.id!, {
        status: 'Resolved',
        paymentProofUrl: uploadRes.publicUrl,
        paymentProofName: uploadRes.fileName,
        resolutionNotes: resolutionNotes.trim(),
        resolvedAt: new Date().toISOString()
      });

      toast.success(`Ticket ${ticket.ticketId} marked as Resolved!`, { id: 'resolve-toast' });
      setShowResolveModal(false);
      setShowConfirmResolveDialog(false);
      navigate('/tickets/resolved');
    } catch (err: any) {
      toast.error('Failed to resolve ticket: ' + (err.message || 'Unknown error'), { id: 'resolve-toast' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!validTypes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
      toast.error('Invalid file format. Only JPG, JPEG, PNG, and WEBP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit. Please upload a smaller image.');
      return;
    }

    setQrFile(file);
    setQrPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    if (qrPreviewUrl) {
      URL.revokeObjectURL(qrPreviewUrl);
    }
    setQrFile(null);
    setQrPreviewUrl(null);
    setQrImageUrl(null);
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
    
    if (status === 'Resolved' && ticket.status !== 'Resolved') {
      openResolveModal();
      return;
    }

    if (hasSubOptions(issueType, customSubIssuesMap) && !subIssue.trim()) {
      toast.error(`Please select a ${getSubIssueLabel(issueType).replace('*', '').trim()} option.`);
      return;
    }

    let parsedAmount: number | null = null;
    if (amount.trim() !== '') {
      const num = Number(amount.trim());
      if (isNaN(num) || num < 0) {
        toast.error('Please enter a valid numeric amount.');
        return;
      }
      parsedAmount = num;
    }

    try {
      setIsSubmitting(true);
      let finalQrUrl = qrImageUrl;

      if (qrFile) {
        toast.loading('Uploading new QR Image...', { id: 'qr-update-toast' });
        const uploadRes = await customerTicketsService.uploadTicketQrImage(qrFile);
        finalQrUrl = uploadRes.publicUrl;
        toast.success('QR Image uploaded successfully', { id: 'qr-update-toast' });
      }

      await customerTicketsService.updateTicket(ticket.id!, {
        status,
        platform: platform ? platform : null,
        issueType,
        subIssue,
        priority,
        amount: parsedAmount,
        internalNotes,
        resolutionNotes,
        qrImageUrl: finalQrUrl,
        resolvedAt: status === 'Resolved' && ticket.status !== 'Resolved' ? new Date().toISOString() : ticket.resolvedAt
      });
      setTicket(prev => prev ? ({ ...prev, platform: platform ? platform : undefined }) : null);
      toast.success('Ticket updated successfully');
      navigate(status === 'Resolved' ? '/tickets/resolved' : '/tickets/open');
    } catch (err: any) {
      toast.error('Failed to update ticket: ' + err.message, { id: 'qr-update-toast' });
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
          onClick={() => navigate('/tickets/open')}
          className="p-2 text-muted hover:text-white bg-card border border-border rounded-xl transition-colors cursor-pointer"
          title="Back to Open Tickets"
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
                <p className="text-muted">Platform</p>
                <p className="text-white font-medium">{ticket.platform || 'Not specified'}</p>
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
              <div>
                <p className="text-muted">Amount</p>
                <p className="text-white font-medium">{formatCurrency(ticket.amount)}</p>
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

          {/* Customer QR Image View Card */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Customer QR Image</h3>
            {(qrPreviewUrl || qrImageUrl) ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-background/40 p-3.5 rounded-xl border border-border/40">
                <div 
                  className="w-32 h-32 rounded-xl overflow-hidden border border-border bg-black cursor-pointer group relative shadow-md hover:border-primary/60 transition-all shrink-0"
                  onClick={() => setEnlargedImageUrl(qrPreviewUrl || qrImageUrl)}
                  title="Click to enlarge"
                >
                  <img 
                    src={(qrPreviewUrl || qrImageUrl)!} 
                    alt="Customer QR Code" 
                    className="w-full h-full object-contain p-1" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-semibold text-white">
                    Enlarge
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted">Click thumbnail to view full size QR code</p>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition-colors cursor-pointer"
                    title="Download Customer QR Code"
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
          </Card>

          {/* RESOLUTION DETAILS CARD (FOR RESOLVED TICKETS) */}
          {ticket.status === 'Resolved' && (
            <Card className="p-6 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-2.5 border-b border-emerald-500/20 pb-3 mb-4 text-emerald-400">
                <CheckCircle2 size={22} />
                <h3 className="text-lg font-bold text-white">Resolution Details</h3>
              </div>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted text-xs mb-1">Resolved On</p>
                    <p className="text-emerald-300 font-semibold">
                      {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : 'Recorded as Resolved'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted text-xs mb-1">Payment Proof (PDF)</p>
                    {paymentProofUrl ? (
                      <button
                        type="button"
                        onClick={handleDownloadPaymentProof}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                        title="Download Payment Proof PDF"
                      >
                        <FileText size={14} />
                        <span>Download Payment PDF</span>
                        <Download size={13} />
                      </button>
                    ) : (
                      <p className="text-muted text-xs italic">No payment proof PDF attached</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted text-xs mb-1">Short Description / Resolution Notes</p>
                  <p className="text-white whitespace-pre-wrap bg-background/80 p-3.5 rounded-xl border border-emerald-500/20 text-sm">
                    {resolutionNotes || 'No notes provided'}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2 mb-4">Update Details & Status</h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Status</label>
                <select 
                  value={status}
                  onChange={(e) => {
                    const newStatus = e.target.value as TicketStatus;
                    if (newStatus === 'Resolved' && ticket.status !== 'Resolved') {
                      openResolveModal();
                    } else {
                      setStatus(newStatus);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none cursor-pointer"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Waiting for Customer">Waiting for Customer</option>
                  <option value="Waiting for Courier">Waiting for Courier</option>
                  <option value="Replacement Processing">Replacement Processing</option>
                  <option value="Refund Processing">Refund Processing</option>
                  <option value="Resolved">Resolved</option>
                </select>

                {ticket.status !== 'Resolved' && (
                  <button
                    type="button"
                    onClick={openResolveModal}
                    className="mt-2 w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={15} /> Resolve Ticket with Payment Proof
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Platform</label>
                <select 
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as TicketPlatform)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary outline-none cursor-pointer"
                >
                  <option value="">Select Platform</option>
                  <option value="Zoko WhatsApp">Zoko WhatsApp</option>
                  <option value="Mobile WhatsApp">Mobile WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Instagram">Instagram</option>
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
                <label className="block text-sm font-medium text-muted mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-muted text-sm font-semibold">₹</span>
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-2.5 text-white focus:border-primary outline-none text-sm"
                    placeholder="Enter Amount"
                  />
                </div>
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

              <div>
                <label className="block text-sm font-medium text-muted mb-1 flex items-center justify-between">
                  <span>QR Image</span>
                  <span className="text-[11px] text-muted/70 font-normal">JPG, PNG, WEBP (Max 5MB)</span>
                </label>

                {!(qrPreviewUrl || qrImageUrl) ? (
                  <div>
                    <input
                      type="file"
                      id="qr-file-edit-input"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="qr-file-edit-input"
                      className="flex items-center justify-center gap-2 w-full border border-dashed border-border hover:border-primary/60 bg-background/50 hover:bg-white/5 rounded-xl py-2.5 px-3 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer transition-all"
                    >
                      <ImageIcon size={16} className="text-primary" />
                      <span>Upload QR Image</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-background/60 p-2.5 rounded-xl border border-border">
                    <div 
                      className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-black shrink-0 cursor-pointer"
                      onClick={() => setEnlargedImageUrl(qrPreviewUrl || qrImageUrl)}
                      title="Click to enlarge"
                    >
                      <img src={(qrPreviewUrl || qrImageUrl)!} alt="QR Code Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {qrFile ? qrFile.name : 'Uploaded QR Image'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <label
                          htmlFor="qr-file-edit-input-change"
                          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw size={11} /> Change
                        </label>
                        <input
                          type="file"
                          id="qr-file-edit-input-change"
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="text-[11px] font-semibold text-rose-400 hover:underline flex items-center gap-1 ml-2"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

      {/* Enlarged QR Image Lightbox Modal */}
      {enlargedImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImageUrl(null)}
        >
          <div 
            className="relative max-w-xl max-h-[85vh] bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <h4 className="text-sm font-bold text-white">Customer QR Image</h4>
              <button
                type="button"
                onClick={() => setEnlargedImageUrl(null)}
                className="p-1 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img 
              src={enlargedImageUrl} 
              alt="Customer QR Code" 
              className="max-w-full max-h-[70vh] rounded-xl object-contain mx-auto border border-border bg-black" 
            />
          </div>
        </div>
      )}

      {/* RESOLUTION WORKFLOW MODAL (2-STEP: DETAILS FORM + CONFIRMATION) */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-5">
            {!showConfirmResolveDialog ? (
              // STEP 1: RESOLUTION DETAILS FORM
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5 text-emerald-400">
                    <CheckCircle2 size={22} />
                    <div>
                      <h3 className="text-lg font-bold text-white">Resolve Ticket - {ticket.ticketId}</h3>
                      <p className="text-xs text-muted">Customer: {ticket.customerName} (Order #{ticket.orderId})</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowResolveModal(false);
                      setPaymentFile(null);
                      setResolveValidationError('');
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
                          id="ticket-details-pdf-file"
                          accept="application/pdf,.pdf"
                          onChange={handlePaymentFileSelect}
                          className="hidden"
                        />
                        <label
                          htmlFor="ticket-details-pdf-file"
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
                            htmlFor="ticket-details-pdf-file-change"
                            className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> Change
                          </label>
                          <input
                            type="file"
                            id="ticket-details-pdf-file-change"
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
                        if (e.target.value.trim()) setResolveValidationError('');
                      }}
                      rows={3}
                      placeholder="Concise resolution note (e.g., Replacement dispatched via Delhivery, Refund of ₹479 credited to customer UPI)..."
                      className="w-full bg-background border border-border rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors text-sm"
                    />
                  </div>

                  {resolveValidationError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{resolveValidationError}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResolveModal(false);
                      setPaymentFile(null);
                      setResolveValidationError('');
                    }}
                    className="px-4 py-2 rounded-xl border border-border text-muted hover:text-white hover:bg-white/5 transition-colors text-sm font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToConfirmResolve}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    Next: Confirm Resolution
                  </button>
                </div>
              </>
            ) : (
              // STEP 2: CONFIRMATION DIALOG
              <>
                <div className="flex items-center gap-3 border-b border-border pb-3 text-amber-400">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Confirm Ticket Resolution</h3>
                    <p className="text-xs text-muted">Please confirm marking this ticket as Resolved.</p>
                  </div>
                </div>

                <div className="bg-background/80 p-4 rounded-xl border border-border/70 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted">Ticket ID</p>
                      <p className="text-white font-semibold">{ticket.ticketId}</p>
                    </div>
                    <div>
                      <p className="text-muted">Customer</p>
                      <p className="text-white font-semibold">{ticket.customerName}</p>
                    </div>
                    <div>
                      <p className="text-muted">Order ID</p>
                      <p className="text-white font-semibold">{ticket.orderId}</p>
                    </div>
                    <div>
                      <p className="text-muted">Payment Proof</p>
                      <p className="text-emerald-400 font-semibold truncate" title={paymentFile?.name}>
                        {paymentFile?.name}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-2 text-xs">
                    <p className="text-muted mb-1">Resolution Summary</p>
                    <p className="text-slate-200 italic bg-card/60 p-2.5 rounded-lg border border-border/40">
                      "{resolutionNotes.trim()}"
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-border">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowConfirmResolveDialog(false)}
                    className="px-4 py-2 rounded-xl border border-border text-muted hover:text-white hover:bg-white/5 transition-colors text-sm font-medium cursor-pointer"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmResolve}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Resolving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Confirm Resolution</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
