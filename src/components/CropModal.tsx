"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, Loader2, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize, Save } from 'lucide-react';
import styles from './CropModal.module.css';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  initialOrderId?: string;
  onConfirm: (croppedImageDataUrl: string) => Promise<{awb: string, confidence: number}>;
  onSave: (orderId: string, awb: string, confidence: number) => Promise<void>;
}

export default function CropModal({ isOpen, onClose, imageUrl, initialOrderId = '', onConfirm, onSave }: CropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Transformations
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [displayImage, setDisplayImage] = useState(imageUrl);
  const [isTransforming, setIsTransforming] = useState(false);

  // Editor State
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [detectedOrderId, setDetectedOrderId] = useState(initialOrderId);
  const [detectedAwb, setDetectedAwb] = useState('');
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setCrop(undefined);
      setCompletedCrop(null);
      setRotation(0);
      setZoom(1);
      setDisplayImage(imageUrl);
      setIsOcrRunning(false);
      setDetectedOrderId(initialOrderId);
      setDetectedAwb('');
      setDetectedConfidence(0);
      setErrorMsg('');
    }
  }, [isOpen, imageUrl, initialOrderId]);

  // Apply actual Canvas Rotation so ReactCrop's coordinates don't break
  const applyRotation = async (degrees: number) => {
    setIsTransforming(true);
    let newRotation = rotation + degrees;
    if (newRotation >= 360) newRotation -= 360;
    if (newRotation < 0) newRotation += 360;
    
    setRotation(newRotation);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsTransforming(false);
        return;
      }

      if (newRotation % 180 !== 0) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((newRotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      setDisplayImage(canvas.toDataURL('image/png'));
      setIsTransforming(false);
    };
    img.src = imageUrl; // Always rotate from original to avoid degradation
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    if (!crop) {
      const initialCrop = centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
        width,
        height
      );
      setCrop(initialCrop);
    }
  };

  const runOcrOnCrop = useCallback(async (c: Crop) => {
    if (!c?.width || !c?.height || !imgRef.current) return;
    
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = c.width * scaleX;
    canvas.height = c.height * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      c.x * scaleX,
      c.y * scaleY,
      c.width * scaleX,
      c.height * scaleY,
      0,
      0,
      c.width * scaleX,
      c.height * scaleY
    );

    const base64Image = canvas.toDataURL('image/png');
    
    setIsOcrRunning(true);
    setErrorMsg('');
    try {
      const result = await onConfirm(base64Image);
      setDetectedAwb(result.awb);
      setDetectedConfidence(result.confidence);
    } catch (e) {
      setErrorMsg('OCR extraction failed. Try a cleaner crop.');
    } finally {
      setIsOcrRunning(false);
    }
  }, [onConfirm]);

  const handleCropComplete = (c: Crop) => {
    setCompletedCrop(c);
    runOcrOnCrop(c);
  };

  const handleSave = async () => {
    setErrorMsg('');
    const trimmedOrderId = detectedOrderId.trim();
    if (!trimmedOrderId || !/^[0-9]+$/.test(trimmedOrderId)) {
      setErrorMsg("Order ID must be numeric.");
      return;
    }

    const digitsOnly = detectedAwb.replace(/[^0-9]/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 12 || digitsOnly === '9626198278' || digitsOnly === '8438819400') {
      setErrorMsg("Enter a valid 10-12 digit ST Courier AWB.");
      return;
    }
    
    await onSave(trimmedOrderId, digitsOnly, 100);
    onClose();
  };

  const isAwbValid = detectedAwb && detectedAwb.replace(/[^0-9]/g, '').length >= 10 && detectedAwb.replace(/[^0-9]/g, '').length <= 12;
  const isOrderIdValid = detectedOrderId && detectedOrderId.trim().length > 0;
  const statusVal = (isAwbValid && isOrderIdValid) ? 'Success' : 'Needs Review';

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        
        <div className={styles.header}>
          <h3>Manual AWB Editor</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.contentRow}>
          
          {/* LEFT PANEL: IMAGE & CROP */}
          <div className={styles.leftPanel}>
            <div className={styles.toolbar}>
              <button className={styles.toolbarBtn} onClick={() => applyRotation(-90)} disabled={isTransforming}>
                <RotateCcw size={16} /> Rotate Left
              </button>
              <button className={styles.toolbarBtn} onClick={() => applyRotation(90)} disabled={isTransforming}>
                <RotateCw size={16} /> Rotate Right
              </button>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>
              <button className={styles.toolbarBtn} onClick={() => setZoom(z => Math.min(z + 0.25, 3))}>
                <ZoomIn size={16} /> Zoom In
              </button>
              <button className={styles.toolbarBtn} onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}>
                <ZoomOut size={16} /> Zoom Out
              </button>
              <button className={styles.toolbarBtn} onClick={() => { setZoom(1); setRotation(0); setDisplayImage(imageUrl); }}>
                <Maximize size={16} /> Reset
              </button>
            </div>

            <div className={styles.cropContainerWrapper}>
              {isOcrRunning && (
                <div className={styles.ocrOverlay}>
                  <Loader2 size={16} className="animate-spin" />
                  Reading AWB...
                </div>
              )}
              
              <div 
                className={styles.cropContainer} 
                style={{ 
                  transform: `scale(${zoom})`, 
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                  opacity: isTransforming ? 0.5 : 1
                }}
              >
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={handleCropComplete}
                >
                  <img
                    ref={imgRef}
                    src={displayImage}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '65vh', maxWidth: '100%', display: 'block' }}
                    alt="Crop workspace"
                  />
                </ReactCrop>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: PROPERTIES & ACTIONS */}
          <div className={styles.rightPanel}>
            <div className={styles.panelTitle}>
              Shipment Details
            </div>

            <div className={styles.fieldGroup}>
              <label>Detected Order ID</label>
              <input 
                type="text" 
                value={detectedOrderId} 
                onChange={e => { setDetectedOrderId(e.target.value); setErrorMsg(''); }} 
                className="input-field" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem', fontFamily: 'monospace' }} 
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>Detected AWB Number</label>
              <input 
                type="text" 
                value={detectedAwb} 
                onChange={e => { setDetectedAwb(e.target.value); setErrorMsg(''); }} 
                className="input-field" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem', fontFamily: 'monospace' }} 
              />
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <span className={styles.statBoxLabel}>Confidence</span>
                <span className={styles.statBoxValue} style={{ color: detectedConfidence >= 95 ? 'var(--success)' : 'var(--warning)' }}>
                  {detectedConfidence > 0 ? `${detectedConfidence.toFixed(1)}%` : '-'}
                </span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statBoxLabel}>Status</span>
                <span className={styles.statBoxValue} style={{ color: statusVal === 'Success' ? 'var(--success)' : 'var(--warning)' }}>
                  {statusVal}
                </span>
              </div>
            </div>

            {errorMsg && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>{errorMsg}</div>}

            <div className={styles.panelFooter}>
              <button 
                className={`btn ${styles.actionBtn}`} 
                style={{ backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }} 
                onClick={() => { if (completedCrop) runOcrOnCrop(completedCrop); }}
                disabled={!completedCrop || isOcrRunning}
              >
                <RotateCw size={18} />
                Re-run OCR
              </button>
              
              <button className={`btn ${styles.actionBtn}`} onClick={handleSave}>
                <Save size={18} />
                Save Changes
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
