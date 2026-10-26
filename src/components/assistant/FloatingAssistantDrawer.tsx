import React, { useState, useEffect, useRef } from 'react';
import {
  AssistantMessage,
  AssistantScope,
  AssistantActionType,
  DocumentItem,
  EntityItem,
  ClaimVerdict,
} from '../../types/rag';
import {
  sendAssistantMessage,
  fetchAssistantConversations,
  fetchAssistantConversation,
  deleteAssistantConversation,
  clearAllAssistantConversations,
} from '../../services/assistantService';
import {
  IconChat,
  IconClose,
  IconArrowRight,
  IconDocument,
  IconGraph,
  IconShield,
  IconTrash,
} from '../common/Icons';

interface FloatingAssistantDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenFullPage: () => void;
  documents: DocumentItem[];
  selectedEntityContext?: EntityItem | null;
  currentDocumentContext?: DocumentItem | null;
}

export function FloatingAssistantDrawer({
  isOpen,
  onToggle,
  onOpenFullPage,
  documents,
  selectedEntityContext,
  currentDocumentContext,
}: FloatingAssistantDrawerProps) {
  // Active conversation state (preserved across drawer open/close)
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationsList, setConversationsList] = useState<
    { id: string; title: string; messageCount: number; updatedAt: string }[]
  >([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scope controls
  const [scopeType, setScopeType] = useState<'all' | 'selected' | 'current'>('all');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  // Modal for specialized actions (e.g. Find Connections, Check Claim)
  const [activeModalAction, setActiveModalAction] = useState<AssistantActionType | null>(null);
  const [entityA, setEntityA] = useState('');
  const [entityB, setEntityB] = useState('');
  const [claimInput, setClaimInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load conversation history on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const list = await fetchAssistantConversations();
      setConversationsList(list || []);
      if (list && list.length > 0 && !conversationId) {
        // Load most recent conversation
        const full = await fetchAssistantConversation(list[0].id);
        setConversationId(full.id);
        setMessages(full.messages || []);
      }
    } catch (err) {
      console.warn('Could not load conversations:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);

  // Auto-switch scope when entity or current doc context changes
  useEffect(() => {
    if (currentDocumentContext) {
      setSelectedDocIds([currentDocumentContext.id]);
    }
  }, [currentDocumentContext]);

  const handleStartNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setErrorMsg(null);
    setShowHistoryDropdown(false);
  };

  const handleSelectConversation = async (id: string) => {
    try {
      setIsLoading(true);
      const conv = await fetchAssistantConversation(id);
      setConversationId(conv.id);
      setMessages(conv.messages || []);
      setShowHistoryDropdown(false);
    } catch (err) {
      setErrorMsg('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteAssistantConversation(id);
      if (conversationId === id) {
        handleStartNewChat();
      }
      loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  // Compile active scope
  const getActiveScope = (): AssistantScope => {
    if (scopeType === 'current' && currentDocumentContext) {
      return {
        type: 'current',
        documentIds: [currentDocumentContext.id],
        documentNames: [currentDocumentContext.name],
        entityId: selectedEntityContext?.id,
        entityName: selectedEntityContext?.name,
      };
    }
    if (scopeType === 'selected' && selectedDocIds.length > 0) {
      const names = documents
        .filter((d) => selectedDocIds.includes(d.id))
        .map((d) => d.name);
      return {
        type: 'selected',
        documentIds: selectedDocIds,
        documentNames: names,
        entityId: selectedEntityContext?.id,
        entityName: selectedEntityContext?.name,
      };
    }
    return {
      type: 'all',
      entityId: selectedEntityContext?.id,
      entityName: selectedEntityContext?.name,
    };
  };

  const handleSendMessage = async (textToSend?: string, actionType: AssistantActionType = 'ask') => {
    const message = (textToSend || inputText).trim();
    if (!message && actionType !== 'summarize' && actionType !== 'research_gaps') return;

    const userTurnText = message || (actionType === 'summarize' ? 'Summarize research scope' : 'Analyze research gaps in collection');

    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userTurnText,
      timestamp: new Date().toISOString(),
      actionType,
      scopeUsed: getActiveScope(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await sendAssistantMessage({
        conversationId: conversationId || undefined,
        message,
        actionType,
        scope: getActiveScope(),
        entityA: entityA || undefined,
        entityB: entityB || undefined,
        claim: claimInput || undefined,
      });

      setConversationId(response.conversationId);
      setMessages((prev) => [...prev, response.message]);
      loadConversations();
    } catch (err) {
      const failMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error processing request: ${(err as Error).message}. Please verify the server connection.`,
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages((prev) => [...prev, failMsg]);
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
      setActiveModalAction(null);
      setEntityA('');
      setEntityB('');
      setClaimInput('');
    }
  };

  const renderClaimVerdictBadge = (verdict?: ClaimVerdict) => {
    if (!verdict) return null;
    const styles: Record<ClaimVerdict, { bg: string; text: string; border: string; label: string }> = {
      supported: { bg: 'bg-[#eef5f2]', text: 'text-[#1c5d4f]', border: 'border-[#cfe2db]', label: 'Supported' },
      contradicted: { bg: 'bg-[#faeded]', text: 'text-[#9c2d2d]', border: 'border-[#edd1d1]', label: 'Contradicted' },
      partially_supported: { bg: 'bg-[#faf3e8]', text: 'text-[#7a5a22]', border: 'border-[#ebdcc4]', label: 'Partially Supported' },
      insufficient_evidence: { bg: 'bg-[#f4f1ea]', text: 'text-[#58616d]', border: 'border-[#ded8cb]', label: 'Insufficient Evidence' },
    };
    const s = styles[verdict];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider border ${s.bg} ${s.text} ${s.border}`}>
        {s.label}
      </span>
    );
  };

  return (
    <>
      {/* 1. Persistent Floating Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-[6px] bg-[#1f5f54] hover:bg-[#164840] text-white text-xs font-semibold shadow-md border border-[#14433b] transition-all cursor-pointer group"
          aria-label="Open Crosslink AI Assistant"
        >
          <IconChat className="w-4 h-4 text-white" />
          <span>Ask Crosslink</span>
          {messages.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#8de1d1]" title="Active research conversation" />
          )}
        </button>
      )}

      {/* 2. Slide-Out Assistant Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#ffffff] border-l border-[#e4dfd3] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 text-[#1e2329]">
          {/* Drawer Header */}
          <div className="px-4 py-3 border-b border-[#e6e1d6] bg-[#faf8f4] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-[4px] bg-[#1f5f54] text-white flex items-center justify-center font-serif-title font-semibold text-xs">
                C
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#1c2128] leading-tight">
                  Crosslink AI
                </h3>
                <p className="text-[10px] text-[#636c78]">
                  Document-grounded research assistant
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1.5 text-xs">
              {/* History dropdown trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                  className="px-2 py-1 rounded-[4px] border border-[#dcd6c8] hover:bg-[#eae5db] text-[11px] text-[#4d5560] transition-colors cursor-pointer"
                  title="View conversation history"
                >
                  Chats ({conversationsList.length})
                </button>

                {showHistoryDropdown && (
                  <div className="absolute right-0 mt-1 w-64 bg-[#ffffff] border border-[#d8d2c4] rounded-[5px] shadow-lg p-1.5 z-30 space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#1c2128] border-b border-[#ece7dc]">
                      <span>Saved conversations</span>
                      <button
                        onClick={handleStartNewChat}
                        className="text-[10px] text-[#1f5f54] hover:underline cursor-pointer"
                      >
                        + New
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-[#f2eee6] text-xs">
                      {conversationsList.length === 0 ? (
                        <div className="p-3 text-center text-[#78818e] text-[11px]">
                          No saved chats yet.
                        </div>
                      ) : (
                        conversationsList.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectConversation(c.id)}
                            className={`p-2 rounded-[4px] flex items-center justify-between cursor-pointer hover:bg-[#faf8f4] transition-colors ${
                              conversationId === c.id ? 'bg-[#eef5f2] font-semibold text-[#1c5d4f]' : 'text-[#333a43]'
                            }`}
                          >
                            <span className="truncate max-w-[170px] text-[11px]">{c.title}</span>
                            <button
                              onClick={(e) => handleDeleteConversation(c.id, e)}
                              className="text-[#9ea8b5] hover:text-[#9c2d2d] p-1"
                              title="Delete chat"
                            >
                              <IconTrash className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleStartNewChat}
                className="px-2 py-1 rounded-[4px] border border-[#dcd6c8] hover:bg-[#eae5db] text-[11px] text-[#4d5560] transition-colors cursor-pointer"
                title="Start a new chat"
              >
                + New
              </button>

              <button
                onClick={onOpenFullPage}
                className="px-2 py-1 rounded-[4px] border border-[#dcd6c8] hover:bg-[#eae5db] text-[11px] text-[#4d5560] transition-colors cursor-pointer"
                title="Expand to full-page assistant"
              >
                Expand
              </button>

              <button
                onClick={onToggle}
                className="p-1 rounded-[4px] text-[#6e7784] hover:text-[#1c2128] hover:bg-[#eae5db] transition-colors cursor-pointer ml-1"
                title="Close drawer (Esc)"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scope / Context Selector Bar */}
          <div className="px-4 py-2 border-b border-[#e6e1d6] bg-[#faf8f4]/80 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-[#555d67]">
              <span className="font-semibold text-[#1c2128]">Scope:</span>
              <div className="relative">
                <button
                  onClick={() => setShowScopeDropdown(!showScopeDropdown)}
                  className="font-medium text-[#1f5f54] underline cursor-pointer"
                >
                  {scopeType === 'all'
                    ? 'All documents'
                    : scopeType === 'current'
                    ? `Current (${currentDocumentContext?.name || 'document'})`
                    : `Selected (${selectedDocIds.length} docs)`}
                </button>

                {showScopeDropdown && (
                  <div className="absolute left-0 mt-1 w-60 bg-[#ffffff] border border-[#d8d2c4] rounded-[5px] shadow-lg p-2.5 z-30 space-y-2 text-xs">
                    <div className="font-semibold text-[11px] text-[#1c2128]">
                      Choose research scope
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer text-[#333a43]">
                        <input
                          type="radio"
                          name="scope"
                          checked={scopeType === 'all'}
                          onChange={() => {
                            setScopeType('all');
                            setShowScopeDropdown(false);
                          }}
                          className="accent-[#1f5f54]"
                        />
                        <span>All indexed documents</span>
                      </label>
                      {currentDocumentContext && (
                        <label className="flex items-center gap-2 cursor-pointer text-[#333a43]">
                          <input
                            type="radio"
                            name="scope"
                            checked={scopeType === 'current'}
                            onChange={() => {
                              setScopeType('current');
                              setShowScopeDropdown(false);
                            }}
                            className="accent-[#1f5f54]"
                          />
                          <span className="truncate">Current: {currentDocumentContext.name}</span>
                        </label>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer text-[#333a43]">
                        <input
                          type="radio"
                          name="scope"
                          checked={scopeType === 'selected'}
                          onChange={() => setScopeType('selected')}
                          className="accent-[#1f5f54]"
                        />
                        <span>Custom document selection</span>
                      </label>
                    </div>

                    {scopeType === 'selected' && (
                      <div className="pt-1 border-t border-[#ece7dc] space-y-1 max-h-32 overflow-y-auto">
                        {documents.map((d) => (
                          <label key={d.id} className="flex items-center gap-1.5 text-[11px] text-[#4d5662] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedDocIds.includes(d.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedDocIds((p) => [...p, d.id]);
                                else setSelectedDocIds((p) => p.filter((id) => id !== d.id));
                              }}
                              className="accent-[#1f5f54]"
                            />
                            <span className="truncate">{d.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedEntityContext && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#edf3f1] text-[#1b5e52] border border-[#cbe0da] truncate max-w-[150px]">
                Entity: {selectedEntityContext.name}
              </span>
            )}
          </div>

          {/* Quick Action Tools Toolbar */}
          <div className="px-4 py-2 border-b border-[#e6e1d6] bg-[#ffffff] flex items-center gap-1.5 overflow-x-auto shrink-0 pb-1">
            <button
              onClick={() => handleSendMessage('', 'summarize')}
              className="px-2 py-0.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[11px] font-medium text-[#3b434e] transition-colors cursor-pointer shrink-0"
            >
              Summarize
            </button>
            <button
              onClick={() => setActiveModalAction('find_connections')}
              className="px-2 py-0.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[11px] font-medium text-[#3b434e] transition-colors cursor-pointer shrink-0"
            >
              Find connections
            </button>
            <button
              onClick={() => handleSendMessage('Compare sources', 'compare')}
              className="px-2 py-0.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[11px] font-medium text-[#3b434e] transition-colors cursor-pointer shrink-0"
            >
              Compare
            </button>
            <button
              onClick={() => setActiveModalAction('check_claim')}
              className="px-2 py-0.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[11px] font-medium text-[#3b434e] transition-colors cursor-pointer shrink-0"
            >
              Check a claim
            </button>
            <button
              onClick={() => handleSendMessage('', 'research_gaps')}
              className="px-2 py-0.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[11px] font-medium text-[#3b434e] transition-colors cursor-pointer shrink-0"
            >
              Research gaps
            </button>
          </div>

          {/* Modal Overlay for Specialized Action Parameters (e.g. Find Connections, Check Claim) */}
          {activeModalAction && (
            <div className="p-3 bg-[#faf8f4] border-b border-[#e4ded2] text-xs space-y-2 shrink-0 animate-in fade-in">
              {activeModalAction === 'find_connections' && (
                <div className="space-y-2">
                  <div className="font-semibold text-[#1c2128]">
                    Find connections between two concepts:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Entity A (e.g. Dr. Elena Vance)"
                      value={entityA}
                      onChange={(e) => setEntityA(e.target.value)}
                      className="px-2 py-1 text-xs bg-white border border-[#d6d0c2] rounded-[4px]"
                    />
                    <input
                      type="text"
                      placeholder="Entity B (e.g. St. Jude)"
                      value={entityB}
                      onChange={(e) => setEntityB(e.target.value)}
                      className="px-2 py-1 text-xs bg-white border border-[#d6d0c2] rounded-[4px]"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setActiveModalAction(null)}
                      className="px-2.5 py-1 rounded-[4px] border border-[#d6d0c2] text-[#4d5662]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendMessage(`Find connections between ${entityA} and ${entityB}`, 'find_connections')}
                      disabled={!entityA || !entityB}
                      className="px-3 py-1 rounded-[4px] bg-[#1f5f54] text-white disabled:opacity-40"
                    >
                      Trace path
                    </button>
                  </div>
                </div>
              )}

              {activeModalAction === 'check_claim' && (
                <div className="space-y-2">
                  <div className="font-semibold text-[#1c2128]">
                    Enter a claim to verify against document evidence:
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. CerebroSync AI is FDA approved to cure Parkinson's disease"
                    value={claimInput}
                    onChange={(e) => setClaimInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#d6d0c2] rounded-[4px]"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setActiveModalAction(null)}
                      className="px-2.5 py-1 rounded-[4px] border border-[#d6d0c2] text-[#4d5662]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSendMessage(`Verify claim: ${claimInput}`, 'check_claim')}
                      disabled={!claimInput.trim()}
                      className="px-3 py-1 rounded-[4px] bg-[#1f5f54] text-white disabled:opacity-40"
                    >
                      Verify claim
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-[#fbfaf7]">
            {/* Initial Welcome Greeting */}
            {messages.length === 0 && (
              <div className="p-4 rounded-[6px] bg-[#ffffff] border border-[#e4ded2] space-y-2">
                <div className="font-serif-title font-semibold text-sm text-[#1c2128]">
                  How can I help with your research?
                </div>
                <p className="text-[11px] text-[#555d67] leading-relaxed">
                  I can answer questions grounded in your uploaded documents, traverse knowledge graph paths, compare multiple sources, and verify specific claims with direct citations.
                </p>
                <div className="pt-1 text-[11px] text-[#1f5f54] space-y-1">
                  <div>• "How is Dr. Elena Vance connected to Dr. Marcus Thorne?"</div>
                  <div>• "What condition does CerebroSync AI treat?"</div>
                  <div>• "Check claim: FDA granted breakthrough designation to CerebroSync AI"</div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-[6px] p-3.5 space-y-2 text-xs max-w-[92%] ${
                    msg.sender === 'user'
                      ? 'bg-[#22272e] text-white'
                      : 'bg-[#ffffff] border border-[#e4ded2] text-[#1c2128] shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] pb-1 border-b border-[#ece7dc]/60 text-[#727c88]">
                    <span className="font-medium">
                      {msg.sender === 'user' ? 'You' : 'Crosslink AI'}
                    </span>
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Claim Verdict if present */}
                  {msg.claimVerdict && (
                    <div className="pt-0.5">
                      {renderClaimVerdictBadge(msg.claimVerdict)}
                    </div>
                  )}

                  {/* Body text */}
                  <div className="leading-relaxed whitespace-pre-wrap text-[12px] text-[#1c2128]">
                    {msg.text}
                  </div>

                  {/* Graph path chips */}
                  {msg.ragResponse && msg.ragResponse.traversedRelationships.length > 0 && (
                    <div className="pt-1.5 border-t border-[#ece7dc] space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-[#1f5f54] flex items-center gap-1">
                        <IconGraph className="w-3 h-3" />
                        <span>Knowledge path</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {msg.ragResponse.traversedRelationships.slice(0, 2).map((r, i) => (
                          <div key={i} className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#f4f1ea] border border-[#ded8cb]">
                            <span>{r.sourceEntityName}</span>
                            <span className="font-mono text-[9px] text-[#555e69]">{r.type}</span>
                            <IconArrowRight className="w-2.5 h-2.5 text-[#88929f]" />
                            <span>{r.targetEntityName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citations */}
                  {msg.ragResponse && msg.ragResponse.citations.length > 0 && (
                    <div className="pt-1.5 border-t border-[#ece7dc] space-y-1">
                      <div className="text-[10px] uppercase font-semibold text-[#666f7d] flex items-center gap-1">
                        <IconDocument className="w-3 h-3 text-[#1f5f54]" />
                        <span>Citations ({msg.ragResponse.citations.length})</span>
                      </div>
                      <div className="space-y-1">
                        {msg.ragResponse.citations.slice(0, 3).map((c, i) => (
                          <div key={i} className="p-1.5 rounded-[3px] bg-[#faf8f4] border border-[#e8e4db] text-[10px]">
                            <div className="font-medium text-[#1c2128] flex justify-between">
                              <span className="truncate">{c.documentName}</span>
                              <span className="font-mono text-[#1f5f54]">{(c.relevanceScore * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-[#646d79] line-clamp-2 italic">
                              "{c.snippet}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up question suggestions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="pt-2 border-t border-[#ece7dc] space-y-1">
                      <div className="text-[10px] text-[#78818f] font-medium">Suggested follow-ups:</div>
                      <div className="space-y-1">
                        {msg.suggestedQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(q, 'ask')}
                            className="w-full text-left p-1.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#f1ece1] border border-[#e4ded2] text-[11px] text-[#1f5f54] hover:underline cursor-pointer leading-snug"
                          >
                            "{q}"
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-[6px] bg-[#ffffff] border border-[#e4ded2] text-xs text-[#555e69] space-y-1 w-60">
                  <div className="font-semibold text-[#1f5f54]">
                    Retrieving evidence & graph connections...
                  </div>
                  <div className="text-[10px] text-[#717b87]">
                    Confirming document scope and citations.
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-[#ffffff] border-t border-[#e6e1d6] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask Crosslink AI..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isLoading}
                className="flex-1 text-xs py-2 px-3 bg-[#faf8f4] border border-[#d6d0c2] rounded-[4px] focus:outline-none focus:border-[#1f5f54] text-[#1c2128]"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="px-3 py-2 bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white rounded-[4px] text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
