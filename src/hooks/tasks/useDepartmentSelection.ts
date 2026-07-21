import { useState, useEffect, useCallback } from 'react';
import { departmentService } from '../../services/departmentService';
import type { Department, DepartmentSection } from '../../types';

// Simple global memory cache for departments to load only once
let cachedDepartments: Department[] | null = null;
// Simple cache for sections grouped by department_id
const cachedSections: Record<number, DepartmentSection[]> = {};

export const useDepartmentSelection = (initialDepartmentId?: number | string, initialSectionId?: number | string) => {
  const [departments, setDepartments] = useState<Department[]>(cachedDepartments || []);
  const [sections, setSections] = useState<DepartmentSection[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDepartmentId ? String(initialDepartmentId) : '');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSectionId ? String(initialSectionId) : '');
  
  const [isDeptsLoading, setIsDeptsLoading] = useState(false);
  const [isSectionsLoading, setIsSectionsLoading] = useState(false);
  
  const [deptsError, setDeptsError] = useState<string | null>(null);
  const [sectionsError, setSectionsError] = useState<string | null>(null);

  // Load Departments
  const loadDepartments = useCallback(async () => {
    if (cachedDepartments) {
      setDepartments(cachedDepartments);
      return;
    }
    setIsDeptsLoading(true);
    setDeptsError(null);
    try {
      const { data, error } = await departmentService.getAllDepartments();
      if (error) {
        setDeptsError('Failed to load departments. Please try again.');
      } else if (data) {
        cachedDepartments = data;
        setDepartments(data);
      }
    } catch (err) {
      setDeptsError('Failed to load departments.');
    } finally {
      setIsDeptsLoading(false);
    }
  }, []);

  // Load Sections when selected department changes
  const loadSections = useCallback(async (deptId: number) => {
    if (cachedSections[deptId]) {
      setSections(cachedSections[deptId]);
      return;
    }
    setIsSectionsLoading(true);
    setSectionsError(null);
    try {
      const { data, error } = await departmentService.getSectionsByDepartment(deptId);
      if (error) {
        setSectionsError('Failed to load sections.');
      } else if (data) {
        cachedSections[deptId] = data;
        setSections(data);
      }
    } catch (err) {
      setSectionsError('Failed to load sections.');
    } finally {
      setIsSectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // Handle department change
  const handleDepartmentChange = useCallback((deptIdStr: string) => {
    setSelectedDeptId(deptIdStr);
    setSelectedSectionId(''); // Clear previously selected section
    setSections([]); // Reset sections
    
    if (deptIdStr) {
      const deptId = Number(deptIdStr);
      if (!isNaN(deptId)) {
        loadSections(deptId);
      }
    }
  }, [loadSections]);

  // Load initial sections if department is present
  useEffect(() => {
    if (selectedDeptId) {
      const deptId = Number(selectedDeptId);
      if (!isNaN(deptId)) {
        loadSections(deptId);
      }
    }
  }, [selectedDeptId, loadSections]);

  return {
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
  };
};
