"""Migrate LinkedIn head approval to a single post section."""

import json
import psycopg

conn = psycopg.connect("postgresql://erp:erp_dev_password@localhost:5433/erp")
conn.autocommit = True
cur = conn.cursor()
cur.execute(
    """
    SELECT id, body, summary, hashtags, theme, linkedin_head_sections
    FROM marketing.mkt_content_item
    WHERE content_type = 'social_post'
      AND linkedin_head_sections IS NOT NULL
    """
)
updated = 0
for row_id, body, summary, hashtags, theme, sections in cur.fetchall():
    sections = dict(sections or {})
    body_ok = bool((body or "").strip())
    company_ok = bool((summary or "").strip()) or bool((hashtags or "").strip())
    ready = body_ok and company_ok

    content = sections.get("content") or {}
    theme_section = sections.get("theme") or {}
    post = sections.get("post") or {}

    statuses = [
        s
        for s in (content.get("status"), theme_section.get("status"), post.get("status"))
        if s
    ]

    if "rejected" in statuses:
        status = "rejected"
    elif "changes_requested" in statuses:
        status = "changes_requested"
    elif post.get("status") == "approved" or (
        content.get("status") == "approved"
        and (theme_section.get("status") == "approved" or not (theme or "").strip())
    ):
        status = "approved"
    elif content.get("status") == "approved" and (theme or "").strip():
        status = "awaiting_head"
    elif "awaiting_head" in statuses:
        status = "awaiting_head"
    elif ready:
        status = "awaiting_head"
    else:
        status = "pending"

    comments_parts = []
    for key, label in (("content", "Content"), ("theme", "Theme"), ("post", "Post")):
        c = (sections.get(key) or {}).get("comments")
        if c and str(c).strip():
            comments_parts.append(f"{label}: {c}")

    new_sections = {
        "post": {
            "status": status,
            "comments": "\n\n".join(comments_parts) if comments_parts else None,
            "reviewed_at": (post or content or theme_section).get("reviewed_at"),
            "reviewed_by_user_id": (post or content or theme_section).get("reviewed_by_user_id"),
        }
    }

    if sections != new_sections:
        cur.execute(
            """
            UPDATE marketing.mkt_content_item
            SET linkedin_head_sections = %s::jsonb, updated_at = NOW()
            WHERE id = %s
            """,
            (json.dumps(new_sections), row_id),
        )
        updated += 1

print(f"Migrated {updated} LinkedIn posts to single post section")
conn.close()
