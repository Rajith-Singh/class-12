# Step-by-Step Implementation Summary

## Complete Implementation Guide for Evidence-Aware Citations

This document provides a complete overview of how the citation feature was implemented across 7 files.

---

## 📋 Step-by-Step Breakdown

### **STEP 1: Add Stable Chunk IDs (serialization.py)**

**Purpose:** Generate unique identifiers (C1, C2, C3...) for each retrieved chunk with metadata

**File:** `src/app/core/retrieval/serialization.py`

**What to Do:**

1. Keep existing `serialize_chunks()` function unchanged
2. Add new `serialize_chunks_with_ids()` function that:
   - Takes: `List[Document]`
   - Returns: `Tuple[str, Dict[str, Dict[str, Any]]]`
   - Creates chunk IDs: C1, C2, C3, etc.
   - Builds citation_map with page, snippet, source

**Code Template:**

```python
def serialize_chunks_with_ids(docs: List[Document]) -> Tuple[str, Dict[str, Dict[str, Any]]]:
    context_parts = []
    citation_map = {}

    for idx, doc in enumerate(docs, start=1):
        chunk_id = f"C{idx}"
        page_num = doc.metadata.get("page", "unknown")
        source = doc.metadata.get("source", "unknown")
        content = doc.page_content.strip()

        # Format with chunk ID
        context_parts.append(f"[{chunk_id}] Chunk from page {page_num}:\n{content}")

        # Create citation metadata
        citation_map[chunk_id] = {
            "page": page_num,
            "snippet": content[:100] + "...",
            "source": source,
        }

    return "\n\n".join(context_parts), citation_map
```

**Status:** ✅ DONE

---

### **STEP 2: Update State Schema (state.py)**

**Purpose:** Add citations field to track citations through the entire pipeline

**File:** `src/app/core/agents/state.py`

**What to Do:**

1. Import: `Optional, Dict, Any`
2. Add to `QAState`: `citations: Optional[Dict[str, Dict[str, Any]]]`

**Code:**

```python
from typing import TypedDict, Optional, Dict, Any

class QAState(TypedDict):
    question: str
    context: Optional[str]
    draft_answer: Optional[str]
    answer: Optional[str]
    citations: Optional[Dict[str, Dict[str, Any]]]  # ADD THIS LINE
```

**Status:** ✅ DONE

---

### **STEP 3: Update API Response Model (models.py)**

**Purpose:** Expose citations in API responses

**File:** `src/app/models.py`

**What to Do:**

1. Import: `Optional, Dict, Any`
2. Add to `QAResponse`: `citations: Optional[Dict[str, Dict[str, Any]]] = None`

**Code:**

```python
from typing import Optional, Dict, Any
from pydantic import BaseModel

class QuestionRequest(BaseModel):
    question: str

class QAResponse(BaseModel):
    answer: str
    context: str
    citations: Optional[Dict[str, Dict[str, Any]]] = None  # ADD THIS LINE
```

**Status:** ✅ DONE

---

### **STEP 4: Enhance System Prompts (prompts.py)**

**Purpose:** Instruct agents to handle citations properly

**File:** `src/app/core/agents/prompts.py`

**What to Do:**

1. Keep `RETRIEVAL_SYSTEM_PROMPT` mostly same
2. Update `SUMMARIZATION_SYSTEM_PROMPT` to add:
   - "CRITICAL: You MUST cite your sources using the chunk IDs"
   - Format guidance: "Include C1, C2 immediately after statements"
   - Rules about citation validity
3. Update `VERIFICATION_SYSTEM_PROMPT` to add:
   - "MAINTAIN CITATION ACCURACY"
   - Instructions to keep/remove/add citations appropriately

**Code Changes:**

```python
SUMMARIZATION_SYSTEM_PROMPT = """...
Instructions:
- CRITICAL: You MUST cite your sources using the chunk IDs provided.
- Format: Include C1, C2, etc. immediately after statements.
- Rules:
  * Only cite chunks actually present in the context
  * Use multiple citations when combining information
  * Do not invent or guess chunk IDs
..."""

VERIFICATION_SYSTEM_PROMPT = """...
Instructions:
- MAINTAIN CITATION ACCURACY:
  * Keep citations for statements that remain
  * Remove citations if associated content is removed
  * Add citations if introducing new information
  * Verify all cited chunk IDs actually exist
..."""
```

**Status:** ✅ DONE

---

### **STEP 5: Update Retrieval Tool (tools.py)**

**Purpose:** Use new serialization function and return citation_map

**File:** `src/app/core/agents/tools.py`

**What to Do:**

1. Import: `serialize_chunks_with_ids` (in addition to `serialize_chunks`)
2. Update `retrieval_tool()`:
   - Call `serialize_chunks_with_ids()` instead of `serialize_chunks()`
   - Return tuple: `(context, (docs, citation_map))` instead of `(context, docs)`

**Code:**

```python
from ..retrieval.serialization import serialize_chunks, serialize_chunks_with_ids

@tool(response_format="content_and_artifact")
def retrieval_tool(query: str):
    """Search the vector database..."""
    docs = retrieve(query, k=4)

    # Use new function with IDs
    context, citation_map = serialize_chunks_with_ids(docs)

    # Return both docs and citation_map as artifact
    return context, (docs, citation_map)
```

**Status:** ✅ DONE

---

### **STEP 6: Update Agent Nodes (agents.py)**

**Purpose:** Extract citations and pass through pipeline with proper context

**File:** `src/app/core/agents/agents.py`

**What to Do:**

#### Part A: Add helper function at top

```python
def _extract_artifacts_from_messages(messages: List[object]) -> tuple:
    """Extract (docs, citation_map) from ToolMessage artifact."""
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            if hasattr(msg, "artifact") and msg.artifact:
                artifact = msg.artifact
                if isinstance(artifact, tuple) and len(artifact) == 2:
                    return artifact
    return [], {}
```

#### Part B: Update `retrieval_node()`

```python
def retrieval_node(state: QAState) -> QAState:
    """Retrieval Agent node: gathers context AND citations."""
    question = state["question"]
    result = retrieval_agent.invoke({"messages": [HumanMessage(content=question)]})

    messages = result.get("messages", [])
    context = ""
    citations = {}

    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            context = str(msg.content)
            docs, citation_map = _extract_artifacts_from_messages(messages)
            if citation_map:
                citations = citation_map
            break

    return {
        "context": context,
        "citations": citations if citations else None,
    }
```

#### Part C: Update `summarization_node()`

```python
def summarization_node(state: QAState) -> QAState:
    """Summarization Agent node: generates answer with citations."""
    question = state["question"]
    context = state.get("context")
    citations = state.get("citations")

    # Tell agent which chunk IDs are available
    citation_info = ""
    if citations:
        chunk_ids = ", ".join(sorted(citations.keys()))
        citation_info = f"\nAvailable chunk IDs for citation: {chunk_ids}"

    user_content = f"Question: {question}\n\nContext:\n{context}{citation_info}"

    result = summarization_agent.invoke(
        {"messages": [HumanMessage(content=user_content)]}
    )
    messages = result.get("messages", [])
    draft_answer = _extract_last_ai_content(messages)

    return {"draft_answer": draft_answer}
```

#### Part D: Update `verification_node()`

```python
def verification_node(state: QAState) -> QAState:
    """Verification Agent node: verifies citations."""
    question = state["question"]
    context = state.get("context", "")
    draft_answer = state.get("draft_answer", "")
    citations = state.get("citations")

    # Tell agent which chunk IDs are valid
    citation_info = ""
    if citations:
        chunk_ids = ", ".join(sorted(citations.keys()))
        citation_info = f"\nValid chunk IDs: {chunk_ids}\nRemove invalid citations."

    user_content = f"""Question: {question}

Context:
{context}

Draft Answer:
{draft_answer}

Verify and correct, ensuring citation accuracy{citation_info}"""

    result = verification_agent.invoke(
        {"messages": [HumanMessage(content=user_content)]}
    )
    messages = result.get("messages", [])
    answer = _extract_last_ai_content(messages)

    return {"answer": answer}
```

**Status:** ✅ DONE

---

### **STEP 7: Update API Endpoint (api.py)**

**Purpose:** Return citations in API response

**File:** `src/app/api.py`

**What to Do:**

1. Update `/qa` endpoint to include citations in response

**Code:**

```python
@app.post("/qa", response_model=QAResponse, status_code=status.HTTP_200_OK)
async def qa_endpoint(payload: QuestionRequest) -> QAResponse:
    """Submit a question about the vector databases paper."""

    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`question` must be a non-empty string.",
        )

    result = answer_question(question)

    return QAResponse(
        answer=result.get("answer", ""),
        context=result.get("context", ""),
        citations=result.get("citations"),  # ADD THIS LINE
    )
```

**Status:** ✅ DONE

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────┐
│  1. USER SENDS QUESTION          │
│  /qa endpoint receives question  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  2. RETRIEVAL AGENT              │
│  ├─ Calls retrieval_tool()       │
│  ├─ Retrieves documents          │
│  ├─ Serializes with IDs (C1...) │
│  └─ Extracts citation_map        │
└────────────────┬────────────────┘
                 │
                 ▼
        QAState Updated:
        ├─ context = "[C1] Chunk...\n[C2] Chunk..."
        └─ citations = {"C1": {...}, "C2": {...}}
                 │
                 ▼
┌─────────────────────────────────┐
│  3. SUMMARIZATION AGENT          │
│  ├─ Receives context with C1,C2...|
│  ├─ Gets list of valid chunk IDs │
│  ├─ Generates answer with C1,C2...|
│  └─ Example: "HNSW uses C1. LSH C2"|
└────────────────┬────────────────┘
                 │
                 ▼
        QAState Updated:
        ├─ draft_answer = "Text with C1 C2..."
        └─ citations = unchanged
                 │
                 ▼
┌─────────────────────────────────┐
│  4. VERIFICATION AGENT           │
│  ├─ Gets valid chunk IDs (C1,C2..|
│  ├─ Verifies all citations exist │
│  ├─ Removes unsupported claims  │
│  ├─ Maintains citation accuracy  │
│  └─ Returns verified answer      │
└────────────────┬────────────────┘
                 │
                 ▼
        QAState Updated:
        ├─ answer = "Verified text C1..."
        └─ citations = unchanged
                 │
                 ▼
┌─────────────────────────────────┐
│  5. API RESPONSE                 │
│  {                               │
│    "answer": "Text C1...",      │
│    "context": "[C1]...",         │
│    "citations": {                │
│      "C1": {...},                │
│      "C2": {...}                 │
│    }                             │
│  }                               │
└─────────────────────────────────┘
```

---

## ✅ Verification Checklist

After implementing all steps, verify:

- [ ] `serialize_chunks_with_ids()` exists in serialization.py
- [ ] QAState has `citations` field
- [ ] QAResponse has `citations` field
- [ ] Prompts mention citation requirements
- [ ] retrieval_tool() returns (context, (docs, citation_map))
- [ ] retrieval_node() extracts and stores citations
- [ ] summarization_node() receives chunk ID list
- [ ] verification_node() receives valid chunk IDs
- [ ] API endpoint returns citations in response

---

## 🧪 How to Test

### Test 1: Serialization Function

```python
from src.app.core.retrieval.serialization import serialize_chunks_with_ids
from langchain_core.documents import Document

docs = [
    Document(page_content="Test 1", metadata={"page": 1, "source": "test.pdf"}),
    Document(page_content="Test 2", metadata={"page": 2, "source": "test.pdf"})
]

context, citation_map = serialize_chunks_with_ids(docs)
assert "[C1]" in context
assert "[C2]" in context
assert "C1" in citation_map
assert "C2" in citation_map
print("✓ Serialization works!")
```

### Test 2: API Endpoint

```bash
curl -X POST http://localhost:8000/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "What is HNSW?"}'
```

Check response includes:

- `answer` field with citations (e.g., "C1 C2")
- `context` field with [C1] [C2] labels
- `citations` field with mapping

---

## 📊 Example Full Response

```json
{
  "answer": "HNSW provides fast approximate search C1. It creates hierarchical graphs for efficient nearest neighbor search C2.",
  "context": "[C1] Chunk from page 5:\nHNSW (Hierarchical Navigable Small World) offers efficient approximate search...\n\n[C2] Chunk from page 6:\nThe hierarchical structure enables logarithmic search complexity...",
  "citations": {
    "C1": {
      "page": 5,
      "snippet": "HNSW (Hierarchical Navigable Small World) offers efficient...",
      "source": "vector_databases.pdf"
    },
    "C2": {
      "page": 6,
      "snippet": "The hierarchical structure enables logarithmic search...",
      "source": "vector_databases.pdf"
    }
  }
}
```

---

## 🎯 Key Takeaways

1. **Chunk IDs** (C1, C2...) are stable and traceable
2. **Citation Map** provides metadata for verification
3. **Inline Citations** appear in answer text (C1, C2...)
4. **Verification** ensures citation accuracy
5. **API Exposure** allows client-side citation features
6. **Full Transparency** enables fact-checking by users

---

## 📝 Summary of Changes

| Step | File             | Action             | Lines Changed |
| ---- | ---------------- | ------------------ | ------------- |
| 1    | serialization.py | Add function       | +50           |
| 2    | state.py         | Add field          | +2            |
| 3    | models.py        | Add field          | +2            |
| 4    | prompts.py       | Enhance            | +15           |
| 5    | tools.py         | Update             | +5            |
| 6    | agents.py        | Update 4 functions | +80           |
| 7    | api.py           | Update endpoint    | +1            |

**Total: 7 files modified, ~155 lines added/changed**
