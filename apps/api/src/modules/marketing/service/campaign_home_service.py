"""Campaign home — one payload for the marketing head."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.models import (
    MktApproval,
    MktCalendarEntry,
    MktContentRequest,
    MktGeneratedContent,
    MktM365File,
    MktSocialInbox,
    MktTask,
)
from modules.marketing.repository.base import MktScopedRepository


def _dump_time(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


class CampaignHomeService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)

    def home(self, ctx: TenantContext, campaign_id: UUID) -> dict:
        from modules.marketing.service.campaign_service import CampaignService

        campaign = CampaignService(self.db).get(ctx, campaign_id)
        cid = campaign.company_id

        content = [
            row
            for row in self._repo.list_by_company(MktGeneratedContent, ctx, cid, branch_scoped=True)
            if row.campaign_id == campaign_id
        ]
        requests = [
            row
            for row in self._repo.list_by_company(MktContentRequest, ctx, cid, branch_scoped=True)
            if row.campaign_id == campaign_id
        ]
        calendar = [
            row
            for row in self._repo.list_by_company(MktCalendarEntry, ctx, cid, branch_scoped=True)
            if row.campaign_id == campaign_id
        ]
        approvals = [
            row
            for row in self._repo.list_by_company(MktApproval, ctx, cid)
            if row.campaign_id == campaign_id
        ]
        tasks = [
            row
            for row in self._repo.list_by_company(MktTask, ctx, cid, branch_scoped=True)
            if row.campaign_id == campaign_id
        ]
        assets = [
            row
            for row in self._repo.list_by_company(MktM365File, ctx, cid, branch_scoped=True)
            if row.campaign_id == campaign_id
        ]
        inbox = [
            row
            for row in self._repo.list_by_company(MktSocialInbox, ctx, cid, branch_scoped=True)
            if row.campaign_id == campaign_id
        ]

        open_approvals = [
            row
            for row in approvals
            if row.action in {"comment", "request_revision"} or row.status == "recorded" and row.action != "approve"
        ]
        in_flight = [row for row in content if row.status in {"draft", "in_review", "rejected"}]
        approved = [row for row in content if row.status == "approved"]
        open_tasks = [row for row in tasks if row.status not in {"completed", "cancelled"}]
        inbox_open = [row for row in inbox if row.status != "done"]

        return {
            "campaign": campaign,
            "content": content,
            "requests": requests,
            "calendar": [
                {
                    "id": row.id,
                    "title": row.title,
                    "scheduled_at": _dump_time(row.scheduled_at),
                    "status": row.status,
                    "content_id": row.content_id,
                    "social_account_id": row.social_account_id,
                    "notes": row.notes,
                }
                for row in calendar
            ],
            "approvals": [
                {
                    "id": row.id,
                    "entity_type": row.entity_type,
                    "entity_id": row.entity_id,
                    "approval_level": row.approval_level,
                    "action": row.action,
                    "comment": row.comment,
                    "status": row.status,
                    "created_at": _dump_time(row.created_at),
                }
                for row in approvals
            ],
            "tasks": [
                {
                    "id": row.id,
                    "task_code": row.task_code,
                    "title": row.title,
                    "status": row.status,
                    "execution_mode": row.execution_mode,
                    "due_at": _dump_time(row.due_at),
                    "assignee_user_id": row.assignee_user_id,
                }
                for row in tasks
            ],
            "assets": [
                {
                    "id": row.id,
                    "file_name": row.file_name,
                    "folder_path": row.folder_path,
                    "storage_tier": row.storage_tier,
                    "web_url": row.web_url,
                    "status": row.status,
                }
                for row in assets
            ],
            "inbox": [
                {
                    "id": row.id,
                    "kind": row.kind,
                    "author_name": row.author_name,
                    "body": row.body,
                    "status": row.status,
                    "platform_code": row.platform_code,
                    "assignee_user_id": row.assignee_user_id,
                }
                for row in inbox
            ],
            "health": {
                "content_in_flight": len(in_flight),
                "content_approved": len(approved),
                "open_approvals": len([row for row in content if row.status == "in_review"]),
                "open_tasks": len(open_tasks),
                "calendar_slots": len([row for row in calendar if row.status != "cancelled"]),
                "assets": len(assets),
                "inbox_open": len(inbox_open),
            },
        }
