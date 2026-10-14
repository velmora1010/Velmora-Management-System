import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProductFormulaConfig } from '../../../../config/productionBatchFormulas';
import type { ProductionReadyBatchRow } from '../../../../services/productionReadyBatchService';

export interface RawMaterial {
  id?: string;
  name: string;
  unit: string;
  category: string;
  description?: string;
  hsn_code?: string;
  color_code?: string;
}

export interface BatchItem {
  id: string;
  batch_no: number;
  quantity: number;
}

export interface IntakeFormData {
  quantity_received: string;
  vendor_name: string;
  po_reference: string;
  price_per_kg: string;
  gst_percent: string;
  date_received: string;
  notes: string;
  scanningPersonName: string;
}

interface IntakeContextType {
  selectedMaterial: RawMaterial | null;
  setSelectedMaterial: (m: RawMaterial | null) => void;
  formData: IntakeFormData;
  setFormData: (data: IntakeFormData) => void;
  batches: BatchItem[];
  setBatches: (batches: BatchItem[]) => void;
  savedBatchIds: number[];
  setSavedBatchIds: (ids: number[]) => void;
  selectedProduct: ProductFormulaConfig | null;
  setSelectedProduct: (p: ProductFormulaConfig | null) => void;
  preparedBatches: ProductionReadyBatchRow[];
  setPreparedBatches: (rows: ProductionReadyBatchRow[]) => void;
  looseBalanceGrams: number;
  setLooseBalanceGrams: (g: number) => void;
  allocatedGrams: number;
  setAllocatedGrams: (g: number) => void;
  remainingLooseGrams: number;
  setRemainingLooseGrams: (g: number) => void;
  clearIntakeSession: () => void;
}

const defaultFormData: IntakeFormData = {
  quantity_received: '',
  vendor_name: '',
  po_reference: '',
  price_per_kg: '',
  gst_percent: '18',
  date_received: new Date().toISOString().split('T')[0],
  notes: '',
  scanningPersonName: ''
};

const IntakeContext = createContext<IntakeContextType | undefined>(undefined);

export const IntakeProvider = ({ children }: { children: ReactNode }) => {
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [formData, setFormData] = useState<IntakeFormData>(defaultFormData);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [savedBatchIds, setSavedBatchIds] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductFormulaConfig | null>(null);
  const [preparedBatches, setPreparedBatches] = useState<ProductionReadyBatchRow[]>([]);
  const [looseBalanceGrams, setLooseBalanceGrams] = useState<number>(0);
  const [allocatedGrams, setAllocatedGrams] = useState<number>(0);
  const [remainingLooseGrams, setRemainingLooseGrams] = useState<number>(0);

  const clearIntakeSession = () => {
    setSelectedMaterial(null);
    setFormData(defaultFormData);
    setBatches([]);
    setSavedBatchIds([]);
    setSelectedProduct(null);
    setPreparedBatches([]);
    setLooseBalanceGrams(0);
    setAllocatedGrams(0);
    setRemainingLooseGrams(0);
  };

  return (
    <IntakeContext.Provider value={{ 
      selectedMaterial, setSelectedMaterial, 
      formData, setFormData, 
      batches, setBatches,
      savedBatchIds, setSavedBatchIds,
      selectedProduct, setSelectedProduct,
      preparedBatches, setPreparedBatches,
      looseBalanceGrams, setLooseBalanceGrams,
      allocatedGrams, setAllocatedGrams,
      remainingLooseGrams, setRemainingLooseGrams,
      clearIntakeSession
    }}>
      {children}
    </IntakeContext.Provider>
  );
};

export const useIntakeContext = () => {
  const context = useContext(IntakeContext);
  if (!context) throw new Error('useIntakeContext must be used within an IntakeProvider');
  return context;
};
