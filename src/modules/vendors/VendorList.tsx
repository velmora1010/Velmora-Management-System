import React, { useEffect, useState, useMemo } from 'react';
import { useVendors } from '../../hooks/vendors/useVendors';
import type { Vendor } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface VendorListProps {
  onEditVendor: (id: string) => void;
}

export const VendorList: React.FC<VendorListProps> = ({ onEditVendor }) => {
  const { vendors, isLoading, fetchVendors, archiveVendor } = useVendors();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [vendorToArchive, setVendorToArchive] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = v.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter ? v.vendor_category === categoryFilter : true;
      return matchesSearch && matchesCategory;
    });
  }, [vendors, searchTerm, categoryFilter]);

  const handleArchive = (id: string) => {
    setVendorToArchive(id);
    setIsConfirmOpen(true);
  };

  const executeArchive = async () => {
    if (vendorToArchive) {
      await archiveVendor(vendorToArchive);
      setVendorToArchive(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-5 gap-4">
        <h2 className="text-lg font-semibold text-slate-100">Vendor List</h2>
        <div className="flex flex-col md:flex-row gap-2.5 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <svg className="absolute left-3 top-2.5 text-slate-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input 
              type="text" 
              placeholder="Search vendors..." 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="w-full md:w-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="Product">Product</option>
            <option value="Operations">Operations</option>
            <option value="Marketing">Marketing</option>
            <option value="Logistics">Logistics</option>
            <option value="Financial">Financial</option>
            <option value="Software">Software</option>
            <option value="Compliance">Compliance</option>
            <option value="Assets">Assets</option>
          </select>
        </div>
      </div>

      <div className="w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="animate-spin h-8 w-8 mb-4 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading vendors...
          </div>
        ) : filteredVendors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map((vendor: Vendor) => (
              <div key={vendor.id} className="bg-slate-800/80 rounded-xl p-5 border border-slate-700 shadow-sm flex flex-col hover:border-slate-600 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="font-semibold text-base text-slate-100">{vendor.vendor_name}</div>
                  <span className="text-[11px] px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full font-medium">
                    {vendor.vendor_category || 'Uncategorized'}
                  </span>
                </div>
                
                <div className="text-sm text-slate-400 mb-5 flex-1">
                  <div className="mb-1"><strong className="text-slate-300 font-medium">Type:</strong> {vendor.vendor_type_1 || '-'}</div>
                  <div className="mb-1"><strong className="text-slate-300 font-medium">Rep:</strong> {vendor.representative_name || '-'}</div>
                  <div className="mb-1"><strong className="text-slate-300 font-medium">Contact:</strong> {vendor.phone || '-'}</div>
                </div>

                <div className="flex gap-2.5 mt-auto border-t border-slate-700/50 pt-4">
                  <button onClick={() => onEditVendor(vendor.id)} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-200 text-sm transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleArchive(vendor.id)} className="flex-1 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 rounded-lg text-red-400 text-sm transition-colors">
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
            <div className="text-4xl mb-4 opacity-50">🏪</div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">No vendors yet</h3>
            <p className="text-slate-400 text-sm">Click "+ Vendor" above to add your first vendor.</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Vendor"
        message="Are you sure you want to archive this vendor?"
        confirmText="Archive"
        onConfirm={executeArchive}
        onClose={() => {
          setIsConfirmOpen(false);
          setVendorToArchive(null);
        }}
      />
    </div>
  );
};
