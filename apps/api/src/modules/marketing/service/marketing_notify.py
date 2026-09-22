"""Foundation notification + workflow hooks for marketing content."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.notification_service import NotificationService
from modules.foundation.service.workflow_service import WorkflowService
from modules.marketing.models import MktCampaign, MktContentRequest, MktGeneratedContent

WORKFLOW_CODE = "marketing.content_approval"


def _user_ids(*values) -> list[UUID]:
    found: list[UUID] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, list):
            found.extend(_user_ids(*value))
            continue
        if isinstance(value, dict):
            found.extend(_user_ids(*value.values()))
            continue
        try:
            parsed = value if isinstance(value, UUID) else UUID(str(value))
        except (TypeError, ValueError):
            continue
        if parsed not in found:
            found.append(parsed)
    return found


def approver_ids(campaign: MktCampaign | None, request: MktContentRequest | None) -> list[UUID]:
    values = []
    if campaign is not None:
        values.append(campaign.owner_user_id)
        values.append(campaign.approvers)
    if request is not None:
        values.append(request.assigned_to_user_id)
        if isinstance(request.inputs, dict):
            values.append(request.inputs.get("approval_head_user_id"))
    return _user_ids(*values)


def required_approval_level(campaign: MktCampaign | None) -> int:
    if campaign is None or not isinstance(campaign.approvers, dict):
        if campaign is not None and isinstance(campaign.approvers, list) and campaign.approvers:
            return max(1, min(5, len(campaign.approvers)))
        return 1
    raw = campaign.approvers.get("required_level")
    try:
        return max(1, min(5, int(raw)))
    except (TypeError, ValueError):
        return 1


def notify_users(
    db: Session,
    ctx: TenantContext,
    *,
    event_type: str,
    title: str,
    body: str,
    user_ids: list[UUID],
    href: str,
) -> None:
    targets = [uid for uid in user_ids if uid and uid != ctx.user_id]
    if not targets:
        return
    try:
        service = NotificationService(db)
        template = service.get_or_create_template(
            tenant_id=ctx.tenant_id,
            template_code=f"marketing.{event_type}",
            template_name=title,
            channel="in_app",
            body_template=body,
            subject_template=title,
            created_by=ctx.user_id,
        )
        for user_id in targets:
            service.send(
                tenant_id=ctx.tenant_id,
                template_id=template.id,
                event_type=event_type,
                recipient_user_id=user_id,
                recipient_address=None,
                payload_json={"title": title, "body": body, "href": href},
                created_by=ctx.user_id,
            )
    except Exception:
        return


def start_content_workflow(db: Session, ctx: TenantContext, content: MktGeneratedContent) -> str | None:
    try:
        workflow = WorkflowService(db)
        definition = next(
            (row for row in workflow.list_definitions(ctx.tenant_id) if row.workflow_code == WORKFLOW_CODE),
            None,
        )
        if definition is None:
            definition = workflow.create_definition(
                tenant_id=ctx.tenant_id,
                workflow_code=WORKFLOW_CODE,
                workflow_name="Marketing content approval",
                module="marketing",
                document_type="generated_content",
                created_by=ctx.user_id,
            )
            workflow.add_step(
                tenant_id=ctx.tenant_id,
                workflow_id=definition.id,
                step_order=1,
                step_code="review",
                step_name="Caption review",
                approver_type="user",
                created_by=ctx.user_id,
            )
        instance = workflow.create_instance(
            tenant_id=ctx.tenant_id,
            workflow_id=definition.id,
            entity_name="mkt_generated_content",
            entity_id=content.id,
            started_by=ctx.user_id,
        )
        return str(instance.id)
    except Exception:
        return None


def approve_content_workflow(db: Session, ctx: TenantContext, instance_id: str | None, comment: str | None) -> None:
    if not instance_id:
        return
    try:
        WorkflowService(db).approve(
            tenant_id=ctx.tenant_id,
            instance_id=UUID(instance_id),
            performed_by=ctx.user_id,
            comments=comment,
        )
    except Exception:
        return
