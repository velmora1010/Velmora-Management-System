import React, { useState } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export const ReportsModule: React.FC = () => {
  const { employees, departments, attendanceRecords, leaveRequests, payrollRecords, settings } = useHRMS();
  const { canViewPayroll } = useAuth();

  const [activeReport, setActiveReport] = useState<'attendance' | 'headcount' | 'leave' | 'payroll'>('attendance');
  const [selectedDept, setSelectedDept] = useState('all');

  // Real attendance rate per department
  const deptAttendanceData = departments.map((d) => {
    const deptEmps = employees.filter((e) => e.departmentId === d.id);
    const empIds = new Set(deptEmps.map((e) => e.id));
    const deptRecords = attendanceRecords.filter((r) => empIds.has(r.employeeId));
    const totalPresents = deptRecords.filter(
      (r) =>
        r.status === 'present' ||
        r.status === 'late' ||
        r.status === 'checked_in' ||
        r.status === 'wfh' ||
        r.status === 'permission' ||
        r.status === 'half_day'
    ).length;
    const rate = deptRecords.length > 0 ? Math.round((totalPresents / deptRecords.length) * 100) : 0;
    return {
      department: d.code,
      name: d.name,
      rate,
      headcount: deptEmps.length,
      recordsCount: deptRecords.length,
      color: d.color,
    };
  });

  // Real leave breakdown data
  const leaveTypesMap: Record<string, number> = {};
  leaveRequests.forEach((req) => {
    if (req.status === 'approved') {
      leaveTypesMap[req.leaveType] = (leaveTypesMap[req.leaveType] || 0) + req.daysCount;
    }
  });

  const leaveColors: Record<string, string> = {
    vacation: '#206DA6',
    casual: '#18A999',
    sick: '#F59E0B',
    maternity: '#8B5CF6',
    unpaid: '#64748B',
  };

  const leaveData = Object.entries(leaveTypesMap).map(([type, days]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1) + ' Leave',
    days,
    color: leaveColors[type] || '#206DA6',
  }));

  // Real payroll by department
  const payrollDeptData = departments.map((d) => {
    const deptEmps = employees.filter((e) => e.departmentId === d.id);
    const baseTotal = deptEmps.reduce((sum, e) => sum + (e.baseSalary || 0), 0);
    return {
      name: d.code,
      fullName: d.name,
      cost: baseTotal,
      color: d.color,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  const exportCurrentReport = () => {
    let csv = '';
    if (activeReport === 'attendance') {
      csv = 'Department,Name,Adherence Rate (%),Staff Count\n' +
        deptAttendanceData.map((d) => `${d.department},"${d.name}",${d.rate}%,${d.headcount}`).join('\n');
    } else if (activeReport === 'leave') {
      csv = 'Leave Category,Days Consumed\n' +
        leaveData.map((l) => `"${l.type}",${l.days}`).join('\n');
    } else {
      csv = `Department,Name,Base Payroll (${settings.currencySymbol})\n` +
        payrollDeptData.map((p) => `${p.name},"${p.fullName}",${p.cost}`).join('\n');
    }

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hr_report_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight">
            Analytics & Reports
          </h2>
          <p className="text-xs text-[#64748B]">
            Executive reporting, attendance trends, and payroll expenditure analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>
          <button
            onClick={exportCurrentReport}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveReport('attendance')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeReport === 'attendance'
              ? 'bg-white border-[#206DA6] shadow-md ring-1 ring-[#206DA6]'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <Clock className={`w-5 h-5 mb-2 ${activeReport === 'attendance' ? 'text-[#206DA6]' : 'text-slate-400'}`} />
          <h4 className="text-xs font-bold text-[#172B4D]">Attendance & Punctuality</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Department adherence rates</p>
        </button>

        <button
          onClick={() => setActiveReport('headcount')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeReport === 'headcount'
              ? 'bg-white border-[#206DA6] shadow-md ring-1 ring-[#206DA6]'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <Users className={`w-5 h-5 mb-2 ${activeReport === 'headcount' ? 'text-[#206DA6]' : 'text-slate-400'}`} />
          <h4 className="text-xs font-bold text-[#172B4D]">Headcount & Staffing</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Workforce distribution</p>
        </button>

        <button
          onClick={() => setActiveReport('leave')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeReport === 'leave'
              ? 'bg-white border-[#206DA6] shadow-md ring-1 ring-[#206DA6]'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <Calendar className={`w-5 h-5 mb-2 ${activeReport === 'leave' ? 'text-[#206DA6]' : 'text-slate-400'}`} />
          <h4 className="text-xs font-bold text-[#172B4D]">Leave Utilization</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Absence & vacation quotas</p>
        </button>

        <button
          onClick={() => setActiveReport('payroll')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeReport === 'payroll'
              ? 'bg-white border-[#206DA6] shadow-md ring-1 ring-[#206DA6]'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <DollarSign className={`w-5 h-5 mb-2 ${activeReport === 'payroll' ? 'text-[#206DA6]' : 'text-slate-400'}`} />
          <h4 className="text-xs font-bold text-[#172B4D]">Compensation & Outlay</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Departmental payroll breakdown</p>
        </button>
      </div>

      {/* Report Active Body */}
      {activeReport === 'attendance' && (
        attendanceRecords.length === 0 || departments.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-card flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#206DA6] mb-3">
              <BarChart3 className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#172B4D]">No data available yet.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Add employees and attendance records to view analytics.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
              <h3 className="text-sm font-bold text-[#172B4D] mb-4">Adherence Rate by Department (%)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="department" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                      formatter={(val: any) => [`${val}%`, 'Attendance Adherence']}
                    />
                    <Bar dataKey="rate" fill="#206DA6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D] mb-3">Key Attendance Metrics</h3>
                <div className="space-y-3">
                  {deptAttendanceData.map((d) => (
                    <div key={d.department} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{d.name}</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {d.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500">
                Target adherence goal across all departments: <strong>95.0%</strong>
              </div>
            </div>
          </div>
        )
      )}

      {activeReport === 'headcount' && (
        employees.length === 0 || departments.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-card flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#206DA6] mb-3">
              <Users className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#172B4D]">No data available yet.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Add employees and attendance records to view analytics.
            </p>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
            <h3 className="text-sm font-bold text-[#172B4D] mb-4">Personnel Distribution by Department</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {departments.map((d) => {
                const count = employees.filter((e) => e.departmentId === d.id).length;
                const pct = Math.round((count / (employees.length || 1)) * 100);
                return (
                  <div key={d.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-[#172B4D]">{d.name}</span>
                      <span className="font-mono font-extrabold text-[#206DA6] text-lg">{count}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: d.color }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block text-right">{pct}% of company</span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {activeReport === 'leave' && (
        leaveData.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-card flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#206DA6] mb-3">
              <Calendar className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#172B4D]">No data available yet.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Add employees and attendance records to view analytics.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
              <h3 className="text-sm font-bold text-[#172B4D] mb-4">Leave Types Utilized (Days)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaveData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="type" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} width={110} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Bar dataKey="days" fill="#18A999" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
              <h3 className="text-sm font-bold text-[#172B4D] mb-3">Leave Balances & Compliance</h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Standard statutory allowances allocated per fiscal year. Approved leave requests will display dynamic utilization here.
              </p>
              <div className="space-y-3 text-xs">
                {leaveData.map((l) => (
                  <div key={l.type} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between">
                    <span className="font-medium text-slate-700">{l.type}:</span>
                    <span className="font-bold text-[#206DA6]">{l.days} Days Approved</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {activeReport === 'payroll' && (
        payrollDeptData.length === 0 || payrollDeptData.every((p) => p.cost === 0) ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-card flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#206DA6] mb-3">
              <DollarSign className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-[#172B4D]">No data available yet.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Add employees and attendance records to view analytics.
            </p>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card">
            <h3 className="text-sm font-bold text-[#172B4D] mb-4">Base Salary Expenditure by Department</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payrollDeptData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} unit={settings.currencySymbol} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                    formatter={(val: any) => [`${settings.currencySymbol}${val.toLocaleString()}`, 'Monthly Base Payroll']}
                  />
                  <Bar dataKey="cost" fill="#206DA6" radius={[6, 6, 0, 0]}>
                    {payrollDeptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      )}
    </div>
  );
};
