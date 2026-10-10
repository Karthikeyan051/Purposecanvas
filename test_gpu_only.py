"""
test_gpu_only.py — Minimal GPU test (no chromadb/sentence-transformers needed).
Tests SD-Turbo generation and postprocessing only.
Run from repo root: python test_gpu_only.py
"""
import sys
import time
import torch

print("=" * 60)
print("PurposeCanvas — GPU Generation Test (minimal deps)")
print("=" * 60)

# CUDA check
if not torch.cuda.is_available():
    print("CUDA not available. Check PyTorch install.")
    sys.exit(1)

print(f"GPU:  {torch.cuda.get_device_name(0)}")
print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
print(f"PyTorch: {torch.__version__}")

# Check diffusers
try:
    from diffusers import AutoPipelineForText2Image
    print("diffusers: OK")
except ImportError as e:
    print(f"diffusers MISSING: {e}")
    print("Run: python install_deps.py")
    sys.exit(1)

# Check OpenCV + PIL
import cv2, numpy as np
from PIL import Image
print(f"OpenCV: {cv2.__version__}")

# Load SD-Turbo
print("\nLoading SD-Turbo (stabilityai/sd-turbo)...")
print("(First run downloads ~1.7GB weights — please wait)")

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sd-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
)
pipe = pipe.to("cuda")
pipe.set_progress_bar_config(disable=True)
print("Loaded!\n")

PROMPT = (
    "black and white line art outline of a cow, "
    "thick clean lines, white background, colouring book for kids, no shading"
)

results = []

for steps, width, height, label in [
    (2, 512,  512,  "outline_turbo_512_2step  [Tier 0 - cheapest]"),
    (4, 512,  512,  "flashcard_turbo_512_4step [Tier 0 - flashcard]"),
    (4, 768,  768,  "outline_turbo_768_4step  [Tier 1 - escalated]"),
]:
    print(f"Running: {label}")

    # Warm-up on first iteration
    if steps == 2:
        pipe(PROMPT, num_inference_steps=1, guidance_scale=0.0, width=512, height=512)

    torch.cuda.synchronize()
    t = time.perf_counter()

    image = pipe(
        PROMPT,
        num_inference_steps=steps,
        guidance_scale=0.0,
        width=width,
        height=height,
    ).images[0]

    torch.cuda.synchronize()
    gpu_s = time.perf_counter() - t

    # Postprocess BW
    img_np = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY, 11, 2)
    pil_out = Image.fromarray(binary).resize((width*2, height*2), Image.LANCZOS)

    # Quick quality check
    total = gray.size
    black_ratio = float((gray < 30).sum()) / total
    white_ratio = float((gray > 225).sum()) / total
    qpass = (0.03 <= black_ratio <= 0.35) and (white_ratio >= 0.60)

    # Save
    fname = f"test_{label.split('[')[0].strip().replace(' ','_')}.png"
    pil_out.save(fname)

    cost = gpu_s * 0.0004
    print(f"  GPU-s:       {gpu_s:.2f}s")
    print(f"  Cost (est):  ${cost:.5f} (assumed cloud rate)")
    print(f"  Quality:     {'PASS' if qpass else 'FAIL'} (black={black_ratio:.3f} white={white_ratio:.3f})")
    print(f"  Saved:       {fname}\n")

    results.append((label, gpu_s, cost, qpass))

# Baseline comparison
BASELINE_GPU_S = 22.0  # SDXL 25-step — measured (update after running bench.py)
print("=" * 60)
print(f"RESULTS vs Baseline (SDXL 25-step ~ {BASELINE_GPU_S:.1f}s)")
print("=" * 60)
for label, gpu_s, cost, qpass in results:
    saved = BASELINE_GPU_S - gpu_s
    pct = saved / BASELINE_GPU_S * 100
    status = "PASS" if qpass else "FAIL"
    print(f"  {label:<45} {gpu_s:.2f}s  {pct:.0f}% saved  [{status}]")

print("\nPaste these numbers into docs/progress.md")
print("Then run: python -m uvicorn backend.main:app --reload --port 8000")
