import { Routes, Route, Navigate } from 'react-router-dom';
import './raw-materials/LegacyStyles.css';

import RawMaterialsMaster from './raw-materials/RawMaterials';
import StockManagement from './raw-materials/StockManagement';
import IntakeWorkflow from './raw-materials/IntakeWorkflow/IntakeWorkflow';
import IntakeStep1_Form from './raw-materials/IntakeWorkflow/IntakeStep1_Form';
import IntakeStep2_Split from './raw-materials/IntakeWorkflow/IntakeStep2_Split';
import IntakeStep3_Barcode from './raw-materials/IntakeWorkflow/IntakeStep3_Barcode';

export const RawMaterial = () => {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      

      {/* Embedded Routing */}
      <div className="raw-material-module-container">
        <Routes>
          <Route index element={<Navigate to="intake" replace />} />
          <Route path="master" element={<RawMaterialsMaster />} />
          <Route path="batches" element={<StockManagement />} />
          
          <Route path="intake" element={<IntakeWorkflow />}>
            <Route index element={<IntakeStep1_Form />} />
            <Route path="split-batches" element={<IntakeStep2_Split />} />
            <Route path="generate-barcode" element={<IntakeStep3_Barcode />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
};
