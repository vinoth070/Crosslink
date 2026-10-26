import React, { useState, useEffect, useRef } from 'react';
import {
  AskQueryResponse,
  AssistantActionType,
  ClaimVerdict,
  DocumentItem,
  EntityItem,
  AssistantScope,
} from '../../types/rag';
import { SAMPLE_MULTI_HOP_QUESTIONS } from '../../data/demoData';
import { EvidenceDrawer } from './EvidenceDrawer';
import {
  sendAssistantMessage,
  fetchAssistantConversations,
  fetchAssistantConversation,
} from '../../services/assistantService';
import {
  IconChat,
  IconArrowRight,
  IconDocument,
  IconGraph,
  IconShield,
  IconTrash,
} from '../common/Icons';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionType?: AssistantActionType;
  claimVerdict?: ClaimVerdict;
  suggestedQuestions?: string[];
  ragResponse?: AskQueryResponse;
}

interface AskCrosslinkViewProps {
  initialQuestion?: string;
  documents?: DocumentItem[];
  selectedEntity?: EntityItem | null;
}

export function AskCrosslinkView({
  initialQuestion,
  documents = [],
  selectedEntity,
}: AskCrosslinkViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(initialQuestion || '');
  const [isLoading, setIsLoading] = useState(false);
  const [retrievalMode, setRetrievalMode] = useState<'hybrid' | 'vector_only' | 'graph_only'>('hybrid');
  const [inspectingResponse, setInspectingResponse] = useState<AskQueryResponse | null>(null);

  // Specialized action state
  const [activeAction, setActiveAction] = useState<AssistantActionType>('ask');
  const [entityA, setEntityA] = useState('');
  const [entityB, setEntityB] = useState('');
  const [claimInput, setClaimInput] = useState('');

  // Scope state
  const [scopeType, setScopeType] = useState<'all' | 'selected'>('all');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const convList = await fetchAssistantConversations();
        if (convList && convList.length > 0) {
          const latest = await fetchAssistantConversation(convList[0].id);
          if (latest && latest.messages) {
            setMessages(
              latest.messages.map((m) => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                timestamp: m.timestamp,
                actionType: m.actionType,
                claimVerdict: m.claimVerdict,
                suggestedQuestions: m.suggestedQuestions,
                ragResponse: m.ragResponse,
              }))
            );
          }
        }
      } catch (err) {
        console.warn('Could not fetch assistant history:', err);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialQuestion) {
      setInputText(initialQuestion);
    }
  }, [initialQuestion]);

  const getScope = (): AssistantScope => {
    if (scopeType === 'selected' && selectedDocIds.length > 0) {
      return {
        type: 'selected',
        documentIds: selectedDocIds,
        documentNames: documents.filter((d) => selectedDocIds.includes(d.id)).map((d) => d.name),
        entityId: selectedEntity?.id,
        entityName: selectedEntity?.name,
      };
    }
    return {
      type: 'all',
      entityId: selectedEntity?.id,
      entityName: selectedEntity?.name,
    };
  };

  const handleSend = async (questionToSend?: string, overrideAction?: AssistantActionType) => {
    const action = overrideAction || activeAction;
    const question = (questionToSend || inputText || claimInput).trim();
    if (!question && action !== 'summarize' && action !== 'research_gaps') return;

    const userText = question || (action === 'summarize' ? 'Summarize research scope' : 'Analyze research gaps in collection');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
      actionType: action,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setClaimInput('');
    setIsLoading(true);

    try {
      const response = await sendAssistantMessage({
        message: question,
        actionType: action,
        scope: getScope(),
        retrievalMode,
        entityA: entityA || undefined,
        entityB: entityB || undefined,
        claim: claimInput || (action === 'check_claim' ? question : undefined),
      });

      const assistantMsg: ChatMessage = {
        id: response.message.id,
        sender: 'assistant',
        text: response.message.text,
        timestamp: response.message.timestamp,
        actionType: response.message.actionType,
        claimVerdict: response.message.claimVerdict,
        suggestedQuestions: response.message.suggestedQuestions,
        ragResponse: response.message.ragResponse,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Retrieval error: ${(err as Error).message}. Please ensure the server is active.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setActiveAction('ask');
      setEntityA('');
      setEntityB('');
    }
  };

  const renderVerdictBadge = (verdict?: ClaimVerdict) => {
    if (!verdict) return null;
    const styles: Record<ClaimVerdict, { bg: string; text: string; border: string; label: string }> = {
      supported: { bg: 'bg-[#eef5f2]', text: 'text-[#1c5d4f]', border: 'border-[#cfe2db]', label: 'Supported' },
      contradicted: { bg: 'bg-[#faeded]', text: 'text-[#9c2d2d]', border: 'border-[#edd1d1]', label: 'Contradicted' },
      partially_supported: { bg: 'bg-[#faf3e8]', text: 'text-[#7a5a22]', border: 'border-[#ebdcc4]', label: 'Partially Supported' },
      insufficient_evidence: { bg: 'bg-[#f4f1ea]', text: 'text-[#58616d]', border: 'border-[#ded8cb]', label: 'Insufficient Evidence' },
    };
    const s = styles[verdict];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider border ${s.bg} ${s.text} ${s.border}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fbfaf7] overflow-hidden relative">
      {/* Top Retrieval & Action Bar */}
      <div className="bg-[#ffffff] border-b border-[#e4ded2] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#1f242b]">Mode:</span>
            <div className="inline-flex rounded-[4px] border border-[#d6d0c2] p-0.5 bg-[#f4f1ea]">
              <button
                onClick={() => setRetrievalMode('hybrid')}
                className={`px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                  retrievalMode === 'hybrid'
                    ? 'bg-white text-[#1f5f54] font-semibold shadow-2xs'
                    : 'text-[#505965] hover:text-[#1c2128]'
                }`}
              >
                Hybrid
              </button>
              <button
                onClick={() => setRetrievalMode('vector_only')}
                className={`px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                  retrievalMode === 'vector_only'
                    ? 'bg-white text-[#1f5f54] font-semibold shadow-2xs'
                    : 'text-[#505965] hover:text-[#1c2128]'
                }`}
              >
                Vector
              </button>
              <button
                onClick={() => setRetrievalMode('graph_only')}
                className={`px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                  retrievalMode === 'graph_only'
                    ? 'bg-white text-[#1f5f54] font-semibold shadow-2xs'
                    : 'text-[#505965] hover:text-[#1c2128]'
                }`}
              >
                Graph
              </button>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="relative text-xs">
            <button
              onClick={() => setShowScopeSelector(!showScopeSelector)}
              className="px-2 py-1 rounded-[4px] border border-[#d6d0c2] bg-[#faf8f4] text-[#3d4550] hover:bg-[#eae5db] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <IconDocument className="w-3.5 h-3.5 text-[#1f5f54]" />
              <span>
                Scope: {scopeType === 'all' ? 'All documents' : `${selectedDocIds.length} selected`}
              </span>
            </button>

            {showScopeSelector && (
              <div className="absolute left-0 mt-1 w-64 bg-[#ffffff] border border-[#d8d2c4] rounded-[5px] shadow-lg p-3 z-30 space-y-2 text-xs">
                <div className="font-semibold text-[#1c2128]">Document Filter</div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[#333a43]">
                    <input
                      type="radio"
                      name="pageScope"
                      checked={scopeType === 'all'}
                      onChange={() => {
                        setScopeType('all');
                        setShowScopeSelector(false);
                      }}
                      className="accent-[#1f5f54]"
                    />
                    <span>All indexed documents</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#333a43]">
                    <input
                      type="radio"
                      name="pageScope"
                      checked={scopeType === 'selected'}
                      onChange={() => setScopeType('selected')}
                      className="accent-[#1f5f54]"
                    />
                    <span>Specific documents only</span>
                  </label>
                </div>

                {scopeType === 'selected' && (
                  <div className="pt-1.5 border-t border-[#ece7dc] space-y-1 max-h-36 overflow-y-auto">
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

        {/* Action Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => handleSend('', 'summarize')}
            className="px-2.5 py-1 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[#333b46] font-medium transition-colors cursor-pointer"
          >
            Summarize
          </button>
          <button
            onClick={() => setActiveAction(activeAction === 'find_connections' ? 'ask' : 'find_connections')}
            className={`px-2.5 py-1 rounded-[4px] border text-[#333b46] font-medium transition-colors cursor-pointer ${
              activeAction === 'find_connections' ? 'bg-[#1f5f54] text-white border-[#1f5f54]' : 'bg-[#faf8f4] border-[#dcd6c8]'
            }`}
          >
            Find connections
          </button>
          <button
            onClick={() => handleSend('Compare sources', 'compare')}
            className="px-2.5 py-1 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[#333b46] font-medium transition-colors cursor-pointer"
          >
            Compare
          </button>
          <button
            onClick={() => setActiveAction(activeAction === 'check_claim' ? 'ask' : 'check_claim')}
            className={`px-2.5 py-1 rounded-[4px] border text-[#333b46] font-medium transition-colors cursor-pointer ${
              activeAction === 'check_claim' ? 'bg-[#1f5f54] text-white border-[#1f5f54]' : 'bg-[#faf8f4] border-[#dcd6c8]'
            }`}
          >
            Check claim
          </button>
          <button
            onClick={() => handleSend('', 'research_gaps')}
            className="px-2.5 py-1 rounded-[4px] bg-[#faf8f4] hover:bg-[#f2efe6] border border-[#dcd6c8] text-[#333b46] font-medium transition-colors cursor-pointer"
          >
            Research gaps
          </button>
        </div>
      </div>

      {/* Parameter inputs for Find Connections or Check Claim */}
      {activeAction === 'find_connections' && (
        <div className="bg-[#faf8f4] border-b border-[#e4ded2] px-6 py-2.5 flex items-center gap-3 text-xs">
          <span className="font-semibold text-[#1c2128]">Connect:</span>
          <input
            type="text"
            placeholder="Entity A (e.g. Dr. Elena Vance)"
            value={entityA}
            onChange={(e) => setEntityA(e.target.value)}
            className="px-2.5 py-1 bg-white border border-[#d6d0c2] rounded-[4px] text-xs"
          />
          <span className="text-[#788290]">to</span>
          <input
            type="text"
            placeholder="Entity B (e.g. St. Jude Neurological Institute)"
            value={entityB}
            onChange={(e) => setEntityB(e.target.value)}
            className="px-2.5 py-1 bg-white border border-[#d6d0c2] rounded-[4px] text-xs"
          />
          <button
            onClick={() => handleSend(`Trace connection between ${entityA} and ${entityB}`, 'find_connections')}
            disabled={!entityA || !entityB}
            className="px-3 py-1 bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white rounded-[4px] font-medium"
          >
            Trace path
          </button>
        </div>
      )}

      {activeAction === 'check_claim' && (
        <div className="bg-[#faf8f4] border-b border-[#e4ded2] px-6 py-2.5 flex items-center gap-3 text-xs">
          <span className="font-semibold text-[#1c2128]">Verify claim:</span>
          <input
            type="text"
            placeholder="e.g. CerebroSync AI was granted FDA Breakthrough Device Designation in 2025"
            value={claimInput}
            onChange={(e) => setClaimInput(e.target.value)}
            className="flex-1 px-2.5 py-1 bg-white border border-[#d6d0c2] rounded-[4px] text-xs"
          />
          <button
            onClick={() => handleSend(claimInput, 'check_claim')}
            disabled={!claimInput.trim()}
            className="px-3 py-1 bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white rounded-[4px] font-medium"
          >
            Verify
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="max-w-3xl mx-auto py-6 space-y-6">
            <div className="bg-[#ffffff] border border-[#e4ded2] rounded-[6px] p-6 space-y-2">
              <h2 className="font-serif-title text-lg font-semibold text-[#1c2128]">
                Crosslink AI Research Assistant
              </h2>
              <p className="text-xs text-[#525b66] leading-relaxed">
                Ask multi-hop questions, summarize documents, compare research sources, check claims, or explore knowledge graph relationships with grounded citations.
              </p>
            </div>

            {/* Suggested Starter Questions */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#1c2128]">
                Sample multi-hop research questions (preloaded study)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SAMPLE_MULTI_HOP_QUESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.question, 'ask')}
                    className="p-3.5 rounded-[5px] bg-[#ffffff] hover:bg-[#f6f3eb] border border-[#e4ded2] text-left transition-colors cursor-pointer group"
                  >
                    <div className="text-[10px] font-medium text-[#1f5f54] uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>{item.title}</span>
                      <IconArrowRight className="w-3 h-3 text-[#1f5f54] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs font-medium text-[#21262d] leading-snug">
                      "{item.question}"
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex max-w-3xl mx-auto ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`rounded-[6px] p-4 text-xs space-y-3 ${
                msg.sender === 'user'
                  ? 'bg-[#21262e] text-white max-w-lg shadow-2xs'
                  : 'bg-[#ffffff] border border-[#e4ded2] text-[#1c2128] w-full shadow-2xs'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#ece7dc]/60 text-[#717a86]">
                <span className="font-medium">
                  {msg.sender === 'user' ? 'Your inquiry' : 'Crosslink AI synthesis'}
                </span>
                <span className="font-mono text-[10px]">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Claim Verdict if available */}
              {msg.claimVerdict && (
                <div className="pt-0.5">
                  {renderVerdictBadge(msg.claimVerdict)}
                </div>
              )}

              {/* Text content */}
              <div className="leading-relaxed whitespace-pre-wrap text-[13px] text-[#1c2128]">
                {msg.text}
              </div>

              {/* Assistant Evidence & Citations */}
              {msg.ragResponse && (
                <div className="pt-2 border-t border-[#ece7dc] space-y-3">
                  {/* Knowledge Graph Trail */}
                  {msg.ragResponse.traversedRelationships.length > 0 && (
                    <div className="p-2.5 rounded-[5px] bg-[#faf8f4] border border-[#e8e3d8] space-y-1.5">
                      <div className="text-[10px] uppercase font-semibold text-[#1f5f54] flex items-center gap-1">
                        <IconGraph className="w-3.5 h-3.5" />
                        <span>Knowledge graph path</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {msg.ragResponse.traversedRelationships.slice(0, 3).map((r, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-white border border-[#ded8cb] font-medium text-[#2d333c]"
                          >
                            <span className="font-semibold text-[#1c2128]">{r.sourceEntityName}</span>
                            <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-[#ebe6db] text-[#4d5560]">
                              {r.type}
                            </span>
                            <IconArrowRight className="w-2.5 h-2.5 text-[#88929f]" />
                            <span className="font-semibold text-[#1c2128]">{r.targetEntityName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citations */}
                  {msg.ragResponse.citations.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-[#636c78]">
                        <span className="font-medium flex items-center gap-1">
                          <IconDocument className="w-3 h-3 text-[#1f5f54]" />
                          Citations ({msg.ragResponse.citations.length})
                        </span>
                        <span className="font-mono text-[10px] text-[#1f5f54]">
                          Top relevance: {(msg.ragResponse.citations[0].relevanceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.ragResponse.citations.slice(0, 4).map((cit, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] text-[11px] space-y-1"
                          >
                            <div className="font-medium text-[#1c2128] flex items-center justify-between">
                              <span className="truncate">{cit.documentName}</span>
                              <span className="font-mono text-[9px] text-[#717a86]">
                                {cit.chunkId}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#666f7c]">
                              {cit.pageOrSection}
                            </div>
                            <p className="text-[#3b424c] italic line-clamp-2">
                              "{cit.snippet}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up question suggestions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="pt-2 border-t border-[#ece7dc] space-y-1.5">
                      <div className="text-[10px] text-[#78818f] font-medium">Suggested follow-ups:</div>
                      <div className="space-y-1">
                        {msg.suggestedQuestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(q, 'ask')}
                            className="w-full text-left p-2 rounded-[4px] bg-[#faf8f4] hover:bg-[#f1ece1] border border-[#e4ded2] text-[11px] text-[#1f5f54] hover:underline cursor-pointer leading-snug"
                          >
                            "{q}"
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit button */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-[#59626e]">
                      Confidence: <strong className="text-[#1f5f54] font-medium">{msg.ragResponse.confidence.replace('_', ' ')}</strong>
                    </span>

                    <button
                      onClick={() => setInspectingResponse(msg.ragResponse!)}
                      className="text-xs font-medium text-[#1f5f54] hover:underline cursor-pointer"
                    >
                      Inspect retrieval audit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex max-w-3xl mx-auto justify-start">
            <div className="bg-[#ffffff] border border-[#e4ded2] rounded-[6px] p-4 text-xs space-y-2 w-64 shadow-2xs">
              <div className="font-medium text-[#1f5f54]">
                Searching vectors & traversing graph...
              </div>
              <div className="text-[11px] text-[#69727e]">
                Grounding facts and verifying document citations.
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-[#ffffff] border-t border-[#e4ded2]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-3xl mx-auto flex items-center gap-2.5"
        >
          <input
            type="text"
            placeholder="Ask a question across your research documents..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="flex-1 text-xs py-2.5 px-3 bg-[#faf8f4] border border-[#d6d0c2] rounded-[5px] focus:outline-none focus:border-[#1f5f54] text-[#1c2128] placeholder-[#7d8793]"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2.5 bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white rounded-[5px] text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            Ask
          </button>
        </form>
      </div>

      {/* Evidence Drawer */}
      {inspectingResponse && (
        <EvidenceDrawer
          response={inspectingResponse}
          onClose={() => setInspectingResponse(null)}
        />
      )}
    </div>
  );
}
