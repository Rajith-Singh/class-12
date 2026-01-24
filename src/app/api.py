from pathlib import Path
import shutil
import tempfile
import os
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .models import QuestionRequest, QAResponse
from .services.qa_service import answer_question
from .services.indexing_service import index_pdf_file
from .core.retrieval.vector_store import clear_index


app = FastAPI(
    title="Class 12 Multi-Agent RAG Demo",
    description=(
        "Demo API for asking questions about a vector databases paper. "
        "The `/qa` endpoint currently returns placeholder responses and "
        "will be wired to a multi-agent RAG pipeline in later user stories."
    ),
    version="0.1.0",
)

# Serve static frontend under /static and expose index at /
app.mount("/static", StaticFiles(directory="src/app/static"), name="static")

def get_upload_dir() -> Path:
    """Get the appropriate upload directory based on environment."""
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        # Use /tmp in serverless environments (Vercel, AWS Lambda)
        return Path(tempfile.gettempdir()) / "uploads"
    else:
        # Use local directory for development
        return Path("data/uploads")


@app.get("/", include_in_schema=False)
async def root() -> FileResponse:
    """Serve the single-page frontend index file."""
    return FileResponse("src/app/static/index.html")


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:  # pragma: no cover - simple demo handler
    """Catch-all handler for unexpected errors.

    FastAPI will still handle `HTTPException` instances and validation errors
    separately; this is only for truly unexpected failures so API consumers
    get a consistent 500 response body.
    """

    if isinstance(exc, HTTPException):
        # Let FastAPI handle HTTPException as usual.
        raise exc

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.post("/qa", response_model=QAResponse, status_code=status.HTTP_200_OK)
async def qa_endpoint(payload: QuestionRequest) -> QAResponse:
    """Submit a question about the vector databases paper.

    US-001 requirements:
    - Accept POST requests at `/qa` with JSON body containing a `question` field
    - Validate the request format and return 400 for invalid requests
    - Return 200 with `answer`, `context`, and `citations` fields
    - Delegate to the multi-agent RAG service layer for processing
    - Citations provide machine-readable mapping of chunk IDs to metadata
    """

    question = payload.question.strip()
    if not question:
        # Explicit validation beyond Pydantic's type checking to ensure
        # non-empty questions.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`question` must be a non-empty string.",
        )

    # Delegate to the service layer which runs the multi-agent QA graph
    result = answer_question(question)

    return QAResponse(
        answer=result.get("answer", ""),
        context=result.get("context", ""),
        citations=result.get("citations"),
    )


@app.post("/index-pdf", status_code=status.HTTP_200_OK)
async def index_pdf(file: UploadFile = File(...)) -> dict:
    """Upload a PDF and index it into the vector database.

    This endpoint:
    - Accepts a PDF file upload
    - Saves it to a temporary directory (in-memory for serverless)
    - Uses PyPDFLoader to load the document into LangChain `Document` objects
    - Indexes those documents into the configured Pinecone vector store
    """

    if file.content_type not in ("application/pdf",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    # Clear the index before processing the new file
    clear_index()

    # Get appropriate upload directory
    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Create a unique filename to avoid conflicts
    import uuid
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = upload_dir / unique_filename
    
    # Save file
    contents = await file.read()
    file_path.write_bytes(contents)

    try:
        # Index the saved PDF
        chunks_indexed = index_pdf_file(file_path)
        
        # Clean up the temporary file immediately after processing
        if file_path.exists():
            file_path.unlink()
            
    except Exception as e:
        # Clean up on error too
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing PDF: {str(e)}",
        )

    return {
        "filename": file.filename,
        "chunks_indexed": chunks_indexed,
        "message": "PDF indexed successfully.",
        "note": "File was processed and cleaned up automatically." if os.environ.get("VERCEL") else None,
    }


@app.post("/clear-cache", status_code=status.HTTP_200_OK)
async def clear_cache() -> dict:
    """Clear uploaded files from the upload directory.

    NOTE: In serverless environments (Vercel), files are automatically
    cleaned up after function execution. This is mainly for development.
    """
    upload_dir = get_upload_dir()
    
    # Don't try to clear /tmp root directory in serverless
    if str(upload_dir) == "/tmp":
        return {
            "deleted": 0,
            "message": "In serverless environment, files are automatically cleaned up after execution.",
        }
    
    if not upload_dir.exists():
        return {"deleted": 0, "message": "No uploads to clear."}

    deleted = 0
    for child in upload_dir.iterdir():
        try:
            if child.is_file():
                child.unlink()
                deleted += 1
            elif child.is_dir():
                shutil.rmtree(child)
                deleted += 1
        except Exception:
            # ignore individual failures and continue
            continue

    return {"deleted": deleted, "message": "Local upload cache cleared."}


# Optional: Add a health check endpoint for Vercel monitoring
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "environment": "production" if os.environ.get("VERCEL") else "development"}