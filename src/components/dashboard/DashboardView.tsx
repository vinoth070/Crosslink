import React, { useEffect, useState } from 'react';
import { ServerStatusResponse, AskQueryResponse, DocumentItem } from '../../types/rag';
import { PageTab } from '../layout/Sidebar';
import { SAMPLE_MULTI_HOP_QUESTIONS } from '../../data/demoData';
import {
  IconUpload,
  IconChat,
  IconArrowRight,
  IconDocument,
  IconGraph,
} from '../common/Icons';
import { StatusBadge } from '../common/Badge';

interface DashboardViewProps {
  status: ServerStatusResponse | null;
  setActiveTab: (tab: PageTab) => void;
  onAskQuestion: (q: string) => void;
  onResetDemo: () => void;
}

export function DashboardView({
  status,
  setActiveTab,
  onAskQuestion,
}: DashboardViewProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [recentQueries, setRecentQueries] = useState<AskQueryResponse[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingDocs(true);
        const [docsRes, histRes] = await Promise.all([
          fetch('/api/documents'),
          fetch('/api/rag/history'),
        ]);
        const docs = await docsRes.json();
        const hist = await histRes.json();
        setDocuments(docs || []);
        setRecentQueries(hist || []);
      } catch (err) {
        console.warn('Dashboard data fetch note:', err);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl">
      {/* 1. Welcoming Workspace Header */}
      <div className="bg-[#ffffff] border border-[#e4dfd3] rounded-[6px] p-6 space-y-4">
        <div className="space-y-1.5">
          <h2 className="font-serif-title text-xl font-semibold text-[#1c2128] tracking-tight">
            Your Research Workspace
          </h2>
          <p className="text-xs text-[#525b66] leading-relaxed max-w-2xl">
            Crosslink indexes your research documents, extracts entity relationships into a knowledge graph, and provides verifiable answers supported by direct citations and multi-hop paths.
          </p>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => setActiveTab('documents')}
            className="flex items-center gap-2 px-4 py-2 rounded-[5px] bg-[#1f5f54] hover:bg-[#164840] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <IconUpload className="w-3.5 h-3.5" />
            Upload documents
          </button>

          <button
            onClick={() => setActiveTab('ask')}
            className="flex items-center gap-2 px-4 py-2 rounded-[5px] bg-[#ffffff] hover:bg-[#f5f2ea] border border-[#d6d0c2] text-[#23282f] text-xs font-medium transition-colors cursor-pointer"
          >
            <IconChat className="w-3.5 h-3.5 text-[#5f6874]" />
            Ask a question
          </button>
        </div>
      </div>

      {/* 2. Simple Knowledge Graph Summary (Only shown when data exists) */}
      {status && status.entitiesCount > 0 && (
        <div className="bg-[#ffffff] border border-[#e4dfd3] rounded-[6px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-[5px] bg-[#edf3f1] text-[#1b5e52] shrink-0">
              <IconGraph className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#1c2128]">
                Knowledge graph summary
              </div>
              <div className="text-[11px] text-[#58616d]">
                {status.entitiesCount} verified entities connected by {status.relationshipsCount} relationships across {status.documentsCount} documents.
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('graph')}
            className="flex items-center gap-1.5 text-xs font-medium text-[#1f5f54] hover:text-[#143e36] hover:underline self-end sm:self-center cursor-pointer"
          >
            <span>Explore graph</span>
            <IconArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Compact List of Recent Documents */}
      <div className="bg-[#ffffff] border border-[#e4dfd3] rounded-[6px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e9e5dc] flex items-center justify-between bg-[#faf8f4]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1f242b]">
            <IconDocument className="w-3.5 h-3.5 text-[#636c77]" />
            <span>Indexed Documents</span>
          </div>
          <button
            onClick={() => setActiveTab('documents')}
            className="text-[11px] text-[#5e6773] hover:text-[#1c2128] hover:underline cursor-pointer"
          >
            Manage documents ({documents.length})
          </button>
        </div>

        {loadingDocs ? (
          <div className="py-8 text-center text-xs text-[#6e7783]">
            Loading document repository...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-xs font-medium text-[#2d333b]">
              No documents in your workspace yet.
            </div>
            <p className="text-[11px] text-[#69727e] max-w-sm mx-auto">
              Upload research papers or notes in PDF, Markdown, or plain text to start extracting connections.
            </p>
            <button
              onClick={() => setActiveTab('documents')}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-[#1f5f54] text-white text-xs font-medium"
            >
              <IconUpload className="w-3.5 h-3.5" />
              Upload your first document
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#f0ece3]">
            {documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="px-5 py-3 flex items-center justify-between text-xs hover:bg-[#faf8f4] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-medium text-[#1c2128] truncate">
                    {doc.name}
                  </span>
                  {doc.isDemo && (
                    <span className="px-1.5 py-0.2 rounded-[3px] text-[10px] bg-[#f0ece3] text-[#5a626e]">
                      Sample
                    </span>
                  )}
                  <span className="text-[11px] text-[#717b87]">
                    {(doc.size / 1024).toFixed(1)} KB • {doc.chunkCount} chunks
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <StatusBadge status={doc.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Small Recent Activity Section (Only if meaningful activity exists) */}
      {recentQueries.length > 0 ? (
        <div className="bg-[#ffffff] border border-[#e4dfd3] rounded-[6px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e9e5dc] flex items-center justify-between bg-[#faf8f4]">
            <span className="text-xs font-semibold text-[#1f242b]">
              Recent Questions and Answers
            </span>
            <button
              onClick={() => setActiveTab('ask')}
              className="text-[11px] text-[#5e6773] hover:text-[#1c2128] hover:underline cursor-pointer"
            >
              Open question studio
            </button>
          </div>

          <div className="divide-y divide-[#f0ece3]">
            {recentQueries.slice(0, 3).map((q) => (
              <div
                key={q.id}
                onClick={() => onAskQuestion(q.question)}
                className="px-5 py-3 text-xs hover:bg-[#faf8f4] transition-colors cursor-pointer space-y-1"
              >
                <div className="font-medium text-[#1c2128] hover:text-[#1f5f54]">
                  {q.question}
                </div>
                <div className="text-[11px] text-[#58616d] line-clamp-1">
                  {q.answer}
                </div>
                <div className="text-[10px] text-[#808b97] font-mono">
                  {q.citations.length} cited source{q.citations.length === 1 ? '' : 's'} • {q.confidence.replace('_', ' ')} confidence
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Helpful starter questions if no history exists yet */
        <div className="bg-[#ffffff] border border-[#e4dfd3] rounded-[6px] p-5 space-y-3">
          <div className="text-xs font-semibold text-[#1c2128]">
            Sample multi-hop questions to try with the preloaded study
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {SAMPLE_MULTI_HOP_QUESTIONS.slice(0, 4).map((item, idx) => (
              <button
                key={idx}
                onClick={() => onAskQuestion(item.question)}
                className="p-3 text-left rounded-[5px] bg-[#faf8f4] hover:bg-[#f3efe6] border border-[#e8e4da] transition-colors cursor-pointer group"
              >
                <div className="font-medium text-[#22272e] group-hover:text-[#1f5f54] leading-snug">
                  "{item.question}"
                </div>
                <div className="text-[11px] text-[#69727e] mt-1">
                  {item.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
