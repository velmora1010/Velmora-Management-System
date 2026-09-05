export type DefaultIssueType = 
  | 'Transport Issue'
  | 'Delivery Delay'
  | 'Delivery Attempt Failed'
  | 'Customer Not Available'
  | 'Customer Not Responding'
  | 'Wrong / Incomplete Address'
  | 'Delivery Rescheduled'
  | 'RTO Issue'
  | 'Shipment Lost'
  | 'Shipment Damaged in Transit'
  | 'Damaged Product'
  | 'Missing Product'
  | 'Wrong Product'
  | 'Wrong Quantity'
  | 'Leaked / Spilled Product'
  | 'Expired / Near Expiry Product'
  | 'Replacement'
  | 'Refund'
  | 'Order Cancellation'
  | 'Payment Issue';

export type IssueType = DefaultIssueType | string;

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
  subIssue?: string;
  issueDescription: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  internalNotes?: string;
  qrImageUrl?: string | null;
}

export interface CustomIssueTypeRecord {
  id: number;
  name: string;
  description?: string;
  active?: boolean;
  created_at?: string;
}

export interface CustomSubIssueRecord {
  id: number;
  issue_type_id: number;
  name: string;
  description?: string;
  active?: boolean;
  created_at?: string;
}
