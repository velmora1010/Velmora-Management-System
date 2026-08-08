import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { aiAssistantService } from '../../services/aiAssistantService';
import type { AiMessage, AiContext, SuggestedPrompt, AiActionProposal } from '../../types/aiAssistant';
import { Sparkles, X, Send, Bot, User, Check, ExternalLink, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const AiAssistantPanel: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prompts, setPrompts] = useState<SuggestedPrompt[]>([]);
  const [hasRightDrawerOpen, setHasRightDrawerOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Monitor DOM for open right-side drawers to reposition AI Assistant launcher
  useEffect(() => {
    const checkRightDrawer = () => {
      const drawerEl = document.querySelector('[data-right-drawer="true"]') || document.querySelector('.fixed.inset-y-0.right-0');
      setHasRightDrawerOpen(!!drawerEl);
    };

    checkRightDrawer();
    const observer = new MutationObserver(checkRightDrawer);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => observer.disconnect();
  }, []);

  // Initial welcome message and route prompts
  useEffect(() => {
    const routePrompts = aiAssistantService.getSuggestedPrompts(location.pathname);
    setPrompts(routePrompts);

    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Hello! I am the **Velmora AI Business Assistant**.\n\nAsk me questions about **Finance**, **Inventory**, **Tasks**, **Marketing**, or **QC**, or select a suggested query below.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [location.pathname]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendQuery = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim() || isProcessing) return;

    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: userTimestamp
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setQuery('');
    setIsProcessing(true);

    try {
      const context: AiContext = {
        currentRoute: location.pathname,
        userEmail: user?.email || null,
        userRole: 'Admin'
      };

      const responseMsg = await aiAssistantService.processQuery(q, context);
      setMessages(prev => [...prev, responseMsg]);
    } catch (e) {
      toast.error('Failed to process AI query');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async (msgId: string, proposal: AiActionProposal) => {
    setIsProcessing(true);
    try {
      const success = await aiAssistantService.confirmProposal(proposal, user?.email || null);
      if (success) {
        toast.success(`Action confirmed: ${proposal.title}`);
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          proposedAction: { ...proposal, confirmed: true },
          text: `${m.text}\n\n✅ **Action executed successfully!**`
        } : m));
      } else {
        toast.error('Failed to execute proposed action');
      }
    } catch (e) {
      toast.error('Error confirming action');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-6 z-50 p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full shadow-2xl transition-all duration-300 flex items-center gap-2 group hover:scale-105 ${
          hasRightDrawerOpen ? 'left-6 right-auto' : 'right-6'
        }`}
        title="Velmora AI Business Assistant"
      >
        <Sparkles size={22} className="animate-spin-slow group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold pr-1 hidden sm:inline">AI Assistant</span>
      </button>

      {/* Slide-Out AI Chat Panel */}
      {isOpen && (
        <div className={`fixed bottom-20 z-50 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col h-[560px] max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-5 duration-300 ${
          hasRightDrawerOpen ? 'left-4 sm:left-6 right-auto' : 'right-4 sm:right-6'
        }`}>
          
          {/* Panel Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-900/80 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-main flex items-center gap-1.5">
                  Velmora AI Assistant
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    LIVE
                  </span>
                </h3>
                <p className="text-[11px] text-muted truncate max-w-[180px]">Context: {location.pathname}</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat Transcript Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <Bot size={14} />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-2 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-xs p-3 shadow-sm'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-xs p-3.5 shadow-sm'
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                  </div>

                  {/* Optional Route Link */}
                  {msg.routeLink && (
                    <button
                      onClick={() => { setIsOpen(false); navigate(msg.routeLink!); }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 pt-1"
                    >
                      Open Module <ExternalLink size={11} />
                    </button>
                  )}

                  {/* Proposed Action Confirmation Card */}
                  {msg.proposedAction && (
                    <div className="mt-3 p-3 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-2 text-xs">
                      <div className="font-bold text-indigo-400 flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        {msg.proposedAction.title}
                      </div>
                      <p className="text-slate-300">{msg.proposedAction.description}</p>
                      
                      {!msg.proposedAction.confirmed ? (
                        <div className="pt-2 flex gap-2">
                          <button
                            onClick={() => handleConfirmAction(msg.id, msg.proposedAction!)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                          >
                            <Check size={12} /> Confirm Action
                          </button>
                        </div>
                      ) : (
                        <div className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                          <Check size={12} /> Confirmed & Executed
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`text-[10px] text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 font-bold uppercase text-[10px]">
                    {user?.email?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-2 items-center text-xs text-muted font-mono p-2">
                <RefreshCw size={14} className="animate-spin text-indigo-400" />
                <span>AI Assistant processing...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Route-Aware Suggested Prompts */}
          <div className="p-2.5 bg-slate-900/60 border-t border-border overflow-x-auto flex gap-1.5 custom-scrollbar">
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSendQuery(p.query)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full text-[11px] font-medium border border-slate-700 whitespace-nowrap shrink-0 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Message Input Box */}
          <div className="p-3 bg-slate-900 border-t border-border flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask AI or type 'Create task: ...'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-main focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleSendQuery()}
              disabled={!query.trim() || isProcessing}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-40 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
