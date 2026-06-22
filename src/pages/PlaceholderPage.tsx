import React from 'react';

interface PlaceholderPageProps {
  title: string;
  icon?: React.ReactNode;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-in fade-in duration-300">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
        {icon || (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="9" x2="15" y1="9" y2="15" />
            <line x1="15" x2="9" y1="9" y2="15" />
          </svg>
        )}
      </div>
      <h2 className="text-2xl font-bold text-main">{title}</h2>
      <p className="text-muted max-w-md">
        This module is currently being migrated to the new React architecture. Check back soon!
      </p>
    </div>
  );
};
