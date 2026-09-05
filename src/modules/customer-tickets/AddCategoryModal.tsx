import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { customerTicketsService } from '../../services/customerTicketsService';
import toast from 'react-hot-toast';

interface AddCategoryModalProps {
  type: 'issueType' | 'subIssue';
  parentIssueType?: string;
  parentIssueTypeId?: number;
  existingNames: string[];
  onClose: () => void;
  onSuccess: (addedName: string) => void;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  type,
  parentIssueType,
  parentIssueTypeId,
  existingNames,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSubIssue = type === 'subIssue';
  const title = isSubIssue 
    ? `Add Sub-Issue ${parentIssueType ? `(${parentIssueType})` : ''}`
    : 'Add Issue Type';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg(`${isSubIssue ? 'Sub-Issue' : 'Issue Type'} name is required.`);
      return;
    }

    // Client-side case-insensitive duplicate check
    const isDuplicate = existingNames.some(
      n => n.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setErrorMsg(`"${trimmedName}" already exists.`);
      return;
    }

    try {
      setIsSubmitting(true);
      if (isSubIssue) {
        if (!parentIssueType) {
          throw new Error('Please select an Issue Type before adding a Sub-Issue.');
        }

        let targetTypeId: number = parentIssueTypeId || 0;
        if (!targetTypeId) {
          // Resolve or create parent anchor row in ticket_issue_types case-insensitively
          const parentRecord = await customerTicketsService.ensureIssueTypeRecord(parentIssueType);
          targetTypeId = parentRecord.id;
        }

        await customerTicketsService.addCustomSubIssue(targetTypeId, trimmedName, description);
        toast.success(`Sub-Issue "${trimmedName}" created successfully!`);
      } else {
        await customerTicketsService.addCustomIssueType(trimmedName, description);
        toast.success(`Issue Type "${trimmedName}" created successfully!`);
      }

      onSuccess(trimmedName);
    } catch (err: any) {
      const msg = err.message || 'Failed to save category. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              {isSubIssue ? 'Sub-Issue Name' : 'Issue Type Name'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder={isSubIssue ? 'e.g. Resend Missing Item' : 'e.g. Courier Escalation'}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Description <span className="text-muted/60 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide context or instructions for support staff..."
              className="w-full bg-background border border-border rounded-xl p-3 text-white text-sm focus:border-primary outline-none transition-colors resize-none"
            />
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
