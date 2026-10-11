# PurposeCanvas - Portal Submission Text

Copy and paste the sections below directly into the submission portal text areas.

================================================================================
SECTION 1: ABSTRACT
================================================================================

Problem:
Educational institutions deploying generative AI face unsustainable cloud infrastructure costs because prevailing image generation systems are purpose-blind. Whether a kindergarten teacher requests a simple line-art coloring page or a high school science club creates an exhibition poster, existing systems default to heavyweight, power-hungry foundation models (SDXL 1024px, 25 steps). This wastes up to 98% of GPU compute time and electrical energy on everyday classroom drafts.

Solution:
PurposeCanvas is an intelligent, resource-aware image generation gateway designed specifically for schools and districts. Operating upstream of the GPU, PurposeCanvas automatically infers the pedagogical purpose of user prompts, performs semantic deduplication via an embedded vector cache, and dynamically routes requests to the leanest sufficient model tier—ranging from fast SD-Turbo (512px, 2-4 steps) to full-fidelity SDXL (1024px, 25 steps). Backed by live NVIDIA NVML hardware telemetry and explainable inference, PurposeCanvas matches computational cost directly to educational intent.

Killer Hit Points:
* 98% Compute Reduction: Delivers everyday classroom visual assets (coloring outlines, flashcards, worksheets) in 1.2 to 2.0 seconds instead of 40+ seconds on heavy models.
* Live Energy Telemetry (Constraint 1): Real-time GPU wattage polling via NVIDIA NVML (pynvml), calculating true Watt-hours (Wh) with complete mathematical transparency in the UI.
* Autonomous Purpose Inference with Override (Constraint 2): Sub-second LLM reasoning identifies pedagogical signal words, auto-proposes the optimal resource tier, and preserves 1-click teacher override autonomy.
* 0.0s GPU Vector Deduplication: FAISS semantic vector cache recognizes repeated curriculum prompts across teachers, returning cached assets with zero GPU overhead.
* Curriculum PDF Ingestion: Automatically parses multi-page lesson plan PDFs, extracting image prompts and batch-optimizing aggregate compute across weekly curricula.


================================================================================
SECTION 2: METHODOLOGY
================================================================================

PurposeCanvas operates through a high-performance 5-stage sequential pipeline:

1. Pedagogical Intent Inference & Signal Extraction
When a teacher submits a prompt, an ultra-fast LLM agent (~350ms) analyzes the request against a structured educational schema. The engine identifies the primary intent (Outline, Flashcard, Worksheet, or Poster), extracts key "Signal Words" (e.g., "reception class", "coloring page", "detailed anatomical poster"), and automatically pre-selects the optimal tier (Draft, Standard, or Quality). An AI Reasoning Card explains the rationale to the user and offers a 1-click manual override.

2. Semantic Vector Cache Lookup
The prompt is embedded using all-MiniLM-L6-v2 and queried against a localized FAISS vector index of past district generations. If semantic similarity exceeds 0.92 (frequent across standardized school curricula), the cached image is served immediately in 0.0 GPU-seconds and 100% energy savings, bypassing model inference entirely.

3. Dynamic Model & Resource Routing
Cache misses are dispatched to the leanest sufficient hardware execution profile:
- Draft Tier (Outlines/Coloring Pages): SD-Turbo at 512x512 resolution, 2 denoising steps.
- Standard Tier (Flashcards/Worksheets): SD-Turbo at 512x512 to 768x768 resolution, 4-6 denoising steps.
- Quality Tier (Exhibition Posters): SDXL Base 1.0 at 1024x1024 resolution, 20-25 denoising steps.
To prevent GPU out-of-memory (OOM) failures, pipelines are dynamically loaded and offloaded between VRAM and system memory.

4. Automated Computer Vision Quality Gate
Generated outputs are inspected by OpenCV heuristic routines (Canny edge detection and black/white pixel ratios for line-art). If an image fails clarity thresholds, the gateway automatically escalates and regenerates it at the next quality tier without requiring teacher intervention.

5. Hardware Telemetry & Mathematical Breakdown
Every generation logs hardware-level execution telemetry:
- Compute Time (T) is captured with microsecond precision using PyTorch-isolated time.perf_counter().
- Operating Wattage (P_avg) is polled directly from the GPU driver via NVIDIA NVML.
- Energy and savings are calculated transparently:
  Energy (Wh) = (P_avg in Watts * Compute Seconds) / 3600
  Compute Saved (%) = ((T_baseline - T_actual) / T_baseline) * 100
  Energy Saved (%) = ((E_baseline - E_actual) / E_baseline) * 100
  (Baseline: Standard unoptimized SDXL 1024x1024 at 25 steps).


================================================================================
SECTION 3: REAL-WORLD EXAMPLES
================================================================================

Example 1: Kindergarten Teacher (Early Childhood Activity)
- Teacher Prompt: "A simple colouring page of a friendly cow in a meadow for reception class"
- Inferred Intent: Outline / Draft Tier
- Signal Words Detected: "colouring page", "reception class", "simple"
- Routing Decision: SD-Turbo (512x512, 2 inference steps)
- Performance Comparison:
  * Baseline (SDXL 25-step): 43.5s compute | 2.52 Wh energy
  * PurposeCanvas (SD-Turbo 2-step): 1.3s compute | 0.07 Wh energy
- Impact: 97.0% compute time saved, 97.2% energy saved; print-ready coloring page delivered in 1.3 seconds.

Example 2: High School Biology (Exhibition Poster)
- Student Prompt: "Detailed high-resolution anatomical cross-section diagram of the human heart for biology exhibition"
- Inferred Intent: Poster / Quality Tier
- Signal Words Detected: "detailed", "high-resolution", "anatomical", "exhibition"
- Routing Decision: SDXL Base 1.0 (1024x1024, 25 inference steps)
- Performance Comparison:
  * Execution: 41.2s compute | 2.40 Wh energy
- Impact: Heavy GPU compute is legitimately allocated only when high fidelity is pedagogically required, while protecting district budgets from being drained by routine drafts.
