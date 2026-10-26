import React, { useState, useEffect } from 'react';
import { Sidebar, PageTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { DocumentsView } from './components/documents/DocumentsView';
import { KnowledgeGraphView } from './components/graph/KnowledgeGraphView';
import { AskCrosslinkView } from './components/chat/AskCrosslinkView';
import { EvidenceExplorerView } from './components/evidence/EvidenceExplorerView';
import { SettingsView } from './components/settings/SettingsView';
import { PrivacyModal } from './components/common/PrivacyModal';
import { FloatingAssistantDrawer } from './components/assistant/FloatingAssistantDrawer';
import { ServerStatusResponse, DocumentItem, EntityItem } from './types/rag';

export default function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('dashboard');
  const [status, setStatus] = useState<ServerStatusResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string>('');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  // Floating assistant state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedEntityContext, setSelectedEntityContext] = useState<EntityItem | null>(null);
  const [currentDocumentContext, setCurrentDocumentContext] = useState<DocumentItem | null>(null);

  const fetchStatusAndDocs = async () => {
    try {
      const [statusRes, docsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/documents'),
      ]);
      const statusData = await statusRes.json();
      const docsData = await docsRes.json();
      setStatus(statusData);
      setDocuments(docsData || []);
    } catch (err) {
      console.warn('Status/docs fetch note:', err);
    }
  };

  useEffect(() => {
    fetchStatusAndDocs();
    const interval = setInterval(fetchStatusAndDocs, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (res.ok) {
        await fetchStatusAndDocs();
      }
    } catch (err) {
      console.error('Failed to reset demo dataset:', err);
    }
  };

  const handleAskQuestion = (question: string) => {
    setPendingQuestion(question);
    setActiveTab('ask');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fbfaf7] text-[#1e2329] font-sans antialiased">
      {/* Editorial Warm Stone Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        onResetDemo={handleResetDemo}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
      />

      {/* Main Research Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#fbfaf7]">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          status={status}
          onOpenUpload={() => setActiveTab('documents')}
        />

        {/* Workspace Tab View */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeTab === 'dashboard' && (
            <DashboardView
              status={status}
              setActiveTab={setActiveTab}
              onAskQuestion={handleAskQuestion}
              onResetDemo={handleResetDemo}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView onRefreshStatus={fetchStatusAndDocs} />
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraphView
              onAskQuestionAboutEntity={(entName) => {
                const found = status ? { id: entName, name: entName, type: 'Concept' as any, mentionCount: 1, chunkIds: [] } : null;
                setSelectedEntityContext(found);
                setIsAssistantOpen(true);
              }}
            />
          )}

          {activeTab === 'ask' && (
            <AskCrosslinkView
              initialQuestion={pendingQuestion}
              documents={documents}
              selectedEntity={selectedEntityContext}
            />
          )}

          {activeTab === 'evidence' && <EvidenceExplorerView />}

          {activeTab === 'settings' && (
            <SettingsView
              status={status}
              onResetDemo={handleResetDemo}
              onRefreshStatus={fetchStatusAndDocs}
              onOpenPrivacy={() => setIsPrivacyOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Floating Crosslink AI Assistant Drawer */}
      <FloatingAssistantDrawer
        isOpen={isAssistantOpen}
        onToggle={() => setIsAssistantOpen(!isAssistantOpen)}
        onOpenFullPage={() => {
          setIsAssistantOpen(false);
          setActiveTab('ask');
        }}
        documents={documents}
        selectedEntityContext={selectedEntityContext}
        currentDocumentContext={currentDocumentContext}
      />

      {/* Privacy & Research Terms Modal */}
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
    </div>
  );
}
