import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Employee, EmployeeStatus, EmploymentType, ShiftTemplate } from '../../types/hrms';
import { useHRMS } from '../../context/HRMSContext';
import {
  User,
  Briefcase,
  DollarSign,
  Phone,
  Shield,
  UploadCloud,
  Upload,
  Trash2,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  validateProfilePhoto,
  processProfileImage,
  getInitialsAvatar,
} from '../../utils/avatar';
import {
  DESIGNATION_CATEGORIES,
  CATEGORY_DEPARTMENT_MAP,
  getDepartmentNameForCategory,
  getDepartmentNameForDesignation,
  DEFAULT_DEPARTMENTS,
} from '../../data/designationsData';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit?: Employee | null;
}

type FormTab = 'personal' | 'job' | 'financial' | 'emergency';

const TABS: { id: FormTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'personal', label: 'Personal Info', icon: User },
  { id: 'job', label: 'Job & Shift', icon: Briefcase },
  { id: 'financial', label: 'Salary & Bank', icon: DollarSign },
  { id: 'emergency', label: 'Emergency Contact', icon: Phone },
];

const DRAFT_STORAGE_KEY = 'hrms_employee_draft_v1';

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  employeeToEdit,
}) => {
  const {
    departments,
    shiftTemplates,
    addEmployee,
    updateEmployee,
    addDepartment,
    designations,
  } = useHRMS();

  // Navigation State
  const [activeTab, setActiveTab] = useState<FormTab>('personal');
  const [completedTabs, setCompletedTabs] = useState<Set<FormTab>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [dateOfBirth, setDateOfBirth] = useState('1994-05-15');
  const [city, setCity] = useState('');

  // Step 2: Job & Shift
  const [designation, setDesignation] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [designationCategory, setDesignationCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [workLocation, setWorkLocation] = useState<'On-site' | 'Remote' | 'Hybrid'>('On-site');
  const [shiftId, setShiftId] = useState('');
  const [joiningDate, setJoiningDate] = useState('2026-10-01');

  // Searchable Designation Dropdown state
  const [isDesignationOpen, setIsDesignationOpen] = useState(false);
  const [designationSearch, setDesignationSearch] = useState('');
  const designationRef = useRef<HTMLDivElement | null>(null);

  // Step 3: Salary & Bank
  const [baseSalary, setBaseSalary] = useState<number | ''>(6500);
  const [bankName, setBankName] = useState('Chase Manhattan Bank');
  const [accountNumber, setAccountNumber] = useState('****-****-1234');
  const [taxId, setTaxId] = useState('US-TAX-10293');

  // Step 4: Emergency Contact & Address
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('Spouse');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('United States');
  const [bio, setBio] = useState('');

  // Close designation dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (designationRef.current && !designationRef.current.contains(event.target as Node)) {
        setIsDesignationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialization & Draft Loading
  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('personal');
    setErrors({});
    setIsSubmitting(false);
    setIsDesignationOpen(false);
    setDesignationSearch('');

    if (employeeToEdit) {
      setFirstName(employeeToEdit.firstName || '');
      setLastName(employeeToEdit.lastName || '');
      setEmail(employeeToEdit.email || '');
      setPhone(employeeToEdit.phone || '');
      setAvatar(employeeToEdit.avatar || '');
      setAvatarFileName(employeeToEdit.avatar ? 'Current Profile Photo' : '');
      setUploadError('');
      setGender(employeeToEdit.gender || 'female');
      setDateOfBirth(employeeToEdit.dateOfBirth || '1994-05-15');
      setJoiningDate(employeeToEdit.joiningDate || '2026-10-01');
      setDepartmentId(employeeToEdit.departmentId || departments[0]?.id || '');
      setDesignation(employeeToEdit.designation || '');
      setDesignationId(employeeToEdit.designationId || '');
      setDesignationCategory(employeeToEdit.designationCategory || '');
      setStatus(employeeToEdit.status || 'active');
      setEmploymentType(employeeToEdit.employmentType || 'full_time');
      setShiftId(employeeToEdit.shiftId || shiftTemplates[0]?.id || '');
      setWorkLocation(employeeToEdit.workLocation || 'On-site');
      setBaseSalary(employeeToEdit.baseSalary || 6500);
      setBankName(employeeToEdit.bankName || 'Chase Manhattan Bank');
      setAccountNumber(employeeToEdit.accountNumber || '****-****-1234');
      setTaxId(employeeToEdit.taxId || 'US-TAX-10293');
      setEmergencyContactName(employeeToEdit.emergencyContactName || '');
      setEmergencyContactRelation(employeeToEdit.emergencyContactRelation || 'Spouse');
      setEmergencyContactPhone(employeeToEdit.emergencyContactPhone || '');
      setAddress(employeeToEdit.address || '');
      setCity(employeeToEdit.city || '');
      setCountry(employeeToEdit.country || 'United States');
      setBio(employeeToEdit.bio || '');
      setCompletedTabs(new Set(['personal', 'job', 'financial', 'emergency']));
    } else {
      // Try restoring saved draft for new employee
      let draft: any = null;
      try {
        const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (stored) draft = JSON.parse(stored);
      } catch {
        draft = null;
      }

      if (draft) {
        setFirstName(draft.firstName || '');
        setLastName(draft.lastName || '');
        setEmail(draft.email || '');
        // Clear any old sample phone number if previously saved in draft
        const draftPhone =
          draft.phone === '+1 (555) 000-0000' || draft.phone === '+1 (555) 234-5678'
            ? ''
            : (draft.phone || '');
        setPhone(draftPhone);
        setAvatar(draft.avatar || '');
        setAvatarFileName(draft.avatar ? 'Draft Profile Photo' : '');
        setUploadError('');
        setGender(draft.gender || 'female');
        setDateOfBirth(draft.dateOfBirth || '1994-05-15');
        // Clear any old sample city if previously saved in draft
        const draftCity = draft.city === 'San Francisco, CA' ? '' : (draft.city || '');
        setCity(draftCity);
        setDesignation(draft.designation || '');
        setDesignationId(draft.designationId || '');
        setDesignationCategory(draft.designationCategory || '');
        setDepartmentId(draft.departmentId || '');
        setStatus(draft.status || 'active');
        setEmploymentType(draft.employmentType || 'full_time');
        setWorkLocation(draft.workLocation || 'On-site');
        setShiftId(draft.shiftId || '');
        setJoiningDate(draft.joiningDate || '2026-10-01');
        setBaseSalary(draft.baseSalary || 6500);
        setBankName(draft.bankName || 'Chase Manhattan Bank');
        setAccountNumber(draft.accountNumber || '****-****-1234');
        setTaxId(draft.taxId || 'US-TAX-10293');
        setEmergencyContactName(draft.emergencyContactName || 'Primary Relative');
        setEmergencyContactRelation(draft.emergencyContactRelation || 'Spouse');
        const draftEmergPhone =
          draft.emergencyContactPhone === '+1 (555) 111-2222' ||
          draft.emergencyContactPhone === '+1 (555) 998-1122'
            ? ''
            : (draft.emergencyContactPhone || '');
        setEmergencyContactPhone(draftEmergPhone);
        const draftAddress =
          draft.address === '100 Market Street' ||
          draft.address === '428 Willow Creek Lane, Apt 2B'
            ? ''
            : (draft.address || '');
        setAddress(draftAddress);
        setCountry(draft.country || 'United States');
        setBio(draft.bio || '');
        setCompletedTabs(new Set(draft.completedTabs || []));
      } else {
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setAvatar('');
        setAvatarFileName('');
        setUploadError('');
        setGender('female');
        setDateOfBirth('1994-05-15');
        setCity('');
        setDesignation('');
        setDesignationId('');
        setDesignationCategory('');
        setDepartmentId('');
        setStatus('active');
        setEmploymentType('full_time');
        setWorkLocation('On-site');
        setShiftId('');
        setJoiningDate('2026-10-01');
        setBaseSalary(6500);
        setBankName('Chase Manhattan Bank');
        setAccountNumber('****-****-1234');
        setTaxId('US-TAX-10293');
        setEmergencyContactName('Primary Relative');
        setEmergencyContactRelation('Spouse');
        setEmergencyContactPhone('');
        setAddress('');
        setCountry('United States');
        setBio('');
        setCompletedTabs(new Set());
      }
    }
  }, [employeeToEdit, departments, shiftTemplates, isOpen]);

  // Group designations by category and apply search query
  const groupedDesignations = useMemo(() => {
    const query = designationSearch.toLowerCase().trim();
    const groups: { category: string; items: typeof designations }[] = [];

    for (const cat of DESIGNATION_CATEGORIES) {
      const inCat = designations.filter((d) => d.category === cat);
      const matching = query
        ? inCat.filter(
            (d) =>
              d.name.toLowerCase().includes(query) ||
              d.category.toLowerCase().includes(query)
          )
        : inCat;

      if (matching.length > 0) {
        groups.push({ category: cat, items: matching });
      }
    }
    return groups;
  }, [designations, designationSearch]);

  // When a designation is selected, automatically identify and select appropriate department
  const handleSelectDesignation = (selectedName: string, category: string, id: string) => {
    setDesignation(selectedName);
    setDesignationId(id);
    setDesignationCategory(category);
    setIsDesignationOpen(false);
    setDesignationSearch('');

    if (errors.designation) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.designation;
        return copy;
      });
    }

    // Automatically map designation to department
    const targetDeptName = CATEGORY_DEPARTMENT_MAP[category] || getDepartmentNameForDesignation(selectedName);

    // Find matching department in database
    const matchingDept = departments.find(
      (d) =>
        d.name.toLowerCase() === targetDeptName.toLowerCase() ||
        d.name.toLowerCase().includes(targetDeptName.toLowerCase()) ||
        targetDeptName.toLowerCase().includes(d.name.toLowerCase())
    );

    if (matchingDept) {
      setDepartmentId(matchingDept.id);
      if (errors.departmentId) {
        setErrors((prev) => {
          const copy = { ...prev };
          delete copy.departmentId;
          return copy;
        });
      }
    } else {
      // Clear invalid department selection if target department isn't in database yet
      setDepartmentId('');
    }
  };

  // Expected department name based on designation
  const expectedDepartmentName = useMemo(() => {
    if (designationCategory && CATEGORY_DEPARTMENT_MAP[designationCategory]) {
      return CATEGORY_DEPARTMENT_MAP[designationCategory];
    }
    if (designation) {
      return getDepartmentNameForDesignation(designation);
    }
    return '';
  }, [designation, designationCategory]);

  const isDepartmentInDb = useMemo(() => {
    if (!expectedDepartmentName) return true;
    return departments.some(
      (d) =>
        d.name.toLowerCase() === expectedDepartmentName.toLowerCase() ||
        d.name.toLowerCase().includes(expectedDepartmentName.toLowerCase()) ||
        expectedDepartmentName.toLowerCase().includes(d.name.toLowerCase())
    );
  }, [expectedDepartmentName, departments]);

  const handleCreateMissingDepartment = () => {
    if (!expectedDepartmentName) return;
    const defaultMeta = DEFAULT_DEPARTMENTS.find(
      (d) => d.name.toLowerCase() === expectedDepartmentName.toLowerCase()
    );
    const newDept = addDepartment({
      name: expectedDepartmentName,
      code: defaultMeta?.code || expectedDepartmentName.slice(0, 3).toUpperCase(),
      description: defaultMeta?.description || `${expectedDepartmentName} operations and systems`,
      location: defaultMeta?.location || 'Main Office',
      monthlyBudget: defaultMeta?.monthlyBudget || 150000,
      color: defaultMeta?.color || '#206DA6',
    });
    setDepartmentId(newDept.id);
    if (errors.departmentId) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.departmentId;
        return copy;
      });
    }
  };

  // Format 12-hour shift display: "Morning Shift (09:00 AM – 05:00 PM)"
  const formatShiftOption = (shift: ShiftTemplate) => {
    const to12h = (t: string) => {
      const [hStr, mStr] = (t || '').split(':');
      const h = parseInt(hStr, 10);
      const m = mStr || '00';
      if (isNaN(h)) return t;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
    };
    return `${shift.name} (${to12h(shift.startTime)} – ${to12h(shift.endTime)})`;
  };

  // Draft saver
  const saveDraft = () => {
    if (employeeToEdit) return;
    try {
      const draft = {
        firstName,
        lastName,
        email,
        phone,
        avatar,
        gender,
        dateOfBirth,
        city,
        designation,
        designationId,
        designationCategory,
        departmentId,
        status,
        employmentType,
        workLocation,
        shiftId,
        joiningDate,
        baseSalary,
        bankName,
        accountNumber,
        taxId,
        emergencyContactName,
        emergencyContactRelation,
        emergencyContactPhone,
        address,
        country,
        bio,
        completedTabs: Array.from(completedTabs),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // storage unavailable
    }
  };

  // Discard draft on cancel
  const handleCancel = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    onClose();
  };

  // Profile Photo Upload Handlers
  const handleFile = async (file: File) => {
    setUploadError('');
    const validation = validateProfilePhoto(file);
    if (!validation.isValid) {
      setUploadError(validation.error || 'Invalid file format or size.');
      return;
    }

    try {
      const optimizedUrl = await processProfileImage(file);
      setAvatar(optimizedUrl);
      setAvatarFileName(file.name);
      setUploadError('');
    } catch {
      setUploadError('Failed to process image file. Please try another image.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemovePhoto = () => {
    setAvatar('');
    setAvatarFileName('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Step-by-Step Validation
  const validateStep = (tab: FormTab): boolean => {
    const err: Record<string, string> = {};

    if (tab === 'personal') {
      if (!firstName.trim()) err.firstName = 'First name is required';
      if (!lastName.trim()) err.lastName = 'Last name is required';
      if (!email.trim()) {
        err.email = 'Work email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.email = 'Valid email address is required (e.g. name@apextech.io)';
      }
    } else if (tab === 'job') {
      if (!designation.trim()) err.designation = 'Designation / Role is required';
      if (!departmentId) err.departmentId = 'Department is required';
      if (!shiftId) err.shiftId = 'Shift schedule is required';
    } else if (tab === 'financial') {
      if (baseSalary === '' || Number(baseSalary) <= 0) {
        err.baseSalary = 'Valid monthly base salary is required (must be greater than 0)';
      }
    }

    setErrors((prev) => {
      const copy = { ...prev };
      if (tab === 'personal') {
        delete copy.firstName;
        delete copy.lastName;
        delete copy.email;
      } else if (tab === 'job') {
        delete copy.designation;
        delete copy.departmentId;
        delete copy.shiftId;
      } else if (tab === 'financial') {
        delete copy.baseSalary;
      }
      return { ...copy, ...err };
    });

    return Object.keys(err).length === 0;
  };

  const validateAll = (): { isValid: boolean; firstInvalidTab?: FormTab } => {
    const err: Record<string, string> = {};
    let firstInvalidTab: FormTab | undefined;

    if (!firstName.trim()) err.firstName = 'First name is required';
    if (!lastName.trim()) err.lastName = 'Last name is required';
    if (!email.trim()) {
      err.email = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.email = 'Valid email address is required (e.g. name@apextech.io)';
    }

    if (err.firstName || err.lastName || err.email) {
      firstInvalidTab = 'personal';
    }

    if (!designation.trim()) err.designation = 'Designation / Role is required';
    if (!departmentId) err.departmentId = 'Department is required';
    if (!shiftId) err.shiftId = 'Shift schedule is required';

    if ((err.designation || err.departmentId || err.shiftId) && !firstInvalidTab) {
      firstInvalidTab = 'job';
    }

    if (baseSalary === '' || Number(baseSalary) <= 0) {
      err.baseSalary = 'Valid monthly base salary is required (must be greater than 0)';
      if (!firstInvalidTab) {
        firstInvalidTab = 'financial';
      }
    }

    setErrors(err);
    return {
      isValid: Object.keys(err).length === 0,
      firstInvalidTab,
    };
  };

  // Tab Header Click Navigation
  const handleTabClick = (targetTab: FormTab) => {
    const stepOrder: FormTab[] = ['personal', 'job', 'financial', 'emergency'];
    const currentIndex = stepOrder.indexOf(activeTab);
    const targetIndex = stepOrder.indexOf(targetTab);

    // Navigating backwards is always permitted without revalidating
    if (targetIndex <= currentIndex) {
      setActiveTab(targetTab);
      return;
    }

    // Navigating forward requires current step to be valid
    if (!validateStep(activeTab)) {
      return;
    }

    // Mark current step as completed
    setCompletedTabs((prev) => new Set([...prev, activeTab]));
    saveDraft();

    // Check intermediate steps if jumping ahead
    for (let i = currentIndex; i < targetIndex; i++) {
      const step = stepOrder[i];
      if (!validateStep(step)) {
        setActiveTab(step);
        return;
      }
      setCompletedTabs((prev) => new Set([...prev, step]));
    }

    setActiveTab(targetTab);
  };

  // Step Forward & Back
  const handleNext = (currentTab: FormTab, nextTab: FormTab) => {
    if (!validateStep(currentTab)) return;
    setCompletedTabs((prev) => new Set([...prev, currentTab]));
    saveDraft();
    setActiveTab(nextTab);
  };

  const handleBack = (prevTab: FormTab) => {
    saveDraft();
    setActiveTab(prevTab);
  };

  // Final Submission on Step 4
  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const { isValid, firstInvalidTab } = validateAll();
    if (!isValid) {
      if (firstInvalidTab) {
        setActiveTab(firstInvalidTab);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 450));

      const dept = departments.find((d) => d.id === departmentId);
      const shift = shiftTemplates.find((s) => s.id === shiftId);

      const fullName = `${firstName} ${lastName}`.trim();
      const finalAvatar = avatar || getInitialsAvatar(fullName || 'Employee');

      const empData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName,
        email: email.trim(),
        phone: phone.trim(),
        avatar: finalAvatar,
        gender,
        dateOfBirth,
        joiningDate,
        departmentId,
        departmentName: dept?.name || expectedDepartmentName || 'Software Development',
        designation: designation.trim(),
        designationId,
        designationCategory,
        status,
        employmentType,
        shiftId,
        shiftName: shift?.name || 'Morning Shift',
        workLocation,
        baseSalary: Number(baseSalary),
        currency: 'INR',
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        taxId: taxId.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactRelation: emergencyContactRelation.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        bio: bio.trim(),
      };

      if (employeeToEdit) {
        updateEmployee(employeeToEdit.id, empData);
      } else {
        addEmployee(empData);
      }

      // Clear draft on successful creation
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'personal') {
      handleNext('personal', 'job');
    } else if (activeTab === 'job') {
      handleNext('job', 'financial');
    } else if (activeTab === 'financial') {
      handleNext('financial', 'emergency');
    } else if (activeTab === 'emergency') {
      handleFinalSubmit();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={employeeToEdit ? 'Edit Employee Profile' : 'Add New Employee'}
      subtitle="Complete profile, role assignment, and compensation information"
      maxWidth="3xl"
    >
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold uppercase tracking-wider overflow-x-auto pb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isCompleted = completedTabs.has(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`pb-2.5 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer relative ${
                  isActive
                    ? 'text-[#206DA6] border-b-2 border-[#206DA6]'
                    : isCompleted
                    ? 'text-slate-700 hover:text-[#206DA6]'
                    : 'text-slate-400 hover:text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Personal Info */}
        {activeTab === 'personal' && (
          <div className="space-y-4 pt-2">
            {/* Upload Profile */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Upload Profile
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {avatar ? (
                /* 140px x 140px Square Profile Preview with Change & Remove */
                <div className="flex flex-col items-start">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-[140px] h-[140px] rounded-[12px] overflow-hidden border border-slate-200 bg-[#F8FAFC] shadow-xs cursor-pointer group transition-all hover:ring-2 hover:ring-[#206DA6]/30"
                    title="Click to change photo"
                  >
                    <img
                      src={avatar}
                      alt="Profile Preview"
                      className="w-full h-full object-cover rounded-[12px]"
                    />

                    {/* Hover Overlay with Change Indicator */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 p-2 rounded-[12px]">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1 bg-[#206DA6] px-2.5 py-1 rounded-lg shadow-xs">
                        <Upload className="w-3 h-3" /> Change
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-[#206DA6] hover:text-[#1A5987] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" /> Change
                    </button>
                    <span className="text-slate-300">&bull;</span>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                /* 140px x 140px Compact Square Upload Box */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-[140px] h-[140px] rounded-[12px] bg-[#F8FAFC] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-3 text-center select-none group ${
                    isDragging
                      ? 'border-[#206DA6] bg-blue-50/50 scale-[1.02]'
                      : 'border-[#CBD5E1] hover:border-[#206DA6] hover:bg-slate-100/80 shadow-xs'
                  }`}
                  title="Click or drag photo here"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#206DA6] group-hover:bg-[#206DA6] group-hover:text-white transition-all flex items-center justify-center mb-1.5 shadow-xs">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-[#172B4D] leading-tight">
                    Upload Photo
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 font-medium">
                    Max 5 MB
                  </span>
                </div>
              )}

              {uploadError && (
                <p className="text-[11px] text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}
            </div>

            {/* Section Divider & Heading: Employee Personal Information */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Employee Personal Information
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.firstName;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.firstName ? 'border-red-500' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Liam"
                />
                {errors.firstName && <span className="text-[11px] text-red-500">{errors.firstName}</span>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.lastName;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.lastName ? 'border-red-500' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Vance"
                />
                {errors.lastName && <span className="text-[11px] text-red-500">{errors.lastName}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.email;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.email ? 'border-red-500' : 'border-slate-200'
                  }`}
                  placeholder="name@apextech.io"
                />
                {errors.email && <span className="text-[11px] text-red-500">{errors.email}</span>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  placeholder=""
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">City & State</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  placeholder=""
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Job & Shift */}
        {activeTab === 'job' && (
          <div className="space-y-4 pt-2">
            {/* Top Row: Searchable Designation Dropdown & Dynamic Department Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Designation / Role - Modern Searchable Dropdown */}
              <div ref={designationRef} className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Designation / Role *
                </label>

                <button
                  type="button"
                  onClick={() => setIsDesignationOpen((prev) => !prev)}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl flex items-center justify-between transition-all focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] cursor-pointer text-left ${
                    errors.designation ? 'border-red-500' : 'border-slate-200'
                  }`}
                >
                  <span className={designation ? 'text-[#172B4D] font-medium truncate' : 'text-slate-400 truncate'}>
                    {designation || 'Select Designation / Role...'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ml-1.5 ${
                      isDesignationOpen ? 'rotate-180 text-[#206DA6]' : ''
                    }`}
                  />
                </button>
                {errors.designation && (
                  <span className="text-[11px] text-red-500 block mt-1">{errors.designation}</span>
                )}

                {/* Floating Searchable Menu */}
                {isDesignationOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-72">
                    {/* Search Field */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          value={designationSearch}
                          onChange={(e) => setDesignationSearch(e.target.value)}
                          placeholder="Search designation / role..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#206DA6]"
                        />
                      </div>
                    </div>

                    {/* Grouped Options List */}
                    <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                      {groupedDesignations.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No designation found matching "{designationSearch}"
                        </div>
                      ) : (
                        groupedDesignations.map((group) => (
                          <div key={group.category} className="py-1">
                            <div className="sticky top-0 bg-slate-100/95 backdrop-blur-xs px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                              <span>{group.category}</span>
                              <span className="text-[9px] bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded-full font-medium">
                                {group.items.length}
                              </span>
                            </div>
                            {group.items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectDesignation(item.name, item.category, item.id)}
                                className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                                  designation === item.name
                                    ? 'bg-blue-50/80 text-[#206DA6] font-bold'
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#206DA6]'
                                }`}
                              >
                                <span>{item.name}</span>
                                {designation === item.name && (
                                  <Check className="w-3.5 h-3.5 text-[#206DA6] stroke-[2.5]" />
                                )}
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Department - Automatically Filtered / Selected with Manual Override */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Department *
                  </label>
                  {departmentId && expectedDepartmentName && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-emerald-500" /> Auto-Selected
                    </span>
                  )}
                </div>

                <select
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    if (errors.departmentId) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.departmentId;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.departmentId ? 'border-red-500' : 'border-slate-200'
                  }`}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <span className="text-[11px] text-red-500 block mt-1">{errors.departmentId}</span>
                )}

                {/* Clear message and authorized option if expected department is not found in database */}
                {!isDepartmentInDb && expectedDepartmentName && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800">
                    <span className="truncate">
                      Department <strong>"{expectedDepartmentName}"</strong> is not in database.
                    </span>
                    <button
                      type="button"
                      onClick={handleCreateMissingDepartment}
                      className="px-2.5 py-1 bg-[#206DA6] hover:bg-[#1A5987] text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer flex-shrink-0"
                    >
                      + Create
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Middle Row: Status, Employment Type, Work Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Work Location</label>
                <select
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="On-site">On-site (HQ)</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            </div>

            {/* Bottom Row: Shift Schedule & Joining Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Shift Schedule *
                </label>
                <select
                  value={shiftId}
                  onChange={(e) => {
                    setShiftId(e.target.value);
                    if (errors.shiftId) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.shiftId;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.shiftId ? 'border-red-500' : 'border-slate-200'
                  }`}
                >
                  <option value="">Select Shift Schedule...</option>
                  {shiftTemplates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatShiftOption(s)}
                    </option>
                  ))}
                </select>
                {errors.shiftId && (
                  <span className="text-[11px] text-red-500 block mt-1">{errors.shiftId}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Joining Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Financial & Salary */}
        {activeTab === 'financial' && (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Confidential financial fields are protected by role-based access control and encrypted.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Monthly Base Salary (USD) *
                </label>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setBaseSalary(val);
                    if (errors.baseSalary) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.baseSalary;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.baseSalary ? 'border-red-500' : 'border-slate-200'
                  }`}
                  placeholder="6500"
                />
                {errors.baseSalary && <span className="text-[11px] text-red-500">{errors.baseSalary}</span>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Disbursing Bank</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="Silicon Valley Bank / Chase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  placeholder="****-****-8821"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tax ID / SSN</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  placeholder="US-TAX-98211"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Emergency Contact */}
        {activeTab === 'emergency' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="e.g. Robert Vance"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Relationship</label>
                <input
                  type="text"
                  value={emergencyContactRelation}
                  onChange={(e) => setEmergencyContactRelation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="Spouse / Parent / Sibling"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Emergency Phone Number</label>
              <input
                type="text"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                placeholder=""
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Residential Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                placeholder=""
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Sticky Form Footer with Step-Specific Buttons */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs pt-4 pb-1 border-t border-slate-100 flex items-center justify-end gap-3 z-10 -mx-6 px-6 mt-6">
          {activeTab === 'personal' && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleNext('personal', 'job')}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {activeTab === 'job' && (
            <>
              <button
                type="button"
                onClick={() => handleBack('personal')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => handleNext('job', 'financial')}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {activeTab === 'financial' && (
            <>
              <button
                type="button"
                onClick={() => handleBack('job')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => handleNext('financial', 'emergency')}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {activeTab === 'emergency' && (
            <>
              <button
                type="button"
                onClick={() => handleBack('financial')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{employeeToEdit ? 'Saving Changes...' : 'Creating Employee...'}</span>
                  </>
                ) : (
                  <span>{employeeToEdit ? 'Save Changes' : 'Submit'}</span>
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
};
