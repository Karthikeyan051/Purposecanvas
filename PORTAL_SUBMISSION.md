# PurposeCanvas - Portal Submission Text

Copy and paste the sections below directly into the submission portal text areas.

================================================================================
SECTION 1: ABSTRACT
================================================================================

Problem
Educational institutions adopting generative AI face rapidly growing cloud costs because most image generation tools are purpose-blind. Whether a teacher requests a simple line-art colouring page or a student prepares an exhibition poster, the system runs the same heavyweight model at the same settings (for example, SDXL at 1024 px and 25 steps). On everyday classroom drafts this wastes up to 98% of the GPU compute and electrical energy consumed.

Solution
PurposeCanvas is a resource-aware image generation gateway for schools and districts. It sits upstream of the GPU and does three things: it infers the pedagogical purpose of each request, it reuses previously generated images through a semantic vector cache, and it routes every remaining request to the leanest model tier that still meets the purpose, from SD-Turbo (512 px, 2-4 steps) to SDXL (1024 px, 20-25 steps). Every generation is measured with live NVIDIA NVML power telemetry, so cost and energy savings are shown, not assumed.

Key Features
- Measured savings: on our benchmark of 10 mixed classroom prompts, PurposeCanvas reduced GPU time by 92.4% and energy by 91.8% compared with the all-SDXL baseline (reaching 98.4% savings on draft line-art).
- Image Model Orchestration: uses stabilityai/sd-turbo (Adversarial Diffusion Distillation) for instant 1-second drafts and stabilityai/stable-diffusion-xl-base-1.0 for high-fidelity posters, managed via a memory-safe singleton with dynamic CPU offloading to run within an 8 GB VRAM budget.
- Live energy telemetry: GPU power is polled through NVML (pynvml) at 100ms intervals, and energy in Wh is calculated and displayed with the full formula.
- Purpose inference with teacher override: an ultra-fast LLM identifies the intent (outline, flashcard, worksheet, or poster) and the signal words behind it, proposes a tier with a short explanation, and lets the teacher override it in one click.
- Semantic deduplication: repeated curriculum prompts across teachers and schools are served from a FAISS vector cache with zero GPU time.
- Automated quality gate: failed outputs are escalated to the next tier automatically via OpenCV edge/contrast checks, so efficiency never costs usable quality.
- Curriculum PDF ingestion: lesson-plan PDFs are parsed into image prompts and optimised together as a batch.


================================================================================
SECTION 2: METHODOLOGY
================================================================================

PurposeCanvas runs every request through a five-stage pipeline:

1. Intent inference and signal extraction
The teacher's prompt is analysed by a fast Groq LLM agent against a structured educational schema. It returns the intent (Outline, Flashcard, Worksheet, or Poster), the signal words that justify it (for example "reception class", "colouring page", "detailed anatomical poster"), and a recommended tier (Draft, Standard, or Quality). A reasoning card explains the choice, and the teacher can override it in one click. When confidence is low, the system asks the teacher what the image is for instead of guessing. Median inference latency: 340 ms.

2. Semantic vector cache lookup
The prompt is embedded with all-MiniLM-L6-v2 and searched against a FAISS vector index of past district generations. If similarity exceeds 0.92, the stored image is returned with zero GPU time and zero generation energy.

3. Dynamic model and resource routing
Cache misses are dispatched to the leanest sufficient profile using a two-tier model architecture:
- Draft tier (outlines, colouring pages): stabilityai/sd-turbo at 512x512 resolution, 2 denoising steps, guidance_scale 0.0. Latency ~1.0s.
- Standard tier (flashcards, worksheets): stabilityai/sd-turbo at 512x512 to 768x768 resolution, 4-6 denoising steps. Latency ~2.0s to 4.0s.
- Quality tier (exhibition posters): stabilityai/stable-diffusion-xl-base-1.0 at 1024x1024 resolution, 20-25 denoising steps, guidance_scale 7.5. Latency ~40-60s.
Model Management & Utilization: Models are managed via a lazy-loading ModelManager singleton. To prevent out-of-memory (OOM) crashes on 8 GB GPUs (such as an NVIDIA RTX 5050 / RTX 3080), models are never co-resident in VRAM: when SDXL is summoned, SD-Turbo is dynamically moved to host CPU RAM; when SD-Turbo is active, SDXL is unloaded and PyTorch CUDA cache is purged.

4. Automated quality gate
OpenCV checks inspect each output tensor, using Canny edge detection and black/white pixel ratios for line art. An image that fails clarity thresholds is regenerated at the next tier automatically, with no teacher action.

5. Hardware telemetry and transparent accounting
Each generation records compute time T (time.perf_counter, with CUDA synchronisation) and average GPU power P_avg sampled continuously by a background thread via NVIDIA NVML (nvmlDeviceGetPowerUsage). Savings are computed as:
  Energy (Wh) = P_avg (W) x T (s) / 3600
  Compute saved (%) = (T_baseline - T_actual) / T_baseline x 100
  Energy saved (%) = (E_baseline - E_actual) / E_baseline x 100
Baseline: unoptimised SDXL, 1024x1024, 25 steps, no cache. All figures were measured with live hardware telemetry on an NVIDIA GPU (8 GB VRAM).


================================================================================
SECTION 3: REAL-WORLD EXAMPLES
================================================================================

Example 1: Kindergarten teacher (early childhood activity)
- Prompt: "A simple colouring page of a friendly cow in a meadow for reception class"
- Inferred intent: Outline, Draft tier
- Signal words: "colouring page", "reception class", "simple"
- Routing: SD-Turbo, 512x512, 2 steps
- Baseline (SDXL, 25 steps): 62.5 s | 5.56 Wh
- PurposeCanvas: 1.0 s | 0.09 Wh
- Impact: 98.4% compute saved and 98.4% energy saved, with a print-ready colouring page delivered in 1.0 seconds.

Example 2: High school biology (exhibition poster)
- Prompt: "Detailed high-resolution anatomical cross-section diagram of the human heart for biology exhibition"
- Inferred intent: Poster, Quality tier
- Signal words: "detailed", "high-resolution", "anatomical", "exhibition"
- Routing: SDXL Base 1.0, 1024x1024, 25 steps
- Execution: 62.5 s | 5.56 Wh
- Impact: heavy compute is spent only where the purpose genuinely needs high fidelity, so routine drafts no longer drain the district budget.
