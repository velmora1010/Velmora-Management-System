import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useHRMS } from '../../../context/HRMSContext';
import { Calendar } from 'lucide-react';

export const WeeklyAttendanceChart: React.FC = () => {
  const { attendanceRecords, dashboardMetrics } = useHRMS();

  const hasRecords = attendanceRecords.length > 0;

  const data = [
    { day: 'Mon', present: 0, absent: 0, leave: 0 },
    { day: 'Tue', present: 0, absent: 0, leave: 0 },
    { day: 'Wed', present: 0, absent: 0, leave: 0 },
    { day: 'Thu', present: dashboardMetrics.workingToday, absent: dashboardMetrics.absentToday, leave: dashboardMetrics.onLeaveToday },
    { day: 'Fri', present: 0, absent: 0, leave: 0 },
    { day: 'Sat', present: 0, absent: 0, leave: 0 },
    { day: 'Sun', present: 0, absent: 0, leave: 0 },
  ];

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#172B4D]">Weekly Attendance Matrix</h3>
          <p className="text-xs text-[#64748B]">Workforce presence across Mon &ndash; Sun</p>
        </div>
        {hasRecords && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" /> Present
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" /> Absent
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" /> On Leave
            </span>
          </div>
        )}
      </div>

      {!hasRecords ? (
        <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200/60 mb-2.5 text-slate-400">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-[#172B4D]">No data available yet.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis
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
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                }}
                cursor={{ fill: '#F8FAFC' }}
              />
              <Bar dataKey="present" name="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="Absent" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leave" name="Leave" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
