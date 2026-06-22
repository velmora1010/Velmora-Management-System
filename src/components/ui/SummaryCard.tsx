import React from 'react';

export const SummaryCard: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => {
  return (
    <div className="bg-sidebar rounded-xl p-5 shadow-velmora flex items-center justify-between border border-border">
      <div className="flex flex-col gap-1">
        <span className="text-muted text-sm font-medium">{label}</span>
        <span className="text-main text-2xl font-bold tracking-tight">{value}</span>
      </div>
      {icon && (
        <div className="bg-primary/10 text-primary p-3 rounded-lg">
          {icon}
        </div>
      )}
    </div>
  );
};
