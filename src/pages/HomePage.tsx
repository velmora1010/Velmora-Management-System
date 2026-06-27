import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  FolderOpen, 
  Megaphone, 
  CheckSquare, 
  Lightbulb, 
  Users, 
  Tag, 
  Settings, 
  Banknote,
  Ticket
} from 'lucide-react';

const DEPARTMENTS = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, color: '#6366f1', path: '/dashboard' },
  { id: 'inventory', title: 'Inventory', icon: Package, color: '#f59e0b', path: '/inventory/dashboard' },
  { id: 'sales', title: 'Sales', icon: TrendingUp, color: '#22c55e', path: '/sales' },
  { id: 'documents', title: 'Document Room', icon: FolderOpen, color: '#3b82f6', path: '/documents' },
  { id: 'marketing', title: 'Marketing', icon: Megaphone, color: '#ec4899', path: '/marketing' },
  { id: 'tasks', title: 'Task Manager', icon: CheckSquare, color: '#8b5cf6', path: '/tasks' },
  { id: 'research', title: 'Research & Development', icon: Lightbulb, color: '#a855f7', path: '/research' },
  { id: 'hr', title: 'Human Resources', icon: Users, color: '#f97316', path: '/hr' },
  { id: 'brand', title: 'Brand Management', icon: Tag, color: '#e11d48', path: '/brand' },
  { id: 'operations', title: 'Operations', icon: Settings, color: '#64748b', path: '/operations' },
  { id: 'finance', title: 'Finance', icon: Banknote, color: '#10b981', path: '/finance' },
  { id: 'customer-tickets', title: 'Customer Tickets', icon: Ticket, color: '#f43f5e', path: '/tickets' }
];

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-main tracking-tight">Home</h1>
        <p className="text-muted text-sm">Welcome back to Velmora Admin. Select a department to get started.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {DEPARTMENTS.map((dept) => {
          const Icon = dept.icon;
          return (
            <div 
              key={dept.id}
              onClick={() => navigate(dept.path)}
              className="flex flex-col items-center justify-center gap-4 p-6 bg-card border border-border rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-black/20 group"
            >
              <div 
                className="flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                style={{ color: dept.color }}
              >
                <Icon size={32} strokeWidth={1.5} />
              </div>
              <div className="text-sm font-semibold text-main text-center leading-tight">
                {dept.title}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
