"""Vector store wrapper for Pinecone integration with LangChain."""

from functools import lru_cache
from typing import List
import os
import logging

from pinecone import Pinecone, ServerlessSpec
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import get_settings

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _get_vector_store() -> PineconeVectorStore:
    """Create a PineconeVectorStore instance configured from settings."""
    settings = get_settings()

    pc = Pinecone(api_key=settings.pinecone_api_key)
    
    # Check if index exists, create if not
    index_name = settings.pinecone_index_name
    if index_name not in pc.list_indexes().names():
        logger.info(f"Creating Pinecone index: {index_name}")
        pc.create_index(
            name=index_name,
            dimension=1536,  # OpenAI embeddings dimension
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"  # Adjust based on your Pinecone setup
            )
        )
        logger.info(f"Created index: {index_name}")
    
    index = pc.Index(index_name)

    embeddings = OpenAIEmbeddings(
        model=settings.openai_embedding_model_name,
        api_key=settings.openai_api_key,
    )

    return PineconeVectorStore(
        index=index,
        embedding=embeddings,
    )

def get_retriever(k: int | None = None):
    """Get a Pinecone retriever instance.

    Args:
        k: Number of documents to retrieve (defaults to config value).

    Returns:
        PineconeVectorStore instance configured as a retriever.
    """
    settings = get_settings()
    if k is None:
        k = settings.retrieval_k

    vector_store = _get_vector_store()
    return vector_store.as_retriever(search_kwargs={"k": k})


def retrieve(query: str, k: int | None = None) -> List[Document]:
    """Retrieve documents from Pinecone for a given query.

    Args:
        query: Search query string.
        k: Number of documents to retrieve (defaults to config value).

    Returns:
        List of Document objects with metadata (including page numbers).
    """
    retriever = get_retriever(k=k)
    return retriever.invoke(query)

def index_documents(docs: List[Document]) -> int:
    """Index a list of Document objects into the Pinecone vector store.

    Args:
        docs: Documents to embed and upsert into the vector index.

    Returns:
        The number of documents indexed.
    """
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

    # Split documents per-source to ensure original metadata (page, source)
    # is propagated to each resulting chunk. Some splitters may drop or not
    # copy metadata when splitting multiple documents at once, so we split
    # each document individually and manually copy over the parent metadata.
    all_chunks: List[Document] = []

    for doc in docs:
        # Ensure minimal metadata exists on the parent doc
        if "source" not in doc.metadata:
            doc.metadata["source"] = doc.metadata.get("source", "unknown")
        if "page" not in doc.metadata and "page_number" not in doc.metadata:
            doc.metadata["page"] = doc.metadata.get("page", doc.metadata.get("page_number", "unknown"))

        # Split this single document so the splitter has access to its metadata
        chunks = text_splitter.split_documents([doc])

        for ch in chunks:
            # Propagate page/source from the parent document if missing
            if "page" not in ch.metadata and "page_number" not in ch.metadata:
                ch.metadata["page"] = doc.metadata.get("page", "unknown")
            if "source" not in ch.metadata:
                ch.metadata["source"] = doc.metadata.get("source", "unknown")

            all_chunks.append(ch)

    vector_store = _get_vector_store()
    vector_store.add_documents(all_chunks)
    return len(all_chunks)


def clear_index():
    """Delete all vectors from the Pinecone index, handling empty namespace gracefully."""
    try:
        settings = get_settings()
        pc = Pinecone(api_key=settings.pinecone_api_key)
        
        # Check if index exists
        index_name = settings.pinecone_index_name
        if index_name not in pc.list_indexes().names():
            logger.info(f"Index '{index_name}' doesn't exist, nothing to clear")
            return
        
        index = pc.Index(index_name)
        
        # Try to get stats first
        try:
            stats = index.describe_index_stats()
            total_vectors = stats.get('total_vector_count', 0)
            
            if total_vectors > 0:
                # Delete all vectors
                index.delete(delete_all=True)
                logger.info(f"Cleared {total_vectors} vectors from index")
            else:
                logger.info("Index is already empty, nothing to clear")
                
        except Exception as stats_error:
            # If stats fail, try to delete but handle namespace error
            logger.warning(f"Could not get index stats: {stats_error}")
            try:
                index.delete(delete_all=True)
                logger.info("Attempted to clear index")
            except Exception as delete_error:
                if "Namespace not found" in str(delete_error):
                    logger.info("Namespace was already empty")
                else:
                    # Log but don't raise - allow upload to continue
                    logger.warning(f"Could not clear index: {delete_error}")
                    
    except Exception as e:
        # Log the error but don't crash
        logger.warning(f"Pinecone operation failed: {e}")
        # Don't raise the exception - allow the upload to proceed