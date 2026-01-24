from pathlib import Path
import shutil
import tempfile
import os
import uuid
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Import models and services
from .models import QuestionRequest, QAResponse
from .services.qa_service import answer_question
from .services.indexing_service import index_pdf_file
from .core.retrieval.vector_store import clear_index

app = FastAPI(
    title="Class 12 Multi-Agent RAG Demo",
    description=(
        "Demo API for asking questions about a vector databases paper. "
        "The `/qa` endpoint returns answers from the multi-agent RAG pipeline."
    ),
    version="0.1.0",
)

# Serve static frontend under /static and expose index at /
app.mount("/static", StaticFiles(directory="src/app/static"), name="static")

def get_upload_dir() -> Path:
    """Get the appropriate upload directory based on environment."""
    # On Vercel, we MUST use /tmp. 
    # Note: /tmp is cleared after the function finishes execution.
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path("/tmp") / "uploads"
    else:
        return Path("data/uploads")

@app.get("/", include_in_schema=False)
async def root() -> FileResponse:
    """Serve the single-page frontend index file."""
    return FileResponse("src/app/static/index.html")

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        raise exc
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )

@app.post("/qa", response_model=QAResponse, status_code=status.HTTP_200_OK)
async def qa_endpoint(payload: QuestionRequest) -> QAResponse:
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
        citations=result.get("citations"),
    )

@app.post("/index-pdf", status_code=status.HTTP_200_OK)
async def index_pdf(file: UploadFile = File(...)) -> dict:
    """
    Upload and index a PDF. 
    Fixed for Vercel by using /tmp and ensuring directory creation.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    # 1. Clear the vector store index
    clear_index()

    # 2. Setup directory
    upload_dir = get_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)

    # 3. Create a unique path
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = upload_dir / unique_filename
    
    try:
        # 4. Save file to /tmp (Vercel) or local data/uploads
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        # 5. Index the saved PDF
        # This calls your service logic which likely uses PyPDFLoader(str(file_path))
        chunks_indexed = index_pdf_file(str(file_path))
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing PDF: {str(e)}",
        )
    finally:
        # 6. CRITICAL: Always clean up /tmp immediately to avoid memory bloat
        if file_path.exists():
            file_path.unlink()

    return {
        "filename": file.filename,
        "chunks_indexed": chunks_indexed,
        "message": "PDF indexed successfully.",
        "storage": "serverless_tmp" if os.environ.get("VERCEL") else "local_disk"
    }

@app.post("/clear-cache", status_code=status.HTTP_200_OK)
async def clear_cache() -> dict:
    upload_dir = get_upload_dir()
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
            continue

    return {"deleted": deleted, "message": "Upload cache cleared."}

@app.get("/health")
async def health_check() -> dict:
    return {
        "status": "healthy", 
        "environment": "production" if os.environ.get("VERCEL") else "development"
    }