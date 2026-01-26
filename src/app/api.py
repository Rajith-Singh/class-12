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
import cloudinary
import cloudinary.uploader

# Import models and services
from .models import QuestionRequest, QAResponse
from .services.qa_service import answer_question
from .services.indexing_service import index_pdf_file
from .core.retrieval.vector_store import clear_index
from .core.config import get_settings

# Cloudinary configuration
settings = get_settings()
cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
)

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
    Handle PDF uploads by saving them to Cloudinary and indexing.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        # Upload the file to Cloudinary
        upload_result = cloudinary.uploader.upload(
            file.file,
            resource_type="raw",  # Use "raw" for non-image files like PDFs
        )
        
        # Get the secure URL of the uploaded file
        pdf_url = upload_result.get("secure_url")
        if not pdf_url:
            raise HTTPException(status_code=500, detail="Cloudinary upload failed: No URL returned.")

        # 1. Clear the current vector index
        clear_index()

        # 2. Index the new PDF file from its Cloudinary URL
        # PyPDFLoader can load from a URL
        chunks_indexed = index_pdf_file(pdf_url)
        
        return {
            "filename": file.filename,
            "chunks_indexed": chunks_indexed,
            "message": f"PDF indexed successfully from {pdf_url}",
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Indexing failed: {str(e)}",
        )
    finally:
        await file.close()


@app.get("/health")
async def health_check() -> dict:
    return {"status": "healthy", "environment": "production" if os.environ.get("VERCEL") else "local"}