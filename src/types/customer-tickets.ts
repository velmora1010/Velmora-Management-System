export type IssueType = 
  | 'Transport Issue'
  | 'Delivery Delay'
  | 'Damaged Product'
  | 'Replacement'
  | 'Refund'
  | 'Wrong Product'
  | 'Missing Product'
  | 'RTO Issue'
  | 'Customer Not Responding'
  | 'Other';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TicketStatus = 
  | 'Open'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Waiting for Courier'
  | 'Replacement Processing'
  | 'Refund Processing'
  | 'Resolved';

export interface CustomerTicket {
  id?: number;
  ticketId: string;
  customerName: string;
  phoneNumber: string;
  orderId: string;
  orderDate: string;
  awbNumber: string;
  courierPartner: string;
  state: string;
  city: string;
  issueType: IssueType;
  issueDescription: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  internalNotes?: string;
}
