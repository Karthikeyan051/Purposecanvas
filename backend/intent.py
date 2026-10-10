"""
PurposeCanvas — Intent Classification + Optimised Prompt Generation

PRIMARY ROLE: Given a teacher's raw request, produce:
  1. Structured intent (type, subject, colour, age_group, etc.)
  2. An "optimised_prompt" — fully engineered prompt ready for any AI generator
  3. A matching "negative_prompt"
  4. A "prompt_card" dict — the full copyable JSON output shown in the UI

Provider chain:
  Groq (Llama-3.3-70B) → Gemini → Ollama (qwen2.5:0.5b) → Keyword fallback

The optimised_prompt follows a proven formula:
  [subject], [style keywords], [output format], [age/audience],
  [quality modifiers], [composition]
"""
import json
import logging
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field

from .config import settings
from .profiles import get_profile, Profile

logger = logging.getLogger(__name__)


# ── Intent schema (what Gemini returns) ──────────────────────────────────────

class IntentResult(BaseModel):
    type: Literal["outline", "flashcard", "worksheet", "poster"]
    subject: str                              # e.g. "cow", "water cycle"
    colour: Literal["bw", "colour"]
    age_group: str                            # e.g. "6-10"
    use: Literal["print_classroom", "screen", "publication"]
    complexity: int                           # 1=simple, 2=moderate, 3=complex
    safe: bool
    confidence: float                         # 0.0–1.0
    key: str                                  # semantic cache key e.g. "outline:cow"
    needs_confirmation: bool = False
    options: list[str] = Field(default_factory=list)

    # ── AI-ready prompt output (added by prompt_engineer) ────────────────────
    optimized_prompt: str = ""               # ready to paste into any AI generator
    negative_prompt: str = ""               # negative prompt for SD/Flux/Midjourney
    midjourney_prompt: str = ""             # Midjourney-style with :: weights
    dalle_prompt: str = ""                  # DALL-E 3 natural language style
    recommended_model: str = ""             # "SD-Turbo (fast, ~2s)" etc.
    gpu_estimate_seconds: float = 0.0
    energy_estimate_wh: float = 0.0
    # ── Explainability (Constraint 2) ─────────────────────────────────────────
    reasoning: str = ""                     # Why this type/tier was chosen
    signal_words: list[str] = Field(default_factory=list)  # Key words that triggered the decision
    recommended_tier: int = 0               # The tier the AI proposes (can be overridden)


# ── Gemini system prompt ──────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an educational image classifier for a school district.
Given a teacher's request, classify it into structured intent.

Rules:
- type: "outline" = colouring page (black outline only), "flashcard" = vocab/concept card,
  "worksheet" = fill-in exercise page, "poster" = large classroom display
- colour: "bw" for outline/worksheet, "colour" for flashcard/poster
- complexity: 1=very simple (single object), 2=moderate (simple scene), 3=complex (diagram)
- safe: false if request contains adult/violent/inappropriate content
- key: short canonical cache key like "outline:cow" or "poster:photosynthesis"
- If confidence < 0.70, set needs_confirmation=true and provide 3-4 options list
- age_group: estimate from context, default "6-12" if unclear
- IMPORTANT: Set subject to the core subject noun only, e.g. "cow", "water cycle", "letter A"
"""


# ── Main classify function ───────────────────────────────────────────────────

def classify(prompt: str, clarification: Optional[str] = None) -> IntentResult:
    """
    Classify teacher prompt into structured intent.
    Chain: Groq → Gemini → Ollama → Keyword fallback
    """
    full_prompt = prompt
    if clarification:
        full_prompt = f"{prompt} [Teacher clarification: {clarification}]"

    result = None

    # 1. Try Groq (Llama-3.3-70B) — fastest and most accurate
    if settings.GROQ_API_KEY and not result:
        try:
            result = _groq_classify(full_prompt)
            logger.info("[INTENT] Groq classification succeeded")
        except Exception as e:
            logger.warning(f"[INTENT] Groq failed: {e}")

    # 2. Try Gemini
    if settings.GEMINI_API_KEY and not result:
        try:
            result = _gemini_classify(full_prompt)
            logger.info("[INTENT] Gemini classification succeeded")
        except Exception as e:
            logger.warning(f"[INTENT] Gemini failed: {e}")

    # 3. Try Ollama local
    if not result:
        try:
            result = _ollama_classify(full_prompt)
            logger.info("[INTENT] Ollama classification succeeded")
        except Exception as e:
            logger.warning(f"[INTENT] Ollama failed: {e}")

    # 4. Keyword fallback — always works
    if not result:
        result = _keyword_fallback(full_prompt)
        logger.info("[INTENT] Using keyword fallback")

    # Always engineer the output prompts
    result = _engineer_prompts(result)
    return result


# ── Groq primary (Llama-3.3-70B) ─────────────────────────────────────────────

_INTENT_JSON_PROMPT = """You are an educational image classifier for a school district.
Given a teacher's request, output ONLY this JSON (no markdown):
{{
  "type": "outline|flashcard|worksheet|poster",
  "subject": "<core subject noun, e.g. cow, water cycle, letter A>",
  "colour": "bw|colour",
  "age_group": "<e.g. 6-10>",
  "use": "print_classroom|screen|publication",
  "complexity": <1-3>,
  "safe": true,
  "confidence": <0.0-1.0>,
  "key": "<type:subject e.g. outline:cow>",
  "needs_confirmation": false,
  "options": [],
  "reasoning": "<one clear sentence explaining your decision, e.g. 'The phrase colouring page with year 5 indicates a simple printable black-and-white outline resource.'>",
  "signal_words": ["<word1>", "<word2>", "<word3>"],
  "recommended_tier": <0|1|2>
}}
Rules:
- type=outline for colouring pages (bw), poster=large display (colour), flashcard=concept card (colour), worksheet=exercise (bw)
- signal_words: list the exact words/phrases from the prompt that most influenced your decision (max 5)
- recommended_tier: 0=Draft (cheapest, SD-Turbo), 1=Standard, 2=Quality (most expensive, SDXL)
  Pick tier based on: complexity (1→tier 0, 2→tier 1, 3→tier 2) and use (print_classroom→0 or 1, publication→2)
Teacher request: {prompt}"""


def _groq_classify(prompt: str) -> IntentResult:
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    resp = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": _INTENT_JSON_PROMPT.format(prompt=prompt)}],
        temperature=0.1,
        max_tokens=400,
    )
    raw = resp.choices[0].message.content.strip()
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON in Groq response")
    data = json.loads(json_match.group())
    if not data.get("key"):
        data["key"] = f"{data['type']}:{data['subject'].lower().replace(' ', '_')}"
    return IntentResult(**data)


def _ollama_classify(prompt: str) -> IntentResult:
    import ollama as _ollama
    resp = _ollama.chat(
        model=settings.OLLAMA_MODEL,
        messages=[{"role": "user", "content": _INTENT_JSON_PROMPT.format(prompt=prompt)}],
        options={"temperature": 0.1},
    )
    raw = resp['message']['content'].strip()
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON in Ollama response")
    data = json.loads(json_match.group())
    if not data.get("key"):
        data["key"] = f"{data['type']}:{data['subject'].lower().replace(' ', '_')}"
    return IntentResult(**data)


# ── Gemini primary ────────────────────────────────────────────────────────────

def _gemini_classify(prompt: str) -> IntentResult:
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Use a stripped IntentResult (without the prompt fields — we add those ourselves)
    class _GeminiIntent(BaseModel):
        type: Literal["outline", "flashcard", "worksheet", "poster"]
        subject: str
        colour: Literal["bw", "colour"]
        age_group: str
        use: Literal["print_classroom", "screen", "publication"]
        complexity: int
        safe: bool
        confidence: float
        key: str
        needs_confirmation: bool = False
        options: list[str] = Field(default_factory=list)

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=f"{_SYSTEM_PROMPT}\n\nTeacher request: {prompt}",
        config={
            "response_mime_type": "application/json",
            "response_schema": _GeminiIntent,
        },
    )
    gi = response.parsed
    if not gi.key:
        gi.key = f"{gi.type}:{gi.subject.lower().replace(' ', '_')}"

    logger.info(f"Gemini intent: type={gi.type} confidence={gi.confidence:.2f} key={gi.key}")

    return IntentResult(
        type=gi.type, subject=gi.subject, colour=gi.colour,
        age_group=gi.age_group, use=gi.use, complexity=gi.complexity,
        safe=gi.safe, confidence=gi.confidence, key=gi.key,
        needs_confirmation=gi.needs_confirmation, options=gi.options,
    )


# ── Keyword fallback ──────────────────────────────────────────────────────────

_OUTLINE_WORDS   = {"outline", "colour", "color", "colou", "draw", "sketch",
                    "colouring", "coloring", "trace", "animal", "black and white",
                    "b&w", "bw", "line art", "line drawing"}
_POSTER_WORDS    = {"poster", "display", "banner", "annual report", "wall",
                    "large", "presentation", "display board", "science fair"}
_FLASHCARD_WORDS = {"flashcard", "flash card", "vocab", "vocabulary", "word card",
                    "term", "definition", "concept card", "letter", "alphabet",
                    "number", "math card"}
_WORKSHEET_WORDS = {"worksheet", "exercise", "fill in", "fill-in", "quiz",
                    "activity", "practice", "homework", "assignment"}


def _keyword_fallback(prompt: str) -> IntentResult:
    p = prompt.lower()
    scores = {
        "outline":   sum(1 for w in _OUTLINE_WORDS   if w in p),
        "poster":    sum(1 for w in _POSTER_WORDS    if w in p),
        "flashcard": sum(1 for w in _FLASHCARD_WORDS if w in p),
        "worksheet": sum(1 for w in _WORKSHEET_WORDS if w in p),
    }
    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]
    if best_score == 0:
        best_type = "outline"

    colour  = "bw"     if best_type in ("outline", "worksheet") else "colour"
    use     = "publication" if best_type == "poster"            else "print_classroom"
    subject = _extract_subject(p, best_type)
    key     = f"{best_type}:{subject.replace(' ', '_')}"
    needs_conf = best_score == 0 or (best_score == 1 and len(scores) > 1)

    # Auto-generate a reasoning string for keyword fallback
    type_labels = {
        "outline": "a black-and-white colouring outline",
        "poster": "a large colour classroom display poster",
        "flashcard": "a bright colour educational flashcard",
        "worksheet": "a black-and-white printable exercise worksheet",
    }
    matched = [w for w in (list(_OUTLINE_WORDS | _POSTER_WORDS | _FLASHCARD_WORDS | _WORKSHEET_WORDS)) if w in p]
    reasoning_str = (
        f"Keyword signals '{', '.join(matched[:3])}' suggest {type_labels.get(best_type, best_type)}. "
        f"Confidence is {'high' if best_score >= 2 else 'moderate'} based on {best_score} matched signal(s)."
    ) if best_score > 0 else "No strong signals found; defaulting to outline as the safest classroom resource."

    return IntentResult(
        type=best_type, subject=subject, colour=colour,
        age_group="6-12", use=use, complexity=1,
        safe=True, confidence=min(0.6 + best_score * 0.1, 0.85),
        key=key,
        needs_confirmation=needs_conf,
        options=["Colouring outline", "Flashcard", "Worksheet", "Poster"] if needs_conf else [],
        reasoning=reasoning_str,
        signal_words=matched[:5],
        recommended_tier=0,
    )


def _extract_subject(prompt: str, intent_type: str) -> str:
    stop = {"draw", "create", "make", "generate", "image", "picture", "of", "a",
            "an", "the", "for", "outline", "poster", "flashcard", "worksheet",
            "children", "kids", "grade", "class", "school", "student", "please",
            "simple", "basic", "colouring", "coloring", "colour", "color",
            "black", "white", "and", "in", "to", "me", "us"}
    words = [w for w in prompt.split() if w not in stop and len(w) > 2]
    return " ".join(words[:3]) if words else "subject"


# ── Prompt Engineer ───────────────────────────────────────────────────────────

def _engineer_prompts(r: IntentResult) -> IntentResult:
    """
    Build AI-ready prompts from the classified intent.
    This is the core RAG output — what teachers can copy into any generator.
    """
    subj = r.subject
    age  = r.age_group
    comp = {1: "simple", 2: "moderately detailed", 3: "highly detailed"}[r.complexity]
    use_label = {"print_classroom": "classroom print", "screen": "screen display",
                 "publication": "professional publication"}[r.use]

    # ── Style blocks per type ────────────────────────────────────────────────

    if r.type == "outline":
        style   = "thick clean black line art outline, white background, children's colouring book"
        quality = f"simple {comp} illustration, bold strokes, no shading, no colour fills, printable A4"
        neg     = "color, colour, shading, gradients, grey fills, blurry, photorealistic, watermark, complex background"
        mj_suf  = "--style expressive --stylize 20 --ar 1:1"
        dalle_style = f"A simple black and white coloring book outline illustration of a {subj}, thick clean outlines, white background, suitable for children aged {age} to color in, minimal detail, educational"

    elif r.type == "flashcard":
        style   = "flat vector illustration, bright primary colours, educational flashcard style, clean white background"
        quality = f"{comp} simple shapes, bold outlines, clear subject focus, vocabulary card format"
        neg     = "blurry, photorealistic, dark background, watermark, cluttered, complex"
        mj_suf  = "--style cute --stylize 60 --ar 3:2"
        dalle_style = f"A bright colourful educational flashcard illustration of {subj}, flat vector art style, clean white background, bold simple shapes, suitable for children aged {age}, vocabulary learning card"

    elif r.type == "worksheet":
        style   = "black and white educational worksheet illustration, line art"
        quality = f"{comp} clean printable format, exercise worksheet, {use_label}"
        neg     = "color, shading, blurry, photorealistic, watermark, grey fills"
        mj_suf  = "--style expressive --stylize 10 --ar 1:1 --no color"
        dalle_style = f"A simple black and white educational worksheet illustration of {subj}, clean line art suitable for printing, fill-in exercise format for children aged {age}"

    else:  # poster
        style   = "vibrant full colour professional illustration, classroom display quality"
        quality = f"{comp}, publication ready, high detail, {use_label} format, inspirational"
        neg     = "blurry, low quality, watermark, dark, monochrome, amateur"
        mj_suf  = "--style scenic --stylize 150 --ar 4:3"
        dalle_style = f"A vibrant colourful professional educational poster of {subj}, high quality illustration suitable for classroom display, bright engaging colours, suitable for ages {age}, {comp}"

    # ── Assemble optimised prompt ─────────────────────────────────────────────

    optimized = f"{subj}, {style}, {quality}, ages {age}"

    mj_prompt = f"{subj}, {style}, {quality} ::2 educational illustration ::1 {mj_suf}"

    # ── GPU estimates from profile ────────────────────────────────────────────

    profile = get_profile(r.type, tier=0)
    # Rough estimates: SD-Turbo ~0.5s/step @ 512px, ~1.5s/step @ 768px
    step_time = {
        "sd_turbo":  0.5 if profile.width <= 512 else 1.0,
        "sdxl":      2.5,
    }.get(profile.model_id, 1.0)
    gpu_est = round(profile.steps * step_time, 1)
    energy_est = round((150.0 * gpu_est) / 3600.0, 4)  # 150W GPU average

    model_label = {
        "sd_turbo": f"SD-Turbo (fast, ~{gpu_est}s, {profile.steps} steps)",
        "sdxl":     f"SDXL (quality, ~{gpu_est}s, {profile.steps} steps)",
    }.get(profile.model_id, profile.model_id)

    # ── Write back to result ──────────────────────────────────────────────────

    r.optimized_prompt     = optimized
    r.negative_prompt      = neg
    r.midjourney_prompt    = mj_prompt
    r.dalle_prompt         = dalle_style
    r.recommended_model    = model_label
    r.gpu_estimate_seconds = gpu_est
    r.energy_estimate_wh   = energy_est

    logger.info(f"Prompt engineered: type={r.type} subject='{r.subject}' gpu_est={gpu_est}s")
    return r


# ── Prompt card (the full JSON shown in UI) ───────────────────────────────────

def build_prompt_card(r: IntentResult) -> dict:
    """
    Build the full copyable prompt card JSON.
    This is what's shown in the UI output panel and can be pasted
    into Midjourney, DALL-E, Stable Diffusion, Adobe Firefly, etc.
    """
    return {
        "purposecanvas_prompt_card": {
            "version": "1.0",
            "intent": {
                "type":       r.type,
                "subject":    r.subject,
                "colour":     r.colour,
                "age_group":  r.age_group,
                "use":        r.use,
                "complexity": r.complexity,
                "confidence": round(r.confidence, 2),
                "cache_key":  r.key,
            },
            "prompts": {
                "optimized":    r.optimized_prompt,
                "negative":     r.negative_prompt,
                "midjourney":   r.midjourney_prompt,
                "dalle3":       r.dalle_prompt,
            },
            "generation": {
                "recommended_model":    r.recommended_model,
                "gpu_estimate_seconds": r.gpu_estimate_seconds,
                "energy_estimate_wh":   r.energy_estimate_wh,
                "profile_tier":         0,
            },
            "how_to_use": {
                "stable_diffusion": f"Paste 'optimized' as positive prompt, 'negative' as negative prompt.",
                "midjourney":       f"Paste 'midjourney' prompt into Discord /imagine.",
                "dalle3":           f"Paste 'dalle3' into ChatGPT image generation.",
                "firefly":          f"Paste 'optimized' into Adobe Firefly text-to-image.",
            }
        }
    }
