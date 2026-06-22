import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import './raw-materials/LegacyStyles.css';

import ViewBarcodeList from './view-barcode/ViewBarcodeList';
import GenerateBarcode from './view-barcode/GenerateBarcode';

export const ViewBarcode = () => {
  const location = useLocation();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex border-b border-border mb-6">
        <Link 
          to="/inventory/view-barcode/list" 
          className={`px-4 py-3 font-medium transition-colors ${location.pathname.includes('/list') ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-white'}`}
        >
          View 1D Barcodes
        </Link>
        <Link 
          to="/inventory/view-barcode/generate" 
          className={`px-4 py-3 font-medium transition-colors ${location.pathname.includes('/generate') ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-white'}`}
        >
          Generate QR Codes
        </Link>
      </div>

      <div className="barcode-module-container">
        <Routes>
          <Route index element={<Navigate to="list" replace />} />
          <Route path="list" element={<ViewBarcodeList />} />
          <Route path="generate" element={<GenerateBarcode />} />
        </Routes>
      </div>
    </div>
  );
};
