import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, AlertCircle, X } from 'lucide-react';
import { employeeSupabase } from '../../utils/employeeSupabase';
import { Employee } from '../../types/hrms';
import toast from 'react-hot-toast';

interface EmployeeLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: { email: string; token: string; user: any; employee?: Employee }) => void;
  employees?: Employee[];
}

export const EmployeeLoginModal: React.FC<EmployeeLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employees = [],
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset inputs and error messages when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    // 1. Strict Restriction: Prevent Administrator login through Employee Self-Service
    const isAdminEmail =
      cleanEmail === 'admin@velmora.com' ||
      cleanEmail === 'admin@velmora1.com' ||
      cleanEmail === 'admin@velmora2.com' ||
      cleanEmail === 'admin@velmora3.com' ||
      cleanEmail.startsWith('admin@');

    if (isAdminEmail) {
      const adminErr = 'Administrator accounts cannot log in through Employee Self-Service. Please use the Administrator login.';
      setErrorMessage(adminErr);
      toast.error(adminErr, { id: 'hr-emp-login-err' });
      return;
    }

    // 2. Verify that the work email corresponds to an existing Employee in HR records
    const targetEmployee = employees.find(
      (emp) => emp.email && emp.email.trim().toLowerCase() === cleanEmail
    );

    if (!targetEmployee) {
      const unlinkedErr = 'Your account is not linked to an employee profile. Please contact HR.';
      setErrorMessage(unlinkedErr);
      toast.error(unlinkedErr, { id: 'hr-emp-login-err' });
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 3. Authenticate against Supabase Auth using the dedicated, isolated employee client
      const { data, error: authError } = await employeeSupabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        const invalidErr = 'Invalid email or password. Please check your credentials.';
        setErrorMessage(invalidErr);
        toast.error(invalidErr, { id: 'hr-emp-login-err' });
        return;
      }

      if (data?.session) {
        toast.success(`Welcome, ${targetEmployee.fullName}!`, { id: 'hr-emp-login-success' });
        onSuccess({
          email: cleanEmail,
          token: data.session.access_token,
          user: {
            ...data.session.user,
            employeeId: targetEmployee.id,
            employeeCode: targetEmployee.employeeCode,
            full_name: targetEmployee.fullName,
          },
          employee: targetEmployee,
        });
        onClose();
      } else {
        throw new Error('Authentication succeeded but no session was returned.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
      toast.error(msg, { id: 'hr-emp-login-err' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md bg-[#182030] border border-[#2D3A50] rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Header */}
        <div className="p-6 text-center border-b border-[#2D3A50] bg-gradient-to-b from-[#131926] to-[#182030] relative">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Velmora HRMS</h2>
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider mt-1 font-semibold">
            Employee Self-Service Login
          </p>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1.5">
              <label htmlFor="hr-emp-email" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Employee Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hr-emp-email"
                  type="email"
                  required
                  autoComplete="username"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="name@company.com"
                  className="w-full bg-[#EBF3FE] border border-slate-300 text-[#0F172A] text-sm rounded-xl pl-10 pr-3.5 py-2.5 font-medium placeholder-[#64748B] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="hr-emp-password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hr-emp-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full bg-[#EBF3FE] border border-slate-300 text-[#0F172A] text-sm rounded-xl pl-10 pr-10 py-2.5 font-medium placeholder-[#64748B] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] p-1 rounded-md transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Buttons: Cancel and Sign In */}
            <div className="pt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="w-1/3 py-2.5 px-4 bg-[#232D3F] hover:bg-[#2B374E] text-slate-300 hover:text-white text-sm font-semibold rounded-xl border border-[#37445C] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-2/3 py-2.5 px-4 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5558E6] hover:to-[#7C3AED] text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-950/40 transition-all focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
