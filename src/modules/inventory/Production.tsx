import { Routes, Route } from 'react-router-dom';
import './raw-materials/LegacyStyles.css';

import ProductionDashboard from './production/ProductionDashboard';
import NewProductionBatch from './production/NewProductionBatch';
import ProductionBatchDetail from './production/ProductionBatchDetail';

export const Production = () => {
  return (
    <div className="w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      <Routes>
        <Route index element={<ProductionDashboard />} />
        <Route path="new" element={<NewProductionBatch />} />
        <Route path="batch/:id" element={<ProductionBatchDetail />} />
      </Routes>
    </div>
  );
};
