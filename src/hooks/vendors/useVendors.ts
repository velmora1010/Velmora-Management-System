import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Vendor } from '../../types';

export const useVendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading Vendors_row...');
      const { data: fetchResult, error: fetchError } = await supabase
        .from('Vendors_row')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      let data = fetchResult;
      if (fetchError) {
        console.error('Vendors_row fetch error:', fetchError.message);
        const fallback = localStorage.getItem('vendors');
        if (fallback) data = JSON.parse(fallback);
        else throw fetchError;
      }
      
      console.log('Loaded Vendors_row:', data?.length);
      setVendors(data as Vendor[] || []);
    } catch (err: unknown) {
      console.error('Error fetching vendors:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to fetch vendors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveVendor = async (vendorData: Partial<Vendor>) => {
    setIsLoading(true);
    setError(null);
    try {
      if (vendorData.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('Vendors_row')
          .update(vendorData)
          .eq('id', vendorData.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('Vendors_row')
          .insert([{
            ...vendorData,
            status: 'active'
          }]);

        if (insertError) throw insertError;
      }
      await fetchVendors();
      return true;
    } catch (err: unknown) {
      console.error('Error saving vendor:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to save vendor');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const archiveVendor = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { error: archiveError } = await supabase
        .from('Vendors_row')
        .update({ status: 'archived' })
        .eq('id', id);

      if (archiveError) throw archiveError;
      await fetchVendors();
      return true;
    } catch (err: unknown) {
      console.error('Error archiving vendor:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to archive vendor');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    vendors,
    isLoading,
    error,
    fetchVendors,
    saveVendor,
    archiveVendor
  };
};
