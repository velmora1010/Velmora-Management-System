import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useHRMS } from '../../../context/HRMSContext';
import { Users } from 'lucide-react';

export const EmployeeGrowthChart: React.FC = () => {
  const { employees } = useHRMS();

  const hasData = employees.length > 0;

  const data = [
    { month: 'Oct', headcount: employees.length, additions: employees.length },
  ];

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#172B4D]">Workforce Expansion & Growth</h3>
        <p className="text-xs text-[#64748B]">Cumulative headcount additions throughout 2026</p>
      </div>

      {!hasData ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-auto">
          <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200/60 mb-2.5 text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-[#172B4D]">No data available yet.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  domain={[0, Math.max(5, employees.length + 2)]}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val} Employees`, 'Total Staff']}
                />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  stroke="#18A999"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#18A999', strokeWidth: 2, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Year-to-Date Growth: <strong className="text-emerald-600">Active</strong></span>
            <span>Current Active Total: <strong className="text-[#172B4D]">{employees.length}</strong></span>
          </div>
        </>
      )}
    </div>
  );
};
