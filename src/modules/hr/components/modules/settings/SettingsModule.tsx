import React, { useState } from 'react';
import { useHRMS } from '../../../context/HRMSContext';
import { useAuth } from '../../../context/AuthContext';
import { Building2, Clock, CalendarDays, Shield, RefreshCw, Save, Check } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { settings, updateSettings, resetToDefaultData } = useHRMS();
  const { canManageSettings, currentUser } = useAuth();

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companyEmail, setCompanyEmail] = useState(settings.companyEmail);
  const [companyPhone, setCompanyPhone] = useState(settings.companyPhone);
  const [companyAddress, setCompanyAddress] = useState(settings.companyAddress);
  const [standardWorkHours, setStandardWorkHours] = useState(settings.standardWorkHours);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);

  const [annualAllowance, setAnnualAllowance] = useState(settings.leaveAllowances.annual);
  const [casualAllowance, setCasualAllowance] = useState(settings.leaveAllowances.casual);
  const [sickAllowance, setSickAllowance] = useState(settings.leaveAllowances.sick);
  const [maternityAllowance, setMaternityAllowance] = useState(settings.leaveAllowances.maternity);

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      standardWorkHours: Number(standardWorkHours),
      currencySymbol,
      leaveAllowances: {
        annual: Number(annualAllowance),
        casual: Number(casualAllowance),
        sick: Number(sickAllowance),
        maternity: Number(maternityAllowance),
      },
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const rbacMatrix = [
    { module: 'Dashboard Metrics & Summary Cards', admin: true, hr: true, lead: true, emp: true },
    { module: 'Employee Directory & Search', admin: true, hr: true, lead: true, emp: true },
    { module: 'Add / Edit / Delete Employees', admin: true, hr: true, lead: false, emp: false },
    { module: 'Clock In / Clock Out Attendance Punch', admin: true, hr: true, lead: true, emp: true },
    { module: 'Manual Timesheet Adjustment', admin: true, hr: true, lead: false, emp: false },
    { module: 'Department Structure & Budget Edit', admin: true, hr: false, lead: false, emp: false },
    { module: 'Apply for Leave Application', admin: true, hr: true, lead: true, emp: true },
    { module: 'Approve / Reject Leave Requests', admin: true, hr: true, lead: true, emp: false },
    { module: 'Shift Rostering & Schedule Assignment', admin: true, hr: true, lead: true, emp: false },
    { module: 'Executive Payroll & Bank Details Access', admin: true, hr: true, lead: false, emp: false },
    { module: 'Generate Monthly Payroll Batch', admin: true, hr: true, lead: false, emp: false },
    { module: 'System Global Configuration & Policies', admin: true, hr: false, lead: false, emp: false },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight">
            System Settings & Policies
          </h2>
          <p className="text-xs text-[#64748B]">
            Corporate entity profile, working schedule policies, and RBAC matrix
          </p>
        </div>

        {canManageSettings && (
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-md shadow-[#206DA6]/20 transition-all flex-shrink-0"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Settings Saved!' : 'Save System Settings'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Legal Profile */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#206DA6]" />
            <h3 className="text-sm font-bold text-[#172B4D]">Organization Profile</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Company Legal Name
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6] disabled:opacity-75"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Primary HR Email
                </label>
                <input
                  type="email"
                  disabled={!canManageSettings}
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-75"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-75"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Headquarters Address
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-75"
              />
            </div>
          </div>
        </div>

        {/* Working Hours & Leave Allowances */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-4 h-4 text-[#18A999]" />
            <h3 className="text-sm font-bold text-[#172B4D]">Working Hours & Annual Allowances</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Standard Workday (Hours)
              </label>
              <input
                type="number"
                disabled={!canManageSettings}
                value={standardWorkHours}
                onChange={(e) => setStandardWorkHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono disabled:opacity-75"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase block mb-2">
              Annual Leave Allowances (Days/Year)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Annual</span>
                <input
                  type="number"
                  disabled={!canManageSettings}
                  value={annualAllowance}
                  onChange={(e) => setAnnualAllowance(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono disabled:opacity-75"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Casual</span>
                <input
                  type="number"
                  disabled={!canManageSettings}
                  value={casualAllowance}
                  onChange={(e) => setCasualAllowance(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono disabled:opacity-75"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Sick</span>
                <input
                  type="number"
                  disabled={!canManageSettings}
                  value={sickAllowance}
                  onChange={(e) => setSickAllowance(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono disabled:opacity-75"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Maternity</span>
                <input
                  type="number"
                  disabled={!canManageSettings}
                  value={maternityAllowance}
                  onChange={(e) => setMaternityAllowance(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono disabled:opacity-75"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Access Control (RBAC) Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#206DA6]" />
            <h3 className="text-sm font-bold text-[#172B4D]">
              Role-Based Access Control (RBAC) Matrix
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Active User: <strong className="text-[#206DA6]">{currentUser.role.toUpperCase()}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Permission / Capability</th>
                <th className="py-3 px-3 text-center">Administrator</th>
                <th className="py-3 px-3 text-center">HR Manager</th>
                <th className="py-3 px-3 text-center">Department Lead</th>
                <th className="py-3 px-3 text-center">Regular Employee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rbacMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-medium text-slate-800">{row.module}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] leading-4 text-center">
                      &check;
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.hr ? (
                      <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] leading-4 text-center">
                        &check;
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">&times;</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.lead ? (
                      <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] leading-4 text-center">
                        &check;
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">&times;</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.emp ? (
                      <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] leading-4 text-center">
                        &check;
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">&times;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger Zone: Reset Sample Database */}
      <div className="bg-red-50/40 rounded-2xl border border-red-200/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-red-900">Reset Local Database to Sample State</h4>
          <p className="text-xs text-red-700/80 mt-0.5 max-w-xl leading-relaxed">
            Restores all 16 employees, 6 departments, timesheets, shift rosters, and payroll vouchers to the pristine factory test dataset.
          </p>
        </div>
        <button
          onClick={resetToDefaultData}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Database</span>
        </button>
      </div>
    </div>
  );
};
