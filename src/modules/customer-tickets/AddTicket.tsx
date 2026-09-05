import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, AlertTriangle, Image as ImageIcon, Trash2, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { customerTicketsService } from '../../services/customerTicketsService';
import type { CustomerTicket, IssueType, TicketPriority, CustomIssueTypeRecord, CustomCourierPartnerRecord } from '../../types/customer-tickets';
import { DEFAULT_ISSUE_TYPES, DEFAULT_COURIER_PARTNERS, getSubOptionsForIssueType, hasSubOptions, getSubIssueLabel } from '../../config/ticketConfig';
import { AddCategoryModal } from './AddCategoryModal';
import toast from 'react-hot-toast';

export const AddTicket = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<CustomerTicket | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [customIssueTypes, setCustomIssueTypes] = useState<CustomIssueTypeRecord[]>([]);
  const [customSubIssuesMap, setCustomSubIssuesMap] = useState<Record<string, string[]>>({});
  const [customIssueTypeIdMap, setCustomIssueTypeIdMap] = useState<Record<string, number>>({});
  const [customCourierPartners, setCustomCourierPartners] = useState<CustomCourierPartnerRecord[]>([]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [modalCategoryType, setModalCategoryType] = useState<'issueType' | 'subIssue' | 'courierPartner'>('issueType');

  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    orderId: '',
    orderDate: '',
    courierPartner: '',
    state: '',
    issueType: DEFAULT_ISSUE_TYPES[0] as IssueType,
    subIssue: '',
    issueDescription: '',
    priority: 'Low' as TicketPriority,
  });

  const [orderIdError, setOrderIdError] = useState<string | null>(null);
  const [isCheckingOrderId, setIsCheckingOrderId] = useState(false);

  const loadCategories = async () => {
    const { customIssueTypes: cTypes, customSubIssues: cSub } = await customerTicketsService.getCustomCategories();
    setCustomIssueTypes(cTypes);
    const subMap: Record<string, string[]> = {};
    const idMap: Record<string, number> = {};
    cTypes.forEach(ct => { idMap[ct.name.toLowerCase()] = ct.id; });
    cSub.forEach(cs => {
      if (cs.issueTypeName) {
        const key = cs.issueTypeName;
        if (!subMap[key]) subMap[key] = [];
        if (!subMap[key].some(n => n.toLowerCase() === cs.name.toLowerCase())) subMap[key].push(cs.name);
      }
    });
    setCustomSubIssuesMap(subMap);
    setCustomIssueTypeIdMap(idMap);
  };

  const loadCourierPartners = async () => {
    try {
      const partners = await customerTicketsService.getCustomCourierPartners();
      setCustomCourierPartners(partners);
    } catch (err) {
      console.warn('Could not load custom courier partners:', err);
    }
  };

  useEffect(() => {
    loadCategories();
    loadCourierPartners();
  }, []);

  const availableIssueTypes: string[] = [...DEFAULT_ISSUE_TYPES];
  customIssueTypes.forEach(c => {
    if (!availableIssueTypes.some(d => d.toLowerCase() === c.name.toLowerCase())) availableIssueTypes.push(c.name);
  });

  const availableCourierPartners: string[] = [...DEFAULT_COURIER_PARTNERS];
  customCourierPartners.forEach(c => {
    if (!availableCourierPartners.some(d => d.toLowerCase() === c.name.toLowerCase())) availableCourierPartners.push(c.name);
  });

  const availableSubOptions = getSubOptionsForIssueType(formData.issueType, customSubIssuesMap);

  useEffect(() => {
    let isActive = true;
    const trimmed = formData.orderId ? formData.orderId.trim() : '';
    if (!trimmed) {
      setOrderIdError(null);
      setIsCheckingOrderId(false);
      return;
    }

    setIsCheckingOrderId(true);
    const timer = setTimeout(async () => {
      try {
        const { exists } = await customerTicketsService.checkOrderIdExists(trimmed);
        if (isActive) {
          setOrderIdError(exists ? `Order ID ${trimmed} already has a ticket.` : null);
        }
      } catch (err) {
        console.error('Error during real-time order id check:', err);
      } finally {
        if (isActive) {
          setIsCheckingOrderId(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [formData.orderId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'issueType') {
      if (value === '__ADD_ISSUE_TYPE__') { setModalCategoryType('issueType'); setShowAddCategoryModal(true); return; }
      const newIssueType = value as IssueType;
      const validSub = getSubOptionsForIssueType(newIssueType, customSubIssuesMap);
      const subValid = validSub.some(o => o.toLowerCase() === formData.subIssue.toLowerCase());
      setFormData(prev => ({ ...prev, issueType: newIssueType, subIssue: subValid ? prev.subIssue : '' }));
      return;
    }
    if (name === 'subIssue') {
      if (value === '__ADD_SUB_ISSUE__') { setModalCategoryType('subIssue'); setShowAddCategoryModal(true); return; }
      setFormData(prev => ({ ...prev, subIssue: value })); return;
    }
    if (name === 'courierPartner') {
      if (value === '__ADD_COURIER__') { setModalCategoryType('courierPartner'); setShowAddCategoryModal(true); return; }
      setFormData(prev => ({ ...prev, courierPartner: value })); return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryAdded = async (addedName: string) => {
    if (modalCategoryType === 'courierPartner') {
      await loadCourierPartners();
      setShowAddCategoryModal(false);
      setFormData(prev => ({ ...prev, courierPartner: addedName }));
      return;
    }
    await loadCategories();
    setShowAddCategoryModal(false);
    if (modalCategoryType === 'issueType') setFormData(prev => ({ ...prev, issueType: addedName, subIssue: '' }));
    else setFormData(prev => ({ ...prev, subIssue: addedName }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!validTypes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
      toast.error('Invalid file format. Only JPG, JPEG, PNG, and WEBP images are allowed.'); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size exceeds 5MB limit.'); return; }
    setQrFile(file); setQrPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl);
    setQrFile(null); setQrPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOrderId = formData.orderId.trim();
    if (orderIdError) { toast.error(orderIdError); return; }
    if (!trimmedOrderId) { toast.error('Order ID is required.'); return; }
    if (hasSubOptions(formData.issueType, customSubIssuesMap) && !formData.subIssue.trim()) {
      toast.error(`Please select a ${getSubIssueLabel(formData.issueType).replace('*', '').trim()} option.`); return;
    }
    try {
      const { exists } = await customerTicketsService.checkOrderIdExists(trimmedOrderId);
      if (exists) {
        const errMsg = `Order ID ${trimmedOrderId} already has a ticket.`;
        setOrderIdError(errMsg); toast.error(errMsg); return;
      }
    } catch (err: any) { console.error('Pre-submit duplicate check error:', err); }

    try {
      setIsSubmitting(true);
      let uploadedQrUrl: string | null = null;
      if (qrFile) {
        toast.loading('Uploading QR Image...', { id: 'qr-upload-toast' });
        try {
          const uploadRes = await customerTicketsService.uploadTicketQrImage(qrFile);
          uploadedQrUrl = uploadRes.publicUrl;
          toast.success('QR Image uploaded successfully', { id: 'qr-upload-toast' });
        } catch (uploadErr: any) {
          toast.dismiss('qr-upload-toast');
          toast.error('QR Image upload failed: ' + (uploadErr?.message || 'Unknown error'));
          setIsSubmitting(false); return;
        }
      }
      const { ticketId } = await customerTicketsService.createTicket({
        customerName: formData.customerName,
        phoneNumber: formData.phoneNumber,
        orderId: trimmedOrderId,
        orderDate: formData.orderDate,
        awbNumber: '',
        courierPartner: formData.courierPartner,
        state: formData.state,
        city: '',
        issueType: formData.issueType,
        subIssue: formData.subIssue || undefined,
        issueDescription: formData.issueDescription,
        priority: formData.priority,
        qrImageUrl: uploadedQrUrl,
        status: 'Open'
      });
      toast.success(`Ticket ${ticketId} created successfully`);
      navigate('/tickets/open');
    } catch (err: any) {
      const msg = err?.message || 'Failed to create ticket';
      if (msg.toLowerCase().includes('already has a ticket') || msg.toLowerCase().includes('order id')) {
        setOrderIdError(msg); toast.error(msg, { id: 'qr-upload-toast' });
      } else {
        toast.error('Failed to create ticket: ' + msg, { id: 'qr-upload-toast' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Customer Ticket</h1>
          <p className="text-muted text-sm mt-1">Log a new issue from a customer</p>
        </div>
      </div>

      {duplicateWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold">Duplicate Warning</h4>
            <p className="text-sm opacity-90 mt-1">
              A ticket ({duplicateWarning.ticketId}) already exists for this Order ID.
              Created on: {new Date(duplicateWarning.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Customer Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Customer Details</h3>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Customer Name *</label>
                <input required type="text" name="customerName" value={formData.customerName} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Phone Number</label>
                <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="e.g. 9876543210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">State</label>
                <input type="text" name="state" value={formData.state} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="e.g. Maharashtra" />
              </div>
            </div>

            {/* Order Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Order Information</h3>
              <div>
                <label className="block text-sm font-medium text-muted mb-1 flex items-center justify-between">
                  <span>Order ID *</span>
                  {isCheckingOrderId && <span className="text-xs text-primary animate-pulse font-normal">Checking...</span>}
                </label>
                <input required type="text" name="orderId" value={formData.orderId} onChange={handleChange}
                  className={`w-full bg-background border ${orderIdError ? 'border-rose-500 text-rose-200 focus:border-rose-500 focus:ring-rose-500' : 'border-border focus:border-primary focus:ring-primary'} rounded-xl px-4 py-2.5 text-white focus:ring-1 outline-none transition-all text-sm`}
                  placeholder="e.g. ORD-12345" />
                {orderIdError && (
                  <p className="text-rose-400 text-xs mt-1.5 font-medium flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                    <span>{orderIdError}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Order Date</label>
                <input type="date" name="orderDate" value={formData.orderDate} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Courier Partner</label>
                <select name="courierPartner" value={formData.courierPartner} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm">
                  <option value="">-- Select Courier Partner --</option>
                  {availableCourierPartners.map(cp => <option key={cp} value={cp}>{cp}</option>)}
                  <option disabled className="text-muted">──────────</option>
                  <option value="__ADD_COURIER__" className="text-primary font-semibold">+ Add</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1 flex items-center justify-between">
                  <span>QR Image</span>
                  <span className="text-[11px] text-muted/70 font-normal">JPG, PNG, WEBP (Max 5MB)</span>
                </label>
                {!qrFile ? (
                  <div>
                    <input type="file" id="qr-file-input" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleFileSelect} className="hidden" />
                    <label htmlFor="qr-file-input"
                      className="flex items-center justify-center gap-2.5 w-full border border-dashed border-border hover:border-primary/60 bg-background/50 hover:bg-white/5 rounded-xl py-3 px-4 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer transition-all">
                      <ImageIcon size={18} className="text-primary" />
                      <span>Upload QR Code Image</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 bg-background/60 p-3 rounded-xl border border-border">
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-black shrink-0 cursor-pointer"
                      onClick={() => setEnlargedImageUrl(qrPreviewUrl)} title="Click to enlarge">
                      <img src={qrPreviewUrl!} alt="QR Code Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{qrFile.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">{(qrFile.size / 1024).toFixed(1)} KB</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <label htmlFor="qr-file-input-change"
                          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
                          <RefreshCw size={12} /> Change Image
                        </label>
                        <input type="file" id="qr-file-input-change" accept="image/jpeg,image/png,image/webp,image/jpg" onChange={handleFileSelect} className="hidden" />
                        <button type="button" onClick={handleRemoveFile}
                          className="text-[11px] font-semibold text-rose-400 hover:underline flex items-center gap-1">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Issue Details */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Issue Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Issue Type *</label>
                <select required name="issueType" value={formData.issueType} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm">
                  {availableIssueTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  <option disabled className="text-muted">──────────</option>
                  <option value="__ADD_ISSUE_TYPE__" className="text-primary font-semibold">+ Add Issue Type</option>
                </select>
              </div>
              {availableSubOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">{getSubIssueLabel(formData.issueType)}</label>
                  <select required name="subIssue" value={formData.subIssue} onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm">
                    <option value="">-- Select Sub-Option --</option>
                    {availableSubOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    <option disabled className="text-muted">──────────</option>
                    <option value="__ADD_SUB_ISSUE__" className="text-primary font-semibold">+ Add Sub-Issue</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Priority *</label>
                <select required name="priority" value={formData.priority} onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Issue Description</label>
              <textarea name="issueDescription" value={formData.issueDescription} onChange={handleChange} rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Describe the issue in detail..." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => navigate('/tickets/open')}
              className="px-6 py-2.5 rounded-xl border border-border text-white hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
              <X size={18} /> Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !!orderIdError || isCheckingOrderId}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              <Save size={18} /> {isSubmitting ? 'Saving...' : 'Create Ticket'}
            </button>
          </div>
        </Card>
      </form>

      {showAddCategoryModal && (
        <AddCategoryModal
          type={modalCategoryType}
          parentIssueType={formData.issueType}
          parentIssueTypeId={customIssueTypeIdMap[formData.issueType.toLowerCase()]}
          existingNames={
            modalCategoryType === 'issueType' ? availableIssueTypes
              : modalCategoryType === 'courierPartner' ? availableCourierPartners
              : availableSubOptions
          }
          onClose={() => setShowAddCategoryModal(false)}
          onSuccess={handleCategoryAdded}
        />
      )}

      {enlargedImageUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImageUrl(null)}>
          <div className="relative max-w-xl max-h-[85vh] bg-card border border-border rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <h4 className="text-sm font-bold text-white">Customer QR Image</h4>
              <button type="button" onClick={() => setEnlargedImageUrl(null)}
                className="p-1 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>
            <img src={enlargedImageUrl} alt="Customer QR Code"
              className="max-w-full max-h-[70vh] rounded-xl object-contain mx-auto border border-border bg-black" />
          </div>
        </div>
      )}
    </div>
  );
};
