"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize } from 'lucide-react';
import styles from './CropModal.module.css';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderId: string;
  initialAwb: string;
  imageUrl: string | null;
  onSave: (orderId: string, awb: string) => Promise<void>;
}

export default function EditModal({ isOpen, onClose, initialOrderId, initialAwb, imageUrl, onSave }: EditModalProps) {
  const [orderId, setOrderId] = useState('');
  const [awb, setAwb] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Transform states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setOrderId(initialOrderId);
      setAwb(initialAwb);
      setErrorMsg('');
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, initialOrderId, initialAwb]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setErrorMsg('');
    
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId || !/^[0-9]+$/.test(trimmedOrderId)) {
      setErrorMsg('Order ID must contain numbers only and cannot be empty.');
      return;
    }

    const digitsOnlyAwb = awb.replace(/[^0-9]/g, '');
    if (digitsOnlyAwb.length < 10 || digitsOnlyAwb.length > 12 || digitsOnlyAwb === '9626198278' || digitsOnlyAwb === '8438819400') {
      setErrorMsg('Invalid ST Courier AWB Number.');
      return;
    }

    await onSave(trimmedOrderId, digitsOnlyAwb);
    onClose();
  };

  const isAwbValid = awb && awb.replace(/[^0-9]/g, '').length >= 10 && awb.replace(/[^0-9]/g, '').length <= 12;
  const isOrderIdValid = orderId && orderId.trim().length > 0;
  const statusVal = (isAwbValid && isOrderIdValid) ? 'Success' : 'Needs Review';

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ maxWidth: '1000px', width: '90%' }}>
        <div className={styles.header}>
          <h3>Edit Shipment Details</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.contentRow}>
          
          {/* LEFT PANEL: IMAGE PREVIEW */}
          <div className={styles.leftPanel}>
            {imageUrl ? (
              <>
                <div className={styles.toolbar}>
                  <button className={styles.toolbarBtn} onClick={() => setRotation(r => r - 90)}>
                    <RotateCcw size={16} /> Rotate Left
                  </button>
                  <button className={styles.toolbarBtn} onClick={() => setRotation(r => r + 90)}>
                    <RotateCw size={16} /> Rotate Right
                  </button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>
                  <button className={styles.toolbarBtn} onClick={() => setZoom(z => Math.min(z + 0.25, 3))}>
                    <ZoomIn size={16} /> Zoom In
                  </button>
                  <button className={styles.toolbarBtn} onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}>
                    <ZoomOut size={16} /> Zoom Out
                  </button>
                  <button className={styles.toolbarBtn} onClick={() => { setZoom(1); setRotation(0); }}>
                    <Maximize size={16} /> Reset
                  </button>
                </div>

                <div className={styles.cropContainerWrapper} style={{ overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-card)' }}>
                  <div 
                    style={{ 
                      transform: `scale(${zoom}) rotate(${rotation}deg)`, 
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s ease-out',
                      display: 'inline-block'
                    }}
                  >
                    <img
                      src={imageUrl}
                      style={{ maxHeight: '65vh', maxWidth: '100%', display: 'block', objectFit: 'contain' }}
                      alt="Parcel"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                No original image available.
              </div>
            )}
          </div>

          {/* RIGHT PANEL: PROPERTIES & ACTIONS */}
          <div className={styles.rightPanel}>
            <div className={styles.panelTitle}>
              Shipment Details
            </div>

            <div className={styles.fieldGroup}>
              <label>Order ID</label>
              <input 
                type="text" 
                value={orderId} 
                onChange={e => { setOrderId(e.target.value); setErrorMsg(''); }} 
                className="input-field" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem', fontFamily: 'monospace' }} 
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>AWB Number</label>
              <input 
                type="text" 
                value={awb} 
                onChange={e => { setAwb(e.target.value); setErrorMsg(''); }} 
                className="input-field" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem', fontFamily: 'monospace' }} 
              />
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <span className={styles.statBoxLabel}>Confidence</span>
                <span className={styles.statBoxValue} style={{ color: 'var(--success)' }}>
                  Manual (100%)
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
                onClick={onClose}
              >
                Cancel
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
