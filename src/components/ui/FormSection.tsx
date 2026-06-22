import React from 'react';

export const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-black/5 dark:bg-white/5 px-4 py-2 rounded-lg inline-block self-start font-semibold text-sm text-main">
        {title}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {children}
      </div>
    </div>
  );
};
