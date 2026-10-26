import React, { useState, useEffect, useRef } from 'react';
import { DocumentItem } from '../../types/rag';
import { StatusBadge } from '../common/Badge';
import { ChunkInspectorModal } from './ChunkInspectorModal';
import {
  IconUpload,
  IconDocument,
  IconTrash,
} from '../common/Icons';

interface DocumentsViewProps {
  onRefreshStatus?: () => void;
}

export function DocumentsView({ onRefreshStatus }: DocumentsViewProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectingDoc, setInspectingDoc] = useState<DocumentItem | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [pasteMode, setPasteMode] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (file: File) => {
    const validExtensions = ['.pdf', '.txt', '.md', '.json'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setUploadError('Unsupported file type. Please upload a PDF, TXT, or Markdown file.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File size exceeds the 20MB limit.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Content = result.split(',')[1] || result;

          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              fileType: file.type,
              base64Content,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to process document');
          }

          setUploadSuccess(
            `Indexed "${file.name}": created ${data.chunksCreated} chunks and extracted ${data.entitiesExtracted} entities into the knowledge graph.`
          );
          fetchDocuments();
          if (onRefreshStatus) onRefreshStatus();
        } catch (err) {
          setUploadError((err as Error).message);
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Failed to read file from disk.');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setUploadError((err as Error).message);
      setIsUploading(false);
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteTitle.trim() || !pasteContent.trim()) {
      setUploadError('Please provide both document title and text content.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const filename = pasteTitle.endsWith('.md') || pasteTitle.endsWith('.txt') ? pasteTitle : `${pasteTitle}.md`;
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          fileType: 'text/markdown',
          rawText: pasteContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process text');
      }

      setUploadSuccess(`Indexed "${filename}": ${data.chunksCreated} chunks created.`);
      setPasteTitle('');
      setPasteContent('');
      setPasteMode(false);
      fetchDocuments();
      if (onRefreshStatus) onRefreshStatus();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}"? This will remove its chunks and unreferenced knowledge graph edges.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocuments();
        if (onRefreshStatus) onRefreshStatus();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl">
      {/* Upload Box */}
      <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#1c2128]">
              Document Ingestion
            </h2>
            <p className="text-[11px] text-[#555d67]">
              Upload PDF, TXT, or Markdown research documents to parse text chunks and map knowledge graph relations.
            </p>
          </div>
          <button
            onClick={() => setPasteMode(!pasteMode)}
            className="text-[11px] font-medium text-[#1f5f54] hover:underline cursor-pointer"
          >
            {pasteMode ? 'Hide text editor' : 'Paste raw text or notes'}
          </button>
        </div>

        {/* Dropzone */}
        {!pasteMode && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[5px] p-6 text-center transition-colors cursor-pointer ${
              dragActive
                ? 'border-[#1f5f54] bg-[#f0f6f4]'
                : 'border-[#dcd6c8] hover:border-[#1f5f54] bg-[#faf8f4]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="w-8 h-8 rounded-[4px] bg-[#edf3f1] text-[#1f5f54] flex items-center justify-center mx-auto mb-2">
              <IconUpload className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-[#1c2128]">
              {isUploading ? 'Chunking text and extracting graph connections...' : 'Click to select or drag and drop document'}
            </div>
            <p className="text-[11px] text-[#636c78] mt-0.5">
              Supports PDF, TXT, and Markdown (.md) up to 20MB
            </p>
          </div>
        )}

        {/* Direct Text Form */}
        {pasteMode && (
          <form onSubmit={handlePasteSubmit} className="space-y-3 bg-[#faf8f4] p-3.5 rounded-[5px] border border-[#e4ded2]">
            <div>
              <label className="block text-[11px] font-semibold text-[#1c2128] mb-1">
                Document title
              </label>
              <input
                type="text"
                placeholder="e.g. Clinical_Study_Notes.md"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-[#ffffff] border border-[#d6d0c2] rounded-[4px] focus:outline-none focus:border-[#1f5f54] text-[#1c2128]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#1c2128] mb-1">
                Text content (Markdown or Plain Text)
              </label>
              <textarea
                rows={5}
                placeholder="Paste research text here. Headers (#) and paragraphs will be parsed into indexed chunks..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                className="w-full text-xs font-code px-2.5 py-1.5 bg-[#ffffff] border border-[#d6d0c2] rounded-[4px] focus:outline-none focus:border-[#1f5f54] text-[#1c2128]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteMode(false)}
                className="px-3 py-1 rounded-[4px] border border-[#d6d0c2] text-xs text-[#485059] hover:bg-[#eae5dc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !pasteTitle.trim() || !pasteContent.trim()}
                className="px-3 py-1 rounded-[4px] bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white text-xs font-medium cursor-pointer"
              >
                {isUploading ? 'Indexing...' : 'Index text'}
              </button>
            </div>
          </form>
        )}

        {/* Feedback messages */}
        {uploadError && (
          <div className="p-3 rounded-[4px] bg-[#fbf0f0] border border-[#edd5d5] text-[#8e2929] text-xs">
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="p-3 rounded-[4px] bg-[#eef5f2] border border-[#cfe2db] text-[#1c5d4f] text-xs">
            {uploadSuccess}
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e9e4da] flex items-center justify-between bg-[#faf8f4]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1c2128]">
            <IconDocument className="w-3.5 h-3.5 text-[#636c77]" />
            <span>Indexed Documents ({documents.length})</span>
          </div>
          <span className="text-[11px] text-[#6e7784]">
            {documents.reduce((acc, d) => acc + d.chunkCount, 0)} total chunks
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#6e7784]">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#7f8895]">
            No documents indexed yet.
          </div>
        ) : (
          <div className="divide-y divide-[#f0ece3]">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[#faf8f4] transition-colors text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1c2128] truncate">
                      {doc.name}
                    </span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#f0ece3] text-[#555d68]">
                      {doc.type}
                    </span>
                    {doc.isDemo && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f0ece3] text-[#5c6471]">
                        Sample
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#69727f] flex items-center gap-2">
                    <span>{(doc.size / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>{doc.chunkCount} chunks</span>
                    <span>•</span>
                    <span>{doc.entityCount} entities</span>
                    <span>•</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={doc.status} />

                  <button
                    onClick={() => setInspectingDoc(doc)}
                    className="text-[11px] text-[#1f5f54] hover:underline cursor-pointer font-medium"
                  >
                    Inspect chunks
                  </button>

                  <button
                    onClick={() => handleDelete(doc.id, doc.name)}
                    className="p-1 rounded text-[#7f8895] hover:text-[#9c2d2d] transition-colors cursor-pointer"
                    title="Delete document"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inspectingDoc && (
        <ChunkInspectorModal
          document={inspectingDoc}
          onClose={() => setInspectingDoc(null)}
        />
      )}
    </div>
  );
}
