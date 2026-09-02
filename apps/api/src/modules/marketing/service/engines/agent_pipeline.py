"""Offline content intelligence pipeline (Celery-friendly pure helpers)."""

from __future__ import annotations


def run_agent_pipeline(
    topic: str,
    content_type: str,
    tone: str | None,
    platform_code: str | None,
) -> dict:
    research = {
        "executiveSummary": f"Synthesized research for '{topic}'.",
        "keyInsights": [
            f"{topic} resonates with professional buyers on LinkedIn.",
            "Short-form hooks outperform long intros in social feeds.",
        ],
    }
    trends = {
        "opportunities": [f"{topic} checklist", f"{topic} myths vs facts"],
        "relatedKeywords": [topic, f"{topic} strategy", f"best {topic}"],
    }
    news = {
        "summary": f"Recent coverage around {topic} skews constructive.",
        "sentiment": 0.42,
    }
    seo = {
        "primaryKeyword": topic.lower(),
        "secondaryKeywords": trends["relatedKeywords"],
        "searchIntent": "informational",
    }
    body = (
        f"{topic}: a practical take for your audience.\n\n"
        f"Hook: Most teams still treat {topic} as a one-off campaign.\n\n"
        "Body:\n"
        f"1) Anchor the narrative in a clear customer outcome.\n"
        f"2) Support with one proof point and one CTA.\n"
        f"3) Adapt length for {(platform_code or 'linkedin')}.\n\n"
        f"Tone: {tone or 'professional'} · Type: {content_type}"
    )
    content = {
        "headline": f"{topic} — what matters now",
        "hook": f"Stop guessing on {topic}. Start with signal.",
        "body": body,
        "cta": "Save this for your next campaign planning session.",
        "hashtags": {"tags": [topic.replace(" ", ""), "ContentIntelligence", "Marketing"]},
    }
    scores = {
        "virality": 68,
        "readability": 82,
        "engagement": 74,
        "seo": 71,
        "conversion": 65,
        "overall": 72,
        "suggestions": ["Add a concrete metric in the hook.", "Tighten CTA to a single action."],
    }
    return {
        "research": research,
        "trends": trends,
        "news": news,
        "seo": seo,
        "content": content,
        "scores": scores,
    }
