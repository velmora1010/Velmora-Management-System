import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`bg-sidebar rounded-2xl shadow-velmora p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
};
