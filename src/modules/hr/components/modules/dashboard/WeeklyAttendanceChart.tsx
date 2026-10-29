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
    <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Weekly Attendance Matrix</h3>
          <p className="text-xs text-muted">Workforce presence across Mon &ndash; Sun</p>
        </div>
        {hasRecords && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" /> Present
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" /> Absent
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" /> On Leave
            </span>
          </div>
        )}
      </div>

      {!hasRecords ? (
        <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-slate-900/30">
          <div className="p-3 bg-slate-800 rounded-xl shadow-xs border border-border mb-2.5 text-slate-400">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-white">No data available yet.</p>
          <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
            Add employees and attendance records to view analytics.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
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
                  backgroundColor: '#161B22',
                  borderRadius: '12px',
                  border: '1px solid #30363D',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                  fontSize: '12px',
                  color: '#F8FAFC',
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
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
