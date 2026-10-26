import React from 'react';
import { IconClose, IconShield } from './Icons';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c2128]/50 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#ffffff] rounded-[6px] shadow-lg border border-[#d8d2c4] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#e6e1d6] flex items-center justify-between bg-[#faf8f4]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1c2128]">
            <IconShield className="w-4 h-4 text-[#1f5f54]" />
            <span>Privacy Policy & Research Terms of Service</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#6d7581] hover:text-[#1c2128] hover:bg-[#eae5db] transition-colors cursor-pointer"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 leading-relaxed text-[#353d47]">
          <div>
            <h4 className="font-semibold text-xs text-[#1c2128] mb-1">
              1. Research Data Ownership & Intellectual Property
            </h4>
            <p>
              You retain sole intellectual property ownership over all documents, academic papers, notes, datasets, and knowledge graphs you upload to or generate within Crosslink. Crosslink does not claim any copyright, license, or proprietary interest in your research materials.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#1c2128] mb-1">
              2. Data Storage & Local Persistence
            </h4>
            <p>
              Documents are processed directly by the backend container application and stored in a private local persistent database. Uploaded files, chunk vectors, and knowledge graph edges remain strictly within your environment and are never shared with external aggregators or third parties.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#1c2128] mb-1">
              3. AI Processing & Gemini Model Interaction
            </h4>
            <p>
              When enabled, server-side inference requests (entity extraction and grounded multi-hop retrieval) are transmitted via encrypted HTTPS directly to the Google Gemini API using server-held credentials. Your research files are never exposed to browser clients, and uploaded document contents are treated strictly as reference data, never as system instructions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#1c2128] mb-1">
              4. Evidence Grounding & Zero-Hallucination Standard
            </h4>
            <p>
              Crosslink is engineered for academic and technical research. When retrieved document passages and graph connections do not provide sufficient evidence to answer an inquiry, the system explicitly reports insufficient evidence rather than guessing or interpolating unverified assertions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#1c2128] mb-1">
              5. Data Purging & Deletion
            </h4>
            <p>
              Deleting any document from the Documents view instantly purges the file, all associated text chunk segments, and any knowledge graph relationships solely derived from that document from the database.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#e6e1d6] bg-[#faf8f4] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[4px] bg-[#1f5f54] text-white text-xs font-medium hover:bg-[#164840] transition-colors cursor-pointer"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}
