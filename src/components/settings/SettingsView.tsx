import React, { useState, useEffect } from 'react';
import { AppSettings, ServerStatusResponse } from '../../types/rag';
import { IconShield, IconSettings } from '../common/Icons';

interface SettingsViewProps {
  status: ServerStatusResponse | null;
  onResetDemo: () => void;
  onRefreshStatus: () => void;
  onOpenPrivacy: () => void;
}

export function SettingsView({
  status,
  onResetDemo,
  onRefreshStatus,
  onOpenPrivacy,
}: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>({
    retrievalMode: 'hybrid',
    topKChunks: 4,
    graphMaxHops: 2,
    minSimilarityScore: 0.15,
    chunkSize: 450,
    chunkOverlap: 50,
    modelName: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data) setSettings(data);
      } catch (err) {
        console.warn('Failed to load settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        onRefreshStatus();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const [docsRes, graphRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/graph'),
      ]);
      const docs = await docsRes.json();
      const graph = await graphRes.json();
      const exportBlob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              system: 'Crosslink: Knowledge Graph Research Assistant',
              documents: docs,
              graph,
            },
            null,
            2
          ),
        ],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crosslink_research_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Model Status Card */}
        <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-[#1c2128]">
                AI Engine and Credentials
              </h2>
              <p className="text-[11px] text-[#555d67]">
                Server-side model configuration. Credentials are held in the server environment without client exposure.
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${
                status?.geminiConfigured
                  ? 'bg-[#eef5f2] text-[#1c5d4f] border-[#cfe2db]'
                  : 'bg-[#faf3e8] text-[#7a5a22] border-[#ebdcc4]'
              }`}
            >
              {status?.geminiConfigured
                ? `${status.model || 'Gemini 3.5 Flash Lite'} active`
                : 'Local factual engine'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] space-y-0.5">
              <span className="text-[10px] text-[#636c78] uppercase font-semibold">
                Reasoning and Extraction Model
              </span>
              <div className="font-mono text-xs font-semibold text-[#1c2128]">
                {settings.modelName}
              </div>
            </div>

            <div className="p-3 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] space-y-0.5">
              <span className="text-[10px] text-[#636c78] uppercase font-semibold">
                Vector Embedding Model
              </span>
              <div className="font-mono text-xs font-semibold text-[#1c2128]">
                {settings.embeddingModel}
              </div>
            </div>
          </div>
        </div>

        {/* Retrieval Parameters */}
        <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#1c2128]">
              Retrieval Configuration
            </h2>
            <p className="text-[11px] text-[#555d67]">
              Tune candidate chunk volume, graph traversal depth, and minimum match thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            {/* Mode */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#1c2128]">
                Default retrieval mode
              </label>
              <select
                value={settings.retrievalMode}
                onChange={(e) =>
                  setSettings({ ...settings, retrievalMode: e.target.value as any })
                }
                className="w-full text-xs bg-[#faf8f4] border border-[#d6d0c2] rounded-[4px] px-2.5 py-1.5 text-[#1c2128] focus:outline-none focus:border-[#1f5f54]"
              >
                <option value="hybrid">Hybrid (Vector search + Knowledge graph)</option>
                <option value="vector_only">Vector search only</option>
                <option value="graph_only">Knowledge graph traversal only</option>
              </select>
            </div>

            {/* Top-K Chunks */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-[#1c2128]">Candidate chunks count</span>
                <span className="font-mono text-[#1f5f54] font-semibold">{settings.topKChunks} chunks</span>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                value={settings.topKChunks}
                onChange={(e) =>
                  setSettings({ ...settings, topKChunks: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#1f5f54]"
              />
            </div>

            {/* Max Hops */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-[#1c2128]">Knowledge graph traversal depth</span>
                <span className="font-mono text-[#1f5f54] font-semibold">{settings.graphMaxHops} hops</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                value={settings.graphMaxHops}
                onChange={(e) =>
                  setSettings({ ...settings, graphMaxHops: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#1f5f54]"
              />
            </div>

            {/* Min Similarity Threshold */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-[#1c2128]">Minimum similarity threshold</span>
                <span className="font-mono text-[#1f5f54] font-semibold">
                  {(settings.minSimilarityScore * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.05}
                value={settings.minSimilarityScore}
                onChange={(e) =>
                  setSettings({ ...settings, minSimilarityScore: parseFloat(e.target.value) })
                }
                className="w-full accent-[#1f5f54]"
              />
            </div>
          </div>
        </div>

        {/* Chunking Parameters */}
        <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#1c2128]">
              Document Chunking Strategy
            </h2>
            <p className="text-[11px] text-[#555d67]">
              Size of passages extracted when indexing new research documents.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-[#1c2128]">Target chunk size</span>
                <span className="font-mono text-[#1c2128] font-semibold">{settings.chunkSize} characters</span>
              </div>
              <input
                type="range"
                min={200}
                max={1200}
                step={50}
                value={settings.chunkSize}
                onChange={(e) =>
                  setSettings({ ...settings, chunkSize: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#1f5f54]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-[#1c2128]">Chunk overlap</span>
                <span className="font-mono text-[#1c2128] font-semibold">{settings.chunkOverlap} characters</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={10}
                value={settings.chunkOverlap}
                onChange={(e) =>
                  setSettings({ ...settings, chunkOverlap: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#1f5f54]"
              />
            </div>
          </div>
        </div>

        {/* Data & Privacy Actions */}
        <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#1c2128]">
              Data Ownership and Privacy Policy
            </h2>
            <p className="text-[11px] text-[#555d67]">
              Export repository data, review terms of data handling, or reset to the preloaded sample study.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportData}
              className="px-3 py-1.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#eae5dc] border border-[#d6d0c2] text-xs font-medium text-[#2d343e] transition-colors cursor-pointer"
            >
              Export knowledge base (JSON)
            </button>

            <button
              type="button"
              onClick={onResetDemo}
              className="px-3 py-1.5 rounded-[4px] bg-[#faf8f4] hover:bg-[#eae5dc] border border-[#d6d0c2] text-xs font-medium text-[#2d343e] transition-colors cursor-pointer"
            >
              Reset to sample biotech study
            </button>

            <button
              type="button"
              onClick={onOpenPrivacy}
              className="px-3 py-1.5 rounded-[4px] text-[#1f5f54] text-xs font-medium hover:underline cursor-pointer"
            >
              Read research privacy terms
            </button>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-1">
          {saveSuccess ? (
            <span className="text-xs text-[#1c5d4f] font-medium">
              Settings saved successfully.
            </span>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-[4px] bg-[#1f5f54] hover:bg-[#164840] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
