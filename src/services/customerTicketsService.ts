import { supabase } from '../lib/supabase';
import type { CustomerTicket } from '../types/customer-tickets';
import { logActivity } from './activityService';

const normalizeDate = (val?: string | null): string | null => {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  return val.trim();
};

const mapToDb = (ticket: Partial<CustomerTicket>) => {
  const dbObj: any = {};
  if (ticket.id !== undefined) dbObj.id = ticket.id;
  if (ticket.ticketId !== undefined) dbObj.ticket_id = ticket.ticketId;
  if (ticket.customerName !== undefined) dbObj.customer_name = ticket.customerName;
  if (ticket.phoneNumber !== undefined) dbObj.phone_number = ticket.phoneNumber;
  if (ticket.orderId !== undefined) dbObj.order_id = ticket.orderId;
  if (ticket.orderDate !== undefined) dbObj.order_date = normalizeDate(ticket.orderDate);
  if (ticket.awbNumber !== undefined) dbObj.awb_number = ticket.awbNumber;
  if (ticket.courierPartner !== undefined) dbObj.courier_partner = ticket.courierPartner;
  if (ticket.state !== undefined) dbObj.state = ticket.state;
  if (ticket.city !== undefined) dbObj.city = ticket.city;
  if (ticket.issueType !== undefined) dbObj.issue_type = ticket.issueType;
  if (ticket.subIssue !== undefined) dbObj.sub_issue = ticket.subIssue;
  if (ticket.issueDescription !== undefined) dbObj.issue_description = ticket.issueDescription;
  if (ticket.priority !== undefined) dbObj.priority = ticket.priority;
  if (ticket.status !== undefined) dbObj.status = ticket.status;
  if (ticket.createdAt !== undefined) dbObj.created_at = normalizeDate(ticket.createdAt);
  if (ticket.updatedAt !== undefined) dbObj.updated_at = normalizeDate(ticket.updatedAt);
  if (ticket.resolvedAt !== undefined) dbObj.resolved_at = normalizeDate(ticket.resolvedAt);
  if (ticket.resolutionNotes !== undefined) dbObj.resolution_notes = ticket.resolutionNotes;
  if (ticket.internalNotes !== undefined) dbObj.internal_notes = ticket.internalNotes;
  return dbObj;
};

const mapFromDb = (dbObj: any): CustomerTicket => {
  return {
    id: dbObj.id,
    ticketId: dbObj.ticket_id,
    customerName: dbObj.customer_name,
    phoneNumber: dbObj.phone_number,
    orderId: dbObj.order_id,
    orderDate: dbObj.order_date || '',
    awbNumber: dbObj.awb_number,
    courierPartner: dbObj.courier_partner,
    state: dbObj.state,
    city: dbObj.city,
    issueType: dbObj.issue_type,
    subIssue: dbObj.sub_issue || undefined,
    issueDescription: dbObj.issue_description,
    priority: dbObj.priority,
    status: dbObj.status,
    createdAt: dbObj.created_at || '',
    updatedAt: dbObj.updated_at || '',
    resolvedAt: dbObj.resolved_at || undefined,
    resolutionNotes: dbObj.resolution_notes,
    internalNotes: dbObj.internal_notes
  };
};

export const customerTicketsService = {
  async getAllTickets() {
    const { data, error } = await supabase
      .from('customer_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapFromDb);
  },

  async getOpenTickets() {
    const { data, error } = await supabase
      .from('customer_tickets')
      .select('*')
      .neq('status', 'Resolved')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapFromDb);
  },

  async getResolvedTickets() {
    const { data, error } = await supabase
      .from('customer_tickets')
      .select('*')
      .eq('status', 'Resolved')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapFromDb);
  },

  async getTicketById(id: number) {
    const { data, error } = await supabase
      .from('customer_tickets')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return mapFromDb(data);
  },

  async getTicketByTicketId(ticketId: string) {
    const { data, error } = await supabase
      .from('customer_tickets')
      .select('*')
      .eq('ticket_id', ticketId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapFromDb(data) : null;
  },

  async createTicket(ticket: Omit<CustomerTicket, 'id' | 'ticketId' | 'createdAt' | 'updatedAt'>) {
    const { count, error: countError } = await supabase
      .from('customer_tickets')
      .select('*', { count: 'exact', head: true });
    if (countError) throw countError;

    const newTicketId = `CT-${String((count || 0) + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    let dbPayload = mapToDb({
      ...ticket,
      ticketId: newTicketId,
      createdAt: now,
      updatedAt: now
    });

    let { data, error } = await supabase
      .from('customer_tickets')
      .insert([dbPayload])
      .select()
      .single();

    // Fallback if sub_issue column does not exist on remote schema yet
    if (error && error.message && error.message.includes('sub_issue')) {
      delete dbPayload.sub_issue;
      const res = await supabase
        .from('customer_tickets')
        .insert([dbPayload])
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) throw error;

    // Non-blocking activity logging
    logActivity(
      'Customer Tickets',
      'Ticket Created',
      `Ticket ${newTicketId} was created for customer "${ticket.customerName || 'Unknown'}" (Issue: ${ticket.issueType || 'N/A'}${ticket.subIssue ? ` - ${ticket.subIssue}` : ''}).`
    );

    return { id: data.id, ticketId: newTicketId };
  },

  async updateTicket(id: number, updates: Partial<Omit<CustomerTicket, 'id' | 'ticketId' | 'createdAt'>>) {
    const now = new Date().toISOString();
    let dbPayload = mapToDb({
      ...updates,
      updatedAt: now
    });

    let { error } = await supabase
      .from('customer_tickets')
      .update(dbPayload)
      .eq('id', id);

    // Fallback if sub_issue column does not exist on remote schema yet
    if (error && error.message && error.message.includes('sub_issue')) {
      delete dbPayload.sub_issue;
      const res = await supabase
        .from('customer_tickets')
        .update(dbPayload)
        .eq('id', id);
      error = res.error;
    }

    if (error) throw error;

    // Non-blocking activity logging
    const action = updates.status === 'Resolved' ? 'Ticket Resolved' : 'Ticket Updated';
    logActivity(
      'Customer Tickets',
      action,
      `Ticket ID ${id} was ${updates.status === 'Resolved' ? 'resolved' : 'updated'}${updates.customerName ? ` for "${updates.customerName}"` : ''}.`
    );
  },

  async deleteTicket(id: number) {
    const { error } = await supabase
      .from('customer_tickets')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async checkDuplicateTicket(orderId: string, awbNumber: string) {
    if (!orderId && !awbNumber) return null;

    let query = supabase
      .from('customer_tickets')
      .select('*')
      .neq('status', 'Resolved');

    if (orderId && awbNumber) {
      query = query.or(`order_id.eq."${orderId}",awb_number.eq."${awbNumber}"`);
    } else if (orderId) {
      query = query.eq('order_id', orderId);
    } else {
      query = query.eq('awb_number', awbNumber);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    return data ? mapFromDb(data) : null;
  },
  
  async getDashboardAnalytics() {
    const allTickets = await this.getAllTickets();
    const now = new Date();
    
    // Summary counts
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => t.status !== 'Resolved').length;
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
      acc[t.state || 'Unknown'] = (acc[t.state || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const courierPartnerCount = allTickets.reduce((acc, t) => {
      acc[t.courierPartner || 'Unknown'] = (acc[t.courierPartner || 'Unknown'] || 0) + 1;
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
  },

  // ==========================================
  // CUSTOM CATEGORY MANAGEMENT SERVICES
  // ==========================================
  async getCustomCategories() {
    try {
      const { data: issueTypes, error: itError } = await supabase
        .from('ticket_issue_types')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (itError) throw itError;

      const { data: subIssues, error: siError } = await supabase
        .from('ticket_sub_issues')
        .select(`
          *,
          ticket_issue_types ( id, name )
        `)
        .eq('active', true)
        .order('name', { ascending: true });

      if (siError) throw siError;

      const customSubIssues = (subIssues || []).map((item: any) => ({
        id: item.id,
        issue_type_id: item.issue_type_id,
        name: item.name,
        description: item.description,
        active: item.active,
        created_at: item.created_at,
        issueTypeName: item.ticket_issue_types?.name
      }));

      return {
        customIssueTypes: issueTypes || [],
        customSubIssues
      };
    } catch (err: any) {
      console.warn('Custom ticket categories tables not available yet or query failed:', err.message);
      return {
        customIssueTypes: [],
        customSubIssues: []
      };
    }
  },

  async ensureIssueTypeRecord(issueTypeName: string) {
    const trimmedName = issueTypeName.trim();
    if (!trimmedName) throw new Error('Issue Type name cannot be empty');

    // 1. Try case-insensitive lookup
    const { data: existing, error: fetchErr } = await supabase
      .from('ticket_issue_types')
      .select('id, name')
      .ilike('name', trimmedName)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (existing) {
      return existing;
    }

    // 2. Insert new parent row
    const { data: inserted, error: insertErr } = await supabase
      .from('ticket_issue_types')
      .insert([{ name: trimmedName }])
      .select()
      .single();

    if (insertErr) {
      // Race-condition fallback: if duplicate error occurred, fetch again
      if (insertErr.code === '23505' || insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
        const { data: retryData, error: retryErr } = await supabase
          .from('ticket_issue_types')
          .select('id, name')
          .ilike('name', trimmedName)
          .single();
        if (retryErr) throw retryErr;
        return retryData;
      }
      throw insertErr;
    }

    return inserted;
  },

  async addCustomIssueType(name: string, description?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Issue Type name is required');
    }

    // Case-insensitive check
    const { data: existing } = await supabase
      .from('ticket_issue_types')
      .select('id, name')
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      throw new Error(`Issue Type "${trimmedName}" already exists`);
    }

    const { data, error } = await supabase
      .from('ticket_issue_types')
      .insert([{
        name: trimmedName,
        description: description?.trim() || null
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        throw new Error(`Issue Type "${trimmedName}" already exists`);
      }
      throw error;
    }

    return data;
  },

  async addCustomSubIssue(issueTypeId: number, name: string, description?: string) {
    const trimmedName = name.trim();
    if (!issueTypeId) {
      throw new Error('Valid Issue Type ID is required');
    }
    if (!trimmedName) {
      throw new Error('Sub-Issue name is required');
    }

    // Scoped case-insensitive duplicate check
    const { data: existing } = await supabase
      .from('ticket_sub_issues')
      .select('id, name')
      .eq('issue_type_id', issueTypeId)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      throw new Error(`Sub-Issue "${trimmedName}" already exists under this Issue Type`);
    }

    const { data, error } = await supabase
      .from('ticket_sub_issues')
      .insert([{
        issue_type_id: issueTypeId,
        name: trimmedName,
        description: description?.trim() || null
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        throw new Error(`Sub-Issue "${trimmedName}" already exists under this Issue Type`);
      }
      throw error;
    }

    return data;
  }
};
