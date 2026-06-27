import db from '../lib/db';
import type { CustomerTicket, IssueType, TicketStatus, TicketPriority } from '../types/customer-tickets';

export const customerTicketsService = {
  async getAllTickets() {
    return await db.customer_tickets.toArray();
  },

  async getOpenTickets() {
    return await db.customer_tickets
      .filter(t => t.status !== 'Resolved')
      .toArray();
  },

  async getResolvedTickets() {
    return await db.customer_tickets
      .filter(t => t.status === 'Resolved')
      .toArray();
  },

  async getTicketById(id: number) {
    return await db.customer_tickets.get(id);
  },

  async getTicketByTicketId(ticketId: string) {
    return await db.customer_tickets.where('ticketId').equals(ticketId).first();
  },

  async createTicket(ticket: Omit<CustomerTicket, 'id' | 'ticketId' | 'createdAt' | 'updatedAt'>) {
    // Generate new ticket ID
    const count = await db.customer_tickets.count();
    const newTicketId = `CT-${String(count + 1).padStart(4, '0')}`;
    
    const now = new Date().toISOString();
    const newTicket: CustomerTicket = {
      ...ticket,
      ticketId: newTicketId,
      createdAt: now,
      updatedAt: now
    };

    const id = await db.customer_tickets.add(newTicket);
    return { id, ticketId: newTicketId };
  },

  async updateTicket(id: number, updates: Partial<Omit<CustomerTicket, 'id' | 'ticketId' | 'createdAt'>>) {
    const now = new Date().toISOString();
    await db.customer_tickets.update(id, {
      ...updates,
      updatedAt: now
    });
  },

  async checkDuplicateTicket(orderId: string, awbNumber: string) {
    // Check if there are open tickets with same orderId or awbNumber
    const existing = await db.customer_tickets
      .filter(t => t.status !== 'Resolved' && (t.orderId === orderId || t.awbNumber === awbNumber))
      .first();
    
    return existing || null;
  },
  
  async getDashboardAnalytics() {
    const allTickets = await db.customer_tickets.toArray();
    const now = new Date();
    
    // Summary counts
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => t.status === 'Open').length;
    const inProgressTickets = allTickets.filter(t => t.status === 'In Progress').length;
    const resolvedTickets = allTickets.filter(t => t.status === 'Resolved').length;
    
    // Overdue (Open for > 3 days)
    const overdueTickets = allTickets.filter(t => {
      if (t.status === 'Resolved') return false;
      const createdDate = new Date(t.createdAt);
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 3;
    }).length;

    // Today's new tickets
    const today = now.toISOString().split('T')[0];
    const todaysNewTickets = allTickets.filter(t => t.createdAt.startsWith(today)).length;
    
    // Issue types
    const replacementCount = allTickets.filter(t => t.issueType === 'Replacement').length;
    const refundCount = allTickets.filter(t => t.issueType === 'Refund').length;
    const damagedCount = allTickets.filter(t => t.issueType === 'Damaged Product').length;
    const deliveryDelayCount = allTickets.filter(t => t.issueType === 'Delivery Delay').length;
    
    // Avg resolution time
    const resolvedT = allTickets.filter(t => t.status === 'Resolved' && t.resolvedAt);
    let avgResolutionDays = 0;
    if (resolvedT.length > 0) {
      let totalDays = 0;
      resolvedT.forEach(t => {
        const cDate = new Date(t.createdAt);
        const rDate = new Date(t.resolvedAt!);
        const diffTime = Math.abs(rDate.getTime() - cDate.getTime());
        totalDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      });
      avgResolutionDays = Math.round((totalDays / resolvedT.length) * 10) / 10;
    }

    // Chart Data Helpers
    const issueTypeCount = allTickets.reduce((acc, t) => {
      acc[t.issueType] = (acc[t.issueType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stateWiseCount = allTickets.reduce((acc, t) => {
      acc[t.state] = (acc[t.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const courierPartnerCount = allTickets.reduce((acc, t) => {
      acc[t.courierPartner] = (acc[t.courierPartner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      overdueTickets,
      todaysNewTickets,
      avgResolutionDays,
      replacementCount,
      refundCount,
      damagedCount,
      deliveryDelayCount,
      issueTypeCount,
      stateWiseCount,
      courierPartnerCount,
      allTickets
    };
  }
};
