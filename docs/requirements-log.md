# Requirements Log

> This file is the authoritative record of all requirements. New instructions from organizers will be pasted here as they are released.

## Initial Requirements (Sat 11:00 AM)

- **Track**: Generative AI – PS1: Resource-Aware Image Generation
- **Scenario**: District education office, 300 schools, AI image tool, cloud bill tripled
- **Core insight**: "The tool never asks what the picture is for"
- **Product**: PurposeCanvas – purpose-aware image generation gateway

### Key Features
1. Purpose detection via LLM (Gemini) with keyword fallback
2. Cache lookup (ChromaDB cosine similarity ≥ 0.88)
3. Profile routing: outline → SD-Turbo 2 steps; poster → SDXL 25 steps
4. Quality gate with escalation
5. Cost/energy tracking per school and type
6. Studio, Benchmark, Dashboard, Control Room UI

### Architecture decisions
- Backend: FastAPI + diffusers (SD-Turbo, SDXL fp16 + CPU offload)
- Frontend: Next.js app router + Tailwind + shadcn/ui + Framer Motion
- DB: SQLite (requests log) + ChromaDB (semantic cache)
- Intent: Gemini gemini-2.0-flash JSON schema, fallback to keyword rules

---

## Updates

*(Paste new organizer instructions here as they are released during the event)*
