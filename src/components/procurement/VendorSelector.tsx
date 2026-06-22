import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vendor } from '../../types';

interface VendorSelectorProps {
  value: string;
  onChange: (vendorId: string, vendorData?: Vendor) => void;
  disabled?: boolean;
}

export const VendorSelector: React.FC<VendorSelectorProps> = ({ value, onChange, disabled }) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .order('vendor_name', { ascending: true });

        if (error) throw error;
        if (isMounted) setVendors((data as unknown as Vendor[]) || []);
      } catch (err) {
        console.error("Failed to load vendors:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchVendors();
    return () => { isMounted = false; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedVendor = vendors.find(v => v.id === selectedId);
    onChange(selectedId, selectedVendor);
  };

  const selectClass = "w-full bg-transparent border-2 border-border text-main rounded-lg px-4 py-2 text-base transition-velmora focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <select 
      className={selectClass} 
      value={value} 
      onChange={handleChange}
      disabled={disabled || isLoading}
    >
      <option value="">{isLoading ? 'Loading vendors...' : 'Select Vendor'}</option>
      {vendors.map(vendor => (
        <option key={vendor.id} value={vendor.id}>
          {vendor.vendor_name}
        </option>
      ))}
    </select>
  );
};
