import React from 'react';
import {
  IconWorkspace,
  IconDocument,
  IconGraph,
  IconChat,
  IconAudit,
  IconSettings,
  IconShield,
} from '../common/Icons';
import { ServerStatusResponse } from '../../types/rag';

export type PageTab = 'dashboard' | 'documents' | 'graph' | 'ask' | 'evidence' | 'settings';

interface SidebarProps {
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
  status: ServerStatusResponse | null;
  onResetDemo: () => void;
  onOpenPrivacy: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  status,
  onResetDemo,
  onOpenPrivacy,
}: SidebarProps) {
  const navItems = [
    {
      id: 'dashboard' as PageTab,
      label: 'Workspace',
      icon: IconWorkspace,
    },
    {
      id: 'documents' as PageTab,
      label: 'Documents',
      icon: IconDocument,
      count: status?.documentsCount ?? null,
    },
    {
      id: 'graph' as PageTab,
      label: 'Knowledge Graph',
      icon: IconGraph,
      count: status?.entitiesCount ?? null,
    },
    {
      id: 'ask' as PageTab,
      label: 'Ask Questions',
      icon: IconChat,
    },
    {
      id: 'evidence' as PageTab,
      label: 'Evidence Audit',
      icon: IconAudit,
    },
    {
      id: 'settings' as PageTab,
      label: 'Settings & Privacy',
      icon: IconSettings,
    },
  ];

  return (
    <aside className="w-60 bg-[#f4f1ea] border-r border-[#e4e0d6] flex flex-col justify-between shrink-0 select-none text-[#23272e]">
      <div>
        {/* Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-[#e4e0d6] gap-2.5">
          <div className="w-6 h-6 rounded-[5px] bg-[#1f5f54] text-white flex items-center justify-center font-serif-title font-semibold text-xs tracking-tight">
            C
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm text-[#1b2026] tracking-tight">
              Crosslink
            </div>
            <div className="text-[11px] text-[#69727d]">
              Knowledge Graph RAG
            </div>
          </div>
        </div>

        {/* Dataset indicator */}
        <div className="p-3 mx-3 mt-3 rounded-[6px] bg-[#ebe7dc] border border-[#ded8cb] text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#555e69]">
            <span className="font-medium">Active repository</span>
            <span
              className={`px-1.5 py-0.2 rounded-[3px] text-[10px] font-medium ${
                status?.hasUserData
                  ? 'bg-[#e2ede8] text-[#1c5d4f]'
                  : 'bg-[#e3dfd4] text-[#4d5560]'
              }`}
            >
              {status?.hasUserData ? 'Custom files' : 'Sample study'}
            </span>
          </div>
          <div className="text-[11px] text-[#3d444d] leading-snug">
            {status?.hasUserData
              ? `${status.documentsCount} document${status.documentsCount === 1 ? '' : 's'} indexed.`
              : 'Biotech and neurology case study (ApexBio & Vance).'}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[5px] text-xs transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#e8f1ee] text-[#164e43] font-semibold border border-[#cde0d8]'
                    : 'text-[#485059] hover:text-[#1c2127] hover:bg-[#ebe7dc]/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#164e43]' : 'text-[#6c7682]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== null && item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-[3px] font-mono ${
                      isActive ? 'bg-[#d8e8e2] text-[#164e43]' : 'bg-[#e4dfd3] text-[#69727d]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[#e4e0d6] space-y-2 bg-[#efece4]/50">
        <button
          onClick={onResetDemo}
          className="w-full py-1.5 px-2.5 rounded-[5px] border border-[#dcd6c8] hover:border-[#cbcaa0] bg-[#faf8f4] hover:bg-white text-[#414852] text-xs font-medium text-left transition-colors cursor-pointer"
        >
          Reset sample study
        </button>

        <div className="flex items-center justify-between text-[11px] text-[#717b86] pt-1 px-1">
          <button
            onClick={onOpenPrivacy}
            className="hover:text-[#1b2026] underline transition-colors cursor-pointer"
          >
            Privacy & Terms
          </button>
          <span className="font-mono text-[10px] text-[#86909b]">v1.2</span>
        </div>
      </div>
    </aside>
  );
}
