# Crosslink — Knowledge-Graph RAG

Crosslink is a full-stack AI research assistant combining document indexing, entity-relationship knowledge graph extraction, and hybrid retrieval: semantic vector search fused with multi-hop graph traversal. Answers are strictly grounded in retrieved evidence with verifiable source citations and provenance trails.

---

## Key Features

1. **Document Ingestion & Chunking**:
   - Supports **PDF**, **TXT**, and **Markdown (.md)** files (or direct raw text paste).
   - Extracts text, splits into configured chunk sizes with sentence boundary awareness and overlap, and generates vector embeddings.
   - Files are never marked as indexed before chunking and extraction succeed.

2. **Knowledge Graph Extraction & Interactive Visualization**:
   - Extracts typed real-world entities (*People, Organizations, Technologies, Products, Medical Conditions, Locations, Concepts, Clinical Trials*).
   - Extracts typed relationships with exact verbatim text snippets for provenance (*DEVELOPED, EMPLOYED_BY, TREATS, LOCATED_IN, PARTNERED_WITH, MANUFACTURES, FOUNDED, EVALUATES*).
   - Interactive force-directed canvas with zoom, pan, dragging, entity filters, node search, and a **Multi-Hop Path Finder** (BFS shortest knowledge trail).

3. **Hybrid RAG Retrieval Engine**:
   - **Step 1: Entity Linking** — Matches tokens in the query against knowledge graph nodes.
   - **Step 2: Vector Similarity** — Calculates mathematical cosine similarity scores against text chunk vectors.
   - **Step 3: Multi-Hop Traversal** — Expands 1-hop and 2-hop graph neighborhoods from matched entities to discover connecting facts across different documents.
   - **Step 4: Evidence Fusion** — Boosts chunks supporting traversed relations and combines evidence.
   - **Step 5: Grounded Synthesis** — Powered by Gemini 3.8 Flash (`gemini-3.8-flash`) with inline citation tags (`[DocName:Section]`).
   - **Zero Hallucination Guarantee** — If retrieved evidence does not contain sufficient facts to answer, Crosslink explicitly states what is missing instead of guessing.

4. **Evidence Explorer (Transparency Lab)**:
   - Dedicated 5-step audit tool to inspect tokenization, raw vector cosine scores, traversed graph edges, the exact prompt context assembled for the LLM, and an explicit comparison of verifiable extracted facts vs. AI synthesis.

5. **Demo Dataset**:
   - Pre-loaded with a cohesive fictional scenario:
     - **ApexBio Dynamics** (Boston neuro-engineering firm)
     - **Dr. Elena Vance** (Chief AI Neuroscientist)
     - **CerebroSync AI** (Closed-loop reinforcement learning tremor model)
     - **NeuroPlex Bridge** (Hardware neural interface)
     - **St. Jude Neurological Institute** & **Dr. Marcus Thorne** (Clinical Trial #NCT-09428)
     - **Refractory Parkinson's Disease** (Therapeutic target with FDA Breakthrough Designation)
   - Labeled clearly as `DEMO DATA` so users can easily distinguish it from their own uploaded documents.

---

## Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, Motion, D3-Force physics simulation.
- **Backend**: Node.js, Express, TypeScript (`tsx server.ts`), `pdf-parse` for PDF text extraction.
- **AI & Embedding SDK**: `@google/genai` (Gemini 3.8 Flash for extraction and synthesis, `gemini-embedding-2-preview` for embeddings with mathematical cosine vector fallback).
- **Security**: All Gemini API calls run server-side. No API keys are ever sent to or exposed in the client browser.

---

## Environment Variables

Defined in `.env.example`:

```bash
# GEMINI_API_KEY: Attached via Settings > Secrets in Google AI Studio
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: Cloud Run service URL
APP_URL="MY_APP_URL"
```

---

## Running the Application

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack development server (runs Express + Vite on port 3000)
npm run dev

# 3. Build for production
npm run build
npm run start
```
