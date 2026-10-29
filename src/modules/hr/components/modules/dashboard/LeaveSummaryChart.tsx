import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useHRMS } from '../../../context/HRMSContext';
import { CalendarDays } from 'lucide-react';

export const LeaveSummaryChart: React.FC = () => {
  const { leaveRequests } = useHRMS();

  const approved = leaveRequests.filter((l) => l.status === 'approved').length;
  const pending = leaveRequests.filter((l) => l.status === 'pending').length;
  const rejected = leaveRequests.filter((l) => l.status === 'rejected').length;

  const hasData = leaveRequests.length > 0;

  const data = [
    { status: 'Approved', count: approved, color: '#10B981' },
    { status: 'Pending', count: pending, color: '#F59E0B' },
    { status: 'Rejected', count: rejected, color: '#EF4444' },
  ];

  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-velmora flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">Leave Request Status</h3>
        <p className="text-xs text-muted">Approved, pending, and declined breakdown</p>
      </div>

      {!hasData ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-slate-900/30 my-auto">
          <div className="p-3 bg-slate-800 rounded-xl shadow-xs border border-border mb-2.5 text-slate-400">
            <CalendarDays className="w-6 h-6" />
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
              <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="status"
                  stroke="#94A3B8"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161B22',
                    borderRadius: '12px',
                    border: '1px solid #30363D',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                  formatter={(val: any) => [`${val} Applications`, 'Count']}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-around text-xs pt-2 border-t border-border/40">
            <div className="text-center">
              <span className="text-[11px] text-emerald-400 font-bold block">Approved</span>
              <span className="font-extrabold text-white text-base">{approved}</span>
            </div>
            <div className="text-center">
              <span className="text-[11px] text-amber-400 font-bold block">Pending</span>
              <span className="font-extrabold text-white text-base">{pending}</span>
            </div>
            <div className="text-center">
              <span className="text-[11px] text-rose-400 font-bold block">Rejected</span>
              <span className="font-extrabold text-white text-base">{rejected}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
