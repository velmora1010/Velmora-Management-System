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
  Lock,
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
    employees,
  } = useHRMS();

  const activeEmployee = useMemo(() => {
    if (!employeeToEdit) return null;
    return employees.find((e) => e.id === employeeToEdit.id) || employeeToEdit;
  }, [employeeToEdit, employees]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<FormTab>('personal');
  const [completedTabs, setCompletedTabs] = useState<Set<FormTab>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const markTouched = (field: string) => {
    setTouchedFields((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  };

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
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [city, setCity] = useState('');

  // Step 2: Job & Shift
  const [designation, setDesignation] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [designationCategory, setDesignationCategory] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('');
  const [workLocation, setWorkLocation] = useState<'On-site' | 'Remote' | 'Hybrid' | ''>('');
  const [shiftId, setShiftId] = useState('');
  const [joiningDate, setJoiningDate] = useState('');

  // Searchable Designation Dropdown state
  const [isDesignationOpen, setIsDesignationOpen] = useState(false);
  const [designationSearch, setDesignationSearch] = useState('');
  const designationRef = useRef<HTMLDivElement | null>(null);

  // Step 3: Salary & Bank
  const [baseSalary, setBaseSalary] = useState<number | ''>('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [taxId, setTaxId] = useState('');

  // Step 4: Emergency Contact & Address
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');

  // Derived read-only display values for Salary & Bank identification
  const employeeDisplayName = useMemo(() => {
    const fromInputs = `${firstName || ''} ${lastName || ''}`.trim();
    if (fromInputs) return fromInputs;
    if (activeEmployee) {
      if (activeEmployee.fullName) return activeEmployee.fullName.trim();
      const combined = `${activeEmployee.firstName || ''} ${activeEmployee.lastName || ''}`.trim();
      if (combined) return combined;
    }
    return '';
  }, [firstName, lastName, activeEmployee]);

  const employeeDisplayCode = useMemo(() => {
    return (
      activeEmployee?.employeeCode ||
      employeeToEdit?.employeeCode ||
      (employeeToEdit?.id ? `EMP-${employeeToEdit.id}` : 'Auto-Generated on Save')
    );
  }, [activeEmployee, employeeToEdit]);

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
      const source = employees.find((e) => e.id === employeeToEdit.id) || employeeToEdit;
      setFirstName(source.firstName || '');
      setLastName(source.lastName || '');
      setEmail(source.email || '');
      setPhone(source.phone || '');
      setAvatar(source.avatar || '');
      setAvatarFileName(source.avatar ? 'Current Profile Photo' : '');
      setUploadError('');
      setGender(source.gender || '');
      setDateOfBirth(source.dateOfBirth || '');
      setJoiningDate(source.joiningDate || '');
      setDepartmentId(source.departmentId || '');
      setDesignation(source.designation || '');
      setDesignationId(source.designationId || '');
      setDesignationCategory(source.designationCategory || '');
      setStatus(source.status || 'active');
      setEmploymentType(source.employmentType || '');
      setShiftId(source.shiftId || '');
      setWorkLocation(source.workLocation || '');

      // Load actual saved values directly and preserve them
      setBankName(source.bankName || '');
      setAccountNumber(source.accountNumber || '');
      setIfscCode(source.ifscCode || '');
      setTaxId(source.taxId || '');
      setBaseSalary(
        source.baseSalary !== undefined && source.baseSalary !== null
          ? source.baseSalary
          : ''
      );

      setEmergencyContactName(source.emergencyContactName || '');
      setEmergencyContactRelation(source.emergencyContactRelation || '');
      setEmergencyContactPhone(source.emergencyContactPhone || '');
      setAddress(source.address || '');

      setCity(source.city || '');
      setCountry(source.country || '');
      setBio(source.bio || '');
      setCompletedTabs(new Set(['personal', 'job', 'financial', 'emergency']));
      setTouchedFields(new Set());
    } else {
      // New employee: check draft if available, otherwise start completely empty
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
        setPhone(draft.phone || '');
        setAvatar(draft.avatar || '');
        setAvatarFileName(draft.avatar ? 'Draft Profile Photo' : '');
        setUploadError('');
        setGender(draft.gender || '');
        setDateOfBirth(draft.dateOfBirth || '');
        setCity(draft.city || '');
        setDesignation(draft.designation || '');
        setDesignationId(draft.designationId || '');
        setDesignationCategory(draft.designationCategory || '');
        setDepartmentId(draft.departmentId || '');
        setStatus(draft.status || 'active');
        setEmploymentType(draft.employmentType || '');
        setWorkLocation(draft.workLocation || '');
        setShiftId(draft.shiftId || '');
        setJoiningDate(draft.joiningDate || '');

        setBaseSalary(draft.baseSalary || '');
        setBankName(draft.bankName || '');
        setAccountNumber(draft.accountNumber || '');
        setIfscCode(draft.ifscCode || '');
        setTaxId(draft.taxId || '');
        setEmergencyContactName(draft.emergencyContactName || '');
        setEmergencyContactRelation(draft.emergencyContactRelation || '');
        setEmergencyContactPhone(draft.emergencyContactPhone || '');
        setAddress(draft.address || '');
        setCountry(draft.country || '');
        setBio(draft.bio || '');
        setCompletedTabs(new Set(draft.completedTabs || []));
        setTouchedFields(new Set());
      } else {
        // Completely empty new employee form
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setAvatar('');
        setAvatarFileName('');
        setUploadError('');
        setGender('');
        setDateOfBirth('');
        setCity('');
        setDesignation('');
        setDesignationId('');
        setDesignationCategory('');
        setDepartmentId('');
        setStatus('active');
        setEmploymentType('');
        setWorkLocation('');
        setShiftId('');
        setJoiningDate('');
        setBaseSalary('');
        setBankName('');
        setAccountNumber('');
        setIfscCode('');
        setTaxId('');
        setEmergencyContactName('');
        setEmergencyContactRelation('');
        setEmergencyContactPhone('');
        setAddress('');
        setCountry('');
        setBio('');
        setCompletedTabs(new Set());
      }
    }
  }, [employeeToEdit?.id, isOpen]);

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
    markTouched('designation');
    markTouched('designationId');
    markTouched('designationCategory');
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
      markTouched('departmentId');
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
      markTouched('departmentId');
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
        ifscCode,
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
      markTouched('avatar');
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
    markTouched('avatar');
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
      const trimmedIfsc = ifscCode.trim().toUpperCase();
      if (!trimmedIfsc) {
        err.ifscCode = 'IFSC Code is required';
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmedIfsc)) {
        err.ifscCode = 'Invalid IFSC code format (e.g. SBIN0001234: 4 letters, 0, followed by 6 alphanumeric characters)';
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
        delete copy.ifscCode;
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

    const trimmedIfsc = ifscCode.trim().toUpperCase();
    if (!trimmedIfsc) {
      err.ifscCode = 'IFSC Code is required';
      if (!firstInvalidTab) {
        firstInvalidTab = 'financial';
      }
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmedIfsc)) {
      err.ifscCode = 'Invalid IFSC code format (e.g. SBIN0001234: 4 letters, 0, followed by 6 alphanumeric characters)';
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

  // Construct update payload preserving unedited database values
  const getPayloadForEmployee = (): Partial<Employee> => {
    const current = activeEmployee;
    const dept = departments.find((d) => d.id === departmentId);
    const shift = shiftTemplates.find((s) => s.id === shiftId);

    const fName = touchedFields.has('firstName') ? firstName.trim() : (current?.firstName ?? firstName.trim());
    const lName = touchedFields.has('lastName') ? lastName.trim() : (current?.lastName ?? lastName.trim());
    const full = `${fName} ${lName}`.trim();

    const finalAvatar = avatar || (current?.avatar ? current.avatar : getInitialsAvatar(full || 'Employee'));

    let salaryVal: number | undefined;
    if (touchedFields.has('baseSalary')) {
      salaryVal = baseSalary !== '' && !isNaN(Number(baseSalary)) ? Number(baseSalary) : undefined;
    } else {
      salaryVal = current?.baseSalary !== undefined ? current.baseSalary : (baseSalary !== '' && !isNaN(Number(baseSalary)) ? Number(baseSalary) : undefined);
    }

    const payload: Partial<Employee> = {
      firstName: fName,
      lastName: lName,
      fullName: full,
      email: touchedFields.has('email') ? email.trim() : (current?.email ?? email.trim()),
      phone: touchedFields.has('phone') ? phone.trim() : (current?.phone ?? phone.trim()),
      avatar: finalAvatar,
      gender: touchedFields.has('gender') ? gender : (current?.gender ?? gender),
      dateOfBirth: touchedFields.has('dateOfBirth') ? dateOfBirth : (current?.dateOfBirth ?? dateOfBirth),
      city: touchedFields.has('city') ? city.trim() : (current?.city ?? city.trim()),

      designation: touchedFields.has('designation') ? designation.trim() : (current?.designation ?? designation.trim()),
      designationId: touchedFields.has('designationId') ? designationId : (current?.designationId ?? designationId),
      designationCategory: touchedFields.has('designationCategory') ? designationCategory : (current?.designationCategory ?? designationCategory),
      departmentId: touchedFields.has('departmentId') ? departmentId : (current?.departmentId ?? departmentId),
      departmentName: dept?.name || expectedDepartmentName || current?.departmentName || 'Software Development',
      status: touchedFields.has('status') ? status : (current?.status ?? status),
      employmentType: touchedFields.has('employmentType') ? employmentType : (current?.employmentType ?? employmentType),
      workLocation: touchedFields.has('workLocation') ? workLocation : (current?.workLocation ?? workLocation),
      shiftId: touchedFields.has('shiftId') ? shiftId : (current?.shiftId ?? shiftId),
      shiftName: shift?.name || current?.shiftName || 'Morning Shift',
      joiningDate: touchedFields.has('joiningDate') ? joiningDate : (current?.joiningDate ?? joiningDate),

      baseSalary: salaryVal,
      currency: 'INR',
      bankName: touchedFields.has('bankName') ? bankName.trim() : (current?.bankName ?? bankName.trim()),
      accountNumber: touchedFields.has('accountNumber') ? accountNumber.trim() : (current?.accountNumber ?? accountNumber.trim()),
      ifscCode: touchedFields.has('ifscCode') ? ifscCode.trim().toUpperCase() : (current?.ifscCode ?? ifscCode.trim().toUpperCase()),
      taxId: touchedFields.has('taxId') ? taxId.trim() : (current?.taxId ?? taxId.trim()),

      emergencyContactName: touchedFields.has('emergencyContactName') ? emergencyContactName.trim() : (current?.emergencyContactName ?? emergencyContactName.trim()),
      emergencyContactRelation: touchedFields.has('emergencyContactRelation') ? emergencyContactRelation.trim() : (current?.emergencyContactRelation ?? emergencyContactRelation.trim()),
      emergencyContactPhone: touchedFields.has('emergencyContactPhone') ? emergencyContactPhone.trim() : (current?.emergencyContactPhone ?? emergencyContactPhone.trim()),
      address: touchedFields.has('address') ? address.trim() : (current?.address ?? address.trim()),
      country: touchedFields.has('country') ? country.trim() : (current?.country ?? country.trim() ?? 'India'),
      bio: touchedFields.has('bio') ? bio.trim() : (current?.bio ?? bio.trim()),
    };

    return payload;
  };

  // Tab Header Click Navigation
  const handleTabClick = (targetTab: FormTab) => {
    const stepOrder: FormTab[] = ['personal', 'job', 'financial', 'emergency'];
    const currentIndex = stepOrder.indexOf(activeTab);
    const targetIndex = stepOrder.indexOf(targetTab);

    // If editing employee, auto-save valid changes from current tab
    if (employeeToEdit && validateStep(activeTab)) {
      try {
        const payload = getPayloadForEmployee();
        updateEmployee(employeeToEdit.id, payload);
      } catch (err) {
        console.error('Auto-save on tab click failed:', err);
      }
    }

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
    if (!employeeToEdit) {
      saveDraft();
    }

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
  const handleNext = async (currentTab: FormTab, nextTab: FormTab) => {
    if (!validateStep(currentTab)) return;
    setCompletedTabs((prev) => new Set([...prev, currentTab]));

    if (employeeToEdit) {
      try {
        setIsSubmitting(true);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const payload = getPayloadForEmployee();
        updateEmployee(employeeToEdit.id, payload);
      } catch (err: any) {
        console.error('Failed to save tab updates:', err);
        return;
      } finally {
        setIsSubmitting(false);
      }
    } else {
      saveDraft();
    }

    setActiveTab(nextTab);
  };

  const handleBack = (prevTab: FormTab) => {
    if (!employeeToEdit) {
      saveDraft();
    }
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
      await new Promise((resolve) => setTimeout(resolve, 350));

      const payload = getPayloadForEmployee();

      if (employeeToEdit) {
        updateEmployee(employeeToEdit.id, payload);
      } else {
        addEmployee(payload as any);
      }

      // Clear draft on successful creation
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }

      onClose();
    } catch (err: any) {
      console.error('Final submit failed:', err);
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
              <label className="block text-xs font-semibold text-white uppercase mb-2">
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
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Employee Personal Information
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    markTouched('firstName');
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
                <label className="block text-xs font-semibold text-white uppercase mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    markTouched('lastName');
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
                <label className="block text-xs font-semibold text-white uppercase mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    markTouched('email');
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
                <label className="block text-xs font-semibold text-white uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    markTouched('phone');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  placeholder="e.g. +1 (555) 000-0000"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as any);
                    markTouched('gender');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Select Gender...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    markTouched('dateOfBirth');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">City & State</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    markTouched('city');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                  placeholder="e.g. San Francisco, CA"
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
                <label className="block text-xs font-semibold text-white uppercase mb-1">
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
                  <label className="block text-xs font-semibold text-white uppercase">
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
                    markTouched('departmentId');
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
                <label className="block text-xs font-semibold text-white uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as any);
                    markTouched('status');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => {
                    setEmploymentType(e.target.value as any);
                    markTouched('employmentType');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Select Employment Type...</option>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Work Location</label>
                <select
                  value={workLocation}
                  onChange={(e) => {
                    setWorkLocation(e.target.value as any);
                    markTouched('workLocation');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Select Work Location...</option>
                  <option value="On-site">On-site (HQ)</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            </div>

            {/* Bottom Row: Shift Schedule & Joining Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">
                  Shift Schedule *
                </label>
                <select
                  value={shiftId}
                  onChange={(e) => {
                    setShiftId(e.target.value);
                    markTouched('shiftId');
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
                <label className="block text-xs font-semibold text-white uppercase mb-1">Joining Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => {
                    setJoiningDate(e.target.value);
                    markTouched('joiningDate');
                  }}
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

            {/* Top Row: Employee Identification (Read-Only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1 flex items-center justify-between">
                  <span>Employee Name</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase tracking-normal flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                    <span>read-only</span>
                  </span>
                </label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={employeeDisplayName}
                  className="w-full px-3 py-2 text-sm rounded-xl font-medium cursor-not-allowed select-none opacity-90 focus:outline-hidden"
                  placeholder="Enter employee name in Personal Info"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1 flex items-center justify-between">
                  <span>Employee ID</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase tracking-normal flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                    <span>read-only</span>
                  </span>
                </label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={employeeDisplayCode}
                  className="w-full px-3 py-2 text-sm rounded-xl font-mono cursor-not-allowed select-none opacity-90 text-slate-300 focus:outline-hidden"
                  placeholder="Auto-generated on save"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">
                  Monthly Base Salary (USD) *
                </label>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setBaseSalary(val);
                    markTouched('baseSalary');
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
                  placeholder="e.g. 6500"
                />
                {errors.baseSalary && <span className="text-[11px] text-red-500">{errors.baseSalary}</span>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Disbursing Bank</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    markTouched('bankName');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="e.g. Silicon Valley Bank / Chase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value);
                    markTouched('accountNumber');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  placeholder="e.g. 1234567890"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Tax ID / SSN</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => {
                    setTaxId(e.target.value);
                    markTouched('taxId');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  placeholder="e.g. US-TAX-98211"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">
                  IFSC CODE <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={ifscCode}
                  maxLength={11}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setIfscCode(val);
                    markTouched('ifscCode');
                    if (errors.ifscCode) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.ifscCode;
                        return copy;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl font-mono uppercase tracking-wider text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] ${
                    errors.ifscCode ? 'border-red-500' : 'border-slate-200'
                  }`}
                  placeholder="e.g. SBIN0001234"
                />
                {errors.ifscCode && (
                  <span className="text-[11px] text-red-500 mt-1 block">
                    {errors.ifscCode}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Emergency Contact */}
        {activeTab === 'emergency' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => {
                    setEmergencyContactName(e.target.value);
                    markTouched('emergencyContactName');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="e.g. Robert Vance"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white uppercase mb-1">Relationship</label>
                <input
                  type="text"
                  value={emergencyContactRelation}
                  onChange={(e) => {
                    setEmergencyContactRelation(e.target.value);
                    markTouched('emergencyContactRelation');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="e.g. Spouse / Parent / Sibling"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white uppercase mb-1">Emergency Phone Number</label>
              <input
                type="text"
                value={emergencyContactPhone}
                onChange={(e) => {
                  setEmergencyContactPhone(e.target.value);
                  markTouched('emergencyContactPhone');
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                placeholder="e.g. +1 (555) 000-0000"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white uppercase mb-1">Residential Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  markTouched('address');
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
                placeholder="e.g. 123 Main Street, Suite 400"
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
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
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
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
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
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
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
