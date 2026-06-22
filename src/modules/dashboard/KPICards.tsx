import { memo } from 'react';
import { IndianRupee, FileText, Users, Clock } from 'lucide-react';
import type { DashboardMetrics } from '../../hooks/analytics/useDashboardMetrics';

interface KPICardsProps {
  metrics: DashboardMetrics;
  isLoading: boolean;
}

export const KPICards = memo(({ metrics, isLoading }: KPICardsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: 'Total Spend',
      value: formatCurrency(metrics.totalSpend),
      icon: <IndianRupee className="w-5 h-5 text-blue-500" />,
      color: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Active POs',
      value: metrics.activePOCount.toString(),
      icon: <FileText className="w-5 h-5 text-emerald-500" />,
      color: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Total Vendors',
      value: metrics.totalVendors.toString(),
      icon: <Users className="w-5 h-5 text-purple-500" />,
      color: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Pending Approvals',
      value: metrics.pendingApprovals.toString(),
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      color: 'bg-amber-500/10 border-amber-500/20',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted">{card.title}</span>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${card.color}`}>
              {card.icon}
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{card.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

KPICards.displayName = 'KPICards';
