import React from 'react';
import { Truck, AlertTriangle, Check, X, Package } from 'lucide-react';

interface ConfirmMoveToPrepareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  totalAmount: number;
  isMoving: boolean;
}

export const ConfirmMoveToPrepareModal: React.FC<ConfirmMoveToPrepareModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  totalAmount,
  isMoving
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-300 mb-4 shadow-sm">
          <Truck size={24} />
        </div>

        <h3 className="text-lg font-bold text-white mb-2">
          Move to Prepare Dispatch?
        </h3>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          You have selected <strong className="text-purple-300">{selectedCount} eligible order{selectedCount === 1 ? '' : 's'}</strong> totaling{' '}
          <strong className="text-emerald-400">₹{Math.round(totalAmount).toLocaleString('en-IN')}</strong>.
        </p>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 mb-5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Orders to Move:</span>
            <span className="font-mono font-bold text-white">{selectedCount}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Destination:</span>
            <span className="font-semibold text-purple-300">Prepare Dispatch Queue</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Action Required Next:</span>
            <span className="text-slate-300">Assign Courier & AWB numbers</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isMoving}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isMoving || selectedCount === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMoving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Moving Orders...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Move to Prepare Dispatch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
