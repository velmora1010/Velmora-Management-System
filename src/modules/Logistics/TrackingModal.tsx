import React, { useState, useEffect, useRef } from 'react';
import db from '../../lib/db';
import { detectCourier } from '../../utils/courierDetector';
import { isCourierActive } from '../../config/courierConfig';
import { X, Search, Barcode, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import type { LogisticsOrder } from '../../types/logistics';
import { trackingEngine } from '../../services/tracking/trackingEngine';

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

  // Auto focus AWB input on modal open if there's no pre-existing uploaded AWB
  useEffect(() => {
    if (!order.awbNumber && inputRef.current) {
      inputRef.current.focus();
    }
  }, [order.awbNumber]);

  // Auto detect courier when AWB changes
  useEffect(() => {
    setCourier(detectCourier(awb));
  }, [awb]);

  // Clean hidden characters & trim spaces
  const cleanString = (val: string): string => {
    return val.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  };

  // Shared function to update order tracking and trigger immediate status sync
  const saveAndSyncTracking = async (cleanAwb: string, targetCourier: string) => {
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

      // 2. Save Tracking & Move to tracking stage with temporary 'Checking...' status
      await db.logistics_orders.update(order.id!, {
        awbNumber: cleanAwb,
        courier: targetCourier,
        stage: 'tracking',
        status: 'Checking...',
        orderType: order.orderType,
        state: order.state,
        syncedAt: new Date().toLocaleString()
      });

      onSaved();
      onClose();

      // Immediately run first tracking sync in background
      const syncToast = toast.loading('Fetching live tracking status from courier...');
      try {
        const syncResult = await trackingEngine.syncOrder(order.id!);
        toast.dismiss(syncToast);
        if (syncResult.success) {
          toast.success(`Tracking synced successfully: ${syncResult.status}`);
        } else {
          toast.error(`Tracking saved, but initial sync failed: ${syncResult.status}`);
        }
      } catch (err: any) {
        toast.dismiss(syncToast);
        toast.error('Tracking saved, but initial status sync failed.');
      }
    } catch (err: any) {
      toast.error(`Error saving tracking: ${err.message || String(err)}`);
    }
  };

  const handleSave = async () => {
    const cleanAwb = cleanString(awb);
    if (!cleanAwb) {
      toast.error('AWB number cannot be empty.');
      return;
    }
    const detected = detectCourier(cleanAwb);
    if (detected === 'Unsupported Courier' || detected === 'Unknown') {
      toast.error('Only ST Courier tracking is currently enabled.');
      return;
    }
    await saveAndSyncTracking(cleanAwb, detected);
  };

  const handleUseUploadedAwb = async () => {
    if (!order.awbNumber) return;
    const cleanAwb = cleanString(order.awbNumber);
    let targetCourier = order.courier;
    if (!targetCourier || targetCourier === 'Unknown') {
      targetCourier = detectCourier(cleanAwb);
    }
    if (targetCourier === 'Unsupported Courier' || targetCourier === 'Unknown') {
      toast.error('Only ST Courier tracking is currently enabled.');
      return;
    }
    await saveAndSyncTracking(cleanAwb, targetCourier);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleBarcodeScan = (scannedText: string) => {
    const cleanText = cleanString(scannedText);
    if (cleanText) {
      const detected = detectCourier(cleanText);
      if (detected === 'Unsupported Courier' || detected === 'Unknown') {
        toast.error('Only ST Courier tracking is currently enabled.');
        return;
      }
      setAwb(cleanText);
      setCourier(detected);
      setIsScannerOpen(false);
      toast.success(`AWB Scanned: ${cleanText}`);
    }
  };

  const cleanAwbVal = order.awbNumber ? order.awbNumber.trim() : '';
  const detectedUploadedCourier = detectCourier(cleanAwbVal);
  const isUploadedStAwb = cleanAwbVal !== '' && isCourierActive(detectedUploadedCourier);

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
        <div className="p-5 space-y-5">
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
          <div className="space-y-4">
            
            {/* 1. Uploaded AWB Option Card */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Uploaded Tracking Data</span>
              {isUploadedStAwb ? (
                <div className="bg-indigo-950/20 border border-indigo-500/25 p-4 rounded-xl flex flex-col gap-3 shadow-sm shadow-indigo-500/5">
                  <div className="flex justify-between items-center gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={10} /> Uploaded AWB Available
                      </span>
                      <p className="text-sm font-mono font-bold text-slate-200 mt-0.5 select-all">{order.awbNumber}</p>
                      <p className="text-[9px] text-slate-450 font-medium">
                        Courier: <span className="font-semibold text-slate-350">{detectedUploadedCourier}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUseUploadedAwb}
                      className="h-8 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-primary/10 cursor-pointer shrink-0"
                    >
                      Use & Track
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/20 border border-slate-800/40 p-4 rounded-xl flex items-center justify-between text-slate-500 italic text-xs">
                  <span>No uploaded ST Courier AWB available</span>
                </div>
              )}
            </div>

            {/* Section Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800/60"></div>
              <span className="flex-shrink mx-3.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider">Or Manual Setup</span>
              <div className="flex-grow border-t border-slate-800/60"></div>
            </div>

            {/* 2. Manual & Barcode scan sections */}
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
                      className="h-9 w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 text-xs text-slate-200 font-mono focus:outline-none focus:border-primary placeholder:text-slate-655 shadow-sm"
                    />
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="h-9 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 px-3.5 rounded-xl text-xs font-semibold transition-all shrink-0 shadow-sm cursor-pointer"
                    title="Scan using device camera"
                  >
                    <Barcode size={14} className="text-primary" /> Scan Barcode
                  </button>
                </div>
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
        </div>

        {/* Modal Footer */}
        <div className="p-5 pt-0 flex justify-end gap-3 mt-1 shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!awb}
            className="h-9 px-4 bg-primary hover:bg-primary-hover disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-primary/20 cursor-pointer font-bold"
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
