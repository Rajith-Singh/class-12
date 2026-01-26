"""Service functions for indexing documents into the vector database."""

from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader

# Use REST API implementation for serverless compatibility
from ..core.retrieval.vector_store_rest import index_documents


def index_pdf_file(file_path: str) -> int:
    """Load a PDF from a path or URL and index it into the vector DB.

    Args:
        file_path: Path or URL to the PDF file.

    Returns:
        Number of document chunks indexed.
    """
    loader = PyPDFLoader(str(file_path))
    docs = loader.load()
    # Ensure each loaded Document has `page` and `source` metadata so
    # downstream splitting and serialization can produce accurate citations.
    for i, doc in enumerate(docs, start=1):
        # Some loaders populate page as a float (e.g., 1.0) or as an int;
        # prefer existing metadata but fall back to the page index.
        if not doc.metadata.get("page") and not doc.metadata.get("page_number"):
            doc.metadata["page"] = i
        # Always set a source path so citations include the filename
        if not doc.metadata.get("source"):
            doc.metadata["source"] = str(file_path)

    return index_documents(docs)
