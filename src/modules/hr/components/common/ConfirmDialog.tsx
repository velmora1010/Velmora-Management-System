import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="flex items-start gap-4 py-2">
        <div
          className={`p-3 rounded-full flex-shrink-0 ${
            isDestructive ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
          }`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-300 leading-relaxed pt-1">{message}</p>
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-300 bg-white/5 border border-border rounded-xl hover:bg-white/10 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-sm transition-colors ${
            isDestructive
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
