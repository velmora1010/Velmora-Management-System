import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useHRMS } from '../../../context/HRMSContext';
import { Building2 } from 'lucide-react';

export const DepartmentDonutChart: React.FC = () => {
  const { departments, employees } = useHRMS();

  const data = departments.map((dept) => {
    const count = employees.filter((e) => e.departmentId === dept.id).length;
    return {
      name: dept.name,
      code: dept.code,
      value: count,
      color: dept.color,
    };
  });

  const totalEmployees = employees.length;
  const hasData = totalEmployees > 0 && departments.length > 0;

  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-white">Department Distribution</h3>
        <p className="text-xs text-muted">Workforce allocation across business units</p>
      </div>

      {!hasData ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-slate-900/30 my-auto">
          <div className="p-3 bg-slate-800 rounded-xl shadow-xs border border-border mb-2.5 text-slate-400">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-white">No data available yet.</p>
          <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="relative h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161B22',
                    borderRadius: '12px',
                    border: '1px solid #30363D',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                  formatter={(val: any, name: any) => [`${val} Employees`, name]}
                />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center Total Count Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-white">{totalEmployees}</span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                Total Staff
              </span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {data.map((item) => (
              <div key={item.code} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-300 truncate text-[11px] font-medium">
                  {item.code}: <span className="font-bold text-white">{item.value}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
