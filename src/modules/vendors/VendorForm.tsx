import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Vendor } from '../../types';
import { useDepartmentSelection } from '../../hooks/tasks/useDepartmentSelection';
import { SUPABASE_TABLES } from '../../config/supabaseTables';

interface VendorFormProps {
  vendorId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const VendorForm: React.FC<VendorFormProps> = ({ vendorId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 1. Classification
  const [vendorType1, setVendorType1] = useState('');
  const [vendorType2, setVendorType2] = useState('');
  const [gstAvailable, setGstAvailable] = useState(false);

  // Re-use dynamic department & section cascading selection hook
  const {
    departments,
    sections,
    selectedDeptId,
    selectedSectionId,
    setSelectedSectionId,
    handleDepartmentChange,
    isDeptsLoading,
    isSectionsLoading,
    deptsError,
    sectionsError
  } = useDepartmentSelection('', '');

  // Sub Category 2 (sub_sub_category) & Sub Category 3 (sub_category_3) states
  const [subSubCategory, setSubSubCategory] = useState('');
  const [vendorSubCategory3, setVendorSubCategory3] = useState<string[]>([]);
  const [isSub3DropdownOpen, setIsSub3DropdownOpen] = useState(false);

  const [subSubCategoryOptions, setSubSubCategoryOptions] = useState<string[]>([]);
  const [subCategory3Options, setSubCategory3Options] = useState<string[]>([]);

  // 2. Vendor Details
  const [vendorName, setVendorName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  // 3. Bank Details
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  // Fetch subSubCategory options based on selected Department & Section
  useEffect(() => {
    let mounted = true;
    const fetchSub2 = async () => {
      if (!selectedDeptId || !selectedSectionId) {
        if (mounted) setSubSubCategoryOptions([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('Vendor_Category')
          .select('sub_sub_category')
          .eq('category', selectedDeptId)
          .eq('sub_category', selectedSectionId)
          .eq('status', 'active');
        if (!error && data && mounted) {
          const unique = Array.from(new Set(data.map(d => d.sub_sub_category).filter(Boolean))) as string[];
          setSubSubCategoryOptions(unique);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSub2();
    return () => { mounted = false; };
  }, [selectedDeptId, selectedSectionId]);

  // Fetch subCategory3 options based on selected Department, Section, and subSubCategory
  useEffect(() => {
    let mounted = true;
    const fetchSub3 = async () => {
      if (!selectedDeptId || !selectedSectionId || !subSubCategory) {
        if (mounted) setSubCategory3Options([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('Vendor_Category')
          .select('sub_sub_sub_category')
          .eq('category', selectedDeptId)
          .eq('sub_category', selectedSectionId)
          .eq('sub_sub_category', subSubCategory)
          .eq('status', 'active');
        if (!error && data && mounted) {
          const unique = Array.from(new Set(data.map(d => d.sub_sub_sub_category).filter(Boolean))) as string[];
          setSubCategory3Options(unique.sort());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSub3();
    return () => { mounted = false; };
  }, [selectedDeptId, selectedSectionId, subSubCategory]);

  useEffect(() => {
    const loadVendor = async () => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', vendorId as string)
          .single();

        if (error) throw error;
        
        if (data) {
          setVendorType1(data.vendor_type_1 || '');
          setVendorType2(data.vendor_type_2 || '');
          
          // Set selection IDs
          handleDepartmentChange(data.vendor_category || '');
          // We wait briefly or trigger manual update for section
          if (data.vendor_category) {
            const { data: secs } = await supabase
              .from('department_sections')
              .select('*')
              .eq('department_id', Number(data.vendor_category));
            if (secs) {
              setSelectedSectionId(data.sub_category || '');
            }
          }
          
          setSubSubCategory(data.sub_sub_category || '');
          setVendorSubCategory3(data.sub_category_3 || []);
          setGstAvailable(data.gst_available || false);

          setVendorName(data.vendor_name || '');
          setRepresentativeName(data.representative_name || '');
          setPhone(data.phone || '');
          setEmail(data.email || '');
          setAddress(data.address || '');
          setCity(data.city || '');
          setDeliveryTime(data.delivery_time || '');
          setGstNumber(data.gst_number || '');

          setAccountHolder(data.account_holder || '');
          setAccountNumber(data.account_number || '');
          setIfscCode(data.ifsc_code || '');
          setUpiId(data.upi_id || '');
        }
      } catch (err: unknown) {
        console.error("Error loading vendor:", err);
        setError("Failed to load vendor data.");
      }
    };

    if (vendorId) {
      loadVendor();
    }
  }, [vendorId]);

  const toggleSub3Option = (opt: string) => {
    if (vendorSubCategory3.includes(opt)) {
      setVendorSubCategory3(vendorSubCategory3.filter(v => v !== opt));
    } else {
      setVendorSubCategory3([...vendorSubCategory3, opt]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!vendorName) {
      setError('Vendor Name is required.');
      return;
    }

    if (!selectedDeptId || !selectedSectionId) {
      setError('Department and Section are required.');
      return;
    }

    setIsSaving(true);

    const payload: Partial<Vendor> = {
      vendor_type_1: vendorType1,
      vendor_type_2: vendorType2,
      vendor_category: selectedDeptId,
      sub_category: selectedSectionId,
      sub_sub_category: subSubCategory,
      sub_category_3: vendorSubCategory3,
      gst_available: gstAvailable,
      vendor_name: vendorName,
      representative_name: representativeName,
      phone: phone,
      email: email,
      address: address,
      city: city,
      delivery_time: deliveryTime,
      gst_number: gstNumber,
      account_holder: accountHolder,
      account_number: accountNumber,
      ifsc_code: ifscCode,
      upi_id: upiId,
      ...(vendorId ? {} : { created_by: user?.id || null, status: 'active' })
    };

    try {
      if (vendorId) {
        const { error } = await supabase.from(SUPABASE_TABLES.vendors).update(payload).eq('id', vendorId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(SUPABASE_TABLES.vendors).insert([payload]);
        if (error) throw error;
      }
      
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error("Save error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "Failed to save vendor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-slate-800/80 rounded-xl p-6 border border-slate-700 shadow-sm max-w-[1000px] mx-auto text-slate-200 animate-in">
      <div className="flex justify-between items-center border-b border-slate-700/50 pb-4 mb-6">
        <span className="text-lg font-semibold text-slate-100">{vendorId ? 'Edit Vendor' : 'Add Vendor'}</span>
        <button 
          type="button" 
          onClick={onCancel}
          className="h-[36px] px-4 bg-slate-750 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center border border-slate-650"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-900/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Vendor Classification */}
        <div>
          <div className="text-sm font-semibold text-slate-300 mb-4 border-b border-slate-700/50 pb-2">Vendor Classification</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vendor Type 1</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" value={vendorType1} onChange={e => setVendorType1(e.target.value)}>
                <option value="">Select Type</option>
                <option value="Trader">Trader</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Service Provider">Service Provider</option>
              </select>
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vendor Type 2</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" value={vendorType2} onChange={e => setVendorType2(e.target.value)}>
                <option value="">Select Type</option>
                <option value="primary_vendor">Primary Vendor</option>
                <option value="secondary_vendor">Secondary Vendor</option>
                <option value="tertiary_vendor">Tertiary Vendor</option>
              </select>
            </div>
            
            {/* Department (vendor_category) dropdown */}
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Department *</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" 
                value={selectedDeptId} 
                onChange={e => handleDepartmentChange(e.target.value)}
                disabled={isDeptsLoading}
                required
              >
                <option value="">{isDeptsLoading ? 'Loading departments...' : 'Select Department'}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
              </select>
              {deptsError && <span className="text-xs text-red-500 mt-1">{deptsError}</span>}
            </div>

            {/* Section (sub_category) dropdown */}
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Section *</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none disabled:opacity-50" 
                value={selectedSectionId} 
                onChange={e => setSelectedSectionId(e.target.value)} 
                disabled={!selectedDeptId || isSectionsLoading}
                required
              >
                <option value="">
                  {!selectedDeptId 
                    ? 'Select department first' 
                    : isSectionsLoading 
                    ? 'Loading sections...' 
                    : sections.length === 0 
                    ? 'No sections' 
                    : 'Select Section'
                  }
                </option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.section_name}</option>
                ))}
              </select>
              {sectionsError && <span className="text-xs text-red-500 mt-1">{sectionsError}</span>}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sub-Sub Category (sub_sub_category) dropdown */}
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Sub-Sub Category</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none disabled:opacity-50" 
                value={subSubCategory} 
                onChange={e => setSubSubCategory(e.target.value)} 
                disabled={!selectedSectionId || subSubCategoryOptions.length === 0}
              >
                <option value="">Select Sub-Sub Category</option>
                {subSubCategoryOptions.map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Sub Category 3 dropdown */}
            <div className="form-group relative">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Sub Category 3</label>
              <div 
                className={`w-full p-2.5 border rounded-lg text-sm flex justify-between items-center ${subSubCategory ? 'bg-slate-900 border-slate-700 cursor-pointer' : 'bg-slate-800/50 border-slate-700/50 cursor-not-allowed'} ${vendorSubCategory3.length > 0 ? 'text-slate-200' : 'text-slate-500'}`}
                onClick={() => { if(subSubCategory) setIsSub3DropdownOpen(!isSub3DropdownOpen); }}
              >
                <span className="truncate pr-2">
                  {vendorSubCategory3.length > 0 ? vendorSubCategory3.join(', ') : (subSubCategory ? 'Select Sub Category 3' : 'Select Sub Category First')}
                </span>
                <svg className="flex-shrink-0" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              {isSub3DropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg max-h-48 overflow-y-auto z-10 shadow-lg">
                  {subCategory3Options.map((opt: string) => (
                    <div key={opt} className="p-2 cursor-pointer flex items-center gap-2 hover:bg-slate-800 text-slate-300" onClick={() => toggleSub3Option(opt)}>
                      <input type="checkbox" checked={vendorSubCategory3.includes(opt)} readOnly className="cursor-pointer accent-purple-500" />
                      <span className="text-sm">{opt}</span>
                    </div>
                  ))}
                  {subCategory3Options.length === 0 && <div className="p-3 text-sm text-slate-500 text-center">No options available</div>}
                </div>
              )}
            </div>

            <div className="form-group flex items-center pt-6 pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" id="gstAvailable" checked={gstAvailable} onChange={e => setGstAvailable(e.target.checked)} className="cursor-pointer accent-purple-500 w-4 h-4 rounded" />
                GST Available
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Vendor Details */}
        <div>
          <div className="text-sm font-semibold text-slate-300 mb-4 border-b border-slate-700/50 pb-2">Vendor Details</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vendor Name *</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Alpine Tape" value={vendorName} onChange={e => setVendorName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Representative Name</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Jack Ross" value={representativeName} onChange={e => setRepresentativeName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
              <input type="tel" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="jack@alpine.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Delivery Time (Days)</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="e.g. 3-5 days" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Address</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Street Address" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">City</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Coimbatore" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
          
          {gstAvailable && (
            <div className="form-group mt-4 max-w-md">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">GST Number</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="33AAJCA6244L1ZJ" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
            </div>
          )}
        </div>

        {/* Section 3: Bank Details */}
        <div>
          <div className="text-sm font-semibold text-slate-300 mb-4 border-b border-slate-700/50 pb-2">Bank Details</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Holder Name</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="Alpine Tape Private Limited" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Number</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="904905010000003" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">IFSC Code</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="UBIN0590495" value={ifscCode} onChange={e => setIfscCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">UPI ID</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none" placeholder="alpine@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSaving} 
          className="w-full h-[48px] bg-purple-600 hover:bg-purple-750 text-white rounded-[10px] text-sm font-semibold transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Vendor'}
        </button>
      </form>
    </div>
  );
};
