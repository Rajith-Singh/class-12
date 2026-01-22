"""LangGraph state schema for the multi-agent QA flow."""

from typing import TypedDict, Optional, Dict, Any


class QAState(TypedDict):
    """State schema for the linear multi-agent QA flow.

    The state flows through three agents:
    1. Retrieval Agent: populates `context` and `citations` from `question`
    2. Summarization Agent: generates `draft_answer` with inline citations
    3. Verification Agent: produces final `answer` while maintaining citation accuracy
    """

    question: str
    context: Optional[str]
    draft_answer: Optional[str]
    answer: Optional[str]
    citations: Optional[Dict[str, Dict[str, Any]]]  # Maps chunk ID to metadata
