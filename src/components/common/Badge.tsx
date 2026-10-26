import React from 'react';
import { EntityType } from '../../types/rag';

export function EntityTypeBadge({ type }: { type: EntityType | string }) {
  const colorMap: Record<string, string> = {
    Person: 'bg-[#edf3f1] text-[#1b5e52] border-[#cbe0da]',
    Organization: 'bg-[#f2efe9] text-[#4a473f] border-[#dfdad0]',
    Technology: 'bg-[#edf2f7] text-[#2c4c6e] border-[#ccd8e5]',
    Condition: 'bg-[#f8ede8] text-[#8c3c2b] border-[#ebd0c7]',
    Location: 'bg-[#eef4ed] text-[#2f5c35] border-[#cbe0ce]',
    Product: 'bg-[#f7f2ea] text-[#715423] border-[#e8dcc7]',
    ClinicalTrial: 'bg-[#f0edf7] text-[#4d3d70] border-[#d8d0eb]',
    Concept: 'bg-[#f3f1ec] text-[#4c525a] border-[#dedad1]',
  };

  const style = colorMap[type] || 'bg-[#f3f1ec] text-[#4c525a] border-[#dedad1]';

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium border ${style}`}
    >
      {type}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'indexed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#eef5f2] text-[#1f5f54] border border-[#cfe2db]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1f5f54]"></span>
          Indexed
        </span>
      );
    case 'extracting':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#f5f1e8] text-[#7a5a22] border border-[#e5dccb]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9c742c] animate-pulse"></span>
          Extracting graph
        </span>
      );
    case 'chunking':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#eef1f6] text-[#345179] border border-[#d2dce9]">
          Chunking text
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#faeded] text-[#9c2d2d] border border-[#edd1d1]">
          Processing error
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#f4f1ea] text-[#555d67] border border-[#e2ded4]">
          {status}
        </span>
      );
  }
}
