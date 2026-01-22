from typing import Optional, Dict, Any
from pydantic import BaseModel


class QuestionRequest(BaseModel):
    """Request body for the `/qa` endpoint.

    The PRD specifies a single field named `question` that contains
    the user's natural language question about the vector databases paper.
    """

    question: str


class QAResponse(BaseModel):
    """Response body for the `/qa` endpoint.

    Exposes the final verified answer, context snippets, and machine-readable
    citation mappings for full transparency about evidence sources.
    """

    answer: str
    context: str
    citations: Optional[Dict[str, Dict[str, Any]]] = None
