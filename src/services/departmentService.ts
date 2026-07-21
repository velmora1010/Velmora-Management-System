import { supabase } from '../lib/supabase';
import type { 
  Department, 
  DepartmentSection, 
  CreateDepartmentInput, 
  UpdateDepartmentInput, 
  CreateSectionInput, 
  UpdateSectionInput 
} from '../types';

let cachedDepartments: Department[] | null = null;
let cachedAllSections: DepartmentSection[] | null = null;

export const departmentService = {
  clearCache() {
    cachedDepartments = null;
    cachedAllSections = null;
  },

  // Departments
  async getAllDepartments(forceRefresh = false): Promise<{ data: Department[] | null; error: any }> {
    try {
      if (!forceRefresh && cachedDepartments) {
        return { data: cachedDepartments, error: null };
      }
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('department_name', { ascending: true });
      if (!error && data) {
        cachedDepartments = data;
      }
      return { data, error };
    } catch (err: any) {
      console.error('Error in getAllDepartments:', err);
      return { data: null, error: err };
    }
  },

  async getDepartmentById(id: number | string): Promise<{ data: Department | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    } catch (err: any) {
      console.error(`Error in getDepartmentById for ID ${id}:`, err);
      return { data: null, error: err };
    }
  },

  async createDepartment(input: CreateDepartmentInput): Promise<{ data: Department | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert(input)
        .select()
        .single();
      if (!error) this.clearCache();
      return { data, error };
    } catch (err: any) {
      console.error('Error in createDepartment:', err);
      return { data: null, error: err };
    }
  },

  async updateDepartment(id: number | string, input: UpdateDepartmentInput): Promise<{ data: Department | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (!error) this.clearCache();
      return { data, error };
    } catch (err: any) {
      console.error(`Error in updateDepartment for ID ${id}:`, err);
      return { data: null, error: err };
    }
  },

  async deleteDepartment(id: number | string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      if (!error) this.clearCache();
      return { success: !error, error };
    } catch (err: any) {
      console.error(`Error in deleteDepartment for ID ${id}:`, err);
      return { success: false, error: err };
    }
  },

  // Sections
  async getAllSections(forceRefresh = false): Promise<{ data: DepartmentSection[] | null; error: any }> {
    try {
      if (!forceRefresh && cachedAllSections) {
        return { data: cachedAllSections, error: null };
      }
      const { data, error } = await supabase
        .from('department_sections')
        .select('*')
        .order('section_name', { ascending: true });
      if (!error && data) {
        cachedAllSections = data;
      }
      return { data, error };
    } catch (err: any) {
      console.error('Error in getAllSections:', err);
      return { data: null, error: err };
    }
  },

  async getSectionsByDepartment(departmentId: number | string): Promise<{ data: DepartmentSection[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('department_sections')
        .select('*')
        .eq('department_id', departmentId)
        .order('section_name', { ascending: true });
      return { data, error };
    } catch (err: any) {
      console.error(`Error in getSectionsByDepartment for department ID ${departmentId}:`, err);
      return { data: null, error: err };
    }
  },

  async getSectionById(id: number | string): Promise<{ data: DepartmentSection | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('department_sections')
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    } catch (err: any) {
      console.error(`Error in getSectionById for ID ${id}:`, err);
      return { data: null, error: err };
    }
  },

  async createSection(input: CreateSectionInput): Promise<{ data: DepartmentSection | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('department_sections')
        .insert(input)
        .select()
        .single();
      if (!error) this.clearCache();
      return { data, error };
    } catch (err: any) {
      console.error('Error in createSection:', err);
      return { data: null, error: err };
    }
  },

  async updateSection(id: number | string, input: UpdateSectionInput): Promise<{ data: DepartmentSection | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('department_sections')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (!error) this.clearCache();
      return { data, error };
    } catch (err: any) {
      console.error(`Error in updateSection for ID ${id}:`, err);
      return { data: null, error: err };
    }
  },

  async deleteSection(id: number | string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('department_sections')
        .delete()
        .eq('id', id);
      if (!error) this.clearCache();
      return { success: !error, error };
    } catch (err: any) {
      console.error(`Error in deleteSection for ID ${id}:`, err);
      return { success: false, error: err };
    }
  }
};
