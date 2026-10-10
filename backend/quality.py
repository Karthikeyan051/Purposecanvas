"""
PurposeCanvas — Quality Gate + Escalation
OpenCV-based checks (no ML, deterministic, instant).
FAIL → escalate to next profile tier.
"""
import logging
from dataclasses import dataclass
from typing import Optional

from PIL import Image

from .postprocess import get_pixel_stats
from .profiles import Profile, next_tier

logger = logging.getLogger(__name__)

# ── Thresholds ───────────────────────────────────────────────────────────────

BW_CHECKS = {
    "black_ratio_min": 0.03,   # image can't be nearly blank
    "black_ratio_max": 0.35,   # image can't be nearly solid black
    "white_ratio_min": 0.60,   # must have clean white background
    "gray_stddev_max": 50.0,   # no muddy mid-tone noise
}


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class QualityResult:
    passed: bool
    escalated: bool
    reason: Optional[str]        # human-readable if failed
    stats: dict                  # pixel stats for logging
    final_profile: Profile


# ── Gate ─────────────────────────────────────────────────────────────────────

def check(
    image: Image.Image,
    intent_type: str,
    intent_safe: bool,
    current_profile: Profile,
    generate_fn,                 # callable(profile) → (Image, gpu_s, energy_wh)
) -> tuple[Image.Image, QualityResult, float, float]:
    """
    Run quality checks. If failed, escalate and re-generate.
    Returns (final_image, quality_result, total_gpu_seconds, total_energy_wh).
    """
    # Safety is always checked first, regardless of type
    if not intent_safe:
        logger.warning("Safety flag False — rejecting image")
        return image, QualityResult(
            passed=False, escalated=False,
            reason="Content safety check failed",
            stats={}, final_profile=current_profile
        ), 0.0, 0.0

    # Colour types: skip pixel checks (not a colouring book)
    if intent_type not in ("outline", "worksheet"):
        return image, QualityResult(
            passed=True, escalated=False,
            reason=None, stats={}, final_profile=current_profile
        ), 0.0, 0.0

    total_extra_gpu_s = 0.0
    total_extra_wh = 0.0
    profile = current_profile

    for attempt in range(3):
        stats = get_pixel_stats(image)
        fail_reason = _check_bw(stats)

        if fail_reason is None:
            # PASS
            return image, QualityResult(
                passed=True,
                escalated=(attempt > 0),
                reason=None,
                stats=stats,
                final_profile=profile,
            ), total_extra_gpu_s, total_extra_wh

        # FAIL — try to escalate
        logger.warning(f"Quality FAIL attempt {attempt}: {fail_reason} | stats={stats}")
        up = next_tier(intent_type, profile.tier)

        if up is None:
            # At top of ladder — return best we have
            logger.error("Quality gate: top of ladder reached, returning best attempt")
            return image, QualityResult(
                passed=False,
                escalated=True,
                reason=f"Max escalation: {fail_reason}",
                stats=stats,
                final_profile=profile,
            ), total_extra_gpu_s, total_extra_wh

        # Escalate
        logger.info(f"Escalating from tier {profile.tier} → tier {up.tier}")
        profile = up
        new_image, extra_gpu_s, extra_wh = generate_fn(profile)
        image = new_image
        total_extra_gpu_s += extra_gpu_s
        total_extra_wh += extra_wh

    # Exhausted attempts
    return image, QualityResult(
        passed=False, escalated=True,
        reason="Exhausted escalation attempts",
        stats=get_pixel_stats(image), final_profile=profile,
    ), total_extra_gpu_s, total_extra_wh


def _check_bw(stats: dict) -> Optional[str]:
    """
    Returns a failure reason string, or None if checks pass.
    """
    br = stats.get("black_ratio", 0)
    wr = stats.get("white_ratio", 0)
    gs = stats.get("gray_stddev", 0)

    if br < BW_CHECKS["black_ratio_min"]:
        return f"Too few black pixels (blank image): {br:.3f} < {BW_CHECKS['black_ratio_min']}"
    if br > BW_CHECKS["black_ratio_max"]:
        return f"Too many black pixels (solid blob): {br:.3f} > {BW_CHECKS['black_ratio_max']}"
    if wr < BW_CHECKS["white_ratio_min"]:
        return f"Not enough white background: {wr:.3f} < {BW_CHECKS['white_ratio_min']}"
    if gs > BW_CHECKS["gray_stddev_max"]:
        return f"Too much mid-tone noise: stddev={gs:.1f} > {BW_CHECKS['gray_stddev_max']}"

    return None  # All checks passed
