# Evidence-Aware Answers with Chunk Citations - Implementation Guide

## Overview

This guide walks through the complete implementation of traceable, evidence-aware citations in your RAG pipeline. Each chunk now has a stable ID (C1, C2, etc.), and answers include inline citations that users can verify against source documents.

---

## Step-by-Step Implementation

### Step 1: Stable Chunk Identifiers (serialization.py) ✅

**What Changed:**

- Added `serialize_chunks_with_ids()` function that generates stable chunk IDs (C1, C2, etc.)
- Returns both formatted context AND a citation_map with metadata

**How it Works:**

```python
def serialize_chunks_with_ids(docs: List[Document]) -> Tuple[str, Dict[str, Dict[str, Any]]]:
    """
    Input: List of Document objects
    Output: (context_string_with_IDs, citation_map)

    Example:
    Input docs: [Document(content="HNSW..."), Document(content="LSH...")]

    Output context:
    "[C1] Chunk from page 5:
    HNSW provides fast approximate search...

    [C2] Chunk from page 6:
    LSH uses hash functions..."

    Output citation_map:
    {
        "C1": {
            "page": 5,
            "snippet": "HNSW provides...",
            "source": "vector_db.pdf"
        },
        "C2": {...}
    }
    """
```

**Files Modified:**

- `src/app/core/retrieval/serialization.py`

---

### Step 2: State Schema Update (state.py) ✅

**What Changed:**

- Added `citations` field to `QAState` TypedDict
- Citations flow through the entire pipeline (Retrieval → Summarization → Verification)

**Code:**

```python
class QAState(TypedDict):
    question: str
    context: Optional[str]
    draft_answer: Optional[str]
    answer: Optional[str]
    citations: Optional[Dict[str, Dict[str, Any]]]  # NEW: Chunk ID → metadata
```

**Files Modified:**

- `src/app/core/agents/state.py`

---

### Step 3: Response Model Update (models.py) ✅

**What Changed:**

- Extended `QAResponse` to include optional `citations` field
- API now exposes machine-readable citation mapping to clients

**Code:**

```python
class QAResponse(BaseModel):
    answer: str
    context: str
    citations: Optional[Dict[str, Dict[str, Any]]] = None  # NEW
```

**Example API Response:**

```json
{
  "answer": "HNSW indexing uses hierarchical graphs C1. This provides better recall than LSH C2.",
  "context": "[C1] Chunk from page 5: HNSW...",
  "citations": {
    "C1": {
      "page": 5,
      "snippet": "HNSW provides fast approximate search...",
      "source": "vector_db_paper.pdf"
    },
    "C2": {
      "page": 7,
      "snippet": "LSH uses hash functions...",
      "source": "vector_db_paper.pdf"
    }
  }
}
```

**Files Modified:**

- `src/app/models.py`

---

### Step 4: Citation-Aware System Prompts (prompts.py) ✅

**What Changed:**

- **Summarization Prompt:** Now instructs agent to include inline citations (C1, C2, etc.)
- **Verification Prompt:** Ensures citation consistency when correcting content

**Key Instructions Added:**

**For Summarization Agent:**

```
CRITICAL: You MUST cite your sources using the chunk IDs provided in the context.
Format: Include C1, C2, etc. immediately after statements derived from those chunks.
Example: "HNSW indexing creates hierarchical graphs C1. This offers better recall C2."

Rules:
- Only cite chunks actually present in the context
- Use multiple citations when combining information from multiple chunks
- Do not invent or guess chunk IDs
```

**For Verification Agent:**

```
MAINTAIN CITATION ACCURACY:
- Keep citations for statements that remain
- Remove citations if their associated content is removed
- Add citations if introducing new information
- Verify all cited chunk IDs actually exist in the context
```

**Files Modified:**

- `src/app/core/agents/prompts.py`

---

### Step 5: Retrieval Tool and Node Update (tools.py & agents.py) ✅

**What Changed:**

- Modified `retrieval_tool()` to use `serialize_chunks_with_ids()`
- Updated `retrieval_node()` to extract and store citation_map in state
- Added helper function `_extract_artifacts_from_messages()` to extract artifacts

**How the Data Flows:**

```
Question → retrieval_agent → retrieval_tool → serialize_chunks_with_ids()
                                               ↓
                                        (context, citation_map)
                                               ↓
                                     ToolMessage with artifact
                                               ↓
                                     retrieval_node extracts both
                                               ↓
                                     state["context"] = context
                                     state["citations"] = citation_map
```

**Files Modified:**

- `src/app/core/agents/tools.py`
- `src/app/core/agents/agents.py` (retrieval_node)

---

### Step 6: Summarization Node Enhancement (agents.py) ✅

**What Changed:**

- Sends available chunk IDs to the agent as reference
- Agent generates draft answer with inline citations (C1, C2, etc.)

**Code:**

```python
def summarization_node(state: QAState) -> QAState:
    question = state["question"]
    context = state.get("context")
    citations = state.get("citations")

    # Add chunk IDs as reference for the agent
    if citations:
        chunk_ids = ", ".join(sorted(citations.keys()))
        citation_info = f"\nAvailable chunk IDs for citation: {chunk_ids}"

    user_content = f"Question: {question}\n\nContext:\n{context}{citation_info}"
    # Agent now knows which chunks to cite
```

**Files Modified:**

- `src/app/core/agents/agents.py`

---

### Step 7: Verification Node Enhancement (agents.py) ✅

**What Changed:**

- Provides valid chunk IDs to verification agent
- Ensures verification maintains citation consistency
- Removes citations for removed content, adds citations for new content

**Code:**

```python
def verification_node(state: QAState) -> QAState:
    question = state["question"]
    context = state.get("context", "")
    draft_answer = state.get("draft_answer", "")
    citations = state.get("citations")

    # Pass valid chunk IDs so agent can validate citations
    if citations:
        chunk_ids = ", ".join(sorted(citations.keys()))
        citation_info = f"\nValid chunk IDs: {chunk_ids}\nRemove citations for invalid IDs."

    user_content = f"""...\nPlease verify and correct, ensuring citation accuracy{citation_info}"""
    # Agent verifies all citations are valid
```

**Files Modified:**

- `src/app/core/agents/agents.py`

---

### Step 8: API Endpoint Update (api.py) ✅

**What Changed:**

- Updated `/qa` endpoint to return `citations` in QAResponse
- Now exposes complete citation mapping to API consumers

**Code:**

```python
@app.post("/qa", response_model=QAResponse)
async def qa_endpoint(payload: QuestionRequest) -> QAResponse:
    result = answer_question(question)

    return QAResponse(
        answer=result.get("answer", ""),
        context=result.get("context", ""),
        citations=result.get("citations"),  # NEW
    )
```

**Files Modified:**

- `src/app/api.py`

---

## Complete Data Flow

```
User Question
    ↓
[RETRIEVAL AGENT]
    ├─ Calls retrieval_tool(question)
    │  ├─ Retrieves docs from vector store
    │  ├─ Serializes with serialize_chunks_with_ids()
    │  └─ Returns (context_with_IDs, citation_map)
    └─ Stores in state["context"] and state["citations"]
    ↓
[SUMMARIZATION AGENT]
    ├─ Receives context with chunk IDs [C1, C2, C3, ...]
    ├─ Generates answer with inline citations
    │  Example: "HNSW uses hierarchical graphs C1..."
    └─ Stores draft_answer with citations
    ↓
[VERIFICATION AGENT]
    ├─ Checks answer against context
    ├─ Validates all citations exist (C1, C2, etc.)
    ├─ Removes unsupported claims and their citations
    ├─ Adds citations to new information if from context
    └─ Stores final_answer with verified citations
    ↓
[API RESPONSE]
    {
        "answer": "Answer text with inline citations C1 C2...",
        "context": "[C1] Chunk text...\n[C2] Chunk text...",
        "citations": {
            "C1": {"page": X, "snippet": "...", "source": "..."},
            "C2": {...}
        }
    }
```

---

## API Example

### Request

```bash
POST /qa
Content-Type: application/json

{
  "question": "What are the main indexing strategies in vector databases?"
}
```

### Response

```json
{
  "answer": "Vector databases use several indexing strategies. HNSW provides fast approximate search through hierarchical graphs C1C2. LSH uses hash functions for similarity C4. IVF partitions the vector space into clusters C3.",
  "context": "[C1] Chunk from page 5:\nHNSW (Hierarchical Navigable Small World)...\n\n[C2] Chunk from page 6:\nThe hierarchical structure allows...\n\n[C3] Chunk from page 8:\nInverted File (IVF) indexing partitions...\n\n[C4] Chunk from page 7:\nLocality-Sensitive Hashing (LSH)...",
  "citations": {
    "C1": {
      "page": 5,
      "snippet": "HNSW (Hierarchical Navigable Small World) graphs provide logarithmic search complexity...",
      "source": "vector_db_paper.pdf"
    },
    "C2": {
      "page": 6,
      "snippet": "The hierarchical structure allows efficient approximate nearest neighbor search...",
      "source": "vector_db_paper.pdf"
    },
    "C3": {
      "page": 8,
      "snippet": "Inverted File (IVF) indexing partitions vectors into Voronoi cells...",
      "source": "vector_db_paper.pdf"
    },
    "C4": {
      "page": 7,
      "snippet": "Locality-Sensitive Hashing (LSH) maps similar vectors to the same hash buckets...",
      "source": "vector_db_paper.pdf"
    }
  }
}
```

---

## Files Modified Summary

| File                                      | Changes                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `src/app/core/retrieval/serialization.py` | Added `serialize_chunks_with_ids()` function with citation mapping |
| `src/app/core/agents/state.py`            | Added `citations` field to `QAState`                               |
| `src/app/models.py`                       | Added `citations` to `QAResponse`                                  |
| `src/app/core/agents/prompts.py`          | Enhanced prompts with citation instructions                        |
| `src/app/core/agents/tools.py`            | Updated `retrieval_tool()` to use new serialization                |
| `src/app/core/agents/agents.py`           | Updated all 3 nodes + added helper function                        |
| `src/app/api.py`                          | Updated `/qa` endpoint to return citations                         |

---

## Key Features Implemented

✅ **Stable Chunk Identifiers** - Each chunk gets a unique ID (C1, C2, etc.)
✅ **Citation Mapping** - Machine-readable mapping of chunk IDs to metadata
✅ **Inline Citations** - Answers include citations like "statement C1 C2"
✅ **Traceable Evidence** - Every citation maps back to source chunk, page, and snippet
✅ **Citation Consistency** - Verification agent maintains citation accuracy
✅ **API Exposure** - Citations returned in JSON response for client integration
✅ **Full Transparency** - Users can verify which chunks support which statements

---

## Next Steps / UI Implementation Ideas

Once citations are flowing through the API, you can build:

1. **Interactive Citations** - Click C1 to highlight the source chunk
2. **Hover Tooltips** - Show chunk snippet when hovering over citations
3. **Source Panel** - Display all cited chunks with page numbers and snippets
4. **Citation Heatmap** - Visual indication of which chunks were most cited
5. **Fact-Checking Mode** - Click any sentence to see its evidence sources

---

## Testing the Implementation

To test the citations flow:

```python
# Test the serialization function
from src.app.core.retrieval.serialization import serialize_chunks_with_ids
from langchain_core.documents import Document

docs = [
    Document(page_content="Test content 1", metadata={"page": 1, "source": "test.pdf"}),
    Document(page_content="Test content 2", metadata={"page": 2, "source": "test.pdf"})
]

context, citation_map = serialize_chunks_with_ids(docs)
print(context)  # Shows [C1] and [C2]
print(citation_map)  # Shows {"C1": {...}, "C2": {...}}
```

---

## Troubleshooting

### Issue: Citations not appearing in answer

**Solution:** Check that the Summarization Agent prompt is being used (it includes citation instructions). Verify chunk IDs are being passed to the agent.

### Issue: Invalid chunk IDs in answer (e.g., C7 when only C1-C4 exist)

**Solution:** The Verification Agent should catch this. Ensure it's receiving valid chunk IDs in its prompt and has instructions to remove invalid citations.

### Issue: Citation map is empty

**Solution:** Check that `retrieval_tool()` is returning the tuple with citation_map as the second element. Verify `serialize_chunks_with_ids()` is being called.

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│      User Question via /qa          │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────────┐
        │ Retrieval Agent  │
        │   + Tool Call    │
        └─────────┬────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │  retrieval_tool()           │
    │  ├─ retrieve() docs         │
    │  └─ serialize_chunks_with_ids()
    │    Returns: (context, citation_map)
    └─────────────┬───────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ QAState Updated:             │
    │ ├─ context (with C1, C2...)  │
    │ └─ citations (ID→metadata)   │
    └──────────────┬───────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ Summarization Agent          │
    │ (Generates draft with C1...) │
    └──────────────┬───────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ Verification Agent           │
    │ (Validates citation accuracy)│
    └──────────────┬───────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ API Response                 │
    │ ├─ answer (with C1...)       │
    │ ├─ context                   │
    │ └─ citations (JSON mapping)  │
    └──────────────┬───────────────┘
                  │
                  ▼
          ┌───────────────┐
          │  Client/UI    │
          └───────────────┘
```

---

## Summary

You've successfully implemented Evidence-Aware Answers with Chunk Citations! Your RAG system now:

1. **Generates stable chunk IDs** (C1, C2, etc.)
2. **Maintains citation mappings** with page, snippet, and source info
3. **Produces cited answers** with inline references
4. **Verifies citation accuracy** through the verification agent
5. **Exposes citations via API** for client-side consumption

Users and systems can now verify the evidence behind each claim in your RAG answers.
