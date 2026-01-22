"""Utilities for serializing retrieved document chunks."""

from typing import List, Tuple, Dict, Any

from langchain_core.documents import Document


def serialize_chunks(docs: List[Document]) -> str:
    """Serialize a list of Document objects into a formatted CONTEXT string.

    Formats chunks with indices and page numbers as specified in the PRD:
    - Chunks are numbered (Chunk 1, Chunk 2, etc.)
    - Page numbers are included in the format "page=X"
    - Produces a clean CONTEXT section for agent consumption

    Args:
        docs: List of Document objects with metadata.

    Returns:
        Formatted string with all chunks serialized.
    """
    context_parts = []

    for idx, doc in enumerate(docs, start=1):
        # Extract page number from metadata
        page_num = doc.metadata.get("page") or doc.metadata.get(
            "page_number", "unknown"
        )

        # Format chunk with index and page number
        chunk_header = f"Chunk {idx} (page={page_num}):"
        chunk_content = doc.page_content.strip()

        context_parts.append(f"{chunk_header}\n{chunk_content}")

    return "\n\n".join(context_parts)


def serialize_chunks_with_ids(
    docs: List[Document],
) -> Tuple[str, Dict[str, Dict[str, Any]]]:
    """Serialize chunks with stable IDs and return citation mapping.

    Generates unique, stable chunk identifiers (C1, C2, etc.) for each chunk
    and creates a citation map with metadata for traceable references.

    Args:
        docs: List of Document objects with metadata.

    Returns:
        Tuple containing:
        - context_str: Formatted CONTEXT string with chunk IDs
        - citation_map: Dict mapping chunk IDs to their metadata
                       {
                           "C1": {
                               "page": 5,
                               "snippet": "First 100 chars...",
                               "source": "document.pdf"
                           }
                       }
    """
    context_parts = []
    citation_map = {}

    for idx, doc in enumerate(docs, start=1):
        chunk_id = f"C{idx}"
        page_num = doc.metadata.get("page") or doc.metadata.get(
            "page_number", "unknown"
        )
        source = doc.metadata.get("source", "unknown")
        content = doc.page_content.strip()

        # Format context with chunk ID reference
        chunk_header = f"[{chunk_id}] Chunk from page {page_num}:"
        context_parts.append(f"{chunk_header}\n{content}")

        # Create citation metadata
        # Store the full chunk content in the citation snippet so the
        # frontend can display the complete evidence text in the modal.
        citation_map[chunk_id] = {
            "page": page_num,
            "snippet": content,
            "source": source,
        }

    return "\n\n".join(context_parts), citation_map
