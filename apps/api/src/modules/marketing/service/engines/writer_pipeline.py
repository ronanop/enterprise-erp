"""Generate native variants from brand voice and approved posts."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.adapters.content_writer_adapter import ContentWriterAdapter
from modules.marketing.domain.enums import ContentStatus
from modules.marketing.models import (
    MktBrandVoice,
    MktGeneratedContent,
    MktPlatform,
)
from modules.marketing.models.content_request import MktContentRequest
from modules.marketing.repository.base import MktScopedRepository


def _keywords(raw) -> list[str]:
    if isinstance(raw, list):
        return [str(item) for item in raw if str(item).strip()]
    if isinstance(raw, dict):
        values = raw.get("keywords") or raw.get("tags") or list(raw.values())
        return [str(item) for item in values if str(item).strip()]
    return []


def generate_variants(db: Session, ctx: TenantContext, request: MktContentRequest) -> list[MktGeneratedContent]:
    repo = MktScopedRepository(db)
    platform_code = None
    if request.platform_id:
        platform = db.get(MktPlatform, request.platform_id)
        platform_code = platform.platform_code if platform else None

    voice_name = None
    guidelines = None
    keywords: list[str] = []
    if request.brand_voice_id:
        voice = db.get(MktBrandVoice, request.brand_voice_id)
        if voice is not None and not voice.is_deleted:
            voice_name = voice.voice_name
            guidelines = voice.guidelines
            keywords = _keywords(voice.tone_keywords)
            kit = voice.brand_kit if isinstance(voice.brand_kit, dict) else {}
            colors = ", ".join(
                str(item.get("hex"))
                for item in (kit.get("colors") or [])
                if isinstance(item, dict) and item.get("hex")
            )
            fonts = ", ".join(
                str(item.get("family"))
                for item in (kit.get("fonts") or [])
                if isinstance(item, dict) and item.get("family")
            )
            extra = " ".join(
                part
                for part in (
                    f"Brand colors: {colors}." if colors else "",
                    f"Brand fonts: {fonts}." if fonts else "",
                    str(kit.get("usage_notes") or "").strip(),
                )
                if part
            )
            if extra:
                guidelines = f"{guidelines or ''}\n{extra}".strip()

    approved = list(
        db.scalars(
            select(MktGeneratedContent)
            .where(
                MktGeneratedContent.company_id == request.company_id,
                MktGeneratedContent.is_deleted.is_(False),
                MktGeneratedContent.status == ContentStatus.APPROVED.value,
            )
            .order_by(MktGeneratedContent.updated_at.desc())
            .limit(8)
        ).all()
    )
    if request.platform_id:
        same_platform = [row for row in approved if row.platform_id == request.platform_id]
        examples_source = same_platform or approved
    else:
        examples_source = approved
    examples = []
    for row in examples_source[:5]:
        text = "\n".join(part for part in (row.hook, row.body) if part)
        if text.strip():
            examples.append(text.strip())

    pack = ContentWriterAdapter().write_pack(
        topic=request.topic,
        content_type=request.content_type,
        tone=request.tone,
        platform_code=platform_code,
        goal=request.goal,
        voice_name=voice_name,
        voice_guidelines=guidelines,
        tone_keywords=keywords,
        approved_examples=examples,
    )

    created: list[MktGeneratedContent] = []
    for variant in pack["variants"]:
        platform_id = request.platform_id if variant["code"] == (platform_code or "linkedin") else None
        row = repo.create_row(
            MktGeneratedContent,
            ctx,
            company_id=request.company_id,
            branch_id=request.branch_id,
            content_request_id=request.id,
            campaign_id=request.campaign_id,
            platform_id=platform_id,
            headline=variant["headline"],
            hook=variant["hook"],
            body=variant["body"] or topic,
            cta=variant["cta"],
            hashtags={"tags": variant["hashtags"], "variant": variant["code"]},
            scores={
                **pack["scores"],
                "variant": variant["code"],
                "lines_to_change": variant["lines_to_change"],
            },
            pipeline_result={
                "variant": variant["code"],
                "label": variant["label"],
                "lines_to_change": variant["lines_to_change"],
                "model": pack["model"],
                "approved_examples_used": len(examples),
                "brand_voice": voice_name,
            },
            content_version=1,
            ai_model=pack["model"],
            token_count=len((variant["body"] or "").split()),
            status=ContentStatus.DRAFT.value,
        )
        created.append(row)
    return created
