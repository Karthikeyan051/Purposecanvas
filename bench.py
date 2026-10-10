"""
bench.py — SD-Turbo + SDXL timing benchmark
Run from repo root with venv active:
  python bench.py

Paste the output into docs/progress.md
"""
import time
import torch
from diffusers import AutoPipelineForText2Image, DiffusionPipeline
from PIL import Image

print("=" * 60)
print("PurposeCanvas Benchmark — SD-Turbo + SDXL")
print("=" * 60)
print(f"CUDA: {torch.cuda.is_available()} | {torch.cuda.get_device_name(0)}")
print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
print()

PROMPT_BW = (
    "black and white line art outline of a cow, thick clean lines, "
    "white background, colouring book for kids, no shading"
)
PROMPT_COLOUR = (
    "vibrant educational poster about photosynthesis, "
    "full colour, high quality, classroom display"
)

# ── SD-Turbo ─────────────────────────────────────────────────────────────────
print("Loading SD-Turbo (stabilityai/sd-turbo)...")
turbo = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sd-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")
turbo.set_progress_bar_config(disable=True)
print("Loaded.\n")

# Warm-up
turbo(PROMPT_BW, num_inference_steps=1, guidance_scale=0.0, width=512, height=512)
print("Warm-up done.\n")

turbo_results = []
for steps, w, h, label in [
    (2, 512, 512, "outline_turbo_512_2step"),
    (4, 512, 512, "flashcard_turbo_512_4step"),
    (4, 768, 768, "outline_turbo_768_4step"),
]:
    torch.cuda.synchronize()
    t = time.perf_counter()
    img = turbo(PROMPT_BW, num_inference_steps=steps, guidance_scale=0.0,
                width=w, height=h).images[0]
    torch.cuda.synchronize()
    dt = time.perf_counter() - t
    img.save(f"bench_{label}.png")
    turbo_results.append((label, steps, w, dt))
    print(f"  [{label}]  steps={steps}  {w}px  →  {dt:.2f}s  saved: bench_{label}.png")

# Free VRAM before SDXL
del turbo
torch.cuda.empty_cache()
print()

# ── SDXL ─────────────────────────────────────────────────────────────────────
print("Loading SDXL (stabilityai/stable-diffusion-xl-base-1.0)...")
sdxl = DiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
sdxl.enable_model_cpu_offload()
sdxl.enable_vae_slicing()
sdxl.set_progress_bar_config(disable=True)
print("Loaded.\n")

sdxl_results = []
for steps, label in [(12, "outline_sdxl_1024_12step"), (25, "poster_sdxl_1024_25step")]:
    prompt = PROMPT_BW if "outline" in label else PROMPT_COLOUR
    torch.cuda.synchronize()
    t = time.perf_counter()
    img = sdxl(prompt, num_inference_steps=steps, guidance_scale=7.5,
               width=1024, height=1024).images[0]
    torch.cuda.synchronize()
    dt = time.perf_counter() - t
    img.save(f"bench_{label}.png")
    sdxl_results.append((label, steps, 1024, dt))
    print(f"  [{label}]  steps={steps}  1024px  →  {dt:.2f}s  saved: bench_{label}.png")

# ── Summary ──────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("RESULTS — paste into docs/progress.md")
print("=" * 60)
baseline_gpu_s = None
for label, steps, size, dt in turbo_results + sdxl_results:
    cost = dt * 0.0004
    if label == "poster_sdxl_1024_25step":
        baseline_gpu_s = dt
    print(f"  {label:<40} {dt:.2f}s   ${cost:.5f}")

if baseline_gpu_s:
    print()
    print("Savings vs baseline (SDXL 25-step = {:.2f}s):".format(baseline_gpu_s))
    for label, steps, size, dt in turbo_results:
        saved = baseline_gpu_s - dt
        pct = saved / baseline_gpu_s * 100
        print(f"  {label:<40} saved {saved:.2f}s  ({pct:.1f}%)")
