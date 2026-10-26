import React from 'react';
import { AskQueryResponse } from '../../types/rag';
import { IconClose, IconDocument, IconGraph, IconShield, IconArrowRight } from '../common/Icons';

interface EvidenceDrawerProps {
  response: AskQueryResponse | null;
  onClose: () => void;
}

export function EvidenceDrawer({ response, onClose }: EvidenceDrawerProps) {
  if (!response) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#ffffff] shadow-xl border-l border-[#ded9ce] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#e6e1d6] bg-[#faf8f4] flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-[#1c2128]">
            Retrieval and Grounding Audit
          </h3>
          <p className="text-[11px] text-[#636c77]">
            Processed in {response.processingTimeMs}ms • Engine: {response.modelUsed}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-[4px] text-[#6d7581] hover:text-[#1c2128] hover:bg-[#eae5db] transition-colors cursor-pointer"
        >
          <IconClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* Investigated Query */}
        <div className="p-3.5 rounded-[5px] bg-[#faf8f4] border border-[#e6e1d6] space-y-1.5">
          <div className="text-[10px] text-[#68717d] uppercase font-semibold tracking-wider">
            Investigated Question
          </div>
          <div className="text-xs font-semibold text-[#1c2128]">
            "{response.question}"
          </div>
          <div className="text-[11px] text-[#555d67] pt-1">
            Mode: <span className="font-mono">{response.retrievalMode}</span> • Confidence: <span className="font-semibold text-[#1f5f54]">{response.confidence.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Traversed Graph Relationships */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1c2128] flex items-center gap-1.5">
            <IconGraph className="w-3.5 h-3.5 text-[#1f5f54]" />
            <span>Traversed Knowledge Graph Edges ({response.traversedRelationships.length})</span>
          </div>

          {response.traversedRelationships.length === 0 ? (
            <div className="p-3 rounded-[5px] bg-[#faf8f4] border border-[#e6e1d6] text-[#68717d] text-[11px] italic">
              No direct knowledge graph edges were traversed for this query.
            </div>
          ) : (
            <div className="space-y-2">
              {response.traversedRelationships.map((rel) => (
                <div
                  key={rel.id}
                  className="p-3 rounded-[5px] bg-[#faf8f4] border border-[#e6e1d6] space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium text-[#1c2128]">
                    <span>{rel.sourceEntityName}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#ebe6db] text-[#343b44]">
                      {rel.type}
                    </span>
                    <IconArrowRight className="w-3 h-3 text-[#7d8793]" />
                    <span>{rel.targetEntityName}</span>
                  </div>
                  <blockquote className="text-[11px] text-[#485059] italic bg-[#ffffff] p-2 rounded-[3px] border border-[#e8e4da]">
                    "{rel.snippet}"
                  </blockquote>
                  <div className="text-[10px] text-[#6e7784] font-mono">
                    Source: {rel.documentName} • Chunk: {rel.sourceChunkId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Retrieved Chunks with Scores */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1c2128] flex items-center gap-1.5">
            <IconDocument className="w-3.5 h-3.5 text-[#1f5f54]" />
            <span>Retrieved Chunks with Similarity Scores ({response.retrievedChunks.length})</span>
          </div>

          <div className="space-y-2.5">
            {response.retrievedChunks.map(({ chunk, score }, idx) => (
              <div
                key={chunk.id}
                className="p-3 rounded-[5px] bg-[#ffffff] border border-[#e4dfd3] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="font-medium text-[#1c2128]">
                    #{idx + 1} {chunk.documentName}
                  </div>
                  <span className="font-mono text-[11px] text-[#1f5f54] font-semibold">
                    {(score * 100).toFixed(1)}% match
                  </span>
                </div>
                <div className="text-[11px] text-[#636c78]">
                  {chunk.pageOrSection}
                </div>
                <div className="p-2.5 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] font-code text-[11px] text-[#343b44] leading-relaxed whitespace-pre-wrap">
                  {chunk.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#e6e1d6] bg-[#faf8f4] flex justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-[4px] bg-[#22272e] text-white text-xs font-medium hover:bg-[#15191e] transition-colors cursor-pointer"
        >
          Close audit
        </button>
      </div>
    </div>
  );
}
