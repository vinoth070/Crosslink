import React, { useEffect, useState } from 'react';
import { ChunkItem, DocumentItem } from '../../types/rag';
import { IconClose, IconSearch, IconDocument } from '../common/Icons';

interface ChunkInspectorModalProps {
  document: DocumentItem | null;
  onClose: () => void;
}

export function ChunkInspectorModal({ document, onClose }: ChunkInspectorModalProps) {
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!document) return;
    const fetchChunks = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/documents/${document.id}/chunks`);
        const data = await res.json();
        setChunks(data || []);
      } catch (err) {
        console.error('Failed to load chunks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChunks();
  }, [document]);

  if (!document) return null;

  const filteredChunks = chunks.filter(
    (c) =>
      c.text.toLowerCase().includes(search.toLowerCase()) ||
      c.pageOrSection.toLowerCase().includes(search.toLowerCase())
  );

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2128]/50 p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#ffffff] rounded-[6px] shadow-lg border border-[#d8d2c4] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#e6e1d6] flex items-center justify-between bg-[#faf8f4]">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#1c2128] flex items-center gap-2">
              <span>Chunk Inspector:</span>
              <span className="font-mono text-[#1f5f54] text-xs">{document.name}</span>
            </h2>
            <p className="text-[11px] text-[#636c78]">
              {chunks.length} chunks • {(document.size / 1024).toFixed(1)} KB • Status: {document.status}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#6e7784] hover:text-[#1c2128] hover:bg-[#eae5db] transition-colors cursor-pointer"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Search inside chunks */}
        <div className="px-5 py-2.5 border-b border-[#e6e1d6] bg-[#ffffff] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <IconSearch className="w-3.5 h-3.5 text-[#7f8895] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search in chunks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#faf8f4] border border-[#dcd6c8] rounded-[4px] focus:outline-none focus:border-[#1f5f54] text-[#1c2128]"
            />
          </div>
          <span className="text-[11px] text-[#6e7784] font-mono">
            {filteredChunks.length} of {chunks.length} chunks
          </span>
        </div>

        {/* Chunks List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#faf8f4]">
          {loading ? (
            <div className="py-10 text-center text-xs text-[#6e7784]">
              Loading text chunks...
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7f8895]">
              No chunks match your search query.
            </div>
          ) : (
            filteredChunks.map((chunk) => (
              <div
                key={chunk.id}
                className="p-3.5 rounded-[5px] bg-[#ffffff] border border-[#e4dfd3] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded-[3px] bg-[#f0ece3] text-[#4d5561] font-mono text-[10px] font-semibold">
                      #{chunk.chunkIndex + 1}
                    </span>
                    <span className="font-medium text-[#1c2128]">
                      {chunk.pageOrSection || 'General Section'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#7a8491]">ID: {chunk.id}</span>
                    <button
                      onClick={() => copyToClipboard(chunk.text, chunk.id)}
                      className="text-[11px] text-[#1f5f54] hover:underline cursor-pointer"
                    >
                      {copiedId === chunk.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] font-code text-[11px] text-[#2c333d] leading-relaxed whitespace-pre-wrap">
                  {chunk.text}
                </div>

                {chunk.entityIds && chunk.entityIds.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-[#717b87]">Linked entities:</span>
                    {chunk.entityIds.map((entId) => (
                      <span
                        key={entId}
                        className="px-1.5 py-0.2 rounded-[3px] text-[10px] font-mono bg-[#edf3f1] text-[#1b5e52] border border-[#cbe0da]"
                      >
                        {entId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#e6e1d6] bg-[#faf8f4] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[4px] bg-[#22272e] text-white text-xs font-medium hover:bg-[#14181c] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
