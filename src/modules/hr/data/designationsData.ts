import { ShiftTemplate, Department } from '../types/hrms';

export interface DesignationItem {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
}

export const DESIGNATION_CATEGORIES = [
  'Software Development',
  'UI/UX & Design',
  'Software Testing',
  'IT Infrastructure',
  'Data & Artificial Intelligence',
  'Project & Product Management',
  'Marketing & Business',
  'Human Resources & Administration',
  'Finance & Accounts',
  'Leadership',
] as const;

export type DesignationCategoryType = typeof DESIGNATION_CATEGORIES[number];

// Configurable Category to Department Name Mapping
export const CATEGORY_DEPARTMENT_MAP: Record<string, string> = {
  'Software Development': 'Software Development',
  'UI/UX & Design': 'UI/UX & Design',
  'Software Testing': 'Quality Assurance',
  'IT Infrastructure': 'IT Infrastructure',
  'Data & Artificial Intelligence': 'Data & AI',
  'Project & Product Management': 'Project Management',
  'Marketing & Business': 'Marketing / Business Development',
  'Human Resources & Administration': 'Human Resources / Administration',
  'Finance & Accounts': 'Finance & Accounts',
  'Leadership': 'Management',
};

// Department configuration metadata for auto-provisioning
export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept-dev',
    name: 'Software Development',
    code: 'DEV',
    description: 'Software engineering, application development, and core systems',
    location: 'Building A, Floor 3',
    monthlyBudget: 250000,
    color: '#206DA6',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-design',
    name: 'UI/UX & Design',
    code: 'DES',
    description: 'User experience research, UI design, prototyping, and graphic design',
    location: 'Building A, Floor 2',
    monthlyBudget: 120000,
    color: '#8B5CF6',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-qa',
    name: 'Quality Assurance',
    code: 'QA',
    description: 'Software testing, test automation, QA engineering, and release certification',
    location: 'Building A, Floor 3',
    monthlyBudget: 140000,
    color: '#10B981',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-it',
    name: 'IT Infrastructure',
    code: 'IT',
    description: 'Cloud architecture, DevOps, IT support, networking, and system administration',
    location: 'Server Room, Floor 1',
    monthlyBudget: 180000,
    color: '#06B6D4',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-data',
    name: 'Data & AI',
    code: 'DAI',
    description: 'Data analytics, machine learning, AI engineering, and business intelligence',
    location: 'Building B, Floor 2',
    monthlyBudget: 200000,
    color: '#6366F1',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-pm',
    name: 'Project Management',
    code: 'PM',
    description: 'Agile delivery, scrum management, product lifecycle, and business analysis',
    location: 'Building A, Floor 4',
    monthlyBudget: 150000,
    color: '#F59E0B',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-mkt',
    name: 'Marketing / Business Development',
    code: 'MKT',
    description: 'Digital marketing, sales, content, branding, and enterprise partnerships',
    location: 'Building B, Floor 3',
    monthlyBudget: 160000,
    color: '#EC4899',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-hr',
    name: 'Human Resources / Administration',
    code: 'HR',
    description: 'Talent acquisition, employee welfare, HR policies, and administrative operations',
    location: 'Building A, Floor 1',
    monthlyBudget: 110000,
    color: '#14B8A6',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-fin',
    name: 'Finance & Accounts',
    code: 'FIN',
    description: 'Financial reporting, accounts payable/receivable, payroll, and fiscal compliance',
    location: 'Building A, Floor 1',
    monthlyBudget: 130000,
    color: '#84CC16',
    createdAt: '2026-01-01',
  },
  {
    id: 'dept-mgmt',
    name: 'Management',
    code: 'MGMT',
    description: 'Executive leadership, corporate strategy, operations, and governance',
    location: 'Executive Suite, Floor 5',
    monthlyBudget: 350000,
    color: '#1E293B',
    createdAt: '2026-01-01',
  },
];

// Required 3 standard company shifts
export const DEFAULT_SHIFTS: ShiftTemplate[] = [
  {
    id: 'shift-morning',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '17:00',
    color: '#0284C7',
    workHours: 8,
    description: 'Morning Shift (09:00 AM – 05:00 PM)',
  },
  {
    id: 'shift-afternoon',
    name: 'Afternoon Shift',
    startTime: '13:00',
    endTime: '21:00',
    color: '#D97706',
    workHours: 8,
    description: 'Afternoon Shift (01:00 PM – 09:00 PM)',
  },
  {
    id: 'shift-evening',
    name: 'Evening Shift',
    startTime: '15:00',
    endTime: '23:00',
    color: '#7C3AED',
    workHours: 8,
    description: 'Evening Shift (03:00 PM – 11:00 PM)',
  },
];

// IT-Sector Master Designations
export const MASTER_DESIGNATIONS: DesignationItem[] = [
  // 1. Software Development (18 roles)
  { id: 'desig-sw-dev', name: 'Software Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-jr-sw-dev', name: 'Junior Software Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-sr-sw-dev', name: 'Senior Software Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-fe-dev', name: 'Frontend Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-be-dev', name: 'Backend Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-fs-dev', name: 'Full Stack Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-react-dev', name: 'React Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-angular-dev', name: 'Angular Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-node-dev', name: 'Node.js Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-python-dev', name: 'Python Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-java-dev', name: 'Java Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-php-dev', name: 'PHP Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-dotnet-dev', name: '.NET Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-mobile-dev', name: 'Mobile App Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-android-dev', name: 'Android Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-ios-dev', name: 'iOS Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-flutter-dev', name: 'Flutter Developer', category: 'Software Development', status: 'active' },
  { id: 'desig-wp-dev', name: 'WordPress Developer', category: 'Software Development', status: 'active' },

  // 2. UI/UX & Design (8 roles)
  { id: 'desig-ui-des', name: 'UI Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-ux-des', name: 'UX Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-uiux-des', name: 'UI/UX Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-graphic-des', name: 'Graphic Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-web-des', name: 'Web Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-prod-des', name: 'Product Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-motion-des', name: 'Motion Graphic Designer', category: 'UI/UX & Design', status: 'active' },
  { id: 'desig-creative-des', name: 'Creative Designer', category: 'UI/UX & Design', status: 'active' },

  // 3. Software Testing (6 roles)
  { id: 'desig-sw-tester', name: 'Software Tester', category: 'Software Testing', status: 'active' },
  { id: 'desig-manual-tester', name: 'Manual Tester', category: 'Software Testing', status: 'active' },
  { id: 'desig-auto-tester', name: 'Automation Tester', category: 'Software Testing', status: 'active' },
  { id: 'desig-qa-eng', name: 'QA Engineer', category: 'Software Testing', status: 'active' },
  { id: 'desig-sr-qa-eng', name: 'Senior QA Engineer', category: 'Software Testing', status: 'active' },
  { id: 'desig-test-lead', name: 'Test Lead', category: 'Software Testing', status: 'active' },

  // 4. IT Infrastructure (8 roles)
  { id: 'desig-it-sup', name: 'IT Support Engineer', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-tech-sup', name: 'Technical Support Engineer', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-sys-admin', name: 'System Administrator', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-net-eng', name: 'Network Engineer', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-cloud-eng', name: 'Cloud Engineer', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-devops-eng', name: 'DevOps Engineer', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-cyber-analyst', name: 'Cybersecurity Analyst', category: 'IT Infrastructure', status: 'active' },
  { id: 'desig-dba', name: 'Database Administrator', category: 'IT Infrastructure', status: 'active' },

  // 5. Data & Artificial Intelligence (6 roles)
  { id: 'desig-data-analyst', name: 'Data Analyst', category: 'Data & Artificial Intelligence', status: 'active' },
  { id: 'desig-data-sci', name: 'Data Scientist', category: 'Data & Artificial Intelligence', status: 'active' },
  { id: 'desig-data-eng', name: 'Data Engineer', category: 'Data & Artificial Intelligence', status: 'active' },
  { id: 'desig-ai-eng', name: 'AI Engineer', category: 'Data & Artificial Intelligence', status: 'active' },
  { id: 'desig-ml-eng', name: 'Machine Learning Engineer', category: 'Data & Artificial Intelligence', status: 'active' },
  { id: 'desig-bi-analyst', name: 'Business Intelligence Analyst', category: 'Data & Artificial Intelligence', status: 'active' },

  // 6. Project & Product Management (8 roles)
  { id: 'desig-pm', name: 'Project Manager', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-tech-pm', name: 'Technical Project Manager', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-prod-mgr', name: 'Product Manager', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-scrum-master', name: 'Scrum Master', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-biz-analyst', name: 'Business Analyst', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-prod-owner', name: 'Product Owner', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-team-lead', name: 'Team Lead', category: 'Project & Product Management', status: 'active' },
  { id: 'desig-tech-lead', name: 'Technical Lead', category: 'Project & Product Management', status: 'active' },

  // 7. Marketing & Business (8 roles)
  { id: 'desig-digital-mkt', name: 'Digital Marketing Executive', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-seo-spec', name: 'SEO Specialist', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-social-mgr', name: 'Social Media Manager', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-content-writer', name: 'Content Writer', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-perf-mkt', name: 'Performance Marketing Specialist', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-bde', name: 'Business Development Executive', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-sales-exec', name: 'Sales Executive', category: 'Marketing & Business', status: 'active' },
  { id: 'desig-bdm', name: 'Business Development Manager', category: 'Marketing & Business', status: 'active' },

  // 8. Human Resources & Administration (6 roles)
  { id: 'desig-hr-exec', name: 'HR Executive', category: 'Human Resources & Administration', status: 'active' },
  { id: 'desig-hr-mgr', name: 'HR Manager', category: 'Human Resources & Administration', status: 'active' },
  { id: 'desig-recruiter', name: 'Recruiter', category: 'Human Resources & Administration', status: 'active' },
  { id: 'desig-talent-acq', name: 'Talent Acquisition Specialist', category: 'Human Resources & Administration', status: 'active' },
  { id: 'desig-office-admin', name: 'Office Administrator', category: 'Human Resources & Administration', status: 'active' },
  { id: 'desig-ops-mgr', name: 'Operations Manager', category: 'Human Resources & Administration', status: 'active' },

  // 9. Finance & Accounts (4 roles)
  { id: 'desig-accountant', name: 'Accountant', category: 'Finance & Accounts', status: 'active' },
  { id: 'desig-acc-exec', name: 'Accounts Executive', category: 'Finance & Accounts', status: 'active' },
  { id: 'desig-fin-mgr', name: 'Finance Manager', category: 'Finance & Accounts', status: 'active' },
  { id: 'desig-payroll-exec', name: 'Payroll Executive', category: 'Finance & Accounts', status: 'active' },

  // 10. Leadership (6 roles)
  { id: 'desig-ceo', name: 'Chief Executive Officer (CEO)', category: 'Leadership', status: 'active' },
  { id: 'desig-cto', name: 'Chief Technology Officer (CTO)', category: 'Leadership', status: 'active' },
  { id: 'desig-coo', name: 'Chief Operating Officer (COO)', category: 'Leadership', status: 'active' },
  { id: 'desig-it-mgr', name: 'IT Manager', category: 'Leadership', status: 'active' },
  { id: 'desig-eng-mgr', name: 'Engineering Manager', category: 'Leadership', status: 'active' },
  { id: 'desig-dev-mgr', name: 'Development Manager', category: 'Leadership', status: 'active' },
];

export const getDepartmentNameForCategory = (category: string): string => {
  return CATEGORY_DEPARTMENT_MAP[category] || 'Software Development';
};

export const getDepartmentNameForDesignation = (designationName: string): string => {
  const match = MASTER_DESIGNATIONS.find(
    (d) => d.name.toLowerCase() === designationName.toLowerCase()
  );
  if (match) {
    return getDepartmentNameForCategory(match.category);
  }
  return 'Software Development';
};
