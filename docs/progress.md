# PurposeCanvas – Progress Log

| Time | Milestone | Status | Notes |
|------|-----------|--------|-------|
| Sat 11:00 AM | Project start | ✅ | Repo initialized |
| Sat 11:xx AM | M0: Initial structure | ✅ | Skeleton created, .gitignore, .env.example, docs |
| — | M1: Backend skeleton + generator + profiles | 🔄 in progress | |
| — | M2: Intent LLM + cache + /api/generate | ⏳ pending | |
| — | M3: Quality gate + cost/energy + sqlite + /api/stats + /api/benchmark | ⏳ pending | |
| — | M4: Next.js Studio + Benchmark | ⏳ pending | |
| — | M5: Dashboard | ⏳ pending | |
| — | M6: WebSocket + 3D Control Room | ⏳ pending | |
| — | M7: README + pitch | ⏳ pending | |

## Benchmark Results
*(filled after M3 benchmark run)*

| Profile | Steps | GPU-s | Energy (Wh) | Cost ($) |
|---------|-------|-------|-------------|----------|
| outline (SD-Turbo 512) | 2 | — | — | — |
| flashcard (SD-Turbo 512) | 4 | — | — | — |
| poster (SDXL 1024) | 25 | — | — | — |

## Key Decisions
- FLUX skipped: won't fit in 8GB VRAM
- SDXL uses fp16 + enable_model_cpu_offload + vae_slicing to stay under 7GB
- Gemini model: gemini-2.0-flash for fast JSON intent parsing
- Cost labelled "assumed cloud rate" throughout UI (not measured billing)
