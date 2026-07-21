export interface Department {
  id: number;
  department_name: string;
  department_code?: string | null;
  description?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentSection {
  id: number;
  department_id: number;
  section_name: string;
  section_code?: string | null;
  description?: string | null;
  status: string;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export type CreateDepartmentInput = Omit<Department, 'id' | 'created_at' | 'updated_at'> & {
  id?: number;
};

export type UpdateDepartmentInput = Partial<Omit<Department, 'id' | 'created_at' | 'updated_at'>>;

export type CreateSectionInput = Omit<DepartmentSection, 'id' | 'created_at' | 'updated_at'> & {
  id?: number;
};

export type UpdateSectionInput = Partial<Omit<DepartmentSection, 'id' | 'created_at' | 'updated_at'>>;
