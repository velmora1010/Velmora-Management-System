import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const LoginPage = () => {
  const { user, isAuthLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If user was redirected here from a deep link, restore it after login; otherwise land on Dashboard ('/')
  const fromLocation = (location.state as any)?.from;
  const targetPath = (fromLocation?.pathname && fromLocation.pathname !== '/login')
    ? `${fromLocation.pathname}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/';

  // If already authenticated, redirect to targetPath
  if (!isAuthLoading && user) {
    return <Navigate to={targetPath} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate concurrent submissions

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      const msg = 'Please enter both email and password';
      setError(msg);
      toast.error(msg, { id: 'login-error' });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) throw authError;

      if (data?.session) {
        toast.dismiss('login-error');
        navigate(targetPath, { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid login credentials';
      setError(message);
      // Guarantee exactly one deduplicated notification
      toast.error(message, { id: 'login-error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center border-b border-border bg-card/50">
          <h1 className="text-3xl font-bold text-primary tracking-tight mb-2">Velmora</h1>
          <p className="text-sm text-muted uppercase tracking-widest">Business Management</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div
                role="alert"
                className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 text-center"
              >
                <span>✕</span>
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="login-username" className="text-sm font-medium text-white block">Email Address</label>
              <input
                type="email"
                name="username"
                id="login-username"
                autoComplete="username"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full bg-background border border-border text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-3 transition-colors disabled:opacity-50"
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium text-white block">Password</label>
              <input
                type="password"
                name="password"
                id="login-password"
                autoComplete="current-password"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full bg-background border border-border text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-3 transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
