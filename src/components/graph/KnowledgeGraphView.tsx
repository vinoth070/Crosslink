import React, { useState, useEffect } from 'react';
import { EntityItem, RelationshipItem, EntityType } from '../../types/rag';
import { GraphCanvas } from './GraphCanvas';
import { EntityTypeBadge } from '../common/Badge';
import { IconSearch, IconArrowRight, IconClose, IconChat, IconDocument } from '../common/Icons';

interface KnowledgeGraphViewProps {
  onAskQuestionAboutEntity?: (entityName: string) => void;
}

export function KnowledgeGraphView({ onAskQuestionAboutEntity }: KnowledgeGraphViewProps) {
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [relationships, setRelationships] = useState<RelationshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');

  const [selectedEntity, setSelectedEntity] = useState<EntityItem | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<RelationshipItem | null>(null);

  // Path finder
  const [pathSourceId, setPathSourceId] = useState<string>('');
  const [pathTargetId, setPathTargetId] = useState<string>('');
  const [highlightedEntityIds, setHighlightedEntityIds] = useState<string[]>([]);
  const [highlightedRelationshipIds, setHighlightedRelationshipIds] = useState<string[]>([]);
  const [pathResult, setPathResult] = useState<{
    found: boolean;
    hopCount?: number;
    message?: string;
    nodes?: EntityItem[];
    edges?: RelationshipItem[];
  } | null>(null);
  const [findingPath, setFindingPath] = useState(false);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/graph', window.location.origin);
      if (selectedType !== 'All') url.searchParams.set('type', selectedType);
      if (searchQuery.trim()) url.searchParams.set('q', searchQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      setEntities(data.nodes || []);
      setRelationships(data.edges || []);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [selectedType, searchQuery]);

  const handleFindPath = async () => {
    if (!pathSourceId || !pathTargetId) return;
    try {
      setFindingPath(true);
      const res = await fetch(
        `/api/graph/path?sourceId=${encodeURIComponent(pathSourceId)}&targetId=${encodeURIComponent(
          pathTargetId
        )}`
      );
      const data = await res.json();
      setPathResult(data);
      if (data.found && data.nodes && data.edges) {
        setHighlightedEntityIds(data.nodes.map((n: EntityItem) => n.id));
        setHighlightedRelationshipIds(data.edges.map((e: RelationshipItem) => e.id));
      } else {
        setHighlightedEntityIds([]);
        setHighlightedRelationshipIds([]);
      }
    } catch (err) {
      console.error('Failed to compute path:', err);
    } finally {
      setFindingPath(false);
    }
  };

  const clearPath = () => {
    setPathSourceId('');
    setPathTargetId('');
    setPathResult(null);
    setHighlightedEntityIds([]);
    setHighlightedRelationshipIds([]);
  };

  const entityTypes: (EntityType | 'All')[] = [
    'All',
    'Person',
    'Organization',
    'Technology',
    'Product',
    'Condition',
    'Location',
    'ClinicalTrial',
  ];

  return (
    <div className="flex h-full bg-[#fbfaf7] overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
        {/* Controls Bar */}
        <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <IconSearch className="w-3.5 h-3.5 text-[#7f8894] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search entity by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#faf8f4] border border-[#dcd6c8] rounded-[5px] focus:outline-none focus:border-[#1f5f54] text-[#1e2329]"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {entityTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2 py-1 rounded-[4px] text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedType === type
                    ? 'bg-[#1f5f54] text-white'
                    : 'bg-[#f4f1ea] text-[#4d5661] hover:bg-[#eae6db]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Multi-Hop Path Finder */}
          <div className="flex items-center gap-1.5 bg-[#faf8f4] border border-[#dcd6c8] px-2.5 py-1 rounded-[5px] text-xs">
            <span className="text-[11px] font-medium text-[#505965]">Trace path:</span>
            <select
              value={pathSourceId}
              onChange={(e) => setPathSourceId(e.target.value)}
              className="text-xs bg-[#ffffff] border border-[#d6d0c2] rounded-[4px] px-2 py-0.5 focus:outline-none text-[#23272e]"
            >
              <option value="">Start node...</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <span className="text-[#88919d]">to</span>
            <select
              value={pathTargetId}
              onChange={(e) => setPathTargetId(e.target.value)}
              className="text-xs bg-[#ffffff] border border-[#d6d0c2] rounded-[4px] px-2 py-0.5 focus:outline-none text-[#23272e]"
            >
              <option value="">Target node...</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleFindPath}
              disabled={!pathSourceId || !pathTargetId || findingPath}
              className="px-2.5 py-0.5 rounded-[4px] bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              {findingPath ? 'Tracing...' : 'Trace'}
            </button>
            {(pathResult || highlightedEntityIds.length > 0) && (
              <button
                onClick={clearPath}
                className="p-1 text-[#7a838f] hover:text-[#21262d]"
                title="Clear trace"
              >
                <IconClose className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Path result banner if found */}
        {pathResult && (
          <div
            className={`px-3 py-2 rounded-[5px] text-xs flex items-center justify-between border ${
              pathResult.found
                ? 'bg-[#eef5f2] text-[#1c5d4f] border-[#cfe2db]'
                : 'bg-[#faf3e8] text-[#7a5a22] border-[#ebdcc4]'
            }`}
          >
            <div className="flex items-center gap-2">
              {pathResult.found ? (
                <span>
                  <strong>Knowledge path ({pathResult.hopCount} hops):</strong>{' '}
                  {pathResult.nodes?.map((n) => n.name).join(' -> ')}
                </span>
              ) : (
                <span>{pathResult.message || 'No direct path found within 5 hops'}</span>
              )}
            </div>
            <button
              onClick={clearPath}
              className="text-[11px] font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Force Simulation Canvas */}
        <div className="flex-1 relative min-h-0">
          <GraphCanvas
            entities={entities}
            relationships={relationships}
            selectedEntity={selectedEntity}
            selectedRelationship={selectedRelationship}
            onSelectEntity={(ent) => {
              setSelectedEntity(ent);
              setSelectedRelationship(null);
            }}
            onSelectRelationship={(rel) => {
              setSelectedRelationship(rel);
              setSelectedEntity(null);
            }}
            highlightedEntityIds={highlightedEntityIds}
            highlightedRelationshipIds={highlightedRelationshipIds}
          />
        </div>
      </div>

      {/* Slide-Over Provenance and Inspection Drawer */}
      {(selectedEntity || selectedRelationship) && (
        <div className="w-80 bg-[#ffffff] border-l border-[#e4dfd3] flex flex-col shrink-0 overflow-y-auto">
          {/* Drawer Header */}
          <div className="p-4 border-b border-[#e9e4da] flex items-center justify-between bg-[#faf8f4]">
            <h3 className="text-xs font-semibold text-[#1c2128]">
              {selectedEntity ? 'Entity Details' : 'Relationship Provenance'}
            </h3>
            <button
              onClick={() => {
                setSelectedEntity(null);
                setSelectedRelationship(null);
              }}
              className="p-1 rounded-[4px] text-[#6e7783] hover:text-[#1c2128] hover:bg-[#eae5db] transition-colors"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Selected Entity Details */}
          {selectedEntity && (
            <div className="p-4 space-y-4 text-xs">
              <div>
                <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider mb-1">
                  Entity
                </div>
                <div className="text-sm font-semibold text-[#1c2128]">
                  {selectedEntity.name}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <EntityTypeBadge type={selectedEntity.type} />
                  {selectedEntity.isDemo && (
                    <span className="text-[10px] text-[#68707c] px-1 py-0.2 rounded bg-[#f4f1ea] border border-[#ded9ce]">
                      Sample
                    </span>
                  )}
                </div>
              </div>

              {selectedEntity.description && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider">
                    Context
                  </div>
                  <p className="text-[#414852] bg-[#faf8f4] p-2.5 rounded-[5px] border border-[#e8e3d8] leading-relaxed">
                    {selectedEntity.description}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider">
                  Mentions
                </div>
                <div className="p-2.5 rounded-[5px] bg-[#faf8f4] border border-[#e8e3d8] text-[11px] text-[#4f5763] space-y-1">
                  <div className="flex justify-between">
                    <span>Text occurrences:</span>
                    <span className="font-semibold text-[#1c2128]">{selectedEntity.mentionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source chunks:</span>
                    <span className="font-mono text-[#1f5f54]">
                      {selectedEntity.chunkIds?.length || 0} referenced
                    </span>
                  </div>
                </div>
              </div>

              {/* Connected relationships list */}
              <div className="space-y-2">
                <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider">
                  Connected Relationships
                </div>
                <div className="space-y-1.5">
                  {relationships
                    .filter(
                      (r) =>
                        r.sourceEntityId === selectedEntity.id ||
                        r.targetEntityId === selectedEntity.id
                    )
                    .map((rel) => {
                      const isOutgoing = rel.sourceEntityId === selectedEntity.id;
                      return (
                        <div
                          key={rel.id}
                          onClick={() => setSelectedRelationship(rel)}
                          className="p-2 rounded-[5px] border border-[#e4ded2] hover:border-[#1f5f54] hover:bg-[#f7f5ee] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-[#1c2128]">
                            <span>{isOutgoing ? '->' : '<-'}</span>
                            <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-[#ebe6db] text-[#3d4550]">
                              {rel.type}
                            </span>
                            <span className="truncate">
                              {isOutgoing ? rel.targetEntityName : rel.sourceEntityName}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5c6572] italic mt-1 line-clamp-2">
                            "{rel.snippet}"
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>

              {onAskQuestionAboutEntity && (
                <button
                  onClick={() => onAskQuestionAboutEntity(selectedEntity.name)}
                  className="w-full py-2 px-3 rounded-[5px] bg-[#1f5f54] hover:bg-[#164840] text-white font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <IconChat className="w-3.5 h-3.5" />
                  Ask question about this entity
                </button>
              )}
            </div>
          )}

          {/* Selected Relationship Details */}
          {selectedRelationship && (
            <div className="p-4 space-y-4 text-xs">
              <div>
                <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider mb-1">
                  Relationship Type
                </div>
                <div className="font-mono text-xs font-semibold text-[#1f5f54] bg-[#edf3f1] border border-[#cce0d9] px-2 py-1 rounded-[4px] inline-block">
                  {selectedRelationship.type}
                </div>
              </div>

              <div className="p-2.5 rounded-[5px] bg-[#faf8f4] border border-[#e8e3d8] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#646e7b]">Source:</span>
                  <span className="font-semibold text-[#1c2128]">{selectedRelationship.sourceEntityName}</span>
                </div>
                <div className="text-center text-[#9ea8b5] text-[10px]">connected to</div>
                <div className="flex items-center justify-between">
                  <span className="text-[#646e7b]">Target:</span>
                  <span className="font-semibold text-[#1c2128]">{selectedRelationship.targetEntityName}</span>
                </div>
              </div>

              {/* Exact Verbatim Provenance Quote */}
              <div className="space-y-1">
                <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider">
                  Verbatim Source Evidence (Provenance)
                </div>
                <blockquote className="p-3 rounded-[5px] bg-[#faf8f4] border-l-2 border-[#1f5f54] text-[#2c333d] italic leading-relaxed text-[11px]">
                  "{selectedRelationship.snippet}"
                </blockquote>
              </div>

              {/* Document metadata */}
              <div className="space-y-1">
                <div className="text-[10px] text-[#6d7682] uppercase font-semibold tracking-wider">
                  Source Document
                </div>
                <div className="p-2.5 rounded-[5px] bg-[#faf8f4] border border-[#e8e3d8] flex items-center gap-2">
                  <IconDocument className="w-4 h-4 text-[#6e7783]" />
                  <div className="truncate">
                    <div className="font-medium text-[#1c2128] truncate">
                      {selectedRelationship.documentName}
                    </div>
                    <div className="text-[10px] font-mono text-[#76808e]">
                      Chunk: {selectedRelationship.sourceChunkId}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
