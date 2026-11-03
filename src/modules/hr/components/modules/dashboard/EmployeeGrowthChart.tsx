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
    <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">Workforce Expansion & Growth</h3>
        <p className="text-xs text-muted">Cumulative headcount additions throughout 2026</p>
      </div>

      {!hasData ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-slate-900/30 my-auto">
          <div className="p-3 bg-slate-800 rounded-xl shadow-xs border border-border mb-2.5 text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-white">No data available yet.</p>
          <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
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
                    backgroundColor: '#161B22',
                    borderRadius: '12px',
                    border: '1px solid #30363D',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                  formatter={(val: any) => [`${val} Employees`, 'Total Staff']}
                />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  stroke="#7B8CFF"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#7B8CFF', strokeWidth: 2, stroke: '#161B22' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted">
            <span>Year-to-Date Growth: <strong className="text-emerald-400">Active</strong></span>
            <span>Current Active Total: <strong className="text-white">{employees.length}</strong></span>
          </div>
        </>
      )}
    </div>
  );
};
