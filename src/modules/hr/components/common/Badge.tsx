import React from 'react';

interface BadgeProps {
  variant?:
    | 'present'
    | 'late'
    | 'absent'
    | 'on_leave'
    | 'active'
    | 'inactive'
    | 'probation'
    | 'terminated'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'draft'
    | 'processed'
    | 'paid'
    | 'cancelled'
    | 'half_day'
    | 'checked_in'
    | 'missing_checkout'
    | 'weekly_off'
    | 'holiday'
    | 'permission'
    | 'wfh'
    | 'missing_punch'
    | 'not_marked'
    | 'primary'
    | 'accent'
    | 'neutral';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  size = 'md',
  dot = true,
}) => {
  const styles: Record<string, { bg: string; text: string; dotColor: string }> = {
    present: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dotColor: 'bg-emerald-400' },
    approved: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dotColor: 'bg-emerald-400' },
    active: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dotColor: 'bg-emerald-400' },
    paid: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dotColor: 'bg-emerald-400' },

    checked_in: { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-300 font-bold', dotColor: 'bg-emerald-400 animate-pulse' },
    late: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', dotColor: 'bg-amber-400' },
    pending: { bg: 'bg-indigo-500/15 border-indigo-500/30', text: 'text-indigo-400', dotColor: 'bg-indigo-400' },
    probation: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', dotColor: 'bg-amber-400' },
    draft: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', dotColor: 'bg-amber-400' },

    absent: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-400', dotColor: 'bg-rose-400' },
    rejected: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-400', dotColor: 'bg-rose-400' },
    terminated: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-400', dotColor: 'bg-rose-400' },
    permission: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', dotColor: 'bg-blue-400' },
    wfh: { bg: 'bg-teal-500/15 border-teal-500/30', text: 'text-teal-400', dotColor: 'bg-teal-400' },
    missing_punch: { bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400', dotColor: 'bg-orange-400' },
    missing_checkout: { bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400', dotColor: 'bg-orange-400' },

    on_leave: { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', dotColor: 'bg-purple-400' },
    weekly_off: { bg: 'bg-white/5 border-border', text: 'text-muted', dotColor: 'bg-slate-400' },
    holiday: { bg: 'bg-indigo-500/15 border-indigo-500/30', text: 'text-indigo-400', dotColor: 'bg-indigo-400' },
    processed: { bg: 'bg-sky-500/15 border-sky-500/30', text: 'text-sky-400', dotColor: 'bg-sky-400' },
    half_day: { bg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-300', dotColor: 'bg-amber-400' },
    primary: { bg: 'bg-indigo-500/15 border-indigo-500/30', text: 'text-indigo-400', dotColor: 'bg-indigo-400' },
    accent: { bg: 'bg-teal-500/15 border-teal-500/30', text: 'text-teal-400', dotColor: 'bg-teal-400' },
    neutral: { bg: 'bg-white/5 border-border', text: 'text-muted', dotColor: 'bg-slate-400' },
    not_marked: { bg: 'bg-white/5 border-border', text: 'text-muted', dotColor: 'bg-slate-400' },
    inactive: { bg: 'bg-white/5 border-border', text: 'text-muted', dotColor: 'bg-slate-400' },
    cancelled: { bg: 'bg-white/5 border-border', text: 'text-muted', dotColor: 'bg-slate-400' },
  };

  const selected = styles[variant] || styles.neutral;
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${selected.bg} ${selected.text} ${sizeClasses}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${selected.dotColor} flex-shrink-0`} />}
      <span className="capitalize">{children}</span>
    </span>
  );
};
