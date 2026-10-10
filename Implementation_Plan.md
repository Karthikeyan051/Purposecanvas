# PurposeCanvas — Remaining Implementation Plan

This document outlines the implementation plan for the remaining features (Features 4 through 13) required to complete the PurposeCanvas backend, analytics, and "Wow Factor" UI elements. 

*Note: The frontend UI structure will be entirely reframed and rebuilt from scratch based on this plan to ensure a cohesive, premium aesthetic.*

---

## 🔴 Priority: MUST HAVE

### Feature 4 — Lazy-Loading Model Manager (VRAM Safe)
**Difficulty:** Medium | **Time:** 45 min
*   **What it is:** A Singleton ModelManager that lazy-loads models and ensures mutual exclusion (never loads SD-Turbo and SDXL onto the GPU at the same time).
*   **Implementation details:**
    *   **SD-Turbo:** `stabilityai/sd-turbo`, fp16, `.to("cuda")` (uses ~4.0 GB VRAM).
    *   **SDXL:** `stabilityai/stable-diffusion-xl-base-1.0`, fp16, `enable_model_cpu_offload()`, `enable_vae_slicing()` (uses ~4.5 GB VRAM).
    *   Measure real GPU-seconds using `torch.cuda.synchronize()`.
    *   Measure real Wh with `pynvml` power sampling (fallback: 150W estimate).

### Feature 5 — Quality Gate + Automatic Escalation
**Difficulty:** Medium | **Time:** 40 min
*   **What it is:** A deterministic OpenCV check on generated images to ensure printability and quality without using extra GPU resources.
*   **Implementation details:**
    *   Convert to grayscale.
    *   Check black ratio (`0.03-0.35`).
    *   Check white ratio (`>= 0.60`).
    *   Check gray noise (`std < 50`).
    *   If PASS: Return image.
    *   If FAIL: Escalate to the next tier profile, re-generate, set `escalated=True`. Return best attempt on the 3rd failure.

### Feature 6 — Postprocessing Pipeline
**Difficulty:** Low | **Time:** 20 min
*   **What it is:** Applied to BW types (Outline, Worksheet) before the quality check to ensure crisp, printable black-and-white lines.
*   **Implementation details:**
    *   PIL → numpy → grayscale → `cv2.adaptiveThreshold` → resize 2x (LANCZOS) → PIL.
    *   Eliminates grey halos inherent in raw SD-Turbo generations.

### Feature 7 — SQLite Request Logger + Stats API
**Difficulty:** Low | **Time:** 30 min
*   **What it is:** A robust tracking system to log every request and provide data for the analytics dashboard.
*   **Implementation details:**
    *   SQLite table `requests` tracking: prompt, type, profile, cache_hit, escalated, gpu_seconds, energy_wh, cost, etc.
    *   `GET /api/stats` endpoint returning aggregated data (total savings, per-school breakdown, cache hit rates).

### Feature 8 — Studio Page (The Main Demo UI)
**Difficulty:** Medium | **Time:** 90 min
*   **What it is:** The primary interface for teachers, featuring live stats and timeline events. *(To be built during the full UI rewrite).*
*   **Implementation details:**
    *   Smart vs Baseline mode toggles.
    *   Dynamic resource metric badges (GPU-s, Wh, Savings % vs Baseline).
    *   Live routing timeline animated via WebSockets.

---

## 🟡 Priority: SHOULD HAVE

### Feature 9 — Cost & Energy Measurement
**Difficulty:** Low | **Time:** 20 min
*   **What it is:** Honest, auditable reporting of compute resources.
*   **Implementation details:**
    *   Calculate real energy based on `pynvml` mean power during generation.
    *   Estimate dollar cost (e.g., assumed cloud rate $0.0004/GPU-s).
    *   Calculate dynamic savings percentages against the SDXL 25-step baseline.

### Feature 10 — Analytics Dashboard
**Difficulty:** Medium | **Time:** 75 min
*   **What it is:** A dark-themed, data-rich `/dashboard` using Recharts to visualize the impact of PurposeCanvas.
*   **Implementation details:**
    *   GPU-seconds saved over time (Line chart).
    *   Per-school savings (Bar chart).
    *   Requests by type (Donut chart).
    *   Live count-up animated stats for total savings (Framer Motion).

### Feature 11 — 20-Prompt Benchmark Comparison
**Difficulty:** Medium | **Time:** 60 min
*   **What it is:** A `/benchmark` page that runs 20 fixed prompts (14 Outlines, 3 Flashcards, 3 Posters) simultaneously in Baseline and Smart modes.
*   **Implementation details:**
    *   Side-by-side execution display.
    *   Live progress bar and massive "BIG HERO NUMBER" showing total GPU seconds saved.

### Feature 12 — WebSocket Real-Time Event System
**Difficulty:** Medium | **Time:** 45 min
*   **What it is:** The nervous system of the application, feeding real-time state changes to the UI.
*   **Implementation details:**
    *   FastAPI ConnectionManager broadcasting JSON events (`request_received`, `cache_hit`, `generating_start`, `escalated`, `complete`).
    *   React `useWebSocket` hook to consume and animate timelines.

---

## 🟢 Priority: WOW FACTOR

### Feature 13 — 3D Control Room
**Difficulty:** High | **Time:** 90 min
*   **What it is:** An interactive `/control-room` built with React Three Fiber.
*   **Implementation details:**
    *   A low-poly office visualizing the routing logic in real-time based on WebSocket events.
    *   Inbox (requests land here).
    *   Junior Desks (SD-Turbo), Senior Desk (SDXL), Librarian (Cache).
    *   Animations trigger based on where the request is routed, ending with a live savings ticker pulse.
