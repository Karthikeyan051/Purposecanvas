"""
PurposeCanvas — Domain Classifier
Priority: Groq (Llama-3.3-70B) → Gemini → Ollama (qwen2.5) → Keyword Fallback
All AI-based, zero hardcoding.
"""
import json
import logging
import re
from typing import Literal

from pydantic import BaseModel

log = logging.getLogger(__name__)


class DomainResult(BaseModel):
    domain: Literal[
        "Science", "Mathematics", "English", "Social Studies",
        "Arts & Crafts", "Physical Education", "General"
    ]
    sub_domain: str       # e.g. "Biology", "Algebra", "Grammar"
    grade_range: str      # e.g. "Class 5-7"
    age_group: str        # e.g. "10-13 years"
    confidence: float     # 0.0 - 1.0


KEYWORD_DOMAINS = {
    "Science":       ["photosynthesis","cell","water cycle","food chain","ecosystem","gravity",
                      "atom","molecule","plant","animal","sun","planet","solar","earth","mars",
                      "venus","mercury","jupiter","saturn","orbit","space","physics","chemistry",
                      "biology","evaporation","condensation","precipitation"],
    "Mathematics":   ["addition","subtraction","fraction","algebra","geometry","calculus",
                      "number","equation","triangle","circle","square","multiply","divide",
                      "percentage","ratio","probability","statistics","graph"],
    "English":       ["grammar","verb","noun","sentence","paragraph","story","poem",
                      "letter","vocabulary","pronoun","adjective","adverb","tense","punctuation"],
    "Social Studies":["history","geography","map","country","culture","government","democracy",
                      "economy","trade","civilization","independence","colony","war","president"],
    "Arts & Crafts": ["draw","paint","colour","art","craft","design","sketch","creative",
                      "sculpture","origami","collage","texture","pattern"],
    "Physical Education": ["exercise","sport","run","jump","swim","football","cricket",
                           "yoga","fitness","health","muscle","stretch"],
}

_PROMPT_TEMPLATE = """You are an expert educational content classifier.
Given these lesson plan points, output ONLY valid JSON (no markdown, no explanation):

Points:
{points}

Output this JSON structure:
{{
  "domain": "<one of: Science, Mathematics, English, Social Studies, Arts & Crafts, Physical Education, General>",
  "sub_domain": "<specific subject e.g. Biology, Algebra, Grammar>",
  "grade_range": "<e.g. Class 5-7>",
  "age_group": "<e.g. 10-13 years>",
  "confidence": <float 0.0-1.0>
}}"""


def _call_groq(points_text: str) -> DomainResult | None:
    """Try Groq Llama-3.3-70B first (fastest, most accurate)."""
    from .config import settings
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": _PROMPT_TEMPLATE.format(points=points_text)}],
            temperature=0.1,
            max_tokens=300,
        )
        raw = resp.choices[0].message.content.strip()
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            result = DomainResult(**data)
            log.info(f"[GROQ] Classified → {result.domain}/{result.sub_domain} ({result.confidence:.0%})")
            return result
    except Exception as e:
        log.warning(f"[GROQ] Failed: {e}")
    return None


def _call_gemini(points_text: str) -> DomainResult | None:
    """Try Gemini as second option."""
    from .config import settings
    if not settings.GEMINI_API_KEY:
        return None
    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=_PROMPT_TEMPLATE.format(points=points_text),
        )
        raw = resp.text.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            result = DomainResult(**data)
            log.info(f"[GEMINI] Classified → {result.domain}/{result.sub_domain} ({result.confidence:.0%})")
            return result
    except Exception as e:
        log.warning(f"[GEMINI] Failed: {e}")
    return None


def _call_ollama(points_text: str) -> DomainResult | None:
    """Try Ollama local model (qwen2.5:0.5b) as third option."""
    from .config import settings
    try:
        import ollama
        resp = ollama.chat(
            model=settings.OLLAMA_MODEL,
            messages=[{"role": "user", "content": _PROMPT_TEMPLATE.format(points=points_text)}],
            options={"temperature": 0.1},
        )
        raw = resp['message']['content'].strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            result = DomainResult(**data)
            log.info(f"[OLLAMA] Classified → {result.domain}/{result.sub_domain} ({result.confidence:.0%})")
            return result
    except Exception as e:
        log.warning(f"[OLLAMA] Failed: {e}")
    return None


def _keyword_fallback(points: list[str]) -> DomainResult:
    """Pure keyword matching — always works, 100% offline."""
    text = " ".join(points).lower()
    best_domain = "General"
    best_score = 0
    for domain, keywords in KEYWORD_DOMAINS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_domain = domain
    confidence = min(0.4 + best_score * 0.08, 0.75)

    # Try to guess sub-domain
    sub = "General"
    if best_domain == "Science":
        if any(w in text for w in ["plant","photosynthesis","cell","animal","food chain","biology"]):
            sub = "Biology"
        elif any(w in text for w in ["sun","planet","solar","orbit","space","mars","earth","venus"]):
            sub = "Astronomy"
        elif any(w in text for w in ["water cycle","evaporation","weather","cloud"]):
            sub = "Earth Science"
        elif any(w in text for w in ["atom","molecule","element","compound","reaction"]):
            sub = "Chemistry"
        elif any(w in text for w in ["force","energy","gravity","motion","light","sound"]):
            sub = "Physics"

    log.info(f"[KEYWORD] Classified → {best_domain}/{sub} ({confidence:.0%})")
    return DomainResult(
        domain=best_domain,  # type: ignore
        sub_domain=sub,
        grade_range="Class 4-8",
        age_group="9-14 years",
        confidence=confidence,
    )


def classify_domain(points: list[str]) -> DomainResult:
    """
    Multi-provider domain classifier.
    Chain: Groq → Gemini → Ollama → Keyword fallback
    """
    from .config import settings
    points_text = "\n".join(f"{i+1}) {p}" for i, p in enumerate(points))

    # Try providers in order
    provider_order = [settings.LLM_PROVIDER]
    all_providers = ["groq", "gemini", "ollama"]
    for p in all_providers:
        if p not in provider_order:
            provider_order.append(p)

    for provider in provider_order:
        result = None
        if provider == "groq":
            result = _call_groq(points_text)
        elif provider == "gemini":
            result = _call_gemini(points_text)
        elif provider == "ollama":
            result = _call_ollama(points_text)

        if result:
            return result

    # Final fallback — pure keywords
    return _keyword_fallback(points)
