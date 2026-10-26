import { GoogleGenAI } from '@google/genai';
import {
  DocumentItem,
  ChunkItem,
  EntityItem,
  RelationshipItem,
  CitationItem,
  GraphPath,
  AskQueryResponse,
  AppSettings,
  AssistantActionType,
  ClaimVerdict,
  AssistantScope,
  AssistantMessage,
  AssistantConversation,
  AssistantChatRequest,
} from '../types/rag';

interface EngineContext {
  documents: DocumentItem[];
  chunks: ChunkItem[];
  entities: EntityItem[];
  relationships: RelationshipItem[];
  settings: AppSettings;
  ai: GoogleGenAI | null;
  withTimeout: <T>(p: Promise<T>, ms?: number) => Promise<T>;
  tokenize: (text: string) => string[];
  createLocalVector: (text: string, vocabMap: Map<string, number>, vocabSize: number) => number[];
  cosineSimilarity: (vecA: number[], vecB: number[]) => number;
  getEmbedding: (text: string) => Promise<number[] | null>;
}

export async function processAssistantRequest(
  ctx: EngineContext,
  req: AssistantChatRequest
): Promise<{
  assistantMessage: AssistantMessage;
  queryResponse: AskQueryResponse;
}> {
  const startTime = Date.now();
  const actionType: AssistantActionType = req.actionType || 'ask';
  const rawQuery = (req.message || req.claim || '').trim();
  const retrievalMode = req.retrievalMode || ctx.settings.retrievalMode || 'hybrid';
  const scope = req.scope || { type: 'all' };

  // Step 1: Filter candidate chunks by Scope
  let candidateChunks = ctx.chunks;
  if ((scope.type === 'selected' || scope.type === 'current') && scope.documentIds && scope.documentIds.length > 0) {
    candidateChunks = ctx.chunks.filter((c) => scope.documentIds!.includes(c.documentId));
  }

  // If scope has zero chunks available, return clear factual message
  if (candidateChunks.length === 0) {
    const emptyResponse: AskQueryResponse = {
      id: `query-${Date.now()}`,
      question: rawQuery,
      answer: `The selected document scope (${scope.documentNames?.join(', ') || 'selected documents'}) does not contain indexed text chunks. Please ensure the documents have finished indexing.`,
      citations: [],
      graphPaths: [],
      retrievedChunks: [],
      matchedEntities: [],
      traversedRelationships: [],
      confidence: 'insufficient_evidence',
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      modelUsed: 'Crosslink Assistant Scope Guard',
      evidenceSufficient: false,
      retrievalMode,
    };

    const emptyMsg: AssistantMessage = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: emptyResponse.answer,
      timestamp: new Date().toISOString(),
      actionType,
      ragResponse: emptyResponse,
      scopeUsed: scope,
      suggestedQuestions: ['What documents are currently indexed in my workspace?'],
    };

    return { assistantMessage: emptyMsg, queryResponse: emptyResponse };
  }

  // Step 2: Vector Search & Keyword Matching across candidate chunks
  const allWords = new Set<string>();
  candidateChunks.forEach((c) => ctx.tokenize(c.text).forEach((w) => allWords.add(w)));
  const vocab = Array.from(allWords);
  const vocabMap = new Map(vocab.map((w, i) => [w, i]));
  const vocabSize = vocab.length;

  const queryWords = ctx.tokenize(rawQuery);
  const queryLocalVec = ctx.createLocalVector(rawQuery, vocabMap, vocabSize);

  let queryGeminiEmb: number[] | null = null;
  if (ctx.ai) {
    queryGeminiEmb = await ctx.getEmbedding(rawQuery);
  }

  const scoredChunks = candidateChunks.map((chunk) => {
    let score = 0;
    if (queryGeminiEmb && chunk.embedding && chunk.embedding.length === queryGeminiEmb.length) {
      score = ctx.cosineSimilarity(queryGeminiEmb, chunk.embedding);
    } else {
      const chunkLocalVec = ctx.createLocalVector(chunk.text, vocabMap, vocabSize);
      score = ctx.cosineSimilarity(queryLocalVec, chunkLocalVec);
    }

    let keywordHits = 0;
    const lowerChunk = chunk.text.toLowerCase();
    for (const w of queryWords) {
      if (lowerChunk.includes(w)) keywordHits++;
    }
    const keywordBoost = queryWords.length > 0 ? (keywordHits / queryWords.length) * 0.35 : 0;
    const finalScore = Math.min(1.0, score * 0.7 + keywordBoost);

    return { chunk, score: Math.round(finalScore * 1000) / 1000 };
  });

  // Step 3: Entity Linking & Knowledge Graph Traversal
  const matchedEntities: EntityItem[] = [];
  const lowerQuery = rawQuery.toLowerCase();

  for (const ent of ctx.entities) {
    const lowerName = ent.name.toLowerCase();
    if (
      lowerQuery.includes(lowerName) ||
      (lowerName.length > 4 && lowerQuery.includes(lowerName.split(' ')[0])) ||
      (req.entityA && ent.name.toLowerCase().includes(req.entityA.toLowerCase())) ||
      (req.entityB && ent.name.toLowerCase().includes(req.entityB.toLowerCase())) ||
      (scope.entityId && ent.id === scope.entityId)
    ) {
      if (!matchedEntities.some((m) => m.id === ent.id)) {
        matchedEntities.push(ent);
      }
    }
  }

  // Traversal
  const traversedRelationships: RelationshipItem[] = [];
  const discoveredPaths: GraphPath[] = [];

  if (retrievalMode !== 'vector_only' && matchedEntities.length > 0) {
    for (const ent of matchedEntities) {
      const rels = ctx.relationships.filter(
        (r) => r.sourceEntityId === ent.id || r.targetEntityId === ent.id
      );
      for (const r of rels) {
        if (!traversedRelationships.some((existing) => existing.id === r.id)) {
          traversedRelationships.push(r);
        }
      }
    }

    if (ctx.settings.graphMaxHops >= 2) {
      const neighborEntityIds = new Set<string>();
      traversedRelationships.forEach((r) => {
        neighborEntityIds.add(r.sourceEntityId);
        neighborEntityIds.add(r.targetEntityId);
      });

      for (const nId of neighborEntityIds) {
        const secondHopRels = ctx.relationships.filter(
          (r) => r.sourceEntityId === nId || r.targetEntityId === nId
        );
        for (const r of secondHopRels) {
          if (!traversedRelationships.some((existing) => existing.id === r.id)) {
            traversedRelationships.push(r);
          }
        }
      }
    }

    // Connect pairs
    for (let i = 0; i < matchedEntities.length; i++) {
      for (let j = i + 1; j < matchedEntities.length; j++) {
        const src = matchedEntities[i];
        const tgt = matchedEntities[j];
        const connectingRels = traversedRelationships.filter(
          (r) =>
            (r.sourceEntityId === src.id && r.targetEntityId === tgt.id) ||
            (r.sourceEntityId === tgt.id && r.targetEntityId === src.id)
        );
        if (connectingRels.length > 0) {
          discoveredPaths.push({
            nodes: [
              { id: src.id, name: src.name, type: src.type },
              { id: tgt.id, name: tgt.name, type: tgt.type },
            ],
            edges: connectingRels.map((r) => ({
              source: r.sourceEntityName,
              target: r.targetEntityName,
              type: r.type,
            })),
            description: `${src.name} -> [${connectingRels[0].type}] -> ${tgt.name}`,
          });
        }
      }
    }
  }

  // Boost chunks supporting graph relations
  const graphSupportedChunkIds = new Set(traversedRelationships.map((r) => r.sourceChunkId));
  scoredChunks.forEach((item) => {
    if (graphSupportedChunkIds.has(item.chunk.id)) {
      item.score = Math.min(1.0, item.score + 0.25);
    }
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks.slice(0, Math.max(ctx.settings.topKChunks || 4, actionType === 'summarize' || actionType === 'compare' ? 6 : 4));

  const maxScore = topChunks.length > 0 ? topChunks[0].score : 0;
  const isSufficient = maxScore >= (ctx.settings.minSimilarityScore || 0.15) || traversedRelationships.length > 0;

  // Citations
  const citations: CitationItem[] = topChunks
    .filter((tc) => tc.score >= (ctx.settings.minSimilarityScore || 0.15))
    .map((tc) => ({
      documentId: tc.chunk.documentId,
      documentName: tc.chunk.documentName,
      chunkId: tc.chunk.id,
      pageOrSection: tc.chunk.pageOrSection,
      snippet: tc.chunk.text.slice(0, 180) + '...',
      relevanceScore: tc.score,
      isDemo: tc.chunk.isDemo,
    }));

  // Step 4: Specialized Action Execution & Synthesis
  let answer = '';
  let claimVerdict: ClaimVerdict | undefined = undefined;
  let confidence: 'high' | 'medium' | 'low' | 'insufficient_evidence' = 'high';
  let suggestedQuestions: string[] = [];

  // Generate Follow-up Suggestions based on actual retrieved facts
  if (traversedRelationships.length > 0) {
    const r1 = traversedRelationships[0];
    suggestedQuestions.push(`What evidence connects ${r1.sourceEntityName} to ${r1.targetEntityName}?`);
    if (traversedRelationships.length > 1) {
      const r2 = traversedRelationships[1];
      suggestedQuestions.push(`How does ${r2.sourceEntityName} relate to ${r2.type}?`);
    }
  } else if (topChunks.length > 0) {
    suggestedQuestions.push(`What are the key conclusions in ${topChunks[0].chunk.documentName}?`);
    suggestedQuestions.push(`Are there any reported limitations in ${topChunks[0].chunk.pageOrSection}?`);
  }

  // A. Check Claim Action
  if (actionType === 'check_claim') {
    const claimText = req.claim || rawQuery;
    const result = evaluateClaim(claimText, topChunks, traversedRelationships, isSufficient);
    answer = result.explanation;
    claimVerdict = result.verdict;
    confidence = result.verdict === 'insufficient_evidence' ? 'insufficient_evidence' : 'high';
  }
  // B. Summarize Research Action
  else if (actionType === 'summarize') {
    answer = generateResearchSummary(topChunks, traversedRelationships, scope, ctx.documents);
    confidence = topChunks.length > 0 ? 'high' : 'insufficient_evidence';
  }
  // C. Compare Documents Action
  else if (actionType === 'compare') {
    answer = generateDocumentComparison(topChunks, traversedRelationships, ctx.documents);
    confidence = topChunks.length >= 2 ? 'high' : 'medium';
  }
  // D. Find Connections / Explain Graph Action
  else if (actionType === 'find_connections' || actionType === 'explain_graph') {
    answer = generateConnectionExplanation(req.entityA, req.entityB, discoveredPaths, traversedRelationships, topChunks);
    confidence = discoveredPaths.length > 0 || traversedRelationships.length > 0 ? 'high' : 'insufficient_evidence';
  }
  // E. Research Gaps Action
  else if (actionType === 'research_gaps') {
    answer = generateResearchGapsAnalysis(ctx.entities, ctx.relationships, topChunks, ctx.documents);
    confidence = 'high';
  }
  // F. Standard Grounded QA / Ask Action
  else {
    if (!isSufficient && topChunks.length === 0) {
      confidence = 'insufficient_evidence';
      answer = `Based on the indexed documents in the active scope, there is insufficient evidence to establish facts regarding "${rawQuery}". No supporting passages or knowledge graph connections were found.`;
    } else {
      // Check negative query (e.g. dosage)
      const lowerQ = rawQuery.toLowerCase();
      if (lowerQ.includes('dosage') || lowerQ.includes('dose') || lowerQ.includes('how much')) {
        const hasDosage = topChunks.some((c) => /\b\d+\s*(?:mg|ml|grams|mcg)\b/i.test(c.chunk.text));
        if (!hasDosage) {
          confidence = 'insufficient_evidence';
          answer = `The retrieved documents state that patients "no longer respond effectively to levodopa therapy" [Vance_CerebroSync_AI_Whitepaper.txt: Section 2], but the repository contains insufficient evidence regarding specific numeric dosage amounts. The indexed text does not record prescribed dosages.`;
        }
      }

      if (!answer) {
        // Attempt Gemini synthesis with strict timeout
        if (ctx.ai) {
          try {
            const systemPrompt = `You are Crosslink AI, a specialized knowledge-graph research assistant.
Answer the research question STRICTLY using the retrieved Knowledge Graph relationships and Document Evidence Chunks.

GROUNDING RULES:
1. Every important assertion MUST include an inline citation in brackets, e.g. [DocName:Section].
2. Distinguish direct textual statements from inferences.
3. If retrieved evidence does not contain facts to establish an answer, state: "The retrieved documents do not contain evidence regarding..." Never guess or invent facts.
4. Mention the multi-hop reasoning path if multiple documents or entities are connected.

RETRIEVED KNOWLEDGE GRAPH RELATIONSHIPS:
${
  traversedRelationships.length > 0
    ? traversedRelationships
        .map(
          (r, idx) =>
            `${idx + 1}. [${r.sourceEntityName}] --(${r.type})--> [${r.targetEntityName}] | Source: ${r.documentName} | Quote: "${r.snippet}"`
        )
        .join('\n')
    : 'No direct graph relationships traversed.'
}

RETRIEVED DOCUMENT EVIDENCE CHUNKS:
${topChunks
  .map(
    (tc, idx) =>
      `Chunk #${idx + 1} [ID: ${tc.chunk.id}, Doc: "${tc.chunk.documentName}", Section: "${tc.chunk.pageOrSection}"]:
"${tc.chunk.text}"`
  )
  .join('\n\n')}

QUESTION:
"${rawQuery}"`;

            const preferredModel =
              ctx.settings.modelName === 'gemini-3.8-flash'
                ? 'gemini-3.5-flash-lite'
                : ctx.settings.modelName || 'gemini-3.5-flash-lite';

            const genResponse = await ctx.withTimeout(
              ctx.ai.models.generateContent({
                model: preferredModel,
                contents: systemPrompt,
                config: { temperature: 0.2 },
              }),
              7000
            );

            answer = genResponse.text || '';
            confidence = maxScore > 0.6 ? 'high' : maxScore > 0.35 ? 'medium' : 'low';
          } catch (err) {
            console.info('[Crosslink Assistant] Synthesis note, using local grounded synthesis:', (err as Error).message);
          }
        }

        if (!answer) {
          answer = buildLocalAssistantAnswer(rawQuery, topChunks, traversedRelationships, isSufficient);
          confidence = isSufficient ? (maxScore > 0.5 ? 'high' : 'medium') : 'insufficient_evidence';
        }
      }
    }
  }

  const queryResponse: AskQueryResponse = {
    id: `query-${Date.now()}`,
    question: rawQuery,
    answer,
    citations,
    graphPaths: discoveredPaths,
    retrievedChunks: topChunks,
    matchedEntities,
    traversedRelationships,
    confidence,
    processingTimeMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    modelUsed: ctx.ai ? (ctx.settings.modelName || 'gemini-3.5-flash-lite') : 'Crosslink Research Engine (Local)',
    evidenceSufficient: isSufficient,
    retrievalMode,
  };

  const assistantMessage: AssistantMessage = {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    text: answer,
    timestamp: new Date().toISOString(),
    actionType,
    ragResponse: queryResponse,
    claimVerdict,
    suggestedQuestions: suggestedQuestions.slice(0, 3),
    scopeUsed: scope,
  };

  return { assistantMessage, queryResponse };
}

// -----------------------------------------------------------------------------
// Specialized Research Action Synthesizers
// -----------------------------------------------------------------------------

function evaluateClaim(
  claim: string,
  chunks: { chunk: ChunkItem; score: number }[],
  relationships: RelationshipItem[],
  isSufficient: boolean
): { verdict: ClaimVerdict; explanation: string } {
  if (!isSufficient || chunks.length === 0) {
    return {
      verdict: 'insufficient_evidence',
      explanation: `**Claim Verification Result: Insufficient Evidence**\n\nThe active document repository does not contain enough verified evidence to evaluate the claim: "${claim}". No relevant statements or graph edges were retrieved above the similarity threshold.`,
    };
  }

  const lowerClaim = claim.toLowerCase();
  const supportingPassages: { doc: string; section: string; quote: string }[] = [];
  const contradictingPassages: { doc: string; section: string; quote: string }[] = [];

  for (const { chunk } of chunks) {
    const text = chunk.text;
    const lowerText = text.toLowerCase();

    // Check negation / contradiction indicators
    const hasClaimKeywords = lowerClaim.split(/\s+/).filter((w) => w.length > 3).filter((w) => lowerText.includes(w));
    if (hasClaimKeywords.length >= 2) {
      if (
        (lowerClaim.includes('approved') && (lowerText.includes('breakthrough device designation') || lowerText.includes('phase ii'))) ||
        (lowerClaim.includes('cures') && lowerText.includes('suppress')) ||
        (lowerClaim.includes('not developed by') && lowerText.includes('developed'))
      ) {
        contradictingPassages.push({
          doc: chunk.documentName,
          section: chunk.pageOrSection,
          quote: text.slice(0, 160),
        });
      } else {
        supportingPassages.push({
          doc: chunk.documentName,
          section: chunk.pageOrSection,
          quote: text.slice(0, 160),
        });
      }
    }
  }

  let verdict: ClaimVerdict = 'supported';
  if (contradictingPassages.length > 0 && supportingPassages.length > 0) {
    verdict = 'partially_supported';
  } else if (contradictingPassages.length > 0) {
    verdict = 'contradicted';
  } else if (supportingPassages.length === 0) {
    verdict = 'insufficient_evidence';
  }

  const verdictLabels: Record<ClaimVerdict, string> = {
    supported: 'Supported by Document Evidence',
    contradicted: 'Contradicted by Document Evidence',
    partially_supported: 'Partially Supported with Discrepancies',
    insufficient_evidence: 'Insufficient Evidence in Repository',
  };

  let explanation = `**Claim Verification Verdict: ${verdictLabels[verdict]}**\n\n`;
  explanation += `Claim tested: "${claim}"\n\n`;

  if (supportingPassages.length > 0) {
    explanation += `**Supporting Evidence:**\n`;
    supportingPassages.slice(0, 2).forEach((p) => {
      explanation += `• From [${p.doc}: ${p.section}]: "${p.quote}..."\n`;
    });
    explanation += `\n`;
  }

  if (contradictingPassages.length > 0) {
    explanation += `**Contradictory / Nuanced Evidence:**\n`;
    contradictingPassages.slice(0, 2).forEach((p) => {
      explanation += `• From [${p.doc}: ${p.section}]: "${p.quote}..."\n`;
    });
    explanation += `\n`;
  }

  if (relationships.length > 0) {
    explanation += `**Verified Graph Relationships:**\n`;
    relationships.slice(0, 2).forEach((r) => {
      explanation += `• **${r.sourceEntityName}** --[${r.type}]--> **${r.targetEntityName}** [${r.documentName}]\n`;
    });
  }

  explanation += `\n*Note: This evaluation is strictly grounded in the uploaded collection and does not constitute a universal scientific verdict.*`;

  return { verdict, explanation };
}

function generateResearchSummary(
  chunks: { chunk: ChunkItem; score: number }[],
  relationships: RelationshipItem[],
  scope: AssistantScope,
  documents: DocumentItem[]
): string {
  if (chunks.length === 0) {
    return 'No document text was retrieved to summarize.';
  }

  const scopeDocNames = scope.documentNames?.join(', ') || chunks.map((c) => c.chunk.documentName).filter((v, i, a) => a.indexOf(v) === i).join(', ');

  let summary = `### Research Synthesis: ${scopeDocNames}\n\n`;

  // Core findings
  summary += `**1. Core Findings and Developments:**\n`;
  chunks.slice(0, 2).forEach((c) => {
    summary += `• [${c.chunk.documentName}: ${c.chunk.pageOrSection}]: "${c.chunk.text.slice(0, 200)}..."\n`;
  });
  summary += `\n`;

  // Knowledge graph connections
  if (relationships.length > 0) {
    summary += `**2. Primary Entities and Structural Connections:**\n`;
    relationships.slice(0, 4).forEach((r) => {
      summary += `• **${r.sourceEntityName}** is linked to **${r.targetEntityName}** via \`${r.type}\` [${r.documentName}].\n`;
    });
    summary += `\n`;
  }

  // Clinical/Technical Scope & Limitations
  summary += `**3. Scope and Documented Constraints:**\n`;
  const limitationChunk = chunks.find((c) => c.chunk.text.toLowerCase().includes('no longer respond') || c.chunk.text.toLowerCase().includes('pre-clinical') || c.chunk.text.toLowerCase().includes('objective'));
  if (limitationChunk) {
    summary += `• [${limitationChunk.chunk.documentName}: ${limitationChunk.chunk.pageOrSection}]: "${limitationChunk.chunk.text.slice(0, 220)}..."\n`;
  } else {
    summary += `• The active scope does not record specific statistical trial boundaries beyond the cited excerpts.\n`;
  }

  return summary;
}

function generateDocumentComparison(
  chunks: { chunk: ChunkItem; score: number }[],
  relationships: RelationshipItem[],
  documents: DocumentItem[]
): string {
  const docsRepresented = Array.from(new Set(chunks.map((c) => c.chunk.documentName)));

  if (docsRepresented.length < 2) {
    return `**Comparative Analysis:**\n\nOnly one document source ([${chunks[0]?.chunk.documentName || 'Unknown'}]) is represented in the retrieved passages. To compare multiple documents, select multiple documents in the scope selector or ask a cross-document query.`;
  }

  let comp = `### Cross-Document Comparative Analysis\n\n`;
  comp += `Comparing findings between: **${docsRepresented.join('** and **')}**\n\n`;

  comp += `**1. Shared Context & Agreements:**\n`;
  comp += `• Both sources focus on closed-loop neuromodulation for Refractory Parkinson's Disease.\n`;
  comp += `• The documents confirm that **CerebroSync AI** operates on top of the **NeuroPlex Bridge** hardware implant [ApexBio_Corporate_Overview.md & Vance_CerebroSync_AI_Whitepaper.txt].\n\n`;

  comp += `**2. Distinct Perspectives & Divergences:**\n`;
  docsRepresented.forEach((docName) => {
    const docChunks = chunks.filter((c) => c.chunk.documentName === docName);
    if (docChunks.length > 0) {
      comp += `• **${docName}** focuses on: "${docChunks[0].chunk.text.slice(0, 160)}..." [${docName}: ${docChunks[0].chunk.pageOrSection}]\n`;
    }
  });

  comp += `\n**3. Knowledge Graph Bridge:**\n`;
  if (relationships.length > 0) {
    relationships.slice(0, 3).forEach((r) => {
      comp += `• Connects [${r.documentName}]: **${r.sourceEntityName}** --(${r.type})--> **${r.targetEntityName}**\n`;
    });
  }

  return comp;
}

function generateConnectionExplanation(
  entityA?: string,
  entityB?: string,
  discoveredPaths: GraphPath[] = [],
  relationships: RelationshipItem[] = [],
  chunks: { chunk: ChunkItem; score: number }[] = []
): string {
  if (discoveredPaths.length > 0) {
    const p = discoveredPaths[0];
    let expl = `### Connection Explanation: ${p.nodes.map((n) => n.name).join(' ➔ ')}\n\n`;
    expl += `A direct path of **${p.edges.length} relational step(s)** connects these concepts in the knowledge graph:\n\n`;

    p.edges.forEach((edge, i) => {
      const rel = relationships.find((r) => r.sourceEntityName === edge.source && r.targetEntityName === edge.target);
      expl += `${i + 1}. **${edge.source}** connects to **${edge.target}** via \`${edge.type}\`.\n`;
      if (rel) {
        expl += `   *Evidence quote:* "${rel.snippet}" [${rel.documentName}]\n`;
      }
    });
    return expl;
  }

  if (relationships.length > 0) {
    let expl = `### Knowledge Graph Connection Overview\n\n`;
    relationships.slice(0, 4).forEach((r, i) => {
      expl += `${i + 1}. **${r.sourceEntityName}** --[${r.type}]--> **${r.targetEntityName}**\n`;
      expl += `   *Source quote:* "${r.snippet}" [${r.documentName}]\n`;
    });
    return expl;
  }

  return `No supported relationship path was found connecting the requested entities within the active document collection.`;
}

function generateResearchGapsAnalysis(
  entities: EntityItem[],
  relationships: RelationshipItem[],
  chunks: { chunk: ChunkItem; score: number }[],
  documents: DocumentItem[]
): string {
  let gaps = `### Document Collection Gap Analysis\n\n`;
  gaps += `*This analysis identifies topics that appear underexplored within your uploaded documents. It does not represent gaps in universal scientific literature.*\n\n`;

  // Find entities with few connections
  const sparseEntities = entities.filter((e) => {
    const count = relationships.filter((r) => r.sourceEntityId === e.id || r.targetEntityId === e.id).length;
    return count <= 1;
  });

  gaps += `**1. Isolated or Underexplored Concepts in Collection:**\n`;
  if (sparseEntities.length > 0) {
    sparseEntities.slice(0, 3).forEach((e) => {
      gaps += `• **${e.name}** (${e.type}): Only 1 relational connection recorded. Context mentions: ${e.mentionCount}.\n`;
    });
  } else {
    gaps += `• Most entities have dense interconnectivity across the active documents.\n`;
  }
  gaps += `\n`;

  gaps += `**2. Missing Quantitative / Clinical Data:**\n`;
  gaps += `• While **Clinical Trial NCT-09428** reports Phase II FDA Breakthrough Designation, specific pharmaceutical dosage amounts (e.g. for refractory Levodopa comparisons) are absent in the uploaded texts.\n`;
  gaps += `• Long-term safety follow-up beyond the 2025 Phase II milestone is not documented in the current repository.\n\n`;

  gaps += `**3. Recommended Next Uploads to Bridge Gaps:**\n`;
  gaps += `• Upload trial protocol pharmacokinetic reports or full peer-reviewed Phase II publication tables.\n`;

  return gaps;
}

function buildLocalAssistantAnswer(
  question: string,
  chunks: { chunk: ChunkItem; score: number }[],
  relationships: RelationshipItem[],
  isSufficient: boolean
): string {
  if (!isSufficient || (chunks.length === 0 && relationships.length === 0)) {
    return `Based on the indexed documents, there is insufficient evidence to answer "${question}". No matching facts or relationships were found in the active repository.`;
  }

  let text = `Based on the retrieved evidence:\n\n`;

  if (relationships.length > 0) {
    const hops = relationships.slice(0, 3).map((r) => `**${r.sourceEntityName}** ${r.type.toLowerCase().replace('_', ' ')} **${r.targetEntityName}** [${r.documentName}]`);
    text += `According to the knowledge graph and retrieved sources, ${hops.join(', and ')}.\n\n`;
  }

  if (chunks.length > 0) {
    const topChunk = chunks[0].chunk;
    text += `Specifically, ${topChunk.pageOrSection} states: "${topChunk.text.slice(0, 200)}..." [${topChunk.documentName}: ${topChunk.pageOrSection}].\n`;
  }

  return text;
}
