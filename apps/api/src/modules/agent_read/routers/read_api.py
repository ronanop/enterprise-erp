"""Agent read API routers (list + detail for MCP / ElevenLabs)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.agent_read.dependencies import get_agent_list_query
from modules.agent_read.schemas import AgentListQuery, PaginatedListResponse
from modules.agent_read.service.agent_read_service import AgentReadService
from modules.crm.schemas import LeadResponse
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.party import MasterCustomer
from modules.master_data.schemas import CustomerResponse, ProductResponse
from modules.sales.schemas import InvoiceResponse, SalesOrderResponse
from shared.schemas import APIResponse

leads_router = APIRouter(prefix="/leads", tags=["Agent Read — Leads"])
orders_router = APIRouter(prefix="/orders", tags=["Agent Read — Orders"])
customers_router = APIRouter(prefix="/agent/customers", tags=["Agent Read — Customers"])
invoices_router = APIRouter(prefix="/invoices", tags=["Agent Read — Invoices"])
products_router = APIRouter(prefix="/agent/products", tags=["Agent Read — Products"])


def _customer_from_row(row: MasterCustomer) -> CustomerResponse:
    return CustomerResponse(
        id=row.id,
        tenant_id=row.tenant_id,
        company_id=row.company_id,
        branch_id=row.branch_id,
        customer_code=row.customer_code,
        customer_name=row.customer_name,
        customer_type=row.customer_type,
        billing_address_json=row.billing_address_json,
        shipping_address_json=row.shipping_address_json,
        tax_number=row.tax_number,
        email=row.email,
        mobile=row.mobile,
        credit_limit=float(row.credit_limit) if row.credit_limit is not None else None,
        currency_code=row.currency_code,
        status=row.status,
        version=row.version,
        is_deleted=row.is_deleted,
    )


def _product_from_row(row) -> ProductResponse:
    return ProductResponse(
        id=row.id,
        tenant_id=row.tenant_id,
        company_id=row.company_id,
        product_code=row.product_code,
        product_name=row.product_name,
        product_type=row.product_type,
        uom_id=row.uom_id,
        status=row.status,
        version=row.version,
        is_deleted=row.is_deleted,
        is_inventory_tracked=row.is_inventory_tracked,
        branch_id=row.branch_id,
        category_id=row.category_id,
        tax_id=row.tax_id,
        barcode=row.barcode,
    )


@leads_router.get("", response_model=PaginatedListResponse)
def list_leads(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[AgentListQuery, Depends(get_agent_list_query)],
) -> PaginatedListResponse:
    rows, meta = AgentReadService(db).list_leads(ctx, query)
    return PaginatedListResponse(
        message="Leads retrieved",
        data=[LeadResponse.model_validate(r) for r in rows],
        meta=meta,
    )


@leads_router.get("/{id}", response_model=APIResponse[LeadResponse])
def get_lead(
    id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[LeadResponse]:
    row = AgentReadService(db).get_lead(ctx, id)
    return APIResponse(message="Lead retrieved", data=LeadResponse.model_validate(row))


@orders_router.get("", response_model=PaginatedListResponse)
def list_orders(
    ctx: Annotated[TenantContext, Depends(require_permission("sales.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[AgentListQuery, Depends(get_agent_list_query)],
) -> PaginatedListResponse:
    rows, meta = AgentReadService(db).list_orders(ctx, query)
    return PaginatedListResponse(
        message="Orders retrieved",
        data=[SalesOrderResponse.model_validate(r) for r in rows],
        meta=meta,
    )


@orders_router.get("/{id}", response_model=APIResponse[SalesOrderResponse])
def get_order(
    id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("sales.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[SalesOrderResponse]:
    row = AgentReadService(db).get_order(ctx, id)
    return APIResponse(message="Order retrieved", data=SalesOrderResponse.model_validate(row))


@customers_router.get("", response_model=PaginatedListResponse)
def list_customers(
    ctx: Annotated[TenantContext, Depends(require_permission("master.customer:read"))],
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[AgentListQuery, Depends(get_agent_list_query)],
) -> PaginatedListResponse:
    rows, meta = AgentReadService(db).list_customers(ctx, query)
    return PaginatedListResponse(
        message="Customers retrieved",
        data=[_customer_from_row(c) for c in rows],
        meta=meta,
    )


@customers_router.get("/{id}", response_model=APIResponse[CustomerResponse])
def get_customer(
    id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("master.customer:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CustomerResponse]:
    row = AgentReadService(db).get_customer(ctx, id)
    return APIResponse(message="Customer retrieved", data=CustomerResponse(**row.__dict__))


@invoices_router.get("", response_model=PaginatedListResponse)
def list_invoices(
    ctx: Annotated[TenantContext, Depends(require_permission("sales.invoice:read"))],
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[AgentListQuery, Depends(get_agent_list_query)],
) -> PaginatedListResponse:
    rows, meta = AgentReadService(db).list_invoices(ctx, query)
    return PaginatedListResponse(
        message="Invoices retrieved",
        data=[InvoiceResponse.model_validate(r) for r in rows],
        meta=meta,
    )


@invoices_router.get("/{id}", response_model=APIResponse[InvoiceResponse])
def get_invoice(
    id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("sales.invoice:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[InvoiceResponse]:
    row = AgentReadService(db).get_invoice(ctx, id)
    return APIResponse(message="Invoice retrieved", data=InvoiceResponse.model_validate(row))


@products_router.get("", response_model=PaginatedListResponse)
def list_products(
    ctx: Annotated[TenantContext, Depends(require_permission("master.product:read"))],
    db: Annotated[Session, Depends(get_db)],
    query: Annotated[AgentListQuery, Depends(get_agent_list_query)],
) -> PaginatedListResponse:
    rows, meta = AgentReadService(db).list_products(ctx, query)
    return PaginatedListResponse(
        message="Products retrieved",
        data=[_product_from_row(r) for r in rows],
        meta=meta,
    )


@products_router.get("/{id}", response_model=APIResponse[ProductResponse])
def get_product(
    id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("master.product:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ProductResponse]:
    row = AgentReadService(db).get_product(ctx, id)
    return APIResponse(message="Product retrieved", data=_product_from_row(row))
