import type { IssueType, DefaultIssueType } from '../types/customer-tickets';

export const DEFAULT_COURIER_PARTNERS = [
  'ST Courier',
  'Delhivery',
  'Ekart',
  'Amazon',
  'IThink Delhivery',
  'IThink Ekart',
  'Ithink Amazon'
];

export const DEFAULT_ISSUE_TYPES: DefaultIssueType[] = [
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
  'Payment Issue'
];

export const DEFAULT_SUB_OPTIONS_MAP: Record<DefaultIssueType, string[]> = {
  'Transport Issue': [
    'Courier Delay',
    'Shipment Not Moving',
    'Courier Contact Issue',
    'Shipment Tracking Issue'
  ],
  'Delivery Delay': [
    'Courier Delay',
    'Address Issue',
    'Customer Unavailable',
    'Customer Not Responding'
  ],
  'Delivery Attempt Failed': [
    'Customer Not Available',
    'Address Issue',
    'Customer Not Responding',
    'Delivery Attempt Without Contact'
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
    'Address Not Serviceable'
  ],
  'Delivery Rescheduled': [
    'Customer Requested',
    'Courier Rescheduled',
    'Address Issue'
  ],
  'RTO Issue': [
    'Refund Amount',
    'Resend Product'
  ],
  'Shipment Lost': [
    'Courier Claim',
    'Refund Customer',
    'Resend Shipment'
  ],
  'Shipment Damaged in Transit': [
    'Courier Claim',
    'Refund Customer',
    'Resend Shipment'
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
    'Resend Product',
    'Partial Refund',
    'Full Refund'
  ],
  'Expired / Near Expiry Product': [
    'Resend Product',
    'Full Refund'
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
  ]
};

// Legacy backward-compatibility alias
export const ALL_ISSUE_TYPES: string[] = DEFAULT_ISSUE_TYPES;

export const getSubOptionsForIssueType = (
  issueType: IssueType | string,
  customSubIssuesMap?: Record<string, string[]>
): string[] => {
  if (!issueType) return [];
  
  // Find case-insensitive match in default map
  const defaultKey = Object.keys(DEFAULT_SUB_OPTIONS_MAP).find(
    k => k.toLowerCase() === issueType.trim().toLowerCase()
  ) as DefaultIssueType | undefined;

  const defaultSubOptions = defaultKey ? DEFAULT_SUB_OPTIONS_MAP[defaultKey] : [];

  // Find case-insensitive match in custom map
  let customSubOptions: string[] = [];
  if (customSubIssuesMap) {
    const customKey = Object.keys(customSubIssuesMap).find(
      k => k.toLowerCase() === issueType.trim().toLowerCase()
    );
    if (customKey) {
      customSubOptions = customSubIssuesMap[customKey] || [];
    }
  }

  // Combine and deduplicate case-insensitively
  const combined: string[] = [...defaultSubOptions];
  for (const customOpt of customSubOptions) {
    if (!combined.some(existing => existing.toLowerCase() === customOpt.toLowerCase())) {
      combined.push(customOpt);
    }
  }

  return combined;
};

export const hasSubOptions = (
  issueType: IssueType | string,
  customSubIssuesMap?: Record<string, string[]>
): boolean => {
  const options = getSubOptionsForIssueType(issueType, customSubIssuesMap);
  return options.length > 0;
};

export const getSubIssueLabel = (issueType: IssueType | string): string => {
  if (!issueType) return 'Sub-Issue / Resolution *';
  const typeLower = issueType.toLowerCase();
  if ([
    'rto issue', 'shipment lost', 'shipment damaged in transit', 
    'damaged product', 'missing product', 'wrong product', 
    'wrong quantity', 'leaked / spilled product', 'expired / near expiry product', 
    'replacement', 'refund', 'payment issue'
  ].includes(typeLower)) {
    return 'Resolution Required *';
  }
  return 'Sub-Issue / Resolution *';
};

