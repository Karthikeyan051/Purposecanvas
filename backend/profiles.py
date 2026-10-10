"""
PurposeCanvas — Generation Profile Ladder
Maps intent type → ordered list of profiles (cheapest first).
Escalation: quality gate moves to next tier on failure.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Profile:
    name: str
    model_id: str          # "sd_turbo" | "sdxl"
    width: int
    height: int
    steps: int
    guidance_scale: float
    prompt_suffix: str
    negative_prompt: str
    tier: int = 0


# ── Prompt helpers ──────────────────────────────────────────────────────────

_BW_SUFFIX = (
    "thick clean black outlines on white background, "
    "children's colouring book, no shading, no colour fills, "
    "simple bold line art"
)
_BW_NEG = (
    "color, colour, shading, gradients, grey, gray, blurry, "
    "photorealistic, complex background, watermark"
)

_FLASH_SUFFIX = (
    "flat vector illustration, bright primary colours, "
    "educational flashcard style, clean white background, "
    "simple shapes, bold outlines"
)
_FLASH_NEG = "blurry, photorealistic, dark, complex background, watermark"

_POSTER_SUFFIX = (
    "vibrant full colour, high detail, professional illustration, "
    "classroom display quality, publication ready"
)
_POSTER_NEG = "blurry, low quality, watermark, dark, monochrome"


# ── Profile Ladders ──────────────────────────────────────────────────────────

PROFILES: dict[str, list[Profile]] = {
    "outline": [
        Profile(
            name="outline_turbo_512_2step",
            model_id="sd_turbo",
            width=512, height=512, steps=2,
            guidance_scale=0.0,
            prompt_suffix=_BW_SUFFIX,
            negative_prompt=_BW_NEG,
            tier=0,
        ),
        Profile(
            name="outline_turbo_768_4step",
            model_id="sd_turbo",
            width=768, height=768, steps=4,
            guidance_scale=0.0,
            prompt_suffix=_BW_SUFFIX + ", highly detailed",
            negative_prompt=_BW_NEG,
            tier=1,
        ),
        Profile(
            name="outline_sdxl_1024_12step",
            model_id="sdxl",
            width=1024, height=1024, steps=12,
            guidance_scale=7.5,
            prompt_suffix=_BW_SUFFIX + ", professional line art illustration",
            negative_prompt=_BW_NEG,
            tier=2,
        ),
    ],

    "worksheet": [
        Profile(
            name="worksheet_turbo_512_4step",
            model_id="sd_turbo",
            width=512, height=512, steps=4,
            guidance_scale=0.0,
            prompt_suffix=_BW_SUFFIX + ", worksheet layout, educational",
            negative_prompt=_BW_NEG,
            tier=0,
        ),
        Profile(
            name="worksheet_sdxl_1024_15step",
            model_id="sdxl",
            width=1024, height=1024, steps=15,
            guidance_scale=7.5,
            prompt_suffix=_BW_SUFFIX + ", clear worksheet, educational printable",
            negative_prompt=_BW_NEG,
            tier=1,
        ),
    ],

    "flashcard": [
        Profile(
            name="flashcard_turbo_512_4step",
            model_id="sd_turbo",
            width=512, height=512, steps=4,
            guidance_scale=0.0,
            prompt_suffix=_FLASH_SUFFIX,
            negative_prompt=_FLASH_NEG,
            tier=0,
        ),
        Profile(
            name="flashcard_sdxl_1024_15step",
            model_id="sdxl",
            width=1024, height=1024, steps=15,
            guidance_scale=7.5,
            prompt_suffix=_FLASH_SUFFIX + ", high quality educational illustration",
            negative_prompt=_FLASH_NEG,
            tier=1,
        ),
    ],

    "poster": [
        Profile(
            name="poster_sdxl_1024_25step",
            model_id="sdxl",
            width=1024, height=1024, steps=25,
            guidance_scale=7.5,
            prompt_suffix=_POSTER_SUFFIX,
            negative_prompt=_POSTER_NEG,
            tier=0,
        ),
    ],
}

# Baseline profile (district's current tool — always SDXL 25 step)
BASELINE_PROFILE = Profile(
    name="baseline_sdxl_1024_25step",
    model_id="sdxl",
    width=1024, height=1024, steps=25,
    guidance_scale=7.5,
    prompt_suffix=_POSTER_SUFFIX,
    negative_prompt=_POSTER_NEG,
    tier=0,
)


def get_profile(intent_type: str, tier: int = 0) -> Profile:
    """Get profile for a given intent type and tier."""
    ladder = PROFILES.get(intent_type, PROFILES["flashcard"])
    tier = min(tier, len(ladder) - 1)
    return ladder[tier]


def next_tier(intent_type: str, current_tier: int) -> Optional[Profile]:
    """Get the next (more expensive) profile, or None if at top."""
    ladder = PROFILES.get(intent_type, PROFILES["flashcard"])
    next_t = current_tier + 1
    if next_t >= len(ladder):
        return None
    return ladder[next_t]


def get_ladder(intent_type: str) -> list[Profile]:
    """Get all profiles for a type."""
    return PROFILES.get(intent_type, PROFILES["flashcard"])
