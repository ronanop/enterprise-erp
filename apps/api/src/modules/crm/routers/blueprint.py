"""Sales blueprint state + action REST endpoints for leads / opportunities /
quotes / OVF. This is the primary surface the Sales CRM UI drives the
BOQ -> ... -> won/lost flow through."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.schemas import (
    BlueprintActionRequest,
    BlueprintStateResponse,
    LeadLostRequest,
    OvfResponse,
    QuoteResponse,
    SalesLeadResponse,
)
from modules.crm.service import LeadService, OpportunityBlueprintService, OvfService, QuoteService
from modules.crm.service.engines import sales_blueprint_engine
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

blueprint_router = APIRouter(tags=["CRM - Sales Blueprint"])


@blueprint_router.get("/leads/{lead_id}/blueprint", response_model=APIResponse[BlueprintStateResponse])
def get_lead_blueprint(
    lead_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    lead = LeadService(db).get(ctx, lead_id)
    state = lead.blueprint_state or "open"
    return APIResponse(
        message="OK",
        data={
            "entity_type": "lead",
            "entity_id": lead.id,
            "state": state,
            "locked": lead.locked,
            "allowed_actions": [] if lead.locked else sales_blueprint_engine.allowed_actions("lead", state),
        },
    )


@blueprint_router.post("/leads/{lead_id}/lost", response_model=APIResponse[SalesLeadResponse])
def mark_lead_lost(
    lead_id: UUID,
    body: LeadLostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadService(db).mark_lost(ctx, lead_id, reason=body.reason))


@blueprint_router.get("/opportunities/{opportunity_id}/blueprint", response_model=APIResponse[BlueprintStateResponse])
def get_opportunity_blueprint(
    opportunity_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OpportunityBlueprintService(db).state(ctx, opportunity_id))


@blueprint_router.post("/opportunities/{opportunity_id}/actions/{action}", response_model=APIResponse[dict])
def perform_opportunity_action(
    opportunity_id: UUID,
    action: str,
    body: BlueprintActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:act"))],
    db: Annotated[Session, Depends(get_db)],
):
    opp = OpportunityBlueprintService(db).perform_action(ctx, opportunity_id, action, body.to_payload())
    return APIResponse(
        message="OK",
        data={
            "id": opp.id,
            "blueprint_state": opp.blueprint_state,
            "locked": opp.locked,
            "status": opp.status,
        },
    )


@blueprint_router.get("/quotes/{quote_id}/blueprint", response_model=APIResponse[BlueprintStateResponse])
def get_quote_blueprint(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    quote = QuoteService(db).get(ctx, quote_id)
    return APIResponse(
        message="OK",
        data={
            "entity_type": "quote",
            "entity_id": quote.id,
            "state": quote.quote_stage,
            "locked": quote.locked,
            "allowed_actions": (
                []
                if quote.locked
                else [
                    action
                    for action in sales_blueprint_engine.allowed_actions("quote", quote.quote_stage)
                    if action != "approve_internally"
                ]
            ),
        },
    )


@blueprint_router.get("/ovf/{ovf_id}/blueprint", response_model=APIResponse[BlueprintStateResponse])
def get_ovf_blueprint(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    ovf = OvfService(db).get(ctx, ovf_id)
    return APIResponse(
        message="OK",
        data={
            "entity_type": "ovf",
            "entity_id": ovf.id,
            "state": ovf.blueprint_state,
            "locked": ovf.locked,
            "allowed_actions": (
                [] if ovf.locked else sales_blueprint_engine.allowed_actions("ovf", ovf.blueprint_state)
            ),
        },
    )


@blueprint_router.post("/ovf/{ovf_id}/actions/{action}", response_model=APIResponse[OvfResponse])
def perform_ovf_action(
    ovf_id: UUID,
    action: str,
    body: BlueprintActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:act"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).apply_blueprint_action(ctx, ovf_id, action, body.to_payload()))
