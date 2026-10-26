import React, { useState, useEffect } from 'react';
import { AskQueryResponse } from '../../types/rag';
import { SAMPLE_MULTI_HOP_QUESTIONS } from '../../data/demoData';
import { IconSearch, IconGraph, IconDocument, IconArrowRight, IconShield } from '../common/Icons';

export function EvidenceExplorerView() {
  const [query, setQuery] = useState(
    'How is Dr. Elena Vance connected to Dr. Marcus Thorne and St. Jude Neurological Institute?'
  );
  const [retrievalMode, setRetrievalMode] = useState<'hybrid' | 'vector_only' | 'graph_only'>('hybrid');
  const [result, setResult] = useState<AskQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  const runSimulation = async (testQuery?: string) => {
    const q = testQuery || query;
    if (!q.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, retrievalMode }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Audit simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl">
      {/* Simulation Box */}
      <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-[#1c2128]">
            Evidence Audit Laboratory
          </h2>
          <p className="text-[11px] text-[#555d67]">
            Verify each step in the retrieval pipeline: tokenization, mathematical cosine similarity, graph traversal, and grounded prompt compilation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter research query to test..."
            className="flex-1 text-xs py-2 px-3 bg-[#faf8f4] border border-[#d6d0c2] rounded-[4px] focus:outline-none focus:border-[#1f5f54] text-[#1c2128]"
          />

          <select
            value={retrievalMode}
            onChange={(e) => setRetrievalMode(e.target.value as any)}
            className="text-xs bg-[#faf8f4] border border-[#d6d0c2] rounded-[4px] px-2.5 py-2 font-medium text-[#3b424c] focus:outline-none"
          >
            <option value="hybrid">Hybrid (Vector + Graph)</option>
            <option value="vector_only">Vector Only</option>
            <option value="graph_only">Graph Only</option>
          </select>

          <button
            onClick={() => runSimulation()}
            disabled={loading || !query.trim()}
            className="px-3.5 py-2 bg-[#1f5f54] hover:bg-[#164840] disabled:opacity-40 text-white rounded-[4px] text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            {loading ? 'Running audit...' : 'Run audit'}
          </button>
        </div>

        {/* Query Suggestions */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
          <span className="text-[11px] text-[#6e7784]">Test queries:</span>
          {SAMPLE_MULTI_HOP_QUESTIONS.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(s.question);
                runSimulation(s.question);
              }}
              className="px-2 py-0.5 rounded-[3px] text-[11px] bg-[#f4f1ea] hover:bg-[#eae5dc] text-[#343a42] transition-colors cursor-pointer truncate max-w-xs"
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Step Selector & Details */}
      {result && (
        <div className="space-y-4">
          {/* Step tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              { num: 1, label: 'Entity Linking', count: `${result.matchedEntities?.length || 0} entities` },
              { num: 2, label: 'Vector Similarity', count: `${result.retrievedChunks?.length || 0} chunks` },
              { num: 3, label: 'Graph Traversal', count: `${result.traversedRelationships?.length || 0} edges` },
              { num: 4, label: 'Grounding Prompt', count: 'LLM Assembly' },
              { num: 5, label: 'Facts vs Synthesis', count: 'Verification' },
            ].map((step) => (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                className={`p-2.5 rounded-[5px] border text-left transition-colors cursor-pointer ${
                  activeStep === step.num
                    ? 'bg-[#ffffff] text-[#1b5e52] border-[#1f5f54] font-semibold'
                    : 'bg-[#faf8f4] text-[#555d67] border-[#e4ded2] hover:bg-[#f2eee5]'
                }`}
              >
                <div className="text-[10px] font-mono text-[#78818e] mb-0.5">
                  Step 0{step.num}
                </div>
                <div className="text-xs font-medium text-[#1c2128] truncate">{step.label}</div>
              </button>
            ))}
          </div>

          {/* Step 1: Entity Linking */}
          {activeStep === 1 && (
            <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-[#1c2128]">
                  Step 1: Question Entity Linking
                </h3>
                <p className="text-[11px] text-[#606975]">
                  Entities detected in the question used to initialize multi-hop traversal in the knowledge graph.
                </p>
              </div>

              {result.matchedEntities?.length === 0 ? (
                <div className="p-3 rounded-[4px] bg-[#faf8f4] text-[#69727e] text-xs italic">
                  No explicit entities from the knowledge graph were matched in the question text.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {result.matchedEntities.map((ent) => (
                    <div
                      key={ent.id}
                      className="p-3 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#1c2128]">{ent.name}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#ebe6db] text-[#4d5560]">
                          {ent.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#58616d]">{ent.description || 'No description'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Vector Similarity */}
          {activeStep === 2 && (
            <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-[#1c2128]">
                  Step 2: Vector Cosine Similarity
                </h3>
                <p className="text-[11px] text-[#606975]">
                  Mathematical similarity score between query vector and candidate document chunk vectors.
                </p>
              </div>

              <div className="space-y-2.5">
                {result.retrievedChunks.map(({ chunk, score }, idx) => (
                  <div
                    key={chunk.id}
                    className="p-3 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#1c2128]">
                        #{idx + 1} {chunk.documentName} ({chunk.pageOrSection})
                      </div>
                      <span className="font-mono text-[11px] text-[#1f5f54] font-semibold">
                        {(score * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <div className="p-2.5 rounded-[3px] bg-[#ffffff] border border-[#e8e4dc] font-code text-[11px] text-[#2c333d] leading-relaxed whitespace-pre-wrap">
                      {chunk.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Graph Traversal */}
          {activeStep === 3 && (
            <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-[#1c2128]">
                  Step 3: Multi-Hop Knowledge Graph Traversal
                </h3>
                <p className="text-[11px] text-[#606975]">
                  Discovered relational triplets connecting query entities across different source documents.
                </p>
              </div>

              {result.traversedRelationships.length === 0 ? (
                <div className="p-3 rounded-[4px] bg-[#faf8f4] text-[#69727e] text-xs italic">
                  No multi-hop graph edges traversed.
                </div>
              ) : (
                <div className="space-y-2">
                  {result.traversedRelationships.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] text-xs space-y-1"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap font-medium text-[#1c2128]">
                        <span>{r.sourceEntityName}</span>
                        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-[#ebe6db] text-[#4d5560]">
                          {r.type}
                        </span>
                        <IconArrowRight className="w-3 h-3 text-[#798390]" />
                        <span>{r.targetEntityName}</span>
                      </div>
                      <p className="text-[11px] text-[#4b535e] italic">"{r.snippet}"</p>
                      <div className="text-[10px] text-[#717b88] font-mono">
                        Source: {r.documentName} • Chunk: {r.sourceChunkId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Grounding Prompt */}
          {activeStep === 4 && (
            <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-[#1c2128]">
                  Step 4: Grounded LLM Prompt Assembly
                </h3>
                <p className="text-[11px] text-[#606975]">
                  The exact structured instructions and retrieved evidence payload sent to the Gemini engine.
                </p>
              </div>

              <div className="p-3.5 rounded-[4px] bg-[#f8f6f0] border border-[#ded7c9] font-code text-[11px] text-[#2c333d] overflow-x-auto space-y-2 leading-relaxed">
                <div className="font-semibold text-[#1f5f54]"># GROUNDING INSTRUCTIONS</div>
                <div className="text-[#555e69]">
                  Answer strictly based on the provided Knowledge Graph relationships and Document Evidence Chunks. Every key assertion must include an inline citation [DocName:Section]. Never extrapolate beyond what is stated in the provided text.
                </div>
                <div className="font-semibold text-[#1f5f54] pt-1"># COMPILED TRIPLETS ({result.traversedRelationships.length})</div>
                {result.traversedRelationships.map((r, i) => (
                  <div key={i} className="text-[#3c444f] pl-3">
                    {i + 1}. [{r.sourceEntityName}] --({r.type})--&gt; [{r.targetEntityName}] | Source: {r.documentName}
                  </div>
                ))}
                <div className="font-semibold text-[#1f5f54] pt-1"># COMPILED EVIDENCE CHUNKS ({result.retrievedChunks.length})</div>
                {result.retrievedChunks.map(({ chunk, score }, i) => (
                  <div key={i} className="text-[#3c444f] pl-3">
                    Chunk #{i + 1} [{chunk.documentName}]: "{chunk.text.slice(0, 100)}..." (Score: {(score * 100).toFixed(0)}%)
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Facts vs Synthesis */}
          {activeStep === 5 && (
            <div className="bg-[#ffffff] rounded-[6px] border border-[#e4ded2] p-5 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-[#1c2128]">
                  Step 5: Verifiable Extracted Facts vs. AI Synthesis
                </h3>
                <p className="text-[11px] text-[#606975]">
                  Compare direct verbatim source quotes against the synthesized research answer.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Left: Raw Quotes */}
                <div className="p-3.5 rounded-[4px] bg-[#faf8f4] border border-[#e8e4db] space-y-2">
                  <div className="text-[11px] font-semibold text-[#1c2128] uppercase tracking-wider">
                    Raw Document Extracts (Direct Quotes)
                  </div>
                  <div className="space-y-2">
                    {result.citations.map((c, i) => (
                      <div key={i} className="p-2.5 rounded-[3px] bg-[#ffffff] border border-[#e8e4dc] space-y-1">
                        <div className="font-medium text-[#1c2128] flex justify-between">
                          <span>{c.documentName}</span>
                          <span className="font-mono text-[#1f5f54]">{(c.relevanceScore * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[11px] text-[#4d5661] italic">"{c.snippet}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Synthesis */}
                <div className="p-3.5 rounded-[4px] bg-[#eef5f2] border border-[#cfe2db] space-y-2">
                  <div className="text-[11px] font-semibold text-[#1b5e52] uppercase tracking-wider">
                    Synthesized Research Answer
                  </div>
                  <div className="p-3 rounded-[3px] bg-[#ffffff] border border-[#cde0d8] text-[#1c2128] leading-relaxed whitespace-pre-wrap text-[12px]">
                    {result.answer}
                  </div>
                  <div className="text-[10px] text-[#55606b]">
                    Grounded in {result.citations.length} cited source passages.
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
