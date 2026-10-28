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
    present: { bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700', dotColor: 'bg-emerald-500' },
    approved: { bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700', dotColor: 'bg-emerald-500' },
    active: { bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700', dotColor: 'bg-emerald-500' },
    paid: { bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700', dotColor: 'bg-emerald-500' },

    checked_in: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800 font-bold', dotColor: 'bg-emerald-500 animate-pulse' },
    late: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-700', dotColor: 'bg-amber-500' },
    pending: { bg: 'bg-blue-50/70 border-blue-200/80', text: 'text-blue-700', dotColor: 'bg-blue-500' },
    probation: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-700', dotColor: 'bg-amber-500' },
    draft: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-700', dotColor: 'bg-amber-500' },

    absent: { bg: 'bg-rose-50 border-rose-200/80', text: 'text-rose-700', dotColor: 'bg-rose-500' },
    rejected: { bg: 'bg-rose-50 border-rose-200/80', text: 'text-rose-700', dotColor: 'bg-rose-500' },
    terminated: { bg: 'bg-rose-50 border-rose-200/80', text: 'text-rose-700', dotColor: 'bg-rose-500' },
    permission: { bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-700', dotColor: 'bg-blue-500' },
    wfh: { bg: 'bg-teal-50 border-teal-200/80', text: 'text-teal-700', dotColor: 'bg-teal-500' },
    missing_punch: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dotColor: 'bg-orange-500' },
    missing_checkout: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dotColor: 'bg-orange-500' },

    on_leave: { bg: 'bg-purple-50 border-purple-200/80', text: 'text-purple-700', dotColor: 'bg-purple-500' },
    weekly_off: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dotColor: 'bg-slate-400' },
    holiday: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dotColor: 'bg-indigo-500' },
    processed: { bg: 'bg-sky-50 border-sky-200/80', text: 'text-sky-700', dotColor: 'bg-sky-500' },
    half_day: { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-800', dotColor: 'bg-amber-400' },
    primary: { bg: 'bg-[#206DA6]/10 border-[#206DA6]/20', text: 'text-[#206DA6]', dotColor: 'bg-[#206DA6]' },
    accent: { bg: 'bg-[#18A999]/10 border-[#18A999]/20', text: 'text-[#18A999]', dotColor: 'bg-[#18A999]' },
    neutral: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dotColor: 'bg-slate-400' },
    not_marked: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dotColor: 'bg-slate-400' },
    inactive: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dotColor: 'bg-slate-400' },
    cancelled: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-500', dotColor: 'bg-slate-400' },
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
