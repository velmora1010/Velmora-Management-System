import type { IssueType } from '../types/customer-tickets';

export const ALL_ISSUE_TYPES: IssueType[] = [
  'Transport Issue',
  'Delivery Delay',
  'Delivery Attempt Failed',
  'Customer Not Available',
  'Customer Not Responding',
  'Wrong / Incomplete Address',
  'Delivery Rescheduled',
  'RTO Issue',
  'Shipment Lost',
  'Shipment Damaged in Transit',
  'Damaged Product',
  'Missing Product',
  'Wrong Product',
  'Wrong Quantity',
  'Leaked / Spilled Product',
  'Expired / Near Expiry Product',
  'Replacement',
  'Refund',
  'Order Cancellation',
  'Payment Issue',
  'Other'
];

export const ISSUE_SUB_OPTIONS_MAP: Record<IssueType, string[]> = {
  'Transport Issue': [
    'Courier Delay',
    'Shipment Not Moving',
    'Courier Contact Issue',
    'Shipment Tracking Issue',
    'Other'
  ],
  'Delivery Delay': [
    'Courier Delay',
    'Address Issue',
    'Customer Unavailable',
    'Customer Not Responding',
    'Other'
  ],
  'Delivery Attempt Failed': [
    'Customer Not Available',
    'Address Issue',
    'Customer Not Responding',
    'Delivery Attempt Without Contact',
    'Other'
  ],
  'Customer Not Available': [
    'Reattempt Delivery',
    'Contact Customer',
    'RTO'
  ],
  'Customer Not Responding': [
    'Wait for Customer',
    'Contact Customer Again',
    'Cancel Order',
    'RTO'
  ],
  'Wrong / Incomplete Address': [
    'Wrong Address',
    'Missing Address Details',
    'Pincode Issue',
    'Address Not Serviceable',
    'Other'
  ],
  'Delivery Rescheduled': [
    'Customer Requested',
    'Courier Rescheduled',
    'Address Issue',
    'Other'
  ],
  'RTO Issue': [
    'Refund Amount',
    'Resend Product'
  ],
  'Shipment Lost': [
    'Refund Amount',
    'Resend Product'
  ],
  'Shipment Damaged in Transit': [
    'Refund Amount',
    'Resend Product'
  ],
  'Damaged Product': [
    'Refund Amount',
    'Resend Product'
  ],
  'Missing Product': [
    'Resend Missing Product',
    'Refund Amount'
  ],
  'Wrong Product': [
    'Replacement / Resend Product',
    'Refund Amount'
  ],
  'Wrong Quantity': [
    'Resend Missing Quantity',
    'Refund Amount'
  ],
  'Leaked / Spilled Product': [
    'Refund Amount',
    'Resend Product'
  ],
  'Expired / Near Expiry Product': [
    'Replacement / Resend Product',
    'Refund Amount'
  ],
  'Replacement': [
    'Resend Same Product',
    'Resend Different Product',
    'Refund Instead'
  ],
  'Refund': [
    'Full Refund',
    'Partial Refund',
    'Refund Shipping Amount'
  ],
  'Order Cancellation': [
    'Cancel Before Dispatch',
    'Cancel After Dispatch',
    'RTO'
  ],
  'Payment Issue': [
    'Payment Failed',
    'Payment Pending',
    'COD Issue',
    'Refund Required'
  ],
  'Other': []
};

export const getSubOptionsForIssueType = (issueType: IssueType | string): string[] => {
  if (!issueType) return [];
  return ISSUE_SUB_OPTIONS_MAP[issueType as IssueType] || [];
};

export const hasSubOptions = (issueType: IssueType | string): boolean => {
  const options = getSubOptionsForIssueType(issueType);
  return options.length > 0;
};

export const getSubIssueLabel = (issueType: IssueType | string): string => {
  if (!issueType) return 'Sub-Issue / Resolution *';
  if (['RTO Issue', 'Shipment Lost', 'Shipment Damaged in Transit', 'Damaged Product', 'Missing Product', 'Wrong Product', 'Wrong Quantity', 'Leaked / Spilled Product', 'Expired / Near Expiry Product', 'Replacement', 'Refund', 'Payment Issue'].includes(issueType)) {
    return 'Resolution Required *';
  }
  return 'Sub-Issue / Resolution *';
};
