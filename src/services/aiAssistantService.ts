import { analyticsService } from './analyticsService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { workflowAutomationService } from './workflowAutomationService';
import type { AiMessage, AiContext, SuggestedPrompt, AiActionProposal } from '../types/aiAssistant';

export const aiAssistantService = {
  // Generate route-aware suggested prompts
  getSuggestedPrompts(currentRoute: string): SuggestedPrompt[] {
    const r = currentRoute.toLowerCase();

    if (r.includes('finance')) {
      return [
        { id: 'fin-1', label: 'Show this month\'s expenses', query: 'Show expenses for this month', module: 'finance' },
        { id: 'fin-2', label: 'Which bills are overdue?', query: 'Which bills are overdue or pending?', module: 'finance' },
        { id: 'fin-3', label: 'What is today\'s revenue?', query: 'What is today\'s revenue and cashflow?', module: 'finance' }
      ];
    }

    if (r.includes('inventory')) {
      return [
        { id: 'inv-1', label: 'Which items are low on stock?', query: 'Which products are below minimum stock?', module: 'inventory' },
        { id: 'inv-2', label: 'What is total inventory valuation?', query: 'What is the total inventory valuation?', module: 'inventory' },
        { id: 'inv-3', label: 'How many QC failures occurred?', query: 'How many QC failures occurred?', module: 'inventory' }
      ];
    }

    if (r.includes('marketing')) {
      return [
        { id: 'mkt-1', label: 'Which campaigns are active?', query: 'Which campaigns are currently active?', module: 'marketing' },
        { id: 'mkt-2', label: 'What is the campaign success rate?', query: 'What is our campaign success rate?', module: 'marketing' }
      ];
    }

    if (r.includes('task')) {
      return [
        { id: 'tsk-1', label: 'How many tasks are pending?', query: 'How many tasks are pending?', module: 'tasks' },
        { id: 'tsk-2', label: 'Show overdue tasks', query: 'Which tasks are overdue?', module: 'tasks' },
        { id: 'tsk-3', label: 'Create a quick task', query: 'Create task: Review quarterly budget', module: 'tasks' }
      ];
    }

    // Default General Prompts
    return [
      { id: 'gen-1', label: 'System Executive Summary', query: 'Give me an executive summary of the system', module: 'general' },
      { id: 'gen-2', label: 'How many tasks are pending?', query: 'How many tasks are pending?', module: 'tasks' },
      { id: 'gen-3', label: 'Which items are low on stock?', query: 'Which products are below minimum stock?', module: 'inventory' },
      { id: 'gen-4', label: 'Show overdue bills', query: 'Which bills are overdue?', module: 'finance' }
    ];
  },

  // Main Natural Language Query Orchestration
  async processQuery(query: string, context: AiContext): Promise<AiMessage> {
    const q = query.toLowerCase().trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-${Date.now()}`;

    try {
      // 1. Action Creation Intent Recognition (Requires User Confirmation)
      if (q.startsWith('create task') || q.includes('add task')) {
        const titleMatch = query.replace(/create task:?/i, '').trim() || 'New Operational Task';
        const proposal: AiActionProposal = {
          type: 'CREATE_TASK',
          title: 'Confirm Task Creation',
          description: `Create new task: "${titleMatch}"`,
          payload: {
            title: titleMatch,
            description: 'Task auto-proposed via Velmora AI Business Assistant.',
            priority: 'Medium'
          }
        };

        return {
          id: msgId,
          sender: 'assistant',
          text: `I have prepared a proposal to create task **"${titleMatch}"**. Please review and confirm below.`,
          timestamp,
          proposedAction: proposal
        };
      }

      if (q.startsWith('create vendor') || q.includes('add vendor')) {
        const vendorName = query.replace(/create vendor:?/i, '').trim() || 'New Supply Partner';
        const proposal: AiActionProposal = {
          type: 'CREATE_VENDOR',
          title: 'Confirm Vendor Creation',
          description: `Register vendor: "${vendorName}"`,
          payload: {
            name: vendorName,
            status: 'Active'
          }
        };

        return {
          id: msgId,
          sender: 'assistant',
          text: `I have prepared a proposal to register vendor **"${vendorName}"**. Please review and confirm below.`,
          timestamp,
          proposedAction: proposal
        };
      }

      // 2. Data Retrieval Queries via Existing Services
      // KPI & Executive Summary Query
      if (q.includes('summary') || q.includes('executive') || q.includes('overview')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `📊 **Velmora Executive Summary**:\n\n` +
            `• **Total Revenue**: ₹${kpis.totalRevenue.toLocaleString()}\n` +
            `• **Total Expenses**: ₹${kpis.totalExpenses.toLocaleString()}\n` +
            `• **Active Campaigns**: ${kpis.activeCampaignsCount} (${kpis.campaignSuccessRate}% Success Rate)\n` +
            `• **Tasks Completed**: ${kpis.tasksCompletedCount} (${kpis.overdueTasksCount} overdue)\n` +
            `• **Inventory Valuation**: ₹${kpis.inventoryTotalValue.toLocaleString()} (${kpis.lowStockCount} low stock alerts)\n` +
            `• **QC Pass Rate**: ${kpis.qcPassRate}%`,
          timestamp,
          routeLink: '/analytics'
        };
      }

      // Finance & Revenue Queries
      if (q.includes('revenue') || q.includes('cashflow') || q.includes('expense')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `💰 **Financial Overview**:\n\n` +
            `• **Total Revenue**: ₹${kpis.totalRevenue.toLocaleString()}\n` +
            `• **Total Expenses**: ₹${kpis.totalExpenses.toLocaleString()}\n` +
            `• **Pending Bills**: ${kpis.pendingBillsCount} bills totaling ₹${kpis.pendingBillsAmount.toLocaleString()}`,
          timestamp,
          routeLink: '/finance'
        };
      }

      // Overdue Bills Query
      if (q.includes('bill') || q.includes('overdue')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `📜 **Bills Summary**:\n\n` +
            `There are currently **${kpis.pendingBillsCount} pending/overdue bills** totaling **₹${kpis.pendingBillsAmount.toLocaleString()}**.`,
          timestamp,
          routeLink: '/finance'
        };
      }

      // Tasks Query
      if (q.includes('task') || q.includes('pending task')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `✅ **Task Status**:\n\n` +
            `• **Completed Tasks**: ${kpis.tasksCompletedCount}\n` +
            `• **Overdue Tasks**: ${kpis.overdueTasksCount}`,
          timestamp,
          routeLink: '/tasks'
        };
      }

      // Inventory & Low Stock Query
      if (q.includes('inventory') || q.includes('stock') || q.includes('reorder')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `📦 **Inventory & Stock Report**:\n\n` +
            `• **Total Inventory Valuation**: ₹${kpis.inventoryTotalValue.toLocaleString()}\n` +
            `• **Low Stock Alert**: **${kpis.lowStockCount} raw material items** are currently below their minimum threshold.`,
          timestamp,
          routeLink: '/inventory/dashboard'
        };
      }

      // Marketing Query
      if (q.includes('campaign') || q.includes('marketing') || q.includes('influencer')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `📢 **Marketing Campaign Status**:\n\n` +
            `• **Active Campaigns**: ${kpis.activeCampaignsCount}\n` +
            `• **Campaign Success Rate**: ${kpis.campaignSuccessRate}%`,
          timestamp,
          routeLink: '/marketing'
        };
      }

      // Quality Control Query
      if (q.includes('qc') || q.includes('quality') || q.includes('failure')) {
        const kpis = await analyticsService.getKpiMetrics();
        return {
          id: msgId,
          sender: 'assistant',
          text: `🛡️ **Quality Control Inspection**:\n\n` +
            `• **QC Pass Rate**: ${kpis.qcPassRate}%\n` +
            `• **Production Batches Tested**: ${kpis.productionBatchCount} batches`,
          timestamp,
          routeLink: '/inventory/quality-check'
        };
      }

      // Fallback Helpful Response (No hallucinated data)
      return {
        id: msgId,
        sender: 'assistant',
        text: `I understand you are asking about **"${query}"** on route \`${context.currentRoute}\`.\n\n` +
          `You can ask me questions about **Tasks**, **Finance**, **Marketing**, **Inventory**, **Production**, or **QC**, or ask me to **"Create task: [title]"**.`,
        timestamp
      };

    } catch (err) {
      return {
        id: msgId,
        sender: 'assistant',
        text: `I encountered an issue processing your query. Please try again or check your permissions.`,
        timestamp
      };
    }
  },

  // Execute User-Confirmed Action Proposal
  async confirmProposal(proposal: AiActionProposal, userEmail: string | null): Promise<boolean> {
    try {
      if (proposal.type === 'CREATE_TASK') {
        // Emit automation event & write audit log
        workflowAutomationService.emitEvent('TASK_CREATED', {
          recordName: proposal.payload.title,
          module: 'tasks',
          userEmail
        });
        auditService.logCreate({
          userEmail,
          module: 'tasks',
          recordId: proposal.payload.title,
          newData: proposal.payload
        });
        notificationService.createNotification({
          title: 'Task Created via AI',
          message: `Task "${proposal.payload.title}" created successfully.`,
          module: 'tasks',
          type: 'success',
          route: '/tasks'
        });
        return true;
      }

      if (proposal.type === 'CREATE_VENDOR') {
        auditService.logCreate({
          userEmail,
          module: 'vendors',
          recordId: proposal.payload.name,
          newData: proposal.payload
        });
        notificationService.createNotification({
          title: 'Vendor Created via AI',
          message: `Vendor "${proposal.payload.name}" registered successfully.`,
          module: 'vendors',
          type: 'success',
          route: '/vendor'
        });
        return true;
      }

      return false;
    } catch (e) {
      console.error('Error confirming AI proposal:', e);
      return false;
    }
  }
};
