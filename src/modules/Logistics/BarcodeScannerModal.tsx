import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, CameraOff } from 'lucide-react';

interface BarcodeScannerModalProps {
  onScan: (text: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    
    const startScanner = async () => {
      try {
        // Start decoding from native camera
        const controls = await codeReader.decodeFromVideoDevice(
          undefined, // undefined selects default camera device
          videoRef.current!,
          (result: any) => {
            if (result) {
              const scannedText = result.getText();
              if (scannedText) {
                onScan(scannedText.trim());
              }
            }
          }
        );
        controlsRef.current = controls;
      } catch (err: any) {
        console.error('Camera scan failed to start:', err);
        setError('Camera scanner not available. Please use manual entry or USB barcode scanner.');
      }
    };

    startScanner();

    // Clean up streams on close
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-border/10 bg-slate-850">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            Scan Barcode / QR Code
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-xl border border-slate-700/60"
          >
            <X size={14} />
          </button>
        </div>

        {/* Video Preview */}
        <div className="p-5 flex-1 flex flex-col items-center justify-center min-h-[300px] bg-black/60 relative">
          {error ? (
            <div className="text-center text-xs text-red-400 font-semibold max-w-xs space-y-3">
              <CameraOff size={32} className="mx-auto opacity-55 text-red-500" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scan overlay scanner line */}
              <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-lg shadow-red-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border/10 bg-slate-850 flex justify-end h-16 items-center">
          <button
            onClick={onClose}
            className="h-9 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
