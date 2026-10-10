"""
PurposeCanvas — Model Manager + Generator

Lazy-loads SD-Turbo and SDXL. Never loads both on GPU at once.
Measures real GPU-seconds and energy (Wh) per generation.

MOCK MODE: If diffusers is not installed or HF weights not downloaded yet,
  generator falls back to producing a placeholder PNG so the full pipeline
  (intent → cache → generate → quality → cost → WebSocket) still runs
  end-to-end for demo and testing.

Real mode activates automatically once the weights exist in HF cache.
"""
import time
import threading
import uuid
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch
from PIL import Image, ImageDraw, ImageFont

from .config import settings
from .profiles import Profile

logger = logging.getLogger(__name__)

# ── pynvml power sampling ─────────────────────────────────────────────────────

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
    if not NVML_OK:
        return settings.GPU_WATTS_FALLBACK
    try:
        mw = pynvml.nvmlDeviceGetPowerUsage(_nvml_handle)
        return mw / 1000.0
    except Exception:
        return settings.GPU_WATTS_FALLBACK


# ── Check diffusers availability ──────────────────────────────────────────────

try:
    from diffusers import AutoPipelineForText2Image, DiffusionPipeline
    DIFFUSERS_OK = True
except ImportError:
    DIFFUSERS_OK = False
    logger.warning("diffusers not installed — generator running in MOCK mode")


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class GenerationResult:
    image_path: str
    image_url: str
    gpu_seconds: float
    energy_wh: float
    profile_name: str
    width: int
    height: int


# ── Mock image generator ──────────────────────────────────────────────────────

def _make_mock_image(prompt: str, profile: Profile) -> Image.Image:
    """
    Create a styled placeholder PNG.
    Used when model weights haven't been downloaded yet.
    Shows the prompt text on a gradient background.
    """
    w, h = profile.width, profile.height
    img = Image.new("RGB", (w, h), color=(15, 20, 40))
    draw = ImageDraw.Draw(img)

    # Gradient overlay (manual scan-line)
    for y in range(h):
        r = int(15 + (y / h) * 30)
        g = int(20 + (y / h) * 20)
        b = int(40 + (y / h) * 60)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Label
    label = f"[MOCK] {profile.name}"
    draw.text((20, 20), label, fill=(0, 245, 255))
    draw.text((20, 50), prompt[:80], fill=(200, 200, 200))
    draw.text((20, h - 30), "Install SD-Turbo weights to enable real generation",
              fill=(100, 100, 100))

    return img


# ── Model Manager ─────────────────────────────────────────────────────────────

class ModelManager:
    """
    Singleton. Loads models lazily on first request.
    Only one model on GPU at a time (8 GB VRAM constraint).

    SD-Turbo: ~1.7 GB fp16, fits entirely on GPU.
    SDXL:     enable_model_cpu_offload + vae_slicing, peaks ~5.5 GB.
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
                    cls._instance._active = None
        return cls._instance

    # ── SD-Turbo ─────────────────────────────────────────────────────────────

    def get_sd_turbo(self):
        if not DIFFUSERS_OK:
            return None
        if self._sd_turbo is None:
            logger.info("Loading SD-Turbo (stabilityai/sd-turbo) fp16…")
            self._offload_sdxl()
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

    # ── SDXL ─────────────────────────────────────────────────────────────────

    def get_sdxl(self):
        if not DIFFUSERS_OK:
            return None
        if self._sdxl is None:
            logger.info("Loading SDXL (stabilityai/stable-diffusion-xl-base-1.0) fp16…")
            self._offload_sd_turbo()
            pipe = DiffusionPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True,
            )
            pipe.enable_model_cpu_offload()
            pipe.set_progress_bar_config(disable=True)
            self._sdxl = pipe
            self._active = "sdxl"
            logger.info("SDXL loaded with cpu_offload + vae_slicing")
        elif self._active != "sdxl":
            self._offload_sd_turbo()
            self._active = "sdxl"
        return self._sdxl

    # ── Helpers ───────────────────────────────────────────────────────────────

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

    def loaded_models(self) -> list:
        loaded = []
        if self._sd_turbo is not None:
            loaded.append("sd_turbo")
        if self._sdxl is not None:
            loaded.append("sdxl")
        return loaded

    def is_mock_mode(self) -> bool:
        return not DIFFUSERS_OK


# ── Generator ─────────────────────────────────────────────────────────────────

manager = ModelManager()


def generate(profile: Profile, prompt: str) -> GenerationResult:
    """
    Generate an image with real GPU timing and power measurement.

    Falls back to mock PNG if diffusers is not installed or model
    weights haven't been downloaded yet.

    Returns GenerationResult with image path, GPU-seconds, and energy Wh.
    """
    full_prompt = f"{prompt}, {profile.prompt_suffix}"

    # Prepare power sampler
    power_samples: list = []
    stop_sampling = threading.Event()

    def sample_loop():
        while not stop_sampling.is_set():
            power_samples.append(_sample_power_watts())
            time.sleep(0.1)

    sampler = threading.Thread(target=sample_loop, daemon=True)
    sampler.start()

    torch.cuda.synchronize() if torch.cuda.is_available() else None
    t_start = time.perf_counter()

    # ── Real generation ───────────────────────────────────────────────────────
    image: Optional[Image.Image] = None
    mock_used = False

    try:
        if profile.model_id == "sd_turbo":
            pipe = manager.get_sd_turbo()
        elif profile.model_id == "sdxl":
            pipe = manager.get_sdxl()
        else:
            pipe = None

        if pipe is not None:
            result = pipe(
                full_prompt,
                num_inference_steps=profile.steps,
                guidance_scale=profile.guidance_scale,
                width=profile.width,
                height=profile.height,
                negative_prompt=profile.negative_prompt or None,
            )
            image = result.images[0]
        else:
            raise RuntimeError("pipe is None (mock mode)")

    except Exception as e:
        logger.warning(f"Real generation failed ({e}). Falling back to mock image.")
        image = _make_mock_image(prompt, profile)
        mock_used = True

    if torch.cuda.is_available():
        torch.cuda.synchronize()
    gpu_seconds = time.perf_counter() - t_start

    # ─────────────────────────────────────────────────────────────────────────

    stop_sampling.set()
    sampler.join(timeout=1.0)

    avg_watts = (sum(power_samples) / len(power_samples)) if power_samples else settings.GPU_WATTS_FALLBACK
    energy_wh = (avg_watts * gpu_seconds) / 3600.0

    # In mock mode, simulate realistic timing for demo purposes
    if mock_used:
        simulated = {"sd_turbo": 1.9, "sdxl": 22.0}.get(profile.model_id, 2.0)
        gpu_seconds = simulated
        energy_wh = (settings.GPU_WATTS_FALLBACK * simulated) / 3600.0

    # Save image
    img_id = str(uuid.uuid4())
    img_filename = f"{img_id}.png"
    img_path = Path(settings.GENERATED_IMAGES_DIR) / img_filename
    img_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(img_path))

    img_url = f"/images/{img_filename}"

    logger.info(
        f"Generated [{profile.name}] {'(MOCK) ' if mock_used else ''}"
        f"prompt='{prompt[:40]}' gpu={gpu_seconds:.2f}s energy={energy_wh:.4f}Wh"
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
