"""
PurposeCanvas — Model Manager + Generator
Lazy-loads SD-Turbo and SDXL, never both on GPU simultaneously.
Measures real GPU-seconds and energy (Wh) per generation.
"""
import time
import threading
import uuid
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch
from PIL import Image

from .config import settings
from .profiles import Profile

logger = logging.getLogger(__name__)

# ── pynvml power sampling ────────────────────────────────────────────────────

try:
    import pynvml
    pynvml.nvmlInit()
    _nvml_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
    NVML_OK = True
    logger.info("pynvml initialised — real GPU power sampling active")
except Exception as e:
    NVML_OK = False
    logger.warning(f"pynvml unavailable ({e}), using fallback {settings.GPU_WATTS_FALLBACK}W")


def _sample_power_watts() -> float:
    """Return current GPU power draw in watts."""
    if not NVML_OK:
        return settings.GPU_WATTS_FALLBACK
    try:
        mw = pynvml.nvmlDeviceGetPowerUsage(_nvml_handle)
        return mw / 1000.0
    except Exception:
        return settings.GPU_WATTS_FALLBACK


# ── Result dataclass ─────────────────────────────────────────────────────────

@dataclass
class GenerationResult:
    image_path: str
    image_url: str
    gpu_seconds: float
    energy_wh: float
    profile_name: str
    width: int
    height: int


# ── Model Manager ────────────────────────────────────────────────────────────

class ModelManager:
    """
    Singleton. Loads models lazily.
    Mutual exclusion: only one model fully on GPU at a time.
    SD-Turbo: always .to("cuda") — fits in ~4GB fp16.
    SDXL: enable_model_cpu_offload + vae_slicing — peaks ~5.5GB.
    """
    _instance: Optional["ModelManager"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._sd_turbo = None
                    cls._instance._sdxl = None
                    cls._instance._active = None  # "sd_turbo" | "sdxl" | None
        return cls._instance

    # ── SD-Turbo ────────────────────────────────────────────────────────────

    def get_sd_turbo(self):
        if self._sd_turbo is None:
            logger.info("Loading SD-Turbo (stabilityai/sd-turbo) fp16…")
            self._offload_sdxl()
            from diffusers import AutoPipelineForText2Image
            pipe = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sd-turbo",
                torch_dtype=torch.float16,
                variant="fp16",
            )
            pipe = pipe.to("cuda")
            pipe.set_progress_bar_config(disable=True)
            self._sd_turbo = pipe
            self._active = "sd_turbo"
            logger.info("SD-Turbo loaded on GPU")
        elif self._active != "sd_turbo":
            self._sd_turbo = self._sd_turbo.to("cuda")
            self._active = "sd_turbo"
        return self._sd_turbo

    # ── SDXL ────────────────────────────────────────────────────────────────

    def get_sdxl(self):
        if self._sdxl is None:
            logger.info("Loading SDXL (stabilityai/stable-diffusion-xl-base-1.0) fp16…")
            self._offload_sd_turbo()
            from diffusers import DiffusionPipeline
            pipe = DiffusionPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True,
            )
            pipe.enable_model_cpu_offload()
            pipe.enable_vae_slicing()
            pipe.set_progress_bar_config(disable=True)
            self._sdxl = pipe
            self._active = "sdxl"
            logger.info("SDXL loaded with cpu_offload + vae_slicing")
        elif self._active != "sdxl":
            self._offload_sd_turbo()
            self._active = "sdxl"
        return self._sdxl

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _offload_sd_turbo(self):
        if self._sd_turbo is not None and self._active == "sd_turbo":
            logger.info("Moving SD-Turbo to CPU to free VRAM for SDXL")
            self._sd_turbo = self._sd_turbo.to("cpu")
            torch.cuda.empty_cache()

    def _offload_sdxl(self):
        if self._sdxl is not None:
            logger.info("Clearing SDXL from VRAM for SD-Turbo")
            self._sdxl = None
            torch.cuda.empty_cache()

    def loaded_models(self) -> list[str]:
        loaded = []
        if self._sd_turbo is not None:
            loaded.append("sd_turbo")
        if self._sdxl is not None:
            loaded.append("sdxl")
        return loaded


# ── Generator ────────────────────────────────────────────────────────────────

manager = ModelManager()


def generate(profile: Profile, prompt: str) -> GenerationResult:
    """
    Generate an image with real GPU timing and power measurement.
    Returns GenerationResult with image path, GPU-seconds, and energy Wh.
    """
    # Build full prompt
    full_prompt = f"{prompt}, {profile.prompt_suffix}"

    # Select model
    if profile.model_id == "sd_turbo":
        pipe = manager.get_sd_turbo()
    elif profile.model_id == "sdxl":
        pipe = manager.get_sdxl()
    else:
        raise ValueError(f"Unknown model_id: {profile.model_id}")

    # Power sampling in background thread
    power_samples: list[float] = []
    stop_sampling = threading.Event()

    def sample_loop():
        while not stop_sampling.is_set():
            power_samples.append(_sample_power_watts())
            time.sleep(0.1)

    sampler = threading.Thread(target=sample_loop, daemon=True)
    sampler.start()

    # ── Generate ────────────────────────────────────────────────────────────
    torch.cuda.synchronize()
    t_start = time.perf_counter()

    result = pipe(
        full_prompt,
        num_inference_steps=profile.steps,
        guidance_scale=profile.guidance_scale,
        width=profile.width,
        height=profile.height,
        negative_prompt=profile.negative_prompt if profile.negative_prompt else None,
    )
    image: Image.Image = result.images[0]

    torch.cuda.synchronize()
    gpu_seconds = time.perf_counter() - t_start
    # ────────────────────────────────────────────────────────────────────────

    stop_sampling.set()
    sampler.join(timeout=1.0)

    # Compute energy
    avg_watts = (sum(power_samples) / len(power_samples)) if power_samples else settings.GPU_WATTS_FALLBACK
    energy_wh = (avg_watts * gpu_seconds) / 3600.0

    # Save image
    img_id = str(uuid.uuid4())
    img_filename = f"{img_id}.png"
    img_path = Path(settings.GENERATED_IMAGES_DIR) / img_filename
    image.save(str(img_path))

    img_url = f"/images/{img_filename}"

    logger.info(
        f"Generated [{profile.name}] prompt='{prompt[:40]}...' "
        f"gpu={gpu_seconds:.2f}s energy={energy_wh:.4f}Wh"
    )

    return GenerationResult(
        image_path=str(img_path),
        image_url=img_url,
        gpu_seconds=gpu_seconds,
        energy_wh=energy_wh,
        profile_name=profile.name,
        width=profile.width,
        height=profile.height,
    )
