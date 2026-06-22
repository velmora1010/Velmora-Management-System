import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Read from localStorage on mount (matches what index.html inline script does)
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('velmora-theme') as Theme) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply changes smoothly to DOM
    if (theme === 'light') {
      root.removeAttribute('data-theme');
      root.classList.remove('dark');
    } else {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    }

    // Persist
    localStorage.setItem('velmora-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
};
