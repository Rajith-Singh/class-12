from pathlib import Path
import shutil

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse

from .models import QuestionRequest, QAResponse
from .services.qa_service import answer_question
from .services.indexing_service import index_pdf_file


app = FastAPI(
    title="Class 12 Multi-Agent RAG Demo",
    description=(
        "Demo API for asking questions about a vector databases paper. "
        "The `/qa` endpoint currently returns placeholder responses and "
        "will be wired to a multi-agent RAG pipeline in later user stories."
    ),
    version="0.1.0",
)

# Static files are served directly by Vercel from the public/ directory
# No need to mount StaticFiles here

from fastapi.responses import FileResponse


@app.get("/", include_in_schema=False)
async def root() -> FileResponse:
    """Serve the single-page frontend index file."""
    # Serve from public directory for Vercel deployment
    index_path = Path(__file__).parent.parent.parent / "public" / "index.html"
    return FileResponse(str(index_path))


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
    - Saves it to the local `data/uploads/` directory
    - Uses PyPDFLoader to load the document into LangChain `Document` objects
    - Indexes those documents into the configured Pinecone vector store
    """

    if file.content_type not in ("application/pdf",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file.filename
    contents = await file.read()
    file_path.write_bytes(contents)

    # Index the saved PDF
    chunks_indexed = index_pdf_file(file_path)

    return {
        "filename": file.filename,
        "chunks_indexed": chunks_indexed,
        "message": "PDF indexed successfully.",
    }


@app.post("/clear-cache", status_code=status.HTTP_200_OK)
async def clear_cache() -> dict:
    """Clear uploaded files from the local uploads directory.

    This deletes all files and subdirectories under `data/uploads`.
    NOTE: This does NOT touch external vector stores (e.g., Pinecone).
    """
    upload_dir = Path("data/uploads")
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
