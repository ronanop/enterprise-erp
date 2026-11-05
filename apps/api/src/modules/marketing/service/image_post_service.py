"""Generate marketing image posts and hand them to Canva for editing."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from core.config import settings
from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.adapters.canva_adapter import CanvaAdapter
from modules.marketing.adapters.image_gen_adapter import (
    ALLOWED_QUALITIES,
    DEFAULT_QUALITY,
    ImageGenAdapter,
)
from modules.marketing.domain.enums import ContentRequestStatus, ContentStatus
from modules.marketing.domain.exceptions import NotFoundException, ValidationException
from modules.marketing.models import MktContentRequest, MktGeneratedContent
from modules.marketing.repository.base import MktScopedRepository, utcnow
from modules.marketing.service.image_cost import cost_from_usage
from modules.marketing.service.number_service import MarketingNumberService
from modules.platform.compat.audit_facade import PlatformAuditFacade

KIND = "image_post"


class ImagePostService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)
        self._audit = PlatformAuditFacade(db)
        self._images = ImageGenAdapter()
        self._canva = CanvaAdapter()

    def provider_status(self, ctx: TenantContext) -> dict:
        canva = self._canva.status(ctx.user_id)
        return {
            "openai_configured": self._images.configured(),
            "canva_configured": canva["configured"],
            "canva_connected": canva["connected"],
            "canva_scopes": canva["scopes"],
            "sizes": ["1024x1024", "1024x1536", "1536x1024"],
            "qualities": sorted(ALLOWED_QUALITIES),
            "default_quality": DEFAULT_QUALITY,
        }

    def list_posts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[MktGeneratedContent]:
        """List saved image posts for history/preview.

        Uses company/tenant scope without pinning to session branch. Image posts are
        often created with a null branch; a strict branch equality filter would hide them.

        Each marketing member only sees their own generations (created_by = session user).
        """
        stmt = select(MktGeneratedContent).where(MktGeneratedContent.is_deleted.is_(False))
        company = self._repo.resolve_list_company_id(ctx, company_id)
        if company is not None:
            stmt = stmt.where(MktGeneratedContent.company_id == company)
        # branch_scoped=False so history stays visible across session branch changes
        stmt = self._repo.apply_mkt_filter(stmt, MktGeneratedContent, ctx, branch_scoped=False)
        if ctx.user_id is not None:
            stmt = stmt.where(MktGeneratedContent.created_by == ctx.user_id)
        rows = list(self.db.scalars(stmt).all())
        image_rows = [row for row in rows if _is_image_post(row)]
        image_rows.sort(key=lambda row: getattr(row, "created_at", None) or utcnow(), reverse=True)
        return image_rows

    def get_post(self, ctx: TenantContext, content_id: UUID) -> MktGeneratedContent:
        row = self._repo.get_by_id(MktGeneratedContent, ctx, content_id, branch_scoped=False)
        if row is None or not _is_image_post(row):
            raise NotFoundException("Image post not found")
        # Private studio: never expose another member's image by id.
        if ctx.user_id is not None and row.created_by is not None and row.created_by != ctx.user_id:
            raise NotFoundException("Image post not found")
        return row

    def generate(
        self,
        ctx: TenantContext,
        *,
        prompt: str,
        size: str = "1024x1024",
        quality: str = DEFAULT_QUALITY,
        platform: str | None = None,
        creative: dict | None = None,
        company_id: UUID | None = None,
        campaign_id: UUID | None = None,
    ) -> MktGeneratedContent:
        company = self._repo.resolve_company_id(ctx, company_id)
        creative_meta = _normalize_creative(creative)
        gen_prompt = _prompt_with_creative(prompt.strip(), creative_meta)
        generated = self._images.generate(prompt=gen_prompt, size=size, quality=quality)
        branch_id = ctx.branch_id

        format_label = (creative_meta or {}).get("format_label")
        request_code = self._numbers.next_code(MktContentRequest, company, "request_code", "CRQ")
        request = self._repo.create_row(
            MktContentRequest,
            ctx,
            company_id=company,
            branch_id=branch_id,
            request_code=request_code,
            topic=(prompt.strip()[:500]),
            content_type="post",
            tone="visual",
            goal=f"image_post:{platform or (creative_meta or {}).get('category_id') or 'social'}",
            purpose="image_post",
            inputs={
                "kind": KIND,
                "size": size,
                "quality": quality,
                "platform": platform,
                "prompt": prompt.strip(),
                "creative": creative_meta,
            },
            status=ContentRequestStatus.COMPLETED.value,
            campaign_id=campaign_id,
        )

        quality = str(generated.get("quality") or quality or DEFAULT_QUALITY)
        cost = cost_from_usage(
            generated.get("usage") if isinstance(generated.get("usage"), dict) else None,
            model=str(generated.get("model") or ""),
            size=size,
            quality=quality,
        )
        pipeline = {
            "kind": KIND,
            "prompt": prompt.strip(),
            "generation_prompt": gen_prompt,
            "size": size,
            "quality": quality,
            "platform": platform,
            "creative": creative_meta,
            "content_type": generated["content_type"],
            "revised_prompt": generated.get("revised_prompt"),
            "usage": generated.get("usage"),
            "cost": cost,
            "canva": None,
        }
        headline = (
            f"{format_label} · {size}"
            if format_label
            else f"Image post · {size}"
        )
        tags = [t for t in [platform, (creative_meta or {}).get("format_id")] if t]
        row = self._repo.create_row(
            MktGeneratedContent,
            ctx,
            company_id=company,
            branch_id=branch_id,
            content_request_id=request.id,
            campaign_id=campaign_id,
            headline=headline,
            hook=(prompt.strip()[:240]),
            body=prompt.strip(),
            cta="Edit in Canva",
            hashtags={"tags": tags or ["image_post"]},
            scores={"overall": 0, "suggestions": ["Open in Canva to refine layers"]},
            pipeline_result=pipeline,
            ai_model=generated.get("model"),
            status=ContentStatus.DRAFT.value,
        )
        relative = f"{company}/{row.id}.png"
        stored_path = self._store_bytes(relative, generated["bytes"])
        pipeline = dict(row.pipeline_result or {})
        pipeline["image_relpath"] = relative
        pipeline["image_path"] = str(stored_path)
        row.pipeline_result = pipeline
        flag_modified(row, "pipeline_result")
        self.db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mkt_generated_content",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"kind": KIND, "size": size, "usd": cost.get("usd")},
        )
        self.db.flush()
        return row

    def usage_summary(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        refresh_fx: bool = False,
    ) -> dict:
        """Today / last-7-days / last-image OpenAI image spend (USD + tokens)."""
        rows = self.list_posts(ctx, company_id)
        dirty = False
        for row in rows:
            if self._ensure_cost(row):
                dirty = True
        if dirty:
            self.db.flush()

        now = datetime.now(timezone.utc)
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_7d = now - timedelta(days=7)

        today_usd = 0.0
        today_tokens = 0
        week_usd = 0.0
        week_tokens = 0
        today_count = 0
        week_count = 0

        for row in rows:
            cost = _row_cost(row)
            if not cost:
                continue
            usd = float(cost.get("usd") or 0)
            tokens = int(cost.get("total_tokens") or 0)
            created = _as_utc(getattr(row, "created_at", None))
            if created is None:
                continue
            if created >= start_7d:
                week_usd += usd
                week_tokens += tokens
                week_count += 1
            if created >= start_today:
                today_usd += usd
                today_tokens += tokens
                today_count += 1

        last = rows[0] if rows else None
        last_cost = _row_cost(last) if last else None
        last_created = _as_utc(getattr(last, "created_at", None)) if last else None

        return {
            "currency": "USD",
            "today": {
                "usd": round(today_usd, 6),
                "tokens": today_tokens,
                "image_count": today_count,
            },
            "last_7_days": {
                "usd": round(week_usd, 6),
                "tokens": week_tokens,
                "image_count": week_count,
            },
            "last_image": {
                "content_id": str(last.id) if last else None,
                "created_at": last_created.isoformat() if last_created else None,
                "usd": float(last_cost.get("usd") or 0) if last_cost else 0.0,
                "tokens": int(last_cost.get("total_tokens") or 0) if last_cost else 0,
                "text_input_tokens": int(last_cost.get("text_input_tokens") or 0) if last_cost else 0,
                "image_output_tokens": int(last_cost.get("image_output_tokens") or 0) if last_cost else 0,
                "source": (last_cost or {}).get("source"),
                "model": (last_cost or {}).get("model") or (getattr(last, "ai_model", None) if last else None),
                "size": (last_cost or {}).get("size") or ((last.pipeline_result or {}).get("size") if last else None),
                "quality": (last_cost or {}).get("quality"),
            },
            "rates": {
                "text_input_per_m": 5.0,
                "image_input_per_m": 8.0,
                "image_output_per_m": 30.0,
            },
            "fx": self._usd_inr_fx(force_refresh=refresh_fx),
        }

    def _usd_inr_fx(self, *, force_refresh: bool = False) -> dict:
        from modules.marketing.adapters.frankfurter_fx import get_usd_inr_rate

        return get_usd_inr_rate(force_refresh=force_refresh)

    def _ensure_cost(self, row: MktGeneratedContent) -> bool:
        """Backfill pipeline_result.cost for older image posts. Returns True if mutated."""
        pipeline = dict(row.pipeline_result or {}) if isinstance(row.pipeline_result, dict) else {}
        existing = pipeline.get("cost")
        if isinstance(existing, dict) and existing.get("usd") is not None:
            return False
        usage = pipeline.get("usage") if isinstance(pipeline.get("usage"), dict) else None
        cost = cost_from_usage(
            usage,
            model=str(getattr(row, "ai_model", None) or pipeline.get("model") or ""),
            size=str(pipeline.get("size") or "1024x1024"),
            quality=str(pipeline.get("quality") or "auto"),
        )
        pipeline["cost"] = cost
        row.pipeline_result = pipeline
        flag_modified(row, "pipeline_result")
        return True

    def read_image_bytes(self, ctx: TenantContext, content_id: UUID) -> tuple[bytes, str]:
        row = self.get_post(ctx, content_id)
        pipeline = row.pipeline_result or {}
        path = _resolve_image_path(pipeline)
        if path is None or not path.is_file():
            raise NotFoundException(
                "Image file not found on disk. Older files may have been lost before "
                "persistent storage was enabled — regenerate or repurpose from a saved copy."
            )
        # Heal: copy into the volume-backed root when found under a legacy path.
        rel = pipeline.get("image_relpath")
        if rel:
            target = _image_root() / str(rel)
            if path.resolve() != target.resolve():
                try:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if not target.is_file():
                        target.write_bytes(path.read_bytes())
                    pipeline = dict(pipeline)
                    pipeline["image_relpath"] = str(rel)
                    pipeline["image_path"] = str(target)
                    row.pipeline_result = pipeline
                    flag_modified(row, "pipeline_result")
                    self.db.flush()
                    path = target
                except OSError:
                    pass
        return path.read_bytes(), str(pipeline.get("content_type") or "image/png")

    def repurpose(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        prompt: str,
        size: str | None = None,
        quality: str | None = None,
    ) -> MktGeneratedContent:
        """Create a new image version from an existing post (ChatGPT-style edit).

        Keeps the source row untouched and inserts a sibling draft with lineage metadata.
        """
        source = self.get_post(ctx, content_id)
        source_pipeline = source.pipeline_result if isinstance(source.pipeline_result, dict) else {}
        image_bytes, content_type = self.read_image_bytes(ctx, content_id)

        size_norm = (size or source_pipeline.get("size") or "1024x1024").strip()
        quality_norm = (
            quality or source_pipeline.get("quality") or DEFAULT_QUALITY
        ).strip() or DEFAULT_QUALITY
        platform = source_pipeline.get("platform")
        creative = source_pipeline.get("creative") if isinstance(source_pipeline.get("creative"), dict) else None

        edited = self._images.edit(
            image_bytes=image_bytes,
            prompt=prompt.strip(),
            size=size_norm,
            quality=quality_norm,
            content_type=content_type,
        )

        company = source.company_id
        branch_id = source.branch_id or ctx.branch_id
        request_code = self._numbers.next_code(MktContentRequest, company, "request_code", "CRQ")
        request = self._repo.create_row(
            MktContentRequest,
            ctx,
            company_id=company,
            branch_id=branch_id,
            request_code=request_code,
            topic=(prompt.strip()[:500]),
            content_type="post",
            tone="visual",
            goal=f"image_post_repurpose:{platform or 'social'}",
            purpose="image_post",
            inputs={
                "kind": KIND,
                "variant": "repurpose",
                "parent_content_id": str(source.id),
                "size": size_norm,
                "quality": quality_norm,
                "platform": platform,
                "prompt": prompt.strip(),
                "creative": creative,
            },
            status=ContentRequestStatus.COMPLETED.value,
            campaign_id=source.campaign_id,
        )

        quality_resolved = str(edited.get("quality") or quality_norm or DEFAULT_QUALITY)
        cost = cost_from_usage(
            edited.get("usage") if isinstance(edited.get("usage"), dict) else None,
            model=str(edited.get("model") or ""),
            size=size_norm,
            quality=quality_resolved,
        )
        format_label = (creative or {}).get("format_label") if creative else None
        source_label = (source.headline or source.hook or "image")[:80]
        pipeline = {
            "kind": KIND,
            "variant": "repurpose",
            "parent_content_id": str(source.id),
            "prompt": prompt.strip(),
            "size": size_norm,
            "quality": quality_resolved,
            "platform": platform,
            "creative": creative,
            "content_type": edited["content_type"],
            "revised_prompt": edited.get("revised_prompt"),
            "usage": edited.get("usage"),
            "cost": cost,
            "canva": None,
        }
        row = self._repo.create_row(
            MktGeneratedContent,
            ctx,
            company_id=company,
            branch_id=branch_id,
            content_request_id=request.id,
            campaign_id=source.campaign_id,
            headline=(
                f"Repurpose · {format_label}"
                if format_label
                else f"Repurpose · {source_label}"
            )[:240],
            hook=(prompt.strip()[:240]),
            body=prompt.strip(),
            cta="Edit in Canva",
            hashtags={
                "tags": [
                    t
                    for t in [
                        platform,
                        "repurpose",
                        (creative or {}).get("format_id") if creative else None,
                    ]
                    if t
                ]
                or ["image_post", "repurpose"]
            },
            scores={
                "overall": 0,
                "suggestions": [
                    f"Repurposed from {source.id}",
                    "Open in Canva to refine layers",
                ],
            },
            pipeline_result=pipeline,
            ai_model=edited.get("model"),
            status=ContentStatus.DRAFT.value,
        )
        relative = f"{company}/{row.id}.png"
        stored_path = self._store_bytes(relative, edited["bytes"])
        pipeline = dict(row.pipeline_result or {})
        pipeline["image_relpath"] = relative
        pipeline["image_path"] = str(stored_path)
        row.pipeline_result = pipeline
        flag_modified(row, "pipeline_result")
        self.db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mkt_generated_content",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "kind": KIND,
                "variant": "repurpose",
                "parent_content_id": str(source.id),
                "size": size_norm,
                "usd": cost.get("usd"),
            },
        )
        self.db.flush()
        return row

    def canva_authorize_url(self, ctx: TenantContext, *, return_to: str | None = None) -> dict:
        return self._canva.build_authorize_url(user_id=ctx.user_id, return_to=return_to)

    def canva_exchange(self, *, code: str, state: str) -> dict:
        return self._canva.exchange_code(code=code, state=state)

    def edit_in_canva(self, ctx: TenantContext, content_id: UUID) -> MktGeneratedContent:
        row = self.get_post(ctx, content_id)
        image_bytes, _ctype = self.read_image_bytes(ctx, content_id)
        title = (row.headline or row.hook or "Marketing image post")[:80]
        asset_id = self._canva.upload_image(
            user_id=ctx.user_id,
            image_bytes=image_bytes,
            name=title,
        )
        canva_result = self._canva.image_to_design(
            user_id=ctx.user_id,
            asset_id=asset_id,
            title=title,
        )
        pipeline = dict(row.pipeline_result or {})
        pipeline["canva"] = {
            **canva_result,
            "updated_at": utcnow().isoformat(),
        }
        row.pipeline_result = pipeline
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mkt_generated_content",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={"canva_design_id": canva_result.get("canva_design_id")},
        )
        return row

    def _store_bytes(self, relative: str, data: bytes) -> Path:
        root = _image_root()
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path


def _normalize_creative(creative: dict | None) -> dict | None:
    if not isinstance(creative, dict) or not creative:
        return None
    allowed = (
        "category_id",
        "category_label",
        "format_id",
        "format_label",
        "width_px",
        "height_px",
        "inches",
        "cms",
    )
    out: dict = {}
    for key in allowed:
        value = creative.get(key)
        if value is None or value == "":
            continue
        if key in ("width_px", "height_px"):
            try:
                out[key] = int(value)
            except (TypeError, ValueError):
                continue
        else:
            out[key] = str(value).strip()[:200]
    return out or None


def _prompt_with_creative(prompt: str, creative: dict | None) -> str:
    if not creative:
        return prompt
    label = creative.get("format_label") or "marketing creative"
    category = creative.get("category_label") or "marketing"
    width = creative.get("width_px")
    height = creative.get("height_px")
    inches = creative.get("inches")
    cms = creative.get("cms")
    parts = [
        prompt,
        f"Deliverable: {label} ({category}).",
    ]
    if width and height:
        dim = f"Compose for final crop {width}×{height}px"
        if inches:
            dim += f" ({inches}"
            if cms:
                dim += f"; {cms}"
            dim += ")"
        parts.append(f"{dim}.")
    parts.append(
        "Keep critical text and logo clear of edges; leave safe margins for print/bleed where relevant."
    )
    return " ".join(parts)


def _image_root() -> Path:
    """Volume-backed root (under crm-attachments mount in Docker)."""
    base = Path(settings.resolved_crm_upload_root) / "marketing-image-posts"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _legacy_image_roots() -> list[Path]:
    """Pre-persist paths that lived outside the Docker volume."""
    parent = Path(settings.resolved_crm_upload_root).parent
    return [
        parent / "marketing-image-posts",
        Path("/app/var/marketing-image-posts"),
    ]


def _resolve_image_path(pipeline: dict) -> Path | None:
    rel = pipeline.get("image_relpath")
    candidates: list[Path] = []
    if rel:
        candidates.append(_image_root() / str(rel))
        for legacy in _legacy_image_roots():
            candidates.append(legacy / str(rel))
    abs_path = pipeline.get("image_path")
    if abs_path:
        candidates.append(Path(str(abs_path)))
    for path in candidates:
        try:
            if path.is_file():
                return path
        except OSError:
            continue
    return None


def _is_image_post(row: MktGeneratedContent) -> bool:
    pipeline = row.pipeline_result if isinstance(row.pipeline_result, dict) else {}
    return pipeline.get("kind") == KIND


def _row_cost(row: MktGeneratedContent | None) -> dict | None:
    if row is None:
        return None
    pipeline = row.pipeline_result if isinstance(row.pipeline_result, dict) else {}
    cost = pipeline.get("cost")
    return cost if isinstance(cost, dict) else None


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
