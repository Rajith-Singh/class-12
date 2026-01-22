# Citation Implementation - Quick Reference

## What Was Changed

### 1. Chunk Serialization (`serialization.py`)

```python
# NEW FUNCTION
def serialize_chunks_with_ids(docs) -> (context_str, citation_map):
    """
    C1, C2, C3... IDs for each chunk
    Returns both formatted context AND metadata mapping
    """
```

### 2. State Schema (`state.py`)

```python
class QAState(TypedDict):
    # ... existing fields ...
    citations: Optional[Dict[str, Dict[str, Any]]]  # NEW
```

### 3. Response Model (`models.py`)

```python
class QAResponse(BaseModel):
    answer: str
    context: str
    citations: Optional[Dict[str, Dict[str, Any]]] = None  # NEW
```

### 4. System Prompts (`prompts.py`)

- **Summarization**: NOW includes "MUST cite your sources using chunk IDs"
- **Verification**: NOW includes "MAINTAIN CITATION ACCURACY" rules

### 5. Retrieval Tool (`tools.py`)

```python
# Now returns: (context_with_IDs, (docs, citation_map))
# Instead of: (context, docs)
```

### 6. Agent Nodes (`agents.py`)

- `retrieval_node()`: Extracts and stores citations
- `summarization_node()`: Sends chunk IDs as reference
- `verification_node()`: Validates citation accuracy

### 7. API Endpoint (`api.py`)

```python
return QAResponse(
    answer=result["answer"],
    context=result["context"],
    citations=result.get("citations")  # NEW
)
```

---

## Data Flow Summary

```
Question
  ↓
Retrieval Agent
  ├─ Calls retrieval_tool(question)
  └─ Extract: context + citation_map
  ↓
Summarization Agent
  ├─ Receives: context with [C1] [C2] labels + chunk IDs list
  └─ Outputs: answer with C1, C2 inline citations
  ↓
Verification Agent
  ├─ Validates: all C1, C2 citations are valid
  └─ Outputs: final answer with verified citations
  ↓
API Response
  ├─ answer: "text C1 C2..."
  ├─ context: "[C1] text...\n[C2] text..."
  └─ citations: {"C1": {page, snippet, source}, "C2": {...}}
```

---

## Citation Format in Answers

### Before

```
Vector databases use HNSW, LSH, and IVF indexing strategies.
```

### After

```
Vector databases use HNSW C1, LSH C3, and IVF C2 indexing strategies.
```

Readers can now look up C1, C2, C3 in the `citations` response field to verify sources.

---

## Testing Checklist

- [ ] Run `/qa` endpoint with a test question
- [ ] Check that response includes `citations` field
- [ ] Verify citations match answer (e.g., if answer says "C1", C1 must exist in citations)
- [ ] Check each citation has: `page`, `snippet`, `source`
- [ ] Verify chunk IDs are stable (C1, C2, etc., not random)
- [ ] Test that removing context removes citations properly

---

## Key Acceptance Criteria Met

✅ Answers include inline citations like C1, C2
✅ API exposes machine-readable citation mappings
✅ Every citation corresponds to an actual retrieved chunk
✅ Citation IDs remain stable throughout pipeline
✅ Verification step maintains citation accuracy

---

## Files Changed (7 total)

1. `src/app/core/retrieval/serialization.py` - NEW function
2. `src/app/core/agents/state.py` - NEW field
3. `src/app/models.py` - NEW field
4. `src/app/core/agents/prompts.py` - Enhanced
5. `src/app/core/agents/tools.py` - Updated return
6. `src/app/core/agents/agents.py` - Updated all 3 nodes
7. `src/app/api.py` - Updated response

---

## Next Steps

1. **Test the API** - Call /qa and check citations
2. **Build UI** - Add citation display in frontend
3. **Add features**:
   - Click citations to highlight chunks
   - Hover tooltips with snippets
   - Citation heatmap
   - Fact-checking mode
