export interface AiActionProposal {
  type: 'CREATE_TASK' | 'CREATE_VENDOR' | 'CREATE_PO_DRAFT' | 'CREATE_CAMPAIGN_DRAFT';
  title: string;
  description: string;
  payload: Record<string, any>;
  confirmed?: boolean;
}

export interface AiMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  routeLink?: string;
  proposedAction?: AiActionProposal;
}

export interface AiContext {
  currentRoute: string;
  userEmail: string | null;
  userRole: string | null;
  departmentName?: string;
  sectionName?: string;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  query: string;
  module: string;
}
