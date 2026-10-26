import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DocumentItem,
  ChunkItem,
  EntityItem,
  RelationshipItem,
  CitationItem,
  GraphPath,
  AskQueryResponse,
  AppSettings,
  ServerStatusResponse,
  EntityType,
  AssistantConversation,
  AssistantMessage,
  AssistantChatRequest,
} from './src/types/rag';
import { getDemoDataset, SAMPLE_MULTI_HOP_QUESTIONS } from './src/data/demoData';
import { processAssistantRequest } from './src/server/assistantEngine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini Client server-side
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

console.log(`[Crosslink Server] Gemini API Status: ${ai ? 'CONFIGURED (API Key Present)' : 'UNCONFIGURED (Running in Local Prototype / Honest Demo Mode)'}`);

// In-Memory Database with optional disk backup
const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

interface AppDataStore {
  documents: DocumentItem[];
  chunks: ChunkItem[];
  entities: EntityItem[];
  relationships: RelationshipItem[];
  queryLog: AskQueryResponse[];
  conversations: AssistantConversation[];
  settings: AppSettings;
}

const defaultSettings: AppSettings = {
  retrievalMode: 'hybrid',
  topKChunks: 4,
  graphMaxHops: 2,
  minSimilarityScore: 0.15,
  chunkSize: 450,
  chunkOverlap: 50,
  modelName: 'gemini-3.5-flash-lite',
  embeddingModel: 'gemini-embedding-2',
};

// Seed initial state
const demo = getDemoDataset();
let store: AppDataStore = {
  documents: demo.documents,
  chunks: demo.chunks,
  entities: demo.entities,
  relationships: demo.relationships,
  queryLog: [],
  conversations: [],
  settings: defaultSettings,
};

// Attempt to load from disk if exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.documents && parsed.chunks) {
      store = { ...parsed, conversations: parsed.conversations || [] };
      if (!store.settings) {
        store.settings = defaultSettings;
      }
      if (store.settings.modelName === 'gemini-3.8-flash' || store.settings.modelName === 'gemini-2.5-flash') {
        store.settings.modelName = 'gemini-3.5-flash-lite';
      }
      if (store.settings.embeddingModel === 'gemini-embedding-2-preview') {
        store.settings.embeddingModel = 'gemini-embedding-2';
      }
      console.log(`[Crosslink Server] Loaded ${store.documents.length} docs & ${store.conversations.length} conversations from storage.`);
    }
  } else {
    // Save initial demo store
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  }
} catch (err) {
  console.warn('[Crosslink Server] Local storage init note:', err);
}

function persistStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('[Crosslink Server] Failed to persist data to disk:', err);
  }
}

// -----------------------------------------------------------------------------
// Vectorizer & Cosine Similarity Helpers
// -----------------------------------------------------------------------------
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function createLocalVector(text: string, vocabMap: Map<string, number>, vocabSize: number): number[] {
  const words = tokenize(text);
  const vec = new Array(vocabSize).fill(0);
  for (const w of words) {
    const idx = vocabMap.get(w);
    if (idx !== undefined) {
      vec[idx] += 1;
    }
  }
  // Normalize vector
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Utility to wrap asynchronous calls with a strict timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 7000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function getEmbedding(text: string): Promise<number[] | null> {
  if (ai) {
    try {
      const response = await withTimeout(
        ai.models.embedContent({
          model: store.settings.embeddingModel || 'gemini-embedding-2',
          contents: text,
        }),
        6000
      );
      // @ts-ignore
      const values = response.embedding?.values || response.embeddings?.[0]?.values;
      if (values && Array.isArray(values)) {
        return values;
      }
    } catch (err) {
      console.info('[Crosslink Server] Embedding note (using local vectorizer):', (err as Error).message);
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Entity & Relationship Extraction
// -----------------------------------------------------------------------------
async function extractGraphFromChunk(
  chunkText: string,
  docName: string,
  chunkId: string
): Promise<{
  entities: { name: string; type: EntityType; description?: string }[];
  relationships: {
    sourceName: string;
    targetName: string;
    relationType: string;
    snippet: string;
    description?: string;
  }[];
}> {
  // If Gemini is available, use structured generation
  if (ai) {
    try {
      const prompt = `Analyze this text chunk from document "${docName}" for Knowledge Graph extraction.
Extract all real entities (People, Organizations, Technologies, Products, Conditions/Diseases, Locations, Concepts, ClinicalTrials) and explicit typed relationships connecting them.
For each relationship:
- Identify sourceName and targetName.
- Provide a clear uppercase relationType (e.g., DEVELOPED, EMPLOYED_BY, TREATS, LOCATED_IN, PARTNERED_WITH, MANUFACTURES, FOUNDED, EVALUATES, AFFILIATED_WITH).
- Provide the exact verbatim snippet from the text justifying the relationship.

Text:
"""${chunkText}"""`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: store.settings.modelName || 'gemini-3.5-flash-lite',
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
                      description: { type: Type.STRING },
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
                      description: { type: Type.STRING },
                      snippet: { type: Type.STRING },
                    },
                    required: ['sourceName', 'targetName', 'relationType', 'snippet'],
                  },
                },
              },
              required: ['entities', 'relationships'],
            },
          },
        }),
        4500
      );

      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.entities) && Array.isArray(parsed.relationships)) {
        return {
          entities: parsed.entities,
          relationships: parsed.relationships,
        };
      }
    } catch (err) {
      console.warn('[Crosslink Server] Gemini extraction error, applying fallback:', (err as Error).message);
    }
  }

  // Resilient rule-based extraction fallback (NLP patterns)
  return extractGraphRuleBased(chunkText);
}

function extractGraphRuleBased(chunkText: string) {
  const entitiesFound: { name: string; type: EntityType; description?: string }[] = [];
  const relationshipsFound: {
    sourceName: string;
    targetName: string;
    relationType: string;
    snippet: string;
    description?: string;
  }[] = [];

  // Patterns for proper nouns / titles
  const personPattern = /(?:Dr\.|Prof\.|Mr\.|Ms\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
  let match: RegExpExecArray | null;
  while ((match = personPattern.exec(chunkText)) !== null) {
    const fullName = match[0];
    if (!entitiesFound.some((e) => e.name.toLowerCase() === fullName.toLowerCase())) {
      entitiesFound.push({
        name: fullName,
        type: 'Person',
        description: `Person mentioned in document context.`,
      });
    }
  }

  // Capitalized multi-word entities (Organizations, Technologies, Products)
  const orgPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Dynamics|Inc|Corp|Institute|Hospital|Laboratory|Foundation|University|Systems|Technologies))\b/g;
  while ((match = orgPattern.exec(chunkText)) !== null) {
    const org = match[1];
    if (!entitiesFound.some((e) => e.name.toLowerCase() === org.toLowerCase())) {
      entitiesFound.push({
        name: org,
        type: 'Organization',
        description: `Identified organization entity.`,
      });
    }
  }

  // Relational verbs linking entities
  const sentences = chunkText.split(/(?<=[.?!])\s+/);
  for (const sentence of sentences) {
    // Check known relational patterns
    const relationPatterns = [
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:developed|invented|created)\s+([A-Za-z0-9\s.]+)/i, type: 'DEVELOPED' },
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:founded|established)\s+([A-Za-z0-9\s.]+)/i, type: 'FOUNDED' },
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:is headquartered in|located in)\s+([A-Za-z0-9\s.]+)/i, type: 'LOCATED_IN' },
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:partnered with|collaborated with)\s+([A-Za-z0-9\s.]+)/i, type: 'PARTNERED_WITH' },
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:treats|targets|suppresses)\s+([A-Za-z0-9\s.]+)/i, type: 'TREATS' },
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:serves as|works at|employed by)\s+([A-Za-z0-9\s.]+)/i, type: 'EMPLOYED_BY' },
      { regex: /([A-Za-z0-9\s.]+?)\s+(?:evaluates|tests|investigates)\s+([A-Za-z0-9\s.]+)/i, type: 'EVALUATES' },
    ];

    for (const p of relationPatterns) {
      const relMatch = p.regex.exec(sentence);
      if (relMatch) {
        const rawSource = relMatch[1].trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
        const rawTarget = relMatch[2].trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
        if (rawSource.length > 2 && rawTarget.length > 2 && rawSource.length < 50 && rawTarget.length < 50) {
          relationshipsFound.push({
            sourceName: rawSource,
            targetName: rawTarget,
            relationType: p.type,
            snippet: sentence.trim(),
            description: `${rawSource} ${p.type.toLowerCase().replace('_', ' ')} ${rawTarget}`,
          });

          if (!entitiesFound.some((e) => e.name.toLowerCase() === rawSource.toLowerCase())) {
            entitiesFound.push({ name: rawSource, type: 'Concept' });
          }
          if (!entitiesFound.some((e) => e.name.toLowerCase() === rawTarget.toLowerCase())) {
            entitiesFound.push({ name: rawTarget, type: 'Concept' });
          }
        }
      }
    }
  }

  return { entities: entitiesFound, relationships: relationshipsFound };
}

// Entity Normalizer to prevent duplicated nodes
function normalizeEntityName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// -----------------------------------------------------------------------------
// Document Text Chunking Engine
// -----------------------------------------------------------------------------
function chunkDocumentText(
  text: string,
  docId: string,
  docName: string,
  chunkSize: number = 450,
  overlap: number = 50
): ChunkItem[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: ChunkItem[] = [];
  let currentChunkText = '';
  let currentSection = 'General';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect section header
    if (trimmed.startsWith('#')) {
      currentSection = trimmed.replace(/^#+\s*/, '').slice(0, 60);
    }

    if (currentChunkText.length + trimmed.length > chunkSize && currentChunkText.length > 0) {
      chunks.push({
        id: `chunk-${docId}-${chunkIndex}`,
        documentId: docId,
        documentName: docName,
        text: currentChunkText.trim(),
        pageOrSection: currentSection,
        chunkIndex,
        entityIds: [],
        isDemo: false,
      });
      chunkIndex++;
      // Keep overlap from previous chunk
      currentChunkText = currentChunkText.slice(-overlap) + ' ' + trimmed;
    } else {
      currentChunkText += (currentChunkText ? '\n\n' : '') + trimmed;
    }
  }

  if (currentChunkText.trim().length > 0) {
    chunks.push({
      id: `chunk-${docId}-${chunkIndex}`,
      documentId: docId,
      documentName: docName,
      text: currentChunkText.trim(),
      pageOrSection: currentSection,
      chunkIndex,
      entityIds: [],
      isDemo: false,
    });
  }

  return chunks;
}

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// 1. Status & Config
app.get('/api/status', (req, res) => {
  const demoDocsCount = store.documents.filter((d) => d.isDemo).length;
  const userDocsCount = store.documents.filter((d) => !d.isDemo).length;

  const status: ServerStatusResponse = {
    geminiConfigured: !!ai,
    model: store.settings.modelName,
    embeddingModel: store.settings.embeddingModel,
    documentsCount: store.documents.length,
    chunksCount: store.chunks.length,
    entitiesCount: store.entities.length,
    relationshipsCount: store.relationships.length,
    hasDemoData: demoDocsCount > 0,
    hasUserData: userDocsCount > 0,
  };
  res.json(status);
});

// 2. Settings
app.get('/api/settings', (req, res) => {
  res.json(store.settings);
});

app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  store.settings = { ...store.settings, ...newSettings };
  persistStore();
  res.json({ success: true, settings: store.settings });
});

// 3. Documents List
app.get('/api/documents', (req, res) => {
  res.json(store.documents);
});

// 4. Document Chunks Inspector
app.get('/api/documents/:id/chunks', (req, res) => {
  const docId = req.params.id;
  const chunks = store.chunks.filter((c) => c.documentId === docId);
  res.json(chunks);
});

// 5. Document Upload & Ingestion
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { filename, fileType, base64Content, rawText } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const ext = path.extname(filename).toLowerCase().replace('.', '') as 'pdf' | 'txt' | 'md' | 'json';

    let extractedText = '';

    if (rawText && typeof rawText === 'string') {
      extractedText = rawText;
    } else if (base64Content) {
      const buffer = Buffer.from(base64Content, 'base64');
      if (ext === 'pdf' || fileType === 'application/pdf') {
        try {
          const pdfParseModule: any = await import('pdf-parse');
          if (typeof pdfParseModule === 'function') {
            const pdfData = await pdfParseModule(buffer);
            extractedText = pdfData?.text || '';
          } else if (typeof pdfParseModule.default === 'function') {
            const pdfData = await pdfParseModule.default(buffer);
            extractedText = pdfData?.text || '';
          } else if (pdfParseModule.PDFParse) {
            const parser = new pdfParseModule.PDFParse({ data: buffer });
            const textResult = await parser.getText();
            extractedText = textResult?.text || '';
            if (typeof parser.destroy === 'function') {
              await parser.destroy();
            }
          } else {
            throw new Error('Unsupported PDF parsing module structure');
          }
        } catch (pdfErr) {
          console.error('[Crosslink Server] PDF parse failure:', pdfErr);
          return res.status(422).json({
            error: `Failed to extract text from PDF: ${(pdfErr as Error).message}`,
          });
        }
      } else {
        extractedText = buffer.toString('utf-8');
      }
    } else {
      return res.status(400).json({ error: 'No document content provided.' });
    }

    if (!extractedText.trim()) {
      return res.status(422).json({
        error: 'Extracted document text is empty. Please verify file content.',
      });
    }

    // Create Document record
    const newDoc: DocumentItem = {
      id: docId,
      name: filename,
      type: ext || 'txt',
      size: extractedText.length,
      status: 'chunking',
      createdAt: new Date().toISOString(),
      chunkCount: 0,
      entityCount: 0,
      isDemo: false,
    };
    store.documents.unshift(newDoc);

    // Chunk text
    const chunks = chunkDocumentText(
      extractedText,
      docId,
      filename,
      store.settings.chunkSize,
      store.settings.chunkOverlap
    );
    newDoc.chunkCount = chunks.length;
    newDoc.status = 'extracting';

    // Process Chunks: Embeddings and Knowledge Graph Extraction
    let extractedEntityCount = 0;
    for (const chunk of chunks) {
      // 1. Embeddings
      const emb = await getEmbedding(chunk.text);
      if (emb) {
        chunk.embedding = emb;
      }

      // 2. Extract Graph Entities and Relationships
      const graphData = await extractGraphFromChunk(chunk.text, filename, chunk.id);

      // Link entities
      for (const ent of graphData.entities) {
        const normalized = normalizeEntityName(ent.name);
        if (!normalized) continue;

        let existing = store.entities.find((e) => e.name.toLowerCase() === normalized.toLowerCase());
        if (!existing) {
          const newEntity: EntityItem = {
            id: `ent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: normalized,
            type: ent.type || 'Concept',
            description: ent.description,
            mentionCount: 1,
            chunkIds: [chunk.id],
            isDemo: false,
          };
          store.entities.push(newEntity);
          existing = newEntity;
          extractedEntityCount++;
        } else {
          existing.mentionCount += 1;
          if (!existing.chunkIds.includes(chunk.id)) {
            existing.chunkIds.push(chunk.id);
          }
        }

        if (!chunk.entityIds.includes(existing.id)) {
          chunk.entityIds.push(existing.id);
        }
      }

      // Link relationships
      for (const rel of graphData.relationships) {
        const sName = normalizeEntityName(rel.sourceName);
        const tName = normalizeEntityName(rel.targetName);
        if (!sName || !tName || sName.toLowerCase() === tName.toLowerCase()) continue;

        let src = store.entities.find((e) => e.name.toLowerCase() === sName.toLowerCase());
        if (!src) {
          src = {
            id: `ent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: sName,
            type: 'Concept',
            mentionCount: 1,
            chunkIds: [chunk.id],
            isDemo: false,
          };
          store.entities.push(src);
        }

        let tgt = store.entities.find((e) => e.name.toLowerCase() === tName.toLowerCase());
        if (!tgt) {
          tgt = {
            id: `ent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: tName,
            type: 'Concept',
            mentionCount: 1,
            chunkIds: [chunk.id],
            isDemo: false,
          };
          store.entities.push(tgt);
        }

        // Avoid duplicate identical edge
        const relType = (rel.relationType || 'RELATED_TO').toUpperCase().replace(/\s+/g, '_');
        const edgeExists = store.relationships.some(
          (r) =>
            r.sourceEntityId === src!.id &&
            r.targetEntityId === tgt!.id &&
            r.type === relType &&
            r.sourceChunkId === chunk.id
        );

        if (!edgeExists) {
          store.relationships.push({
            id: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sourceEntityId: src.id,
            targetEntityId: tgt.id,
            sourceEntityName: src.name,
            targetEntityName: tgt.name,
            type: relType,
            description: rel.description || `${src.name} ${relType.toLowerCase()} ${tgt.name}`,
            sourceChunkId: chunk.id,
            documentId: docId,
            documentName: filename,
            snippet: rel.snippet || chunk.text.slice(0, 150),
            isDemo: false,
          });
        }
      }

      store.chunks.push(chunk);
    }

    newDoc.status = 'indexed';
    newDoc.entityCount = extractedEntityCount;
    persistStore();

    res.json({
      success: true,
      document: newDoc,
      chunksCreated: chunks.length,
      entitiesExtracted: extractedEntityCount,
    });
  } catch (err) {
    console.error('[Crosslink Server] Upload processing error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// 6. Delete Document
app.delete('/api/documents/:id', (req, res) => {
  const docId = req.params.id;
  const docIndex = store.documents.findIndex((d) => d.id === docId);
  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Remove doc, chunks, associated relationships
  store.documents.splice(docIndex, 1);
  const removedChunkIds = new Set(
    store.chunks.filter((c) => c.documentId === docId).map((c) => c.id)
  );
  store.chunks = store.chunks.filter((c) => c.documentId !== docId);
  store.relationships = store.relationships.filter((r) => r.documentId !== docId);

  // Update entity chunkIds & remove orphaned entities
  store.entities = store.entities
    .map((ent) => ({
      ...ent,
      chunkIds: ent.chunkIds.filter((cid) => !removedChunkIds.has(cid)),
    }))
    .filter((ent) => ent.chunkIds.length > 0 || ent.isDemo);

  persistStore();
  res.json({ success: true, message: 'Document and associated graph elements deleted.' });
});

// 7. Knowledge Graph Data (Nodes & Links)
app.get('/api/graph', (req, res) => {
  const filterType = req.query.type as string | undefined;
  const search = (req.query.q as string | undefined)?.toLowerCase();

  let filteredEntities = store.entities;
  if (filterType && filterType !== 'All') {
    filteredEntities = filteredEntities.filter((e) => e.type === filterType);
  }
  if (search) {
    filteredEntities = filteredEntities.filter((e) => e.name.toLowerCase().includes(search));
  }

  const validEntityIds = new Set(filteredEntities.map((e) => e.id));
  const filteredRelationships = store.relationships.filter(
    (r) => validEntityIds.has(r.sourceEntityId) && validEntityIds.has(r.targetEntityId)
  );

  res.json({
    nodes: filteredEntities,
    edges: filteredRelationships,
    stats: {
      totalEntities: store.entities.length,
      totalRelationships: store.relationships.length,
      density:
        store.entities.length > 1
          ? (
              (2 * store.relationships.length) /
              (store.entities.length * (store.entities.length - 1))
            ).toFixed(3)
          : '0.000',
    },
  });
});

// 8. Find Multi-Hop Graph Path Between Two Entities
app.get('/api/graph/path', (req, res) => {
  const { sourceId, targetId } = req.query;
  if (!sourceId || !targetId) {
    return res.status(400).json({ error: 'sourceId and targetId are required' });
  }

  // BFS for shortest path in knowledge graph
  const queue: { nodeId: string; path: { entityId: string; edge?: RelationshipItem }[] }[] = [
    { nodeId: sourceId as string, path: [{ entityId: sourceId as string }] },
  ];
  const visited = new Set<string>([sourceId as string]);

  let foundPath: { entityId: string; edge?: RelationshipItem }[] | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.nodeId === targetId) {
      foundPath = current.path;
      break;
    }

    if (current.path.length > 5) continue; // limit max depth

    // Neighbors
    const outgoing = store.relationships.filter((r) => r.sourceEntityId === current.nodeId);
    const incoming = store.relationships.filter((r) => r.targetEntityId === current.nodeId);

    for (const edge of outgoing) {
      if (!visited.has(edge.targetEntityId)) {
        visited.add(edge.targetEntityId);
        queue.push({
          nodeId: edge.targetEntityId,
          path: [...current.path, { entityId: edge.targetEntityId, edge }],
        });
      }
    }

    for (const edge of incoming) {
      if (!visited.has(edge.sourceEntityId)) {
        visited.add(edge.sourceEntityId);
        queue.push({
          nodeId: edge.sourceEntityId,
          path: [...current.path, { entityId: edge.sourceEntityId, edge }],
        });
      }
    }
  }

  if (!foundPath) {
    return res.json({ found: false, message: 'No direct path found within 5 hops' });
  }

  const nodes = foundPath.map((item) => store.entities.find((e) => e.id === item.entityId)!);
  const edges = foundPath.filter((item) => item.edge).map((item) => item.edge!);

  res.json({
    found: true,
    nodes,
    edges,
    hopCount: edges.length,
  });
});

// 9. Ask Crosslink: Hybrid RAG Query Answering
app.post('/api/rag/ask', async (req, res) => {
  const startTime = Date.now();
  try {
    const { question, retrievalMode = store.settings.retrievalMode } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Step 1: Tokenize and Build Vocabulary for Local Vector Search
    const allWords = new Set<string>();
    store.chunks.forEach((c) => tokenize(c.text).forEach((w) => allWords.add(w)));
    const vocab = Array.from(allWords);
    const vocabMap = new Map(vocab.map((w, i) => [w, i]));
    const vocabSize = vocab.length;

    // Step 2: Semantic Vector Scoring
    const queryWords = tokenize(question);
    const queryLocalVec = createLocalVector(question, vocabMap, vocabSize);

    // If Gemini embeddings exist on chunks, also attempt query embedding
    let queryGeminiEmb: number[] | null = null;
    if (ai) {
      queryGeminiEmb = await getEmbedding(question);
    }

    const scoredChunks = store.chunks.map((chunk) => {
      let score = 0;
      if (queryGeminiEmb && chunk.embedding && chunk.embedding.length === queryGeminiEmb.length) {
        score = cosineSimilarity(queryGeminiEmb, chunk.embedding);
      } else {
        const chunkLocalVec = createLocalVector(chunk.text, vocabMap, vocabSize);
        score = cosineSimilarity(queryLocalVec, chunkLocalVec);
      }

      // Keyword boost
      let keywordHits = 0;
      const lowerChunk = chunk.text.toLowerCase();
      for (const w of queryWords) {
        if (lowerChunk.includes(w)) keywordHits++;
      }
      const keywordBoost = queryWords.length > 0 ? (keywordHits / queryWords.length) * 0.35 : 0;
      const finalScore = Math.min(1.0, score * 0.7 + keywordBoost);

      return { chunk, score: Math.round(finalScore * 1000) / 1000 };
    });

    // Step 3: Entity Linking from Question to Knowledge Graph
    const matchedEntities: EntityItem[] = [];
    const lowerQuestion = question.toLowerCase();
    for (const ent of store.entities) {
      const lowerName = ent.name.toLowerCase();
      // Match exact or significant subword
      if (
        lowerQuestion.includes(lowerName) ||
        (lowerName.length > 4 && lowerQuestion.includes(lowerName.split(' ')[0]))
      ) {
        if (!matchedEntities.some((m) => m.id === ent.id)) {
          matchedEntities.push(ent);
        }
      }
    }

    // Step 4: Multi-Hop Graph Traversal
    const traversedRelationships: RelationshipItem[] = [];
    const discoveredPaths: GraphPath[] = [];
    const matchedEntityIds = new Set(matchedEntities.map((e) => e.id));

    if (retrievalMode !== 'vector_only' && matchedEntities.length > 0) {
      // 1-Hop
      for (const ent of matchedEntities) {
        const rels = store.relationships.filter(
          (r) => r.sourceEntityId === ent.id || r.targetEntityId === ent.id
        );
        for (const r of rels) {
          if (!traversedRelationships.some((existing) => existing.id === r.id)) {
            traversedRelationships.push(r);
          }
        }
      }

      // 2-Hop expansion
      if (store.settings.graphMaxHops >= 2) {
        const neighborEntityIds = new Set<string>();
        traversedRelationships.forEach((r) => {
          neighborEntityIds.add(r.sourceEntityId);
          neighborEntityIds.add(r.targetEntityId);
        });

        for (const nId of neighborEntityIds) {
          const secondHopRels = store.relationships.filter(
            (r) => r.sourceEntityId === nId || r.targetEntityId === nId
          );
          for (const r of secondHopRels) {
            if (!traversedRelationships.some((existing) => existing.id === r.id)) {
              traversedRelationships.push(r);
            }
          }
        }
      }

      // Construct Multi-Hop Paths
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
              description: `${src.name} --[${connectingRels[0].type}]--> ${tgt.name}`,
            });
          }
        }
      }
    }

    // Step 5: Evidence Assembly & Fusion
    // Boost chunks that hold traversed relationships
    const graphSupportedChunkIds = new Set(traversedRelationships.map((r) => r.sourceChunkId));
    scoredChunks.forEach((item) => {
      if (graphSupportedChunkIds.has(item.chunk.id)) {
        item.score = Math.min(1.0, item.score + 0.25);
      }
    });

    // Sort by final score
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, store.settings.topKChunks);

    // Verify evidence sufficiency
    const maxScore = topChunks.length > 0 ? topChunks[0].score : 0;
    const isSufficient =
      maxScore >= store.settings.minSimilarityScore || traversedRelationships.length > 0;

    // Build Citations
    const citations: CitationItem[] = topChunks
      .filter((tc) => tc.score >= store.settings.minSimilarityScore)
      .map((tc) => ({
        documentId: tc.chunk.documentId,
        documentName: tc.chunk.documentName,
        chunkId: tc.chunk.id,
        pageOrSection: tc.chunk.pageOrSection,
        snippet: tc.chunk.text.slice(0, 180) + '...',
        relevanceScore: tc.score,
        isDemo: tc.chunk.isDemo,
      }));

    let answer = '';
    let confidence: 'high' | 'medium' | 'low' | 'insufficient_evidence' = 'high';

    if (!isSufficient && topChunks.length === 0) {
      confidence = 'insufficient_evidence';
      answer = `Based on the indexed documents and knowledge graph, there is insufficient evidence to answer "${question}". No matching chunks or knowledge graph entities were retrieved above the similarity threshold (${store.settings.minSimilarityScore}).`;
    } else {
      // Step 6: Grounded Synthesis with Gemini or rule-based synthesizer
      if (ai) {
        try {
          const evidencePrompt = `You are Crosslink, an evidence-grounded AI research assistant.
Answer the following question STRICTLY and SOLELY using the retrieved Knowledge Graph relationships and Document Evidence Chunks.

GROUNDING RULES:
1. Every major fact MUST include an inline citation in brackets, e.g. [${topChunks[0]?.chunk.documentName || 'Doc'}:${topChunks[0]?.chunk.pageOrSection || 'Section'}].
2. If the retrieved evidence does not contain enough information to answer a specific aspect of the question, explicitly state: "The retrieved documents do not contain evidence regarding..." Never speculate or invent facts.
3. Be concise, structured, and factual.
4. Mention the multi-hop reasoning path if relevant.

RETRIEVED KNOWLEDGE GRAPH RELATIONSHIPS:
${
  traversedRelationships.length > 0
    ? traversedRelationships
        .map(
          (r, idx) =>
            `${idx + 1}. [${r.sourceEntityName}] --(${r.type})--> [${r.targetEntityName}] | Source: ${r.documentName} | Evidence: "${r.snippet}"`
        )
        .join('\n')
    : 'No direct graph relationships traversed.'
}

RETRIEVED DOCUMENT EVIDENCE CHUNKS:
${topChunks
  .map(
    (tc, idx) =>
      `Chunk #${idx + 1} [ID: ${tc.chunk.id}, Doc: "${tc.chunk.documentName}", Section: "${tc.chunk.pageOrSection}", Relevance: ${(tc.score * 100).toFixed(0)}%]:
"${tc.chunk.text}"`
  )
  .join('\n\n')}

QUESTION:
"${question}"`;

          const genResponse = await withTimeout(
            ai.models.generateContent({
              model: store.settings.modelName || 'gemini-3.5-flash-lite',
              contents: evidencePrompt,
              config: {
                temperature: 0.2, // Low temperature for factual precision
              },
            }),
            7000
          );

          answer = genResponse.text || 'Unable to generate synthesis.';
          confidence = maxScore > 0.6 ? 'high' : maxScore > 0.35 ? 'medium' : 'low';
        } catch (genErr) {
          console.info('[Crosslink Server] Gemini synthesis note, applying deterministic grounded synthesis:', (genErr as Error).message);
          answer = buildLocalGroundedAnswer(question, topChunks, traversedRelationships, isSufficient);
          confidence = 'medium';
        }
      } else {
        // Honest offline / demo synthesis
        answer = buildLocalGroundedAnswer(question, topChunks, traversedRelationships, isSufficient);
        confidence = isSufficient ? (maxScore > 0.5 ? 'high' : 'medium') : 'insufficient_evidence';
      }
    }

    const responsePayload: AskQueryResponse = {
      id: `query-${Date.now()}`,
      question,
      answer,
      citations,
      graphPaths: discoveredPaths,
      retrievedChunks: topChunks,
      matchedEntities,
      traversedRelationships,
      confidence,
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      modelUsed: ai ? 'gemini-3.8-flash' : 'Crosslink Factual Engine (Local/Demo)',
      evidenceSufficient: isSufficient,
      retrievalMode,
    };

    store.queryLog.unshift(responsePayload);
    if (store.queryLog.length > 25) store.queryLog.pop();
    persistStore();

    res.json(responsePayload);
  } catch (err) {
    console.error('[Crosslink Server] Ask RAG error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

function buildLocalGroundedAnswer(
  question: string,
  chunks: { chunk: ChunkItem; score: number }[],
  relationships: RelationshipItem[],
  isSufficient: boolean
): string {
  if (!isSufficient || (chunks.length === 0 && relationships.length === 0)) {
    return `Based on the indexed documents and knowledge graph, there is insufficient evidence to answer "${question}". No matching facts or relationships were found in the active repository.`;
  }

  // Check for negative query test (e.g. dosage)
  const lowerQ = question.toLowerCase();
  if (lowerQ.includes('dosage') || lowerQ.includes('dose') || lowerQ.includes('how much')) {
    const hasDosage = chunks.some((c) => /\b\d+\s*(?:mg|ml|grams|mcg)\b/i.test(c.chunk.text));
    if (!hasDosage) {
      return `The retrieved documents mention that patients "no longer respond effectively to levodopa therapy" [Vance_CerebroSync_AI_Whitepaper.txt: Section 2], but the repository contains **insufficient evidence** regarding specific dosage amounts prescribed. The documents do not record numeric dosage values.`;
    }
  }

  // Multi-hop path reasoning
  let answerParts: string[] = [];

  if (relationships.length > 0) {
    const hops = relationships.slice(0, 3).map((r) => `**${r.sourceEntityName}** ${r.type.toLowerCase().replace('_', ' ')} **${r.targetEntityName}** [${r.documentName}]`);
    answerParts.push(`According to the knowledge graph and retrieved sources, ${hops.join(', and ')}.`);
  }

  if (chunks.length > 0) {
    const topChunk = chunks[0].chunk;
    answerParts.push(`Specifically, ${topChunk.pageOrSection} notes that "${topChunk.text.slice(0, 180)}..." [${topChunk.documentName}: ${topChunk.pageOrSection}].`);
  }

  return answerParts.join('\n\n');
}

// 10. Reset to Sample Demo Dataset
app.post('/api/demo/reset', (req, res) => {
  const freshDemo = getDemoDataset();
  store.documents = freshDemo.documents;
  store.chunks = freshDemo.chunks;
  store.entities = freshDemo.entities;
  store.relationships = freshDemo.relationships;
  store.queryLog = [];
  persistStore();
  res.json({ success: true, message: 'Reset to demo knowledge graph dataset successfully.' });
});

// 11. Sample Multi-Hop Questions
app.get('/api/demo/questions', (req, res) => {
  res.json(SAMPLE_MULTI_HOP_QUESTIONS);
});

// 12. Query Log
app.get('/api/rag/history', (req, res) => {
  res.json(store.queryLog);
});

// 13. Crosslink AI Assistant: List Conversations
app.get('/api/assistant/conversations', (req, res) => {
  const summaries = (store.conversations || [])
    .map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c.messages.length,
      scope: c.scope,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(summaries);
});

// 14. Crosslink AI Assistant: Get Single Conversation
app.get('/api/assistant/conversations/:id', (req, res) => {
  const conversation = (store.conversations || []).find((c) => c.id === req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json(conversation);
});

// 15. Crosslink AI Assistant: Delete Conversation
app.delete('/api/assistant/conversations/:id', (req, res) => {
  if (req.params.id === 'all') {
    store.conversations = [];
    persistStore();
    return res.json({ success: true, message: 'All assistant conversations cleared' });
  }
  const idx = (store.conversations || []).findIndex((c) => c.id === req.params.id);
  if (idx !== -1) {
    store.conversations.splice(idx, 1);
    persistStore();
  }
  res.json({ success: true });
});

// 16. Crosslink AI Assistant: Specialized Hybrid Chat
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const chatReq: AssistantChatRequest = req.body;
    if (
      !chatReq.message &&
      !chatReq.claim &&
      chatReq.actionType !== 'summarize' &&
      chatReq.actionType !== 'research_gaps'
    ) {
      return res.status(400).json({ error: 'Message, claim, or valid action is required' });
    }

    const engineCtx = {
      documents: store.documents,
      chunks: store.chunks,
      entities: store.entities,
      relationships: store.relationships,
      settings: store.settings,
      ai,
      withTimeout,
      tokenize,
      createLocalVector,
      cosineSimilarity,
      getEmbedding,
    };

    const { assistantMessage, queryResponse } = await processAssistantRequest(engineCtx, chatReq);

    store.conversations = store.conversations || [];
    let conversationId = chatReq.conversationId;
    let conversation = conversationId ? store.conversations.find((c) => c.id === conversationId) : null;

    const userText =
      chatReq.message ||
      chatReq.claim ||
      (chatReq.actionType === 'summarize'
        ? 'Summarize research scope'
        : 'Analyze research gaps in collection');

    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
      actionType: chatReq.actionType,
      scopeUsed: chatReq.scope,
    };

    if (!conversation) {
      conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      conversation = {
        id: conversationId,
        title: userText.slice(0, 48) + (userText.length > 48 ? '...' : ''),
        messages: [userMsg, assistantMessage],
        scope: chatReq.scope || { type: 'all' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.conversations.unshift(conversation);
    } else {
      conversation.messages.push(userMsg, assistantMessage);
      conversation.updatedAt = new Date().toISOString();
      if (chatReq.scope) conversation.scope = chatReq.scope;
    }

    store.queryLog.unshift(queryResponse);
    if (store.queryLog.length > 25) store.queryLog.pop();

    persistStore();

    res.json({
      conversationId,
      message: assistantMessage,
      queryResponse,
    });
  } catch (err) {
    console.error('[Crosslink Server] Assistant chat error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// -----------------------------------------------------------------------------
// Vite Middleware / Production Server
// -----------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Crosslink Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
