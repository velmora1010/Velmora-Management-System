import React from 'react';
import Barcode from 'react-barcode';
import { barcodeService } from '../../services/barcodeService';

export interface BarcodePreviewProps {
  record?: any;
  scanCode?: string;
  fullBarcode?: string;
  statusText?: string;
  statusBg?: string;
  statusColor?: string;
  height?: number;
  showScanCodeText?: boolean;
}

export const normalizeBarcodeRecord = (record: any) => {
  if (!record) return { scanCode: 'BARCODE', fullBarcode: '', materialName: '', productName: '', quantity: '0', unit: 'KG', vendor: '-', status: '' };
  
  if (typeof record === 'string') {
    const scan = barcodeService.deriveScanCode(record);
    return { scanCode: scan, fullBarcode: record, materialName: '', productName: '', quantity: '0', unit: 'KG', vendor: '-', status: '' };
  }

  const scanCode = record.scan_code || record.scanCode || barcodeService.deriveScanCode(record.barcode || record.serial_number || record.barcode_no || record.qc_barcode || record.combo_box_barcode || record.id || '');
  const fullBarcode = record.barcode || record.serial_number || record.barcode_no || record.qc_barcode || record.combo_box_barcode || record.id || scanCode;
  const materialName = record.material_name || record.materialName || record.name || '';
  const productName = record.product_name || record.productName || '';
  const quantity = record.quantity !== undefined ? record.quantity : (record.quantity_grams ? (record.quantity_grams / 1000).toFixed(1) : '0');
  const unit = record.unit || 'KG';
  const vendor = record.vendor || record.vendor_name || record.prepared_by || '-';
  const status = record.status || record.currentStage || record.current_stage || '';

  return { scanCode, fullBarcode, materialName, productName, quantity, unit, vendor, status };
};

export const BarcodePreview: React.FC<BarcodePreviewProps> = ({
  record,
  scanCode: explicitScanCode,
  statusText,
  statusBg = 'rgba(100, 116, 139, 0.1)',
  statusColor = '#64748b',
  height = 50,
  showScanCodeText = false,
}) => {
  const normalized = normalizeBarcodeRecord(record);
  const codeToEncode = (explicitScanCode || normalized.scanCode || 'BARCODE').trim();
  const displayStatus = statusText || normalized.status;

  return (
    <div 
      className="bg-white p-5 rounded-t-2xl flex flex-col items-center justify-center gap-3 select-none overflow-hidden" 
      style={{ width: '100%', boxSizing: 'border-box' }}
    >
      {/* SVG Barcode Wrapper with strict quiet zones */}
      <div 
        className="w-full flex justify-center items-center overflow-hidden" 
        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
      >
        <div style={{ maxWidth: '84%', margin: '0 auto', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
          <Barcode 
            value={codeToEncode} 
            width={1.5}
            height={height}
            displayValue={false}
            margin={0}
            background="#ffffff"
            lineColor="#000000"
          />
        </div>
      </div>

      {/* Short Scan Code Text (if requested) */}
      {showScanCodeText && (
        <span className="text-xs font-mono font-bold text-black tracking-wider text-center">
          {codeToEncode}
        </span>
      )}

      {/* Status Pill matching Image 1 & 2 */}
      {displayStatus && (
        <div 
          className="w-full py-1 px-3 rounded-md flex items-center justify-center font-extrabold text-[11px] uppercase tracking-wider"
          style={{ 
            background: statusBg, 
            color: statusColor, 
            width: '100%',
            letterSpacing: '0.5px' 
          }}
        >
          {displayStatus.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
};
