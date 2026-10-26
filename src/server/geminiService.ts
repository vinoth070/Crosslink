import { GoogleGenAI, Type } from '@google/genai';
import { EntityType } from '../types/rag';

export interface GeminiDiagnosticStatus {
  healthy: boolean;
  model: string;
  embeddingModel: string;
  errorType?: 'INVALID_API_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_UNAVAILABLE' | 'NETWORK_FAILURE' | 'MALFORMED_OUTPUT' | 'EMPTY_OUTPUT' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
  latencyMs?: number;
  lastTested?: string;
}

export interface ExtractedEntityPayload {
  name: string;
  type: EntityType;
  aliases?: string[];
  description?: string;
  sourceEvidence?: string;
}

export interface ExtractedRelationshipPayload {
  sourceName: string;
  targetName: string;
  relationType: string;
  snippet: string;
  confidence?: number;
  description?: string;
  isContradiction?: boolean;
  conflictNote?: string;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private apiKey: string | undefined;
  private primaryModel: string = 'gemini-3.8-flash';
  private embeddingModel: string = 'gemini-embedding-2';
  private lastDiagnostic: GeminiDiagnosticStatus;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.ai = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      this.lastDiagnostic = {
        healthy: true,
        model: this.primaryModel,
        embeddingModel: this.embeddingModel,
        message: 'Gemini client initialized with API key',
        lastTested: new Date().toISOString(),
      };
    } else {
      this.lastDiagnostic = {
        healthy: false,
        model: this.primaryModel,
        embeddingModel: this.embeddingModel,
        errorType: 'INVALID_API_KEY',
        message: 'GEMINI_API_KEY is not configured in server environment',
        lastTested: new Date().toISOString(),
      };
    }
  }

  public isConfigured(): boolean {
    return !!this.ai;
  }

  public getDiagnostic(): GeminiDiagnosticStatus {
    return this.lastDiagnostic;
  }

  public setModels(primaryModel: string, embeddingModel: string) {
    this.primaryModel = primaryModel || 'gemini-3.8-flash';
    this.embeddingModel = embeddingModel || 'gemini-embedding-2';
    this.lastDiagnostic.model = this.primaryModel;
    this.lastDiagnostic.embeddingModel = this.embeddingModel;
  }

  public getModels() {
    return {
      primaryModel: this.primaryModel,
      embeddingModel: this.embeddingModel,
    };
  }

  /**
   * Bounded retry helper with exponential backoff for temporary failures
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    baseDelayMs: number = 700
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (err: any) {
        attempt++;
        const classified = this.classifyError(err);

        // If error is non-temporary (400, 401, 403, 404, invalid auth), throw immediately without wasting retries
        const isTemporary =
          classified.errorType === 'QUOTA_EXCEEDED' ||
          classified.errorType === 'NETWORK_FAILURE' ||
          classified.errorType === 'TIMEOUT' ||
          (err.status && (err.status === 429 || err.status === 503 || err.status === 500));

        if (!isTemporary || attempt > maxRetries) {
          this.lastDiagnostic = {
            healthy: false,
            model: this.primaryModel,
            embeddingModel: this.embeddingModel,
            errorType: classified.errorType,
            message: classified.message,
            lastTested: new Date().toISOString(),
          };
          throw new Error(`[Gemini ${classified.errorType}]: ${classified.message}`);
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[GeminiService] Transient failure (${classified.errorType}). Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  public classifyError(err: any): { errorType: GeminiDiagnosticStatus['errorType']; message: string } {
    const msg = (err?.message || String(err)).toLowerCase();
    const status = err?.status || err?.statusCode;

    if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('permission denied') || msg.includes('unauthenticated')) {
      return {
        errorType: 'INVALID_API_KEY',
        message: 'Invalid or unauthorized Gemini API key. Please check your credentials.',
      };
    }
    if (status === 429 || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit')) {
      return {
        errorType: 'QUOTA_EXCEEDED',
        message: 'Gemini API quota or rate limit exceeded (429 Resource Exhausted).',
      };
    }
    if (status === 404 || msg.includes('not found') || msg.includes('is not supported')) {
      return {
        errorType: 'MODEL_UNAVAILABLE',
        message: `The model ${this.primaryModel} is unavailable or not found.`,
      };
    }
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline exceeded')) {
      return {
        errorType: 'TIMEOUT',
        message: 'Gemini API request timed out before receiving a response.',
      };
    }
    if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
      return {
        errorType: 'NETWORK_FAILURE',
        message: 'Network connection failure while communicating with Google GenAI API.',
      };
    }
    if (msg.includes('json') || msg.includes('syntaxerror')) {
      return {
        errorType: 'MALFORMED_OUTPUT',
        message: 'Model generated malformed JSON output that failed structured validation.',
      };
    }
    return {
      errorType: 'UNKNOWN',
      message: err?.message || 'An unexpected Gemini API error occurred.',
    };
  }

  /**
   * Health check and live connectivity test
   */
  public async testConnection(): Promise<GeminiDiagnosticStatus> {
    if (!this.ai) {
      this.lastDiagnostic = {
        healthy: false,
        model: this.primaryModel,
        embeddingModel: this.embeddingModel,
        errorType: 'INVALID_API_KEY',
        message: 'GEMINI_API_KEY is not set in environment.',
        lastTested: new Date().toISOString(),
      };
      return this.lastDiagnostic;
    }

    const start = Date.now();
    try {
      // 1. Text generation test
      const response = await this.executeWithRetry(async () => {
        return await this.ai!.models.generateContent({
          model: this.primaryModel,
          contents: 'Respond with exactly: {"status":"healthy"} in JSON.',
          config: {
            responseMimeType: 'application/json',
          },
        });
      }, 1, 500);

      const text = response.text?.trim() || '';
      if (!text) {
        throw new Error('Empty response received from Gemini.');
      }

      // 2. Embedding generation test
      try {
        await this.ai.models.embedContent({
          model: this.embeddingModel,
          contents: 'Health check probe',
        });
      } catch (embErr) {
        console.warn('[GeminiService] Embedding model check note:', (embErr as Error).message);
      }

      const latencyMs = Date.now() - start;
      this.lastDiagnostic = {
        healthy: true,
        model: this.primaryModel,
        embeddingModel: this.embeddingModel,
        message: `Gemini Flash (${this.primaryModel}) operational. Verified in ${latencyMs}ms.`,
        latencyMs,
        lastTested: new Date().toISOString(),
      };
      return this.lastDiagnostic;
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const classified = this.classifyError(err);
      this.lastDiagnostic = {
        healthy: false,
        model: this.primaryModel,
        embeddingModel: this.embeddingModel,
        errorType: classified.errorType,
        message: classified.message,
        latencyMs,
        lastTested: new Date().toISOString(),
      };
      return this.lastDiagnostic;
    }
  }

  /**
   * Embed text using configured Gemini embedding model
   */
  public async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.ai) return null;
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.ai!.models.embedContent({
          model: this.embeddingModel,
          contents: text,
        });
      }, 1, 500);

      // @ts-ignore
      const values = response.embedding?.values || response.embeddings?.[0]?.values;
      if (values && Array.isArray(values)) {
        return values;
      }
    } catch (err) {
      console.warn('[GeminiService] Embedding generation failed, falling back to local vectorizer:', (err as Error).message);
    }
    return null;
  }

  /**
   * Extract knowledge graph entities & relationships from a document text chunk
   */
  public async extractGraph(
    chunkText: string,
    docName: string,
    section: string
  ): Promise<{
    entities: ExtractedEntityPayload[];
    relationships: ExtractedRelationshipPayload[];
  }> {
    if (!this.ai) {
      throw new Error('Gemini API is not configured.');
    }

    const prompt = `You are a high-precision Knowledge Graph extraction engine for an evidence-grounded research assistant.
Analyze the following text chunk from document "${docName}" (Section: "${section}").

EXTRACTION SPECIFICATION:
1. Extract all canonical entities mentioned in the text.
   - name: Canonical proper name (e.g., "Dr. Elena Vance", "ApexBio Dynamics", "Refractory Parkinson's Disease", "NeuroPlex Bridge").
   - type: Must be strictly one of: 'Person', 'Organization', 'Technology', 'Condition', 'Location', 'Concept', 'Product', 'ClinicalTrial'.
   - aliases: Array of known abbreviations, acronyms, or variant names mentioned or implied (e.g., ["CerebroSync", "CS-AI"] or ["ApexBio"]).
   - description: 1 concise sentence describing the entity in this context.
   - sourceEvidence: Verbatim sentence where the entity is introduced.

2. Extract explicit relationships as subject -> predicate -> object triples:
   - sourceName: Subject entity canonical name.
   - targetName: Object entity canonical name.
   - relationType: Uppercase predicate verb phrase (e.g., DEVELOPED, EMPLOYED_BY, TREATS, LOCATED_IN, PARTNERED_WITH, MANUFACTURES, FOUNDED, EVALUATES, AFFILIATED_WITH, DIRECTS, GRANTED_DESIGNATION, CAUSES, DEPENDS_ON).
   - snippet: Exact verbatim sentence from the text proving the relationship.
   - confidence: Numeric confidence from 0.0 to 1.0 (1.0 for direct explicit assertion, 0.75 for clear factual implication).
   - isContradiction: Set to true ONLY if the text explicitly contradicts, rejects, or disproves a claim (e.g. "X failed to treat Y" or "X does NOT work").
   - conflictNote: If isContradiction is true, explain what is contradicted.

RULES:
- Do NOT hallucinate entities or relationships not backed by the provided text.
- Maintain source traceability.

DOCUMENT TEXT:
"""${chunkText}"""`;

    const response = await this.executeWithRetry(async () => {
      return await this.ai!.models.generateContent({
        model: this.primaryModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: {
                      type: Type.STRING,
                      enum: [
                        'Person',
                        'Organization',
                        'Technology',
                        'Condition',
                        'Location',
                        'Concept',
                        'Product',
                        'ClinicalTrial',
                      ],
                    },
                    aliases: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    description: { type: Type.STRING },
                    sourceEvidence: { type: Type.STRING },
                  },
                  required: ['name', 'type'],
                },
              },
              relationships: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceName: { type: Type.STRING },
                    targetName: { type: Type.STRING },
                    relationType: { type: Type.STRING },
                    snippet: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    isContradiction: { type: Type.BOOLEAN },
                    conflictNote: { type: Type.STRING },
                  },
                  required: ['sourceName', 'targetName', 'relationType', 'snippet'],
                },
              },
            },
            required: ['entities', 'relationships'],
          },
        },
      });
    }, 2, 800);

    const raw = response.text?.trim() || '{}';
    try {
      const parsed = JSON.parse(raw);
      return {
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      };
    } catch (parseErr) {
      throw new Error(`Failed to parse structured JSON from Gemini: ${(parseErr as Error).message}`);
    }
  }

  /**
   * Grounded Question-Answering Synthesis with Gemini Flash
   */
  public async synthesizeAnswer(
    question: string,
    topChunks: { chunk: { id: string; documentName: string; pageOrSection: string; text: string }; score: number }[],
    traversedRelationships: { sourceEntityName: string; targetEntityName: string; type: string; documentName: string; snippet: string }[],
    conversationHistory: { sender: string; text: string }[] = []
  ): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini API is not configured.');
    }

    const conversationContext = conversationHistory.length > 0
      ? `RECENT CONVERSATION HISTORY (for context reference only):\n${conversationHistory
          .slice(-3)
          .map((m) => `${m.sender.toUpperCase()}: "${m.text}"`)
          .join('\n')}\n\n`
      : '';

    const systemPrompt = `You are Crosslink, an evidence-grounded research assistant powered by knowledge graphs.
Answer the user's research question STRICTLY and SOLELY based on the provided Knowledge Graph relationships and Document Evidence Chunks.

GROUNDING & CITATION RULES:
1. Every factual assertion MUST include an inline citation in brackets using the source document and section, e.g. [DocumentName: Section].
2. If multiple documents connect facts (multi-hop reasoning), explicitly mention the connecting path across sources.
3. If the retrieved evidence does not contain sufficient facts to answer any aspect of the question, clearly state: "The retrieved documents do not contain evidence regarding..." Never guess, extrapolate, or invent facts.
4. If there are conflicting claims in the evidence, clearly report the contradiction and cite both sources.
5. Be concise, rigorous, and direct.

${conversationContext}RETRIEVED KNOWLEDGE GRAPH RELATIONSHIPS:
${
  traversedRelationships.length > 0
    ? traversedRelationships
        .map(
          (r, idx) =>
            `${idx + 1}. [${r.sourceEntityName}] --(${r.type})--> [${r.targetEntityName}] | Source: [${r.documentName}] | Quote: "${r.snippet}"`
        )
        .join('\n')
    : 'No direct graph relationships traversed.'
}

RETRIEVED DOCUMENT EVIDENCE CHUNKS:
${
  topChunks.length > 0
    ? topChunks
        .map(
          (tc, idx) =>
            `Chunk #${idx + 1} [ID: ${tc.chunk.id}, Doc: "${tc.chunk.documentName}", Section: "${tc.chunk.pageOrSection}", Relevance: ${(tc.score * 100).toFixed(0)}%]:
"${tc.chunk.text}"`
        )
        .join('\n\n')
    : 'No document chunks retrieved.'
}

USER QUESTION:
"${question}"`;

    const response = await this.executeWithRetry(async () => {
      return await this.ai!.models.generateContent({
        model: this.primaryModel,
        contents: systemPrompt,
        config: {
          temperature: 0.2,
        },
      });
    }, 2, 700);

    const answer = response.text?.trim() || '';
    if (!answer) {
      throw new Error('Gemini returned an empty response.');
    }
    return answer;
  }
}

export const geminiService = new GeminiService();
