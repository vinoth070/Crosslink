import React from 'react';
import { PageTab } from './Sidebar';
import { IconUpload, IconChat } from '../common/Icons';
import { ServerStatusResponse } from '../../types/rag';

interface HeaderProps {
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
  status: ServerStatusResponse | null;
  onOpenUpload: () => void;
}

export function Header({ activeTab, setActiveTab, status, onOpenUpload }: HeaderProps) {
  const titles: Record<PageTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Your Research Workspace',
      subtitle: 'Overview of indexed documents, graph structure, and evidence retrieval',
    },
    documents: {
      title: 'Documents and Chunks',
      subtitle: 'Upload and inspect text chunks parsed for the knowledge graph',
    },
    graph: {
      title: 'Interactive Knowledge Graph',
      subtitle: 'Entities, relationships, and verifiable document provenance quotes',
    },
    ask: {
      title: 'Research Assistant',
      subtitle: 'Grounded hybrid retrieval combining vector similarity and graph paths',
    },
    evidence: {
      title: 'Evidence Audit and Transparency',
      subtitle: 'Step-by-step verification of retrieval scores and prompt grounding',
    },
    settings: {
      title: 'Settings and Privacy',
      subtitle: 'Retrieval thresholds, chunking parameters, and local data policy',
    },
  };

  const current = titles[activeTab];

  return (
    <header className="h-14 bg-[#fbfaf7] border-b border-[#e6e2d8] px-6 flex items-center justify-between shrink-0 z-10">
      <div>
        <h1 className="text-sm font-semibold text-[#1a1f26] tracking-tight">
          {current.title}
        </h1>
        <p className="text-[11px] text-[#69727d]">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* System Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#f2efe7] border border-[#e2ddd1] text-[11px] text-[#4d5661]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status?.geminiConfigured ? 'bg-[#1f5f54]' : 'bg-[#a3792c]'
            }`}
          />
          <span>{status?.geminiConfigured ? (status.model || 'Gemini 3.5 Flash Lite') : 'Local Factual Engine'}</span>
        </div>

        {/* Primary and secondary header actions */}
        {activeTab !== 'documents' && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-[#1f5f54] hover:bg-[#164840] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <IconUpload className="w-3.5 h-3.5" />
            Upload documents
          </button>
        )}

        {activeTab !== 'ask' && (
          <button
            onClick={() => setActiveTab('ask')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-[#ffffff] hover:bg-[#f4f1ea] border border-[#d6d0c2] text-[#242930] text-xs font-medium transition-colors cursor-pointer"
          >
            <IconChat className="w-3.5 h-3.5 text-[#555f6b]" />
            Ask a question
          </button>
        )}
      </div>
    </header>
  );
}
