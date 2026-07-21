import React, { useState, useEffect, useRef } from 'react';
import db from '../../lib/db';
import { detectCourier } from '../../utils/courierDetector';
import { X, Search, Barcode } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import type { LogisticsOrder } from '../../types/logistics';

interface TrackingModalProps {
  order: LogisticsOrder;
  onClose: () => void;
  onSaved: () => void;
}

export const TrackingModal: React.FC<TrackingModalProps> = ({ order, onClose, onSaved }) => {
  const [awb, setAwb] = useState('');
  const [courier, setCourier] = useState('Unknown');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus AWB input on modal open
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Auto detect courier when AWB changes
  useEffect(() => {
    setCourier(detectCourier(awb));
  }, [awb]);

  // Clean hidden characters & trim spaces
  const cleanString = (val: string): string => {
    return val.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  };

  const handleSave = async () => {
    const cleanAwb = cleanString(awb);
    if (!cleanAwb) {
      toast.error('AWB number cannot be empty.');
      return;
    }

    try {
      // 1. Duplicate AWB Protection
      const duplicateAwbOrder = await db.logistics_orders
        .where('awbNumber')
        .equals(cleanAwb)
        .first();

      if (duplicateAwbOrder && duplicateAwbOrder.stage !== 'trash' && duplicateAwbOrder.id !== order.id) {
        toast.error(`AWB ${cleanAwb} is already assigned to Order ID: ${duplicateAwbOrder.orderId}`);
        return;
      }

      // 2. Save Tracking & Move to tracking stage
      await db.logistics_orders.update(order.id!, {
        awbNumber: cleanAwb,
        courier: courier,
        stage: 'tracking',
        status: 'In Transit', // Initial status
        orderType: order.orderType,
        state: order.state,
        syncedAt: new Date().toLocaleString()
      });

      toast.success('Tracking information saved!');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(`Error saving tracking: ${err.message || String(err)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Barcode scanner hardware sends Enter key on submit
      e.preventDefault();
      handleSave();
    }
  };

  const handleBarcodeScan = (scannedText: string) => {
    const cleanText = cleanString(scannedText);
    if (cleanText) {
      setAwb(cleanText);
      setCourier(detectCourier(cleanText));
      setIsScannerOpen(false);
      toast.success(`AWB Scanned: ${cleanText}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-md shadow-2xl overflow-hidden relative">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-800/30">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Barcode size={16} className="text-primary" /> Track Order
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-700/60 hover:border-slate-600"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Order Brief */}
          <div className="bg-slate-950/40 p-3.5 rounded-xl border border-border/5 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted">Order No:</span>
              <span className="text-white font-mono font-bold">{order.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Order Type:</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                order.orderType === 'COD'
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  : order.orderType === 'PREPAID'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50'
              }`}>{order.orderType || 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Customer Name:</span>
              <span className="text-slate-200 font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Phone Number:</span>
              <span className="text-slate-200 font-medium">{order.phoneNumber}</span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="awb-input" className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                Courier AWB / Barcode Scan
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="awb-input"
                    ref={inputRef}
                    type="text"
                    value={awb}
                    onChange={(e) => setAwb(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scan barcode or enter AWB..."
                    className="h-9 w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 text-xs text-slate-200 font-mono focus:outline-none focus:border-primary placeholder:text-slate-600 shadow-sm"
                  />
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="h-9 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 px-3.5 rounded-xl text-xs font-semibold transition-all shrink-0 shadow-sm"
                  title="Scan using device camera"
                >
                  <Barcode size={14} className="text-primary" /> Scan Barcode
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Use scanner device or camera scan.
              </p>
            </div>

            <div className="bg-slate-950/20 p-2.5 rounded-xl border border-border/5 flex items-center justify-between text-xs">
              <span className="text-muted">Detected Courier:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                courier === 'Unknown'
                  ? 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                {courier}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 pt-0 flex justify-end gap-3 mt-1">
          <button
            onClick={onClose}
            className="h-9 px-4 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-9 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-primary/20"
          >
            Save Tracking
          </button>
        </div>
      </div>

      {/* Render Camera Scanner overlay */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onScan={handleBarcodeScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};
