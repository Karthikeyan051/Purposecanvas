"""
PurposeCanvas — Intent Classification
Primary: Gemini 2.0 Flash with Pydantic JSON schema.
Fallback: Keyword rule classifier (zero API calls, offline-safe).
"""
import logging
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field

from .config import settings

logger = logging.getLogger(__name__)


# ── Intent schema ─────────────────────────────────────────────────────────────

class IntentResult(BaseModel):
    type: Literal["outline", "flashcard", "worksheet", "poster"]
    subject: str
    colour: Literal["bw", "colour"]
    age_group: str                    # e.g. "6-10"
    use: Literal["print_classroom", "screen", "publication"]
    complexity: int                   # 1 (simple) to 3 (detailed)
    safe: bool
    confidence: float                 # 0.0 to 1.0
    key: str                          # cache key e.g. "outline:cow"
    needs_confirmation: bool = False
    options: list[str] = Field(default_factory=list)  # chips if uncertain


# ── Gemini primary ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an educational image classifier for a school district.
Given a teacher's request, classify it into structured intent.

Rules:
- type: "outline" = colouring page (black outline only), "flashcard" = vocab/concept card,
  "worksheet" = fill-in exercise page, "poster" = large display, annual report
- colour: "bw" for outline/worksheet, "colour" for flashcard/poster
- complexity: 1=very simple (single animal/object), 2=moderate (scene), 3=complex (detailed diagram)
- safe: false if request contains adult/violent/inappropriate content
- key: short canonical cache key like "outline:cow" or "poster:photosynthesis"
- If you are less than 70% confident about the type, set needs_confirmation=true and provide
  3-4 options in the options list (e.g. ["Colouring outline", "Flashcard", "Worksheet", "Poster"])
- age_group: estimate from context, default "6-12" if unclear
"""


def classify(prompt: str, clarification: Optional[str] = None) -> IntentResult:
    """
    Classify teacher prompt into structured intent.
    Uses Gemini if available, falls back to keyword rules.
    """
    full_prompt = prompt
    if clarification:
        full_prompt = f"{prompt} [Teacher clarification: {clarification}]"

    if settings.GEMINI_API_KEY:
        try:
            return _gemini_classify(full_prompt)
        except Exception as e:
            logger.warning(f"Gemini intent failed ({e}), using keyword fallback")

    return _keyword_fallback(full_prompt)


def _gemini_classify(prompt: str) -> IntentResult:
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=f"{_SYSTEM_PROMPT}\n\nTeacher request: {prompt}",
        config={
            "response_mime_type": "application/json",
            "response_schema": IntentResult,
        },
    )
    result: IntentResult = response.parsed

    # Ensure key is set
    if not result.key:
        result.key = f"{result.type}:{result.subject.lower().replace(' ', '_')}"

    logger.info(f"Gemini intent: type={result.type} confidence={result.confidence:.2f} key={result.key}")
    return result


# ── Keyword fallback ──────────────────────────────────────────────────────────

_OUTLINE_WORDS = {"outline", "colour", "color", "colou", "draw", "sketch", "colouring",
                  "coloring", "trace", "animal", "worksheet line", "black and white",
                  "black & white", "b&w", "bw"}

_POSTER_WORDS = {"poster", "display", "banner", "annual report", "wall", "large",
                 "presentation", "display board", "notice", "bulletin", "science fair"}

_FLASHCARD_WORDS = {"flashcard", "flash card", "vocab", "vocabulary", "word card",
                    "term", "definition", "concept card", "learning card", "letter",
                    "alphabet", "number", "math card"}

_WORKSHEET_WORDS = {"worksheet", "exercise", "fill in", "fill-in", "quiz", "test",
                    "activity", "practice", "homework", "assignment"}


def _keyword_fallback(prompt: str) -> IntentResult:
    p = prompt.lower()

    # Score each type
    scores = {
        "outline": sum(1 for w in _OUTLINE_WORDS if w in p),
        "poster": sum(1 for w in _POSTER_WORDS if w in p),
        "flashcard": sum(1 for w in _FLASHCARD_WORDS if w in p),
        "worksheet": sum(1 for w in _WORKSHEET_WORDS if w in p),
    }

    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    # If nothing matched, default to outline (most common classroom use)
    if best_score == 0:
        best_type = "outline"

    colour = "bw" if best_type in ("outline", "worksheet") else "colour"
    use = "publication" if best_type == "poster" else "print_classroom"

    # Extract subject (first noun-ish chunk after removing keywords)
    subject = _extract_subject(p, best_type)

    key = f"{best_type}:{subject.replace(' ', '_')}"

    needs_conf = best_score == 0 or (best_score == 1 and len(scores) > 1)

    return IntentResult(
        type=best_type,
        subject=subject,
        colour=colour,
        age_group="6-12",
        use=use,
        complexity=1,
        safe=True,
        confidence=0.6,
        key=key,
        needs_confirmation=needs_conf,
        options=["Colouring outline", "Flashcard", "Worksheet", "Poster"] if needs_conf else [],
    )


def _extract_subject(prompt: str, intent_type: str) -> str:
    """Best-effort subject extraction from prompt text."""
    # Remove common classifier words and get remaining content
    stop_words = {
        "draw", "create", "make", "generate", "image", "picture", "of", "a", "an",
        "the", "for", "outline", "poster", "flashcard", "worksheet", "children",
        "kids", "grade", "class", "school", "student", "please", "simple", "basic",
        "colouring", "coloring", "colour", "color", "black", "white", "and",
    }
    words = [w for w in prompt.split() if w not in stop_words and len(w) > 2]
    subject = " ".join(words[:3]) if words else "subject"
    return subject or "subject"
