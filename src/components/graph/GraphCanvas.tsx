import React, { useEffect, useRef, useState } from 'react';
import * as d3Force from 'd3-force';
import { EntityItem, RelationshipItem, EntityType } from '../../types/rag';

interface SimulationNode extends d3Force.SimulationNodeDatum {
  id: string;
  name: string;
  type: EntityType;
  mentionCount: number;
  isDemo?: boolean;
}

interface SimulationLink extends d3Force.SimulationLinkDatum<SimulationNode> {
  id: string;
  type: string;
  snippet: string;
  documentName: string;
  isDemo?: boolean;
}

interface GraphCanvasProps {
  entities: EntityItem[];
  relationships: RelationshipItem[];
  selectedEntity: EntityItem | null;
  selectedRelationship: RelationshipItem | null;
  onSelectEntity: (entity: EntityItem | null) => void;
  onSelectRelationship: (rel: RelationshipItem | null) => void;
  highlightedEntityIds?: string[];
  highlightedRelationshipIds?: string[];
}

export function GraphCanvas({
  entities,
  relationships,
  selectedEntity,
  selectedRelationship,
  onSelectEntity,
  onSelectRelationship,
  highlightedEntityIds = [],
  highlightedRelationshipIds = [],
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [nodes, setNodes] = useState<SimulationNode[]>([]);
  const [links, setLinks] = useState<SimulationLink[]>([]);
  const simulationRef = useRef<d3Force.Simulation<SimulationNode, SimulationLink> | null>(null);
  const draggedNodeRef = useRef<SimulationNode | null>(null);

  // Restrained, academic palette per entity type
  const colorMap: Record<EntityType, { fill: string; border: string }> = {
    Person: { fill: '#1f5f54', border: '#14433b' },
    Organization: { fill: '#3b4552', border: '#252c35' },
    Technology: { fill: '#2d557d', border: '#1c3b59' },
    Condition: { fill: '#944535', border: '#6e2e21' },
    Location: { fill: '#36603d', border: '#224027' },
    Product: { fill: '#805d25', border: '#5c4115' },
    ClinicalTrial: { fill: '#574677', border: '#3b2e53' },
    Concept: { fill: '#59606a', border: '#3a4048' },
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const width = clientWidth || 800;
    const height = clientHeight || 600;

    const initialNodes: SimulationNode[] = entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      mentionCount: e.mentionCount || 1,
      isDemo: e.isDemo,
      x: width / 2 + (Math.random() - 0.5) * 320,
      y: height / 2 + (Math.random() - 0.5) * 320,
    }));

    const nodeMap = new Map(initialNodes.map((n) => [n.id, n]));

    const initialLinks: SimulationLink[] = relationships
      .filter((r) => nodeMap.has(r.sourceEntityId) && nodeMap.has(r.targetEntityId))
      .map((r) => ({
        id: r.id,
        source: nodeMap.get(r.sourceEntityId)!,
        target: nodeMap.get(r.targetEntityId)!,
        type: r.type,
        snippet: r.snippet,
        documentName: r.documentName,
        isDemo: r.isDemo,
      }));

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = d3Force
      .forceSimulation<SimulationNode, SimulationLink>(initialNodes)
      .force(
        'link',
        d3Force
          .forceLink<SimulationNode, SimulationLink>(initialLinks)
          .id((d) => d.id)
          .distance(120)
      )
      .force('charge', d3Force.forceManyBody().strength(-260))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(40));

    sim.on('tick', () => {
      setNodes([...initialNodes]);
      setLinks([...initialLinks]);
    });

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [entities, relationships]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * zoomFactor, 0.35), 2.5),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggedNodeRef.current) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeRef.current && simulationRef.current) {
      const node = draggedNodeRef.current;
      node.fx = (e.clientX - transform.x) / transform.scale;
      node.fy = (e.clientY - transform.y) / transform.scale;
      simulationRef.current.alpha(0.3).restart();
      return;
    }

    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#f8f6f0] overflow-hidden select-none cursor-grab active:cursor-grabbing rounded-[6px] border border-[#e4ded2]"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Floating Zoom Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 rounded-[5px] bg-[#ffffff] border border-[#dcd6c8] shadow-xs text-xs text-[#424953]">
        <button
          onClick={() => setTransform((p) => ({ ...p, scale: Math.min(p.scale * 1.15, 2.5) }))}
          className="px-2 py-1 rounded-[3px] hover:bg-[#f4f1ea] transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setTransform((p) => ({ ...p, scale: Math.max(p.scale * 0.85, 0.35) }))}
          className="px-2 py-1 rounded-[3px] hover:bg-[#f4f1ea] transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="px-2 py-1 rounded-[3px] hover:bg-[#f4f1ea] text-[11px] transition-colors"
          title="Reset zoom"
        >
          Reset
        </button>
      </div>

      {/* Node / Link statistics */}
      <div className="absolute bottom-3 left-3 z-20 px-2 py-1 rounded-[4px] bg-[#ffffff]/90 border border-[#ded8cb] text-[10px] text-[#5c6470] font-mono">
        {nodes.length} entities • {links.length} relations • {Math.round(transform.scale * 100)}%
      </div>

      {/* SVG Canvas */}
      <svg ref={svgRef} className="w-full h-full block">
        <defs>
          <marker
            id="edge-arrow"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8f877a" />
          </marker>
          <marker
            id="edge-arrow-highlight"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1f5f54" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Relationships / Edges */}
          {links.map((link) => {
            const source = link.source as SimulationNode;
            const target = link.target as SimulationNode;
            if (typeof source.x !== 'number' || typeof source.y !== 'number' || typeof target.x !== 'number' || typeof target.y !== 'number') {
              return null;
            }

            const isSelected = selectedRelationship?.id === link.id;
            const isHighlighted = highlightedRelationshipIds.includes(link.id);

            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            return (
              <g
                key={link.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const matched = relationships.find((r) => r.id === link.id);
                  if (matched) onSelectRelationship(matched);
                }}
              >
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="transparent"
                  strokeWidth="14"
                />
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isSelected ? '#1f5f54' : isHighlighted ? '#1f5f54' : '#cdc6b8'}
                  strokeWidth={isSelected ? 2.4 : isHighlighted ? 2.2 : 1.2}
                  strokeDasharray={isHighlighted ? '4 2' : 'none'}
                  markerEnd={isSelected || isHighlighted ? 'url(#edge-arrow-highlight)' : 'url(#edge-arrow)'}
                />
                {/* Edge relationship text pill */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x={-((link.type.length * 4.2) + 6)}
                    y="-8"
                    width={(link.type.length * 8.4) + 12}
                    height="16"
                    rx="3"
                    fill={isSelected ? '#1f5f54' : '#ffffff'}
                    stroke={isSelected ? '#14433b' : '#ded7ca'}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill={isSelected ? '#ffffff' : '#47505b'}
                    fontSize="9"
                    fontWeight="500"
                    fontFamily="monospace"
                  >
                    {link.type}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') return null;

            const isSelected = selectedEntity?.id === node.id;
            const isHighlighted = highlightedEntityIds.includes(node.id);
            const colors = colorMap[node.type] || colorMap.Concept;
            const radius = 18 + Math.min((node.mentionCount || 1) * 1.5, 7);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  draggedNodeRef.current = node;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const matched = entities.find((ent) => ent.id === node.id);
                  if (matched) onSelectEntity(matched);
                }}
              >
                {/* Highlight ring */}
                {(isSelected || isHighlighted) && (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke="#1f5f54"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                )}

                <circle
                  r={radius}
                  fill={colors.fill}
                  stroke={isSelected ? '#164840' : colors.border}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Node letter */}
                <text
                  textAnchor="middle"
                  dy="-2"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="600"
                >
                  {node.name.slice(0, 1).toUpperCase()}
                </text>

                {/* Type abbreviation */}
                <text
                  textAnchor="middle"
                  dy="8"
                  fill="rgba(255,255,255,0.85)"
                  fontSize="7"
                  fontWeight="500"
                >
                  {node.type.slice(0, 4)}
                </text>

                {/* Node Label Below */}
                <g transform={`translate(0, ${radius + 10})`}>
                  <rect
                    x={-((node.name.length * 3.2) + 6)}
                    y="-7"
                    width={(node.name.length * 6.4) + 12}
                    height="14"
                    rx="2"
                    fill="#ffffff"
                    stroke="#e2ded4"
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill="#222830"
                    fontSize="9.5"
                    fontWeight="500"
                  >
                    {node.name}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
