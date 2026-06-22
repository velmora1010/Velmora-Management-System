import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CombosDashboard } from './CombosDashboard';
import { CreateCombo } from './CreateCombo';
import { CombosInventory } from './CombosInventory';
import { ComboDetails } from './ComboDetails';
import { ComboBarcode } from './ComboBarcode';
import { ComboScanner } from './ComboScanner';

export const Combos = () => {
  const location = useLocation();

  return (
    <div className="w-full max-w-[1400px] mx-auto min-h-[calc(100vh-140px)]">
      {/* Main Content Area */}
      <div className="flex-1 w-full bg-[#0b1120] rounded-2xl border border-[#1e293b] overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            <Routes>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<CombosDashboard />} />
              <Route path="create" element={<CreateCombo />} />
              <Route path="inventory" element={<CombosInventory />} />
              <Route path="batch/:id" element={<ComboDetails />} />
              <Route path="barcode/:id" element={<ComboBarcode />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>

      <ComboScanner />
    </div>
  );
};
