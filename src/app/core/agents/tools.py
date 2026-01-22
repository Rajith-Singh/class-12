"""Tools available to agents in the multi-agent RAG system."""

from langchain_core.tools import tool

# Use REST API implementation for serverless compatibility
from ..retrieval.vector_store_rest import retrieve
from ..retrieval.serialization import serialize_chunks, serialize_chunks_with_ids


@tool(response_format="content_and_artifact")
def retrieval_tool(query: str):
    """Search the vector database for relevant document chunks.

    This tool retrieves the top 4 most relevant chunks from the Pinecone
    vector store based on the query. The chunks are formatted with page
    numbers, chunk IDs, and indices for easy reference and citation.

    Args:
        query: The search query string to find relevant document chunks.

    Returns:
        Tuple of (serialized_content, artifact) where:
        - serialized_content: A formatted string containing the retrieved chunks
          with chunk IDs and metadata. Format: "[C1] Chunk from page X: ...\n\n[C2] Chunk from page Y: ..."
        - artifact: Tuple of (docs list, citation_map dict) for tracking citations
    """
    # Retrieve documents from vector store
    docs = retrieve(query, k=4)

    # Serialize chunks with stable IDs and create citation map
    context, citation_map = serialize_chunks_with_ids(docs)

    # Return tuple: (serialized content with IDs, artifact with docs and citation map)
    # This follows LangChain's content_and_artifact response format
    return context, (docs, citation_map)
