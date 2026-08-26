"""Query parameters for agent list endpoints."""

from typing import Annotated

from fastapi import Query

from modules.agent_read.schemas import AgentListQuery


def get_agent_list_query(
    q: Annotated[str | None, Query(description="Free-text search")] = None,
    status: Annotated[str | None, Query(description="Filter by record status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AgentListQuery:
    return AgentListQuery(q=q, status=status, limit=limit, offset=offset)
