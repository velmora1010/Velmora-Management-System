import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { customerTicketsService } from '../../services/customerTicketsService';
import type { CustomerTicket, IssueType, TicketPriority, CustomIssueTypeRecord } from '../../types/customer-tickets';
import { DEFAULT_ISSUE_TYPES, getSubOptionsForIssueType, hasSubOptions, getSubIssueLabel } from '../../config/ticketConfig';
import { AddCategoryModal } from './AddCategoryModal';
import toast from 'react-hot-toast';

export const AddTicket = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<CustomerTicket | null>(null);

  // Category State
  const [customIssueTypes, setCustomIssueTypes] = useState<CustomIssueTypeRecord[]>([]);
  const [customSubIssuesMap, setCustomSubIssuesMap] = useState<Record<string, string[]>>({});
  const [customIssueTypeIdMap, setCustomIssueTypeIdMap] = useState<Record<string, number>>({});

  // Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [modalCategoryType, setModalCategoryType] = useState<'issueType' | 'subIssue'>('issueType');

  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    orderId: '',
    orderDate: '',
    awbNumber: '',
    courierPartner: '',
    state: '',
    city: '',
    issueType: DEFAULT_ISSUE_TYPES[0] as IssueType,
    subIssue: '',
    issueDescription: '',
    priority: 'Low' as TicketPriority,
    internalNotes: ''
  });

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
  }, []);

  // Compute unified list of Issue Types (Defaults + Custom, deduplicated case-insensitively)
  const availableIssueTypes: string[] = [...DEFAULT_ISSUE_TYPES];
  customIssueTypes.forEach(c => {
    if (!availableIssueTypes.some(d => d.toLowerCase() === c.name.toLowerCase())) {
      availableIssueTypes.push(c.name);
    }
  });

  // Compute sub-options for currently selected issue type
  const availableSubOptions = getSubOptionsForIssueType(formData.issueType, customSubIssuesMap);

  const checkDuplicate = async (orderId: string, awbNumber: string) => {
    if (!orderId && !awbNumber) return;
    const existing = await customerTicketsService.checkDuplicateTicket(orderId, awbNumber);
    setDuplicateWarning(existing);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'issueType') {
      if (value === '__ADD_ISSUE_TYPE__') {
        setModalCategoryType('issueType');
        setShowAddCategoryModal(true);
        return;
      }

      const newIssueType = value as IssueType;
      const validSubOptions = getSubOptionsForIssueType(newIssueType, customSubIssuesMap);
      const isCurrentSubValid = validSubOptions.some(opt => opt.toLowerCase() === formData.subIssue.toLowerCase());
      
      setFormData(prev => ({
        ...prev,
        issueType: newIssueType,
        subIssue: isCurrentSubValid ? prev.subIssue : ''
      }));
      return;
    }

    if (name === 'subIssue') {
      if (value === '__ADD_SUB_ISSUE__') {
        setModalCategoryType('subIssue');
        setShowAddCategoryModal(true);
        return;
      }
      setFormData(prev => ({ ...prev, subIssue: value }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'orderId' || name === 'awbNumber') {
      const newOrderId = name === 'orderId' ? value : formData.orderId;
      const newAwbNumber = name === 'awbNumber' ? value : formData.awbNumber;
      checkDuplicate(newOrderId, newAwbNumber);
    }
  };

  const handleCategoryAdded = async (addedName: string) => {
    await loadCategories();
    setShowAddCategoryModal(false);

    if (modalCategoryType === 'issueType') {
      setFormData(prev => ({
        ...prev,
        issueType: addedName,
        subIssue: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        subIssue: addedName
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSubOptions(formData.issueType, customSubIssuesMap) && !formData.subIssue.trim()) {
      toast.error(`Please select a ${getSubIssueLabel(formData.issueType).replace('*', '').trim()} option.`);
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { ticketId } = await customerTicketsService.createTicket({
        ...formData,
        status: 'Open'
      });
      
      toast.success(`Ticket ${ticketId} created successfully`);
      navigate('/tickets/open');
    } catch (err: any) {
      toast.error('Failed to create ticket: ' + err.message);
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
              An open ticket ({duplicateWarning.ticketId}) already exists for this Order ID or AWB Number. 
              Created on: {new Date(duplicateWarning.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Customer Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Customer Name *</label>
                <input 
                  required
                  type="text" 
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Phone Number</label>
                <input 
                  type="text" 
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">State</label>
                  <input 
                    type="text" 
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="e.g. Maharashtra"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">City</label>
                  <input 
                    type="text" 
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="e.g. Mumbai"
                  />
                </div>
              </div>
            </div>

            {/* Order Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Order Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Order ID *</label>
                <input 
                  required
                  type="text" 
                  name="orderId"
                  value={formData.orderId}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="e.g. ORD-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">Order Date</label>
                <input 
                  type="date" 
                  name="orderDate"
                  value={formData.orderDate}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">AWB Number *</label>
                  <input 
                    required
                    type="text" 
                    name="awbNumber"
                    value={formData.awbNumber}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="e.g. AWB9876"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">Courier Partner</label>
                  <input 
                    type="text" 
                    name="courierPartner"
                    value={formData.courierPartner}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="e.g. Delhivery"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Issue Details */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Issue Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Issue Type *</label>
                <select 
                  required
                  name="issueType"
                  value={formData.issueType}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
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
                  <label className="block text-sm font-medium text-muted mb-1">{getSubIssueLabel(formData.issueType)}</label>
                  <select 
                    required
                    name="subIssue"
                    value={formData.subIssue}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
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
                <label className="block text-sm font-medium text-muted mb-1">Priority *</label>
                <select 
                  required
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Issue Description *</label>
              <textarea 
                required
                name="issueDescription"
                value={formData.issueDescription}
                onChange={handleChange}
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Describe the issue in detail..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Internal Notes</label>
              <textarea 
                name="internalNotes"
                value={formData.internalNotes}
                onChange={handleChange}
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Any internal notes for the team..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/tickets/open')}
              className="px-6 py-2.5 rounded-xl border border-border text-white hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
            >
              <X size={18} /> Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              <Save size={18} /> {isSubmitting ? 'Saving...' : 'Create Ticket'}
            </button>
          </div>
        </Card>
      </form>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <AddCategoryModal
          type={modalCategoryType}
          parentIssueType={formData.issueType}
          parentIssueTypeId={customIssueTypeIdMap[formData.issueType.toLowerCase()]}
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
