import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import toast from 'react-hot-toast';

interface EmployeeLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: { email: string; token: string; user: any }) => void;
}

export const EmployeeLoginModal: React.FC<EmployeeLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Authenticate with existing backend authentication provider (Supabase)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid login credentials');
        toast.error(error.message || 'Invalid login credentials', { id: 'hr-emp-login-err' });
        return;
      }

      if (data?.session) {
        toast.success(`Welcome, ${cleanEmail}!`, { id: 'hr-emp-login-success' });
        onSuccess({
          email: cleanEmail,
          token: data.session.access_token,
          user: data.session.user,
        });
        onClose();
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
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Header */}
        <div className="p-6 text-center border-b border-border bg-gradient-to-b from-slate-900/80 to-card/60 relative">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Velmora HRMS</h2>
          <p className="text-xs text-muted uppercase tracking-wider mt-1 font-semibold">
            Employee Self-Service Login
          </p>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-muted hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Cancel"
          >
            ✕
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
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  className="w-full bg-background border border-border text-white text-sm rounded-xl pl-10 pr-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-50"
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
                <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  className="w-full bg-background border border-border text-white text-sm rounded-xl pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white p-1 rounded-md transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-900/30 transition-all focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In as Employee</span>
                )}
              </button>
            </div>
          </form>

          {/* Back to Administrator Navigation */}
          <div className="mt-6 pt-4 border-t border-border text-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Administrator Mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
