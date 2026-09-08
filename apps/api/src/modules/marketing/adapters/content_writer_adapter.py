"""Live content writer. Uses a configured model when a key exists, otherwise a voice-grounded composer."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from core.config import settings

VARIANT_SPECS = (
    ("linkedin", "LinkedIn post", "120-180 words, one proof point, single CTA"),
    ("instagram", "Instagram caption", "short caption, line breaks, 5 hashtags"),
    ("carousel", "Carousel script", "5 slides: hook, tension, proof, steps, CTA"),
    ("story", "Story sequence", "3 frames, one idea each, last frame is the CTA"),
)


class ContentWriterAdapter:
    def configured(self) -> bool:
        return bool(getattr(settings, "openai_api_key", "") and settings.openai_api_key.strip())

    def write_pack(
        self,
        *,
        topic: str,
        content_type: str,
        tone: str | None,
        platform_code: str | None,
        goal: str | None,
        voice_name: str | None,
        voice_guidelines: str | None,
        tone_keywords: list[str],
        approved_examples: list[str],
    ) -> dict[str, Any]:
        if self.configured():
            live = self._live(
                topic=topic,
                content_type=content_type,
                tone=tone,
                platform_code=platform_code,
                goal=goal,
                voice_name=voice_name,
                voice_guidelines=voice_guidelines,
                tone_keywords=tone_keywords,
                approved_examples=approved_examples,
            )
            if live is not None:
                return live
        return self._grounded(
            topic=topic,
            content_type=content_type,
            tone=tone,
            platform_code=platform_code,
            goal=goal,
            voice_name=voice_name,
            voice_guidelines=voice_guidelines,
            tone_keywords=tone_keywords,
            approved_examples=approved_examples,
        )

    def _live(self, **kwargs: Any) -> dict[str, Any] | None:
        key = settings.openai_api_key.strip()
        base = (getattr(settings, "openai_base_url", "") or "https://api.openai.com/v1").rstrip("/")
        model = (getattr(settings, "openai_model", "") or "gpt-4o-mini").strip()
        prompt = self._prompt(**kwargs)
        try:
            with httpx.Client(timeout=45.0) as client:
                response = client.post(
                    f"{base}/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "temperature": 0.4,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You write enterprise marketing copy. Return JSON with keys "
                                    "variants (array of code, headline, hook, body, cta, hashtags, lines_to_change) "
                                    "and scores (voice_fit, brief_fit, overall, suggestions)."
                                ),
                            },
                            {"role": "user", "content": prompt},
                        ],
                    },
                )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
            return self._normalize(parsed, model=model, topic=kwargs["topic"], tone_keywords=kwargs["tone_keywords"])
        except Exception:
            return None

    def _prompt(self, **kwargs: Any) -> str:
        examples = "\n---\n".join(kwargs["approved_examples"][:5]) or "(none yet)"
        keywords = ", ".join(kwargs["tone_keywords"]) or "none"
        return (
            f"Topic: {kwargs['topic']}\n"
            f"Goal: {kwargs['goal'] or 'awareness'}\n"
            f"Tone: {kwargs['tone'] or 'professional'}\n"
            f"Requested type: {kwargs['content_type']}\n"
            f"Primary platform: {kwargs['platform_code'] or 'linkedin'}\n"
            f"Brand voice: {kwargs['voice_name'] or 'unset'}\n"
            f"Guidelines: {kwargs['voice_guidelines'] or 'none'}\n"
            f"Tone keywords: {keywords}\n"
            f"Approved posts to match:\n{examples}\n"
            "Write four variants: linkedin, instagram, carousel, story. "
            "lines_to_change must be 2 or 3 concrete edits, not generic praise."
        )

    def _grounded(
        self,
        *,
        topic: str,
        content_type: str,
        tone: str | None,
        platform_code: str | None,
        goal: str | None,
        voice_name: str | None,
        voice_guidelines: str | None,
        tone_keywords: list[str],
        approved_examples: list[str],
    ) -> dict[str, Any]:
        voice_bit = voice_name or "the brand"
        keyword = tone_keywords[0] if tone_keywords else (tone or "professional")
        example_hook = ""
        if approved_examples:
            first_line = approved_examples[0].strip().splitlines()
            example_hook = next((line.strip() for line in first_line if line.strip()), "")
        proof = goal or "a single customer outcome"
        variants = []
        for code, label, shape in VARIANT_SPECS:
            hook = example_hook or f"{topic} is still treated as a one-off."
            if code == "linkedin":
                body = (
                    f"{hook}\n\n"
                    f"Most teams talk about {topic}. {voice_bit} treats it as {proof}.\n\n"
                    f"Keep the {keyword} voice: one claim, one proof, one next step.\n"
                    f"{voice_guidelines or 'Do not add adjectives the brand voice does not use.'}"
                )
            elif code == "instagram":
                body = (
                    f"{topic}.\n\n"
                    f"{keyword} take from {voice_bit}: {proof}.\n\n"
                    "Save this before the next planning meeting."
                )
            elif code == "carousel":
                body = (
                    f"Slide 1 — {hook}\n"
                    f"Slide 2 — The gap: {topic} without an owner.\n"
                    f"Slide 3 — Proof: {proof}.\n"
                    f"Slide 4 — How {voice_bit} would say it ({keyword}).\n"
                    "Slide 5 — One CTA. Nothing else."
                )
            else:
                body = (
                    f"Frame 1: {hook}\n"
                    f"Frame 2: {proof}.\n"
                    f"Frame 3: Reply if you want the {content_type} version."
                )
            variants.append(
                {
                    "code": code,
                    "label": label,
                    "shape": shape,
                    "headline": f"{topic} — {label}",
                    "hook": hook[:240],
                    "body": body.strip(),
                    "cta": "Reply with the one metric you want on the next draft.",
                    "hashtags": [self._tag(topic), self._tag(keyword), code],
                    "lines_to_change": self._lines(topic, keyword, bool(approved_examples), bool(voice_guidelines)),
                }
            )
        return self._normalize(
            {"variants": variants, "scores": {}},
            model="marketing.writer.voice_grounded.v1",
            topic=topic,
            tone_keywords=tone_keywords,
            primary=platform_code,
        )

    def _normalize(
        self,
        parsed: dict[str, Any],
        *,
        model: str,
        topic: str,
        tone_keywords: list[str],
        primary: str | None = None,
    ) -> dict[str, Any]:
        raw_variants = parsed.get("variants") if isinstance(parsed.get("variants"), list) else []
        by_code = {}
        for item in raw_variants:
            if not isinstance(item, dict):
                continue
            code = str(item.get("code") or "").strip().lower()
            if code:
                by_code[code] = item
        variants = []
        for code, label, shape in VARIANT_SPECS:
            item = by_code.get(code) or {}
            lines = item.get("lines_to_change") or item.get("lines") or []
            if not isinstance(lines, list):
                lines = [str(lines)]
            lines = [str(line).strip() for line in lines if str(line).strip()][:3]
            if len(lines) < 2:
                lines = self._lines(topic, tone_keywords[0] if tone_keywords else "professional", False, False)
            tags = item.get("hashtags") or []
            if isinstance(tags, dict):
                tags = tags.get("tags") or []
            variants.append(
                {
                    "code": code,
                    "label": label,
                    "shape": shape,
                    "headline": str(item.get("headline") or f"{topic} — {label}")[:500],
                    "hook": str(item.get("hook") or "")[:1000],
                    "body": str(item.get("body") or "").strip(),
                    "cta": str(item.get("cta") or "One next step.")[:500],
                    "hashtags": [str(tag) for tag in tags][:8],
                    "lines_to_change": lines,
                }
            )
        scores = parsed.get("scores") if isinstance(parsed.get("scores"), dict) else {}
        voice_fit = int(scores.get("voice_fit") or self._fit(tone_keywords, variants))
        brief_fit = int(scores.get("brief_fit") or (78 if topic else 40))
        overall = int(scores.get("overall") or round((voice_fit + brief_fit) / 2))
        suggestions = scores.get("suggestions")
        if not isinstance(suggestions, list) or not suggestions:
            suggestions = variants[0]["lines_to_change"]
        if primary:
            variants.sort(key=lambda row: 0 if row["code"] == primary else 1)
        return {
            "model": model,
            "variants": variants,
            "scores": {
                "voice_fit": voice_fit,
                "brief_fit": brief_fit,
                "overall": overall,
                "suggestions": [str(item) for item in suggestions][:3],
            },
        }

    def _fit(self, tone_keywords: list[str], variants: list[dict[str, Any]]) -> int:
        if not tone_keywords:
            return 61
        blob = " ".join(row.get("body") or "" for row in variants).lower()
        hits = sum(1 for word in tone_keywords if word.lower() in blob)
        return min(92, 58 + hits * 8)

    def _lines(self, topic: str, keyword: str, has_example: bool, has_guidelines: bool) -> list[str]:
        lines = [
            f"Replace the hook with a number from the brief about {topic}.",
            "Cut the CTA to one verb. Delete the second ask.",
        ]
        if not has_example:
            lines.append("There is no approved post yet — add one line that only this brand would say.")
        elif not has_guidelines:
            lines.append(f"Match the {keyword} word choice from the last approved post, not a generic closer.")
        else:
            lines.append("Check the last line against the brand guidelines before review.")
        return lines[:3]

    def _tag(self, value: str) -> str:
        return re.sub(r"[^A-Za-z0-9]", "", value)[:24] or "Marketing"
