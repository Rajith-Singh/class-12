from pathlib import Path
import shutil
import tempfile
import os
import io
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
    description="Demo API for asking questions about a vector databases paper.",
    version="0.1.0",
)

# Serve static frontend
app.mount("/static", StaticFiles(directory="src/app/static"), name="static")

@app.get("/", include_in_schema=False)
async def root() -> FileResponse:
    return FileResponse("src/app/static/index.html")

@app.post("/qa", response_model=QAResponse)
async def qa_endpoint(payload: QuestionRequest) -> QAResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="`question` must be a non-empty string.")
    result = answer_question(question)
    return QAResponse(
        answer=result.get("answer", ""),
        context=result.get("context", ""),
        citations=result.get("citations"),
    )

@app.post("/index-pdf", status_code=status.HTTP_200_OK)
async def index_pdf(file: UploadFile = File(...)) -> dict:
    """
    EASY METHOD: Process PDF entirely in memory to avoid Vercel Disk Errors.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # 1. Clear the current vector index
    clear_index()

    try:
        # 2. Read the file into memory (RAM) instead of saving to a folder
        pdf_content = await file.read()
        
        # 3. Pass the raw bytes to your indexing service
        # IMPORTANT: Your index_pdf_file function must be able to handle 
        # raw bytes or a file-like object (io.BytesIO)
        chunks_indexed = index_pdf_file(pdf_content)
        
        return {
            "filename": file.filename,
            "chunks_indexed": chunks_indexed,
            "message": "PDF indexed successfully (processed in memory)."
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Indexing failed: {str(e)}"
        )
    finally:
        await file.close()

@app.get("/health")
async def health_check() -> dict:
    return {"status": "healthy", "environment": "production" if os.environ.get("VERCEL") else "local"}