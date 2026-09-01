import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { aiAssistantService } from '../../services/aiAssistantService';
import type { AiMessage, AiContext, SuggestedPrompt, AiActionProposal } from '../../types/aiAssistant';
import { Sparkles, X, Send, Bot, User, Check, ExternalLink, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const AI_POS_KEY = 'velmora_ai_assistant_position_v2';

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

  const clampPos = (pos: { x: number; y: number }) => {
    const btnW = 56;
    const btnH = 56;
    const pad = 16;
    const maxX = Math.max(pad, window.innerWidth - btnW - pad);
    const maxY = Math.max(pad, window.innerHeight - btnH - pad);
    return {
      x: Math.max(pad, Math.min(pos.x, maxX)),
      y: Math.max(pad, Math.min(pos.y, maxY))
    };
  };

  // Floating Position State (x: left in px, y: top in px)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem(AI_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const clamped = clampPos(parsed);
          if (!isNaN(clamped.x) && !isNaN(clamped.y)) {
            return clamped;
          }
        }
      }
    } catch (e) {}
    return null;
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const buttonStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Clamp position when window is resized
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return null;
        return clampPos(prev);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const currentPos = position || {
      x: Math.max(16, window.innerWidth - 170),
      y: Math.max(16, window.innerHeight - 80)
    };
    buttonStartRef.current = currentPos;

    if (e.currentTarget) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      hasDraggedRef.current = true;
    }

    const nextPos = clampPos({
      x: buttonStartRef.current.x + dx,
      y: buttonStartRef.current.y + dy
    });

    setPosition(nextPos);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (position) {
      try {
        localStorage.setItem(AI_POS_KEY, JSON.stringify(position));
      } catch (err) {}
    }

    if (!hasDraggedRef.current) {
      setIsOpen(prev => !prev);
    }
  };

  // Monitor DOM for open right-side drawers
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

  const posStyle: React.CSSProperties = position 
    ? { left: `${position.x}px`, top: `${position.y}px` } 
    : (hasRightDrawerOpen ? { bottom: '24px', left: '24px' } : { bottom: '24px', right: '24px' });

  const getPanelStyle = (): React.CSSProperties => {
    const panelW = Math.min(384, window.innerWidth - 32);
    const panelH = Math.min(560, window.innerHeight * 0.8);

    if (!position) {
      return hasRightDrawerOpen 
        ? { bottom: '88px', left: '24px' } 
        : { bottom: '88px', right: '24px' };
    }

    let left = position.x;
    if (left + panelW > window.innerWidth - 16) {
      left = window.innerWidth - panelW - 16;
    }
    if (left < 16) left = 16;

    let top = position.y - panelH - 12;
    if (top < 16) {
      top = position.y + 58;
    }
    if (top + panelH > window.innerHeight - 16) {
      top = window.innerHeight - panelH - 16;
    }

    return { left: `${left}px`, top: `${top}px` };
  };

  return (
    <>
      {/* Draggable Floating Trigger Button - Compact Glowing Circle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={posStyle}
        aria-label="AI Assistant"
        role="button"
        tabIndex={0}
        className="fixed z-[9999] w-14 h-14 w-[56px] h-[56px] min-w-[56px] min-h-[56px] rounded-full bg-gradient-to-tr from-violet-700 via-purple-600 to-indigo-500 text-white flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none shadow-[0_0_20px_rgba(147,51,234,0.6)] hover:shadow-[0_0_30px_rgba(168,85,247,0.9)] hover:scale-110 active:scale-95 transition-all duration-300 group border border-purple-400/40 relative"
        title="Velmora AI Business Assistant (Click to open, drag to reposition)"
      >
        {/* Soft Animated Outer Glowing Pulse Ring */}
        <span className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping opacity-40 pointer-events-none" />
        
        {/* Centered Sparkles Icon */}
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform shrink-0 drop-shadow-md text-purple-100 relative z-10" />
      </div>

      {/* Slide-Out AI Chat Panel */}
      {isOpen && (
        <div 
          style={getPanelStyle()}
          className="fixed z-[9999] w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col h-[560px] max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        >
          
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
