import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { customerTicketsService } from '../../services/customerTicketsService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Ticket, Clock, AlertTriangle, CheckCircle2, PackageX, IndianRupee, RefreshCcw, Loader } from 'lucide-react';
import type { CustomerTicket } from '../../types/customer-tickets';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const CustomerTicketsDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const data = await customerTicketsService.getDashboardAnalytics();
    setStats(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center">
      <Loader className="animate-spin text-primary" size={32} />
    </div>;
  }

  const issueTypeData = Object.keys(stats.issueTypeCount).map(key => ({
    name: key,
    value: stats.issueTypeCount[key]
  })).sort((a, b) => b.value - a.value);

  const stateWiseData = Object.keys(stats.stateWiseCount).map(key => ({
    name: key,
    value: stats.stateWiseCount[key]
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  const courierData = Object.keys(stats.courierPartnerCount).map(key => ({
    name: key,
    value: stats.courierPartnerCount[key]
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Derive Daily Tickets Trend
  const dailyMap: Record<string, number> = {};
  stats.allTickets.forEach((t: CustomerTicket) => {
    const date = new Date(t.createdAt).toLocaleDateString();
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  });
  const dailyTrendData = Object.keys(dailyMap)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map(k => ({ date: k, tickets: dailyMap[k] }));

  // Status Distribution
  const statusData = [
    { name: 'Open', value: stats.openTickets, color: '#f59e0b' },
    { name: 'In Progress', value: stats.inProgressTickets, color: '#3b82f6' },
    { name: 'Resolved', value: stats.resolvedTickets, color: '#10b981' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Tickets Analytics</h1>
        <p className="text-muted text-sm mt-1">Live dashboard for tracking courier and product issues.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-muted font-medium text-sm">Total Tickets</h3>
            <Ticket className="text-indigo-400" size={18} />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTickets}</p>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-muted font-medium text-sm">Open Tickets</h3>
            <AlertTriangle className="text-amber-400" size={18} />
          </div>
          <p className="text-2xl font-bold text-white">{stats.openTickets}</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-muted font-medium text-sm">Resolved</h3>
            <CheckCircle2 className="text-emerald-400" size={18} />
          </div>
          <p className="text-2xl font-bold text-white">{stats.resolvedTickets}</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-muted font-medium text-sm">Overdue {'>'}3 Days</h3>
            <Clock className="text-red-400" size={18} />
          </div>
          <p className="text-2xl font-bold text-white">{stats.overdueTickets}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <RefreshCcw size={18} />
            </div>
            <div>
              <p className="text-muted text-xs font-medium">Replacements</p>
              <p className="text-lg font-bold text-white">{stats.replacementCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <IndianRupee size={18} />
            </div>
            <div>
              <p className="text-muted text-xs font-medium">Refunds</p>
              <p className="text-lg font-bold text-white">{stats.refundCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <PackageX size={18} />
            </div>
            <div>
              <p className="text-muted text-xs font-medium">Damaged</p>
              <p className="text-lg font-bold text-white">{stats.damagedCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-muted text-xs font-medium">Avg Resolution</p>
              <p className="text-lg font-bold text-white">{stats.avgResolutionDays} <span className="text-sm font-normal text-muted">Days</span></p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Issue Type Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={issueTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {issueTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Daily Ticket Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Line type="monotone" dataKey="tickets" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Top 10 States with Issues</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateWiseData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: '#334155', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Top Courier Partners (Issues)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courierData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#334155', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

    </div>
  );
};
