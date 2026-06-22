import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 text-muted hover:text-main hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300 group"
      aria-label="Toggle Theme"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center overflow-hidden">
        <Sun 
          size={18} 
          className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isDark ? 'translate-y-full opacity-0 scale-50 rotate-90' : 'translate-y-0 opacity-100 scale-100 rotate-0'
          }`} 
        />
        <Moon 
          size={18} 
          className={`absolute transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isDark ? 'translate-y-0 opacity-100 scale-100 rotate-0' : '-translate-y-full opacity-0 scale-50 -rotate-90'
          }`} 
        />
      </div>
    </button>
  );
};
