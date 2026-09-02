"""Build JSON Schema tool inputs from the FastAPI OpenAPI document."""

from __future__ import annotations

from typing import Any

from modules.mcp_server.models import ExposedEndpoint


def _resolve_ref(openapi: dict[str, Any], ref: str) -> dict[str, Any]:
    if not ref.startswith("#/"):
        return {}
    parts = ref.lstrip("#/").split("/")
    node: Any = openapi
    for part in parts:
        if not isinstance(node, dict):
            return {}
        node = node.get(part, {})
    return node if isinstance(node, dict) else {}


def _merge_schema(openapi: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    if "$ref" in schema:
        resolved = _resolve_ref(openapi, schema["$ref"])
        return _merge_schema(openapi, resolved)
    return schema


def _schema_to_property(openapi: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    merged = _merge_schema(openapi, schema)
    prop: dict[str, Any] = {}
    for key in ("type", "format", "description", "enum", "items", "default"):
        if key in merged:
            prop[key] = merged[key]
    if "properties" in merged:
        prop["type"] = prop.get("type", "object")
        prop["properties"] = {
            name: _schema_to_property(openapi, child)
            for name, child in merged["properties"].items()
        }
        if merged.get("required"):
            prop["required"] = merged["required"]
    return prop


def find_openapi_operation(
    openapi: dict[str, Any], endpoint: ExposedEndpoint
) -> dict[str, Any] | None:
    path_item = openapi.get("paths", {}).get(endpoint.path)
    if not path_item:
        return None
    operation = path_item.get(endpoint.method.lower())
    return operation if isinstance(operation, dict) else None


def build_input_schema(openapi: dict[str, Any], endpoint: ExposedEndpoint) -> dict[str, Any]:
    """Derive MCP tool input JSON Schema from an OpenAPI operation."""
    operation = find_openapi_operation(openapi, endpoint)
    properties: dict[str, Any] = {}
    required: list[str] = []

    if operation:
        for param in operation.get("parameters", []):
            if not isinstance(param, dict):
                continue
            name = param.get("name")
            if not name:
                continue
            schema = param.get("schema") or {}
            properties[str(name)] = _schema_to_property(openapi, schema)
            if param.get("required"):
                required.append(str(name))

        request_body = operation.get("requestBody")
        if isinstance(request_body, dict):
            content = request_body.get("content", {})
            json_body = content.get("application/json", {})
            body_schema = json_body.get("schema", {})
            merged_body = _merge_schema(openapi, body_schema)
            if merged_body.get("type") == "object" and merged_body.get("properties"):
                for name, child in merged_body["properties"].items():
                    properties[name] = _schema_to_property(openapi, child)
                for name in merged_body.get("required", []):
                    if name not in required:
                        required.append(name)
            else:
                properties["body"] = _schema_to_property(openapi, merged_body)
                if request_body.get("required"):
                    required.append("body")

    schema: dict[str, Any] = {
        "type": "object",
        "properties": properties,
        "additionalProperties": False,
    }
    if required:
        schema["required"] = required
    return schema


def access_description_prefix(access: str) -> str:
    if access == "read":
        return "[READ-ONLY] "
    return "[MUTATING — requires approval] "
