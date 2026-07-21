/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'Admin' | 'Manager' | 'Operator' | 'Viewer';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  isAuthLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety fallback: if auth takes more than 5 seconds, force resolve
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setIsAuthLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          setRole('Viewer');
        }
      } else {
        setRole(null);
      }
      
      if (mounted) {
        setIsAuthLoading(false);
        clearTimeout(timeoutId);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    role,
    isAuthLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
