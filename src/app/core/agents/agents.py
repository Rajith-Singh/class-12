"""Agent implementations for the multi-agent RAG flow.

This module defines three LangChain agents (Retrieval, Summarization,
Verification) and thin node functions that LangGraph uses to invoke them.
"""

from typing import List, Dict, Any

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from ..llm.factory import create_chat_model
from .prompts import (
    RETRIEVAL_SYSTEM_PROMPT,
    SUMMARIZATION_SYSTEM_PROMPT,
    VERIFICATION_SYSTEM_PROMPT,
)
from .state import QAState
from .tools import retrieval_tool


def _extract_last_ai_content(messages: List[object]) -> str:
    """Extract the content of the last AIMessage in a messages list."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return str(msg.content)
    return ""


def _extract_artifacts_from_messages(messages: List[object]) -> tuple:
    """Extract the artifact (docs, citation_map) from ToolMessage if available.
    
    Returns:
        Tuple of (docs, citation_map) if found, else ([], {})
    """
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            # The artifact contains (docs, citation_map) tuple
            if hasattr(msg, "artifact") and msg.artifact:
                artifact = msg.artifact
                if isinstance(artifact, tuple) and len(artifact) == 2:
                    return artifact
    return [], {}


# Define agents at module level for reuse
retrieval_agent = create_agent(
    model=create_chat_model(),
    tools=[retrieval_tool],
    system_prompt=RETRIEVAL_SYSTEM_PROMPT,
)

summarization_agent = create_agent(
    model=create_chat_model(),
    tools=[],
    system_prompt=SUMMARIZATION_SYSTEM_PROMPT,
)

verification_agent = create_agent(
    model=create_chat_model(),
    tools=[],
    system_prompt=VERIFICATION_SYSTEM_PROMPT,
)


def retrieval_node(state: QAState) -> QAState:
    """Retrieval Agent node: gathers context and citations from vector store.

    This node:
    - Sends the user's question to the Retrieval Agent.
    - The agent uses the attached retrieval tool to fetch document chunks.
    - Extracts the tool's content (CONTEXT string with chunk IDs) from ToolMessage.
    - Extracts the artifact containing citation_map from the retrieval_tool.
    - Stores context in `state["context"]` and citations in `state["citations"]`.
    """
    question = state["question"]

    result = retrieval_agent.invoke({"messages": [HumanMessage(content=question)]})

    messages = result.get("messages", [])
    context = ""
    citations: Dict[str, Dict[str, Any]] = {}

    # Extract context and citations from ToolMessage
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            context = str(msg.content)
            # Extract citation_map from artifact
            docs, citation_map = _extract_artifacts_from_messages(messages)
            if citation_map:
                citations = citation_map
            break

    return {
        "context": context,
        "citations": citations if citations else None,
    }


def summarization_node(state: QAState) -> QAState:
    """Summarization Agent node: generates draft answer with citations.

    This node:
    - Sends question + context + citations to the Summarization Agent.
    - Agent responds with a draft answer grounded in context with inline citations.
    - Stores the draft answer in `state["draft_answer"]`.
    """
    question = state["question"]
    context = state.get("context")
    citations = state.get("citations")

    # Build prompt with context and available chunk IDs for reference
    citation_info = ""
    if citations:
        chunk_ids = ", ".join(sorted(citations.keys()))
        citation_info = f"\nAvailable chunk IDs for citation: {chunk_ids}"

    user_content = f"Question: {question}\n\nContext:\n{context}{citation_info}"

    result = summarization_agent.invoke(
        {"messages": [HumanMessage(content=user_content)]}
    )
    messages = result.get("messages", [])
    draft_answer = _extract_last_ai_content(messages)

    return {
        "draft_answer": draft_answer,
    }


def verification_node(state: QAState) -> QAState:
    """Verification Agent node: verifies answer and maintains citation accuracy.

    This node:
    - Sends question + context + citations + draft_answer to Verification Agent.
    - Agent checks for hallucinations and citation consistency.
    - Maintains citation accuracy: keeps valid citations, removes invalid ones,
      adds citations to new information from context.
    - Stores the final verified answer in `state["answer"]`.
    """
    question = state["question"]
    context = state.get("context", "")
    draft_answer = state.get("draft_answer", "")
    citations = state.get("citations")

    # Build prompt with citation info for verification agent
    citation_info = ""
    if citations:
        chunk_ids = ", ".join(sorted(citations.keys()))
        citation_info = f"\nValid chunk IDs in this context: {chunk_ids}\nRemove citations for invalid chunk IDs if found."

    user_content = f"""Question: {question}

Context:
{context}

Draft Answer:
{draft_answer}

Please verify and correct the draft answer, ensuring:
1. Remove any unsupported claims
2. Maintain citation accuracy - keep citations that are valid, remove invalid ones
3. All cited chunks (e.g., C1, C2) must exist in the context{citation_info}
4. Return only the corrected answer with proper citations (no explanations)."""

    result = verification_agent.invoke(
        {"messages": [HumanMessage(content=user_content)]}
    )
    messages = result.get("messages", [])
    answer = _extract_last_ai_content(messages)

    return {
        "answer": answer,
    }
