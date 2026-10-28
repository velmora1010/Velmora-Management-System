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
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-[#172B4D]">Department Distribution</h3>
        <p className="text-xs text-[#64748B]">Workforce allocation across business units</p>
      </div>

      {!hasData ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-auto">
          <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200/60 mb-2.5 text-slate-400">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-[#172B4D]">No data available yet.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
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
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
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
              <span className="text-2xl font-black text-[#172B4D]">{totalEmployees}</span>
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
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
                <span className="text-slate-600 truncate text-[11px] font-medium">
                  {item.code}: <span className="font-bold text-[#172B4D]">{item.value}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
