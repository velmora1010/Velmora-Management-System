import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useHRMS } from '../../../context/HRMSContext';
import { TrendingUp } from 'lucide-react';

export const MonthlyAttendanceChart: React.FC = () => {
  const { departments, attendanceRecords } = useHRMS();
  const [chartDept, setChartDept] = useState('all');

  const hasRecords = attendanceRecords.length > 0;

  const data: Array<{ month: string; rate: number }> = [];

  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Monthly Attendance Trends</h3>
          <p className="text-xs text-muted">Historical adherence & punctuality rate (%)</p>
        </div>

        {/* Filter Dropdown */}
        {departments.length > 0 && (
          <select
            value={chartDept}
            onChange={(e) => setChartDept(e.target.value)}
            className="text-xs bg-slate-900/60 border border-border rounded-xl px-2.5 py-1.5 font-medium text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all" className="bg-[#161b22] text-white">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} className="bg-[#161b22] text-white">
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasRecords ? (
        <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-slate-900/30">
          <div className="p-3 bg-slate-800 rounded-xl shadow-xs border border-border mb-2.5 text-slate-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-white">No data available yet.</p>
          <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B8CFF" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7B8CFF" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <YAxis
                domain={[85, 100]}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161B22',
                  borderRadius: '12px',
                  border: '1px solid #30363D',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                  fontSize: '12px',
                  color: '#F8FAFC',
                }}
                formatter={(value: any) => [`${value}%`, 'Adherence Rate']}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#7B8CFF"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#attendanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
