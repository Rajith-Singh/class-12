"""Direct REST API implementation for Pinecone to avoid multiprocessing issues in serverless."""

import os
from functools import lru_cache
from typing import List
import requests
import json

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import get_settings


class PineconeRESTClient:
    """Pinecone client using REST API instead of gRPC to avoid serverless issues."""
    
    def __init__(self, api_key: str, index_name: str, environment: str = None):
        self.api_key = api_key
        self.index_name = index_name
        # Pinecone REST API base URL
        self.base_url = f"https://{index_name}.svc.pinecone.io"
        self.headers = {
            "Api-Key": api_key,
            "Content-Type": "application/json"
        }
    
    def upsert(self, vectors: List[dict], namespace: str = ""):
        """Upsert vectors using REST API."""
        url = f"{self.base_url}/vectors/upsert"
        payload = {
            "vectors": vectors,
            "namespace": namespace
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
    
    def query(self, vector: List[float], top_k: int = 5, namespace: str = ""):
        """Query vectors using REST API."""
        url = f"{self.base_url}/query"
        payload = {
            "vector": vector,
            "topK": top_k,
            "includeMetadata": True,
            "namespace": namespace
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()


@lru_cache(maxsize=1)
def _get_embeddings():
    """Get OpenAI embeddings instance."""
    settings = get_settings()
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )


@lru_cache(maxsize=1)
def _get_pinecone_client():
    """Get Pinecone REST client."""
    settings = get_settings()
    return PineconeRESTClient(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name
    )


def retrieve(query: str, k: int = 4) -> List[Document]:
    """Retrieve documents from Pinecone using REST API."""
    embeddings = _get_embeddings()
    client = _get_pinecone_client()
    
    # Get query embedding
    query_vector = embeddings.embed_query(query)
    
    # Query Pinecone
    results = client.query(vector=query_vector, top_k=k)
    
    # Convert results to Documents
    documents = []
    for match in results.get("matches", []):
        metadata = match.get("metadata", {})
        text = metadata.get("text", "")
        documents.append(Document(
            page_content=text,
            metadata=metadata
        ))
    
    return documents


def index_documents(docs: List[Document]) -> int:
    """Index documents into Pinecone using REST API."""
    settings = get_settings()
    embeddings = _get_embeddings()
    client = _get_pinecone_client()
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    
    all_chunks: List[Document] = []
    for doc in docs:
        if "source" not in doc.metadata:
            doc.metadata["source"] = doc.metadata.get("source", "unknown")
        if "page" not in doc.metadata and "page_number" not in doc.metadata:
            doc.metadata["page"] = doc.metadata.get("page", doc.metadata.get("page_number", "unknown"))
        
        chunks = text_splitter.split_documents([doc])
        
        for ch in chunks:
            if "page" not in ch.metadata and "page_number" not in ch.metadata:
                ch.metadata["page"] = doc.metadata.get("page", "unknown")
            if "source" not in ch.metadata:
                ch.metadata["source"] = doc.metadata.get("source", "unknown")
            all_chunks.append(ch)
    
    # Prepare vectors for upsert
    vectors = []
    texts = [chunk.page_content for chunk in all_chunks]
    
    # Embed texts
    text_embeddings = embeddings.embed_documents(texts)
    
    # Create vector objects
    for i, (chunk, embedding) in enumerate(zip(all_chunks, text_embeddings)):
        vector_id = f"vec_{i}_{hash(chunk.page_content)}"
        vectors.append({
            "id": vector_id,
            "values": embedding,
            "metadata": {
                **chunk.metadata,
                "text": chunk.page_content
            }
        })
    
    # Upsert in batches of 100
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        client.upsert(vectors=batch)
    
    return len(all_chunks)


def get_retriever(k: int | None = None):
    """Get a retriever function."""
    settings = get_settings()
    if k is None:
        k = settings.retrieval_k
    
    def retriever_func(query: str) -> List[Document]:
        return retrieve(query, k=k)
    
    return retriever_func
