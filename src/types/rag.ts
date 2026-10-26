export type DocumentStatus = 'pending' | 'chunking' | 'extracting' | 'indexed' | 'error';

export interface DocumentItem {
  id: string;
  name: string;
  type: 'pdf' | 'txt' | 'md' | 'json';
  size: number;
  status: DocumentStatus;
  errorMessage?: string;
  createdAt: string;
  chunkCount: number;
  entityCount: number;
  isDemo?: boolean;
}

export interface ChunkItem {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  pageOrSection: string;
  chunkIndex: number;
  embedding?: number[];
  entityIds: string[];
  isDemo?: boolean;
}

export type EntityType =
  | 'Person'
  | 'Organization'
  | 'Technology'
  | 'Condition'
  | 'Location'
  | 'Concept'
  | 'Product'
  | 'ClinicalTrial';

export interface EntityItem {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  mentionCount: number;
  chunkIds: string[];
  aliases?: string[];
  isDemo?: boolean;
}

export interface RelationshipItem {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntityName: string;
  targetEntityName: string;
  type: string;
  description?: string;
  sourceChunkId: string;
  documentId: string;
  documentName: string;
  snippet: string;
  confidence?: number;
  isConflict?: boolean;
  conflictNote?: string;
  isDemo?: boolean;
}

export interface CitationItem {
  documentId: string;
  documentName: string;
  chunkId: string;
  pageOrSection: string;
  snippet: string;
  relevanceScore: number;
  isDemo?: boolean;
}

export interface GraphPath {
  nodes: { id: string; name: string; type: EntityType }[];
  edges: { source: string; target: string; type: string }[];
  description: string;
}

export interface AskQueryResponse {
  id: string;
  question: string;
  answer: string;
  citations: CitationItem[];
  graphPaths: GraphPath[];
  retrievedChunks: { chunk: ChunkItem; score: number }[];
  matchedEntities: EntityItem[];
  traversedRelationships: RelationshipItem[];
  confidence: 'high' | 'medium' | 'low' | 'insufficient_evidence';
  processingTimeMs: number;
  timestamp: string;
  modelUsed: string;
  evidenceSufficient: boolean;
  retrievalMode: 'hybrid' | 'vector_only' | 'graph_only';
}

export interface AppSettings {
  retrievalMode: 'hybrid' | 'vector_only' | 'graph_only';
  topKChunks: number;
  graphMaxHops: number;
  minSimilarityScore: number;
  chunkSize: number;
  chunkOverlap: number;
  modelName: string;
  embeddingModel: string;
}

export interface ServerStatusResponse {
  geminiConfigured: boolean;
  geminiStatusDetails?: {
    healthy: boolean;
    errorType?: string;
    message: string;
    lastTested?: string;
  };
  model: string;
  embeddingModel: string;
  documentsCount: number;
  chunksCount: number;
  entitiesCount: number;
  relationshipsCount: number;
  conflictsCount?: number;
  hasDemoData: boolean;
  hasUserData: boolean;
  firebaseConfigured?: boolean;
}

export type AssistantActionType =
  | 'ask'
  | 'summarize'
  | 'find_connections'
  | 'compare'
  | 'check_claim'
  | 'research_gaps'
  | 'explain_graph';

export type ClaimVerdict =
  | 'supported'
  | 'contradicted'
  | 'partially_supported'
  | 'insufficient_evidence';

export interface AssistantScope {
  type: 'all' | 'selected' | 'current';
  documentIds?: string[];
  documentNames?: string[];
  entityId?: string;
  entityName?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionType?: AssistantActionType;
  ragResponse?: AskQueryResponse;
  claimVerdict?: ClaimVerdict;
  suggestedQuestions?: string[];
  scopeUsed?: AssistantScope;
  error?: boolean;
}

export interface AssistantConversation {
  id: string;
  title: string;
  messages: AssistantMessage[];
  scope: AssistantScope;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantChatRequest {
  conversationId?: string;
  message: string;
  actionType?: AssistantActionType;
  scope?: AssistantScope;
  retrievalMode?: 'hybrid' | 'vector_only' | 'graph_only';
  entityA?: string;
  entityB?: string;
  claim?: string;
}

export interface AssistantChatResponse {
  conversationId: string;
  message: AssistantMessage;
  queryResponse?: AskQueryResponse;
}
