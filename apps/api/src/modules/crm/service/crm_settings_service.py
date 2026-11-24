"""ERP-admin CRM Settings — tenant config overlay over stock defaults."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException, ValidationException
from modules.crm.domain.settings_defaults import (
    SETTINGS_SECTIONS,
    deep_merge,
    default_crm_settings,
)
from modules.crm.repository.tenant_settings_repository import TenantSettingsRepository
from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade

_POLICY_EXPRESSION_KEYS = frozenset({"product_type_includes", "entity_status_equals"})


class CrmSettingsService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = TenantSettingsRepository(db)
        self._audit = PlatformAuditFacade(db)

    def _require_erp_admin(self, ctx: TenantContext) -> None:
        if ctx.user_type not in ADMIN_USER_TYPES:
            raise ForbiddenException("Only ERP admins can manage CRM Settings")

    def get_overlay(self, ctx: TenantContext) -> dict[str, Any]:
        self._require_erp_admin(ctx)
        row = self._repo.get_for_tenant(ctx.tenant_id)
        if row is None or not isinstance(row.config, dict):
            return {}
        return deepcopy(row.config)

    def get_effective(self, ctx: TenantContext, *, require_erp_admin: bool = False) -> dict[str, Any]:
        """Effective config for runtime. ERP admin required only when editing UI loads overlay APIs.

        Read path for forms/tables allows any authenticated CRM caller so create pages work;
        write/reset always require ERP admin.
        """
        if require_erp_admin:
            self._require_erp_admin(ctx)
        row = self._repo.get_for_tenant(ctx.tenant_id)
        overlay = row.config if row is not None and isinstance(row.config, dict) else {}
        return deep_merge(default_crm_settings(), overlay)

    def get_meta(self, ctx: TenantContext) -> dict[str, Any]:
        self._require_erp_admin(ctx)
        row = self._repo.get_for_tenant(ctx.tenant_id)
        return {
            "has_overlay": row is not None,
            "config_version": int(row.config_version) if row is not None else 0,
            "updated_at": row.updated_at.isoformat() if row is not None and row.updated_at else None,
            "sections": sorted(SETTINGS_SECTIONS),
        }

    def replace_section(self, ctx: TenantContext, section: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._require_erp_admin(ctx)
        key = (section or "").strip()
        if key not in SETTINGS_SECTIONS:
            raise ValidationException(f"Unknown settings section: {section}")
        if not isinstance(payload, dict):
            raise ValidationException("Section payload must be an object")
        cleaned = deepcopy(payload)
        if key == "forms":
            cleaned = self._validate_forms_section(cleaned)
        elif key == "catalogs":
            cleaned = self._validate_catalogs_section(cleaned)
        elif key == "approvals":
            cleaned = self._validate_approvals_section(cleaned)
        row = self._repo.get_for_tenant(ctx.tenant_id)
        overlay: dict[str, Any] = deepcopy(row.config) if row and isinstance(row.config, dict) else {}
        overlay[key] = cleaned
        row = self._repo.upsert(ctx, config=overlay)
        self._audit_settings(ctx, row, operation="update", section=key)
        return self.get_effective(ctx, require_erp_admin=True)

    def replace_overlay(self, ctx: TenantContext, overlay: dict[str, Any]) -> dict[str, Any]:
        self._require_erp_admin(ctx)
        if not isinstance(overlay, dict):
            raise ValidationException("Overlay must be an object")
        cleaned = {k: deepcopy(v) for k, v in overlay.items() if k in SETTINGS_SECTIONS}
        row = self._repo.upsert(ctx, config=cleaned)
        self._audit_settings(ctx, row, operation="update", section="overlay")
        return self.get_effective(ctx, require_erp_admin=True)

    def reset(self, ctx: TenantContext) -> dict[str, Any]:
        self._require_erp_admin(ctx)
        prior = self._repo.get_for_tenant(ctx.tenant_id)
        self._repo.soft_reset(ctx)
        if prior is not None:
            self._audit_settings(ctx, prior, operation="reset", section="all")
        return default_crm_settings()

    def _audit_settings(
        self,
        ctx: TenantContext,
        row: Any,
        *,
        operation: str,
        section: str,
    ) -> None:
        entity_id = getattr(row, "id", None)
        if entity_id is None:
            return
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_tenant_settings",
            entity_id=entity_id,
            operation=operation,
            performed_by=ctx.user_id,
            new_value={"section": section, "config_version": getattr(row, "config_version", None)},
        )

    @staticmethod
    def form_field_map(effective: dict[str, Any], entity: str) -> dict[str, dict[str, Any]]:
        forms = effective.get("forms") or {}
        block = forms.get(entity) or {}
        fields = block.get("fields") if isinstance(block, dict) else None
        out: dict[str, dict[str, Any]] = {}
        if not isinstance(fields, list):
            return out
        for raw in fields:
            if not isinstance(raw, dict):
                continue
            key = str(raw.get("key") or "").strip()
            if not key:
                continue
            out[key] = raw
        return out

    @staticmethod
    def table_columns(effective: dict[str, Any], entity: str) -> list[dict[str, Any]]:
        tables = effective.get("tables") or {}
        block = tables.get(entity) or {}
        cols = block.get("columns") if isinstance(block, dict) else None
        if not isinstance(cols, list):
            return []
        rows = [c for c in cols if isinstance(c, dict) and c.get("key")]
        return sorted(rows, key=lambda c: int(c.get("order") or 0))

    @staticmethod
    def _eval_policy_expression(
        expression: dict[str, Any],
        context: dict[str, Any],
        *,
        default: bool,
    ) -> bool:
        for expr_key, raw in expression.items():
            if expr_key not in _POLICY_EXPRESSION_KEYS:
                continue
            if expr_key == "product_type_includes":
                needle = str(raw or "").strip().lower()
                if not needle:
                    continue
                product_type = str(context.get("product_type") or "").lower()
                if needle not in product_type:
                    return False
            elif expr_key == "entity_status_equals":
                expected = str(raw or "").strip().lower()
                if not expected:
                    continue
                actual = str(context.get("status") or context.get("entity_status") or "").lower()
                if actual != expected:
                    return False
        return default

    @staticmethod
    def policy_flag(
        effective: dict[str, Any],
        key: str,
        default: bool = True,
        *,
        context: dict[str, Any] | None = None,
    ) -> bool:
        policies = effective.get("policies") or {}
        if isinstance(policies, dict):
            rules = policies.get("rules")
            if isinstance(rules, list):
                for raw in rules:
                    if not isinstance(raw, dict) or str(raw.get("key") or "") != key:
                        continue
                    if raw.get("enabled") is False:
                        return False
                    expr = raw.get("expression")
                    if isinstance(expr, dict) and expr and context is not None:
                        return CrmSettingsService._eval_policy_expression(
                            expr, context, default=default
                        )
                    return raw.get("enabled") is not False
            flags = policies.get("flags")
            if isinstance(flags, dict) and key in flags:
                return bool(flags[key])
            if key in policies and key not in {"rules", "flags"}:
                val = policies[key]
                if isinstance(val, bool):
                    return val
        blueprint = effective.get("blueprint") or {}
        rules = blueprint.get("rules") if isinstance(blueprint, dict) else {}
        if isinstance(rules, dict) and key in rules:
            return bool(rules[key])
        return default

    @staticmethod
    def blueprint_rule_enabled(effective: dict[str, Any], rule_key: str, default: bool = True) -> bool:
        blueprint = effective.get("blueprint") or {}
        rules = blueprint.get("rules") if isinstance(blueprint, dict) else {}
        if isinstance(rules, dict) and rule_key in rules:
            return bool(rules[rule_key])
        return CrmSettingsService.policy_flag(effective, rule_key, default)

    @staticmethod
    def approval_step_meta(effective: dict[str, Any], step_key: str) -> tuple[str, str]:
        for step in CrmSettingsService.effective_approval_steps(effective):
            if str(step.get("key") or "") == step_key:
                return (
                    str(step.get("label") or step_key),
                    str(step.get("team_role") or "management"),
                )
        from modules.crm.domain.approval_step_owners import APPROVAL_STEP_CATALOG

        if step_key in APPROVAL_STEP_CATALOG:
            label, team_role, _ = APPROVAL_STEP_CATALOG[step_key]
            return label, team_role
        return step_key, "management"

    @staticmethod
    def attachment_policy(effective: dict[str, Any], key: str) -> dict[str, Any] | None:
        block = effective.get("attachments") or {}
        policies = block.get("policies") if isinstance(block, dict) else None
        if not isinstance(policies, list):
            return None
        for raw in policies:
            if isinstance(raw, dict) and str(raw.get("key") or "") == key:
                return raw
        return None

    @staticmethod
    def attachment_required(
        effective: dict[str, Any],
        key: str,
        *,
        product_type: str | None = None,
        default: bool = False,
    ) -> bool:
        """Resolve attachment required flag, honoring product_type_includes when present."""
        from modules.crm.domain.product_types import product_type_includes_services

        pol = CrmSettingsService.attachment_policy(effective, key)
        if pol is None:
            return default
        when = pol.get("when")
        if isinstance(when, dict):
            includes = str(when.get("product_type_includes") or "").strip().lower()
            if includes == "services" and not product_type_includes_services(product_type):
                return False
        return bool(pol.get("required"))

    @staticmethod
    def catalog_options(
        effective: dict[str, Any],
        catalog_key: str,
        *,
        parent_value: str | None = None,
        enabled_only: bool = True,
    ) -> list[dict[str, Any]]:
        catalogs = effective.get("catalogs") or {}
        block = catalogs.get(catalog_key) if isinstance(catalogs, dict) else None
        options = block.get("options") if isinstance(block, dict) else None
        if not isinstance(options, list):
            return []
        rows: list[dict[str, Any]] = []
        for raw in options:
            if not isinstance(raw, dict) or not raw.get("value"):
                continue
            if enabled_only and raw.get("enabled") is False:
                continue
            meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
            if parent_value is not None and str(meta.get("parent_value") or "") != parent_value:
                continue
            rows.append(raw)
        return sorted(rows, key=lambda c: int(c.get("order") or 0))

    @staticmethod
    def sanitize_custom_fields(
        effective: dict[str, Any],
        entity: str,
        payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Keep only custom (cf_*) keys declared on the entity form schema."""
        if not isinstance(payload, dict):
            return {}
        allowed = {
            key
            for key, field in CrmSettingsService.form_field_map(effective, entity).items()
            if str(field.get("source") or "") == "custom" or key.startswith("cf_")
        }
        out: dict[str, Any] = {}
        for key, value in payload.items():
            k = str(key).strip()
            if k in allowed or (k.startswith("cf_") and k in allowed):
                out[k] = value
            elif k.startswith("cf_") and k in {
                str(f.get("key"))
                for f in ((effective.get("forms") or {}).get(entity) or {}).get("fields") or []
                if isinstance(f, dict)
            }:
                out[k] = value
        # Also accept any cf_* present in schema map
        for key, value in payload.items():
            k = str(key).strip()
            if not k.startswith("cf_"):
                continue
            field = CrmSettingsService.form_field_map(effective, entity).get(k)
            if field is not None:
                out[k] = value
        return out

    @staticmethod
    def blueprint_action_enabled(effective: dict[str, Any], action: str, default: bool = True) -> bool:
        blueprint = effective.get("blueprint") or {}
        actions = blueprint.get("actions") if isinstance(blueprint, dict) else None
        if not isinstance(actions, dict):
            return default
        row = actions.get(action)
        if not isinstance(row, dict):
            return default
        return row.get("enabled") is not False

    @staticmethod
    def effective_approval_steps(effective: dict[str, Any]) -> list[dict[str, Any]]:
        from modules.crm.domain.approval_step_owners import APPROVAL_STEP_CATALOG

        stock = [
            {
                "key": key,
                "label": label,
                "team_role": role,
                "enabled": True,
                "source": "stock",
            }
            for key, (label, role, _) in APPROVAL_STEP_CATALOG.items()
        ]
        block = effective.get("approvals") or {}
        overlay_steps = block.get("steps") if isinstance(block, dict) else None
        if not isinstance(overlay_steps, list):
            return stock
        by_key = {s["key"]: s for s in stock}
        for raw in overlay_steps:
            if not isinstance(raw, dict):
                continue
            key = str(raw.get("key") or "").strip()
            if not key:
                continue
            if key in by_key:
                by_key[key] = {
                    **by_key[key],
                    "label": str(raw.get("label") or by_key[key]["label"]),
                    "enabled": raw.get("enabled") is not False,
                    "team_role": str(raw.get("team_role") or by_key[key]["team_role"]),
                }
            else:
                by_key[key] = {
                    "key": key,
                    "label": str(raw.get("label") or key),
                    "team_role": str(raw.get("team_role") or "management"),
                    "enabled": raw.get("enabled") is not False,
                    "source": "custom",
                }
        return [row for row in by_key.values() if row.get("enabled") is not False]

    def _validate_forms_section(self, payload: dict[str, Any]) -> dict[str, Any]:
        defaults = default_crm_settings().get("forms") or {}
        stock_keys: dict[str, set[str]] = {}
        for entity, block in defaults.items():
            fields = block.get("fields") if isinstance(block, dict) else []
            stock_keys[entity] = {
                str(f.get("key"))
                for f in (fields or [])
                if isinstance(f, dict) and f.get("key") and str(f.get("source") or "stock") == "stock"
            }
        allowed_types = {
            "text",
            "textarea",
            "number",
            "date",
            "email",
            "phone",
            "select",
            "multiselect",
            "checkbox",
            "url",
        }
        out: dict[str, Any] = {}
        for entity, block in payload.items():
            if not isinstance(block, dict):
                continue
            fields = block.get("fields")
            if not isinstance(fields, list):
                raise ValidationException(f"forms.{entity}.fields must be a list")
            kept: list[dict[str, Any]] = []
            seen: set[str] = set()
            for raw in fields:
                if not isinstance(raw, dict):
                    continue
                key = str(raw.get("key") or "").strip()
                if not key or key in seen:
                    continue
                seen.add(key)
                source = str(raw.get("source") or ("stock" if key in stock_keys.get(entity, set()) else "custom"))
                if source == "stock" and key not in stock_keys.get(entity, set()) and not key.startswith("cf_"):
                    # unknown stock-like key treated as custom
                    source = "custom"
                    if not key.startswith("cf_"):
                        key = f"cf_{key}"
                if source == "custom" and not key.startswith("cf_"):
                    key = f"cf_{key}"
                field_type = str(raw.get("type") or "text").strip().lower()
                if field_type not in allowed_types:
                    raise ValidationException(f"Unsupported field type: {field_type}")
                label = str(raw.get("label") or key).strip()
                if not label:
                    raise ValidationException(f"Field {key} needs a label")
                row = {
                    **raw,
                    "key": key,
                    "label": label,
                    "type": field_type,
                    "source": source,
                    "visible": raw.get("visible") is not False,
                    "required": bool(raw.get("required")),
                    "order": int(raw.get("order") or 0),
                }
                kept.append(row)
            # Ensure no stock field was dropped entirely — restore missing stock from defaults
            present = {f["key"] for f in kept}
            for stock_key in stock_keys.get(entity, set()):
                if stock_key not in present:
                    defaults_fields = (defaults.get(entity) or {}).get("fields") or []
                    for df in defaults_fields:
                        if isinstance(df, dict) and df.get("key") == stock_key:
                            kept.append(deepcopy(df))
                            break
            out[entity] = {"fields": sorted(kept, key=lambda f: int(f.get("order") or 0))}
        return out

    def _validate_catalogs_section(self, payload: dict[str, Any]) -> dict[str, Any]:
        defaults = default_crm_settings().get("catalogs") or {}
        out: dict[str, Any] = {}
        for catalog_key, block in payload.items():
            if not isinstance(block, dict):
                continue
            stock_values = {
                str(o.get("value"))
                for o in ((defaults.get(catalog_key) or {}).get("options") or [])
                if isinstance(o, dict) and o.get("value")
            }
            options_in = block.get("options")
            if not isinstance(options_in, list):
                raise ValidationException(f"catalogs.{catalog_key}.options must be a list")
            seen: set[str] = set()
            options: list[dict[str, Any]] = []
            for i, raw in enumerate(options_in):
                if not isinstance(raw, dict):
                    continue
                value = str(raw.get("value") or "").strip()
                label = str(raw.get("label") or value).strip()
                if not value or not label:
                    raise ValidationException(f"Catalog {catalog_key} option needs value and label")
                if value in seen:
                    raise ValidationException(f"Duplicate catalog value: {value}")
                seen.add(value)
                source = str(raw.get("source") or ("stock" if value in stock_values else "custom"))
                if source == "stock" and value not in stock_values:
                    source = "custom"
                options.append(
                    {
                        **raw,
                        "value": value,
                        "label": label,
                        "enabled": raw.get("enabled") is not False,
                        "order": int(raw.get("order") if raw.get("order") is not None else i),
                        "source": source,
                    }
                )
            out[catalog_key] = {
                "label": str(block.get("label") or (defaults.get(catalog_key) or {}).get("label") or catalog_key),
                "allow_custom_values": bool(
                    block.get("allow_custom_values")
                    if "allow_custom_values" in block
                    else (defaults.get(catalog_key) or {}).get("allow_custom_values")
                ),
                "options": sorted(options, key=lambda o: int(o.get("order") or 0)),
            }
        # Preserve stock catalogs not included in payload
        for catalog_key, block in defaults.items():
            if catalog_key not in out:
                out[catalog_key] = deepcopy(block)
        return out

    def _validate_approvals_section(self, payload: dict[str, Any]) -> dict[str, Any]:
        steps_in = payload.get("steps")
        if steps_in is None:
            return payload
        if not isinstance(steps_in, list):
            raise ValidationException("approvals.steps must be a list")
        steps: list[dict[str, Any]] = []
        seen: set[str] = set()
        for raw in steps_in:
            if not isinstance(raw, dict):
                continue
            key = str(raw.get("key") or "").strip()
            label = str(raw.get("label") or key).strip()
            if not key or not label or key in seen:
                continue
            seen.add(key)
            steps.append(
                {
                    "key": key,
                    "label": label,
                    "enabled": raw.get("enabled") is not False,
                    "team_role": str(raw.get("team_role") or "management"),
                    "source": str(raw.get("source") or ("stock" if not key.startswith("cf_") else "custom")),
                }
            )
        return {**payload, "steps": steps}

