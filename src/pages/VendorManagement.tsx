import React, { useState } from 'react';
import { VendorForm } from '../modules/vendors/VendorForm';
import { VendorList } from '../modules/vendors/VendorList';

type ViewState = 'form' | 'list';

export const VendorManagement: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('list');
  const [editVendorId, setEditVendorId] = useState<string | undefined>(undefined);

  const handleAddVendor = () => {
    setEditVendorId(undefined);
    setCurrentView('form');
  };

  const handleEditVendor = (id: string) => {
    setEditVendorId(id);
    setCurrentView('form');
  };

  const handleShowList = () => {
    setCurrentView('list');
    setEditVendorId(undefined);
  };

  const handleFormSuccess = () => {
    handleShowList();
  };

  return (
    <div className="text-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
        <h2 className="text-xl font-bold text-slate-100">Vendor Management</h2>
        
        <div className="grid grid-cols-2 md:flex gap-2.5 w-full md:w-auto">
          <button 
            type="button" 
            className="col-span-2 md:col-span-1 h-[44px] px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-[10px] text-sm font-medium transition-colors shadow-sm flex items-center justify-center border border-slate-700"
          >
            Task
          </button>
          <button 
            type="button" 
            onClick={handleAddVendor}
            className={`h-[44px] px-4 rounded-[10px] text-sm font-medium transition-colors shadow-sm flex items-center justify-center border border-purple-500/30 ${currentView === 'form' && !editVendorId ? 'bg-purple-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
          >
            + Vendor
          </button>
          <button 
            type="button" 
            onClick={handleShowList}
            className={`h-[44px] px-4 rounded-[10px] text-sm font-medium transition-colors shadow-sm flex items-center justify-center border border-slate-700 ${currentView === 'list' ? 'bg-slate-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
          >
            Vendor List
          </button>
        </div>
      </div>

      <div className="vendor-content-area mt-6">
        {currentView === 'form' && (
          <VendorForm 
            vendorId={editVendorId} 
            onSuccess={handleFormSuccess} 
            onCancel={handleShowList}
          />
        )}
        
        {currentView === 'list' && (
          <VendorList 
            onEditVendor={handleEditVendor} 
          />
        )}
      </div>
    </div>
  );
};
