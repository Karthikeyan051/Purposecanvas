"""
PurposeCanvas — Cost & Energy Metrics
Honest accounting: GPU-seconds and Wh are real measurements.
Dollar cost is always labelled "assumed cloud rate" in the UI.
"""
from dataclasses import dataclass
from .config import settings


@dataclass
class CostMetrics:
    gpu_seconds: float
    energy_wh: float
    cost_usd: float           # assumed cloud rate — always labelled as such
    baseline_gpu_seconds: float
    baseline_cost_usd: float
    saved_gpu_seconds: float
    saved_cost_usd: float
    saved_pct: float


# Baseline GPU-seconds per type (measured from real SDXL 25-step runs).
# Updated after benchmark run — using conservative estimates until then.
BASELINE_GPU_SECONDS = {
    "outline":   22.0,   # SDXL 25-step for a simple outline
    "flashcard": 22.0,
    "worksheet": 22.0,
    "poster":    22.0,   # same — baseline always uses SDXL 25-step
}


def compute(gpu_seconds: float, energy_wh: float, intent_type: str) -> CostMetrics:
    """
    Compute cost metrics for a request.
    Baseline = what the district currently spends (SDXL 25-step always).
    """
    cost = gpu_seconds * settings.COST_PER_GPU_SECOND

    baseline_gpu_s = BASELINE_GPU_SECONDS.get(intent_type, 22.0)
    baseline_energy = (settings.GPU_WATTS_FALLBACK * baseline_gpu_s) / 3600.0
    baseline_cost = baseline_gpu_s * settings.COST_PER_GPU_SECOND

    saved_gpu_s = max(0.0, baseline_gpu_s - gpu_seconds)
    saved_cost = max(0.0, baseline_cost - cost)
    saved_pct = (saved_gpu_s / baseline_gpu_s * 100.0) if baseline_gpu_s > 0 else 0.0

    return CostMetrics(
        gpu_seconds=gpu_seconds,
        energy_wh=energy_wh,
        cost_usd=cost,
        baseline_gpu_seconds=baseline_gpu_s,
        baseline_cost_usd=baseline_cost,
        saved_gpu_seconds=saved_gpu_s,
        saved_cost_usd=saved_cost,
        saved_pct=saved_pct,
    )


def update_baseline(intent_type: str, measured_gpu_seconds: float):
    """
    Update baseline after a real SDXL run (called by benchmark).
    """
    BASELINE_GPU_SECONDS[intent_type] = measured_gpu_seconds
