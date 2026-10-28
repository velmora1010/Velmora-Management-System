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
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#172B4D]">Monthly Attendance Trends</h3>
          <p className="text-xs text-[#64748B]">Historical adherence & punctuality rate (%)</p>
        </div>

        {/* Filter Dropdown */}
        {departments.length > 0 && (
          <select
            value={chartDept}
            onChange={(e) => setChartDept(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#206DA6]"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasRecords ? (
        <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200/60 mb-2.5 text-slate-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-[#172B4D]">No data available yet.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#206DA6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#206DA6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
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
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [`${value}%`, 'Adherence Rate']}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#206DA6"
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
